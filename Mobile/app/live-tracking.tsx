import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import passengerApi, { type BusRoute, type LiveBus } from '@/api/passenger.api';
import { EmptyState, LoadingState, PassengerLayout, StatusPill } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';

export default function LiveTrackingScreen() {
  const params = useLocalSearchParams<{ routeId?: string }>();
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState(params.routeId || '');
  const [buses, setBuses] = useState<LiveBus[]>([]);
  const [eta, setEta] = useState<Array<{ stopName: string; estimatedArrivalTime?: string; status?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshedAt, setRefreshedAt] = useState('');

  const loadRoutes = async () => {
    const data = await passengerApi.searchRoutes();
    setRoutes(data.routes || []);
    return data.routes || [];
  };

  const loadLive = async (routeId: string) => {
    setLoading(true);
    setError('');
    try {
      const live = await passengerApi.getLiveTracking(routeId);
      setBuses(live.buses || []);
      setEta(live.stopEtaSummary || []);
      setRefreshedAt(live.refreshedAt || '');
    } catch (err) {
      setError((err as { message?: string })?.message || 'Could not load live tracking.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const loadedRoutes = await loadRoutes();
        const firstRouteId = selectedRouteId || String(loadedRoutes[0]?.id || loadedRoutes[0]?.routeNumber || '');
        setSelectedRouteId(firstRouteId);
        if (firstRouteId) {
          await loadLive(firstRouteId);
        } else {
          setLoading(false);
        }
      } catch (err) {
        setError((err as { message?: string })?.message || 'Could not load routes.');
        setLoading(false);
      }
    };
    void init();
  }, []);

  const selectedRoute = routes.find((route) => String(route.id || route.routeNumber) === selectedRouteId);

  return (
    <PassengerLayout
      active="explore"
      subtitle={selectedRoute?.routeNumber || 'Choose a route to track'}
      title="Live Tracking"
      rightAction={(
        <Pressable accessibilityLabel="Refresh live tracking" onPress={() => selectedRouteId && loadLive(selectedRouteId)} style={styles.iconButton}>
          <MaterialCommunityIcons color={colors.primary} name="refresh" size={20} />
        </Pressable>
      )}
    >
      <View style={styles.routeStrip}>
        {routes.slice(0, 8).map((route) => {
          const routeId = String(route.id || route.routeNumber);
          const active = routeId === selectedRouteId;
          return (
            <Pressable
              key={routeId}
              onPress={() => {
                setSelectedRouteId(routeId);
                void loadLive(routeId);
              }}
              style={[styles.routeChip, active && styles.routeChipActive]}
            >
              <Text style={[styles.routeChipText, active && styles.routeChipTextActive]}>{route.routeNumber}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? <LoadingState label="Loading live buses" /> : null}
      {!loading && error ? <EmptyState icon="alert-circle-outline" title="Live data unavailable" detail={error} /> : null}
      {!loading && !error && !buses.length ? <EmptyState icon="bus-alert" title="No live buses" detail="Try refreshing or choose another route." /> : null}

      {!loading && !error && buses.map((bus) => (
        <View key={bus.busId} style={styles.busCard}>
          <View style={styles.busHeader}>
            <Text style={styles.busId}>{bus.busId}</Text>
            <StatusPill label={bus.status || 'Running'} tone={bus.status === 'Delayed' ? 'warning' : 'success'} />
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(bus.tripProgress?.progressPercent || 0, 100)}%` }]} />
          </View>
          <Text style={styles.busMeta}>Current: {bus.tripProgress?.currentStop || 'Unknown'}</Text>
          <Text style={styles.busMeta}>Next: {bus.nextStop || bus.tripProgress?.nextStop || 'Unknown'} - {bus.estimatedArrivalTime || bus.tripProgress?.estimatedRemainingTime || 'ETA unavailable'}</Text>
        </View>
      ))}

      {eta.length ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Stop ETA</Text>
          {eta.map((item) => (
            <View key={item.stopName} style={styles.etaRow}>
              <Text numberOfLines={1} style={styles.etaStop}>{item.stopName}</Text>
              <Text style={styles.etaTime}>{item.estimatedArrivalTime || item.status || '-'}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {refreshedAt ? <Text style={styles.refreshed}>Updated {new Date(refreshedAt).toLocaleString()}</Text> : null}
    </PassengerLayout>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.card },
  routeStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  routeChip: { borderRadius: 999, backgroundColor: colors.card, paddingHorizontal: 13, paddingVertical: 9 },
  routeChipActive: { backgroundColor: colors.primaryContainer },
  routeChipText: { color: colors.secondary, fontSize: 12, fontWeight: '900' },
  routeChipTextActive: { color: colors.white },
  busCard: { gap: 11, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  busHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  busId: { color: colors.primary, fontSize: 17, fontWeight: '900' },
  progressTrack: { height: 10, overflow: 'hidden', borderRadius: 999, backgroundColor: colors.surfaceHigh },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.accent },
  busMeta: { color: colors.secondary, fontSize: 12, fontWeight: '800' },
  card: { gap: 10, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  cardTitle: { color: colors.primary, fontSize: 17, fontWeight: '900' },
  etaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outline },
  etaStop: { flex: 1, color: colors.primary, fontSize: 13, fontWeight: '800' },
  etaTime: { color: colors.accent, fontSize: 12, fontWeight: '900' },
  refreshed: { color: colors.secondary, fontSize: 11, fontWeight: '700', textAlign: 'center' },
});
