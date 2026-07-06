import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import passengerApi from '@/api/passenger.api';
import { Chip, InfoCard, PassengerScreen, StateView } from '@/components/PassengerLayout';
import { colors } from '@/constants/colors';
import { useApiResource } from '@/hooks/useApiResource';
import { formatCurrency, todayInputDate } from '@/utils/format';
import { getErrorMessage } from '@/utils/validation';

const passengerTypes = ['STANDARD', 'STUDENT', 'PRIORITY'] as const;
const paymentMethods = ['E_WALLET', 'CASHLESS', 'CREDIT_CARD'] as const;

const passengerTypeLabels: Record<(typeof passengerTypes)[number], string> = {
  STANDARD: 'Người lớn',
  STUDENT: 'Sinh viên',
  PRIORITY: 'Ưu tiên',
};

const paymentLabels: Record<(typeof paymentMethods)[number], string> = {
  E_WALLET: 'Ví điện tử',
  CASHLESS: 'Không tiền mặt',
  CREDIT_CARD: 'Thẻ tín dụng',
};

export default function BuyOneWayTicketScreen() {
  const params = useLocalSearchParams<{ routeId?: string }>();
  const { data, isLoading, error, reload } = useApiResource<any>(() => passengerApi.searchRoutes(), null);
  const routes = data?.routes || [];
  const initialRoute = routes.find((route: any) => String(route.id || route._id || route.routeNumber) === String(params.routeId)) || routes[0];
  const [selectedRouteKey, setSelectedRouteKey] = useState<string | null>(params.routeId || null);
  const [startStop, setStartStop] = useState('');
  const [endStop, setEndStop] = useState('');
  const [passengerType, setPassengerType] = useState<(typeof passengerTypes)[number]>('STANDARD');
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentMethods)[number]>('E_WALLET');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedRoute = useMemo(() => {
    if (!selectedRouteKey) return initialRoute;
    return routes.find((route: any) => String(route.id || route._id || route.routeNumber) === selectedRouteKey) || initialRoute;
  }, [routes, selectedRouteKey, initialRoute]);

  const stops = selectedRoute?.stops || [];

  const purchase = async () => {
    const routeId = selectedRoute?.id || selectedRoute?._id || selectedRoute?.routeNumber;
    const departureLocation = startStop || stops[0]?.name;
    const destinationLocation = endStop || stops[stops.length - 1]?.name;
    if (!routeId || !departureLocation || !destinationLocation) {
      setFormError('Vui lòng chọn tuyến, trạm đi và trạm đến.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await passengerApi.purchaseOneWayTicket({
        routeId: String(routeId),
        departureLocation,
        destinationLocation,
        passengerType,
        paymentMethod,
        paymentReference: `MOBILE-${Date.now()}`,
        serviceDate: todayInputDate(),
        departureTime: selectedRoute?.schedule?.firstDeparture || '07:00',
      });
      Alert.alert('Mua vé thành công', 'Vé của bạn đã được thêm vào mục Vé của tôi.', [{ text: 'Xem vé', onPress: () => router.replace('/my-tickets' as any) }]);
    } catch (purchaseError) {
      setFormError(getErrorMessage(purchaseError, 'Không thể mua vé.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PassengerScreen title="Mua vé một lượt">
      <StateView loading={isLoading} error={error} onRetry={reload} />

      <Text style={styles.label}>Tuyến</Text>
      <View style={styles.chips}>
        {routes.slice(0, 8).map((route: any) => {
          const key = String(route.id || route._id || route.routeNumber);
          return <Chip key={key} label={route.routeNumber || route.name} active={String(selectedRoute?.id || selectedRoute?._id || selectedRoute?.routeNumber) === key} onPress={() => setSelectedRouteKey(key)} />;
        })}
      </View>

      {selectedRoute ? (
        <InfoCard>
          <Text style={styles.title}>{selectedRoute.routeNumber} • {selectedRoute.name}</Text>
          <Text style={styles.meta}>Giá vé: {formatCurrency(selectedRoute.fare || selectedRoute.baseFare)}</Text>
        </InfoCard>
      ) : null}

      <Text style={styles.label}>Trạm đi</Text>
      <View style={styles.chips}>{stops.slice(0, 6).map((stop: any) => <Chip key={stop.id || stop.name} label={stop.name} active={(startStop || stops[0]?.name) === stop.name} onPress={() => setStartStop(stop.name)} />)}</View>

      <Text style={styles.label}>Trạm đến</Text>
      <View style={styles.chips}>{stops.slice(-6).map((stop: any) => <Chip key={stop.id || stop.name} label={stop.name} active={(endStop || stops[stops.length - 1]?.name) === stop.name} onPress={() => setEndStop(stop.name)} />)}</View>

      <Text style={styles.label}>Loại hành khách</Text>
      <View style={styles.chips}>{passengerTypes.map((item) => <Chip key={item} label={passengerTypeLabels[item]} active={passengerType === item} onPress={() => setPassengerType(item)} />)}</View>

      <Text style={styles.label}>Thanh toán</Text>
      <View style={styles.chips}>{paymentMethods.map((item) => <Chip key={item} label={paymentLabels[item]} active={paymentMethod === item} onPress={() => setPaymentMethod(item)} />)}</View>

      {formError ? <Text style={styles.error}>{formError}</Text> : null}
      <Pressable disabled={submitting} onPress={() => void purchase()} style={styles.button}>
        <Text style={styles.buttonText}>{submitting ? 'Đang xử lý...' : 'Mua vé'}</Text>
      </Pressable>
    </PassengerScreen>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 8, color: colors.primary, fontSize: 13, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  title: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  meta: { marginTop: 6, color: colors.muted, fontSize: 12, fontWeight: '600' },
  error: { marginBottom: 10, color: colors.error, fontSize: 12, fontWeight: '700' },
  button: { height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 25, backgroundColor: colors.primaryContainer },
  buttonText: { color: colors.white, fontWeight: '900' },
});
