import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import busAssistantApi from '@/api/busAssistant.api';
import scheduleOperationsApi from '@/api/scheduleOperations.api';
import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';
import type { ShiftRevenue } from '@/types/busAssistant';
import type { AssignedTrip, ShiftSchedule } from '@/types/scheduleOperations';
import { isDriverAssistantRole } from '@/utils/roleNavigation';
import { formatDate, formatTime, getTodayRange, getTripStatus, isTripCompleted, isTripToday, toDateInput } from '@/utils/scheduleOperations';
import { getErrorMessage } from '@/utils/validation';

const assignedTripsRoute = '/driver-assistant/assigned-trips' as Href;
const shiftScheduleRoute = '/driver-assistant/shift-schedule' as Href;
const tripDetailRoute = '/driver-assistant/trip-detail' as Href;
const notificationsRoute = '/driver-assistant/notifications' as Href;
const inspectionRoute = '/driver-assistant/vehicle-inspection' as Href;
const lifecycleRoute = '/driver-assistant/trip-lifecycle' as Href;

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const route = (pathname: string) => pathname as Href;

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionTile({
  title,
  subtitle,
  icon,
  href,
  primary,
}: {
  title: string;
  subtitle: string;
  icon: IconName;
  href: Href;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.actionTile, primary && styles.actionTilePrimary, pressed && styles.pressed]}
    >
      <View style={[styles.actionIcon, primary && styles.actionIconPrimary]}>
        <MaterialCommunityIcons color={primary ? colors.white : colors.primary} name={icon} size={26} />
      </View>
      <Text style={[styles.actionTitle, primary && styles.actionTitlePrimary]}>{title}</Text>
      <Text style={[styles.actionSubtitle, primary && styles.actionSubtitlePrimary]}>{subtitle}</Text>
    </Pressable>
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
  const [revenue, setRevenue] = useState<ShiftRevenue | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState('');

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tripsPayload, shiftsPayload, revenuePayload] = await Promise.all([
        scheduleOperationsApi.getAssignedTrips(getTodayRange()),
        scheduleOperationsApi.getShiftSchedule(getTodayRange()),
        busAssistantApi.getShiftRevenue({ date: toDateInput() }).catch(() => null),
      ]);
      setTrips(tripsPayload.trips || []);
      setShifts(shiftsPayload.shifts || []);
      setRevenue(revenuePayload);
    } catch (error) {
      Alert.alert('Unable to load dashboard', getErrorMessage(error, 'Unable to load schedule and assignment data.'));
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

    if (isHydrated && isAuthenticated) {
      void loadDashboard();
    }
  }, [isAuthenticated, isHydrated, loadDashboard, user?.role]);

  const todaysTrips = useMemo(() => trips.filter(isTripToday), [trips]);
  const completedCount = useMemo(() => trips.filter(isTripCompleted).length, [trips]);
  const nextTrip = todaysTrips.find((trip) => !isTripCompleted(trip)) || todaysTrips[0] || null;
  const upcomingShift = shifts[0] || null;
  const isDriver = user?.role === 'DRIVER';
  const displayName = user?.fullName || (isDriver ? 'Driver' : 'Bus Assistant');

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
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 104 + insets.bottom }]} showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                {user?.avatar ? <Image source={{ uri: user.avatar }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{displayName.slice(0, 1).toUpperCase()}</Text>}
              </View>
              <View>
                <Text style={styles.brand}>BusDN Crew</Text>
                <Text style={styles.dateText}>{formatDate(new Date().toISOString())}</Text>
              </View>
            </View>
            <Pressable accessibilityLabel="Open notifications" onPress={() => router.push(route('/driver-assistant/notifications'))} style={styles.notificationButton}>
              {isLoading ? <ActivityIndicator color={colors.primary} size="small" /> : <MaterialCommunityIcons color={colors.accent} name="bell-outline" size={22} />}
            </Pressable>
          </View>

          <View style={styles.heroCard}>
            <Text style={styles.heroKicker}>TODAY'S WORK</Text>
            <Text style={styles.heroTitle}>Hi, {displayName}</Text>
            <View style={styles.statsRow}>
              <StatPill label="Trips" value={todaysTrips.length} />
              <StatPill label="Done" value={completedCount} />
              <StatPill label="Sales" value={revenue?.totalTicketsSold || 0} />
            </View>
          </View>

          <View style={styles.nextCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Next assignment</Text>
              <Pressable onPress={() => router.push(route('/driver-assistant/assigned-trips'))}>
                <Text style={styles.linkText}>All trips</Text>
              </Pressable>
            </View>
            {nextTrip ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/driver-assistant/trip-detail', params: { trip: JSON.stringify(nextTrip), assignmentId: nextTrip.id } } as unknown as Href)}
                style={({ pressed }) => [styles.nextRow, pressed && styles.pressed]}
              >
                <View style={styles.nextIcon}>
                  <MaterialCommunityIcons color={colors.primary} name="bus-clock" size={25} />
                </View>
                <View style={styles.nextContent}>
                  <Text style={styles.routeBadge}>{nextTrip.route?.routeNumber || nextTrip.tripCode || 'Trip'}</Text>
                  <Text style={styles.nextTitle}>{nextTrip.route?.origin || 'Origin'} - {nextTrip.route?.destination || 'Destination'}</Text>
                  <Text style={styles.nextMeta}>{formatTime(nextTrip.scheduledStart)} - {nextTrip.vehicle?.code || nextTrip.vehicle?.plateNumber || 'No bus'} - {getTripStatus(nextTrip)}</Text>
                </View>
<<<<<<< HEAD
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
=======
                {isDriver ? (
                  <Pressable disabled={processingId === nextTrip.id} onPress={(event) => { event.stopPropagation(); void startTrip(nextTrip); }} style={styles.startButton}>
                    {processingId === nextTrip.id ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.startButtonText}>START</Text>}
>>>>>>> c45d84418dc37ca93b4fc2a2fa5d736fdd16dc48
                  </Pressable>
                ) : (
                  <MaterialCommunityIcons color={colors.muted} name="chevron-right" size={24} />
                )}
              </Pressable>
            ) : <Text style={styles.emptyText}>No next assignment for today.</Text>}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Core actions</Text>
          </View>
          <View style={styles.actionGrid}>
            <ActionTile title="Validate ticket" subtitle="Check QR or ticket code" icon="qrcode-scan" href={route('/driver-assistant/validate-ticket')} primary />
            <ActionTile title="Sell ticket" subtitle="Create onboard cash/QR ticket" icon="ticket-confirmation-outline" href={route('/driver-assistant/walkin-ticket')} />
            <ActionTile title="Shift revenue" subtitle={`${revenue?.totalRevenue ? new Intl.NumberFormat('vi-VN').format(revenue.totalRevenue) : 0} VND today`} icon="cash-register" href={route('/driver-assistant/shift-revenue')} />
            <ActionTile title="Submit summary" subtitle="Close shift cashbox" icon="clipboard-check-outline" href={route('/driver-assistant/revenue-summary')} />
          </View>

          <View style={styles.operationsSection}>
            <Text style={styles.sectionTitle}>Operations</Text>
            <View style={styles.actionGrid}>
              <ActionTile title={upcomingShift?.shiftName || 'Shift schedule'} subtitle="View work hours and assignments" icon="calendar-month-outline" href={route('/driver-assistant/shift-schedule')} />
              <ActionTile title="Operation chat" subtitle="Message dispatch and crew" icon="chat-outline" href={route('/driver-assistant/group-chat')} />
              <ActionTile title="Incident report" subtitle="Open a trip to report issues" icon="alert-circle-outline" href={route('/driver-assistant/assigned-trips')} />
            </View>
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
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 20, borderWidth: 2, borderColor: 'rgba(43,164,113,0.25)', backgroundColor: colors.surfaceHigh },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  brand: { color: colors.accent, fontSize: 18, fontWeight: '900' },
  dateText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  notificationButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.card },
  heroCard: { gap: 14, borderRadius: 26, backgroundColor: colors.primary, padding: 20, marginBottom: 14 },
  heroKicker: { color: '#aff4d1', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: colors.white, fontSize: 28, lineHeight: 34, fontWeight: '900' },
  statsRow: { flexDirection: 'row', gap: 9 },
  statPill: { flex: 1, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', padding: 12 },
  statValue: { color: colors.white, fontSize: 21, fontWeight: '900' },
  statLabel: { marginTop: 2, color: '#d4f2e5', fontSize: 11, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  linkText: { color: colors.accent, fontSize: 13, fontWeight: '900' },
  nextCard: { borderRadius: 22, backgroundColor: colors.card, padding: 16, marginBottom: 18 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: '#d4f2e5' },
  nextContent: { flex: 1, minWidth: 0 },
  routeBadge: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  nextTitle: { marginTop: 3, color: colors.text, fontSize: 15, fontWeight: '900' },
  nextMeta: { marginTop: 3, color: colors.muted, fontSize: 12, fontWeight: '700' },
  startButton: { minWidth: 72, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.accent, paddingHorizontal: 14 },
  startButtonText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  actionTile: { width: '48%', minHeight: 156, justifyContent: 'space-between', borderRadius: 22, borderWidth: 1, borderColor: '#e1e2e5', backgroundColor: colors.card, padding: 16 },
  actionTilePrimary: { borderColor: colors.accent, backgroundColor: colors.accent },
  actionIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#d4f2e5' },
  actionIconPrimary: { backgroundColor: 'rgba(255,255,255,0.18)' },
  actionTitle: { color: colors.text, fontSize: 18, lineHeight: 22, fontWeight: '900' },
  actionTitlePrimary: { color: colors.white },
  actionSubtitle: { color: colors.muted, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  actionSubtitlePrimary: { color: '#d6f8e5' },
  operationsSection: { gap: 12 },
  emptyText: { borderRadius: 16, backgroundColor: colors.surfaceLow, padding: 14, color: colors.muted, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});
