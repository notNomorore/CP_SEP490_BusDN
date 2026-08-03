import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import passengerApi, { type BusRoute, type BusRouteStop } from '@/api/passenger.api';
import { EmptyState, LoadingState, PassengerLayout, StatusPill } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';

const preferences = [
  { key: 'fastest', label: 'Nhanh nhất', icon: 'clock-fast' },
  { key: 'shortest', label: 'Ngắn nhất', icon: 'map-marker-distance' },
  { key: 'lowest-cost', label: 'Rẻ nhất', icon: 'cash' },
  { key: 'least-traffic', label: 'Ít kẹt xe', icon: 'traffic-light-outline' },
];

type RouteSegment = {
  route: BusRoute;
  startStop: BusRouteStop;
  endStop: BusRouteStop;
};

type RouteOption = {
  id: string;
  kind: 'direct' | 'transfer';
  route?: {
    id?: string;
    routeNumber?: string;
    name?: string;
    origin?: string;
    destination?: string;
  };
  startStop?: { name?: string; order?: number; estimatedOffsetMinutes?: number };
  endStop?: { name?: string; order?: number; estimatedOffsetMinutes?: number };
  estimatedDurationMinutes?: number;
  estimatedDistanceKm?: number;
  estimatedFare?: number;
  transferStop?: string;
  transferCount: number;
  walkingMinutes: number;
  isRecommended?: boolean;
  reason: string;
  segments: RouteSegment[];
};

type BackendOption = {
  route?: RouteOption['route'];
  startStop?: RouteOption['startStop'];
  endStop?: RouteOption['endStop'];
  estimatedDurationMinutes?: number;
  estimatedDistanceKm?: number;
  estimatedFare?: number;
  isRecommended?: boolean;
};

const normalize = (value?: string) => String(value || '').trim().toLowerCase();

const routeIdOf = (route?: BusRoute | RouteOption['route']) => String(route?.id || route?.routeNumber || '');

const formatFare = (value?: number) => `${Number(value || 0).toLocaleString('vi-VN')} VND`;

const stopMatches = (stop: BusRouteStop, keyword: string) => normalize(stop.name).includes(normalize(keyword));

const findStartStop = (route: BusRoute, keyword: string) => {
  const byStop = route.stops?.find((stop) => stopMatches(stop, keyword));
  if (byStop) return byStop;
  return normalize(route.origin).includes(normalize(keyword)) ? route.stops?.[0] : undefined;
};

const findEndStop = (route: BusRoute, keyword: string) => {
  const byStop = route.stops?.find((stop) => stopMatches(stop, keyword));
  if (byStop) return byStop;
  return normalize(route.destination).includes(normalize(keyword)) ? route.stops?.[route.stops.length - 1] : undefined;
};

const estimateSegment = (route: BusRoute, startStop: BusRouteStop, endStop: BusRouteStop) => {
  const routeStopCount = Math.max((route.stops?.length || 1) - 1, 1);
  const stopSpan = Math.max(Number(endStop.order || 0) - Number(startStop.order || 0), 1);
  const offsetMinutes = Math.max(
    Number(endStop.estimatedOffsetMinutes || 0) - Number(startStop.estimatedOffsetMinutes || 0),
    0,
  );

  return {
    minutes: offsetMinutes || Math.max(Math.round((route.estimatedDurationMinutes || 30) / routeStopCount * stopSpan), 8),
    distanceKm: Number((((route.distanceKm || 5) / routeStopCount) * stopSpan).toFixed(1)),
    fare: Math.max(Math.round(((route.fare || 7000) / routeStopCount) * stopSpan), Math.round((route.fare || 7000) * 0.35)),
  };
};

const scoreOption = (option: RouteOption, preference: string) => {
  const minutes = option.estimatedDurationMinutes || 0;
  const distance = option.estimatedDistanceKm || 0;
  const fareWeight = (option.estimatedFare || 0) / 1000;
  const transferPenalty = option.transferCount * 9;
  const map: Record<string, number> = {
    fastest: minutes + transferPenalty + distance * 0.25,
    shortest: distance + transferPenalty * 0.4 + minutes * 0.08,
    'lowest-cost': fareWeight + option.transferCount * 2 + distance * 0.12,
    'least-traffic': minutes * 0.85 + distance * 0.35 + option.transferCount * 3,
  };
  return map[preference] || map.fastest;
};

