import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import passengerApi from '@/api/passenger.api';
import { Chip, InfoCard, PassengerScreen, StateView } from '@/components/PassengerLayout';
import { colors } from '@/constants/colors';
import { useApiResource } from '@/hooks/useApiResource';
import { formatDate, todayInputDate } from '@/utils/format';
import { getErrorMessage } from '@/utils/validation';

const passTypes = ['STANDARD', 'STUDENT', 'PRIORITY'] as const;
const paymentMethods = ['E_WALLET', 'ONLINE_BANKING', 'CREDIT_CARD'] as const;

const passTypeLabels: Record<(typeof passTypes)[number], string> = {
  STANDARD: 'Người lớn',
  STUDENT: 'Sinh viên',
  PRIORITY: 'Ưu tiên',
};

const paymentLabels: Record<(typeof paymentMethods)[number], string> = {
  E_WALLET: 'Ví điện tử',
  ONLINE_BANKING: 'Ngân hàng',
  CREDIT_CARD: 'Thẻ tín dụng',
};

export default function BuyMonthlyPassScreen() {
  const { data, isLoading, error, reload } = useApiResource<any[]>(() => passengerApi.getMonthlyPasses(), []);
  const [passType, setPassType] = useState<(typeof passTypes)[number]>('STANDARD');
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentMethods)[number]>('E_WALLET');
  const [routeCode, setRouteCode] = useState('');
  const [startDate, setStartDate] = useState(todayInputDate());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const purchase = async () => {
    if (!startDate.trim()) {
      setFormError('Vui lòng nhập ngày bắt đầu.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await passengerApi.purchaseMonthlyPass({
        passType,
        routeCode: routeCode.trim() || undefined,
        startDate,
        validityMonths: 1,
        paymentMethod,
        paymentReference: `MOBILE-${Date.now()}`,
      });
      Alert.alert('Mua vé tháng thành công', 'Vé tháng của bạn đã sẵn sàng.', [{ text: 'Xem vé', onPress: () => router.replace('/my-tickets' as any) }]);
    } catch (purchaseError) {
      setFormError(getErrorMessage(purchaseError, 'Không thể mua vé tháng.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PassengerScreen title="Mua vé tháng">
      <StateView loading={isLoading} error={error} onRetry={reload} />
      {(data || []).slice(0, 2).map((pass: any) => (
        <InfoCard key={pass.id || pass._id}>
          <Text style={styles.title}>{passTypeLabels[pass.passType as keyof typeof passTypeLabels] || 'Vé tháng'}</Text>
          <Text style={styles.meta}>Hết hạn: {formatDate(pass.expireDate || pass.validUntil)}</Text>
          <Text style={styles.meta}>Trạng thái: {pass.status || (pass.isActive ? 'Đang hoạt động' : 'Không hoạt động')}</Text>
        </InfoCard>
      ))}

      <Text style={styles.label}>Loại vé</Text>
      <View style={styles.chips}>{passTypes.map((item) => <Chip key={item} label={passTypeLabels[item]} active={passType === item} onPress={() => setPassType(item)} />)}</View>

      <Text style={styles.label}>Thanh toán</Text>
      <View style={styles.chips}>{paymentMethods.map((item) => <Chip key={item} label={paymentLabels[item]} active={paymentMethod === item} onPress={() => setPaymentMethod(item)} />)}</View>

      <TextInput placeholder="Mã tuyến (không bắt buộc)" placeholderTextColor="#65766f" value={routeCode} onChangeText={setRouteCode} style={styles.input} />
      <TextInput placeholder="Ngày bắt đầu YYYY-MM-DD" placeholderTextColor="#65766f" value={startDate} onChangeText={setStartDate} style={styles.input} />
      {formError ? <Text style={styles.error}>{formError}</Text> : null}
      <Pressable disabled={submitting} onPress={() => void purchase()} style={styles.button}>
        <Text style={styles.buttonText}>{submitting ? 'Đang xử lý...' : 'Mua vé tháng'}</Text>
      </Pressable>
    </PassengerScreen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  meta: { marginTop: 6, color: colors.muted, fontSize: 12, fontWeight: '600' },
  label: { marginBottom: 8, color: colors.primary, fontSize: 13, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  input: { minHeight: 50, marginBottom: 10, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.card, color: colors.text, fontWeight: '700' },
  error: { marginBottom: 10, color: colors.error, fontSize: 12, fontWeight: '700' },
  button: { height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 25, backgroundColor: colors.primaryContainer },
  buttonText: { color: colors.white, fontWeight: '900' },
});
