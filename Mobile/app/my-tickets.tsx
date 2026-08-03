import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import passengerApi, { type MonthlyPassRecord, type TicketRecord } from '@/api/passenger.api';
import { EmptyState, LoadingState, PassengerLayout, StatusPill } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const statusLabel = (value?: string) => ({ PAID: 'Đã thanh toán', PENDING: 'Chờ xử lý', COMPLETED: 'Hoàn tất', ACTIVE: 'Đang hiệu lực', EXPIRED: 'Hết hạn', CANCELLED: 'Đã hủy' }[String(value || '').toUpperCase()] || value || 'Chờ xử lý');

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
      setError((err as { message?: string })?.message || 'Không thể tải danh sách vé.');
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
      subtitle="Vé một lượt và vé tháng của bạn"
      title="Vé của tôi"
      rightAction={(
        <Pressable accessibilityLabel="Lịch sử hành trình" onPress={() => router.push('/travel-history')} style={styles.iconButton}>
          <MaterialCommunityIcons color={colors.primary} name="history" size={20} />
        </Pressable>
      )}
    >
      <View style={styles.actions}>
        <Pressable onPress={() => router.push('/buy-oneway-ticket')} style={styles.buyButton}>
          <MaterialCommunityIcons color={colors.white} name="ticket-outline" size={19} />
          <Text style={styles.buyText}>Mua vé lượt</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/buy-monthly-pass')} style={styles.passButton}>
          <MaterialCommunityIcons color={colors.primary} name="calendar-month-outline" size={19} />
          <Text style={styles.passText}>Mua vé tháng</Text>
        </Pressable>
      </View>

      {loading ? <LoadingState label="Đang tải vé" /> : null}
      {!loading && error ? <EmptyState icon="alert-circle-outline" title="Không thể tải vé" detail={error} /> : null}
      {!loading && !error && !tickets.length && !passes.length ? <EmptyState icon="ticket-confirmation-outline" title="Bạn chưa có vé" detail="Hãy mua vé để bắt đầu hành trình cùng BusDN." /> : null}

      {!loading && !error && tickets.length ? <Text style={styles.sectionTitle}>Vé một lượt</Text> : null}
      {!loading && !error && tickets.map((ticket) => (
        <View key={String(ticket.id || ticket._id || ticket.ticketCode)} style={styles.ticketCard}>
          <View style={styles.ticketTop}>
            <Text style={styles.code}>{ticket.ticketCode || 'Vé'}</Text>
            <StatusPill label={statusLabel(ticket.currentStatus || ticket.ticketStatus || ticket.paymentStatus)} tone={ticket.paymentStatus === 'PAID' ? 'success' : 'warning'} />
          </View>
          <Text style={styles.path}>{ticket.departureLocation || 'Điểm đi'} đến {ticket.destinationLocation || 'Điểm đến'}</Text>
          <Text style={styles.meta}>{ticket.routeCode || ticket.routeNumber || 'Tuyến'} - {ticket.departureTime || 'Chưa có giờ'} - {currency.format(Number(ticket.ticketPrice || 0))}</Text>
          <Text style={styles.meta}>Thanh toán: {statusLabel(ticket.paymentStatus)} - Đặt vé: {statusLabel(ticket.bookingStatus)}</Text>
        </View>
      ))}

      {!loading && !error && passes.length ? <Text style={styles.sectionTitle}>Vé tháng</Text> : null}
      {!loading && !error && passes.map((pass) => (
        <View key={String(pass.id || pass._id || pass.passCode)} style={styles.ticketCard}>
          <View style={styles.ticketTop}>
            <Text style={styles.code}>{pass.passCode || 'Vé tháng'}</Text>
            <StatusPill label={statusLabel(pass.passStatus || pass.paymentStatus)} tone={pass.paymentStatus === 'PAID' ? 'success' : 'warning'} />
          </View>
          <Text style={styles.path}>{pass.passType || 'Tiêu chuẩn'} - {pass.routeCode || 'Tất cả tuyến'}</Text>
          <Text style={styles.meta}>{new Date(pass.startDate || Date.now()).toLocaleDateString('vi-VN')} đến {new Date(pass.expiryDate || Date.now()).toLocaleDateString('vi-VN')}</Text>
          <Text style={styles.meta}>{currency.format(Number(pass.passPrice || 0))} - Thanh toán: {statusLabel(pass.paymentStatus)}</Text>
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
