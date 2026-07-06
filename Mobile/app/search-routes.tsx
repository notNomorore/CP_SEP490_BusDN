import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import passengerApi from '@/api/passenger.api';
import { BottomNav, Chip, InfoCard, PassengerScreen, StateView } from '@/components/PassengerLayout';
import { colors } from '@/constants/colors';
import { getErrorMessage } from '@/utils/validation';

export default function SearchRoutesScreen() {
  const [keyword, setKeyword] = useState('');
  const [routes, setRoutes] = useState<any[]>([]);
  const [nearbyStops, setNearbyStops] = useState<any[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (nextKeyword = keyword) => {
    setLoading(true);
    setError(null);
    try {
      const data = await passengerApi.searchRoutes({ q: nextKeyword.trim() });
      setRoutes(data?.routes || []);
      if (nextKeyword.trim()) {
        setRecent((items) => [nextKeyword.trim(), ...items.filter((item) => item !== nextKeyword.trim())].slice(0, 5));
      }
    } catch (searchError) {
      setError(getErrorMessage(searchError, 'Không thể tìm tuyến xe.'));
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => {
    void search('');
  }, []);

  const searchNearby = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await passengerApi.searchNearbyRoutes({ latitude: 16.0667, longitude: 108.2245, radiusKm: 5 });
      setNearbyStops(data?.nearbyStops || []);
      setRoutes(data?.routes || []);
    } catch (nearbyError) {
      setError(getErrorMessage(nearbyError, 'Không thể tải trạm gần bạn.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <PassengerScreen title="Tìm tuyến xe">
        <View style={styles.searchBox}>
          <TextInput
            onChangeText={setKeyword}
            onSubmitEditing={() => void search()}
            placeholder="Mã tuyến, trạm hoặc điểm đến"
            placeholderTextColor="#65766f"
            style={styles.input}
            value={keyword}
          />
          <Pressable onPress={() => void search()} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Tìm kiếm</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          <Chip label="Mã tuyến" active />
          <Chip label="Trạm dừng" />
          <Chip label="Điểm đến" />
          <Chip label="Dùng vị trí hiện tại" onPress={() => void searchNearby()} />
        </ScrollView>

        {recent.length ? (
          <View style={styles.recent}>
            <Text style={styles.sectionTitle}>Tìm kiếm gần đây</Text>
            <View style={styles.recentRow}>
              {recent.map((item) => <Chip key={item} label={item} onPress={() => { setKeyword(item); void search(item); }} />)}
            </View>
          </View>
        ) : null}

        <StateView loading={loading} error={error} empty={!loading && !error && routes.length === 0} emptyText="Không tìm thấy tuyến phù hợp." onRetry={() => void search()} />

        {nearbyStops.length ? (
          <>
            <Text style={styles.sectionTitle}>Trạm gần bạn</Text>
            {nearbyStops.map((stop) => (
              <InfoCard key={`${stop.route?.routeNumber}-${stop.stopId || stop.name}`}>
                <Text style={styles.cardTitle}>{stop.name}</Text>
                <Text style={styles.cardMeta}>Cách {stop.distanceKm} km • Tuyến {stop.route?.routeNumber}</Text>
              </InfoCard>
            ))}
          </>
        ) : null}

        {routes.map((route) => (
          <InfoCard key={String(route.id || route._id || route.routeNumber)} onPress={() => router.push({ pathname: '/route-detail/[routeId]', params: { routeId: String(route.id || route._id || route.routeNumber) } } as any)}>
            <View style={styles.cardTop}>
              <Text style={styles.routeNumber}>{route.routeNumber}</Text>
              <Text style={styles.badge}>{route.fare ? `${route.fare.toLocaleString('vi-VN')} VND` : 'Chưa có giá'}</Text>
            </View>
            <Text style={styles.cardTitle}>{route.name}</Text>
            <Text style={styles.cardMeta}>{route.origin} → {route.destination}</Text>
            <Text style={styles.cardMeta}>{route.estimatedDurationMinutes || 0} phút • {route.distanceKm || 0} km</Text>
            <View style={styles.actions}>
              <Pressable onPress={() => router.push('/plan-trip' as any)}><Text style={styles.link}>Lên lộ trình</Text></Pressable>
              <Pressable onPress={() => Alert.alert('Tuyến yêu thích', 'Tính năng lưu tuyến yêu thích sẽ dùng API hồ sơ người dùng.')}><Text style={styles.link}>Lưu</Text></Pressable>
            </View>
          </InfoCard>
        ))}
      </PassengerScreen>
      <BottomNav active="routes" />
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  input: { flex: 1, minHeight: 48, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.card, color: colors.text, fontWeight: '700' },
  primaryButton: { minWidth: 86, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.primaryContainer },
  primaryText: { color: colors.white, fontWeight: '900' },
  chips: { marginBottom: 14 },
  recent: { marginBottom: 12 },
  recentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionTitle: { marginBottom: 10, color: colors.primary, fontSize: 16, fontWeight: '900' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routeNumber: { color: colors.accent, fontSize: 18, fontWeight: '900' },
  badge: { overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 13, backgroundColor: '#b5efd1', color: '#17503a', fontSize: 10, fontWeight: '900' },
  cardTitle: { marginTop: 5, color: colors.primary, fontSize: 16, fontWeight: '900' },
  cardMeta: { marginTop: 4, color: colors.muted, fontSize: 12, fontWeight: '600' },
  actions: { marginTop: 12, flexDirection: 'row', gap: 18 },
  link: { color: colors.accent, fontSize: 12, fontWeight: '900' },
});
