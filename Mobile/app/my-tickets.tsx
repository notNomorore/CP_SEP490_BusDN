import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import passengerApi from '@/api/passenger.api';
import { BottomNav, Chip, InfoCard, PassengerScreen, StateView } from '@/components/PassengerLayout';
import { colors } from '@/constants/colors';
import { useApiResource } from '@/hooks/useApiResource';
import { formatCurrency, formatDate } from '@/utils/format';

const tabs = ['Active', 'Used', 'Expired'] as const;
const tabLabels: Record<(typeof tabs)[number], string> = {
  Active: 'Còn hiệu lực',
  Used: 'Đã dùng',
  Expired: 'Hết hạn',
};

function ticketStatus(ticket: any): (typeof tabs)[number] {
  const rawStatus = String(ticket.status || '').toUpperCase();
  const expireValue = ticket.expireDate || ticket.validUntil || ticket.serviceDate;
  const expired = expireValue ? new Date(expireValue).getTime() < Date.now() : false;
  if (rawStatus.includes('USED') || rawStatus.includes('COMPLETED')) return 'Used';
  if (rawStatus.includes('EXPIRED') || expired) return 'Expired';
  return 'Active';
}

export default function MyTicketsScreen() {
  const { data, isLoading, isRefreshing, error, refresh, reload } = useApiResource<any[]>(() => passengerApi.getTickets(), []);
  const [tab, setTab] = useState<(typeof tabs)[number]>('Active');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const tickets = useMemo(() => (data || []).filter((ticket) => ticketStatus(ticket) === tab), [data, tab]);

  return (
    <View style={{ flex: 1 }}>
      <PassengerScreen title="Vé của tôi" onRefresh={refresh} refreshing={isRefreshing}>
        <View style={styles.chips}>
          {tabs.map((item) => <Chip key={item} label={tabLabels[item]} active={tab === item} onPress={() => setTab(item)} />)}
        </View>
        <StateView loading={isLoading} error={error} empty={!isLoading && tickets.length === 0} emptyText={`Chưa có vé ${tabLabels[tab].toLowerCase()}.`} onRetry={reload} />

        {tickets.map((ticket: any, index: number) => {
          const id = String(ticket.id || ticket._id || index);
          const expanded = expandedId === id;
          return (
            <InfoCard key={id} onPress={() => setExpandedId(expanded ? null : id)}>
              <View style={styles.row}>
                <View>
                  <Text style={styles.route}>{ticket.routeCode || ticket.routeNumber || ticket.route?.routeNumber || 'Vé xe buýt'}</Text>
                  <Text style={styles.title}>{ticket.departureLocation || ticket.from} đến {ticket.destinationLocation || ticket.to}</Text>
                </View>
                <Text style={styles.status}>{tabLabels[ticketStatus(ticket)]}</Text>
              </View>
              <Text style={styles.meta}>Ngày đi: {formatDate(ticket.serviceDate || ticket.createdAt)} • Hết hạn: {formatDate(ticket.expireDate || ticket.validUntil)}</Text>
              <Text style={styles.meta}>Giá vé: {formatCurrency(ticket.fare || ticket.price || ticket.totalAmount)}</Text>
              {expanded ? (
                <View style={styles.qrBox}>
                  <Text style={styles.qrLabel}>MÃ QR</Text>
                  <Text selectable style={styles.qrText}>{ticket.qrCode || ticket.qrPayload || ticket.ticketCode || id}</Text>
                </View>
              ) : null}
            </InfoCard>
          );
        })}
      </PassengerScreen>
      <BottomNav active="tickets" />
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  route: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  title: { marginTop: 5, color: colors.primary, fontSize: 15, fontWeight: '900' },
  status: { color: '#17503a', fontSize: 10, fontWeight: '900' },
  meta: { marginTop: 7, color: colors.muted, fontSize: 12, fontWeight: '600' },
  qrBox: { marginTop: 13, padding: 14, borderRadius: 16, backgroundColor: colors.surfaceLow },
  qrLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  qrText: { marginTop: 6, color: colors.primary, fontSize: 12, fontWeight: '800' },
});
