import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
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
type MonthOption = { value: string; label: string; startDate: string; endDate: string };
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

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

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

const formatMonthDate = (date: Date) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

const buildStartMonthOptions = (): MonthOption[] => {
  const [currentYear, currentMonth] = getVietnamDate().split('-').map(Number);
  return Array.from({ length: 6 }, (_, offset) => {
    const monthDate = new Date(currentYear, currentMonth - 1 + offset, 1);
    const startDate = formatMonthDate(monthDate);
    const endDate = formatMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
    return {
      value: startDate.slice(0, 7),
      label: `${String(monthDate.getMonth() + 1).padStart(2, '0')}/${monthDate.getFullYear()}`,
      startDate,
      endDate,
    };
  });
};

const toRouteId = (route?: BusRoute | null) => String(route?.id || route?._id || '');

const roundFare = (value: number) => {
  if (value <= 0) return 0;
  return Math.max(Math.round(value / 1000) * 1000, 1000);
};

const buildMonthEnd = (startDate: string) => {
  const [year, month, day] = startDate.split('-').map(Number);
  const start = new Date(year, month - 1, day || 1);
  return formatMonthDate(new Date(start.getFullYear(), start.getMonth() + 1, 0));
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
    if (serviceDate > today || cursor > now) times.push(cursor);
    cursor = addMinutesToTime(cursor, frequency);
  }
  return times;
};

const getDirectionStops = (route?: BusRoute | null, direction: Direction = 'OUTBOUND') => (
  direction === 'INBOUND'
    ? route?.directions?.INBOUND?.stops || []
    : route?.directions?.OUTBOUND?.stops || route?.stops || []
);

const getDirectionOptions = (route?: BusRoute | null) => {
  const outboundStops = getDirectionStops(route, 'OUTBOUND');
  const inboundStops = getDirectionStops(route, 'INBOUND');
  const options: Array<{ id: Direction; label: string; stops: BusRouteStop[] }> = [];
  if (outboundStops.length >= 2) options.push({ id: 'OUTBOUND', label: 'Chiều đi', stops: outboundStops });
  if (inboundStops.length >= 2) options.push({ id: 'INBOUND', label: 'Chiều về', stops: inboundStops });
  return options;
};

const routeMatches = (route: BusRoute, query: string) => {
  const text = [route.routeNumber, route.name, route.origin, route.destination].join(' ').toLowerCase();
  return text.includes(query.trim().toLowerCase());
};

