import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import passengerApi, { type TravelHistoryRecord } from '@/api/passenger.api';
import { EmptyState, LoadingState, PassengerLayout, StatusPill } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const feedbackWindowDays = 7;
const feedbackWindowMs = feedbackWindowDays * 24 * 60 * 60 * 1000;

const tripCompletedAt = (record: TravelHistoryRecord) => {
  const value = record.arrivalTime || record.boardingTime || record.travelDate;
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const canSendFeedback = (record: TravelHistoryRecord) => {
  const completedAt = tripCompletedAt(record);
  if (!completedAt) return false;
  const elapsedMs = Date.now() - completedAt.getTime();
  return elapsedMs >= 0 && elapsedMs <= feedbackWindowMs;
};

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
        setError((err as { message?: string })?.message || 'Không thể tải lịch sử hành trình.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <PassengerLayout active="tickets" subtitle="Các chuyến đã hoàn thành của bạn" title="Lịch sử hành trình">
      {summary ? (
        <View style={styles.summary}>
          <Metric label="Chuyến" value={String(summary.totalTrips || records.length)} />
          <Metric label="Đã chi" value={currency.format(Number(summary.totalFare || 0))} />
          <Metric label="Phút" value={String(summary.totalDurationMinutes || 0)} />
        </View>
      ) : null}
      {loading ? <LoadingState label="Đang tải lịch sử hành trình" /> : null}
      {!loading && error ? <EmptyState icon="alert-circle-outline" title="Không thể tải lịch sử" detail={error} /> : null}
      {!loading && !error && !records.length ? <EmptyState title="Chưa có chuyến đi" detail="Các chuyến đã xác nhận sẽ xuất hiện tại đây." /> : null}
      {!loading && !error && records.map((record) => {
        const feedbackAvailable = canSendFeedback(record);
        return (
          <View key={record.id} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.route}>{record.routeNumber || record.routeName || 'Tuyến'}</Text>
            <StatusPill label={record.travelStatus === 'COMPLETED' ? 'Hoàn tất' : record.travelStatus || 'Hoàn tất'} tone="success" />
          </View>
          <Text style={styles.path}>{record.boardingStop || 'Điểm lên'} đến {record.destinationStop || 'Điểm xuống'}</Text>
          <Text style={styles.meta}>{new Date(record.boardingTime || record.travelDate || Date.now()).toLocaleString('vi-VN')} - {record.travelDurationMinutes || 0} phút</Text>
          <Text style={styles.meta}>{record.ticketId || record.ticketType || 'Vé'} - {currency.format(Number(record.fareAmount || 0))}</Text>
          {feedbackAvailable ? (
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
          ) : (
            <View style={styles.feedbackExpired} accessibilityRole="text">
              <Text style={styles.feedbackExpiredText}>Đã hết thời hạn góp ý</Text>
              <Text style={styles.feedbackExpiredHint}>Chỉ gửi trong vòng {feedbackWindowDays} ngày sau khi chuyến kết thúc.</Text>
            </View>
          )}
          </View>
        );
      })}
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
  feedbackExpired: { alignSelf: 'flex-start', borderRadius: 14, backgroundColor: '#f1f4f2', paddingHorizontal: 13, paddingVertical: 8 },
  feedbackExpiredText: { color: '#6c7d75', fontSize: 12, fontWeight: '900' },
  feedbackExpiredHint: { marginTop: 3, color: '#82918b', fontSize: 10, fontWeight: '700' },
});
