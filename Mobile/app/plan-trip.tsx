import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import passengerApi, { type BusRoute } from '@/api/passenger.api';
import { EmptyState, LoadingState, PassengerLayout, StatusPill } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';

const preferences = [
  { key: 'fastest', label: 'Fastest' },
  { key: 'shortest', label: 'Shortest' },
  { key: 'lowest-cost', label: 'Lowest cost' },
  { key: 'least-traffic', label: 'Less traffic' },
];

type PlanOption = {
  route?: {
    id?: string;
    routeNumber?: string;
    name?: string;
    origin?: string;
    destination?: string;
  };
  startStop?: { name?: string };
  endStop?: { name?: string };
  estimatedDurationMinutes?: number;
  estimatedDistanceKm?: number;
  estimatedFare?: number;
  isRecommended?: boolean;
};

const normalize = (value: string) => value.trim().toLowerCase();

export default function PlanTripScreen() {
  const params = useLocalSearchParams<{ from?: string; to?: string }>();
  const [from, setFrom] = useState(params.from || '');
  const [to, setTo] = useState(params.to || '');
  const [preference, setPreference] = useState('fastest');
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [options, setOptions] = useState<PlanOption[]>([]);
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
      if (!params.from && !from && firstRoute?.origin) {
        setFrom(firstRoute.origin);
      }
      if (!params.to && !to && firstRoute?.destination) {
        setTo(firstRoute.destination);
      }
    } catch {
      setError('Không thể tải danh sách điểm dừng. Vui lòng thử lại.');
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
          map.set(key, {
            name: stop.name,
            subtitle: `${route.routeNumber} - ${route.name}`,
          });
        }
      });
    });
    return Array.from(map.values()).slice(0, 10);
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
      const best = data.bestRoute ? [{ ...(data.bestRoute as PlanOption), isRecommended: true }] : [];
      const nextOptions = [...best, ...((data.alternatives || []) as PlanOption[])];
      setOptions(nextOptions);
      if (!nextOptions.length) {
        setError('Không tìm thấy tuyến phù hợp. Hãy chọn điểm dừng trong danh sách gợi ý bên dưới.');
      }
    } catch (err) {
      setError((err as { message?: string })?.message || 'Không thể lập hành trình. Vui lòng thử lại.');
      setOptions([]);
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
    <PassengerLayout active="explore" subtitle="Compare route options" title="Plan Your Trip">
      <View style={styles.formCard}>
        <Field icon="map-marker-outline" label="From" value={from} onChangeText={setFrom} placeholder="Choose departure stop" />
        <Pressable accessibilityLabel="Swap departure and destination" onPress={swapLocations} style={styles.swapButton}>
          <MaterialCommunityIcons color={colors.primary} name="swap-vertical" size={20} />
        </Pressable>
        <Field icon="map-marker-check-outline" label="To" value={to} onChangeText={setTo} placeholder="Destination stop" />
      </View>

      {fieldError ? (
        <View style={styles.inlineError}>
          <MaterialCommunityIcons color={colors.error} name="alert-circle-outline" size={18} />
          <Text style={styles.inlineErrorText}>{fieldError}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>Preference</Text>
      <View style={styles.prefWrap}>
        {preferences.map((item) => {
          const active = item.key === preference;
          return (
            <Pressable key={item.key} onPress={() => setPreference(item.key)} style={[styles.pref, active && styles.prefActive]}>
              <Text style={[styles.prefText, active && styles.prefTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable disabled={loading || loadingRoutes} onPress={plan} style={[styles.planButton, (loading || loadingRoutes) && styles.disabled]}>
        <Text style={styles.planText}>{loading ? 'Finding route...' : 'Find best route'}</Text>
        <MaterialCommunityIcons color={colors.white} name="arrow-right" size={20} />
      </Pressable>

      {loadingRoutes ? <LoadingState label="Loading stop suggestions" /> : null}

      {!loadingRoutes && stopSuggestions.length ? (
        <>
          <Text style={styles.sectionTitle}>Popular stops</Text>
          <View style={styles.suggestionWrap}>
            {stopSuggestions.map((item) => (
              <Pressable key={item.name} onPress={() => setTo(item.name)} style={styles.suggestionChip}>
                <Text numberOfLines={1} style={styles.suggestionText}>{item.name}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {loading ? <LoadingState label="Planning route" /> : null}
      {!loading && error ? <EmptyState icon="alert-circle-outline" title="Could not plan trip" detail={error} /> : null}
      {!loading && options.length ? <Text style={styles.sectionTitle}>Recommended routes</Text> : null}
      {!loading && options.map((option, index) => {
        const routeId = String(option.route?.id || option.route?.routeNumber || '');
        return (
          <View key={`${routeId}-${index}`} style={[styles.optionCard, option.isRecommended && styles.recommendedCard]}>
            <View style={styles.optionTop}>
              <View style={styles.routeBadge}>
                <Text style={styles.routeBadgeText}>{option.route?.routeNumber || 'Route'}</Text>
              </View>
              <View style={styles.optionCopy}>
                <Text numberOfLines={1} style={styles.optionName}>{option.route?.name || `${option.startStop?.name || from} to ${option.endStop?.name || to}`}</Text>
                <Text style={styles.meta}>
                  {option.estimatedDurationMinutes || 0} min - {option.estimatedDistanceKm || 0} km - {Number(option.estimatedFare || 0).toLocaleString('vi-VN')} VND
                </Text>
              </View>
              {option.isRecommended ? <StatusPill label="Best" tone="success" /> : null}
            </View>

            <View style={styles.actionRow}>
              <Pressable disabled={!routeId} onPress={() => router.push({ pathname: '/route-detail/[routeId]', params: { routeId } })} style={styles.secondaryAction}>
                <Text style={styles.secondaryActionText}>View route</Text>
              </Pressable>
              <Pressable disabled={!routeId} onPress={() => router.push(`/live-tracking?routeId=${encodeURIComponent(routeId)}`)} style={styles.secondaryAction}>
                <Text style={styles.secondaryActionText}>Track live</Text>
              </Pressable>
              <Pressable disabled={!routeId} onPress={() => router.push(`/buy-oneway-ticket?routeId=${encodeURIComponent(routeId)}`)} style={styles.primaryAction}>
                <Text style={styles.primaryActionText}>Buy</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </PassengerLayout>
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
  pref: { borderRadius: 999, backgroundColor: colors.card, paddingHorizontal: 13, paddingVertical: 9 },
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
  routeBadge: { minWidth: 54, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.primaryContainer, paddingHorizontal: 10 },
  routeBadgeText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  optionCopy: { flex: 1 },
  optionName: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  meta: { marginTop: 3, color: colors.secondary, fontSize: 12, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 8 },
  secondaryAction: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: colors.surfaceLow, paddingHorizontal: 10 },
  secondaryActionText: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  primaryAction: { minWidth: 72, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: colors.primaryContainer, paddingHorizontal: 13 },
  primaryActionText: { color: colors.white, fontSize: 11, fontWeight: '900' },
});
