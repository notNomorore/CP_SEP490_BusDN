import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import busAssistantApi from '@/api/busAssistant.api';
import scheduleOperationsApi from '@/api/scheduleOperations.api';
import { AppButton } from '@/components/AppButton';
import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';
import type { WalkInTicketResult } from '@/types/busAssistant';
import type { AssignedTrip } from '@/types/scheduleOperations';
import { goBackOrReplace } from '@/utils/navigation';
import { formatTime, getTodayRange, isTripCompleted } from '@/utils/scheduleOperations';
import { getErrorMessage } from '@/utils/validation';

const passengerTypes = ['ADULT', 'STUDENT', 'CHILD', 'SENIOR'];
const paymentMethods = ['CASH', 'QR', 'E_WALLET'];
const ticketTypes = ['SINGLE_RIDE', 'DAY_PASS', 'TRANSFER'];
const money = (value: number | string) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value) || 0);
const objectId = (value?: string | null) => String(value || '');

function OptionRow({ values, active, onChange }: { values: string[]; active: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.optionRow}>
      {values.map((value) => (
        <Pressable key={value} onPress={() => onChange(value)} style={[styles.optionChip, active === value && styles.optionChipActive]}>
          <Text style={[styles.optionText, active === value && styles.optionTextActive]}>{value.replace('_', ' ')}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function WalkInTicketScreen() {
  const user = useAuthStore((state) => state.user);
  const [trips, setTrips] = useState<AssignedTrip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [fromStopId, setFromStopId] = useState('');
  const [toStopId, setToStopId] = useState('');
  const [passengerType, setPassengerType] = useState('ADULT');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [ticketType, setTicketType] = useState('SINGLE_RIDE');
  const [quantity, setQuantity] = useState('1');
  const [amount, setAmount] = useState('7000');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<WalkInTicketResult | null>(null);

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) || trips[0] || null,
    [selectedTripId, trips],
  );
  const stops = selectedTrip?.route?.stops || [];
  const total = Number(amount) || 0;

  const loadTrips = useCallback(async () => {
    try {
      const payload = await scheduleOperationsApi.getAssignedTrips(getTodayRange());
      const usableTrips = (payload.trips || []).filter((trip) => !isTripCompleted(trip));
      setTrips(usableTrips);
      const first = usableTrips[0];
      setSelectedTripId((current) => current || first?.id || '');
      const firstStops = first?.route?.stops || [];
      setFromStopId((current) => current || objectId(firstStops[0]?.stationId || firstStops[0]?.id));
      setToStopId((current) => current || objectId(firstStops[firstStops.length - 1]?.stationId || firstStops[firstStops.length - 1]?.id));
    } catch (error) {
      Alert.alert('Unable to load trips', getErrorMessage(error, 'Unable to load assigned trips.'));
    }
  }, []);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    if (!selectedTrip) return;
    const nextStops = selectedTrip.route?.stops || [];
    setFromStopId(objectId(nextStops[0]?.stationId || nextStops[0]?.id));
    setToStopId(objectId(nextStops[nextStops.length - 1]?.stationId || nextStops[nextStops.length - 1]?.id));
  }, [selectedTrip?.id]);

  const createTicket = async () => {
    if (!selectedTrip?.route?.id || !selectedTrip.tripId || !fromStopId || !toStopId) {
      Alert.alert('Missing trip data', 'The selected trip needs route, trip, and stop IDs before selling a ticket.');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await busAssistantApi.createWalkInTicket({
        routeId: objectId(selectedTrip.route.id),
        tripId: objectId(selectedTrip.tripId),
        fromStopId,
        toStopId,
        passengerType,
        passengerQuantity: Math.max(Number.parseInt(quantity, 10) || 1, 1),
        ticketType,
        paymentMethod,
        amount: total,
      });
      setResult(data);
      setQuantity('1');
      Alert.alert('Ticket created', data.message || 'Walk-in ticket created successfully.');
    } catch (error) {
      Alert.alert('Unable to create ticket', getErrorMessage(error, 'Unable to create walk-in ticket.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.screenShell}>
      <Screen>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back" hitSlop={10} onPress={() => goBackOrReplace('/driver-assistant')}>
            <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
          </Pressable>
          <View>
            <Text style={styles.kicker}>ONBOARD SALES</Text>
            <Text style={styles.title}>Walk-in Ticket</Text>
          </View>
        </View>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Collect from passenger</Text>
          <Text style={styles.totalValue}>{money(total)}</Text>
          <Text style={styles.totalMeta}>{quantity || 1} passenger(s) - {paymentMethod.replace('_', ' ')}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Trip</Text>
          <View style={styles.optionColumn}>
            {trips.length ? trips.map((trip) => (
              <Pressable key={trip.id} onPress={() => setSelectedTripId(trip.id)} style={[styles.tripChip, selectedTrip?.id === trip.id && styles.tripChipActive]}>
                <Text style={[styles.tripTitle, selectedTrip?.id === trip.id && styles.tripTextActive]}>{trip.route?.routeNumber || trip.tripCode || 'Trip'}</Text>
                <Text style={[styles.tripMeta, selectedTrip?.id === trip.id && styles.tripTextActive]}>{formatTime(trip.scheduledStart)} - {trip.vehicle?.code || trip.vehicle?.plateNumber || 'No bus'}</Text>
              </Pressable>
            )) : <Text style={styles.emptyText}>No active assigned trip.</Text>}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Stops</Text>
          <Text style={styles.fieldLabel}>From</Text>
          <View style={styles.optionRow}>
            {stops.slice(0, 6).map((stop) => {
              const id = objectId(stop.stationId || stop.id);
              return (
                <Pressable key={`from-${id || stop.stopName}`} onPress={() => setFromStopId(id)} style={[styles.stopChip, fromStopId === id && styles.optionChipActive]}>
                  <Text numberOfLines={1} style={[styles.optionText, fromStopId === id && styles.optionTextActive]}>{stop.stopName || 'Stop'}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.fieldLabel}>To</Text>
          <View style={styles.optionRow}>
            {stops.slice(-6).map((stop) => {
              const id = objectId(stop.stationId || stop.id);
              return (
                <Pressable key={`to-${id || stop.stopName}`} onPress={() => setToStopId(id)} style={[styles.stopChip, toStopId === id && styles.optionChipActive]}>
                  <Text numberOfLines={1} style={[styles.optionText, toStopId === id && styles.optionTextActive]}>{stop.stopName || 'Stop'}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Ticket details</Text>
          <Text style={styles.fieldLabel}>Passenger type</Text>
          <OptionRow values={passengerTypes} active={passengerType} onChange={setPassengerType} />
          <Text style={styles.fieldLabel}>Ticket type</Text>
          <OptionRow values={ticketTypes} active={ticketType} onChange={setTicketType} />
          <Text style={styles.fieldLabel}>Payment</Text>
          <OptionRow values={paymentMethods} active={paymentMethod} onChange={setPaymentMethod} />
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Quantity</Text>
              <TextInput keyboardType="number-pad" onChangeText={setQuantity} style={styles.input} value={quantity} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Amount</Text>
              <TextInput keyboardType="number-pad" onChangeText={setAmount} style={styles.input} value={amount} />
            </View>
          </View>
          <AppButton title="Create ticket" loading={isSubmitting} onPress={createTicket} />
        </View>

        {result ? (
          <View style={[styles.panel, styles.bottomSpace]}>
            <Text style={styles.panelTitle}>Last ticket</Text>
            <Text style={styles.resultCode}>{result.ticketData?.ticketCode}</Text>
            <Text style={styles.resultMeta}>{result.transactionData?.transactionCode} - {money(result.totalAmount || 0)}</Text>
          </View>
        ) : <View style={styles.bottomSpace} />}
      </Screen>
      <RoleBottomNav active="sell" role={user?.role} />
    </View>
  );
}

const styles = StyleSheet.create({
  screenShell: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  kicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.primary, fontSize: 25, fontWeight: '900' },
  totalCard: { gap: 4, borderRadius: 26, backgroundColor: colors.primary, padding: 20, marginBottom: 14 },
  totalLabel: { color: '#b9efd3', fontSize: 12, fontWeight: '900' },
  totalValue: { color: colors.white, fontSize: 34, fontWeight: '900' },
  totalMeta: { color: '#d7f4e6', fontSize: 13, fontWeight: '800' },
  panel: { gap: 12, borderRadius: 22, backgroundColor: colors.card, padding: 16, marginBottom: 14 },
  panelTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  optionColumn: { gap: 10 },
  tripChip: { borderRadius: 18, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surfaceLow, padding: 14 },
  tripChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  tripTitle: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  tripMeta: { marginTop: 3, color: colors.muted, fontSize: 12, fontWeight: '700' },
  tripTextActive: { color: colors.white },
  fieldLabel: { color: colors.secondary, fontSize: 12, fontWeight: '900' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { minHeight: 38, justifyContent: 'center', borderRadius: 19, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surfaceLow, paddingHorizontal: 12 },
  stopChip: { maxWidth: '48%', minHeight: 38, justifyContent: 'center', borderRadius: 19, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surfaceLow, paddingHorizontal: 12 },
  optionChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  optionText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  optionTextActive: { color: colors.white },
  inputRow: { flexDirection: 'row', gap: 12 },
  inputGroup: { flex: 1, gap: 8 },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surfaceLow, color: colors.text, paddingHorizontal: 14, fontSize: 16, fontWeight: '800' },
  resultCode: { color: colors.primary, fontSize: 20, fontWeight: '900' },
  resultMeta: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  emptyText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  bottomSpace: { marginBottom: 96 },
});
