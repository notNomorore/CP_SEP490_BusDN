import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import busAssistantApi from '@/api/busAssistant.api';
import { AppButton } from '@/components/AppButton';
import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/colors';
import { useDriverI18n } from '@/i18n/driver';
import { useAuthStore } from '@/store/auth.store';
import type { ShiftRevenue } from '@/types/busAssistant';
import { goBackOrReplace } from '@/utils/navigation';
import { getErrorMessage } from '@/utils/validation';

const money = (value?: number, locale = 'vi-VN') => new Intl.NumberFormat(locale, { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value) || 0);

export default function RevenueSummaryScreen() {
  const user = useAuthStore((state) => state.user);
  const { language, t } = useDriverI18n();
  const locale = language === 'VN' ? 'vi-VN' : 'en-US';
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
      const data = await busAssistantApi.getShiftRevenue();
      setRevenue(data);
      setActualAmount(String(Math.round(Number(data.totalRevenue) || 0)));
    } catch (error) {
      Alert.alert(t.assistant.revenue.loadErrorTitle, getErrorMessage(error, t.assistant.revenue.loadErrorFallback));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadRevenue();
  }, [loadRevenue]);

  const submitSummary = async () => {
    if (!shiftId) {
      Alert.alert(t.assistant.revenue.missingShiftTitle, t.assistant.revenue.missingShiftMessage);
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
      Alert.alert(t.assistant.revenue.submitSuccessTitle, result.message || `${t.assistant.revenue.submitSuccessStatusPrefix}: ${result.reconciliationStatus || t.assistant.revenue.submitted}`);
    } catch (error) {
      Alert.alert(t.assistant.revenue.submitErrorTitle, getErrorMessage(error, t.assistant.revenue.submitErrorFallback));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.screenShell}>
      <Screen>
        <View style={styles.header}>
          <Pressable accessibilityLabel={t.common.back} hitSlop={10} onPress={() => goBackOrReplace('/driver-assistant/shift-revenue')}>
            <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
          </Pressable>
          <View>
            <Text style={styles.kicker}>{t.assistant.revenue.summaryKicker}</Text>
            <Text style={styles.title}>{t.assistant.revenue.summaryTitle}</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.emptyText}>{t.assistant.revenue.loadingReport}</Text>
          </View>
        ) : (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>{revenue?.shiftInfo?.shiftName || revenue?.shiftInfo?.shiftCode || t.assistant.revenue.currentShift}</Text>
              <Text style={styles.heroValue}>{money(systemAmount, locale)}</Text>
              <Text style={styles.heroMeta}>{t.assistant.revenue.systemAmount}</Text>
            </View>

            <View style={styles.metricGrid}>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>{t.assistant.revenue.cashCollected}</Text>
                <Text style={styles.metricValue}>{money(revenue?.cashCollected, locale)}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>{t.assistant.revenue.electronicCollected}</Text>
                <Text style={styles.metricValue}>{money(revenue?.ePaymentAmount, locale)}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>{t.assistant.revenue.ticketCount}</Text>
                <Text style={styles.metricValue}>{revenue?.totalTicketsSold || 0}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>{t.assistant.revenue.difference}</Text>
                <Text style={[styles.metricValue, difference === 0 ? styles.match : styles.discrepancy]}>{money(difference, locale)}</Text>
              </View>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>{t.assistant.revenue.submitActualCash}</Text>
              <Text style={styles.fieldLabel}>{t.assistant.revenue.actualCash}</Text>
              <TextInput keyboardType="number-pad" onChangeText={setActualAmount} style={styles.input} value={actualAmount} />
              <Text style={styles.fieldLabel}>{t.assistant.revenue.note}</Text>
              <TextInput
                multiline
                onChangeText={setNote}
                placeholder={t.assistant.revenue.notePlaceholder}
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.noteInput]}
                textAlignVertical="top"
                value={note}
              />
              <AppButton title={t.assistant.revenue.submitReport} loading={isSubmitting} onPress={submitSummary} />
            </View>

            <View style={[styles.panel, styles.bottomSpace]}>
              <Text style={styles.panelTitle}>{t.assistant.revenue.beforeSubmit}</Text>
              <Text style={styles.checkItem}>{t.assistant.revenue.checkCash}</Text>
              <Text style={styles.checkItem}>{t.assistant.revenue.checkElectronic}</Text>
              <Text style={styles.checkItem}>{t.assistant.revenue.checkDifference}</Text>
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
