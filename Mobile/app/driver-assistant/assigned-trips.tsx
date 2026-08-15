import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, type Href, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import scheduleOperationsApi from '@/api/scheduleOperations.api';
import { AppButton } from '@/components/AppButton';
import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/colors';
import { formatDriverStatus, useDriverI18n } from '@/i18n/driver';
import { useAuthStore } from '@/store/auth.store';
import type { AssignedTrip } from '@/types/scheduleOperations';
import { goBackOrReplace } from '@/utils/navigation';
import { normalizeRole } from '@/utils/roleNavigation';
import {
  formatTime,
  findEarlierUnfinishedTrip,
  getAssignedTripsRange,
  getTripArrivalTimeLabel,
  getTripDepartureTimeLabel,
  getTripServiceDateLabel,
  getTripScheduleAdjustmentMinutes,
  getTripVehicleLabel,
  getVehicleLabel,
  hasVehicleReplacement,
  hasTripScheduleAdjustment,
  getTripStatus,
  getTripWorkflowStep,
  isTripCompleted,
  isTripDeparturePassed,
  isTripDelayed,
  isTripHistory,
  isTripToday,
  isTripUpcoming,
} from '@/utils/scheduleOperations';
import { getErrorMessage, getErrorStatusCode, isPermissionError } from '@/utils/validation';

type FilterKey = 'ALL' | 'TODAY' | 'HISTORY' | 'UPCOMING' | 'COMPLETED' | 'DELAYED';
type ActorKind = 'DRIVER' | 'BUS_ASSISTANT';
type BusAssistantIncidentType = 'PASSENGER_VIOLATION' | 'PASSENGER_CONFLICT' | 'FOUND_ITEM';
type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type IncidentEvidenceFile = { uri: string; name?: string; type?: string };

type BusAssistantIncidentForm = {
  type: BusAssistantIncidentType;
  severity: IncidentSeverity;
  violationCategory: string;
  passengerDescription: string;
  conflictCategory: string;
  partiesInvolved: string;
  actionTaken: string;
  itemName: string;
  itemDescription: string;
  foundLocation: string;
  handedTo: string;
  description: string;
  evidenceFiles: IncidentEvidenceFile[];
};

const matchesFilter = (trip: AssignedTrip, filter: FilterKey) => {
  if (filter === 'ALL') return true;
  if (filter === 'TODAY') return isTripToday(trip);
  if (filter === 'HISTORY') return isTripHistory(trip);
  if (filter === 'UPCOMING') return isTripUpcoming(trip);
  if (filter === 'COMPLETED') return isTripCompleted(trip);
  if (filter === 'DELAYED') return isTripDelayed(trip);
  return true;
};

const matchesSearch = (trip: AssignedTrip, query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    trip.tripCode,
    trip.route?.routeNumber,
    trip.route?.name,
    trip.vehicle?.code,
    trip.vehicle?.plateNumber,
  ].some((value) => String(value || '').toLowerCase().includes(normalized));
};

function InfoLine({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.infoValue}>{value || 'N/A'}</Text>
    </View>
  );
}

const getAcceptanceStatus = (trip: AssignedTrip) => String(trip.acceptanceStatus || '').toUpperCase();

const canDecideTrip = (trip: AssignedTrip) => {
  const status = getTripStatus(trip);
  const acceptanceStatus = getAcceptanceStatus(trip);
  return !['ACCEPTED', 'REJECTED'].includes(acceptanceStatus)
    && !isTripDeparturePassed(trip)
    && !['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DONE'].includes(status);
};

const getActorKind = (role?: string | null): ActorKind => (
  normalizeRole(role) === 'DRIVER' ? 'DRIVER' : 'BUS_ASSISTANT'
);

type ActorCopy = {
  kicker: string;
  title: string;
  searchPlaceholder: string;
  countSuffix: string;
  empty: string;
  roleLabel: string;
  acceptSuccessTitle: string;
  acceptSuccessMessage: string;
  rejectReasonTitle: string;
  rejectReasonHint: string;
  rejectPlaceholder: string;
  startAction: string;
  prepareAction: string;
};

const getDefaultIncidentForm = (tripStatus?: string): BusAssistantIncidentForm => ({
  type: tripStatus === 'COMPLETED' ? 'FOUND_ITEM' : 'PASSENGER_VIOLATION',
  severity: 'MEDIUM',
  violationCategory: 'NO_TICKET',
  passengerDescription: '',
  conflictCategory: 'ARGUMENT',
  partiesInvolved: '',
  actionTaken: '',
  itemName: '',
  itemDescription: '',
  foundLocation: '',
  handedTo: '',
  description: '',
  evidenceFiles: [],
});

function ChoiceChip({
  label,
  active,
  onPress,
  disabled,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.choiceChip, active && styles.choiceChipActive, disabled && styles.disabledChip]}
    >
      <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

