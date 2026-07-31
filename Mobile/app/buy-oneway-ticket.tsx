import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import passengerApi, { type BusRoute } from '@/api/passenger.api';
import { AppButton } from '@/components/AppButton';
import { EmptyState, LoadingState, PassengerLayout } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
};

export default function BuyOneWayTicketScreen() {
  const params = useLocalSearchParams<{ routeId?: string }>();
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [routeId, setRouteId] = useState(params.routeId || '');
  const [fromStop, setFromStop] = useState('');
  const [toStop, setToStop] = useState('');
  const [serviceDate, setServiceDate] = useState(tomorrow());
  const [departureTime, setDepartureTime] = useState('08:00');
  const [promotionCode, setPromotionCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await passengerApi.searchRoutes();
        const list = data.routes || [];
        setRoutes(list);
        const initialRouteId = routeId || String(list[0]?.id || list[0]?.routeNumber || '');
        setRouteId(initialRouteId);
        const selected = list.find((route) => String(route.id || route.routeNumber) === initialRouteId) || list[0];
        setFromStop(selected?.stops?.[0]?.name || selected?.origin || '');
        setToStop(selected?.stops?.[selected.stops.length - 1]?.name || selected?.destination || '');
      } catch (err) {
        setError((err as { message?: string })?.message || 'Could not load routes.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const selectedRoute = useMemo(() => routes.find((route) => String(route.id || route.routeNumber) === routeId), [routes, routeId]);
  const stops = selectedRoute?.stops || [];

  const chooseRoute = (nextRoute: BusRoute) => {
    setRouteId(String(nextRoute.id || nextRoute.routeNumber));
    setFromStop(nextRoute.stops?.[0]?.name || nextRoute.origin || '');
    setToStop(nextRoute.stops?.[nextRoute.stops.length - 1]?.name || nextRoute.destination || '');
  };

  const submit = async () => {
    if (!routeId || !fromStop || !toStop) {
      Alert.alert('Missing trip information', 'Choose a route, departure stop, and destination stop.');
      return;
    }
    setSubmitting(true);
    try {
      const payment = await passengerApi.createPayment({
        ticketType: 'ONE_WAY',
        routeId,
        departureLocation: fromStop,
        destinationLocation: toStop,
        serviceDate,
        departureTime,
        passengerType: 'STANDARD',
        promotionCode: promotionCode.trim() || undefined,
      });
      Alert.alert('Payment created', payment.message || `Order ${payment.orderCode || ''} is ${payment.status || 'PENDING'}.`);
      if (payment.checkoutUrl) {
        await Linking.openURL(payment.checkoutUrl);
      }
    } catch (err) {
      Alert.alert('Purchase failed', (err as { message?: string })?.message || 'Could not create payment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PassengerLayout active="tickets" subtitle="Create a PayOS order for a bus ride" title="Buy One-way Ticket">
      {loading ? <LoadingState label="Loading routes" /> : null}
      {!loading && error ? <EmptyState icon="alert-circle-outline" title="Could not load routes" detail={error} /> : null}
      {!loading && !error ? (
        <>
          <Text style={styles.label}>Route</Text>
          <View style={styles.routeGrid}>
            {routes.slice(0, 12).map((route) => {
              const active = String(route.id || route.routeNumber) === routeId;
              return (
                <Pressable key={String(route.id || route.routeNumber)} onPress={() => chooseRoute(route)} style={[styles.routeChip, active && styles.routeChipActive]}>
                  <Text style={[styles.routeText, active && styles.routeTextActive]}>{route.routeNumber}</Text>
                </Pressable>
              );
            })}
          </View>
          <StopPicker label="Departure stop" selected={fromStop} stops={stops.map((stop) => stop.name)} onSelect={setFromStop} />
          <StopPicker label="Destination stop" selected={toStop} stops={stops.map((stop) => stop.name)} onSelect={setToStop} />
          <Field label="Service date" value={serviceDate} onChangeText={setServiceDate} />
          <Field label="Departure time" value={departureTime} onChangeText={setDepartureTime} />
          <Field label="Promotion code" value={promotionCode} onChangeText={setPromotionCode} placeholder="Optional" />
          <View style={styles.summary}>
            <MaterialCommunityIcons color={colors.primary} name="cash" size={20} />
            <Text style={styles.summaryText}>Estimated base fare: {Number(selectedRoute?.fare || 0).toLocaleString('vi-VN')} VND</Text>
          </View>
          <AppButton disabled={submitting} loading={submitting} onPress={submit} title="Create payment" />
        </>
      ) : null}
    </PassengerLayout>
  );
}

function Field({ label, value, onChangeText, placeholder }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.secondary} style={styles.input} value={value} />
    </View>
  );
}

function StopPicker({ label, selected, stops, onSelect }: { label: string; selected: string; stops: string[]; onSelect: (value: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stopWrap}>
        {stops.map((stop) => {
          const active = stop === selected;
          return (
            <Pressable key={stop} onPress={() => onSelect(stop)} style={[styles.stopChip, active && styles.stopChipActive]}>
              <Text numberOfLines={1} style={[styles.stopText, active && styles.stopTextActive]}>{stop}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  routeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  routeChip: { borderRadius: 999, backgroundColor: colors.card, paddingHorizontal: 13, paddingVertical: 9 },
  routeChipActive: { backgroundColor: colors.primaryContainer },
  routeText: { color: colors.secondary, fontSize: 12, fontWeight: '900' },
  routeTextActive: { color: colors.white },
  field: { gap: 8 },
  input: { minHeight: 52, borderRadius: 18, backgroundColor: colors.card, paddingHorizontal: 14, color: colors.text, fontSize: 14, fontWeight: '800' },
  stopWrap: { gap: 8 },
  stopChip: { borderRadius: 18, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 11 },
  stopChipActive: { backgroundColor: '#d8f6e7' },
  stopText: { color: colors.secondary, fontSize: 12, fontWeight: '800' },
  stopTextActive: { color: colors.primary },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 18, backgroundColor: '#d8f6e7', padding: 14 },
  summaryText: { flex: 1, color: colors.primary, fontSize: 13, fontWeight: '900' },
});