const directOptionFromBackend = (item: BackendOption, index: number): RouteOption => ({
  id: `direct-${routeIdOf(item.route)}-${index}`,
  kind: 'direct',
  route: item.route,
  startStop: item.startStop,
  endStop: item.endStop,
  estimatedDurationMinutes: item.estimatedDurationMinutes,
  estimatedDistanceKm: item.estimatedDistanceKm,
  estimatedFare: item.estimatedFare,
  transferCount: 0,
  walkingMinutes: 0,
  isRecommended: item.isRecommended,
  reason: item.isRecommended ? 'Phù hợp nhất theo tiêu chí bạn chọn.' : 'Tuyến trực tiếp thay thế.',
  segments: [],
});

const buildTransferOptions = (routes: BusRoute[], from: string, to: string, preference: string): RouteOption[] => {
  const options: RouteOption[] = [];

  routes.forEach((firstRoute) => {
    const startStop = findStartStop(firstRoute, from);
    if (!startStop) return;

    routes.forEach((secondRoute) => {
      if (firstRoute.routeNumber === secondRoute.routeNumber) return;
      const endStop = findEndStop(secondRoute, to);
      if (!endStop) return;

      firstRoute.stops?.forEach((firstTransferStop) => {
        if (Number(firstTransferStop.order || 0) <= Number(startStop.order || 0)) return;

        const secondTransferStop = secondRoute.stops?.find((candidate) => (
          normalize(candidate.name) === normalize(firstTransferStop.name)
          && Number(candidate.order || 0) < Number(endStop.order || 0)
        ));
        if (!secondTransferStop) return;

        const firstEstimate = estimateSegment(firstRoute, startStop, firstTransferStop);
        const secondEstimate = estimateSegment(secondRoute, secondTransferStop, endStop);
        const waitMinutes = Math.max(Math.round((secondRoute.operatingHours?.frequencyMinutes || 20) / 2), 5);
        const estimatedDurationMinutes = firstEstimate.minutes + waitMinutes + secondEstimate.minutes;
        const estimatedDistanceKm = Number((firstEstimate.distanceKm + secondEstimate.distanceKm).toFixed(1));
        const estimatedFare = firstEstimate.fare + secondEstimate.fare;

        options.push({
          id: `transfer-${firstRoute.routeNumber}-${secondRoute.routeNumber}-${firstTransferStop.order}-${endStop.order}`,
          kind: 'transfer',
          transferStop: firstTransferStop.name,
          transferCount: 1,
          walkingMinutes: 3,
          estimatedDurationMinutes,
          estimatedDistanceKm,
          estimatedFare,
          reason: preference === 'least-traffic'
            ? 'Phương án có chuyển tuyến để tránh đi vòng hoặc đoạn dễ kẹt xe.'
            : 'Phương án thay thế khi tuyến trực tiếp không tối ưu.',
          segments: [
            { route: firstRoute, startStop, endStop: firstTransferStop },
            { route: secondRoute, startStop: secondTransferStop, endStop },
          ],
        });
      });
    });
  });

  return options
    .sort((first, second) => scoreOption(first, preference) - scoreOption(second, preference))
    .slice(0, 4);
};

