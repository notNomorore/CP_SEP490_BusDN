import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import passengerApi from '@/api/passenger.api';
import { BottomNav, InfoCard, PassengerScreen, StateView } from '@/components/PassengerLayout';
import { colors } from '@/constants/colors';
import { useApiResource } from '@/hooks/useApiResource';
import { formatCurrency, formatDate } from '@/utils/format';

export default function TravelHistoryScreen() {
  const { data, isLoading, isRefreshing, error, refresh, reload } = useApiResource<any[]>(() => passengerApi.getTravelHistory(), []);
  const [limit, setLimit] = useState(10);
  const history = useMemo(() => (data || []).slice(0, limit), [data, limit]);

  return (
    <View style={{ flex: 1 }}>
      <PassengerScreen title="Lịch sử di chuyển" onRefresh={refresh} refreshing={isRefreshing}>
        <StateView loading={isLoading} error={error} empty={!isLoading && history.length === 0} emptyText="Chưa có lịch sử di chuyển." onRetry={reload} />
        {history.map((trip: any, index: number) => (
          <InfoCard key={trip.id || trip._id || index}>
            <Text style={styles.route}>{trip.routeCode || trip.routeNumber || trip.routeName || 'Chuyến xe buýt'}</Text>
            <Text style={styles.title}>{trip.departureLocation || trip.from || trip.startStop} đến {trip.destinationLocation || trip.to || trip.endStop}</Text>
            <Text style={styles.meta}>{formatDate(trip.travelDate || trip.date || trip.createdAt)} • {formatCurrency(trip.fare || trip.amount || trip.price)}</Text>
            <Text style={styles.meta}>{trip.status || 'Đã hoàn thành'}</Text>
          </InfoCard>
        ))}
        {(data || []).length > limit ? (
          <Pressable onPress={() => setLimit((current) => current + 10)} style={styles.button}>
            <Text style={styles.buttonText}>Tải thêm chuyến cũ</Text>
          </Pressable>
        ) : null}
      </PassengerScreen>
      <BottomNav active="profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  route: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  title: { marginTop: 6, color: colors.primary, fontSize: 15, fontWeight: '900' },
  meta: { marginTop: 6, color: colors.muted, fontSize: 12, fontWeight: '600' },
  button: { height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.primaryContainer },
  buttonText: { color: colors.white, fontWeight: '900' },
});
