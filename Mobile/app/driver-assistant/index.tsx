import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import busAssistantApi from '@/api/busAssistant.api';
import scheduleOperationsApi from '@/api/scheduleOperations.api';
import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { colors } from '@/constants/colors';
import { formatDriverStatus, useDriverI18n } from '@/i18n/driver';
import { useAuthStore } from '@/store/auth.store';
import type { ShiftRevenue } from '@/types/busAssistant';
import type { AssignedTrip, ShiftSchedule } from '@/types/scheduleOperations';
import { isDriverAssistantRole, normalizeRole } from '@/utils/roleNavigation';
import { getTodayRange, getTripDepartureTimeLabel, getTripStatus, getTripVehicleLabel, isTripCompleted, isTripToday } from '@/utils/scheduleOperations';
import { getErrorMessage, getErrorStatusCode, isPermissionError } from '@/utils/validation';

const assignedTripsRoute = '/driver-assistant/assigned-trips' as Href;
const shiftScheduleRoute = '/driver-assistant/shift-schedule' as Href;
const tripDetailRoute = '/driver-assistant/trip-detail' as Href;
const notificationsRoute = '/driver-assistant/notifications' as Href;
const inspectionRoute = '/driver-assistant/vehicle-inspection' as Href;
const lifecycleRoute = '/driver-assistant/trip-lifecycle' as Href;

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const route = (pathname: string) => pathname as Href;

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
      <View style={styles.actionTextBlock}>
        <Text style={[styles.actionTitle, primary && styles.actionTitlePrimary]}>{title}</Text>
        <Text numberOfLines={2} style={[styles.actionSubtitle, primary && styles.actionSubtitlePrimary]}>{subtitle}</Text>
      </View>
      <MaterialCommunityIcons
        color={primary ? 'rgba(255,255,255,0.8)' : colors.outline}
        name="chevron-right"
        size={20}
        style={styles.actionArrow}
      />
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
  const logout = useAuthStore((state) => state.logout);
  const [trips, setTrips] = useState<AssignedTrip[]>([]);
  const [shifts, setShifts] = useState<ShiftSchedule[]>([]);
  const [revenue, setRevenue] = useState<ShiftRevenue | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState('');
  const { language, t } = useDriverI18n();
  const normalizedRole = normalizeRole(user?.role);
  const isDriver = normalizedRole === 'DRIVER';
  const isBusAssistant = ['BUS_ASSISTANT', 'BUS ASSISTANT', 'CONDUCTOR'].includes(normalizedRole);

  const loadDashboard = useCallback(async () => {
    if (!isHydrated || !isAuthenticated) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [tripsPayload, shiftsPayload, revenuePayload] = await Promise.all([
        scheduleOperationsApi.getAssignedTrips(getTodayRange()),
        scheduleOperationsApi.getShiftSchedule(getTodayRange()),
        isBusAssistant
          ? busAssistantApi.getShiftRevenue().catch(() => null)
          : Promise.resolve(null),
      ]);
      setTrips(tripsPayload.trips || []);
      setShifts(shiftsPayload.shifts || []);
      setRevenue(revenuePayload);
    } catch (error) {
      const message = getErrorMessage(error, t.home.loadErrorFallback);
      const statusCode = getErrorStatusCode(error);
      const isAuthError = statusCode === 401 || message.toLowerCase().includes('no token provided');

      if (isAuthError) {
        await logout();
        router.replace('/auth/login');
        return;
      }

      if (isPermissionError(error)) {
        setTrips([]);
        setShifts([]);
        setRevenue(null);
        return;
      }

      Alert.alert(t.home.loadErrorTitle, message);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, isBusAssistant, isHydrated, logout, t.home.loadErrorFallback, t.home.loadErrorTitle]);

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
  const nextTrip = todaysTrips.find((trip) => !isTripCompleted(trip)) || todaysTrips[0] || null;
  const upcomingShift = shifts[0] || null;
  const displayName = user?.fullName || (isDriver ? t.common.driver : t.common.busAssistant);
  const homeDate = useMemo(() => (
    new Intl.DateTimeFormat(language === 'VN' ? 'vi-VN' : 'en-US', {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
    }).format(new Date())
  ), [language]);

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
      Alert.alert(t.home.acceptSuccessTitle, t.home.acceptSuccessMessage);
    } catch (error) {
      Alert.alert(t.home.acceptErrorTitle, getErrorMessage(error, t.home.acceptErrorFallback));
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
                <Text style={styles.brand}>{t.home.brand}</Text>
                <Text style={styles.dateText}>{homeDate}</Text>
              </View>
            </View>
            <Pressable accessibilityLabel={t.nav.notifications} onPress={() => router.push(notificationsRoute)} style={styles.notificationButton}>
              {isLoading ? <ActivityIndicator color={colors.primary} size="small" /> : <MaterialCommunityIcons color={colors.accent} name="bell-outline" size={22} />}
            </Pressable>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.greetingRow}>
              <View style={styles.greetingText}>
                <Text style={styles.heroKicker}>{t.home.todayOverview}</Text>
                <Text numberOfLines={1} style={styles.heroTitle}>{t.home.hello}, {displayName}</Text>
                <Text style={styles.heroSubtitle}>{t.home.subtitle}</Text>
              </View>
              <View style={styles.greetingIcon}>
                <MaterialCommunityIcons color={colors.accent} name="hand-wave-outline" size={26} />
              </View>
            </View>
          </View>

          <View style={styles.nextCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t.home.nextTrip}</Text>
              <Pressable onPress={() => router.push(route('/driver-assistant/assigned-trips'))}>
                <Text style={styles.linkText}>{t.home.allTrips}</Text>
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
                  <Text style={styles.routeBadge}>{nextTrip.route?.routeNumber || nextTrip.tripCode || t.nav.trips}</Text>
                  <Text style={styles.nextTitle}>{nextTrip.route?.origin || t.detail.origin} - {nextTrip.route?.destination || t.detail.destination}</Text>
                  <Text style={styles.nextMeta}>{getTripDepartureTimeLabel(nextTrip)} - {getTripVehicleLabel(nextTrip)} - {formatDriverStatus(getTripStatus(nextTrip), t)}</Text>
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
                      <Text style={styles.startButtonText}>{t.home.acceptTrip}</Text>
                    )}
                  </Pressable>
                ) : isDriver && getAcceptanceStatus(nextTrip) === 'ACCEPTED' && !isTripCompleted(nextTrip) ? (
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
                      {nextTrip.inspection?.status === 'READY' ? t.home.startTrip : t.home.inspectVehicle}
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
                      <Text style={styles.startButtonText}>{t.home.acceptTrip}</Text>
                    )}
                  </Pressable>
                ) : (
                  <MaterialCommunityIcons color={colors.muted} name="chevron-right" size={24} />
                )}
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(assignedTripsRoute)}
                style={({ pressed }) => [styles.emptyTripButton, pressed && styles.pressed]}
              >
                <View style={styles.emptyTripIcon}>
                  <MaterialCommunityIcons color={colors.primary} name="bus-clock" size={24} />
                </View>
                <View style={styles.emptyTripContent}>
                  <Text style={styles.emptyTripTitle}>{t.home.viewAssignedTrips}</Text>
                  <Text style={styles.emptyTripSubtitle}>{t.home.noNextTripToday}</Text>
                </View>
                <MaterialCommunityIcons color={colors.muted} name="chevron-right" size={23} />
              </Pressable>
            )}
          </View>

          <View style={styles.actionGrid}>
            {isDriver ? (
              <>
                <ActionTile title={t.home.assignedTrips} subtitle={t.home.assignedTripsSub} icon="bus-clock" href={assignedTripsRoute} primary />
                <ActionTile title={upcomingShift?.shiftName || t.home.shiftSchedule} subtitle={t.home.shiftScheduleSub} icon="calendar-month-outline" href={shiftScheduleRoute} />
                <ActionTile title={t.home.operationNotifications} subtitle={t.home.operationNotificationsSub} icon="bell-ring-outline" href={notificationsRoute} />
                <ActionTile title={t.home.operationChat} subtitle={t.home.operationChatSub} icon="chat-outline" href={route('/driver-assistant/group-chat')} />
              </>
            ) : (
              <>
                <ActionTile title={t.assistant.home.validateTicket} subtitle={t.assistant.home.validateTicketSub} icon="qrcode-scan" href={route('/driver-assistant/validate-ticket')} primary />
                <ActionTile title={t.assistant.home.sellTicket} subtitle={t.assistant.home.sellTicketSub} icon="ticket-confirmation-outline" href={route('/driver-assistant/walkin-ticket')} />
                <ActionTile
                  title={t.assistant.home.shiftRevenue}
                  subtitle={`${revenue?.totalRevenue ? new Intl.NumberFormat(language === 'VN' ? 'vi-VN' : 'en-US').format(revenue.totalRevenue) : 0} ${t.assistant.home.revenueToday}`}
                  icon="cash-register"
                  href={route('/driver-assistant/shift-revenue')}
                />
                <ActionTile title={t.assistant.home.trips} subtitle={t.assistant.home.tripsSub} icon="bus-clock" href={assignedTripsRoute} />
                <ActionTile title={upcomingShift?.shiftName || t.home.shiftSchedule} subtitle={t.home.shiftScheduleSub} icon="calendar-month-outline" href={shiftScheduleRoute} />
                <ActionTile title={t.home.operationNotifications} subtitle={t.home.operationNotificationsSub} icon="bell-ring-outline" href={notificationsRoute} />
                <ActionTile title={t.home.operationChat} subtitle={t.home.operationChatSub} icon="chat-outline" href={route('/driver-assistant/group-chat')} />
                <ActionTile title={t.home.profileCard} subtitle={t.home.profileCardSub} icon="account-circle-outline" href={route('/profile')} />
              </>
            )}
          </View>
        </ScrollView>
        <RoleBottomNav active="home" role={user?.role} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f8f6' },
  screen: { flex: 1, backgroundColor: '#f5f8f6' },
  scrollContent: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 22, borderWidth: 2, borderColor: '#bde6d2', backgroundColor: '#e8f7ef' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  brand: { color: colors.primary, fontSize: 17, fontWeight: '900' },
  dateText: { marginTop: 1, color: colors.muted, fontSize: 11, fontWeight: '700' },
  notificationButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: '#e2ebe6', backgroundColor: colors.card },
  heroCard: { gap: 16, marginBottom: 18 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 2 },
  greetingText: { minWidth: 0, flex: 1 },
  greetingIcon: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#e1f6eb' },
  heroKicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  heroTitle: { marginTop: 4, color: colors.primary, fontSize: 25, lineHeight: 31, fontWeight: '900' },
  heroSubtitle: { marginTop: 3, color: colors.muted, fontSize: 12, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 2 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  linkText: { color: colors.accent, fontSize: 13, fontWeight: '900' },
  nextCard: { borderWidth: 1, borderColor: '#cde8da', borderRadius: 20, backgroundColor: '#fafffc', padding: 16, marginBottom: 22 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: '#d4f2e5' },
  nextContent: { flex: 1, minWidth: 0 },
  routeBadge: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  nextTitle: { marginTop: 3, color: colors.text, fontSize: 15, fontWeight: '900' },
  nextMeta: { marginTop: 3, color: colors.muted, fontSize: 12, fontWeight: '700' },
  startButton: { minWidth: 72, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.accent, paddingHorizontal: 14 },
  disabledButton: { opacity: 0.55 },
  startButtonText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  actionTile: { position: 'relative', width: '48.6%', minHeight: 140, borderRadius: 19, borderWidth: 1, borderColor: '#dfe7e3', backgroundColor: colors.card, padding: 13 },
  actionTilePrimary: { borderColor: colors.accent, backgroundColor: '#35b97b' },
  actionIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#d9f4e7' },
  actionIconPrimary: { backgroundColor: 'rgba(255,255,255,0.18)' },
  actionTextBlock: { flex: 1, justifyContent: 'flex-end', paddingTop: 10, paddingRight: 8 },
  actionTitle: { color: colors.text, fontSize: 15, lineHeight: 19, fontWeight: '900' },
  actionTitlePrimary: { color: colors.white },
  actionSubtitle: { marginTop: 3, color: colors.muted, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  actionSubtitlePrimary: { color: '#d6f8e5' },
  actionArrow: { position: 'absolute', right: 12, top: 23 },
  emptyText: { borderRadius: 15, backgroundColor: '#edf6f2', paddingHorizontal: 14, paddingVertical: 13, color: colors.muted, fontSize: 13, fontWeight: '700' },
  emptyTripButton: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 17, backgroundColor: '#edf6f2', paddingHorizontal: 13, paddingVertical: 12 },
  emptyTripIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#d5f1e3' },
  emptyTripContent: { minWidth: 0, flex: 1 },
  emptyTripTitle: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  emptyTripSubtitle: { marginTop: 3, color: colors.muted, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});
