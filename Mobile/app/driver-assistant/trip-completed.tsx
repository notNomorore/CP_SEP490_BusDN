import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/colors';
import { useDriverI18n } from '@/i18n/driver';
import { useAuthStore } from '@/store/auth.store';
import type { AssignedTrip } from '@/types/scheduleOperations';
import { goBackOrReplace } from '@/utils/navigation';
import { formatTime, getTripServiceDateLabel } from '@/utils/scheduleOperations';

function parseTripParam(value: unknown): AssignedTrip | null {
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value) as AssignedTrip;
  } catch {
    return null;
  }
}

function InfoTile({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.infoTile}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || 'N/A'}</Text>
    </View>
  );
}

export default function TripCompletedScreen() {
  const { t } = useDriverI18n();
  const params = useLocalSearchParams<{ trip?: string; assignmentId?: string }>();
  const user = useAuthStore((state) => state.user);
  const trip = useMemo(() => parseTripParam(params.trip), [params.trip]);
  const assignmentId = trip?.id || params.assignmentId || '';
  const startedAt = trip?.actualStartAt || trip?.scheduledStart || null;
  const endedAt = trip?.actualEndAt || null;

  const openDetail = () => {
    router.replace({
      pathname: '/driver-assistant/trip-detail',
      params: { assignmentId, trip: trip ? JSON.stringify(trip) : '' },
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
            <Text style={styles.kicker}>{t.completedTrip.kicker}</Text>
            <Text style={styles.title}>{t.completedTrip.title}</Text>
          </View>
        </View>

        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <MaterialCommunityIcons color={colors.white} name="check-bold" size={38} />
          </View>
          <Text style={styles.successTitle}>{t.completedTrip.successTitle}</Text>
          <Text style={styles.successText}>
            {trip?.tripCode || assignmentId || t.completedTrip.assignedTrip} {t.completedTrip.successText}
          </Text>
        </View>

        <View style={styles.tripCard}>
          <Text style={styles.tripCode}>{trip?.tripCode || assignmentId || t.completedTrip.assignedTrip}</Text>
          <Text style={styles.routeName}>{trip?.route?.name || t.common.unknownRoute}</Text>

          <View style={styles.infoGrid}>
            <InfoTile label={t.completedTrip.serviceDate} value={getTripServiceDateLabel(trip)} />
            <InfoTile label={t.common.status} value={t.common.complete} />
            <InfoTile label={t.trips.startedAt} value={formatTime(startedAt)} />
            <InfoTile label={t.trips.endedAt} value={formatTime(endedAt)} />
            <InfoTile label={t.common.vehicle} value={trip?.vehicle?.code || trip?.vehicle?.plateNumber || t.common.notAvailable} />
            <InfoTile label={t.common.route} value={trip?.route?.routeNumber || trip?.route?.id || t.common.notAvailable} />
          </View>
        </View>

        <View style={styles.actions}>
          <AppButton title={t.trips.details} onPress={openDetail} />
          <AppButton
            title={t.completedTrip.backToTrips}
            onPress={() => router.replace('/driver-assistant/assigned-trips')}
            variant="secondary"
          />
        </View>
      </Screen>
      <RoleBottomNav active="trips" role={user?.role} />
    </View>
  );
}

const styles = StyleSheet.create({
  screenShell: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  kicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.primary, fontSize: 25, fontWeight: '900' },
  successCard: {
    alignItems: 'center',
    gap: 12,
    borderRadius: 24,
    backgroundColor: colors.primary,
    padding: 24,
  },
  successIcon: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 38,
    backgroundColor: colors.accent,
  },
  successTitle: { color: colors.white, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  successText: { color: '#d4f2e5', fontSize: 14, fontWeight: '700', lineHeight: 20, textAlign: 'center' },
  tripCard: { gap: 14, marginTop: 18, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  tripCode: { color: colors.primary, fontSize: 20, fontWeight: '900' },
  routeName: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  infoTile: { width: '47%', gap: 5, borderRadius: 16, backgroundColor: colors.surfaceLow, padding: 12 },
  infoLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  infoValue: { color: colors.text, fontSize: 14, fontWeight: '900' },
  actions: { gap: 10, marginTop: 18, paddingBottom: 96 },
});
