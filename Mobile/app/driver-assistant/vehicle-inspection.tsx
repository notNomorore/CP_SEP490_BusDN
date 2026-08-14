import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import scheduleOperationsApi from '@/api/scheduleOperations.api';
import { AppButton } from '@/components/AppButton';
import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/colors';
import { formatDriverStatus, useDriverI18n } from '@/i18n/driver';
import { useAuthStore } from '@/store/auth.store';
import type { AssignedTrip, VehicleInspection } from '@/types/scheduleOperations';
import { goBackOrReplace } from '@/utils/navigation';
import { findEarlierUnfinishedTrip, getAssignedTripsRange, getTripDepartureTimeLabel, getTripStatus, getTripVehicleLabel, getVehicleLabel, hasVehicleReplacement, isTripDeparturePassed } from '@/utils/scheduleOperations';
import { getErrorMessage } from '@/utils/validation';

type ChecklistKey = 'tires' | 'brakes' | 'lights' | 'fuelOrBattery' | 'safetyEquipment' | 'cleanliness';

const checklistKeys: ChecklistKey[] = ['tires', 'brakes', 'lights', 'fuelOrBattery', 'safetyEquipment', 'cleanliness'];

const emptyChecklist = checklistKeys.reduce((result, key) => {
  result[key] = false;
  return result;
}, {} as Record<ChecklistKey, boolean>);

function parseTripParam(value: unknown): AssignedTrip | null {
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value) as AssignedTrip;
  } catch {
    return null;
  }
}