export default function BuyOneWayTicketScreen() {
  const params = useLocalSearchParams<{ routeId?: string; ticketType?: TicketType }>();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [ticketType, setTicketType] = useState<TicketType>(params.ticketType === 'MONTHLY_PASS' ? 'MONTHLY_PASS' : 'ONE_WAY');
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [routeId, setRouteId] = useState(params.routeId || '');
  const [direction, setDirection] = useState<Direction>('OUTBOUND');
  const [serviceDate, setServiceDate] = useState(getVietnamDate());
  const [departureTime, setDepartureTime] = useState('');
  const [passengerType, setPassengerType] = useState<PassengerType>('STANDARD');
  const [monthlyStartDate, setMonthlyStartDate] = useState(getCurrentMonthStart());
  const [startMonthOpen, setStartMonthOpen] = useState(false);
  const [promotionCode, setPromotionCode] = useState('');
  const [appliedPromotion, setAppliedPromotion] = useState<PromotionPreview | null>(null);
  const [payment, setPayment] = useState<PaymentOrder | null>(null);
  const pendingOrderRef = useRef<PaymentOrder | null>(null);
  const [routeSelectorOpen, setRouteSelectorOpen] = useState(false);
  const [dateSelectorOpen, setDateSelectorOpen] = useState<null | 'ONE_WAY' | 'MONTHLY_PASS'>(null);
  const [routeQuery, setRouteQuery] = useState('');
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
        setRouteId(params.routeId || toRouteId(list[0]));
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

  const selectedRoute = useMemo(() => routes.find((route) => toRouteId(route) === routeId || route.routeNumber === routeId) || null, [routeId, routes]);
  const directionOptions = useMemo(() => getDirectionOptions(selectedRoute), [selectedRoute]);
  const selectedDirection = directionOptions.find((item) => item.id === direction) || directionOptions[0] || null;
  const departureTimes = useMemo(() => buildDepartureTimes(selectedRoute, serviceDate), [selectedRoute, serviceDate]);
  const startMonthOptions = useMemo(() => buildStartMonthOptions(), []);
  const selectedStartMonth = startMonthOptions.find((option) => option.startDate === monthlyStartDate)
    || startMonthOptions[0]
    || {
      value: getCurrentMonthStart().slice(0, 7),
      label: getCurrentMonthStart().slice(5, 7) + '/' + getCurrentMonthStart().slice(0, 4),
      startDate: getCurrentMonthStart(),
      endDate: buildMonthEnd(getCurrentMonthStart()),
    };
  const selectedPassengerType = passengerTypes.find((item) => item.id === passengerType) || passengerTypes[0];
  const basePrice = useMemo(() => (
    ticketType === 'MONTHLY_PASS'
      ? monthlyPrices[passengerType]
      : calculateOneWayPrice(selectedRoute, stops, boardingStop, destinationStop)
  ), [boardingStop, destinationStop, passengerType, selectedRoute, stops, ticketType]);
  const finalPrice = Math.max(Number(appliedPromotion?.finalAmount ?? basePrice) || 0, 0);
  const discountAmount = Math.max(Number(appliedPromotion?.discountAmount || 0), 0);
  const filteredRoutes = useMemo(() => routes.filter((route) => routeMatches(route, routeQuery)), [routeQuery, routes]);

  useEffect(() => {
    if (!selectedRoute) return;
    const nextDirections = getDirectionOptions(selectedRoute);
    setDirection(nextDirections[0]?.id || 'OUTBOUND');
    setDepartureTime('');
    setAppliedPromotion(null);
    setPayment(null);
    pendingOrderRef.current = null;
  }, [selectedRoute]);

  useEffect(() => {
    if (departureTime && !departureTimes.includes(departureTime)) setDepartureTime('');
  }, [departureTime, departureTimes]);

  useEffect(() => {
    setAppliedPromotion(null);
    setErrors((current) => ({ ...current, promotion: undefined, price: undefined }));
    setPayment(null);
  }, [ticketType, routeId, direction, boardingStop, destinationStop, serviceDate, departureTime, passengerType, monthlyStartDate]);

  const validate = useCallback(() => {
    const nextErrors: FormErrors = {};
    if (!isAuthenticated) nextErrors.auth = 'Vui lòng đăng nhập trước khi mua vé.';
    if (!selectedRoute) nextErrors.route = 'Vui lòng chọn tuyến.';
    if (ticketType === 'ONE_WAY') {
      if (!selectedDirection) nextErrors.direction = 'Vui lòng chọn chiều tuyến.';
      if (serviceDate < getVietnamDate()) nextErrors.serviceDate = 'Không thể chọn ngày trong quá khứ.';
      if (!departureTime) nextErrors.departureTime = 'Vui lòng chọn giờ khởi hành hợp lệ.';
      if (serviceDate === getVietnamDate() && departureTime && departureTime <= getVietnamTime()) nextErrors.departureTime = 'Giờ khởi hành đã qua.';
    }
    if (!passengerType) nextErrors.passengerType = 'Vui lòng chọn loại hành khách.';
    if (ticketType === 'MONTHLY_PASS') {
      if (!startMonthOptions.some((option) => option.startDate === monthlyStartDate)) {
        nextErrors.serviceDate = 'Start Month không hợp lệ. Vui lòng chọn từ tháng hiện tại đến 5 tháng tới.';
      }
    }
    if (promotionCode.trim() && !appliedPromotion) nextErrors.promotion = 'Vui lòng áp dụng mã khuyến mãi trước khi thanh toán.';
    if (basePrice < 0) nextErrors.price = 'Không tính được giá vé.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [
    appliedPromotion,
    basePrice,
    departureTime,
    direction,
    isAuthenticated,
    monthlyStartDate,
    passengerType,
    promotionCode,
    selectedRoute,
    serviceDate,
    startMonthOptions,
    ticketType,
  ]);

  const chooseRoute = (route: BusRoute) => {
    setRouteId(toRouteId(route));
    setRouteSelectorOpen(false);
    setRouteQuery('');
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
      setErrors((current) => ({ ...current, promotion: (err as { message?: string })?.message || 'Không thể áp dụng mã khuyến mãi.' }));
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
    const appSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && pendingOrderRef.current?.orderCode) void checkPayment(pendingOrderRef.current.orderCode);
    });
    const linkSubscription = Linking.addEventListener('url', () => {
      if (pendingOrderRef.current?.orderCode) void checkPayment(pendingOrderRef.current.orderCode);
    });
    return () => {
      appSubscription.remove();
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
          validityMonths: 1,
          promotionCode: appliedPromotion?.promotionCode || '',
        }
        : {
          ticketType,
          routeId: toRouteId(selectedRoute),
          direction,
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

  const payDisabled = loadingRoutes || applyingPromotion || checkingPayment || creatingOrder || payosOpening;

  return (
    <PassengerLayout active="tickets" subtitle="Chọn tuyến, chiều và thanh toán PayOS" title="Mua vé xe buýt">
      {loadingRoutes ? <LoadingState label="Đang tải tuyến" /> : null}
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
            <Pressable accessibilityLabel="Chọn tuyến" onPress={() => setRouteSelectorOpen(true)} style={styles.selectorField}>
              <View style={styles.routeBadge}>
                <Text style={styles.routeBadgeText}>{selectedRoute?.routeNumber || '--'}</Text>
              </View>
              <View style={styles.selectorCopy}>
                <Text numberOfLines={1} style={styles.selectorTitle}>{selectedRoute?.name || 'Chọn tuyến'}</Text>
                <Text numberOfLines={1} style={styles.selectorMeta}>
                  {selectedRoute ? `${selectedRoute.origin} → ${selectedRoute.destination}` : 'Tìm theo mã, tên tuyến hoặc điểm đầu/cuối'}
                </Text>
              </View>
              <MaterialCommunityIcons color={colors.secondary} name="chevron-down" size={22} />
            </Pressable>
            {errors.route ? <FieldError message={errors.route} /> : null}
          </View>

          {ticketType === 'ONE_WAY' ? (
            <>
              <View style={styles.section}>
                <Text style={styles.label}>Chiều tuyến</Text>
                {directionOptions.length ? (
                  <View style={styles.directionGrid}>
                    {directionOptions.map((item) => (
                      <Pressable key={item.id} accessibilityLabel={item.label} onPress={() => setDirection(item.id)} style={[styles.directionChip, direction === item.id && styles.directionChipActive]}>
                        <Text style={[styles.directionTitle, direction === item.id && styles.directionTextActive]}>{item.label}</Text>
                        <Text numberOfLines={2} style={[styles.directionPath, direction === item.id && styles.directionTextActive]}>
                          {item.stops[0]?.name} → {item.stops[item.stops.length - 1]?.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <InlineState icon="swap-horizontal" text="Không có chiều tuyến hợp lệ." />
                )}
                {errors.direction ? <FieldError message={errors.direction} /> : null}
              </View>

              <DateField label="Ngày khởi hành" onPress={() => setDateSelectorOpen('ONE_WAY')} value={serviceDate} />
              {errors.serviceDate ? <FieldError message={errors.serviceDate} /> : null}

              <View style={styles.section}>
                <Text style={styles.label}>Giờ khởi hành</Text>
                {departureTimes.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeRow}>
                    {departureTimes.map((time) => (
                      <Pressable key={time} accessibilityLabel={`Giờ ${time}`} onPress={() => setDepartureTime(time)} style={[styles.timeChip, departureTime === time && styles.timeChipActive]}>
                        <Text style={[styles.timeText, departureTime === time && styles.timeTextActive]}>{time}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : (
                  <InlineState icon="clock-alert-outline" text="Không có giờ khởi hành hợp lệ trong ngày đã chọn." />
                )}
                {errors.departureTime ? <FieldError message={errors.departureTime} /> : null}
              </View>
            </>
          ) : (
            <>
              <StartMonthDropdown
                label="Start Month"
                options={startMonthOptions}
                selected={selectedStartMonth}
                visible={startMonthOpen}
                onClose={() => setStartMonthOpen(false)}
                onOpen={() => setStartMonthOpen(true)}
                onSelect={(option) => {
                  setMonthlyStartDate(option.startDate);
                  setStartMonthOpen(false);
                }}
              />
              <View style={styles.emptyInline}>
                <MaterialCommunityIcons color={colors.secondary} name="calendar-range-outline" size={20} />
                <Text style={styles.emptyInlineText}>Hiệu lực từ {selectedStartMonth.startDate} đến {selectedStartMonth.endDate}</Text>
              </View>
              {errors.serviceDate ? <FieldError message={errors.serviceDate} /> : null}
            </>
          )}

          <View style={styles.section}>
            <Text style={styles.label}>Loại hành khách</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeRow}>
              {passengerTypes.map((item) => (
                <Pressable key={item.id} accessibilityLabel={item.label} onPress={() => setPassengerType(item.id)} style={[styles.passengerChip, passengerType === item.id && styles.passengerChipActive]}>
                  <Text numberOfLines={1} style={[styles.passengerText, passengerType === item.id && styles.passengerTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {selectedPassengerType.note ? <Text style={styles.warningText}>{selectedPassengerType.note}</Text> : null}
          </View>

          <View style={styles.promoCard}>
            <Text style={styles.label}>Mã khuyến mãi</Text>
            <View style={styles.promoRow}>
              <TextInput
                accessibilityLabel="Mã khuyến mãi"
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
              <Pressable accessibilityLabel="Áp dụng mã khuyến mãi" disabled={applyingPromotion || !promotionCode.trim()} onPress={applyPromotion} style={[styles.applyButton, (applyingPromotion || !promotionCode.trim()) && styles.disabled]}>
                <Text style={styles.applyButtonText}>{applyingPromotion ? 'Đang...' : 'Áp dụng'}</Text>
              </Pressable>
            </View>
            {appliedPromotion ? (
              <View style={styles.successBox}>
                <MaterialCommunityIcons color="#06613f" name="check-circle-outline" size={18} />
                <Text style={styles.successText}>Đã áp dụng {appliedPromotion.promotionCode}. Giảm {currency.format(discountAmount)}.</Text>
                <Pressable accessibilityLabel="Bỏ mã khuyến mãi" onPress={() => { setAppliedPromotion(null); setPromotionCode(''); }}>
                  <MaterialCommunityIcons color={colors.primary} name="close" size={18} />
                </Pressable>
              </View>
            ) : null}
            {errors.promotion ? <FieldError message={errors.promotion} /> : null}
          </View>

          <View style={styles.summary}>
            <View style={styles.summaryTop}>
              <View style={styles.summaryTitleWrap}>
                <Text style={styles.summaryTitle}>Tóm tắt</Text>
                <Text style={styles.summarySub}>{ticketType === 'ONE_WAY' ? 'Vé một lượt' : 'Vé tháng'} · {selectedPassengerType.label}</Text>
              </View>
              <Text style={styles.totalText}>{currency.format(finalPrice)}</Text>
            </View>
            <SummaryLine label="Tuyến" value={selectedRoute ? `${selectedRoute.routeNumber} - ${selectedRoute.name}` : 'Chưa chọn'} />
            <SummaryLine label="Chiều tuyến" value={ticketType === 'ONE_WAY' ? `${stops[0]?.name || '-'} → ${stops[stops.length - 1]?.name || '-'}` : selectedRoute ? selectedRoute.routeNumber : 'Toàn mạng'} />
            <SummaryLine label="Hành trình" value={ticketType === 'ONE_WAY' ? `${boardingStop || '-'} → ${destinationStop || '-'}` : `${monthlyStartDate} → ${buildMonthEnd(monthlyStartDate)}`} />
            <SummaryLine label="Khởi hành" value={ticketType === 'ONE_WAY' ? `${serviceDate} ${departureTime || '--:--'}` : selectedStartMonth.label} />
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
              <Text style={styles.paymentText}>Ứng dụng sẽ kiểm tra trạng thái từ backend trước khi hiển thị vé.</Text>
              <AppButton disabled={checkingPayment} loading={checkingPayment} onPress={() => void checkPayment(payment.orderCode)} title="Kiểm tra lại trạng thái" variant="secondary" />
            </View>
          ) : null}

          {error ? <FieldError message={error} /> : null}
          {errors.auth ? <FieldError message={errors.auth} /> : null}
          {errors.price ? <FieldError message={errors.price} /> : null}

          <View style={styles.footerSpace} />
          <AppButton disabled={payDisabled} loading={creatingOrder || payosOpening} onPress={submit} title={`${payosOpening ? 'Đang mở PayOS' : 'Tiếp tục thanh toán'} · ${currency.format(finalPrice)}`} />
          <AppButton onPress={() => router.push('/my-tickets')} title="Vé của tôi" variant="secondary" />

          <RouteSelectorModal
            onClose={() => setRouteSelectorOpen(false)}
            onQueryChange={setRouteQuery}
            onSelect={chooseRoute}
            open={routeSelectorOpen}
            query={routeQuery}
            routes={filteredRoutes}
            selectedRouteId={routeId}
          />
          <DateSelectorModal
            mode={dateSelectorOpen}
            onClose={() => setDateSelectorOpen(null)}
            onSelect={(value) => {
              if (dateSelectorOpen === 'MONTHLY_PASS') {
                setMonthlyStartDate(value);
              } else {
                setServiceDate(value);
              }
              setDateSelectorOpen(null);
            }}
            selectedDate={dateSelectorOpen === 'MONTHLY_PASS' ? monthlyStartDate : serviceDate}
          />
        </>
      ) : null}
    </PassengerLayout>
  );
}

function formatVietnamDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function buildDateOptions(mode: 'ONE_WAY' | 'MONTHLY_PASS') {
  if (mode === 'MONTHLY_PASS') {
    const [year, month] = getCurrentMonthStart().split('-').map(Number);
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(year, month - 1 + index, 1, 12, 0, 0);
      const value = formatVietnamDate(date);
      return { value, label: `Tháng ${value.slice(5, 7)}/${value.slice(0, 4)}` };
    });
  }

  const today = new Date(`${getVietnamDate()}T12:00:00+07:00`);
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today.getTime() + index * 24 * 60 * 60 * 1000);
    const value = formatVietnamDate(date);
    const label = index === 0 ? `Hôm nay, ${value}` : value;
    return { value, label };
  });
}

function RouteSelectorModal({
  open,
  routes,
  query,
  selectedRouteId,
  onClose,
  onQueryChange,
  onSelect,
}: {
  open: boolean;
  routes: BusRoute[];
  query: string;
  selectedRouteId: string;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onSelect: (route: BusRoute) => void;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={open}>
      <View style={styles.modalBackdrop}>
        <View style={styles.routeSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Chọn tuyến</Text>
            <Pressable accessibilityLabel="Đóng chọn tuyến" onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons color={colors.primary} name="close" size={20} />
            </Pressable>
          </View>
          <View style={styles.searchBox}>
            <MaterialCommunityIcons color={colors.secondary} name="magnify" size={20} />
            <TextInput
              accessibilityLabel="Tìm tuyến"
              onChangeText={onQueryChange}
              placeholder="Mã tuyến, tên tuyến, điểm đầu/cuối"
              placeholderTextColor={colors.secondary}
              style={styles.searchInput}
              value={query}
            />
          </View>
          <FlatList
            data={routes}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => toRouteId(item) || item.routeNumber}
            ListEmptyComponent={<InlineState icon="map-search-outline" text="Không tìm thấy tuyến phù hợp." />}
            renderItem={({ item }) => {
              const active = toRouteId(item) === selectedRouteId;
              return (
                <Pressable accessibilityLabel={`Chọn tuyến ${item.routeNumber}`} onPress={() => onSelect(item)} style={[styles.routeOption, active && styles.routeOptionActive]}>
                  <View style={styles.routeBadge}>
                    <Text style={styles.routeBadgeText}>{item.routeNumber}</Text>
                  </View>
                  <View style={styles.selectorCopy}>
                    <Text numberOfLines={1} style={styles.selectorTitle}>{item.name}</Text>
                    <Text numberOfLines={1} style={styles.selectorMeta}>{item.origin} → {item.destination}</Text>
                  </View>
                  {active ? <MaterialCommunityIcons color={colors.primary} name="check-circle" size={20} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
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
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad';
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
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

function StartMonthDropdown({
  label,
  options,
  selected,
  visible,
  onOpen,
  onClose,
  onSelect,
}: {
  label: string;
  options: MonthOption[];
  selected: MonthOption;
  visible: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (option: MonthOption) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={onOpen} style={styles.dropdownButton}>
        <Text style={styles.dropdownValue}>{selected.label}</Text>
        <MaterialCommunityIcons color={colors.secondary} name="chevron-down" size={20} />
      </Pressable>
      <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
        <Pressable style={styles.modalScrim} onPress={onClose}>
          <View style={styles.monthMenu}>
            <Text style={styles.monthMenuTitle}>{label}</Text>
            {options.map((option) => {
              const active = option.value === selected.value;
              return (
                <Pressable key={option.value} onPress={() => onSelect(option)} style={[styles.monthOption, active && styles.monthOptionActive]}>
                  <Text style={[styles.monthOptionText, active && styles.monthOptionTextActive]}>{option.label}</Text>
                  {active ? <MaterialCommunityIcons color={colors.white} name="check" size={18} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
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
      <Pressable accessibilityLabel={label} onPress={onPress} style={styles.dateField}>
        <MaterialCommunityIcons color={colors.primary} name="calendar-month-outline" size={20} />
        <Text style={styles.dateValue}>{value}</Text>
        <MaterialCommunityIcons color={colors.secondary} name="chevron-down" size={20} />
      </Pressable>
    </View>
  );
}

function DateSelectorModal({
  mode,
  selectedDate,
  onSelect,
  onClose,
}: {
  mode: null | 'ONE_WAY' | 'MONTHLY_PASS';
  selectedDate: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const options = mode ? buildDateOptions(mode) : [];
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(mode)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.dateSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{mode === 'MONTHLY_PASS' ? 'Chọn tháng bắt đầu' : 'Chọn ngày khởi hành'}</Text>
            <Pressable accessibilityLabel="Đóng chọn ngày" onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons color={colors.primary} name="close" size={20} />
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => {
              const active = item.value === selectedDate;
              return (
                <Pressable accessibilityLabel={`Chọn ${item.label}`} onPress={() => onSelect(item.value)} style={[styles.dateOption, active && styles.routeOptionActive]}>
                  <Text style={styles.selectorTitle}>{item.label}</Text>
                  {active ? <MaterialCommunityIcons color={colors.primary} name="check-circle" size={20} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function InlineState({ icon, text }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; text: string }) {
  return (
    <View style={styles.emptyInline}>
      <MaterialCommunityIcons color={colors.secondary} name={icon} size={20} />
      <Text style={styles.emptyInlineText}>{text}</Text>
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
  tabs: { height: 48, flexDirection: 'row', gap: 6, borderRadius: 14, backgroundColor: colors.card, padding: 4 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 8 },
  tabActive: { backgroundColor: colors.primaryContainer },
  tabText: { color: colors.secondary, fontSize: 13, fontWeight: '900' },
  tabTextActive: { color: colors.white },
  section: { gap: 8 },
  label: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  selectorField: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, backgroundColor: colors.card, padding: 12 },
  selectorCopy: { flex: 1, minWidth: 0 },
  selectorTitle: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  selectorMeta: { marginTop: 2, color: colors.secondary, fontSize: 11, fontWeight: '700' },
  routeBadge: { minWidth: 50, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.primary },
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
  dropdownButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderRadius: 16, backgroundColor: colors.card, paddingHorizontal: 14 },
  dropdownValue: { color: colors.text, fontSize: 14, fontWeight: '900' },
  modalScrim: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.24)', padding: 22 },
  monthMenu: { gap: 8, borderRadius: 20, backgroundColor: colors.card, padding: 16 },
  monthMenuTitle: { marginBottom: 4, color: colors.primary, fontSize: 15, fontWeight: '900' },
  monthOption: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, backgroundColor: colors.surfaceLow, paddingHorizontal: 14 },
  monthOptionActive: { backgroundColor: colors.primaryContainer },
  monthOptionText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  monthOptionTextActive: { color: colors.white },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { minWidth: 72, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.card, paddingHorizontal: 10 },
  timeChipActive: { backgroundColor: colors.primaryContainer },
  timeText: { color: colors.secondary, fontSize: 13, fontWeight: '900' },
  timeTextActive: { color: colors.white },
  passengerChip: { maxWidth: 170, minHeight: 40, justifyContent: 'center', borderRadius: 14, backgroundColor: colors.card, paddingHorizontal: 12 },
  passengerChipActive: { backgroundColor: colors.primaryContainer },
  passengerText: { color: colors.secondary, fontSize: 12, fontWeight: '900' },
  passengerTextActive: { color: colors.white },
  promoCard: { gap: 9, borderRadius: 18, backgroundColor: colors.card, padding: 14 },
  promoRow: { flexDirection: 'row', gap: 8 },
  promoInput: { minHeight: 48, flex: 1, borderRadius: 14, backgroundColor: colors.surfaceLow, paddingHorizontal: 13, color: colors.text, fontSize: 14, fontWeight: '900' },
  applyButton: { minWidth: 88, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.primaryContainer, paddingHorizontal: 10 },
  applyButtonText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  successBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, backgroundColor: '#d8f6e7', padding: 10 },
  successText: { flex: 1, color: '#06613f', fontSize: 12, fontWeight: '800' },
  warningText: { color: '#6f5200', fontSize: 12, lineHeight: 18, fontWeight: '800' },
  emptyInline: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, backgroundColor: colors.card, padding: 12 },
  emptyInlineText: { flex: 1, color: colors.secondary, fontSize: 12, fontWeight: '800' },
  summary: { gap: 9, borderRadius: 18, backgroundColor: colors.card, padding: 14 },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  summaryTitleWrap: { flex: 1 },
  summaryTitle: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  summarySub: { marginTop: 2, color: colors.secondary, fontSize: 12, fontWeight: '800' },
  totalText: { color: colors.primary, fontSize: 17, fontWeight: '900' },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { flex: 0.34, color: colors.secondary, fontSize: 12, fontWeight: '800' },
  summaryValue: { flex: 0.66, color: colors.primary, fontSize: 12, fontWeight: '900', textAlign: 'right' },
  paymentBox: { gap: 12, borderRadius: 18, backgroundColor: '#fff4cc', padding: 14 },
  paymentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  paymentTitle: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  paymentText: { color: '#6f5200', fontSize: 12, lineHeight: 18, fontWeight: '800' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, backgroundColor: colors.errorContainer, padding: 11 },
  errorText: { flex: 1, color: colors.error, fontSize: 12, fontWeight: '800' },
  footerSpace: { height: 4 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.28)' },
  routeSheet: { maxHeight: '82%', gap: 12, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: colors.surface, padding: 16 },
  dateSheet: { maxHeight: '62%', gap: 12, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: colors.surface, padding: 16 },
  sheetHandle: { alignSelf: 'center', width: 46, height: 5, borderRadius: 999, backgroundColor: colors.outline },
  sheetHeader: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sheetTitle: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  closeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.card },
  searchBox: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, backgroundColor: colors.card, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  routeOption: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 15, backgroundColor: colors.card, marginBottom: 8, padding: 11 },
  routeOptionActive: { borderWidth: 1, borderColor: colors.primaryContainer, backgroundColor: '#d8f6e7' },
  dateOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderRadius: 15, backgroundColor: colors.card, marginBottom: 8, padding: 12 },
});
