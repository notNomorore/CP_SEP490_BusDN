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
import {
  formatTime,
  getAssignedTripsRange,
  getTripStatus,
  isTripCompleted,
  isTripDelayed,
  isTripToday,
  isTripUpcoming,
} from '@/utils/scheduleOperations';
import { getErrorMessage } from '@/utils/validation';

type FilterKey = 'ALL' | 'TODAY' | 'UPCOMING' | 'COMPLETED' | 'DELAYED';

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'TODAY', label: 'Today' },
  { key: 'UPCOMING', label: 'Upcoming' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'DELAYED', label: 'Delayed' },
];

const matchesFilter = (trip: AssignedTrip, filter: FilterKey) => {
  if (filter === 'ALL') return true;
  if (filter === 'TODAY') return isTripToday(trip);
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

export default function AssignedTripsScreen() {
  const user = useAuthStore((state) => state.user);
  const isDriver = user?.role === 'DRIVER';
  const [trips, setTrips] = useState<AssignedTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState('');
  const [rejectingTrip, setRejectingTrip] = useState<AssignedTrip | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('ALL');

  const loadTrips = useCallback(async () => {
    setIsLoading(true);
    try {
      const payload = await scheduleOperationsApi.getAssignedTrips(getAssignedTripsRange());
      setTrips(payload.trips || []);
    } catch (error) {
      Alert.alert('Unable to load assigned trips', getErrorMessage(error, 'Unable to load assigned trips.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips]);

  const filteredTrips = useMemo(() => (
    trips.filter((trip) => matchesFilter(trip, activeFilter) && matchesSearch(trip, search))
  ), [activeFilter, search, trips]);

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
      Alert.alert('Đã tiếp nhận chuyến', 'Chuyến được phân công đã được tiếp nhận.');
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

  return (
    <View style={styles.screenShell}>
      <Screen>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" hitSlop={10} onPress={() => goBackOrReplace('/driver-assistant')}>
          <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
        </Pressable>
        <View>
          <Text style={styles.kicker}>SCHEDULE & ASSIGNMENT</Text>
          <Text style={styles.title}>Assigned Trips</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <MaterialCommunityIcons color={colors.muted} name="magnify" size={22} />
        <TextInput
          accessibilityLabel="Search assigned trips"
          onChangeText={setSearch}
          placeholder="Search route, trip ID, bus number"
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
          Showing {filteredTrips.length} of {trips.length} assigned trips
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
            <Text style={styles.emptyText}>No assigned trips match this filter.</Text>
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
                  <InfoLine label="Departure" value={formatTime(trip.scheduledStart)} />
                  <InfoLine label="Arrival" value={formatTime(trip.scheduledEnd)} />
                  {trip.actualStartAt ? <InfoLine label="Started" value={formatTime(trip.actualStartAt)} /> : null}
                  {trip.actualEndAt ? <InfoLine label="Ended" value={formatTime(trip.actualEndAt)} /> : null}
                  <InfoLine label="Bus Number" value={trip.vehicle?.code || trip.vehicle?.plateNumber} />
                  <InfoLine label="Driver" value={trip.driver?.fullName} />
                  <InfoLine label="Bus Assistant" value={trip.busAssistant?.fullName} />
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
                      title={isVehicleReady ? 'Start Trip' : 'Kiem tra xe'}
                      loading={processingId === trip.id}
                      onPress={() => (isVehicleReady ? openLifecycle(trip) : openInspection(trip))}
                      style={styles.actionButton}
                    />
                  ) : null}
                </View>
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
            <Text style={styles.modalTitle}>Từ chối chuyến</Text>
            <Text style={styles.modalHint}>
              Nhập lý do để điều hành xử lý hoặc phân công lại chuyến.
            </Text>
            <TextInput
              multiline
              onChangeText={setRejectionReason}
              placeholder="Lý do từ chối"
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
