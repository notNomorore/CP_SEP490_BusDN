import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';

import passengerApi, { type NotificationRecord } from '@/api/passenger.api';
import { EmptyState, LoadingState, PassengerLayout, StatusPill } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';

export default function NotificationsScreen() {
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setItems(await passengerApi.getNotifications());
      } catch (err) {
        setError((err as { message?: string })?.message || 'Could not load notifications.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const openNotification = (item: NotificationRecord) => {
    const feedbackId = String(
      item.metadata?.feedbackId
      || item.metadata?.caseId
      || item.metadata?.referenceNumber
      || ''
    );

    if (feedbackId) {
      router.push({ pathname: '/feedback/[feedbackId]', params: { feedbackId } } as unknown as Href);
      return;
    }

    const routeId = String(item.metadata?.routeId || '');
    if (routeId) {
      router.push(`/live-tracking?routeId=${encodeURIComponent(routeId)}` as Href);
      return;
    }

    const ticketId = String(item.metadata?.ticketId || item.metadata?.orderCode || '');
    if (ticketId || item.type?.toLowerCase().includes('payment')) {
      router.push('/my-tickets');
    }
  };

  return (
    <PassengerLayout active="home" subtitle="System updates and route alerts" title="Notifications">
      {loading ? <LoadingState label="Loading notifications" /> : null}
      {!loading && error ? <EmptyState icon="alert-circle-outline" title="Could not load notifications" detail={error} /> : null}
      {!loading && !error && !items.length ? <EmptyState title="No notifications" detail="New BusDN updates will appear here." /> : null}
      {!loading && !error && items.map((item) => (
        <Pressable key={String(item.id || item._id || item.createdAt)} onPress={() => openNotification(item)} style={styles.card}>
          <View style={styles.header}>
            <StatusPill label={item.priority || item.type || 'Notice'} tone={item.priority === 'HIGH' ? 'warning' : 'neutral'} />
            <Text style={styles.date}>{new Date(item.sentAt || item.createdAt || Date.now()).toLocaleString()}</Text>
          </View>
          <Text style={styles.title}>{item.title || 'BusDN notification'}</Text>
          <Text style={styles.message}>{item.message || item.body || ''}</Text>
        </Pressable>
      ))}
    </PassengerLayout>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  date: { color: colors.secondary, fontSize: 10, fontWeight: '700' },
  title: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  message: { color: colors.secondary, fontSize: 13, lineHeight: 19, fontWeight: '700' },
});
