import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import passengerApi from '@/api/passenger.api';
import { BottomNav, Chip, InfoCard, PassengerScreen, StateView } from '@/components/PassengerLayout';
import { colors } from '@/constants/colors';
import { formatCurrency } from '@/utils/format';
import { getErrorMessage } from '@/utils/validation';

const preferences = ['fastest', 'shortest', 'lowest-cost'] as const;
const preferenceLabels: Record<(typeof preferences)[number], string> = {
  fastest: 'Nhanh nhất',
  shortest: 'Ngắn nhất',
  'lowest-cost': 'Tiết kiệm nhất',
};

export default function PlanTripScreen() {
  const params = useLocalSearchParams<{ from?: string; to?: string }>();
  const [from, setFrom] = useState(params.from || '');
  const [to, setTo] = useState(params.to || '');
  const [preference, setPreference] = useState<(typeof preferences)[number]>('fastest');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!from.trim() || !to.trim()) {
      setError('Vui lòng nhập điểm đi và điểm đến.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResult(await passengerApi.suggestRouteOptions({ from, to, preference }));
    } catch (planError) {
      setError(getErrorMessage(planError, 'Không thể lên lộ trình.'));
    } finally {
      setLoading(false);
    }
  };

  const suggestions = result?.suggestions || [];

  return (
    <View style={{ flex: 1 }}>
      <PassengerScreen title="Lên lộ trình">
        <TextInput placeholder="Điểm đi" placeholderTextColor="#65766f" value={from} onChangeText={setFrom} style={styles.input} />
        <TextInput placeholder="Điểm đến" placeholderTextColor="#65766f" value={to} onChangeText={setTo} style={styles.input} />
        <View style={styles.chips}>
          {preferences.map((item) => <Chip key={item} label={preferenceLabels[item]} active={item === preference} onPress={() => setPreference(item)} />)}
        </View>
        <Pressable onPress={() => void submit()} style={styles.button}><Text style={styles.buttonText}>Tìm lộ trình</Text></Pressable>
        <StateView loading={loading} error={error} empty={!loading && !error && result && suggestions.length === 0} emptyText="Không tìm thấy gợi ý phù hợp." />
        {suggestions.map((option: any, index: number) => (
          <InfoCard key={`${option.route?.routeNumber}-${index}`}>
            <Text style={styles.badge}>{option.isRecommended ? 'Đề xuất' : 'Phương án khác'}</Text>
            <Text style={styles.title}>{option.route?.routeNumber} • {option.route?.name}</Text>
            <Text style={styles.meta}>{option.startStop?.name} → {option.endStop?.name}</Text>
            <Text style={styles.meta}>{option.estimatedDurationMinutes} phút • {option.estimatedDistanceKm} km • {formatCurrency(option.estimatedFare)}</Text>
          </InfoCard>
        ))}
      </PassengerScreen>
      <BottomNav active="routes" />
    </View>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 50, marginBottom: 10, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.card, color: colors.text, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  button: { height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.primaryContainer },
  buttonText: { color: colors.white, fontWeight: '900' },
  badge: { alignSelf: 'flex-start', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#b5efd1', color: '#17503a', fontSize: 10, fontWeight: '900' },
  title: { marginTop: 8, color: colors.primary, fontSize: 16, fontWeight: '900' },
  meta: { marginTop: 5, color: colors.muted, fontSize: 12, fontWeight: '600' },
});
