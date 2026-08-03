import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import passengerApi, { type TravelHistoryRecord } from '@/api/passenger.api';
import { EmptyState, LoadingState, PassengerLayout, StatusPill } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

export default function TravelHistoryScreen() {
  const [records, setRecords] = useState<TravelHistoryRecord[]>([]);
  const [summary, setSummary] = useState<{ totalTrips?: number; totalFare?: number; totalDurationMinutes?: number }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await passengerApi.getTravelHistory();
        setRecords(data.records || []);
        setSummary(data.summary);
      } catch (err) {
        setError((err as { message?: string })?.message || 'Could not load travel history.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <PassengerLayout active="tickets" subtitle="Completed trips from your profile" title="Travel History">
      {summary ? (
        <View style={styles.summary}>
          <Metric label="Trips" value={String(summary.totalTrips || records.length)} />
          <Metric label="Spent" value={currency.format(Number(summary.totalFare || 0))} />
          <Metric label="Minutes" value={String(summary.totalDurationMinutes || 0)} />
        </View>
      ) : null}
      {loading ? <LoadingState label="Loading travel history" /> : null}
      {!loading && error ? <EmptyState icon="alert-circle-outline" title="Could not load history" detail={error} /> : null}
      {!loading && !error && !records.length ? <EmptyState title="No trips yet" detail="Validated trips will appear here." /> : null}
      {!loading && !error && records.map((record) => (
        <View key={record.id} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.route}>{record.routeNumber || record.routeName || 'Route'}</Text>
            <StatusPill label={record.travelStatus || 'COMPLETED'} tone="success" />
          </View>
          <Text style={styles.path}>{record.boardingStop || 'Origin'} to {record.destinationStop || 'Destination'}</Text>
          <Text style={styles.meta}>{new Date(record.boardingTime || record.travelDate || Date.now()).toLocaleString()} - {record.travelDurationMinutes || 0} min</Text>
          <Text style={styles.meta}>{record.ticketId || record.ticketType || 'Ticket'} - {currency.format(Number(record.fareAmount || 0))}</Text>
          <Pressable
            onPress={() => router.push({
              pathname: '/submit-feedback',
              params: {
                relatedTripId: record.tripId || record.ticketId || '',
                tripCode: record.tripId || record.ticketId || '',
                routeName: `${record.routeNumber || ''} - ${record.routeName || ''}`.trim(),
              },
            })}
            style={styles.feedbackButton}
          >
            <Text style={styles.feedbackButtonText}>Gửi góp ý chuyến này</Text>
          </Pressable>
        </View>
      ))}
    </PassengerLayout>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', gap: 9 },
  metric: { flex: 1, minHeight: 74, justifyContent: 'center', borderRadius: 18, backgroundColor: colors.card, padding: 12 },
  metricLabel: { color: colors.secondary, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  metricValue: { marginTop: 5, color: colors.primary, fontSize: 15, fontWeight: '900' },
  card: { gap: 8, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  route: { color: colors.primary, fontSize: 17, fontWeight: '900' },
  path: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  meta: { color: colors.secondary, fontSize: 12, fontWeight: '700' },
  feedbackButton: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#d8f6e7', paddingHorizontal: 13, paddingVertical: 8 },
  feedbackButtonText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
});
