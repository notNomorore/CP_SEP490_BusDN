import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import passengerApi, { type BusRoute } from '@/api/passenger.api';
import { AppButton } from '@/components/AppButton';
import { EmptyState, LoadingState, PassengerLayout } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';

const currentMonth = () => {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
};

const passTypes = ['STANDARD', 'STUDENT', 'PRIORITY'];

export default function BuyMonthlyPassScreen() {
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [routeId, setRouteId] = useState('');
  const [passType, setPassType] = useState('STANDARD');
  const [startDate, setStartDate] = useState(currentMonth());
  const [validityMonths, setValidityMonths] = useState('1');
  const [promotionCode, setPromotionCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await passengerApi.searchRoutes();
        setRoutes(data.routes || []);
      } catch (err) {
        setError((err as { message?: string })?.message || 'Could not load routes.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const submit = async () => {
    setSubmitting(true);
    try {
      const payment = await passengerApi.createPayment({
        ticketType: 'MONTHLY_PASS',
        passType,
        routeId: routeId || undefined,
        routeCode: routeId ? undefined : 'ALL',
        startDate,
        validityMonths: Number(validityMonths) || 1,
        promotionCode: promotionCode.trim() || undefined,
      });
      Alert.alert('Payment created', payment.message || `Order ${payment.orderCode || ''} is ${payment.status || 'PENDING'}.`);
      if (payment.checkoutUrl) {
        await Linking.openURL(payment.checkoutUrl);
      }
    } catch (err) {
      Alert.alert('Purchase failed', (err as { message?: string })?.message || 'Could not create monthly pass payment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PassengerLayout active="tickets" subtitle="Route-specific or all-route pass" title="Buy Monthly Pass">
      {loading ? <LoadingState label="Loading routes" /> : null}
      {!loading && error ? <EmptyState icon="alert-circle-outline" title="Could not load routes" detail={error} /> : null}
      {!loading && !error ? (
        <>
          <Text style={styles.label}>Pass type</Text>
          <View style={styles.chipWrap}>
            {passTypes.map((type) => {
              const active = type === passType;
              return (
                <Pressable key={type} onPress={() => setPassType(type)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{type}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Route scope</Text>
          <View style={styles.chipWrap}>
            <Pressable onPress={() => setRouteId('')} style={[styles.chip, !routeId && styles.chipActive]}>
              <Text style={[styles.chipText, !routeId && styles.chipTextActive]}>ALL</Text>
            </Pressable>
            {routes.slice(0, 10).map((route) => {
              const id = String(route.id || route.routeNumber);
              const active = id === routeId;
              return (
                <Pressable key={id} onPress={() => setRouteId(id)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{route.routeNumber}</Text>
                </Pressable>
              );
            })}
          </View>

          <Field label="Start date" value={startDate} onChangeText={setStartDate} />
          <Field label="Validity months" value={validityMonths} onChangeText={setValidityMonths} keyboardType="number-pad" />
          <Field label="Promotion code" value={promotionCode} onChangeText={setPromotionCode} placeholder="Optional" />
          <View style={styles.note}>
            <Text style={styles.noteText}>Payment status stays pending until PayOS confirms the order. Paid passes will appear in My Tickets.</Text>
          </View>
          <AppButton disabled={submitting} loading={submitting} onPress={submit} title="Create payment" />
        </>
      ) : null}
    </PassengerLayout>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; keyboardType?: 'default' | 'number-pad' }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput keyboardType={keyboardType} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.secondary} style={styles.input} value={value} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, backgroundColor: colors.card, paddingHorizontal: 13, paddingVertical: 9 },
  chipActive: { backgroundColor: colors.primaryContainer },
  chipText: { color: colors.secondary, fontSize: 12, fontWeight: '900' },
  chipTextActive: { color: colors.white },
  field: { gap: 8 },
  input: { minHeight: 52, borderRadius: 18, backgroundColor: colors.card, paddingHorizontal: 14, color: colors.text, fontSize: 14, fontWeight: '800' },
  note: { borderRadius: 18, backgroundColor: '#d8f6e7', padding: 14 },
  noteText: { color: colors.primary, fontSize: 12, lineHeight: 18, fontWeight: '800' },
});
