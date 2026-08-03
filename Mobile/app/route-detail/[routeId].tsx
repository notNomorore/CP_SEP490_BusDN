import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import passengerApi, { type BusRoute } from '@/api/passenger.api';
import { EmptyState, LoadingState, PassengerLayout, StatusPill } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

export default function RouteDetailScreen() {
  const { routeId } = useLocalSearchParams<{ routeId: string }>();
  const [route, setRoute] = useState<BusRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!routeId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        setRoute(await passengerApi.getRouteDetail(routeId));
      } catch (err) {
        setError((err as { message?: string })?.message || 'Could not load route detail.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [routeId]);

  return (
    <PassengerLayout active="explore" subtitle={route?.routeNumber || 'Route details'} title="Route Details">
      {loading ? <LoadingState label="Loading route" /> : null}
      {!loading && error ? <EmptyState icon="alert-circle-outline" title="Could not load route" detail={error} /> : null}
      {!loading && !error && !route ? <EmptyState title="Route not found" /> : null}
      {route ? (
        <>
          <View style={styles.hero}>
            <StatusPill label={route.routeNumber} tone="success" />
            <Text style={styles.name}>{route.name}</Text>
            <Text style={styles.path}>{route.origin} to {route.destination}</Text>
            <View style={styles.metrics}>
              <Metric icon="map-marker-distance" label={`${route.distanceKm || 0} km`} />
              <Metric icon="clock-outline" label={`${route.estimatedDurationMinutes || 0} min`} />
              <Metric icon="cash" label={currency.format(Number(route.fare || 0))} />
            </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable onPress={() => router.push(`/live-tracking?routeId=${encodeURIComponent(String(route.id || route.routeNumber))}`)} style={styles.primaryButton}>
              <MaterialCommunityIcons color={colors.white} name="crosshairs-gps" size={19} />
              <Text style={styles.primaryText}>Track live</Text>
            </Pressable>
            <Pressable onPress={() => router.push(`/buy-oneway-ticket?routeId=${encodeURIComponent(String(route.id || route.routeNumber))}`)} style={styles.secondaryButton}>
              <MaterialCommunityIcons color={colors.primary} name="ticket-outline" size={19} />
              <Text style={styles.secondaryText}>Buy ticket</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Operating hours</Text>
            <Text style={styles.cardText}>
              {route.operatingHours?.firstDeparture || '05:30'} - {route.operatingHours?.lastDeparture || '21:00'} every {route.operatingHours?.frequencyMinutes || 30} minutes
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Stops</Text>
            {(route.stops || []).map((stop) => (
              <View key={`${stop.order}-${stop.name}`} style={styles.stopRow}>
                <View style={styles.stopDot}><Text style={styles.stopOrder}>{stop.order}</Text></View>
                <View style={styles.stopCopy}>
                  <Text style={styles.stopName}>{stop.name}</Text>
                  <Text style={styles.stopMeta}>{stop.estimatedOffsetMinutes || 0} min from start</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </PassengerLayout>
  );
}

function Metric({ icon, label }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string }) {
  return (
    <View style={styles.metric}>
      <MaterialCommunityIcons color={colors.primary} name={icon} size={18} />
      <Text style={styles.metricText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 11, borderRadius: 24, backgroundColor: colors.primaryContainer, padding: 18 },
  name: { color: colors.white, fontSize: 26, lineHeight: 31, fontWeight: '900' },
  path: { color: '#bfead5', fontSize: 13, fontWeight: '800' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, backgroundColor: '#d8f6e7', paddingHorizontal: 10, paddingVertical: 8 },
  metricText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  actionRow: { flexDirection: 'row', gap: 10 },
  primaryButton: { flex: 1, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 25, backgroundColor: colors.primaryContainer },
  secondaryButton: { flex: 1, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 25, backgroundColor: '#d8f6e7' },
  primaryText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  secondaryText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  card: { gap: 12, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  cardTitle: { color: colors.primary, fontSize: 17, fontWeight: '900' },
  cardText: { color: colors.secondary, fontSize: 13, fontWeight: '700' },
  stopRow: { flexDirection: 'row', gap: 11 },
  stopDot: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#d8f6e7' },
  stopOrder: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  stopCopy: { flex: 1, paddingBottom: 12 },
  stopName: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  stopMeta: { marginTop: 2, color: colors.secondary, fontSize: 11, fontWeight: '700' },
});
