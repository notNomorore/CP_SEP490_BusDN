import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import passengerApi, { type BusRoute, type BusRouteStop, type PaymentOrder, type PromotionPreview } from '@/api/passenger.api';
import { AppButton } from '@/components/AppButton';
import { EmptyState, LoadingState, PassengerLayout, StatusPill } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';
import useAuthStore from '@/store/auth.store';

type TicketType = 'ONE_WAY' | 'MONTHLY_PASS';
type Direction = 'OUTBOUND' | 'INBOUND';
type PassengerType = 'STANDARD' | 'STUDENT' | 'PRIORITY';
type FormErrors = Partial<Record<
  | 'auth'
  | 'route'
  | 'direction'
  | 'boardingStop'
  | 'destinationStop'
  | 'serviceDate'
  | 'departureTime'
  | 'passengerType'
  | 'promotion'
  | 'price',
  string
>>;

const passengerTypes: Array<{ id: PassengerType; label: string; note?: string }> = [
  { id: 'STANDARD', label: 'Phổ thông' },
  { id: 'STUDENT', label: 'Học sinh / Sinh viên', note: 'Vui lòng mang giấy tờ xác minh khi lên xe.' },
  { id: 'PRIORITY', label: 'Đối tượng ưu tiên', note: 'Hành khách thuộc đối tượng ưu tiên vui lòng mang giấy tờ xác minh khi lên xe.' },
];

const monthlyPrices: Record<PassengerType, number> = {
  STANDARD: 250000,
  STUDENT: 120000,
  PRIORITY: 0,
};

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const getVietnamDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const getVietnamTime = () => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
}).format(new Date());

const getCurrentMonthStart = () => {
  const today = getVietnamDate();
  return `${today.slice(0, 7)}-01`;
};

const toRouteId = (route?: BusRoute | null) => String(route?.id || route?._id || '');

const roundFare = (value: number) => {
  if (value <= 0) return 0;
  return Math.max(Math.round(value / 1000) * 1000, 1000);
};

const buildMonthEnd = (startDate: string, months: number) => {
  const [year, month, day] = startDate.split('-').map(Number);
  const start = new Date(year, month - 1, day || 1);
  const end = new Date(start);
  end.setMonth(end.getMonth() + Math.max(months, 1));
  end.setDate(end.getDate() - 1);
  return end.toISOString().slice(0, 10);
};

