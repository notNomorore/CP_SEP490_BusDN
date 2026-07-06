import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import passengerApi from '@/api/passenger.api';
import { BottomNav, Chip, InfoCard, PassengerScreen, StateView } from '@/components/PassengerLayout';
import { colors } from '@/constants/colors';
import { getErrorMessage } from '@/utils/validation';

export default function LiveTrackingScreen() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [liveData, setLiveData] = useState<any>(null);
  const [etaData, setEtaData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const routeKey = selectedRoute?.routeNumber || selectedRoute?.id || selectedRoute?._id;
  const buses = useMemo(() => liveData?.buses || liveData?.liveBuses || [], [liveData]);

  const loadRoutes = async () => {
    const data = await passengerApi.searchRoutes();
    const list = data?.routes || [];
    setRoutes(list);
    setSelectedRoute((current: any) => current || list[0] || null);
  };

  const loadTracking = async (showLoader = true) => {
    if (!routeKey) return;
    if (showLoader) setIsLoading(true);
    setError(null);
    try {
      const [live, eta] = await Promise.all([
        passengerApi.getLiveTracking(String(routeKey)),
        passengerApi.getEta(String(routeKey)),
      ]);
      setLiveData(live);
      setEtaData(eta);
    } catch (trackingError) {
      setError(getErrorMessage(trackingError, 'Không thể tải vị trí xe buýt.'));
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRoutes().catch((routeError) => {
      setError(getErrorMessage(routeError, 'Không thể tải danh sách tuyến.'));
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!routeKey) return;
    void loadTracking();
    const timer = setInterval(() => void loadTracking(false), 10000);
    return () => clearInterval(timer);
  }, [routeKey]);

  return (
    <View style={{ flex: 1 }}>
      <PassengerScreen title="Theo dõi xe buýt" onRefresh={() => void loadTracking()} refreshing={isLoading}>
        <View style={styles.chips}>
          {routes.slice(0, 8).map((route) => {
            const key = String(route.routeNumber || route.id || route._id);
            return (
              <Chip
                key={key}
                active={String(routeKey) === key}
                label={route.routeNumber || route.name || key}
                onPress={() => setSelectedRoute(route)}
              />
            );
          })}
        </View>

        <StateView loading={isLoading && !liveData} error={error} empty={!isLoading && !error && buses.length === 0} emptyText="Chưa có xe đang hoạt động trên tuyến này." onRetry={() => void loadTracking()} />

        {selectedRoute ? (
          <InfoCard>
            <Text style={styles.routeNumber}>{selectedRoute.routeNumber}</Text>
            <Text style={styles.routeName}>{selectedRoute.name}</Text>
            <Text style={styles.meta}>Tự động cập nhật mỗi 10 giây</Text>
          </InfoCard>
        ) : null}

        {buses.map((bus: any, index: number) => (
          <InfoCard key={bus.busId || index}>
            <View style={styles.row}>
              <View style={styles.busIcon}>
                <MaterialCommunityIcons color={colors.white} name="bus-marker" size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{bus.busNumber || bus.plateNumber || `Xe ${index + 1}`}</Text>
                <Text style={styles.meta}>{bus.currentStop?.name || bus.nextStop?.name || 'Đang di chuyển trên tuyến'}</Text>
              </View>
              <Text style={styles.status}>{bus.status || 'ĐANG CHẠY'}</Text>
            </View>
            <Text style={styles.meta}>Vĩ độ {bus.latitude || bus.location?.latitude || '-'} • Kinh độ {bus.longitude || bus.location?.longitude || '-'}</Text>
          </InfoCard>
        ))}

        {etaData ? (
          <InfoCard>
            <Text style={styles.title}>Thời gian dự kiến đến</Text>
            <Text style={styles.bigValue}>{etaData.estimatedMinutes ?? etaData.etaMinutes ?? etaData.eta ?? '--'} phút</Text>
            <Text style={styles.meta}>Tiến độ chuyến đi: {etaData.progressPercent ?? liveData?.progressPercent ?? 0}%</Text>
          </InfoCard>
        ) : null}

        <Pressable onPress={() => Alert.alert('Đã bật nhắc nhở', 'Bạn sẽ nhận thông báo xe đến, trễ chuyến và thay đổi tuyến trong mục Thông báo.')} style={styles.button}>
          <Text style={styles.buttonText}>Nhận thông báo</Text>
        </Pressable>
      </PassengerScreen>
      <BottomNav active="routes" />
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  routeNumber: { color: colors.accent, fontSize: 12, fontWeight: '900' },
  routeName: { marginTop: 5, color: colors.primary, fontSize: 18, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  busIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.primaryContainer },
  title: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  meta: { marginTop: 5, color: colors.muted, fontSize: 12, fontWeight: '600' },
  status: { color: '#17503a', fontSize: 10, fontWeight: '900' },
  bigValue: { marginTop: 6, color: colors.primary, fontSize: 28, fontWeight: '900' },
  button: { height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 25, backgroundColor: colors.primaryContainer },
  buttonText: { color: colors.white, fontWeight: '900' },
});