export default function VehicleInspectionScreen() {
  const params = useLocalSearchParams<{ trip?: string; assignmentId?: string }>();
  const user = useAuthStore((state) => state.user);
  const { t } = useDriverI18n();
  const initialTrip = useMemo(() => parseTripParam(params.trip), [params.trip]);
  const [trip, setTrip] = useState<AssignedTrip | null>(initialTrip);
  const [assignedTrips, setAssignedTrips] = useState<AssignedTrip[]>(initialTrip ? [initialTrip] : []);
  const assignmentId = trip?.id || params.assignmentId || '';
  const [checklist, setChecklist] = useState<Record<ChecklistKey, boolean>>({
    ...emptyChecklist,
    ...trip?.inspection?.checklist,
  });
  const [inspection, setInspection] = useState<VehicleInspection | undefined>(trip?.inspection);
  const [issueCategory, setIssueCategory] = useState('OTHER');
  const [issueDescription, setIssueDescription] = useState('');
  const [processingAction, setProcessingAction] = useState('');
  const checklistItems = useMemo(() => ([
    { key: 'tires' as const, label: t.inspection.tires },
    { key: 'brakes' as const, label: t.inspection.brakes },
    { key: 'lights' as const, label: t.inspection.lights },
    { key: 'fuelOrBattery' as const, label: t.inspection.fuel },
    { key: 'safetyEquipment' as const, label: t.inspection.safetyEquipment },
    { key: 'cleanliness' as const, label: t.inspection.cleanliness },
  ]), [t]);
  const issueCategories = useMemo(() => ([
    { value: 'OTHER', label: t.inspection.categories.other },
    { value: 'BRAKE', label: t.inspection.categories.brake },
    { value: 'ENGINE', label: t.inspection.categories.engine },
    { value: 'LIGHT', label: t.inspection.categories.light },
    { value: 'TIRE', label: t.inspection.categories.tire },
    { value: 'SAFETY_EQUIPMENT', label: t.inspection.categories.safety },
  ]), [t]);

  const refreshTrip = useCallback(async () => {
    if (!assignmentId) return;
    try {
      const updatedTrip = await scheduleOperationsApi.getAssignedTripDetail(assignmentId);
      setTrip(updatedTrip);
      setInspection(updatedTrip.inspection);
      setChecklist({
        ...emptyChecklist,
        ...(updatedTrip.inspection?.checklist || {}),
      });
      const payload = await scheduleOperationsApi.getAssignedTrips(getAssignedTripsRange()).catch(() => null);
      if (payload) setAssignedTrips(payload.trips || []);
    } catch {
      // Keep the navigation payload visible when refresh is temporarily unavailable.
    }
  }, [assignmentId]);

  useEffect(() => {
    void refreshTrip();
  }, [refreshTrip]);

  const allChecked = checklistKeys.every((key) => checklist[key]);
  const inspectionStatus = inspection?.status || 'NOT_STARTED';
  const isNotStarted = inspectionStatus === 'NOT_STARTED';
  const isInProgress = inspectionStatus === 'IN_PROGRESS';
  const isReady = inspectionStatus === 'READY';
  const isIssueReported = inspectionStatus === 'ISSUE_REPORTED';
  const tripStatus = trip ? getTripStatus(trip) : 'SCHEDULED';
  const canOperateVehicle = user?.role === 'DRIVER';
  const tripAllowsInspection = tripStatus === 'SCHEDULED';
  const departurePassed = isTripDeparturePassed(trip);
  const inspectionBlockedBy = useMemo(
    () => (trip ? findEarlierUnfinishedTrip(trip, assignedTrips) : null),
    [assignedTrips, trip]
  );
  const canEdit = canOperateVehicle && tripAllowsInspection && !departurePassed && !inspectionBlockedBy && !isReady && !isIssueReported;
  const canStart = canEdit && isNotStarted;
  const canInspect = canEdit && isInProgress;
  const canConfirmReady = canInspect && allChecked;
  const canReportIssue = canInspect && issueDescription.trim().length >= 5;

  const toggleChecklist = (key: ChecklistKey) => {
    setChecklist((current) => ({ ...current, [key]: !current[key] }));
  };

  const startInspection = async () => {
    if (!assignmentId) return;
    setProcessingAction('start');
    try {
      const updated = await scheduleOperationsApi.startVehicleInspection(assignmentId, { checklist });
      setInspection(updated);
      setChecklist({ ...emptyChecklist });
      Alert.alert(t.inspection.startSuccessTitle, t.inspection.startSuccessMessage);
    } catch (error) {
      Alert.alert(t.inspection.startErrorTitle, getErrorMessage(error, t.inspection.startErrorFallback));
    } finally {
      setProcessingAction('');
    }
  };

  const confirmReady = async () => {
    if (!assignmentId) return;
    if (!allChecked) {
      Alert.alert(t.inspection.incompleteTitle, t.inspection.incompleteMessage);
      return;
    }

    setProcessingAction('ready');
    try {
      const updated = await scheduleOperationsApi.confirmVehicleReady(assignmentId, { checklist });
      setInspection(updated);
      const readyTrip = trip
        ? {
          ...trip,
          inspection: updated,
          tripStatus: 'READY',
        }
        : null;
      router.replace({
        pathname: '/driver-assistant/trip-lifecycle',
        params: {
          assignmentId,
          ...(readyTrip ? { trip: JSON.stringify(readyTrip) } : {}),
        },
      } as unknown as Href);
    } catch (error) {
      Alert.alert(t.inspection.readyErrorTitle, getErrorMessage(error, t.inspection.readyErrorFallback));
    } finally {
      setProcessingAction('');
    }
  };

  const reportIssue = async () => {
    if (!assignmentId) return;
    const description = issueDescription.trim();
    if (description.length < 5) {
      Alert.alert(t.inspection.issueDescription, t.inspection.issueNeedDescription);
      return;
    }

    setProcessingAction('issue');
    try {
      const updated = await scheduleOperationsApi.reportVehicleIssue(assignmentId, {
        issueCategory,
        issueDescription: description,
      });
      setInspection(updated);
      Alert.alert(t.inspection.issueSuccessTitle, t.inspection.issueSuccessMessage);
    } catch (error) {
      Alert.alert(t.inspection.issueErrorTitle, getErrorMessage(error, t.inspection.issueErrorFallback));
    } finally {
      setProcessingAction('');
    }
  };

  const openTripLifecycle = () => {
    const readyTrip = trip
      ? {
        ...trip,
        inspection,
        tripStatus: tripStatus === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'READY',
      }
      : null;

    router.replace({
      pathname: '/driver-assistant/trip-lifecycle',
      params: {
        assignmentId,
        ...(readyTrip ? { trip: JSON.stringify(readyTrip) } : {}),
      },
    } as unknown as Href);
  };

  return (
    <View style={styles.screenShell}>
      <Screen>
        <View style={styles.header}>
          <Pressable accessibilityLabel={t.common.back} hitSlop={10} onPress={() => goBackOrReplace('/driver-assistant/assigned-trips')}>
            <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
          </Pressable>
          <View>
            <Text style={styles.kicker}>{t.inspection.kicker}</Text>
            <Text style={styles.title}>{isNotStarted ? t.inspection.startTitle : t.inspection.title}</Text>
          </View>
        </View>

        <View style={styles.tripCard}>
          <Text style={styles.tripCode}>{trip?.tripCode || assignmentId || t.inspection.assignedTrip}</Text>
          <Text style={styles.routeName}>{trip?.route?.name || t.inspection.unnamedRoute}</Text>
          <View style={styles.summaryGrid}>
            <Text style={styles.summaryText}>{t.common.departure}: {getTripDepartureTimeLabel(trip)}</Text>
            <Text style={styles.summaryText}>{t.common.vehicle}: {getTripVehicleLabel(trip)}</Text>
            <Text style={styles.summaryText}>{t.inspection.inspection}: {formatDriverStatus(inspectionStatus, t)}</Text>
          </View>
        </View>

        {hasVehicleReplacement(trip) ? (
          <View style={styles.replacementNotice}>
            <MaterialCommunityIcons color={colors.primary} name="swap-horizontal-bold" size={19} />
            <View style={styles.replacementTextWrap}>
              <Text style={styles.replacementTitle}>{t.inspection.replacementTitle}</Text>
              <Text style={styles.replacementText}>
                {t.inspection.replacementText} {getVehicleLabel(trip?.vehicleReplacement?.currentVehicle || trip?.vehicle)}
              </Text>
            </View>
          </View>
        ) : null}

        {isNotStarted ? (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons color={colors.primary} name="clipboard-check-outline" size={22} />
              <Text style={styles.sectionTitle}>{t.inspection.startSection}</Text>
            </View>
            <Text style={styles.helperText}>{t.inspection.startHelper}</Text>
            {!canOperateVehicle ? (
              <Text style={styles.warningText}>{t.inspection.driverOnly}</Text>
            ) : null}
            {canOperateVehicle && !tripAllowsInspection ? (
              <Text style={styles.warningText}>{t.inspection.cannotInspect}</Text>
            ) : null}
            {canOperateVehicle && departurePassed ? (
              <Text style={styles.warningText}>Chuyến đã qua giờ khởi hành nên không thể bắt đầu kiểm tra xe.</Text>
            ) : null}
            {canOperateVehicle && inspectionBlockedBy ? (
              <Text style={styles.warningText}>
                Phải hoàn tất chuyến {inspectionBlockedBy.tripCode} trước khi bắt đầu kiểm tra xe cho chuyến này.
              </Text>
            ) : null}
            <View style={styles.explainBox}>
              <Text style={styles.helperText}>{t.inspection.explain}</Text>
              <AppButton
                title={t.inspection.startButton}
                disabled={!canStart}
                loading={processingAction === 'start'}
                onPress={startInspection}
              />
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons color={colors.primary} name="clipboard-check-outline" size={22} />
                <Text style={styles.sectionTitle}>{t.inspection.operationTitle}</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{formatDriverStatus(inspectionStatus, t)}</Text>
              </View>
            </View>
            <Text style={styles.helperText}>{t.inspection.operationHelper}</Text>

            {isReady ? (
              <>
                <Text style={styles.successText}>{t.inspection.readyMessage}</Text>
                <AppButton title={t.inspection.goToStartTrip} onPress={openTripLifecycle} />
              </>
            ) : null}
            {isIssueReported ? (
              <>
                <Text style={styles.errorText}>
                  {t.inspection.issueReported} {inspection?.issueDescription || ''}
                </Text>
                <AppButton
                  title={t.common.refresh}
                  loading={processingAction === 'refresh'}
                  onPress={async () => {
                    setProcessingAction('refresh');
                    await refreshTrip();
                    setProcessingAction('');
                  }}
                  variant="secondary"
                />
              </>
            ) : null}

            <View style={styles.checklist}>
              {checklistItems.map((item) => {
                const checked = checklist[item.key];
                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked, disabled: !canInspect }}
                    disabled={!canInspect || Boolean(processingAction)}
                    onPress={() => toggleChecklist(item.key)}
                    style={[styles.checkRow, !canInspect && styles.disabledPanel]}
                  >
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                      {checked ? <MaterialCommunityIcons color={colors.white} name="check" size={16} /> : null}
                    </View>
                    <Text style={styles.checkLabel}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <AppButton
              title={t.inspection.confirmReady}
              disabled={!canConfirmReady}
              loading={processingAction === 'ready'}
              onPress={confirmReady}
            />

            {!isReady ? (
              <View style={styles.issuePanel}>
                {!isInProgress ? (
                  <Text style={styles.helperText}>{t.inspection.waitingReplacement}</Text>
                ) : null}
                <Text style={styles.fieldLabel}>{t.inspection.issueGroup}</Text>
                <View style={styles.categoryRow}>
                  {issueCategories.map((category) => (
                    <Pressable
                      key={category.value}
                      disabled={!canInspect || Boolean(processingAction)}
                      onPress={() => setIssueCategory(category.value)}
                      style={[
                        styles.categoryChip,
                        issueCategory === category.value && styles.categoryChipActive,
                        !canInspect && styles.disabledPanel,
                      ]}
                    >
                      <Text style={[
                        styles.categoryChipText,
                        issueCategory === category.value && styles.categoryChipTextActive,
                      ]}>
                        {category.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.fieldLabel}>{t.inspection.issueDescription}</Text>
                <TextInput
                  editable={canInspect && !Boolean(processingAction)}
                  multiline
                  onChangeText={setIssueDescription}
                  placeholder={t.inspection.issuePlaceholder}
                  placeholderTextColor={colors.muted}
                  style={styles.issueInput}
                  value={issueDescription}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={!canReportIssue || processingAction === 'issue'}
                  onPress={reportIssue}
                  style={({ pressed }) => [
                    styles.dangerButton,
                    (!canReportIssue || processingAction === 'issue') && styles.dangerButtonDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {processingAction === 'issue' ? (
                    <Text style={styles.dangerButtonText}>{t.common.loading}</Text>
                  ) : (
                    <Text style={styles.dangerButtonText}>{t.inspection.reportIssue}</Text>
                  )}
                </Pressable>
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </Screen>
      <RoleBottomNav active="trips" role={user?.role} />
    </View>
  );
}

const styles = StyleSheet.create({
  screenShell: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  kicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.primary, fontSize: 24, fontWeight: '900' },
  tripCard: { gap: 8, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  tripCode: { color: colors.primary, fontSize: 20, fontWeight: '900' },
  routeName: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  summaryGrid: { gap: 4, marginTop: 4 },
  summaryText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  replacementNotice: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#b8e8d0',
    backgroundColor: '#e8f8ef',
    padding: 14,
  },
  replacementTextWrap: { flex: 1, gap: 3 },
  replacementTitle: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  replacementText: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  section: { gap: 12, marginTop: 18, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  sectionTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  helperText: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  warningText: { borderRadius: 14, backgroundColor: '#fff7ed', padding: 12, color: '#9a3412', fontSize: 13, fontWeight: '800' },
  successText: { borderRadius: 14, backgroundColor: '#ecfdf5', padding: 12, color: '#047857', fontSize: 13, fontWeight: '800' },
  errorText: { borderRadius: 14, backgroundColor: colors.errorContainer, padding: 12, color: colors.error, fontSize: 13, fontWeight: '800' },
  explainBox: { gap: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surfaceLow, padding: 14 },
  statusPill: { alignSelf: 'flex-start', borderRadius: 16, backgroundColor: '#d4f2e5', paddingHorizontal: 10, paddingVertical: 6 },
  statusPillText: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  checklist: { gap: 10 },
  checkRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
  },
  checkboxChecked: { borderColor: colors.primary, backgroundColor: colors.primary },
  checkLabel: { color: colors.text, fontSize: 14, fontWeight: '800' },
  actions: { gap: 12, marginTop: 18 },
  disabledPanel: { opacity: 0.62 },
  issuePanel: { gap: 10, borderRadius: 18, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surfaceLow, padding: 14 },
  fieldLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { minHeight: 36, justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.card, paddingHorizontal: 12 },
  categoryChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  categoryChipText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  categoryChipTextActive: { color: colors.white },
  issueInput: {
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.outline,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    padding: 14,
    textAlignVertical: 'top',
  },
  dangerButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.error,
    paddingHorizontal: 18,
  },
  dangerButtonDisabled: { opacity: 0.5 },
  dangerButtonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  pressed: { transform: [{ scale: 0.98 }] },
  bottomSpacer: { height: 96 },
});
