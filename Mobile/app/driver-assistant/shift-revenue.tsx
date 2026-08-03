import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import busAssistantApi from '@/api/busAssistant.api';
import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';
import type { ShiftRevenue } from '@/types/busAssistant';
import { goBackOrReplace } from '@/utils/navigation';
import { toDateInput } from '@/utils/scheduleOperations';
import { getErrorMessage } from '@/utils/validation';

const money = (value?: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value) || 0);

function Metric({ label, value, icon, tone }: { label: string; value: string | number; icon: keyof typeof MaterialCommunityIcons.glyphMap; tone: 'green' | 'blue' | 'amber' }) {
  return (
    <View style={[styles.metric, styles[`metric_${tone}`]]}>
      <View style={styles.metricTop}><Text style={styles.metricLabel}>{label}</Text><View style={styles.metricIcon}><MaterialCommunityIcons color={tone === 'blue' ? '#147aa5' : tone === 'amber' ? '#a46600' : colors.accent} name={icon} size={19} /></View></View>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export default function ShiftRevenueScreen() {
  const user = useAuthStore((state) => state.user);
  const [revenue, setRevenue] = useState<ShiftRevenue | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadRevenue = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await busAssistantApi.getShiftRevenue({ date: toDateInput() });
      setRevenue(data);
    } catch (error) {
      Alert.alert('Không thể tải doanh thu', getErrorMessage(error, 'Không thể tải doanh thu ca.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRevenue();
  }, [loadRevenue]);

  return (
    <View style={styles.screenShell}>
      <Screen>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Quay lại" hitSlop={10} onPress={() => goBackOrReplace('/driver-assistant')}>
            <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>DOANH THU CA</Text>
            <Text style={styles.title}>Doanh thu ca</Text>
          </View>
          <Pressable accessibilityLabel="Tải lại" hitSlop={10} onPress={() => void loadRevenue()}>
            <MaterialCommunityIcons color={colors.primary} name="refresh" size={24} />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.emptyText}>Đang tải doanh thu ca...</Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryIcon}><MaterialCommunityIcons color={colors.white} name="chart-line" size={22} /></View>
              <View style={styles.summaryText}><Text style={styles.summaryTitle}>Tổng quan doanh thu</Text><Text style={styles.summaryHint}>Theo dõi vé và giao dịch trong ca hiện tại</Text></View>
              <Pressable accessibilityLabel="Tải lại doanh thu" onPress={() => void loadRevenue()} style={styles.summaryRefresh}><MaterialCommunityIcons color={colors.primary} name="refresh" size={20} /></Pressable>
            </View>

            <View style={styles.metricGrid}>
              <Metric label="VÉ ĐÃ BÁN" value={revenue?.totalTicketsSold || 0} icon="ticket-confirmation-outline" tone="green" />
              <Metric label="TỔNG DOANH THU" value={money(revenue?.totalRevenue)} icon="trending-up" tone="green" />
              <Metric label="TIỀN MẶT" value={money(revenue?.cashCollected)} icon="cash" tone="amber" />
              <Metric label="THANH TOÁN ĐIỆN TỬ" value={money(revenue?.ePaymentAmount)} icon="credit-card-outline" tone="blue" />
            </View>

            <View style={styles.panel}>
              <View style={styles.panelHeading}><MaterialCommunityIcons color={colors.accent} name="receipt-text-outline" size={20} /><Text style={styles.panelTitle}>Chi tiết doanh thu</Text></View>
              <View style={styles.tableHeader}><Text style={styles.tableMain}>LOẠI</Text><Text style={styles.tableCenter}>VÉ</Text><Text style={styles.tableRight}>DOANH THU</Text></View>
              {(revenue?.revenueBreakdown || []).length ? revenue?.revenueBreakdown?.map((item) => (
                <View key={item.ticketType} style={styles.row}>
                  <Text style={styles.tableMainValue}>{item.ticketType === 'WALK_IN' ? 'Vé trực tiếp' : item.ticketType}</Text>
                  <Text style={styles.tableCenterValue}>{item.tickets}</Text>
                  <Text style={styles.rowAmount}>{money(item.revenue)}</Text>
                </View>
              )) : <Text style={styles.emptyText}>Chưa có vé nào được bán.</Text>}
            </View>

            <View style={styles.panel}>
              <View style={styles.panelHeading}><MaterialCommunityIcons color={colors.accent} name="credit-card-outline" size={20} /><Text style={styles.panelTitle}>Theo phương thức thanh toán</Text></View>
              <View style={styles.tableHeader}><Text style={styles.tableMain}>PHƯƠNG THỨC</Text><Text style={styles.tableCenter}>GIAO DỊCH</Text><Text style={styles.tableRight}>SỐ TIỀN</Text></View>
              {(revenue?.paymentMethodBreakdown || []).length ? revenue?.paymentMethodBreakdown?.map((item) => (
                <View key={item.paymentMethod} style={styles.row}>
                  <View style={styles.tableMainValue}><Text style={[styles.methodPill, item.paymentMethod === 'CASH' ? styles.cashPill : styles.qrPill]}>{item.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản QR'}</Text></View>
                  <Text style={styles.tableCenterValue}>{item.transactions}</Text>
                  <Text style={styles.rowAmount}>{money(item.amount)}</Text>
                </View>
              )) : <Text style={styles.emptyText}>Chưa có giao dịch thanh toán.</Text>}
            </View>

            <View style={[styles.panel, styles.lastPanel]}>
              <View style={styles.panelHeading}><MaterialCommunityIcons color={colors.accent} name="receipt-text-outline" size={20} /><Text style={styles.panelTitle}>Giao dịch gần đây</Text></View>
              {(revenue?.recentTransactions || []).length ? revenue?.recentTransactions?.map((item) => (
                <View key={item._id} style={styles.row}>
                  <View style={styles.rowText}>
                    <Text numberOfLines={1} style={styles.rowTitle}>{item.transactionCode || item._id}</Text>
                    <Text style={styles.rowMeta}>{item.ticketType === 'WALK_IN' ? 'Vé trực tiếp' : item.ticketType} · {item.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản QR'}</Text>
                  </View>
                  <View style={styles.transactionRight}><Text style={styles.rowAmount}>{money(item.amount)}</Text><Text style={[styles.transactionStatus, item.status === 'COMPLETED' ? styles.completedStatus : styles.pendingStatus]}>{item.status === 'COMPLETED' ? 'Hoàn tất' : 'Chờ xử lý'}</Text></View>
                </View>
              )) : <Text style={styles.emptyText}>Chưa có giao dịch gần đây.</Text>}
            </View>

          </>
        )}
      </Screen>
      <RoleBottomNav active="revenue" role={user?.role} />
    </View>
  );
}

