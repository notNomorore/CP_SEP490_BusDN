import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import scheduleOperationsApi from '@/api/scheduleOperations.api';
import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';
import type { AssignedTrip, ShiftSchedule } from '@/types/scheduleOperations';
import { isDriverAssistantRole } from '@/utils/roleNavigation';
import {
  formatDate,
  formatTime,
  getTodayRange,
  getTripStatus,
  isTripCompleted,
  isTripToday,
} from '@/utils/scheduleOperations';
import { getErrorMessage } from '@/utils/validation';

const assignedTripsRoute = '/driver-assistant/assigned-trips' as Href;
const shiftScheduleRoute = '/driver-assistant/shift-schedule' as Href;
const tripDetailRoute = '/driver-assistant/trip-detail' as Href;
const notificationsRoute = '/driver-assistant/notifications' as Href;
const inspectionRoute = '/driver-assistant/vehicle-inspection' as Href;
const lifecycleRoute = '/driver-assistant/trip-lifecycle' as Href;

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function SummaryCard({
  label,
  value,
  detail,
  icon,
  muted,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: IconName;
  muted?: boolean;
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.statusBar, muted && styles.statusBarMuted]} />
      <View style={styles.summaryContent}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <View style={styles.summaryValueRow}>
          <Text style={[styles.summaryValue, muted && styles.summaryValueMuted]}>{value}</Text>
          <Text style={styles.summaryDetail}>{detail}</Text>
        </View>
      </View>
      <MaterialCommunityIcons
        color="rgba(23,80,58,0.06)"
        name={icon}
        size={58}
        style={styles.summaryIcon}
      />
    </View>
  );
}

const getAcceptanceStatus = (trip: AssignedTrip) => String(trip.acceptanceStatus || '').toUpperCase();

const canAcceptTrip = (trip: AssignedTrip) => {
  const status = getTripStatus(trip);
  const acceptanceStatus = getAcceptanceStatus(trip);
  return !['ACCEPTED', 'REJECTED'].includes(acceptanceStatus)
    && !['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DONE'].includes(status);
};

export default function DriverBusAssistantHomeScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const [trips, setTrips] = useState<AssignedTrip[]>([]);
  const [shifts, setShifts] = useState<ShiftSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState('');

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tripsPayload, shiftsPayload] = await Promise.all([
        scheduleOperationsApi.getAssignedTrips(getTodayRange()),
        scheduleOperationsApi.getShiftSchedule(getTodayRange()),
      ]);
      setTrips(tripsPayload.trips || []);
      setShifts(shiftsPayload.shifts || []);
    } catch (error) {
      Alert.alert(
        'Unable to load dashboard',
        getErrorMessage(error, 'Unable to load schedule and assignment data.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.replace('/auth/login');
      return;
    }

    if (isHydrated && isAuthenticated && !isDriverAssistantRole(user?.role)) {
      router.replace('/home');
      return;
    }

    void loadDashboard();
  }, [isAuthenticated, isHydrated, loadDashboard, user?.role]);

  const todaysTrips = useMemo(() => trips.filter(isTripToday), [trips]);
  const completedCount = useMemo(() => trips.filter(isTripCompleted).length, [trips]);
  const upcomingShift = shifts[0] || null;
  const nextTrip = todaysTrips.find((trip) => !isTripCompleted(trip)) || todaysTrips[0] || null;
  const isDriver = user?.role === 'DRIVER';
  const roleLabel = isDriver ? 'Senior Driver' : 'Bus Assistant';
  const displayName = user?.fullName || roleLabel;

  const openTripDetail = (trip: AssignedTrip) => {
    router.push({
      pathname: tripDetailRoute,
      params: { trip: JSON.stringify(trip), assignmentId: trip.id },
    } as unknown as Href);
  };

  const openInspection = (trip: AssignedTrip) => {
    router.push({
      pathname: inspectionRoute,
      params: { trip: JSON.stringify(trip), assignmentId: trip.id },
    } as unknown as Href);
  };

  const openLifecycle = (trip: AssignedTrip) => {
    router.push({
      pathname: lifecycleRoute,
      params: { trip: JSON.stringify(trip), assignmentId: trip.id },
    } as unknown as Href);
  };

  const acceptTrip = async (trip: AssignedTrip) => {
    setProcessingId(trip.id);
    try {
      const updated = await scheduleOperationsApi.acceptAssignedTrip(trip.id);
      setTrips((current) => current.map((item) => (item.id === trip.id ? updated : item)));
      if (isDriver) {
        openInspection(updated);
        return;
      }
      Alert.alert('Trip accepted', 'The assigned trip has been accepted.');
    } catch (error) {
      Alert.alert('Unable to accept trip', getErrorMessage(error, 'Unable to accept this assigned trip.'));
    } finally {
      setProcessingId('');
    }
  };

  if (isHydrated && (!isAuthenticated || !isDriverAssistantRole(user?.role))) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 96 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                {user?.avatar ? (
                  <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>{displayName.slice(0, 1).toUpperCase()}</Text>
                )}
              </View>
              <Text style={styles.brand}>TransitPulse</Text>
            </View>
            <Pressable
              accessibilityLabel="Open notifications"
              onPress={() => router.push(notificationsRoute)}
              style={styles.notificationButton}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <MaterialCommunityIcons color={colors.accent} name="bell-outline" size={22} />
              )}
            </Pressable>
          </View>

          <View style={styles.greeting}>
            <Text style={styles.kicker}>{formatDate(new Date().toISOString()).toUpperCase()}</Text>
            <Text style={styles.title}>Good Morning, {displayName}!</Text>
            <Text style={styles.subtitle}>{roleLabel} - Schedule & Assignment</Text>
          </View>

          <View style={styles.summaryGrid}>
            <SummaryCard label="Assigned Trips Today" value={todaysTrips.length} detail="Routes" icon="routes" />
            <SummaryCard
              label="Upcoming Shift"
              value={upcomingShift?.startTime || 'N/A'}
              detail={upcomingShift?.shiftName || 'No shift'}
              icon="clock-outline"
            />
            <SummaryCard
              label="Completed Trips"
              value={completedCount}
              detail="Today"
              icon="check-circle-outline"
              muted
            />
          </View>

          <View style={styles.featureGrid}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(assignedTripsRoute)}
              style={({ pressed }) => [styles.primaryFeature, pressed && styles.pressed]}
            >
              <View style={styles.featureIconPrimary}>
                <MaterialCommunityIcons color={colors.white} name="bus" size={28} />
              </View>
              <View>
                <Text style={styles.primaryFeatureTitle}>View Assigned Trips</Text>
                <Text style={styles.primaryFeatureText}>Review your daily routes and passenger manifests.</Text>
              </View>
              <MaterialCommunityIcons color="rgba(255,255,255,0.35)" name="arrow-right" size={42} style={styles.featureArrow} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(shiftScheduleRoute)}
              style={({ pressed }) => [styles.secondaryFeature, pressed && styles.pressed]}
            >
              <View style={styles.featureIconSecondary}>
                <MaterialCommunityIcons color={colors.primary} name="calendar-month" size={28} />
              </View>
              <View>
                <Text style={styles.secondaryFeatureTitle}>View Shift Schedule</Text>
                <Text style={styles.secondaryFeatureText}>Manage your availability and upcoming work hours.</Text>
              </View>
              <MaterialCommunityIcons color="rgba(43,164,113,0.22)" name="arrow-right" size={42} style={styles.featureArrow} />
            </Pressable>
          </View>

          <View style={styles.nextCard}>
            <Text style={styles.sectionTitle}>Next Assignment</Text>
            {nextTrip ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => openTripDetail(nextTrip)}
                style={({ pressed }) => [styles.nextRow, pressed && styles.pressed]}
              >
                <View style={styles.nextIcon}>
                  <MaterialCommunityIcons color={colors.primary} name="bus-clock" size={24} />
                </View>
                <View style={styles.nextContent}>
                  <View style={styles.badgeRow}>
                    <Text style={styles.routeBadge}>{nextTrip.route?.routeNumber || nextTrip.tripCode || 'Trip'}</Text>
                    <Text style={styles.statusText}>{getTripStatus(nextTrip)}</Text>
                  </View>
                  <Text style={styles.nextTitle}>
                    {nextTrip.route?.origin || 'Origin'} - {nextTrip.route?.destination || 'Destination'}
                  </Text>
                  <Text style={styles.nextMeta}>
                    {formatTime(nextTrip.scheduledStart)} - {nextTrip.vehicle?.code || nextTrip.vehicle?.plateNumber || 'No bus'}
                  </Text>
                </View>
                {isDriver && canAcceptTrip(nextTrip) ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={processingId === nextTrip.id}
                    onPress={(event) => {
                      event.stopPropagation();
                      void acceptTrip(nextTrip);
                    }}
                    style={({ pressed }) => [
                      styles.startButton,
                      pressed && styles.pressed,
                      processingId === nextTrip.id && styles.disabledButton,
                    ]}
                  >
                    {processingId === nextTrip.id ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <Text style={styles.startButtonText}>ACCEPT</Text>
                    )}
                  </Pressable>
                ) : isDriver && getAcceptanceStatus(nextTrip) === 'ACCEPTED' ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={(event) => {
                      event.stopPropagation();
                      if (nextTrip.inspection?.status === 'READY') {
                        openLifecycle(nextTrip);
                        return;
                      }
                      openInspection(nextTrip);
                    }}
                    style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.startButtonText}>
                      {nextTrip.inspection?.status === 'READY' ? 'START' : 'INSPECT'}
                    </Text>
                  </Pressable>
                ) : canAcceptTrip(nextTrip) ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={processingId === nextTrip.id}
                    onPress={(event) => {
                      event.stopPropagation();
                      void acceptTrip(nextTrip);
                    }}
                    style={({ pressed }) => [
                      styles.startButton,
                      pressed && styles.pressed,
                      processingId === nextTrip.id && styles.disabledButton,
                    ]}
                  >
                    {processingId === nextTrip.id ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <Text style={styles.startButtonText}>ACCEPT</Text>
                    )}
                  </Pressable>
                ) : (
                  <View style={styles.openPill}>
                    <Text style={styles.openPillText}>OPEN</Text>
                  </View>
                )}
              </Pressable>
            ) : (
              <Text style={styles.emptyText}>No next assignment for today.</Text>
            )}
          </View>
        </ScrollView>

        <RoleBottomNav active="home" role={user?.role} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f8fb' },
  screen: { flex: 1, backgroundColor: '#f7f8fb' },
  scrollContent: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 10 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 19, borderWidth: 2, borderColor: 'rgba(43,164,113,0.25)', backgroundColor: colors.surfaceHigh },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  brand: { color: colors.accent, fontSize: 19, fontWeight: '900' },
  notificationButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.card },
  greeting: { gap: 5, marginBottom: 20 },
  kicker: { color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  title: { color: colors.text, fontSize: 25, lineHeight: 31, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  summaryGrid: { gap: 12 },
  summaryCard: { minHeight: 88, overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: '#eceef1', backgroundColor: colors.card, padding: 16 },
  statusBar: { position: 'absolute', left: 0, top: 14, bottom: 14, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4, backgroundColor: colors.accent },
  statusBarMuted: { backgroundColor: '#89918d' },
  summaryContent: { marginLeft: 6 },
  summaryLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  summaryValueRow: { marginTop: 4, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  summaryValue: { color: colors.accent, fontSize: 27, fontWeight: '900' },
  summaryValueMuted: { color: colors.text },
  summaryDetail: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  summaryIcon: { position: 'absolute', right: -5, bottom: -8 },
  featureGrid: { gap: 14, marginTop: 22 },
  primaryFeature: { height: 190, justifyContent: 'space-between', overflow: 'hidden', borderRadius: 22, backgroundColor: colors.accent, padding: 22 },
  secondaryFeature: { height: 190, justifyContent: 'space-between', overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: colors.outline, backgroundColor: '#e8ebee', padding: 22 },
  featureIconPrimary: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)' },
  featureIconSecondary: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: 'rgba(43,164,113,0.12)' },
  primaryFeatureTitle: { maxWidth: 230, color: colors.white, fontSize: 24, lineHeight: 29, fontWeight: '900' },
  primaryFeatureText: { maxWidth: 260, marginTop: 6, color: '#d6f8e5', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  secondaryFeatureTitle: { maxWidth: 230, color: colors.text, fontSize: 24, lineHeight: 29, fontWeight: '900' },
  secondaryFeatureText: { maxWidth: 260, marginTop: 6, color: colors.muted, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  featureArrow: { position: 'absolute', right: 18, bottom: 18 },
  nextCard: { gap: 12, marginTop: 24 },
  sectionTitle: { color: colors.muted, fontSize: 15, fontWeight: '900' },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, borderColor: '#e1e2e5', backgroundColor: colors.card, padding: 14 },
  nextIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: '#d4f2e5' },
  nextContent: { flex: 1, minWidth: 0 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  routeBadge: { overflow: 'hidden', borderRadius: 10, backgroundColor: colors.surfaceHigh, paddingHorizontal: 8, paddingVertical: 3, color: colors.text, fontSize: 10, fontWeight: '900' },
  statusText: { color: colors.accent, fontSize: 10, fontWeight: '900' },
  nextTitle: { marginTop: 5, color: colors.text, fontSize: 14, fontWeight: '900' },
  nextMeta: { marginTop: 3, color: colors.muted, fontSize: 12 },
  startButton: { minWidth: 72, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.accent, paddingHorizontal: 16 },
  startButtonText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  openPill: { minWidth: 72, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.surfaceHigh, paddingHorizontal: 16 },
  openPillText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  disabledButton: { opacity: 0.65 },
  emptyText: { borderRadius: 16, backgroundColor: colors.surfaceLow, padding: 14, color: colors.muted, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});
