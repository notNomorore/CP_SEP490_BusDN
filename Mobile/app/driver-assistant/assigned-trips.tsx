import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import scheduleOperationsApi from '@/api/scheduleOperations.api';
import { AppButton } from '@/components/AppButton';
import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';
import type { AssignedTrip } from '@/types/scheduleOperations';
import { goBackOrReplace } from '@/utils/navigation';
import { normalizeRole } from '@/utils/roleNavigation';
import {
  formatDate,
  formatTime,
  getAssignedTripsRange,
  getTripStatus,
  isTripCompleted,
  isTripDelayed,
  isTripHistory,
  isTripToday,
  isTripUpcoming,
} from '@/utils/scheduleOperations';
import { getErrorMessage } from '@/utils/validation';

type FilterKey = 'ALL' | 'TODAY' | 'HISTORY' | 'UPCOMING' | 'COMPLETED' | 'DELAYED';
type ActorKind = 'DRIVER' | 'BUS_ASSISTANT';
type BusAssistantIncidentType = 'PASSENGER_VIOLATION' | 'PASSENGER_CONFLICT' | 'FOUND_ITEM';
type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

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
};

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'TODAY', label: 'Today' },
  { key: 'HISTORY', label: 'History' },
  { key: 'UPCOMING', label: 'Upcoming' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'DELAYED', label: 'Delayed' },
];

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
    && !['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DONE'].includes(status);
};

const getActorKind = (role?: string | null): ActorKind => (
  normalizeRole(role) === 'DRIVER' ? 'DRIVER' : 'BUS_ASSISTANT'
);

const actorCopy: Record<ActorKind, {
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
}> = {
  DRIVER: {
    kicker: 'DRIVER OPERATIONS',
    title: 'Driver Trips',
    searchPlaceholder: 'Search route, trip ID, bus number',
    countSuffix: 'driver trips',
    empty: 'No driver trips match this filter.',
    roleLabel: 'Driver',
    acceptSuccessTitle: 'Trip accepted',
    acceptSuccessMessage: 'The assigned driver trip has been accepted.',
    rejectReasonTitle: 'Reject driver trip',
    rejectReasonHint: 'Enter the reason so dispatch can handle or reassign this driver trip.',
    rejectPlaceholder: 'Rejection reason',
    startAction: 'Start Trip',
    prepareAction: 'Inspect Vehicle',
  },
  BUS_ASSISTANT: {
    kicker: 'BUS ASSISTANT OPERATIONS',
    title: 'Assistant Trips',
    searchPlaceholder: 'Search route, trip ID, bus number',
    countSuffix: 'assistant trips',
    empty: 'No assistant trips match this filter.',
    roleLabel: 'Bus Assistant',
    acceptSuccessTitle: 'Trip accepted',
    acceptSuccessMessage: 'The assigned assistant trip has been accepted.',
    rejectReasonTitle: 'Reject assistant trip',
    rejectReasonHint: 'Enter the reason so dispatch can assign another bus assistant.',
    rejectPlaceholder: 'Rejection reason',
    startAction: '',
    prepareAction: '',
  },
};

const busAssistantIncidentOptions: Array<{
  type: BusAssistantIncidentType;
  code: string;
  title: string;
  hint: string;
}> = [
  {
    type: 'PASSENGER_VIOLATION',
    code: 'UC50',
    title: 'Passenger Violation',
    hint: 'Ticket, safety, or bus rule violation.',
  },
  {
    type: 'PASSENGER_CONFLICT',
    code: 'UC51',
    title: 'Passenger Conflict',
    hint: 'Argument, dispute, or unsafe passenger conflict.',
  },
  {
    type: 'FOUND_ITEM',
    code: 'UC52',
    title: 'Found Item',
    hint: 'Item found on the bus after the trip.',
  },
];

const severityOptions: Array<{ value: IncidentSeverity; label: string }> = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

const violationCategories = [
  { value: 'NO_TICKET', label: 'No ticket' },
  { value: 'WRONG_TICKET', label: 'Wrong ticket' },
  { value: 'SMOKING', label: 'Smoking' },
  { value: 'LITTERING', label: 'Littering' },
  { value: 'UNSAFE_BEHAVIOR', label: 'Unsafe behavior' },
  { value: 'DISTURBANCE', label: 'Disturbance' },
  { value: 'OTHER', label: 'Other' },
];