function BusAssistantIncidentPanel({
  trip,
  isProcessing,
  onSubmit,
}: {
  trip: AssignedTrip;
  isProcessing: boolean;
  onSubmit: (trip: AssignedTrip, form: BusAssistantIncidentForm) => Promise<void>;
}) {
  const { t } = useDriverI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<BusAssistantIncidentForm>(() => getDefaultIncidentForm(getTripStatus(trip)));
  const tripStatus = getTripStatus(trip);
  const isAccepted = getAcceptanceStatus(trip) === 'ACCEPTED';
  const canReportRunning = tripStatus === 'IN_PROGRESS';
  const canReportFoundItem = tripStatus === 'COMPLETED';
  const canUseForm = isAccepted && (canReportRunning || canReportFoundItem);
  const incidentOptions = useMemo<Array<{
    type: BusAssistantIncidentType;
    title: string;
    hint: string;
  }>>(() => [
    {
      type: 'PASSENGER_VIOLATION',
      title: t.assistant.incident.options.passengerViolation,
      hint: t.assistant.incident.options.passengerViolationHint,
    },
    {
      type: 'PASSENGER_CONFLICT',
      title: t.assistant.incident.options.passengerConflict,
      hint: t.assistant.incident.options.passengerConflictHint,
    },
    {
      type: 'FOUND_ITEM',
      title: t.assistant.incident.options.foundItem,
      hint: t.assistant.incident.options.foundItemHint,
    },
  ], [t]);
  const severityOptions = useMemo<Array<{ value: IncidentSeverity; label: string }>>(() => [
    { value: 'LOW', label: t.lifecycle.low },
    { value: 'MEDIUM', label: t.lifecycle.medium },
    { value: 'HIGH', label: t.lifecycle.high },
    { value: 'CRITICAL', label: t.lifecycle.critical },
  ], [t]);
  const violationCategories = useMemo(() => [
    { value: 'NO_TICKET', label: t.assistant.incident.categories.noTicket },
    { value: 'WRONG_TICKET', label: t.assistant.incident.categories.wrongTicket },
    { value: 'SMOKING', label: t.assistant.incident.categories.smoking },
    { value: 'LITTERING', label: t.assistant.incident.categories.littering },
    { value: 'UNSAFE_BEHAVIOR', label: t.assistant.incident.categories.unsafeBehavior },
    { value: 'DISTURBANCE', label: t.assistant.incident.categories.disturbance },
    { value: 'OTHER', label: t.assistant.incident.categories.other },
  ], [t]);
  const conflictCategories = useMemo(() => [
    { value: 'ARGUMENT', label: t.assistant.incident.categories.argument },
    { value: 'FARE_DISPUTE', label: t.assistant.incident.categories.fareDispute },
    { value: 'SEAT_DISPUTE', label: t.assistant.incident.categories.seatDispute },
    { value: 'HARASSMENT', label: t.assistant.incident.categories.harassment },
    { value: 'SAFETY_RISK', label: t.assistant.incident.categories.safetyRisk },
    { value: 'OTHER', label: t.assistant.incident.categories.other },
  ], [t]);
  const allowedTypes = useMemo(() => incidentOptions.filter((option) => (
    canReportFoundItem ? option.type === 'FOUND_ITEM' : option.type !== 'FOUND_ITEM'
  )), [canReportFoundItem, incidentOptions]);

  useEffect(() => {
    setForm((current) => {
      const allowed = allowedTypes.some((option) => option.type === current.type);
      return allowed ? current : { ...current, type: allowedTypes[0]?.type || 'PASSENGER_VIOLATION' };
    });
  }, [allowedTypes]);

  if (!canUseForm) {
    if (isAccepted && tripStatus === 'SCHEDULED') {
      return (
        <View style={styles.assistantNotice}>
          <Text style={styles.assistantNoticeText}>{t.assistant.incident.waitingTripStart}</Text>
        </View>
      );
    }
    return null;
  }

  const updateForm = <Key extends keyof BusAssistantIncidentForm,>(key: Key, value: BusAssistantIncidentForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const chooseEvidenceFiles = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Không thể chọn ảnh', 'Vui lòng cho phép ứng dụng truy cập thư viện ảnh.');
      return;
    }

    const remaining = Math.max(0, 5 - form.evidenceFiles.length);
    if (!remaining) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.75,
      selectionLimit: remaining,
    });
    if (result.canceled) return;

    const selected = result.assets.slice(0, remaining).map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName || `found-item-${Date.now()}-${index + 1}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    }));
    updateForm('evidenceFiles', [...form.evidenceFiles, ...selected].slice(0, 5));
  };

  const validate = () => {
    if (form.description.trim().length < 10) {
      Alert.alert(t.assistant.incident.missingDescriptionTitle, t.assistant.incident.missingDescriptionMessage);
      return false;
    }

    if (form.type === 'PASSENGER_VIOLATION' && form.actionTaken.trim().length < 3) {
      Alert.alert(t.assistant.incident.missingActionTitle, t.assistant.incident.missingActionMessage);
      return false;
    }

    if (form.type === 'PASSENGER_CONFLICT' && form.actionTaken.trim().length < 3) {
      Alert.alert(t.assistant.incident.missingActionTitle, t.assistant.incident.missingActionMessage);
      return false;
    }

    if (form.type === 'FOUND_ITEM' && (form.itemName.trim().length < 2 || form.foundLocation.trim().length < 3)) {
      Alert.alert(t.assistant.incident.missingItemTitle, t.assistant.incident.missingItemMessage);
      return false;
    }

    return true;
  };

  const submit = async () => {
    if (!validate()) return;
    await onSubmit(trip, form);
    setIsOpen(false);
    setForm(getDefaultIncidentForm(tripStatus));
  };

  return (
    <View style={styles.incidentPanel}>
      <View style={styles.incidentHeader}>
        <View style={styles.incidentTitleRow}>
          <MaterialCommunityIcons color={colors.error} name="alert-circle-outline" size={20} />
          <View style={styles.incidentTitleWrap}>
            <Text style={styles.incidentTitle}>{t.assistant.incident.panelTitle}</Text>
            <Text style={styles.incidentHint}>{t.assistant.incident.panelHint}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={isProcessing}
          onPress={() => setIsOpen((current) => !current)}
          style={[styles.reportToggle, isProcessing && styles.disabledChip]}
        >
          <Text style={styles.reportToggleText}>{isOpen ? t.assistant.incident.close : t.assistant.incident.open}</Text>
        </Pressable>
      </View>

      {isOpen ? (
        <View style={styles.incidentForm}>
          <View style={styles.optionGrid}>
            {allowedTypes.map((option) => (
              <Pressable
                accessibilityRole="button"
                disabled={isProcessing}
                key={option.type}
                onPress={() => updateForm('type', option.type)}
                style={[styles.incidentOption, form.type === option.type && styles.incidentOptionActive]}
              >
                <Text style={styles.incidentOptionTitle}>{option.title}</Text>
                <Text style={styles.incidentOptionHint}>{option.hint}</Text>
              </Pressable>
            ))}
          </View>

          {form.type !== 'FOUND_ITEM' ? (
            <View style={styles.fieldBlock}>
              <FieldLabel>{t.assistant.incident.severity}</FieldLabel>
              <View style={styles.choiceRow}>
                {severityOptions.map((severity) => (
                  <ChoiceChip
                    key={severity.value}
                    label={severity.label}
                    active={form.severity === severity.value}
                    disabled={isProcessing}
                    onPress={() => updateForm('severity', severity.value)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {form.type === 'PASSENGER_VIOLATION' ? (
            <>
              <View style={styles.fieldBlock}>
                <FieldLabel>{t.assistant.incident.violationType}</FieldLabel>
                <View style={styles.choiceRow}>
                  {violationCategories.map((category) => (
                    <ChoiceChip
                      key={category.value}
                      label={category.label}
                      active={form.violationCategory === category.value}
                      disabled={isProcessing}
                      onPress={() => updateForm('violationCategory', category.value)}
                    />
                  ))}
                </View>
              </View>
              <View style={styles.fieldBlock}>
                <FieldLabel>{t.assistant.incident.passengerDescription}</FieldLabel>
                <TextInput
                  onChangeText={(value) => updateForm('passengerDescription', value)}
                  placeholder={t.assistant.incident.passengerPlaceholder}
                  placeholderTextColor={colors.muted}
                  style={styles.incidentInput}
                  value={form.passengerDescription}
                />
              </View>
            </>
          ) : null}

          {form.type === 'PASSENGER_CONFLICT' ? (
            <>
              <View style={styles.fieldBlock}>
                <FieldLabel>{t.assistant.incident.conflictType}</FieldLabel>
                <View style={styles.choiceRow}>
                  {conflictCategories.map((category) => (
                    <ChoiceChip
                      key={category.value}
                      label={category.label}
                      active={form.conflictCategory === category.value}
                      disabled={isProcessing}
                      onPress={() => updateForm('conflictCategory', category.value)}
                    />
                  ))}
                </View>
              </View>
              <View style={styles.fieldBlock}>
                <FieldLabel>{t.assistant.incident.partiesInvolved}</FieldLabel>
                <TextInput
                  onChangeText={(value) => updateForm('partiesInvolved', value)}
                  placeholder={t.assistant.incident.partiesPlaceholder}
                  placeholderTextColor={colors.muted}
                  style={styles.incidentInput}
                  value={form.partiesInvolved}
                />
              </View>
            </>
          ) : null}

          {form.type === 'FOUND_ITEM' ? (
            <>
              <View style={styles.fieldBlock}>
                <FieldLabel>{t.assistant.incident.itemName}</FieldLabel>
                <TextInput
                  onChangeText={(value) => updateForm('itemName', value)}
                  placeholder={t.assistant.incident.itemPlaceholder}
                  placeholderTextColor={colors.muted}
                  style={styles.incidentInput}
                  value={form.itemName}
                />
              </View>
              <View style={styles.fieldBlock}>
                <FieldLabel>{t.assistant.incident.foundLocation}</FieldLabel>
                <TextInput
                  onChangeText={(value) => updateForm('foundLocation', value)}
                  placeholder={t.assistant.incident.locationPlaceholder}
                  placeholderTextColor={colors.muted}
                  style={styles.incidentInput}
                  value={form.foundLocation}
                />
              </View>
              <View style={styles.fieldBlock}>
                <FieldLabel>{t.assistant.incident.handedTo}</FieldLabel>
                <TextInput
                  onChangeText={(value) => updateForm('handedTo', value)}
                  placeholder={t.assistant.incident.handedToPlaceholder}
                  placeholderTextColor={colors.muted}
                  style={styles.incidentInput}
                  value={form.handedTo}
                />
              </View>
            </>
          ) : null}

          {form.type !== 'FOUND_ITEM' ? (
            <View style={styles.fieldBlock}>
              <FieldLabel>{t.assistant.incident.actionTaken}</FieldLabel>
              <TextInput
                onChangeText={(value) => updateForm('actionTaken', value)}
                placeholder={t.assistant.incident.actionPlaceholder}
                placeholderTextColor={colors.muted}
                style={styles.incidentInput}
                value={form.actionTaken}
              />
            </View>
          ) : null}

          <View style={styles.fieldBlock}>
            <FieldLabel>{t.assistant.incident.description}</FieldLabel>
            <TextInput
              multiline
              onChangeText={(value) => updateForm('description', value)}
              placeholder={t.assistant.incident.descriptionPlaceholder}
              placeholderTextColor={colors.muted}
              style={[styles.incidentInput, styles.incidentTextArea]}
              textAlignVertical="top"
              value={form.description}
            />
          </View>

          {form.type === 'FOUND_ITEM' ? (
            <View style={styles.fieldBlock}>
              <FieldLabel>Ảnh đồ vật để Admin xác minh</FieldLabel>
              <Pressable
                accessibilityRole="button"
                disabled={isProcessing || form.evidenceFiles.length >= 5}
                onPress={chooseEvidenceFiles}
                style={[styles.evidencePicker, (isProcessing || form.evidenceFiles.length >= 5) && styles.disabledChip]}
              >
                <MaterialCommunityIcons color={colors.primary} name="camera-plus-outline" size={20} />
                <Text style={styles.evidencePickerText}>
                  {form.evidenceFiles.length ? `Đã chọn ${form.evidenceFiles.length}/5 ảnh` : 'Chụp hoặc chọn ảnh'}
                </Text>
              </Pressable>
              {form.evidenceFiles.length ? (
                <View style={styles.evidenceList}>
                  {form.evidenceFiles.map((file, index) => (
                    <View key={`${file.uri}-${index}`} style={styles.evidenceItem}>
                      <Text numberOfLines={1} style={styles.evidenceName}>{file.name || `Ảnh ${index + 1}`}</Text>
                      <Pressable
                        accessibilityLabel="Xóa ảnh"
                        hitSlop={8}
                        onPress={() => updateForm('evidenceFiles', form.evidenceFiles.filter((_, fileIndex) => fileIndex !== index))}
                      >
                        <MaterialCommunityIcons color={colors.error} name="close-circle" size={20} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              <Text style={styles.evidenceHint}>Tối đa 5 ảnh JPG, PNG hoặc WEBP. Ảnh sẽ được gửi cùng báo cáo cho Admin.</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={isProcessing}
            onPress={submit}
            style={[styles.reportSubmit, isProcessing && styles.disabledChip]}
          >
            {isProcessing ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <MaterialCommunityIcons color={colors.white} name="send-outline" size={18} />
                <Text style={styles.reportSubmitText}>{t.assistant.incident.submit}</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default function AssignedTripsScreen() {
  const { t } = useDriverI18n();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const logout = useAuthStore((state) => state.logout);
  const actorKind = getActorKind(user?.role);
  const isDriver = actorKind === 'DRIVER';
  const driverCopy = useMemo(() => ({
    kicker: t.trips.kicker,
    title: t.trips.title,
    searchPlaceholder: t.trips.search,
    countSuffix: t.trips.countSuffix,
    empty: t.trips.empty,
    roleLabel: t.common.driver,
    acceptSuccessTitle: t.trips.acceptSuccessTitle,
    acceptSuccessMessage: t.trips.acceptSuccessMessage,
    rejectReasonTitle: t.trips.rejectTitle,
    rejectReasonHint: t.trips.rejectHint,
    rejectPlaceholder: t.trips.rejectPlaceholder,
    startAction: t.trips.startTrip,
    prepareAction: t.trips.inspectVehicle,
  }), [t]);
  const assistantCopy = useMemo<ActorCopy>(() => ({
    kicker: t.assistant.trips.kicker,
    title: t.assistant.trips.title,
    searchPlaceholder: t.assistant.trips.search,
    countSuffix: t.assistant.trips.countSuffix,
    empty: t.assistant.trips.empty,
    roleLabel: t.assistant.trips.roleLabel,
    acceptSuccessTitle: t.home.acceptSuccessTitle,
    acceptSuccessMessage: t.home.acceptSuccessMessage,
    rejectReasonTitle: t.trips.rejectTitle,
    rejectReasonHint: t.assistant.trips.rejectHint,
    rejectPlaceholder: t.trips.rejectPlaceholder,
    startAction: '',
    prepareAction: '',
  }), [t]);
  const copy = isDriver ? driverCopy : assistantCopy;
  const filterOptions = useMemo<Array<{ key: FilterKey; label: string }>>(() => (
    [
      { key: 'ALL', label: t.trips.all },
      { key: 'TODAY', label: t.trips.today },
      { key: 'HISTORY', label: t.trips.history },
      { key: 'UPCOMING', label: t.trips.upcoming },
      { key: 'COMPLETED', label: t.trips.completed },
      { key: 'DELAYED', label: t.trips.delayed },
    ]
  ), [t]);
  const [trips, setTrips] = useState<AssignedTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState('');
  const [rejectingTrip, setRejectingTrip] = useState<AssignedTrip | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('ALL');

  const loadTrips = useCallback(async () => {
    if (!isHydrated || !isAuthenticated) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const payload = await scheduleOperationsApi.getAssignedTrips(getAssignedTripsRange());
      setTrips(payload.trips || []);
    } catch (error) {
      const message = getErrorMessage(error, isDriver ? t.trips.empty : t.assistant.trips.loadErrorFallback);
      const statusCode = getErrorStatusCode(error);
      const isAuthError = statusCode === 401 || message.toLowerCase().includes('no token provided');

      if (isAuthError) {
        await logout();
        router.replace('/auth/login');
        return;
      }

      if (isPermissionError(error)) {
        setTrips([]);
        return;
      }

      Alert.alert(isDriver ? t.home.loadErrorTitle : t.assistant.trips.loadErrorTitle, message);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, isDriver, isHydrated, logout, t.assistant.trips.loadErrorFallback, t.assistant.trips.loadErrorTitle, t.home.loadErrorTitle, t.trips.empty]);

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated) {
      setIsLoading(false);
      router.replace('/auth/login');
      return;
    }

    void loadTrips();
  }, [isAuthenticated, isHydrated, loadTrips]);

  useFocusEffect(useCallback(() => {
    if (isHydrated && isAuthenticated) void loadTrips();
  }, [isAuthenticated, isHydrated, loadTrips]));

  const actorTrips = useMemo(() => (
    trips.filter((trip) => {
      const tripActorRole = normalizeRole(trip.actorRole || user?.role);
      return isDriver
        ? tripActorRole === 'DRIVER'
        : ['BUS_ASSISTANT', 'BUS ASSISTANT', 'CONDUCTOR'].includes(tripActorRole);
    })
  ), [isDriver, trips, user?.role]);

  const filteredTrips = useMemo(() => (
    actorTrips.filter((trip) => matchesFilter(trip, activeFilter) && matchesSearch(trip, search))
  ), [activeFilter, actorTrips, search]);

  const openDetail = (trip: AssignedTrip) => {
    router.push({
      pathname: '/driver-assistant/trip-detail',
      params: { assignmentId: trip.id, trip: JSON.stringify(trip) },
    } as unknown as Href);
  };

  const refreshTrip = async (trip: AssignedTrip) => {
    try {
      const updated = await scheduleOperationsApi.getAssignedTripDetail(trip.id);
      setTrips((current) => current.map((item) => (item.id === trip.id ? updated : item)));
      return updated;
    } catch {
      return trip;
    }
  };

  const openFreshDetail = async (trip: AssignedTrip) => {
    openDetail(await refreshTrip(trip));
  };

  const openInspection = (trip: AssignedTrip) => {
    router.push({
      pathname: '/driver-assistant/vehicle-inspection',
      params: { assignmentId: trip.id, trip: JSON.stringify(trip) },
    } as unknown as Href);
  };

  const openFreshInspection = async (trip: AssignedTrip) => {
    const updated = await refreshTrip(trip);
    const blockingTrip = findEarlierUnfinishedTrip(updated, actorTrips);
    if (blockingTrip) {
      Alert.alert(
        'Chưa thể kiểm tra xe',
        `Phải hoàn tất chuyến ${blockingTrip.tripCode} trước khi bắt đầu kiểm tra xe cho chuyến này.`
      );
      return;
    }
    openInspection(updated);
  };

  const openLifecycle = (trip: AssignedTrip) => {
    router.push({
      pathname: '/driver-assistant/trip-lifecycle',
      params: { assignmentId: trip.id, trip: JSON.stringify(trip) },
    } as unknown as Href);
  };

  const openFreshLifecycle = async (trip: AssignedTrip) => {
    openLifecycle(await refreshTrip(trip));
  };

  const acceptTrip = async (trip: AssignedTrip) => {
    setProcessingId(trip.id);
    try {
      const updated = await scheduleOperationsApi.acceptAssignedTrip(trip.id);
      if (isDriver) {
        const blockingTrip = findEarlierUnfinishedTrip(updated, actorTrips);
        if (blockingTrip) {
          Alert.alert(
            copy.acceptSuccessTitle,
            `Đã tiếp nhận chuyến. Phải hoàn tất chuyến ${blockingTrip.tripCode} trước khi bắt đầu kiểm tra xe.`
          );
          await loadTrips();
          return;
        }
        openInspection(updated);
        return;
      }
      Alert.alert(copy.acceptSuccessTitle, copy.acceptSuccessMessage);
      await loadTrips();
    } catch (error) {
      Alert.alert(isDriver ? t.home.acceptErrorTitle : t.assistant.trips.acceptErrorTitle, getErrorMessage(error, isDriver ? t.home.acceptErrorFallback : t.assistant.trips.acceptErrorFallback));
    } finally {
      setProcessingId('');
    }
  };

  const rejectTrip = async () => {
    if (!rejectingTrip) return;

    const reason = rejectionReason.trim();
    if (reason.length < 5) {
      Alert.alert(isDriver ? copy.rejectReasonTitle : t.assistant.trips.rejectNeedReasonTitle, isDriver ? copy.rejectReasonHint : t.assistant.trips.rejectNeedReasonMessage);
      return;
    }

    setProcessingId(rejectingTrip.id);
    try {
      await scheduleOperationsApi.rejectAssignedTrip(rejectingTrip.id, { reason });
      setRejectingTrip(null);
      setRejectionReason('');
      Alert.alert(isDriver ? t.trips.rejectSuccessTitle : t.assistant.trips.rejectSuccessTitle, isDriver ? t.trips.rejectSuccessMessage : t.assistant.trips.rejectSuccessMessage);
      await loadTrips();
    } catch (error) {
      Alert.alert(copy.rejectReasonTitle, getErrorMessage(error, copy.rejectReasonHint));
    } finally {
      setProcessingId('');
    }
  };

  const reportIncident = async (trip: AssignedTrip, form: BusAssistantIncidentForm) => {
    setProcessingId(trip.id);
    try {
      const locationText = form.type === 'FOUND_ITEM'
        ? form.foundLocation.trim()
        : trip.route?.name || trip.route?.origin || trip.tripCode || t.assistant.incident.locationFallback;

      await scheduleOperationsApi.reportOperationIncident(trip.id, {
        ...form,
        severity: form.type === 'FOUND_ITEM' ? 'LOW' : form.severity,
        locationText,
      });

      Alert.alert(t.assistant.incident.submitSuccessTitle, t.assistant.incident.submitSuccessMessage);
      await loadTrips();
    } catch (error) {
      Alert.alert(t.assistant.incident.submitErrorTitle, getErrorMessage(error, t.assistant.incident.submitErrorFallback));
    } finally {
      setProcessingId('');
    }
  };

  return (
    <View style={styles.screenShell}>
      <Screen>
      <View style={styles.header}>
        <Pressable accessibilityLabel={t.common.back} hitSlop={10} onPress={() => goBackOrReplace('/driver-assistant')}>
          <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
        </Pressable>
        <View>
          <Text style={styles.kicker}>{copy.kicker}</Text>
          <Text style={styles.title}>{copy.title}</Text>
        </View>
      </View>

      <View style={styles.toolsCard}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons color={colors.muted} name="magnify" size={21} />
          <TextInput
            accessibilityLabel={copy.searchPlaceholder}
            onChangeText={setSearch}
            placeholder={copy.searchPlaceholder}
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            value={search}
          />
          {search ? <Pressable hitSlop={8} onPress={() => setSearch('')}><MaterialCommunityIcons color={colors.muted} name="close-circle" size={19} /></Pressable> : null}
        </View>

        <View style={styles.filterRow}>
          {filterOptions.map((filter) => (
            <Pressable
              key={filter.key}
              accessibilityRole="button"
              onPress={() => setActiveFilter(filter.key)}
              style={[styles.filterChip, activeFilter === filter.key && styles.filterChipActive]}
            >
              <Text numberOfLines={1} style={[styles.filterText, activeFilter === filter.key && styles.filterTextActive]}>{filter.label}</Text>
            </Pressable>
          ))}
        </View>
        {!isLoading ? (
          <View style={styles.resultBar}>
            <View style={styles.resultIcon}><MaterialCommunityIcons color={colors.accent} name="bus-clock" size={18} /></View>
            <Text style={styles.resultText}>
              <Text style={styles.resultStrong}>{filteredTrips.length}</Text> {copy.countSuffix}
            </Text>
            <Text style={styles.resultTotal}>{isDriver ? t.trips.all : t.assistant.trips.total} {actorTrips.length}</Text>
          </View>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>{isDriver ? t.common.loading : t.assistant.trips.loading}</Text>
        </View>
      ) : (
        <View style={styles.tripList}>
          {filteredTrips.length === 0 ? (
            <Text style={styles.emptyText}>{copy.empty}</Text>
          ) : filteredTrips.map((trip) => {
            const status = getTripStatus(trip);
            const statusLabel = formatDriverStatus(status, t);
            const routeTitle =
              trip.route?.name ||
              [trip.route?.origin, trip.route?.destination].filter(Boolean).join(' - ') ||
              trip.route?.routeNumber ||
              (isDriver ? t.common.unknownRoute : t.assistant.trips.routeUnnamed);
            const routeSubtitle = [trip.route?.origin, trip.route?.destination].filter(Boolean).join(' - ');
            const isCompleted = isTripCompleted(trip);
            const workflowStep = getTripWorkflowStep(trip);
            const isAccepted = workflowStep !== 'ACCEPTANCE' && workflowStep !== 'COMPLETED';
            const shouldOpenLifecycle = workflowStep === 'LIFECYCLE';
            const showDecisionActions = canDecideTrip(trip);
            const departurePassed = isTripDeparturePassed(trip);
            const inspectionBlockedBy = isDriver && isAccepted
              ? findEarlierUnfinishedTrip(trip, actorTrips)
              : null;

            return (
              <View key={trip.id} style={styles.tripCard}>
                <View style={styles.tripCardHeader}>
                  <View>
                    <Text style={styles.tripCode}>{isDriver ? (trip.tripCode || routeTitle) : routeTitle}</Text>
                    {isDriver || (routeSubtitle && routeSubtitle !== routeTitle) ? (
                      <Text style={styles.routeName}>{isDriver ? routeTitle : routeSubtitle}</Text>
                    ) : null}
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>{statusLabel}</Text>
                  </View>
                </View>

                <View style={styles.infoGrid}>
                  <InfoLine label={t.common.direction} value={trip.route?.direction} />
                  <InfoLine label={t.trips.serviceDate} value={getTripServiceDateLabel(trip)} />
                  <InfoLine label={t.common.departure} value={getTripDepartureTimeLabel(trip)} />
                  <InfoLine label={t.common.arrival} value={getTripArrivalTimeLabel(trip)} />
                  {trip.actualStartAt ? <InfoLine label={t.trips.startedAt} value={formatTime(trip.actualStartAt)} /> : null}
                  {trip.actualEndAt ? <InfoLine label={t.trips.endedAt} value={formatTime(trip.actualEndAt)} /> : null}
                  <InfoLine label={t.common.vehicle} value={getTripVehicleLabel(trip)} />
                  <InfoLine label={t.common.driverName} value={trip.driver?.fullName} />
                  <InfoLine label={t.common.assistantName} value={trip.busAssistant?.fullName} />
                </View>

                {hasTripScheduleAdjustment(trip) ? (
                  <View style={styles.delayNotice}>
                    <MaterialCommunityIcons color="#9a6700" name="clock-alert-outline" size={20} />
                    <View style={styles.replacementTextWrap}>
                      <Text style={styles.delayTitle}>Lịch đã điều chỉnh do sự cố</Text>
                      <Text style={styles.delayText}>
                        Giờ gốc {formatTime(trip.originalScheduledStart)} - {formatTime(trip.originalScheduledEnd)}; giờ mới {getTripDepartureTimeLabel(trip)} - {getTripArrivalTimeLabel(trip)}. Trễ trực tiếp {trip.incidentDelayMinutes || 0} phút; dời lịch kế tiếp {trip.propagatedDelayMinutes || 0} phút; tổng điều chỉnh {getTripScheduleAdjustmentMinutes(trip)} phút.
                      </Text>
                    </View>
                  </View>
                ) : null}

                {hasVehicleReplacement(trip) ? (
                  <View style={styles.replacementNotice}>
                    <MaterialCommunityIcons color={colors.primary} name="swap-horizontal-bold" size={18} />
                    <View style={styles.replacementTextWrap}>
                      <Text style={styles.replacementTitle}>{isDriver ? t.inspection.replacementTitle : t.assistant.trips.replacementTitle}</Text>
                      <Text style={styles.replacementText}>
                        {isDriver ? `${t.trips.oldVehicleMaintenance} ${t.trips.replacementPrefix} ${getVehicleLabel(trip.vehicleReplacement?.currentVehicle || trip.vehicle)}.` : `${t.assistant.trips.replacementTextPrefix} ${getVehicleLabel(trip.vehicleReplacement?.previousVehicle)} ${t.assistant.trips.replacementTextMiddle} ${getVehicleLabel(trip.vehicleReplacement?.currentVehicle || trip.vehicle)}.`}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {departurePassed && !isCompleted ? (
                  <View style={styles.expiredNotice}>
                    <MaterialCommunityIcons color="#9a3412" name="lock-clock" size={19} />
                    <Text style={styles.expiredNoticeText}>
                      Chuyến đã qua giờ khởi hành và đã được khóa. Không thể tiếp nhận hoặc kiểm tra xe.
                    </Text>
                  </View>
                ) : null}

                {inspectionBlockedBy ? (
                  <View style={styles.expiredNotice}>
                    <MaterialCommunityIcons color="#9a3412" name="progress-alert" size={19} />
                    <Text style={styles.expiredNoticeText}>
                      Phải hoàn tất chuyến {inspectionBlockedBy.tripCode} trước khi bắt đầu kiểm tra xe cho chuyến này.
                    </Text>
                  </View>
                ) : null}

                <View style={styles.actionsRow}>
                  <AppButton title={t.trips.details} variant="secondary" onPress={() => void openFreshDetail(trip)} style={styles.actionButton} />
                  {showDecisionActions ? (
                    <>
                      <AppButton
                        title={t.trips.reject}
                        disabled={processingId === trip.id}
                        onPress={() => {
                          setRejectingTrip(trip);
                          setRejectionReason('');
                        }}
                        variant="secondary"
                        style={styles.actionButton}
                      />
                      <AppButton
                        title={t.trips.accept}
                        loading={processingId === trip.id}
                        onPress={() => acceptTrip(trip)}
                        style={styles.actionButton}
                      />
                    </>
                  ) : isDriver && isAccepted && !isCompleted ? (
                    <AppButton
                      title={shouldOpenLifecycle ? 'Tiếp tục chuyến' : copy.prepareAction}
                      disabled={!shouldOpenLifecycle && Boolean(inspectionBlockedBy)}
                      loading={processingId === trip.id}
                      onPress={() => void (shouldOpenLifecycle ? openFreshLifecycle(trip) : openFreshInspection(trip))}
                      style={styles.actionButton}
                    />
                  ) : null}
                </View>

                {!isDriver ? (
                  <BusAssistantIncidentPanel
                    trip={trip}
                    isProcessing={processingId === trip.id}
                    onSubmit={reportIncident}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      )}
      </Screen>
      <Modal
        animationType="fade"
        onRequestClose={() => setRejectingTrip(null)}
        transparent
        visible={Boolean(rejectingTrip)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{copy.rejectReasonTitle}</Text>
            <Text style={styles.modalHint}>
              {copy.rejectReasonHint}
            </Text>
            <TextInput
              multiline
              onChangeText={setRejectionReason}
              placeholder={copy.rejectPlaceholder}
              placeholderTextColor={colors.muted}
              style={styles.reasonInput}
              value={rejectionReason}
            />
            <View style={styles.modalActions}>
              <AppButton
                title={t.common.cancel}
                onPress={() => setRejectingTrip(null)}
                variant="secondary"
                style={styles.modalButton}
              />
              <AppButton
                title={t.trips.reject}
                loading={Boolean(rejectingTrip && processingId === rejectingTrip.id)}
                onPress={rejectTrip}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
      <RoleBottomNav active="trips" role={user?.role} />
    </View>
  );
}

const styles = StyleSheet.create({
  screenShell: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  kicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.primary, fontSize: 25, fontWeight: '900' },
  toolsCard: { gap: 12, borderRadius: 22, borderWidth: 1, borderColor: '#e4ede9', backgroundColor: colors.card, padding: 12 },
  searchBox: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 15, backgroundColor: colors.surfaceLow, paddingHorizontal: 13 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filterChip: { width: '31.8%', minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.white, paddingHorizontal: 6 },
  filterChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  filterTextActive: { color: colors.white },
  resultBar: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 13, backgroundColor: '#edf9f3', paddingHorizontal: 10 },
  resultIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: colors.white },
  resultText: { flex: 1, color: colors.secondary, fontSize: 12, fontWeight: '700' },
  resultStrong: { color: colors.primary, fontWeight: '900' },
  resultTotal: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  loading: { minHeight: 230, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.muted, fontWeight: '700' },
  tripList: { gap: 14, marginTop: 14, paddingBottom: 96 },
  emptyText: { borderRadius: 18, backgroundColor: colors.surfaceLow, padding: 16, color: colors.muted, fontSize: 13, fontWeight: '700' },
  tripCard: { gap: 14, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  tripCardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  tripCode: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  routeName: { marginTop: 3, color: colors.muted, fontSize: 13, fontWeight: '700' },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 16, backgroundColor: '#d4f2e5', paddingHorizontal: 10, paddingVertical: 6 },
  statusBadgeText: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  infoLine: { width: '47%', gap: 3 },
  infoLabel: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  infoValue: { color: colors.text, fontSize: 13, fontWeight: '800' },
  replacementNotice: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#b8e8d0',
    backgroundColor: '#e8f8ef',
    padding: 12,
  },
  replacementTextWrap: { flex: 1, gap: 3 },
  replacementTitle: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  replacementText: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  delayNotice: { flexDirection: 'row', gap: 10, borderRadius: 16, borderWidth: 1, borderColor: '#f1d58a', backgroundColor: '#fff8df', padding: 12 },
  expiredNotice: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, borderColor: '#fed7aa', backgroundColor: '#fff7ed', padding: 12 },
  expiredNoticeText: { flex: 1, color: '#9a3412', fontSize: 13, lineHeight: 19, fontWeight: '800' },
  delayTitle: { color: '#805500', fontSize: 13, fontWeight: '900' },
  delayText: { color: '#725a24', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionButton: { flex: 1 },
  assistantNotice: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#b8e8d0',
    backgroundColor: '#e8f8ef',
    padding: 12,
  },
  assistantNoticeText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  incidentPanel: {
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ffd1cf',
    backgroundColor: '#fff4f3',
    padding: 12,
  },
  incidentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  incidentTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  incidentTitleWrap: { flex: 1 },
  incidentTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  incidentHint: { marginTop: 2, color: colors.muted, fontSize: 11, fontWeight: '700' },
  reportToggle: {
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.error,
    paddingHorizontal: 14,
  },
  reportToggleText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  incidentForm: { gap: 12 },
  optionGrid: { gap: 8 },
  incidentOption: {
    gap: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ffd1cf',
    backgroundColor: colors.card,
    padding: 12,
  },
  incidentOptionActive: { borderColor: colors.error, backgroundColor: colors.errorContainer },
  incidentOptionTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  incidentOptionHint: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  fieldBlock: { gap: 7 },
  fieldLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: {
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
  },
  choiceChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  choiceChipText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  choiceChipTextActive: { color: colors.white },
  disabledChip: { opacity: 0.55 },
  incidentInput: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  incidentTextArea: { minHeight: 92 },
  evidencePicker: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 14, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surface, paddingHorizontal: 14 },
  evidencePickerText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  evidenceList: { gap: 7 },
  evidenceItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderRadius: 12, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 10 },
  evidenceName: { flex: 1, color: colors.primary, fontSize: 12, fontWeight: '800' },
  evidenceHint: { color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  reportSubmit: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: colors.error,
    paddingHorizontal: 16,
  },
  reportSubmitText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  modalBackdrop: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0, 26, 15, 0.38)', padding: 20 },
  modalCard: { gap: 14, borderRadius: 22, backgroundColor: colors.card, padding: 18 },
  modalTitle: { color: colors.primary, fontSize: 20, fontWeight: '900' },
  modalHint: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  reasonInput: {
    minHeight: 110,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.outline,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    padding: 14,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalButton: { flex: 1 },
});
