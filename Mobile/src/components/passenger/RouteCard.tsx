import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BusRoute } from '@/api/passenger.api';
import { StatusPill } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

export function RouteCard({ route, compact = false }: { route: BusRoute; compact?: boolean }) {
  const routeId = String(route.id || route._id || route.routeNumber);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/route-detail/[routeId]', params: { routeId } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.topLine}>
        <StatusPill label={route.routeNumber || 'Route'} tone="success" />
        <Text style={styles.fare}>{currency.format(Number(route.fare || 0))}</Text>
      </View>
      <Text numberOfLines={2} style={styles.name}>{route.name || `${route.origin} - ${route.destination}`}</Text>
      <View style={styles.row}>
        <MaterialCommunityIcons color={colors.secondary} name="map-marker-outline" size={16} />
        <Text numberOfLines={1} style={styles.meta}>{route.origin || 'Origin'} to {route.destination || 'Destination'}</Text>
      </View>
      {!compact ? (
        <View style={styles.metrics}>
          <Text style={styles.metric}>{route.distanceKm || 0} km</Text>
          <Text style={styles.metric}>{route.estimatedDurationMinutes || 0} min</Text>
          <Text style={styles.metric}>Every {route.operatingHours?.frequencyMinutes || 30} min</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  fare: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  name: { color: colors.primary, fontSize: 17, lineHeight: 22, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  meta: { flex: 1, color: colors.secondary, fontSize: 12, fontWeight: '700' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { overflow: 'hidden', borderRadius: 10, backgroundColor: colors.surfaceLow, paddingHorizontal: 9, paddingVertical: 6, color: colors.muted, fontSize: 11, fontWeight: '800' },
});