export default function PlanTripScreen() {
  const params = useLocalSearchParams<{ from?: string; to?: string }>();
  const [from, setFrom] = useState(params.from || '');
  const [to, setTo] = useState(params.to || '');
  const [preference, setPreference] = useState('fastest');
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [options, setOptions] = useState<RouteOption[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');

  const loadRoutes = useCallback(async () => {
    setLoadingRoutes(true);
    try {
      const data = await passengerApi.searchRoutes();
      const routeList = data.routes || [];
      setRoutes(routeList);

      const firstRoute = routeList[0];
      if (!params.from && !from && firstRoute?.origin) setFrom(firstRoute.origin);
      if (!params.to && !to && firstRoute?.destination) setTo(firstRoute.destination);
    } catch {
      setError('Không thể tải danh sách tuyến. Vui lòng thử lại.');
    } finally {
      setLoadingRoutes(false);
    }
  }, [from, params.from, params.to, to]);

  useEffect(() => {
    void loadRoutes();
  }, [loadRoutes]);

  const stopSuggestions = useMemo(() => {
    const map = new Map<string, { name: string; subtitle: string }>();
    routes.forEach((route) => {
      (route.stops || []).forEach((stop) => {
        if (!stop.name) return;
        const key = normalize(stop.name);
        if (!map.has(key)) {
          map.set(key, { name: stop.name, subtitle: `${route.routeNumber} - ${route.name}` });
        }
      });
    });
    return Array.from(map.values()).slice(0, 12);
  }, [routes]);

  const plan = async () => {
    const fromValue = from.trim();
    const toValue = to.trim();
    setFieldError('');
    setError('');

    if (!fromValue || !toValue) {
      setFieldError('Nhập hoặc chọn cả điểm đi và điểm đến.');
      return;
    }
    if (normalize(fromValue) === normalize(toValue)) {
      setFieldError('Điểm đi và điểm đến không được giống nhau.');
      return;
    }

    setLoading(true);
    try {
      const data = await passengerApi.getBestRoute({ from: fromValue, to: toValue, preference });
      const directOptions = [
        ...(data.bestRoute ? [{ ...(data.bestRoute as BackendOption), isRecommended: true }] : []),
        ...((data.alternatives || []) as BackendOption[]),
      ].map(directOptionFromBackend);
      const transferOptions = buildTransferOptions(routes, fromValue, toValue, preference);
      const seen = new Set<string>();
      const nextOptions = [...directOptions, ...transferOptions]
        .filter((option) => {
          const key = option.kind === 'direct'
            ? `direct-${routeIdOf(option.route)}-${option.startStop?.name}-${option.endStop?.name}`
            : option.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((first, second) => {
          if (first.isRecommended) return -1;
          if (second.isRecommended) return 1;
          return scoreOption(first, preference) - scoreOption(second, preference);
        })
        .slice(0, 5);

      setOptions(nextOptions);
      if (!nextOptions.length) {
        setError('Không tìm thấy phương án phù hợp. Hãy chọn điểm dừng trong danh sách gợi ý bên dưới.');
      }
    } catch (err) {
      const transferOptions = buildTransferOptions(routes, fromValue, toValue, preference);
      setOptions(transferOptions);
      setError(transferOptions.length ? '' : ((err as { message?: string })?.message || 'Không thể đề xuất tuyến. Vui lòng thử lại.'));
    } finally {
      setLoading(false);
    }
  };

  const swapLocations = () => {
    setFrom(to);
    setTo(from);
    setOptions([]);
    setFieldError('');
    setError('');
  };

  return (
    <PassengerLayout active="explore" subtitle="Gợi ý tuyến theo điểm đến" title="Đề xuất tuyến">
      <View style={styles.formCard}>
        <Field icon="map-marker-outline" label="Điểm đi" value={from} onChangeText={setFrom} placeholder="Nhập hoặc chọn điểm đi" />
        <Pressable accessibilityLabel="Đổi điểm đi và điểm đến" onPress={swapLocations} style={styles.swapButton}>
          <MaterialCommunityIcons color={colors.primary} name="swap-vertical" size={20} />
        </Pressable>
        <Field icon="map-marker-check-outline" label="Điểm đến" value={to} onChangeText={setTo} placeholder="Nhập điểm đến" />
      </View>

      {fieldError ? (
        <View style={styles.inlineError}>
          <MaterialCommunityIcons color={colors.error} name="alert-circle-outline" size={18} />
          <Text style={styles.inlineErrorText}>{fieldError}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>Ưu tiên</Text>
      <View style={styles.prefWrap}>
        {preferences.map((item) => {
          const active = item.key === preference;
          return (
            <Pressable key={item.key} onPress={() => setPreference(item.key)} style={[styles.pref, active && styles.prefActive]}>
              <MaterialCommunityIcons color={active ? colors.white : colors.secondary} name={item.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']} size={16} />
              <Text style={[styles.prefText, active && styles.prefTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable disabled={loading || loadingRoutes} onPress={plan} style={[styles.planButton, (loading || loadingRoutes) && styles.disabled]}>
        <Text style={styles.planText}>{loading ? 'Đang tìm phương án...' : 'Tìm phương án tuyến'}</Text>
        <MaterialCommunityIcons color={colors.white} name="arrow-right" size={20} />
      </Pressable>

      {loadingRoutes ? <LoadingState label="Đang tải điểm dừng gợi ý" /> : null}

      {!loadingRoutes && stopSuggestions.length ? (
        <>
          <Text style={styles.sectionTitle}>Điểm dừng gợi ý</Text>
          <View style={styles.suggestionWrap}>
            {stopSuggestions.map((item) => (
              <Pressable key={item.name} onPress={() => setTo(item.name)} style={styles.suggestionChip}>
                <Text numberOfLines={1} style={styles.suggestionText}>{item.name}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {loading ? <LoadingState label="Đang tính tuyến phù hợp" /> : null}
      {!loading && error ? <EmptyState icon="alert-circle-outline" title="Chưa có phương án" detail={error} /> : null}
      {!loading && options.length ? <Text style={styles.sectionTitle}>Phương án đề xuất</Text> : null}
      {!loading && options.map((option, index) => <RouteOptionCard key={`${option.id}-${index}`} option={option} />)}
    </PassengerLayout>
  );
}

function RouteOptionCard({ option }: { option: RouteOption }) {
  const firstRouteId = option.kind === 'transfer'
    ? routeIdOf(option.segments[0]?.route)
    : routeIdOf(option.route);

  return (
    <View style={[styles.optionCard, option.isRecommended && styles.recommendedCard]}>
      <View style={styles.optionTop}>
        <View style={styles.routeBadge}>
          <Text style={styles.routeBadgeText}>
            {option.kind === 'transfer'
              ? `${option.segments[0]?.route.routeNumber || 'BUS'} + ${option.segments[1]?.route.routeNumber || 'BUS'}`
              : option.route?.routeNumber || 'BUS'}
          </Text>
        </View>
        <View style={styles.optionCopy}>
          <Text numberOfLines={1} style={styles.optionName}>
            {option.kind === 'transfer' ? 'Phương án có chuyển tuyến' : option.route?.name || 'Tuyến trực tiếp'}
          </Text>
          <Text style={styles.meta}>
            {option.estimatedDurationMinutes || 0} phút - {option.estimatedDistanceKm || 0} km - {formatFare(option.estimatedFare)}
          </Text>
        </View>
        {option.isRecommended ? <StatusPill label="Đề xuất" tone="success" /> : <StatusPill label={option.kind === 'transfer' ? 'Chuyển tuyến' : 'Trực tiếp'} />}
      </View>

      <View style={styles.reasonBox}>
        <MaterialCommunityIcons color={colors.secondary} name={option.kind === 'transfer' ? 'transit-transfer' : 'lightbulb-outline'} size={18} />
        <Text style={styles.reasonText}>{option.reason}</Text>
      </View>

      {option.kind === 'transfer' ? (
        <View style={styles.stepsBox}>
          {option.segments.map((segment, index) => (
            <View key={`${segment.route.routeNumber}-${index}`} style={styles.stepRow}>
              <View style={styles.stepDot}>
                <Text style={styles.stepNumber}>{index + 1}</Text>
              </View>
              <View style={styles.stepCopy}>
                <Text style={styles.stepTitle}>Tuyến {segment.route.routeNumber}</Text>
                <Text numberOfLines={2} style={styles.stepMeta}>{segment.startStop.name} đến {segment.endStop.name}</Text>
              </View>
            </View>
          ))}
          <Text style={styles.transferText}>Chuyển tại: {option.transferStop} - đi bộ khoảng {option.walkingMinutes} phút.</Text>
        </View>
      ) : (
        <Text style={styles.directText}>{option.startStop?.name || option.route?.origin} đến {option.endStop?.name || option.route?.destination}</Text>
      )}

      <View style={styles.actionRow}>
        <Pressable disabled={!firstRouteId} onPress={() => router.push({ pathname: '/route-detail/[routeId]', params: { routeId: firstRouteId } })} style={styles.secondaryAction}>
          <Text style={styles.secondaryActionText}>Xem tuyến</Text>
        </Pressable>
        <Pressable disabled={!firstRouteId} onPress={() => router.push(`/live-tracking?routeId=${encodeURIComponent(firstRouteId)}`)} style={styles.secondaryAction}>
          <Text style={styles.secondaryActionText}>Theo dõi</Text>
        </Pressable>
        <Pressable disabled={!firstRouteId} onPress={() => router.push(`/buy-oneway-ticket?routeId=${encodeURIComponent(firstRouteId)}`)} style={styles.primaryAction}>
          <Text style={styles.primaryActionText}>Mua vé</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Field({ icon, label, value, onChangeText, placeholder }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; value: string; onChangeText: (value: string) => void; placeholder?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <MaterialCommunityIcons color={colors.secondary} name={icon} size={20} />
        <TextInput onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.secondary} style={styles.input} value={value} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  formCard: { gap: 10 },
  field: { gap: 8 },
  label: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  inputWrap: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 18, backgroundColor: colors.card, paddingHorizontal: 14 },
  input: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  swapButton: { alignSelf: 'center', width: 34, height: 34, alignItems: 'center', justifyContent: 'center', marginVertical: -3, borderRadius: 17, backgroundColor: '#d8f6e7' },
  inlineError: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, backgroundColor: colors.errorContainer, padding: 12 },
  inlineErrorText: { flex: 1, color: colors.error, fontSize: 12, fontWeight: '800' },
  prefWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pref: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: colors.card, paddingHorizontal: 13 },
  prefActive: { backgroundColor: colors.primaryContainer },
  prefText: { color: colors.secondary, fontSize: 12, fontWeight: '900' },
  prefTextActive: { color: colors.white },
  planButton: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 26, backgroundColor: colors.primaryContainer },
  disabled: { opacity: 0.55 },
  planText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  sectionTitle: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  suggestionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionChip: { maxWidth: '100%', borderRadius: 999, backgroundColor: '#d8f6e7', paddingHorizontal: 13, paddingVertical: 9 },
  suggestionText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  optionCard: { gap: 13, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  recommendedCard: { borderLeftWidth: 4, borderLeftColor: colors.primaryContainer },
  optionTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeBadge: { minWidth: 62, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.primaryContainer, paddingHorizontal: 10 },
  routeBadgeText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  optionCopy: { flex: 1 },
  optionName: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  meta: { marginTop: 3, color: colors.secondary, fontSize: 12, fontWeight: '700' },
  reasonBox: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 15, backgroundColor: colors.surfaceLow, padding: 10 },
  reasonText: { flex: 1, color: colors.secondary, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  directText: { color: colors.secondary, fontSize: 12, fontWeight: '800' },
  stepsBox: { gap: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepDot: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#d8f6e7' },
  stepNumber: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  stepCopy: { flex: 1 },
  stepTitle: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  stepMeta: { marginTop: 2, color: colors.secondary, fontSize: 12, fontWeight: '700' },
  transferText: { color: '#006c49', fontSize: 12, lineHeight: 17, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 8 },
  secondaryAction: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: colors.surfaceLow, paddingHorizontal: 10 },
  secondaryActionText: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  primaryAction: { minWidth: 72, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: colors.primaryContainer, paddingHorizontal: 13 },
  primaryActionText: { color: colors.white, fontSize: 11, fontWeight: '900' },
});
