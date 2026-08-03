import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import busAssistantApi from '@/api/busAssistant.api';
import { AppButton } from '@/components/AppButton';
import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';
import type { ShiftRevenue } from '@/types/busAssistant';
import { goBackOrReplace } from '@/utils/navigation';
import { toDateInput } from '@/utils/scheduleOperations';
import { getErrorMessage } from '@/utils/validation';

const money = (value?: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value) || 0);

function Metric({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, accent && styles.metricAccent]}>{value}</Text>
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
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>{revenue?.shiftInfo?.shiftName || revenue?.shiftInfo?.shiftCode || 'Ca hiện tại'}</Text>
              <Text style={styles.heroValue}>{money(revenue?.totalRevenue)}</Text>
              <Text style={styles.heroMeta}>{revenue?.totalTicketsSold || 0} vé trực tiếp - {revenue?.validatedETickets || 0} vé điện tử đã kiểm tra</Text>
            </View>

            <View style={styles.metricGrid}>
              <Metric label="Tiền mặt" value={money(revenue?.cashCollected)} accent />
              <Metric label="Thanh toán điện tử" value={money(revenue?.ePaymentAmount)} />
              <Metric label="Giảm giá" value={money(revenue?.discountAmount)} />
              <Metric label="Số vé" value={revenue?.totalTicketsSold || 0} />
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Theo loại vé</Text>
              {(revenue?.revenueBreakdown || []).length ? revenue?.revenueBreakdown?.map((item) => (
                <View key={item.ticketType} style={styles.row}>
                  <View>
                    <Text style={styles.rowTitle}>{item.ticketType}</Text>
                    <Text style={styles.rowMeta}>{item.tickets} vé</Text>
                  </View>
                  <Text style={styles.rowAmount}>{money(item.revenue)}</Text>
                </View>
              )) : <Text style={styles.emptyText}>Chưa có vé nào được bán.</Text>}
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Phương thức thanh toán</Text>
              {(revenue?.paymentMethodBreakdown || []).length ? revenue?.paymentMethodBreakdown?.map((item) => (
                <View key={item.paymentMethod} style={styles.row}>
                  <View>
                    <Text style={styles.rowTitle}>{item.paymentMethod.replace('_', ' ')}</Text>
                    <Text style={styles.rowMeta}>{item.transactions} giao dịch</Text>
                  </View>
                  <Text style={styles.rowAmount}>{money(item.amount)}</Text>
                </View>
              )) : <Text style={styles.emptyText}>Chưa có giao dịch thanh toán.</Text>}
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Giao dịch gần đây</Text>
              {(revenue?.recentTransactions || []).length ? revenue?.recentTransactions?.map((item) => (
                <View key={item._id} style={styles.row}>
                  <View style={styles.rowText}>
                    <Text numberOfLines={1} style={styles.rowTitle}>{item.transactionCode || item._id}</Text>
                    <Text style={styles.rowMeta}>{item.ticketType} - {item.paymentMethod} - {item.status}</Text>
                  </View>
                  <Text style={styles.rowAmount}>{money(item.amount)}</Text>
                </View>
              )) : <Text style={styles.emptyText}>Chưa có giao dịch gần đây.</Text>}
            </View>

            <View style={styles.bottomSpace}>
              <AppButton title="Chốt doanh thu cuối ca" onPress={() => router.push('/driver-assistant/revenue-summary')} />
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
  heroCard: { gap: 5, borderRadius: 26, backgroundColor: colors.primary, padding: 20, marginBottom: 14 },
  heroLabel: { color: '#b9efd3', fontSize: 12, fontWeight: '900' },
  heroValue: { color: colors.white, fontSize: 34, fontWeight: '900' },
  heroMeta: { color: '#d7f4e6', fontSize: 13, fontWeight: '800' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  metric: { width: '47%', gap: 5, borderRadius: 18, backgroundColor: colors.card, padding: 14 },
  metricLabel: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: '900' },
  metricAccent: { color: colors.accent },
  panel: { gap: 10, borderRadius: 22, backgroundColor: colors.card, padding: 16, marginBottom: 14 },
  panelTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outline, paddingTop: 10 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  rowMeta: { marginTop: 2, color: colors.muted, fontSize: 12, fontWeight: '700' },
  rowAmount: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  emptyText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  bottomSpace: { marginBottom: 96 },
});
