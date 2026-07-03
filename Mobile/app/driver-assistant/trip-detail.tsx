import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import scheduleOperationsApi from '@/api/scheduleOperations.api';
import { AppButton } from '@/components/AppButton';
import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';
import type { AssignedTrip } from '@/types/scheduleOperations';
import { formatTime, getTripStatus } from '@/utils/scheduleOperations';
import { getErrorMessage } from '@/utils/validation';

function parseTripParam(value: unknown): AssignedTrip | null {
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value) as AssignedTrip;
  } catch {
    return null;
  }
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || 'N/A'}</Text>
    </View>
  );
}

export default function TripDetailScreen() {
  const params = useLocalSearchParams<{ trip?: string; assignmentId?: string }>();
  const user = useAuthStore((state) => state.user);
  const isDriver = user?.role === 'DRIVER';
  const initialTrip = useMemo(() => parseTripParam(params.trip), [params.trip]);
  const [trip, setTrip] = useState<AssignedTrip | null>(initialTrip);
  const [processingAction, setProcessingAction] = useState('');

  const assignmentId = trip?.id || params.assignmentId || '';
  const status = trip ? getTripStatus(trip) : 'UNKNOWN';
  const canStart = isDriver && ['READY', 'CONFIRMED'].includes(status);

  const checkIn = async () => {
    if (!assignmentId) return;
    setProcessingAction('check-in');
    try {
      const updated = await scheduleOperationsApi.acceptAssignedTrip(assignmentId);
      setTrip(updated);
      Alert.alert('Check-in completed', 'Assignment has been confirmed successfully.');
    } catch (error) {
      Alert.alert('Unable to check in', getErrorMessage(error, 'Unable to confirm assignment.'));
    } finally {
      setProcessingAction('');
    }
  };

  const startTrip = async () => {
    if (!assignmentId) return;
    setProcessingAction('start');
    try {
      const updated = await scheduleOperationsApi.startTrip(assignmentId);
      setTrip(updated);
      Alert.alert('Trip started', 'The assigned trip has been started.');
    } catch (error) {
      Alert.alert('Unable to start trip', getErrorMessage(error, 'Unable to start trip.'));
    } finally {
      setProcessingAction('');
    }
  };

  const reportIncident = async () => {
    if (!assignmentId) return;
    setProcessingAction('incident');
    try {
      await scheduleOperationsApi.reportOperationIncident(assignmentId, {
        type: 'OTHER',
        severity: 'LOW',
        description: `Mobile incident report for ${trip?.tripCode || assignmentId}`,
        locationText: trip?.reportLocation || trip?.route?.name || '',
        canContinue: true,
      });
      Alert.alert('Incident reported', 'The operation incident has been sent to dispatch.');
    } catch (error) {
      Alert.alert('Unable to report incident', getErrorMessage(error, 'Unable to report incident.'));
    } finally {
      setProcessingAction('');
    }
  };

  if (!trip) {
    return (
      <View style={styles.screenShell}>
        <Screen>
          <View style={styles.header}>
            <Pressable accessibilityLabel="Back" hitSlop={10} onPress={() => router.back()}>
              <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
            </Pressable>
            <Text style={styles.title}>Trip Detail</Text>
          </View>
          <Text style={styles.emptyText}>Trip data is unavailable. Please open this screen from assigned trips.</Text>
        </Screen>
        <RoleBottomNav active="trips" role={user?.role} />
      </View>
    );
  }

  return (
    <View style={styles.screenShell}>
      <Screen>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" hitSlop={10} onPress={() => router.back()}>
          <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
        </Pressable>
        <View>
          <Text style={styles.kicker}>TRIP DETAILS</Text>
          <Text style={styles.title}>{trip.tripCode || trip.id}</Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.routeNumber}>{trip.route?.routeNumber || 'Route'}</Text>
            <Text style={styles.routeName}>{trip.route?.name || 'Unnamed route'}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{status}</Text>
          </View>
        </View>
        <Text style={styles.directionText}>{trip.route?.origin || 'Origin'} → {trip.route?.destination || 'Destination'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Schedule</Text>
        <View style={styles.detailsGrid}>
          <DetailRow label="Trip ID" value={trip.tripCode || trip.id} />
          <DetailRow label="Direction" value={trip.route?.direction} />
          <DetailRow label="Departure Time" value={formatTime(trip.scheduledStart)} />
          <DetailRow label="Arrival Time" value={formatTime(trip.scheduledEnd)} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vehicle & Crew</Text>
        <View style={styles.detailsGrid}>
          <DetailRow label="Bus Number" value={trip.vehicle?.code || trip.vehicle?.plateNumber} />
          <DetailRow label="Passenger Capacity" value={trip.vehicle?.capacity || 'N/A'} />
          <DetailRow label="Current Occupancy" value="N/A" />
          <DetailRow label="Driver Name" value={trip.driver?.fullName} />
          <DetailRow label="Bus Assistant Name" value={trip.busAssistant?.fullName} />
          <DetailRow label="Inspection Status" value={trip.inspection?.status} />
        </View>
      </View>

      <View style={styles.actions}>
        <AppButton
          title="Check In"
          loading={processingAction === 'check-in'}
          onPress={checkIn}
          variant="secondary"
        />
        {isDriver ? (
          <AppButton
            title="Start Trip"
            disabled={!canStart}
            loading={processingAction === 'start'}
            onPress={startTrip}
          />
        ) : null}
        <AppButton
          title="Report Incident"
          loading={processingAction === 'incident'}
          onPress={reportIncident}
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
  emptyText: { borderRadius: 18, backgroundColor: colors.surfaceLow, padding: 16, color: colors.muted, fontSize: 13, fontWeight: '700' },
  heroCard: { gap: 12, borderRadius: 26, backgroundColor: colors.primary, padding: 20 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  routeNumber: { color: '#aff4d1', fontSize: 13, fontWeight: '900' },
  routeName: { marginTop: 3, color: colors.white, fontSize: 23, fontWeight: '900' },
  statusBadge: { borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  directionText: { color: '#d4f2e5', fontSize: 14, fontWeight: '800' },
  section: { gap: 12, marginTop: 18, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  detailRow: { width: '47%', gap: 4 },
  detailLabel: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  detailValue: { color: colors.text, fontSize: 13, fontWeight: '800' },
  actions: { gap: 12, marginTop: 20, paddingBottom: 96 },
});
