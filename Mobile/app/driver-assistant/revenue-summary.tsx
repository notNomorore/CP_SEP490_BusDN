import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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

export default function RevenueSummaryScreen() {
  const user = useAuthStore((state) => state.user);
  const [revenue, setRevenue] = useState<ShiftRevenue | null>(null);
  const [actualAmount, setActualAmount] = useState('');
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const systemAmount = Number(revenue?.totalRevenue) || 0;
  const actual = Number(actualAmount) || 0;
  const difference = useMemo(() => actual - systemAmount, [actual, systemAmount]);
  const shiftId = String(revenue?.shiftInfo?._id || '');

  const loadRevenue = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await busAssistantApi.getShiftRevenue({ date: toDateInput() });
      setRevenue(data);
      setActualAmount(String(Math.round(Number(data.totalRevenue) || 0)));
    } catch (error) {
      Alert.alert('Unable to load revenue', getErrorMessage(error, 'Unable to load shift revenue.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRevenue();
  }, [loadRevenue]);

  const submitSummary = async () => {
    if (!shiftId) {
      Alert.alert('Missing shift', 'No active assigned shift was found for this summary.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await busAssistantApi.submitRevenueSummary({
        shiftId,
        actualCollectedAmount: actual,
        note,
        attachmentUrls: [],
      });
      Alert.alert('Summary submitted', result.message || `Status: ${result.reconciliationStatus || 'submitted'}`);
    } catch (error) {
      Alert.alert('Unable to submit summary', getErrorMessage(error, 'Unable to submit revenue summary.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.screenShell}>
      <Screen>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back" hitSlop={10} onPress={() => goBackOrReplace('/driver-assistant/shift-revenue')}>
            <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
          </Pressable>
          <View>
            <Text style={styles.kicker}>END OF SHIFT</Text>
            <Text style={styles.title}>Revenue Summary</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.emptyText}>Loading summary...</Text>
          </View>
        ) : (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>{revenue?.shiftInfo?.shiftName || revenue?.shiftInfo?.shiftCode || 'Current shift'}</Text>
              <Text style={styles.heroValue}>{money(systemAmount)}</Text>
              <Text style={styles.heroMeta}>System amount</Text>
            </View>

            <View style={styles.metricGrid}>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Cash</Text>
                <Text style={styles.metricValue}>{money(revenue?.cashCollected)}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>E-payment</Text>
                <Text style={styles.metricValue}>{money(revenue?.ePaymentAmount)}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Tickets</Text>
                <Text style={styles.metricValue}>{revenue?.totalTicketsSold || 0}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Difference</Text>
                <Text style={[styles.metricValue, difference === 0 ? styles.match : styles.discrepancy]}>{money(difference)}</Text>
              </View>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Submit collected amount</Text>
              <Text style={styles.fieldLabel}>Actual cash collected</Text>
              <TextInput keyboardType="number-pad" onChangeText={setActualAmount} style={styles.input} value={actualAmount} />
              <Text style={styles.fieldLabel}>Note</Text>
              <TextInput
                multiline
                onChangeText={setNote}
                placeholder="Optional note for finance/admin"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.noteInput]}
                textAlignVertical="top"
                value={note}
              />
              <AppButton title="Submit summary" loading={isSubmitting} onPress={submitSummary} />
            </View>

            <View style={[styles.panel, styles.bottomSpace]}>
              <Text style={styles.panelTitle}>Checklist</Text>
              <Text style={styles.checkItem}>Cash counted and matches the amount above.</Text>
              <Text style={styles.checkItem}>QR/e-wallet payments reviewed in shift revenue.</Text>
              <Text style={styles.checkItem}>Any difference is explained in the note.</Text>
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
  match: { color: colors.accent },
  discrepancy: { color: colors.error },
  panel: { gap: 12, borderRadius: 22, backgroundColor: colors.card, padding: 16, marginBottom: 14 },
  panelTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  fieldLabel: { color: colors.secondary, fontSize: 12, fontWeight: '900' },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surfaceLow, color: colors.text, paddingHorizontal: 14, fontSize: 16, fontWeight: '800' },
  noteInput: { minHeight: 110, paddingTop: 12 },
  checkItem: { borderRadius: 14, backgroundColor: colors.surfaceLow, color: colors.text, fontSize: 13, fontWeight: '800', padding: 12 },
  emptyText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  bottomSpace: { marginBottom: 96 },
});
