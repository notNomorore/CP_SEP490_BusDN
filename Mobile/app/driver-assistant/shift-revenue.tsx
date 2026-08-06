import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import busAssistantApi from '@/api/busAssistant.api';
import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/colors';
import { useDriverI18n } from '@/i18n/driver';
import { useAuthStore } from '@/store/auth.store';
import type { ShiftRevenue } from '@/types/busAssistant';
import { goBackOrReplace } from '@/utils/navigation';
import { addDays, toDateInput } from '@/utils/scheduleOperations';
import { getErrorMessage } from '@/utils/validation';

const money = (value?: number, locale = 'vi-VN') => new Intl.NumberFormat(locale, { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value) || 0);
const TRANSACTIONS_PER_PAGE = 5;

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
  const { language, t } = useDriverI18n();
  const locale = language === 'VN' ? 'vi-VN' : 'en-US';
  const [revenue, setRevenue] = useState<ShiftRevenue | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(toDateInput());
  const isSelectedDateValid = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) && selectedDate <= toDateInput();
  const [transactionPage, setTransactionPage] = useState(1);
  const recentTransactions = revenue?.recentTransactions || [];
  const transactionPageCount = Math.max(1, Math.ceil(recentTransactions.length / TRANSACTIONS_PER_PAGE));
  const visibleTransactions = useMemo(() => {
    const start = (transactionPage - 1) * TRANSACTIONS_PER_PAGE;
    return recentTransactions.slice(start, start + TRANSACTIONS_PER_PAGE);
  }, [recentTransactions, transactionPage]);

  const loadRevenue = useCallback(async () => {
    if (!isSelectedDateValid) return;
    setIsLoading(true);
    try {
      const data = await busAssistantApi.getShiftRevenue({ date: selectedDate });
      setRevenue(data);
      setTransactionPage(1);
    } catch (error) {
      Alert.alert(t.assistant.revenue.loadErrorTitle, getErrorMessage(error, t.assistant.revenue.loadErrorFallback));
    } finally {
      setIsLoading(false);
    }
  }, [isSelectedDateValid, selectedDate, t]);

  useEffect(() => {
    void loadRevenue();
  }, [loadRevenue]);

  return (
    <View style={styles.screenShell}>
      <Screen>
        <View style={styles.header}>
          <Pressable accessibilityLabel={t.common.back} hitSlop={10} onPress={() => goBackOrReplace('/driver-assistant')}>
            <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>{t.assistant.revenue.shiftKicker}</Text>
            <Text style={styles.title}>{t.assistant.revenue.shiftTitle}</Text>
          </View>
          <Pressable accessibilityLabel={t.common.refresh} hitSlop={10} onPress={() => void loadRevenue()}>
            <MaterialCommunityIcons color={colors.primary} name="refresh" size={24} />
          </Pressable>
        </View>

        <View style={styles.dateNavigator}>
          <Pressable disabled={!isSelectedDateValid} accessibilityLabel={t.assistant.revenue.previous} onPress={() => setSelectedDate(toDateInput(addDays(selectedDate, -1)))} style={[styles.dateButton, !isSelectedDateValid && styles.dateButtonDisabled]}>
            <MaterialCommunityIcons color={isSelectedDateValid ? colors.primary : colors.outline} name="chevron-left" size={22} />
          </Pressable>
          <View style={styles.dateField}>
            <MaterialCommunityIcons color={colors.accent} name="calendar-month-outline" size={19} />
            <TextInput keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={setSelectedDate} placeholder="YYYY-MM-DD" style={styles.dateInput} value={selectedDate} />
          </View>
          <Pressable disabled={!isSelectedDateValid || selectedDate >= toDateInput()} accessibilityLabel={t.assistant.revenue.next} onPress={() => setSelectedDate(toDateInput(addDays(selectedDate, 1)))} style={[styles.dateButton, (!isSelectedDateValid || selectedDate >= toDateInput()) && styles.dateButtonDisabled]}>
            <MaterialCommunityIcons color={!isSelectedDateValid || selectedDate >= toDateInput() ? colors.outline : colors.primary} name="chevron-right" size={22} />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.emptyText}>{t.assistant.revenue.loadingShiftRevenue}</Text>
          </View>
        ) : (
          <>
            <View style={styles.metricGrid}>
              <Metric label={t.assistant.revenue.soldTickets} value={revenue?.totalTicketsSold || 0} icon="ticket-confirmation-outline" tone="green" />
              <Metric label={t.assistant.revenue.totalRevenue} value={money(revenue?.totalRevenue, locale)} icon="trending-up" tone="green" />
              <Metric label={t.assistant.revenue.cash} value={money(revenue?.cashCollected, locale)} icon="cash" tone="amber" />
              <Metric label={t.assistant.revenue.electronicPayment} value={money(revenue?.ePaymentAmount, locale)} icon="credit-card-outline" tone="blue" />
            </View>

            <View style={styles.panel}>
              <View style={styles.panelHeading}><MaterialCommunityIcons color={colors.accent} name="credit-card-outline" size={20} /><Text style={styles.panelTitle}>{t.assistant.revenue.byPaymentMethod}</Text></View>
              <View style={styles.tableHeader}><Text style={styles.tableMain}>{t.assistant.revenue.paymentMethod}</Text><Text style={styles.tableCenter}>{t.assistant.revenue.transactions}</Text><Text style={styles.tableRight}>{t.assistant.revenue.amount}</Text></View>
              {(revenue?.paymentMethodBreakdown || []).length ? revenue?.paymentMethodBreakdown?.map((item) => (
                <View key={item.paymentMethod} style={styles.row}>
                  <View style={styles.tableMainValue}><Text style={[styles.methodPill, item.paymentMethod === 'CASH' ? styles.cashPill : styles.qrPill]}>{item.paymentMethod === 'CASH' ? t.assistant.revenue.cashMethod : t.assistant.revenue.qrMethod}</Text></View>
                  <Text style={styles.tableCenterValue}>{item.transactions}</Text>
                  <Text style={styles.rowAmount}>{money(item.amount, locale)}</Text>
                </View>
              )) : <Text style={styles.emptyText}>{t.assistant.revenue.noPayments}</Text>}
            </View>

            <View style={[styles.panel, styles.lastPanel]}>
              <View style={styles.panelHeading}><MaterialCommunityIcons color={colors.accent} name="receipt-text-outline" size={20} /><Text style={styles.panelTitle}>{t.assistant.revenue.recentTransactions}</Text></View>
              {recentTransactions.length ? visibleTransactions.map((item) => (
                <View key={item._id} style={styles.row}>
                  <View style={styles.rowText}>
                    <Text numberOfLines={1} style={styles.rowTitle}>{item.transactionCode || item._id}</Text>
                    <Text style={styles.rowMeta}>{item.ticketType === 'WALK_IN' ? t.assistant.revenue.walkInTicket : item.ticketType} · {item.paymentMethod === 'CASH' ? t.assistant.revenue.cashMethod : t.assistant.revenue.qrMethod}</Text>
                  </View>
                  <View style={styles.transactionRight}><Text style={styles.rowAmount}>{money(item.amount, locale)}</Text><Text style={[styles.transactionStatus, item.status === 'COMPLETED' ? styles.completedStatus : styles.pendingStatus]}>{item.status === 'COMPLETED' ? t.assistant.revenue.completed : t.assistant.revenue.pending}</Text></View>
                </View>
              )) : <Text style={styles.emptyText}>{t.assistant.revenue.noRecentTransactions}</Text>}
              {recentTransactions.length > TRANSACTIONS_PER_PAGE ? (
                <View style={styles.pagination}>
                  <Pressable disabled={transactionPage === 1} onPress={() => setTransactionPage((page) => Math.max(1, page - 1))} style={[styles.pageButton, transactionPage === 1 && styles.pageButtonDisabled]}>
                    <MaterialCommunityIcons color={transactionPage === 1 ? colors.outline : colors.primary} name="chevron-left" size={20} />
                    <Text style={[styles.pageButtonText, transactionPage === 1 && styles.pageButtonTextDisabled]}>{t.assistant.revenue.previous}</Text>
                  </Pressable>
                  <View style={styles.pageIndicator}><Text style={styles.pageIndicatorText}>{transactionPage} / {transactionPageCount}</Text></View>
                  <Pressable disabled={transactionPage === transactionPageCount} onPress={() => setTransactionPage((page) => Math.min(transactionPageCount, page + 1))} style={[styles.pageButton, transactionPage === transactionPageCount && styles.pageButtonDisabled]}>
                    <Text style={[styles.pageButtonText, transactionPage === transactionPageCount && styles.pageButtonTextDisabled]}>{t.assistant.revenue.next}</Text>
                    <MaterialCommunityIcons color={transactionPage === transactionPageCount ? colors.outline : colors.primary} name="chevron-right" size={20} />
                  </Pressable>
                </View>
              ) : null}
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
  dateNavigator: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 16 },
  dateButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#c9eadb', backgroundColor: colors.card },
  dateButtonDisabled: { opacity: .55, backgroundColor: colors.surfaceLow },
  dateField: { flex: 1, height: 42, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: '#c9eadb', backgroundColor: colors.card, paddingHorizontal: 12 },
  dateInput: { flex: 1, color: colors.primary, fontSize: 14, fontWeight: '900', paddingVertical: 0 },
  kicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.primary, fontSize: 25, fontWeight: '900' },
  loading: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 12 },
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
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outline, padding: 12 },
  pageButton: { minWidth: 84, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 12, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.white, paddingHorizontal: 10 },
  pageButtonDisabled: { backgroundColor: colors.surfaceLow, opacity: .65 },
  pageButtonText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  pageButtonTextDisabled: { color: colors.muted },
  pageIndicator: { minWidth: 58, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#e6f7ef' },
  pageIndicatorText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  emptyText: { color: colors.muted, fontSize: 13, fontWeight: '700', padding: 16 },
  lastPanel: { marginBottom: 96 },
});
