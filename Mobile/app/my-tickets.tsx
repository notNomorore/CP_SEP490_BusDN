import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import passengerApi, { type MonthlyPassRecord, type TicketRecord } from '@/api/passenger.api';
import { EmptyState, LoadingState, PassengerLayout, StatusPill } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

export default function MyTicketsScreen() {
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [passes, setPasses] = useState<MonthlyPassRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [ticketData, passData] = await Promise.all([
        passengerApi.getTickets(),
        passengerApi.getMonthlyPasses(),
      ]);
      setTickets(ticketData.tickets || []);
      setPasses(passData.passes || []);
    } catch (err) {
      setError((err as { message?: string })?.message || 'Could not load tickets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <PassengerLayout
      active="tickets"
      subtitle="One-way tickets and monthly passes"
      title="My Tickets"
      rightAction={(
        <Pressable accessibilityLabel="Travel history" onPress={() => router.push('/travel-history')} style={styles.iconButton}>
          <MaterialCommunityIcons color={colors.primary} name="history" size={20} />
        </Pressable>
      )}
    >
      <View style={styles.actions}>
        <Pressable onPress={() => router.push('/buy-oneway-ticket')} style={styles.buyButton}>
          <MaterialCommunityIcons color={colors.white} name="ticket-outline" size={19} />
          <Text style={styles.buyText}>Buy one-way</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/buy-monthly-pass')} style={styles.passButton}>
          <MaterialCommunityIcons color={colors.primary} name="calendar-month-outline" size={19} />
          <Text style={styles.passText}>Monthly pass</Text>
        </Pressable>
      </View>

      {loading ? <LoadingState label="Loading tickets" /> : null}
      {!loading && error ? <EmptyState icon="alert-circle-outline" title="Could not load tickets" detail={error} /> : null}
      {!loading && !error && !tickets.length && !passes.length ? <EmptyState icon="ticket-confirmation-outline" title="No tickets yet" detail="Buy a ticket to start travelling with BusDN." /> : null}

      {!loading && !error && tickets.length ? <Text style={styles.sectionTitle}>One-way tickets</Text> : null}
      {!loading && !error && tickets.map((ticket) => (
        <View key={String(ticket.id || ticket._id || ticket.ticketCode)} style={styles.ticketCard}>
          <View style={styles.ticketTop}>
            <Text style={styles.code}>{ticket.ticketCode || 'Ticket'}</Text>
            <StatusPill label={ticket.currentStatus || ticket.ticketStatus || ticket.paymentStatus || 'PENDING'} tone={ticket.paymentStatus === 'PAID' ? 'success' : 'warning'} />
          </View>
          <Text style={styles.path}>{ticket.departureLocation || 'Origin'} to {ticket.destinationLocation || 'Destination'}</Text>
          <Text style={styles.meta}>{ticket.routeCode || ticket.routeNumber || 'Route'} - {ticket.departureTime || 'Time'} - {currency.format(Number(ticket.ticketPrice || 0))}</Text>
          <Text style={styles.meta}>Payment: {ticket.paymentStatus || 'PENDING'} - Booking: {ticket.bookingStatus || 'PENDING'}</Text>
        </View>
      ))}

      {!loading && !error && passes.length ? <Text style={styles.sectionTitle}>Monthly passes</Text> : null}
      {!loading && !error && passes.map((pass) => (
        <View key={String(pass.id || pass._id || pass.passCode)} style={styles.ticketCard}>
          <View style={styles.ticketTop}>
            <Text style={styles.code}>{pass.passCode || 'Monthly pass'}</Text>
            <StatusPill label={pass.passStatus || pass.paymentStatus || 'PENDING'} tone={pass.paymentStatus === 'PAID' ? 'success' : 'warning'} />
          </View>
          <Text style={styles.path}>{pass.passType || 'STANDARD'} - {pass.routeCode || 'ALL ROUTES'}</Text>
          <Text style={styles.meta}>{new Date(pass.startDate || Date.now()).toLocaleDateString()} to {new Date(pass.expiryDate || Date.now()).toLocaleDateString()}</Text>
          <Text style={styles.meta}>{currency.format(Number(pass.passPrice || 0))} - Payment: {pass.paymentStatus || 'PENDING'}</Text>
        </View>
      ))}
    </PassengerLayout>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.card },
  actions: { flexDirection: 'row', gap: 10 },
  buyButton: { flex: 1, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 25, backgroundColor: colors.primaryContainer },
  passButton: { flex: 1, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 25, backgroundColor: '#d8f6e7' },
  buyText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  passText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  sectionTitle: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  ticketCard: { gap: 9, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  ticketTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  code: { color: colors.primary, fontSize: 17, fontWeight: '900' },
  path: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  meta: { color: colors.secondary, fontSize: 12, fontWeight: '700' },
});