const conflictCategories = [
  { value: 'ARGUMENT', label: 'Argument' },
  { value: 'FARE_DISPUTE', label: 'Fare dispute' },
  { value: 'SEAT_DISPUTE', label: 'Seat dispute' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'SAFETY_RISK', label: 'Safety risk' },
  { value: 'OTHER', label: 'Other' },
];

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
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<BusAssistantIncidentForm>(() => getDefaultIncidentForm(getTripStatus(trip)));
  const tripStatus = getTripStatus(trip);
  const isAccepted = getAcceptanceStatus(trip) === 'ACCEPTED';
  const canReportRunning = tripStatus === 'IN_PROGRESS';
  const canReportFoundItem = tripStatus === 'COMPLETED';
  const canUseForm = isAccepted && (canReportRunning || canReportFoundItem);
  const allowedTypes = busAssistantIncidentOptions.filter((option) => (
    canReportFoundItem ? option.type === 'FOUND_ITEM' : option.type !== 'FOUND_ITEM'
  ));

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
          <Text style={styles.assistantNoticeText}>Accepted. Incident reporting opens when the trip is running.</Text>
        </View>
      );
    }
    return null;
  }

  const updateForm = <Key extends keyof BusAssistantIncidentForm,>(key: Key, value: BusAssistantIncidentForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const validate = () => {
    if (form.description.trim().length < 10) {
      Alert.alert('Missing description', 'Please describe the situation with at least 10 characters.');
      return false;
    }

    if (form.type === 'PASSENGER_VIOLATION' && form.actionTaken.trim().length < 3) {
      Alert.alert('Missing action', 'Please enter the action taken.');
      return false;
    }

    if (form.type === 'PASSENGER_CONFLICT' && form.actionTaken.trim().length < 3) {
      Alert.alert('Missing action', 'Please enter the action taken.');
      return false;
    }

    if (form.type === 'FOUND_ITEM' && (form.itemName.trim().length < 2 || form.foundLocation.trim().length < 3)) {
      Alert.alert('Missing item details', 'Please enter the item name and where it was found.');
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
            <Text style={styles.incidentTitle}>Incident Report</Text>
            <Text style={styles.incidentHint}>UC50/UC51 while running. UC52 after completion.</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={isProcessing}
          onPress={() => setIsOpen((current) => !current)}
          style={[styles.reportToggle, isProcessing && styles.disabledChip]}
        >
          <Text style={styles.reportToggleText}>{isOpen ? 'Close' : 'Report'}</Text>
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
                <Text style={styles.incidentCode}>{option.code}</Text>
                <Text style={styles.incidentOptionTitle}>{option.title}</Text>
                <Text style={styles.incidentOptionHint}>{option.hint}</Text>
              </Pressable>
            ))}
          </View>

          {form.type !== 'FOUND_ITEM' ? (
            <View style={styles.fieldBlock}>
              <FieldLabel>Severity</FieldLabel>
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
                <FieldLabel>Violation Type</FieldLabel>
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
                <FieldLabel>Passenger Description</FieldLabel>
                <TextInput
                  onChangeText={(value) => updateForm('passengerDescription', value)}
                  placeholder="Example: blue shirt near rear door"
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
                <FieldLabel>Conflict Type</FieldLabel>
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
                <FieldLabel>Parties Involved</FieldLabel>
                <TextInput
                  onChangeText={(value) => updateForm('partiesInvolved', value)}
                  placeholder="Example: two passengers in middle seats"
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
                <FieldLabel>Item Name</FieldLabel>
                <TextInput
                  onChangeText={(value) => updateForm('itemName', value)}
                  placeholder="Example: black wallet"
                  placeholderTextColor={colors.muted}
                  style={styles.incidentInput}
                  value={form.itemName}
                />
              </View>
              <View style={styles.fieldBlock}>
                <FieldLabel>Found Location</FieldLabel>
                <TextInput
                  onChangeText={(value) => updateForm('foundLocation', value)}
                  placeholder="Example: seat 12"
                  placeholderTextColor={colors.muted}
                  style={styles.incidentInput}
                  value={form.foundLocation}
                />
              </View>
              <View style={styles.fieldBlock}>
                <FieldLabel>Handed To</FieldLabel>
                <TextInput
                  onChangeText={(value) => updateForm('handedTo', value)}
                  placeholder="Example: dispatch desk"
                  placeholderTextColor={colors.muted}
                  style={styles.incidentInput}
                  value={form.handedTo}
                />
              </View>
            </>
          ) : null}

          {form.type !== 'FOUND_ITEM' ? (
            <View style={styles.fieldBlock}>
              <FieldLabel>Action Taken</FieldLabel>
              <TextInput
                onChangeText={(value) => updateForm('actionTaken', value)}
                placeholder="Example: reminded passenger of bus rules"
                placeholderTextColor={colors.muted}
                style={styles.incidentInput}
                value={form.actionTaken}
              />
            </View>
          ) : null}

          <View style={styles.fieldBlock}>
            <FieldLabel>Description</FieldLabel>
            <TextInput
              multiline
              onChangeText={(value) => updateForm('description', value)}
              placeholder="Describe the situation and what was done."
              placeholderTextColor={colors.muted}
              style={[styles.incidentInput, styles.incidentTextArea]}
              textAlignVertical="top"
              value={form.description}
            />
          </View>

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
                <Text style={styles.reportSubmitText}>Send Incident Report</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default function AssignedTripsScreen() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const logout = useAuthStore((state) => state.logout);
  const actorKind = getActorKind(user?.role);
  const copy = actorCopy[actorKind];
  const isDriver = actorKind === 'DRIVER';
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
      const message = getErrorMessage(error, 'Unable to load assigned trips.');
      const statusCode = (error as { statusCode?: number; response?: { status?: number } })?.statusCode
        || (error as { response?: { status?: number } })?.response?.status;
      const isAuthError = statusCode === 401 || message.toLowerCase().includes('no token provided');

      if (isAuthError) {
        await logout();
        router.replace('/auth/login');
        return;
      }

      Alert.alert('Unable to load assigned trips', message);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, isHydrated, logout]);

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated) {
      setIsLoading(false);
      router.replace('/auth/login');
      return;
    }

    void loadTrips();
  }, [isAuthenticated, isHydrated, loadTrips]);

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

  const openInspection = (trip: AssignedTrip) => {
    router.push({
      pathname: '/driver-assistant/vehicle-inspection',
      params: { assignmentId: trip.id, trip: JSON.stringify(trip) },
    } as unknown as Href);
  };

  const openLifecycle = (trip: AssignedTrip) => {
    router.push({
      pathname: '/driver-assistant/trip-lifecycle',
      params: { assignmentId: trip.id, trip: JSON.stringify(trip) },
    } as unknown as Href);
  };

  const acceptTrip = async (trip: AssignedTrip) => {
    setProcessingId(trip.id);
    try {
      const updated = await scheduleOperationsApi.acceptAssignedTrip(trip.id);
      if (isDriver) {
        openInspection(updated);
        return;
      }
      Alert.alert(copy.acceptSuccessTitle, copy.acceptSuccessMessage);
      await loadTrips();
    } catch (error) {
      Alert.alert('Không thể tiếp nhận chuyến', getErrorMessage(error, 'Unable to accept assigned trip.'));
    } finally {
      setProcessingId('');
    }
  };

  const rejectTrip = async () => {
    if (!rejectingTrip) return;

    const reason = rejectionReason.trim();
    if (reason.length < 5) {
      Alert.alert('Cần lý do từ chối', 'Vui lòng nhập ít nhất 5 ký tự trước khi từ chối chuyến.');
      return;
    }

    setProcessingId(rejectingTrip.id);
    try {
      await scheduleOperationsApi.rejectAssignedTrip(rejectingTrip.id, { reason });
      setRejectingTrip(null);
      setRejectionReason('');
      Alert.alert('Đã từ chối chuyến', 'Lý do từ chối đã được gửi về điều hành.');
      await loadTrips();
    } catch (error) {
      Alert.alert('Không thể từ chối chuyến', getErrorMessage(error, 'Unable to reject assigned trip.'));
    } finally {
      setProcessingId('');
    }
  };

  const reportIncident = async (trip: AssignedTrip, form: BusAssistantIncidentForm) => {
    setProcessingId(trip.id);
    try {
      const locationText = form.type === 'FOUND_ITEM'
        ? form.foundLocation.trim()
        : trip.route?.name || trip.route?.origin || trip.tripCode || 'Assigned trip';

      await scheduleOperationsApi.reportOperationIncident(trip.id, {
        ...form,
        severity: form.type === 'FOUND_ITEM' ? 'LOW' : form.severity,
        locationText,
      });

      Alert.alert('Incident reported', 'The incident report has been sent to dispatch.');
      await loadTrips();
    } catch (error) {
      Alert.alert('Unable to report incident', getErrorMessage(error, 'Unable to report incident.'));
    } finally {
      setProcessingId('');
    }
  };

  return (
    <View style={styles.screenShell}>
      <Screen>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" hitSlop={10} onPress={() => goBackOrReplace('/driver-assistant')}>
          <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
        </Pressable>
        <View>
          <Text style={styles.kicker}>{copy.kicker}</Text>
          <Text style={styles.title}>{copy.title}</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <MaterialCommunityIcons color={colors.muted} name="magnify" size={22} />
        <TextInput
          accessibilityLabel="Search assigned trips"
          onChangeText={setSearch}
          placeholder={copy.searchPlaceholder}
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          value={search}
        />
      </View>

      <View style={styles.filterRow}>
        {filters.map((filter) => (
          <Pressable
            key={filter.key}
            accessibilityRole="button"
            onPress={() => setActiveFilter(filter.key)}
            style={[styles.filterChip, activeFilter === filter.key && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, activeFilter === filter.key && styles.filterTextActive]}>
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {!isLoading ? (
        <Text style={styles.resultText}>
          Showing {filteredTrips.length} of {actorTrips.length} {copy.countSuffix}
        </Text>
      ) : null}

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading assigned trips...</Text>
        </View>
      ) : (
        <View style={styles.tripList}>
          {filteredTrips.length === 0 ? (
            <Text style={styles.emptyText}>{copy.empty}</Text>
          ) : filteredTrips.map((trip) => {
            const status = getTripStatus(trip);
            const isCompleted = isTripCompleted(trip);
            const isAccepted = getAcceptanceStatus(trip) === 'ACCEPTED';
            const isVehicleReady = trip.inspection?.status === 'READY';
            const showDecisionActions = canDecideTrip(trip);

            return (
              <View key={trip.id} style={styles.tripCard}>
                <View style={styles.tripCardHeader}>
                  <View>
                    <Text style={styles.tripCode}>{trip.tripCode || trip.id}</Text>
                    <Text style={styles.routeName}>{trip.route?.name || 'Unnamed route'}</Text>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>{status}</Text>
                  </View>
                </View>

                <View style={styles.infoGrid}>
                  <InfoLine label="Route ID" value={trip.route?.routeNumber || trip.route?.id} />
                  <InfoLine label="Direction" value={trip.route?.direction} />
                  <InfoLine label="Service Date" value={formatDate(trip.scheduledStart)} />
                  <InfoLine label="Departure" value={formatTime(trip.scheduledStart)} />
                  <InfoLine label="Arrival" value={formatTime(trip.scheduledEnd)} />
                  {trip.actualStartAt ? <InfoLine label="Started" value={formatTime(trip.actualStartAt)} /> : null}
                  {trip.actualEndAt ? <InfoLine label="Ended" value={formatTime(trip.actualEndAt)} /> : null}
                  <InfoLine label="Bus Number" value={trip.vehicle?.code || trip.vehicle?.plateNumber} />
                  <InfoLine label="Driver" value={trip.driver?.fullName} />
                  <InfoLine label="Bus Assistant" value={trip.busAssistant?.fullName} />
                  <InfoLine label="Your Role" value={copy.roleLabel} />
                </View>

                <View style={styles.actionsRow}>
                  <AppButton title="Xem chi tiết" variant="secondary" onPress={() => openDetail(trip)} style={styles.actionButton} />
                  {showDecisionActions ? (
                    <>
                      <AppButton
                        title="Từ chối"
                        disabled={processingId === trip.id}
                        onPress={() => {
                          setRejectingTrip(trip);
                          setRejectionReason('');
                        }}
                        variant="secondary"
                        style={styles.actionButton}
                      />
                      <AppButton
                        title="Tiếp nhận"
                        loading={processingId === trip.id}
                        onPress={() => acceptTrip(trip)}
                        style={styles.actionButton}
                      />
                    </>
                  ) : isDriver && isAccepted && !isCompleted ? (
                    <AppButton
                      title={isVehicleReady ? copy.startAction : copy.prepareAction}
                      loading={processingId === trip.id}
                      onPress={() => (isVehicleReady ? openLifecycle(trip) : openInspection(trip))}
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
                title="Hủy"
                onPress={() => setRejectingTrip(null)}
                variant="secondary"
                style={styles.modalButton}
              />
              <AppButton
                title="Từ chối"
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
  searchBox: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, backgroundColor: colors.card, paddingHorizontal: 14 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  filterChip: { minHeight: 40, justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.card, paddingHorizontal: 14 },
  filterChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  filterTextActive: { color: colors.white },
  resultText: { marginTop: 10, color: colors.muted, fontSize: 12, fontWeight: '800' },
  loading: { minHeight: 230, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.muted, fontWeight: '700' },
  tripList: { gap: 14, marginTop: 18, paddingBottom: 96 },
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
  incidentCode: { color: colors.error, fontSize: 11, fontWeight: '900' },
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