const styles = StyleSheet.create({
  screenShell: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  headerText: { flex: 1 },
  kicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.primary, fontSize: 25, fontWeight: '900' },
  loading: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 12 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 20, borderWidth: 1, borderColor: '#ccebdc', backgroundColor: '#f1fcf7', padding: 14, marginBottom: 14 },
  summaryIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.accent },
  summaryText: { flex: 1 },
  summaryTitle: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  summaryHint: { marginTop: 2, color: colors.muted, fontSize: 10, fontWeight: '600' },
  summaryRefresh: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.white },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  metric: { width: '48%', gap: 9, borderRadius: 18, borderWidth: 1, backgroundColor: colors.card, padding: 13 },
  metric_green: { borderColor: '#c9eadb' },
  metric_blue: { borderColor: '#cce7f2' },
  metric_amber: { borderColor: '#f0dfb7' },
  metricTop: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 6 },
  metricIcon: { marginLeft: 'auto', width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.surfaceLow },
  metricLabel: { flex: 1, color: colors.muted, fontSize: 9, lineHeight: 13, fontWeight: '900', letterSpacing: .6 },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: '900' },
  panel: { gap: 0, overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: '#dce9e3', backgroundColor: colors.card, marginBottom: 14 },
  panelHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 15 },
  panelTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  tableHeader: { minHeight: 38, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f7f5', paddingHorizontal: 14 },
  tableMain: { flex: 1.25, color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: .5 },
  tableCenter: { flex: .7, color: colors.muted, fontSize: 9, fontWeight: '900', textAlign: 'center', letterSpacing: .4 },
  tableRight: { flex: 1, color: colors.muted, fontSize: 9, fontWeight: '900', textAlign: 'right', letterSpacing: .5 },
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outline, paddingHorizontal: 14, paddingVertical: 10 },
  tableMainValue: { flex: 1.25, color: colors.text, fontSize: 12, fontWeight: '800' },
  tableCenterValue: { flex: .7, color: colors.text, fontSize: 12, textAlign: 'center', fontWeight: '700' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  rowMeta: { marginTop: 2, color: colors.muted, fontSize: 12, fontWeight: '700' },
  rowAmount: { flex: 1, color: colors.primary, fontSize: 12, textAlign: 'right', fontWeight: '900' },
  methodPill: { alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, fontSize: 10, fontWeight: '800' },
  cashPill: { color: '#8a5900', backgroundColor: '#fff0c2' },
  qrPill: { color: '#11678d', backgroundColor: '#dceffc' },
  transactionRight: { alignItems: 'flex-end', gap: 4 },
  transactionStatus: { overflow: 'hidden', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, fontSize: 9, fontWeight: '900' },
  completedStatus: { color: '#087351', backgroundColor: '#d5f5e7' },
  pendingStatus: { color: '#965d00', backgroundColor: '#fff0c2' },
  emptyText: { color: colors.muted, fontSize: 13, fontWeight: '700', padding: 16 },
  lastPanel: { marginBottom: 96 },
});