const addMinutesToTime = (time: string, minutes: number) => {
  const [hour, minute] = time.split(':').map(Number);
  const total = hour * 60 + minute + minutes;
  const nextHour = Math.floor(total / 60);
  const nextMinute = total % 60;
  if (nextHour > 23) return '';
  return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`;
};

const buildDepartureTimes = (route?: BusRoute | null, serviceDate = getVietnamDate()) => {
  const first = route?.operatingHours?.firstDeparture || '';
  const last = route?.operatingHours?.lastDeparture || '';
  const frequency = Number(route?.operatingHours?.frequencyMinutes || 0);
  if (!first || !last || !frequency) return [];

  const today = getVietnamDate();
  const now = getVietnamTime();
  const times: string[] = [];
  let cursor = first;
  for (let index = 0; index < 160 && cursor && cursor <= last; index += 1) {
    if (serviceDate > today || cursor > now) {
      times.push(cursor);
    }
    cursor = addMinutesToTime(cursor, frequency);
  }
  return times;
};

const getDirectionStops = (route?: BusRoute | null, direction: Direction = 'OUTBOUND') => {
  const outbound = route?.directions?.OUTBOUND?.stops || route?.stops || [];
  if (direction === 'OUTBOUND') return outbound;
  return route?.directions?.INBOUND?.stops || [...outbound].reverse().map((stop, index) => ({ ...stop, order: index + 1 }));
};

const calculateOneWayPrice = (route: BusRoute | null, stops: BusRouteStop[], boardingStop: string, destinationStop: string) => {
  const start = stops.find((stop) => stop.name === boardingStop);
  const end = stops.find((stop) => stop.name === destinationStop);
  if (!route || !start || !end || Number(start.order) >= Number(end.order)) return Number(route?.fare || 0);
  const routeStopCount = Math.max((route.stops || []).length - 1, 1);
  const stopSpan = Math.max(Number(end.order) - Number(start.order), 1);
  const proportionalFare = (Number(route.fare || 0) / routeStopCount) * stopSpan;
  const minimumFare = Number(route.fare || 0) * 0.35;
  return roundFare(Math.max(proportionalFare, minimumFare));
};

export default function BuyOneWayTicketScreen() {
  const params = useLocalSearchParams<{ routeId?: string; ticketType?: TicketType }>();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [ticketType, setTicketType] = useState<TicketType>(params.ticketType === 'MONTHLY_PASS' ? 'MONTHLY_PASS' : 'ONE_WAY');
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [routeId, setRouteId] = useState(params.routeId || '');
  const [direction, setDirection] = useState<Direction>('OUTBOUND');
  const [boardingStop, setBoardingStop] = useState('');
  const [destinationStop, setDestinationStop] = useState('');
  const [serviceDate, setServiceDate] = useState(getVietnamDate());
  const [departureTime, setDepartureTime] = useState('');
  const [passengerType, setPassengerType] = useState<PassengerType>('STANDARD');
  const [monthlyStartDate, setMonthlyStartDate] = useState(getCurrentMonthStart());
  const [validityMonths, setValidityMonths] = useState('1');
  const [promotionCode, setPromotionCode] = useState('');
  const [appliedPromotion, setAppliedPromotion] = useState<PromotionPreview | null>(null);
  const [payment, setPayment] = useState<PaymentOrder | null>(null);
  const pendingOrderRef = useRef<PaymentOrder | null>(null);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [applyingPromotion, setApplyingPromotion] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [payosOpening, setPayosOpening] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    let mounted = true;
    const loadRoutes = async () => {
      setLoadingRoutes(true);
      setError('');
      try {
        const data = await passengerApi.searchRoutes();
        if (!mounted) return;
        const list = data.routes || [];
        setRoutes(list);
        const initial = params.routeId || toRouteId(list[0]);
        setRouteId(initial);
      } catch (err) {
        if (mounted) setError((err as { message?: string })?.message || 'Không thể tải danh sách tuyến.');
      } finally {
        if (mounted) setLoadingRoutes(false);
      }
    };
    void loadRoutes();
    return () => {
      mounted = false;
    };
  }, [params.routeId]);

  const selectedRoute = useMemo(() => routes.find((route) => (
    toRouteId(route) === routeId || route.routeNumber === routeId
  )) || null, [routeId, routes]);
  const stops = useMemo(() => getDirectionStops(selectedRoute, direction), [direction, selectedRoute]);
  const departureTimes = useMemo(() => buildDepartureTimes(selectedRoute, serviceDate), [selectedRoute, serviceDate]);
  const selectedPassengerType = passengerTypes.find((item) => item.id === passengerType) || passengerTypes[0];
  const basePrice = useMemo(() => (
    ticketType === 'MONTHLY_PASS'
      ? monthlyPrices[passengerType] * Math.max(Number(validityMonths) || 1, 1)
      : calculateOneWayPrice(selectedRoute, stops, boardingStop, destinationStop)
  ), [boardingStop, destinationStop, passengerType, selectedRoute, stops, ticketType, validityMonths]);
  const finalPrice = Math.max(Number(appliedPromotion?.finalAmount ?? basePrice) || 0, 0);
  const discountAmount = Math.max(Number(appliedPromotion?.discountAmount || 0), 0);

  useEffect(() => {
    if (!selectedRoute) return;
    const nextStops = getDirectionStops(selectedRoute, direction);
    setBoardingStop(nextStops[0]?.name || '');
    setDestinationStop(nextStops[nextStops.length - 1]?.name || '');
    setDepartureTime('');
    setAppliedPromotion(null);
    setPayment(null);
  }, [direction, selectedRoute]);

  useEffect(() => {
    if (departureTime && !departureTimes.includes(departureTime)) {
      setDepartureTime('');
    }
  }, [departureTime, departureTimes]);

  useEffect(() => {
    setAppliedPromotion(null);
    setErrors((current) => ({ ...current, promotion: undefined, price: undefined }));
    setPayment(null);
  }, [ticketType, routeId, direction, boardingStop, destinationStop, serviceDate, departureTime, passengerType, monthlyStartDate, validityMonths]);

  const validate = useCallback(() => {
    const nextErrors: FormErrors = {};
    if (!isAuthenticated) nextErrors.auth = 'Vui lòng đăng nhập trước khi mua vé.';
    if (!selectedRoute && ticketType === 'ONE_WAY') nextErrors.route = 'Vui lòng chọn tuyến.';
    if (ticketType === 'ONE_WAY') {
      if (!direction) nextErrors.direction = 'Vui lòng chọn chiều tuyến.';
      if (!boardingStop) nextErrors.boardingStop = 'Vui lòng chọn điểm lên.';
      if (!destinationStop) nextErrors.destinationStop = 'Vui lòng chọn điểm xuống.';
      const start = stops.find((stop) => stop.name === boardingStop);
      const end = stops.find((stop) => stop.name === destinationStop);
      if (start && end && Number(start.order) >= Number(end.order)) {
        nextErrors.destinationStop = 'Điểm xuống phải nằm sau điểm lên.';
      }
      if (serviceDate < getVietnamDate()) nextErrors.serviceDate = 'Không thể chọn ngày trong quá khứ.';
      if (!departureTime) nextErrors.departureTime = 'Vui lòng chọn giờ khởi hành hợp lệ.';
      if (serviceDate === getVietnamDate() && departureTime && departureTime <= getVietnamTime()) {
        nextErrors.departureTime = 'Giờ khởi hành đã qua.';
      }
    }
    if (!passengerType) nextErrors.passengerType = 'Vui lòng chọn loại hành khách.';
    if (ticketType === 'MONTHLY_PASS') {
      if (monthlyStartDate < getCurrentMonthStart()) nextErrors.serviceDate = 'Không thể đặt vé tháng cho tháng đã qua.';
      if ((Number(validityMonths) || 0) < 1) nextErrors.serviceDate = 'Thời hạn vé tháng không hợp lệ.';
    }
    if (promotionCode.trim() && !appliedPromotion) nextErrors.promotion = 'Vui lòng áp dụng mã khuyến mãi trước khi thanh toán.';
    if (basePrice < 0) nextErrors.price = 'Không tính được giá vé.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [
    appliedPromotion,
    basePrice,
    boardingStop,
    departureTime,
    destinationStop,
    direction,
    isAuthenticated,
    monthlyStartDate,
    passengerType,
    promotionCode,
    selectedRoute,
    serviceDate,
    stops,
    ticketType,
    validityMonths,
  ]);

  const chooseRoute = (route: BusRoute) => {
    setRouteId(toRouteId(route));
    setDirection('OUTBOUND');
    setErrors({});
  };

  const switchTicketType = (nextType: TicketType) => {
    setTicketType(nextType);
    setAppliedPromotion(null);
    setPromotionCode('');
    setPayment(null);
    setErrors({});
  };

  const applyPromotion = async () => {
    const code = promotionCode.trim().toUpperCase();
    if (!code) {
      setErrors((current) => ({ ...current, promotion: 'Vui lòng nhập mã khuyến mãi.' }));
      return;
    }
    setApplyingPromotion(true);
    setErrors((current) => ({ ...current, promotion: undefined }));
    try {
      const promotion = await passengerApi.applyPromotion({
        promotionCode: code,
        ticketType,
        routeId: ticketType === 'ONE_WAY' ? toRouteId(selectedRoute) : undefined,
        amount: basePrice,
      });
      setAppliedPromotion(promotion);
      setPromotionCode(promotion.promotionCode || code);
    } catch (err) {
      setAppliedPromotion(null);
      setErrors((current) => ({
        ...current,
        promotion: (err as { message?: string })?.message || 'Không thể áp dụng mã khuyến mãi.',
      }));
    } finally {
      setApplyingPromotion(false);
    }
  };

  const checkPayment = useCallback(async (orderCode?: number | string) => {
    const code = orderCode || pendingOrderRef.current?.orderCode;
    if (!code) return;
    setCheckingPayment(true);
    try {
      const status = await passengerApi.getPaymentStatus(code);
      setPayment((current) => ({ ...(current || {}), ...status }));
      pendingOrderRef.current = { ...(pendingOrderRef.current || {}), ...status };
      if (status.status === 'PAID') {
        Alert.alert('Thanh toán thành công', 'Vé đã được kích hoạt và sẽ hiển thị trong Vé của tôi.', [
          { text: 'Xem vé', onPress: () => router.replace('/my-tickets') },
        ]);
      } else if (status.status === 'CANCELLED' || status.status === 'FAILED') {
        setError('Thanh toán chưa hoàn tất hoặc đã bị hủy.');
      }
    } catch (err) {
      setError((err as { message?: string })?.message || 'Không thể kiểm tra trạng thái thanh toán.');
    } finally {
      setCheckingPayment(false);
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && pendingOrderRef.current?.orderCode) {
        void checkPayment(pendingOrderRef.current.orderCode);
      }
    });
    const linkSubscription = Linking.addEventListener('url', () => {
      if (pendingOrderRef.current?.orderCode) {
        void checkPayment(pendingOrderRef.current.orderCode);
      }
    });
    return () => {
      subscription.remove();
      linkSubscription.remove();
    };
  }, [checkPayment]);

  const submit = async () => {
    if (creatingOrder || applyingPromotion || checkingPayment || loadingRoutes) return;
    setError('');
    if (!validate()) return;

    setCreatingOrder(true);
    try {
      const payload = ticketType === 'MONTHLY_PASS'
        ? {
          ticketType,
          passType: passengerType,
          routeId: routeId || undefined,
          routeCode: routeId ? undefined : 'ALL',
          startDate: monthlyStartDate,
          validityMonths: Math.max(Number(validityMonths) || 1, 1),
          promotionCode: appliedPromotion?.promotionCode || '',
        }
        : {
          ticketType,
          routeId: toRouteId(selectedRoute),
          direction,
          departureLocation: boardingStop,
          destinationLocation: destinationStop,
          serviceDate,
          departureTime,
          passengerType,
          promotionCode: appliedPromotion?.promotionCode || '',
        };

      const nextPayment = await passengerApi.createPayment(payload);
      setPayment(nextPayment);
      pendingOrderRef.current = nextPayment;

      if (nextPayment.status === 'PAID') {
        Alert.alert('Thanh toán thành công', nextPayment.message || 'Vé đã được kích hoạt.', [
          { text: 'Xem vé', onPress: () => router.replace('/my-tickets') },
        ]);
        return;
      }

      if (nextPayment.checkoutUrl) {
        setPayosOpening(true);
        await Linking.openURL(nextPayment.checkoutUrl);
      } else {
        Alert.alert('Đang chờ thanh toán', `Mã đơn ${nextPayment.orderCode || ''} đang chờ xác minh.`);
      }
    } catch (err) {
      setError((err as { message?: string })?.message || 'Không thể tạo đơn thanh toán.');
    } finally {
      setPayosOpening(false);
      setCreatingOrder(false);
    }
  };

  return (
    <PassengerLayout active="tickets" subtitle="Đồng bộ theo luồng mua vé Web" title="Mua vé xe buýt">
      {loadingRoutes ? <LoadingState label="Đang tải danh sách tuyến" /> : null}
      {!loadingRoutes && error && !routes.length ? <EmptyState icon="alert-circle-outline" title="Không thể tải tuyến" detail={error} /> : null}
      {!loadingRoutes && !error && !routes.length ? <EmptyState icon="map-marker-off-outline" title="Chưa có tuyến" detail="Không có tuyến đang hoạt động để mua vé." /> : null}

      {!loadingRoutes && routes.length ? (
        <>
          <View style={styles.tabs}>
            <TabButton active={ticketType === 'ONE_WAY'} label="Vé một lượt" onPress={() => switchTicketType('ONE_WAY')} />
            <TabButton active={ticketType === 'MONTHLY_PASS'} label="Vé tháng" onPress={() => switchTicketType('MONTHLY_PASS')} />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Tuyến</Text>
            <View style={styles.routeList}>
              {routes.map((route) => {
                const active = toRouteId(route) === routeId;
                return (
                  <Pressable key={toRouteId(route) || route.routeNumber} onPress={() => chooseRoute(route)} style={[styles.routeItem, active && styles.routeItemActive]}>
                    <View style={styles.routeBadge}>
                      <Text style={styles.routeBadgeText}>{route.routeNumber}</Text>
                    </View>
                    <View style={styles.routeCopy}>
                      <Text numberOfLines={1} style={styles.routeName}>{route.name}</Text>
                      <Text numberOfLines={1} style={styles.routeMeta}>{route.origin} → {route.destination}</Text>
                    </View>
                    <StatusPill label={route.status || 'ACTIVE'} tone={active ? 'success' : 'neutral'} />
                  </Pressable>
                );
              })}
            </View>
            {errors.route ? <FieldError message={errors.route} /> : null}
          </View>

          {ticketType === 'ONE_WAY' ? (
            <>
              <View style={styles.section}>
                <Text style={styles.label}>Chiều tuyến</Text>
                <View style={styles.choiceWrap}>
                  {(['OUTBOUND', 'INBOUND'] as Direction[]).map((item) => {
                    const itemStops = getDirectionStops(selectedRoute, item);
                    const label = item === 'OUTBOUND' ? 'Chiều đi' : 'Chiều về';
                    return (
                      <Pressable key={item} onPress={() => setDirection(item)} style={[styles.choice, direction === item && styles.choiceActive]}>
                        <Text style={[styles.choiceTitle, direction === item && styles.choiceTitleActive]}>{label}</Text>
                        <Text numberOfLines={2} style={[styles.choiceText, direction === item && styles.choiceTextActive]}>
                          {itemStops[0]?.name || '-'} → {itemStops[itemStops.length - 1]?.name || '-'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {errors.direction ? <FieldError message={errors.direction} /> : null}
              </View>

              <StopSelector label="Điểm lên" selected={boardingStop} stops={stops} onSelect={(value) => setBoardingStop(value)} />
              {errors.boardingStop ? <FieldError message={errors.boardingStop} /> : null}
              <StopSelector
                label="Điểm xuống"
                selected={destinationStop}
                stops={stops.filter((stop) => Number(stop.order) > Number(stops.find((item) => item.name === boardingStop)?.order || 0))}
                onSelect={(value) => setDestinationStop(value)}
              />
              {errors.destinationStop ? <FieldError message={errors.destinationStop} /> : null}

              <Field label="Ngày khởi hành" minLabel={`Từ ${getVietnamDate()}`} value={serviceDate} onChangeText={setServiceDate} placeholder="YYYY-MM-DD" />
              {errors.serviceDate ? <FieldError message={errors.serviceDate} /> : null}

              <View style={styles.section}>
                <Text style={styles.label}>Giờ khởi hành</Text>
                {departureTimes.length ? (
                  <View style={styles.timeGrid}>
                    {departureTimes.map((time) => (
                      <Pressable key={time} onPress={() => setDepartureTime(time)} style={[styles.timeChip, departureTime === time && styles.timeChipActive]}>
                        <Text style={[styles.timeText, departureTime === time && styles.timeTextActive]}>{time}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyInline}>
                    <MaterialCommunityIcons color={colors.secondary} name="clock-alert-outline" size={20} />
                    <Text style={styles.emptyInlineText}>Không có chuyến hợp lệ trong ngày đã chọn.</Text>
                  </View>
                )}
                {errors.departureTime ? <FieldError message={errors.departureTime} /> : null}
              </View>
            </>
          ) : (
            <>
              <Field label="Ngày bắt đầu" minLabel={`Từ ${getCurrentMonthStart()}`} value={monthlyStartDate} onChangeText={setMonthlyStartDate} placeholder="YYYY-MM-DD" />
              <Field label="Số tháng hiệu lực" value={validityMonths} onChangeText={setValidityMonths} keyboardType="number-pad" />
              {errors.serviceDate ? <FieldError message={errors.serviceDate} /> : null}
            </>
          )}

          <View style={styles.section}>
            <Text style={styles.label}>Loại hành khách</Text>
            <View style={styles.choiceWrap}>
              {passengerTypes.map((item) => (
                <Pressable key={item.id} onPress={() => setPassengerType(item.id)} style={[styles.passengerChip, passengerType === item.id && styles.choiceActive]}>
                  <Text style={[styles.choiceTitle, passengerType === item.id && styles.choiceTitleActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
            {selectedPassengerType.note ? <Text style={styles.warningText}>{selectedPassengerType.note}</Text> : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Mã khuyến mãi</Text>
            <View style={styles.promoRow}>
              <TextInput
                autoCapitalize="characters"
                onChangeText={(value) => {
                  setPromotionCode(value.toUpperCase());
                  setAppliedPromotion(null);
                  setErrors((current) => ({ ...current, promotion: undefined }));
                }}
                placeholder="Nhập mã"
                placeholderTextColor={colors.secondary}
                style={styles.promoInput}
                value={promotionCode}
              />
              <Pressable disabled={applyingPromotion || !promotionCode.trim()} onPress={applyPromotion} style={[styles.applyButton, (applyingPromotion || !promotionCode.trim()) && styles.disabled]}>
                <Text style={styles.applyButtonText}>{applyingPromotion ? 'Đang...' : 'Áp dụng'}</Text>
              </Pressable>
            </View>
            {appliedPromotion ? (
              <View style={styles.successBox}>
                <MaterialCommunityIcons color="#06613f" name="check-circle-outline" size={18} />
                <Text style={styles.successText}>Đã áp dụng {appliedPromotion.promotionCode}. Giảm {currency.format(discountAmount)}.</Text>
              </View>
            ) : null}
            {appliedPromotion ? (
              <Pressable onPress={() => { setAppliedPromotion(null); setPromotionCode(''); }} style={styles.clearPromo}>
                <Text style={styles.clearPromoText}>Bỏ mã khuyến mãi</Text>
              </Pressable>
            ) : null}
            {errors.promotion ? <FieldError message={errors.promotion} /> : null}
          </View>

          <View style={styles.summary}>
            <View style={styles.summaryTop}>
              <View>
                <Text style={styles.summaryTitle}>Tóm tắt hành trình</Text>
                <Text style={styles.summarySub}>{ticketType === 'ONE_WAY' ? 'Vé một lượt' : 'Vé tháng'} - {selectedPassengerType.label}</Text>
              </View>
              <MaterialCommunityIcons color={colors.primary} name="ticket-confirmation-outline" size={24} />
            </View>
            <SummaryLine label="Tuyến" value={selectedRoute ? `${selectedRoute.routeNumber} - ${selectedRoute.name}` : 'Chưa chọn'} />
            <SummaryLine label="Chiều tuyến" value={ticketType === 'ONE_WAY' ? `${stops[0]?.name || '-'} → ${stops[stops.length - 1]?.name || '-'}` : selectedRoute ? selectedRoute.routeNumber : 'Toàn mạng'} />
            <SummaryLine label="Hành trình" value={ticketType === 'ONE_WAY' ? `${boardingStop || '-'} → ${destinationStop || '-'}` : `${monthlyStartDate} → ${buildMonthEnd(monthlyStartDate, Number(validityMonths) || 1)}`} />
            <SummaryLine label="Khởi hành" value={ticketType === 'ONE_WAY' ? `${serviceDate} ${departureTime || '--:--'}` : `${Math.max(Number(validityMonths) || 1, 1)} tháng`} />
            <View style={styles.priceBox}>
              <SummaryLine label="Giá gốc" value={currency.format(basePrice)} />
              <SummaryLine label="Khuyến mãi" value={discountAmount ? `-${currency.format(discountAmount)}` : 'Không có'} />
              <SummaryLine label="Tổng thanh toán" value={currency.format(finalPrice)} strong />
            </View>
          </View>

          {payment?.orderCode ? (
            <View style={styles.paymentBox}>
              <View style={styles.paymentHeader}>
                <Text style={styles.paymentTitle}>Đơn PayOS #{payment.orderCode}</Text>
                <StatusPill label={payment.status || 'PENDING'} tone={payment.status === 'PAID' ? 'success' : payment.status === 'CANCELLED' || payment.status === 'FAILED' ? 'danger' : 'warning'} />
              </View>
              <Text style={styles.paymentText}>Không phát hành vé chỉ dựa vào redirect. Ứng dụng sẽ kiểm tra lại trạng thái từ backend.</Text>
              <AppButton disabled={checkingPayment} loading={checkingPayment} onPress={() => void checkPayment(payment.orderCode)} title="Kiểm tra lại trạng thái thanh toán" variant="secondary" />
            </View>
          ) : null}

          {error ? <FieldError message={error} /> : null}
          {errors.auth ? <FieldError message={errors.auth} /> : null}
          {errors.price ? <FieldError message={errors.price} /> : null}

          <AppButton
            disabled={loadingRoutes || applyingPromotion || checkingPayment || creatingOrder || payosOpening}
            loading={creatingOrder || payosOpening}
            onPress={submit}
            title={payosOpening ? 'Đang mở PayOS' : 'Tiếp tục thanh toán'}
          />
          <AppButton onPress={() => router.push('/my-tickets')} title="Vé của tôi" variant="secondary" />
        </>
      ) : null}
    </PassengerLayout>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  minLabel,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad';
  minLabel?: string;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.fieldHeader}>
        <Text style={styles.label}>{label}</Text>
        {minLabel ? <Text style={styles.hint}>{minLabel}</Text> : null}
      </View>
      <TextInput
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.secondary}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function StopSelector({
  label,
  selected,
  stops,
  onSelect,
}: {
  label: string;
  selected: string;
  stops: BusRouteStop[];
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      {stops.length ? (
        <View style={styles.stopWrap}>
          {stops.map((stop) => {
            const active = stop.name === selected;
            return (
              <Pressable key={`${stop.name}-${stop.order}`} onPress={() => onSelect(stop.name)} style={[styles.stopChip, active && styles.stopChipActive]}>
                <Text numberOfLines={1} style={[styles.stopText, active && styles.stopTextActive]}>{stop.order}. {stop.name}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyInline}>
          <MaterialCommunityIcons color={colors.secondary} name="map-marker-off-outline" size={20} />
          <Text style={styles.emptyInlineText}>Không có trạm hợp lệ.</Text>
        </View>
      )}
    </View>
  );
}

function SummaryLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, strong && styles.summaryStrong]}>{value}</Text>
    </View>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <View style={styles.errorBox}>
      <MaterialCommunityIcons color={colors.error} name="alert-circle-outline" size={18} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, borderRadius: 16, backgroundColor: colors.card, padding: 5 },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingHorizontal: 8 },
  tabActive: { backgroundColor: colors.primaryContainer },
  tabText: { color: colors.secondary, fontSize: 13, fontWeight: '900' },
  tabTextActive: { color: colors.white },
  section: { gap: 9 },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  hint: { color: colors.secondary, fontSize: 11, fontWeight: '700' },
  routeList: { gap: 8 },
  routeItem: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, backgroundColor: colors.card, padding: 12 },
  routeItemActive: { borderWidth: 1, borderColor: colors.primaryContainer, backgroundColor: '#d8f6e7' },
  routeBadge: { minWidth: 54, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary },
  routeBadgeText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  routeCopy: { flex: 1, minWidth: 0 },
  routeName: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  routeMeta: { marginTop: 2, color: colors.secondary, fontSize: 11, fontWeight: '700' },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { flexGrow: 1, flexBasis: '48%', minHeight: 56, justifyContent: 'center', gap: 3, borderRadius: 16, backgroundColor: colors.card, padding: 12 },
  choiceActive: { backgroundColor: colors.primaryContainer },
  choiceTitle: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  choiceTitleActive: { color: colors.white },
  choiceText: { color: colors.secondary, fontSize: 11, fontWeight: '700' },
  choiceTextActive: { color: colors.white },
  passengerChip: { minHeight: 44, justifyContent: 'center', borderRadius: 16, backgroundColor: colors.card, paddingHorizontal: 12 },
  stopWrap: { gap: 8 },
  stopChip: { minHeight: 44, justifyContent: 'center', borderRadius: 16, backgroundColor: colors.card, paddingHorizontal: 12 },
  stopChipActive: { backgroundColor: '#d8f6e7' },
  stopText: { color: colors.secondary, fontSize: 12, fontWeight: '800' },
  stopTextActive: { color: colors.primary },
  input: { minHeight: 52, borderRadius: 16, backgroundColor: colors.card, paddingHorizontal: 14, color: colors.text, fontSize: 14, fontWeight: '800' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { minWidth: 72, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.card, paddingHorizontal: 10 },
  timeChipActive: { backgroundColor: colors.primaryContainer },
  timeText: { color: colors.secondary, fontSize: 13, fontWeight: '900' },
  timeTextActive: { color: colors.white },
  promoRow: { flexDirection: 'row', gap: 8 },
  promoInput: { minHeight: 52, flex: 1, borderRadius: 16, backgroundColor: colors.card, paddingHorizontal: 14, color: colors.text, fontSize: 14, fontWeight: '900' },
  applyButton: { minWidth: 94, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.primaryContainer, paddingHorizontal: 12 },
  applyButtonText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  clearPromo: { alignSelf: 'flex-start' },
  clearPromoText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  successBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, backgroundColor: '#d8f6e7', padding: 12 },
  successText: { flex: 1, color: '#06613f', fontSize: 12, fontWeight: '800' },
  warningText: { color: '#6f5200', fontSize: 12, lineHeight: 18, fontWeight: '800' },
  emptyInline: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, backgroundColor: colors.card, padding: 12 },
  emptyInlineText: { flex: 1, color: colors.secondary, fontSize: 12, fontWeight: '800' },
  summary: { gap: 10, borderRadius: 20, backgroundColor: colors.card, padding: 16 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  summaryTitle: { color: colors.primary, fontSize: 17, fontWeight: '900' },
  summarySub: { marginTop: 2, color: colors.secondary, fontSize: 12, fontWeight: '800' },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { flex: 0.42, color: colors.secondary, fontSize: 12, fontWeight: '800' },
  summaryValue: { flex: 0.58, color: colors.primary, fontSize: 12, fontWeight: '900', textAlign: 'right' },
  summaryStrong: { fontSize: 15 },
  priceBox: { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outline, paddingTop: 10 },
  paymentBox: { gap: 12, borderRadius: 20, backgroundColor: '#fff4cc', padding: 16 },
  paymentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  paymentTitle: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  paymentText: { color: '#6f5200', fontSize: 12, lineHeight: 18, fontWeight: '800' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, backgroundColor: colors.errorContainer, padding: 12 },
  errorText: { flex: 1, color: colors.error, fontSize: 12, fontWeight: '800' },
});
