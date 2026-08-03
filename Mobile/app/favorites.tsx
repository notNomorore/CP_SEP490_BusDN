import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import passengerApi, { type FavoriteRouteRecord, type FavoriteStopRecord } from '@/api/passenger.api';
import { EmptyState, PassengerLayout } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';

export default function FavoritesScreen() {
  const [routes, setRoutes] = useState<FavoriteRouteRecord[]>([]);
  const [stops, setStops] = useState<FavoriteStopRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState('');
  const [message, setMessage] = useState('');

  const loadFavorites = useCallback(async (refresh = false) => {
    refresh ? setIsRefreshing(true) : setIsLoading(true);
    setMessage('');
    try {
      const [favoriteRoutes, favoriteStops] = await Promise.all([
        passengerApi.getFavoriteRoutes(),
        passengerApi.getFavoriteStops(),
      ]);
      setRoutes(favoriteRoutes || []);
      setStops(favoriteStops || []);
    } catch {
      setMessage('Không thể tải danh sách yêu thích. Vui lòng thử lại.');
    } finally {
      refresh ? setIsRefreshing(false) : setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  const removeRoute = async (route: FavoriteRouteRecord) => {
    if (!route.routeId) {
      setMessage('Không đủ thông tin để bỏ lưu tuyến này.');
      return;
    }

    setBusyKey(`route-${route.routeId}`);
    setMessage('');
    try {
      await passengerApi.removeFavoriteRoute(route.routeId);
      await loadFavorites();
      setMessage('Đã bỏ lưu tuyến yêu thích.');
    } catch {
      setMessage('Không thể bỏ lưu tuyến. Vui lòng thử lại.');
    } finally {
      setBusyKey('');
    }
  };

  const removeStop = async (stop: FavoriteStopRecord) => {
    if (!stop.stopId) {
      setMessage('Không đủ thông tin để bỏ lưu trạm này.');
      return;
    }

    setBusyKey(`stop-${stop.stopId}`);
    setMessage('');
    try {
      await passengerApi.removeFavoriteStop(stop.stopId);
      await loadFavorites();
      setMessage('Đã bỏ lưu trạm yêu thích.');
    } catch {
      setMessage('Không thể bỏ lưu trạm. Vui lòng thử lại.');
    } finally {
      setBusyKey('');
    }
  };

  return (
    <PassengerLayout
      active="profile"
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadFavorites(true)} tintColor={colors.accent} />}
      subtitle="Các tuyến và trạm bạn đã lưu"
      title="Yêu thích"
    >
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Đang tải danh sách yêu thích</Text>
        </View>
      ) : null}

      {!isLoading && !routes.length && !stops.length ? (
        <EmptyState
          detail="Bấm Lưu tuyến hoặc Lưu trạm ở màn Explore để thêm vào đây."
          icon="heart-outline"
          title="Chưa có mục yêu thích"
        />
      ) : null}

      {!isLoading && routes.length ? (
        <>
          <Text style={styles.sectionTitle}>Tuyến yêu thích</Text>
          {routes.map((route) => {
            const key = route.routeId || route.routeNumber || route.destination || 'route';
            const isBusy = busyKey === `route-${route.routeId}`;
            return (
              <View key={key} style={styles.card}>
                <Pressable
                  onPress={() => router.push({ pathname: '/route-detail/[routeId]', params: { routeId: route.routeId || route.routeNumber || '' } })}
                  style={styles.cardMain}
                >
                  <View style={[styles.iconBox, { backgroundColor: route.color || '#d8f6e7' }]}>
                    <MaterialCommunityIcons color={colors.primary} name="bus" size={22} />
                  </View>
                  <View style={styles.cardCopy}>
                    <Text numberOfLines={1} style={styles.cardTitle}>{route.routeNumber || 'Tuyến BusDN'}</Text>
                    <Text numberOfLines={1} style={styles.cardMeta}>{route.destination || 'Chưa có điểm đến'}</Text>
                  </View>
                  <MaterialCommunityIcons color={colors.outline} name="chevron-right" size={22} />
                </Pressable>
                <Pressable disabled={isBusy} onPress={() => removeRoute(route)} style={styles.removeButton}>
                  {isBusy ? <ActivityIndicator color={colors.error} size="small" /> : <MaterialCommunityIcons color={colors.error} name="heart-off-outline" size={18} />}
                  <Text style={styles.removeText}>Bỏ lưu tuyến</Text>
                </Pressable>
              </View>
            );
          })}
        </>
      ) : null}

      {!isLoading && stops.length ? (
        <>
          <Text style={styles.sectionTitle}>Trạm yêu thích</Text>
          {stops.map((stop) => {
            const key = stop.stopId || `${stop.routeNumber}-${stop.stopName}`;
            const isBusy = busyKey === `stop-${stop.stopId}`;
            return (
              <View key={key} style={styles.card}>
                <Pressable
                  onPress={() => router.push(`/live-tracking?routeId=${encodeURIComponent(String(stop.routeId || stop.routeNumber || ''))}`)}
                  style={styles.cardMain}
                >
                  <View style={styles.iconBox}>
                    <MaterialCommunityIcons color={colors.primary} name="bus-stop" size={22} />
                  </View>
                  <View style={styles.cardCopy}>
                    <Text numberOfLines={1} style={styles.cardTitle}>{stop.stopName || 'Trạm BusDN'}</Text>
                    <Text numberOfLines={1} style={styles.cardMeta}>{stop.routeNumber || 'BUS'} - {stop.nearbyArrivalText || stop.address || 'Theo lịch trình'}</Text>
                  </View>
                  <MaterialCommunityIcons color={colors.outline} name="chevron-right" size={22} />
                </Pressable>
                <Pressable disabled={isBusy} onPress={() => removeStop(stop)} style={styles.removeButton}>
                  {isBusy ? <ActivityIndicator color={colors.error} size="small" /> : <MaterialCommunityIcons color={colors.error} name="heart-off-outline" size={18} />}
                  <Text style={styles.removeText}>Bỏ lưu trạm</Text>
                </Pressable>
              </View>
            );
          })}
        </>
      ) : null}
    </PassengerLayout>
  );
}

const styles = StyleSheet.create({
  message: { color: '#006c49', fontSize: 12, fontWeight: '800' },
  loadingBox: { minHeight: 142, alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 22, backgroundColor: colors.card },
  loadingText: { color: colors.secondary, fontSize: 12, fontWeight: '800' },
  sectionTitle: { marginTop: 8, color: colors.primary, fontSize: 18, fontWeight: '900' },
  card: { gap: 12, borderWidth: 1, borderColor: '#d5e4dd', borderRadius: 22, backgroundColor: colors.card, padding: 14 },
  cardMain: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#d8f6e7' },
  cardCopy: { flex: 1 },
  cardTitle: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  cardMeta: { marginTop: 3, color: colors.secondary, fontSize: 12, fontWeight: '700' },
  removeButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 999, backgroundColor: colors.errorContainer, paddingHorizontal: 12 },
  removeText: { color: colors.error, fontSize: 12, fontWeight: '900' },
});
