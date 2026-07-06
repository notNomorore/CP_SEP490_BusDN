import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import passengerApi from '@/api/passenger.api';
import { BottomNav, InfoCard, PassengerScreen, StateView } from '@/components/PassengerLayout';
import { colors } from '@/constants/colors';
import useApiResource from '@/hooks/useApiResource';
import { formatCurrency } from '@/utils/format';

export default function RouteDetailScreen() {
  const { routeId } = useLocalSearchParams<{ routeId: string }>();
  const loader = useCallback(() => passengerApi.getRouteDetail(String(routeId || '')), [routeId]);
  const { data: route, isLoading, isRefreshing, error, refresh, reload } = useApiResource(loader, 'Không thể tải chi tiết tuyến.');

  return (
    <View style={{ flex: 1 }}>
      <PassengerScreen title="Chi tiết tuyến" refreshing={isRefreshing} onRefresh={refresh}>
        <StateView loading={isLoading} error={error} empty={!isLoading && !error && !route} emptyText="Không tìm thấy tuyến." onRetry={reload} />
        {route ? (
          <>
            <InfoCard>
              <Text style={styles.number}>{route.routeNumber}</Text>
              <Text style={styles.title}>{route.name}</Text>
              <Text style={styles.meta}>{route.origin} → {route.destination}</Text>
              <Text style={styles.meta}>{route.estimatedDurationMinutes} phút • {route.distanceKm} km • {formatCurrency(route.fare)}</Text>
            </InfoCard>
            <InfoCard>
              <Text style={styles.sectionTitle}>Lịch chạy</Text>
              <Text style={styles.meta}>Chuyến đầu: {route.operatingHours?.firstDeparture || 'Chưa có'}</Text>
              <Text style={styles.meta}>Chuyến cuối: {route.operatingHours?.lastDeparture || 'Chưa có'}</Text>
              <Text style={styles.meta}>Tần suất: mỗi {route.operatingHours?.frequencyMinutes || 0} phút</Text>
            </InfoCard>
            <InfoCard>
              <Text style={styles.sectionTitle}>Trạm dừng</Text>
              {(route.stops || []).map((stop: any) => (
                <View key={`${stop.order}-${stop.name}`} style={styles.stopRow}>
                  <Text style={styles.stopOrder}>{stop.order}</Text>
                  <Text style={styles.stopName}>{stop.name}</Text>
                  <Text style={styles.stopEta}>{stop.estimatedOffsetMinutes} phút</Text>
                </View>
              ))}
            </InfoCard>
            <Pressable onPress={() => router.push({ pathname: '/buy-oneway-ticket', params: { routeId: String(route.id || route._id || route.routeNumber) } } as any)} style={styles.button}>
              <Text style={styles.buttonText}>Mua vé</Text>
            </Pressable>
          </>
        ) : null}
      </PassengerScreen>
      <BottomNav active="routes" />
    </View>
  );
}

const styles = StyleSheet.create({
  number: { color: colors.accent, fontSize: 20, fontWeight: '900' },
  title: { marginTop: 6, color: colors.primary, fontSize: 18, fontWeight: '900' },
  meta: { marginTop: 5, color: colors.muted, fontSize: 12, fontWeight: '600' },
  sectionTitle: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  stopOrder: { width: 26, height: 26, borderRadius: 13, textAlign: 'center', lineHeight: 26, overflow: 'hidden', backgroundColor: '#b5efd1', color: '#17503a', fontWeight: '900' },
  stopName: { flex: 1, color: colors.text, fontWeight: '800' },
  stopEta: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  button: { height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.primaryContainer },
  buttonText: { color: colors.white, fontWeight: '900' },
});
