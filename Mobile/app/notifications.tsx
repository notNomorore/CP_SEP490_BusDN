import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import passengerApi from '@/api/passenger.api';
import { BottomNav, Chip, InfoCard, PassengerScreen, StateView } from '@/components/PassengerLayout';
import { colors } from '@/constants/colors';
import { useApiResource } from '@/hooks/useApiResource';
import { formatDate } from '@/utils/format';
import { getErrorMessage } from '@/utils/validation';

const filters = ['All', 'Arrival', 'Delay', 'Route Change'] as const;
const filterLabels: Record<(typeof filters)[number], string> = {
  All: 'Tất cả',
  Arrival: 'Xe đến',
  Delay: 'Trễ chuyến',
  'Route Change': 'Đổi tuyến',
};

export default function NotificationsScreen() {
  const { data, setData, isLoading, isRefreshing, error, refresh, reload, setError } = useApiResource<any[]>(() => passengerApi.getNotifications(), []);
  const [filter, setFilter] = useState<(typeof filters)[number]>('All');

  const notifications = data || [];
  const visibleNotifications = filter === 'All' ? notifications : notifications.filter((item) => item.type === filter);

  const markRead = async (notification: any) => {
    const notificationId = notification.id || notification._id;
    if (notification.type !== 'Route Change' || !notificationId) return;
    try {
      await passengerApi.markRouteChangeAlertRead(String(notificationId));
      setData((current) => (current || []).map((item: any) => ((item.id || item._id) === notificationId ? { ...item, isRead: true, readAt: new Date().toISOString() } : item)));
    } catch (readError) {
      setError(getErrorMessage(readError, 'Không thể đánh dấu thông báo đã đọc.'));
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <PassengerScreen title="Thông báo" onRefresh={refresh} refreshing={isRefreshing}>
        <View style={styles.chips}>
          {filters.map((item) => <Chip key={item} label={filterLabels[item]} active={filter === item} onPress={() => setFilter(item)} />)}
        </View>

        <StateView loading={isLoading} error={error} empty={!isLoading && visibleNotifications.length === 0} emptyText="Chưa có thông báo." onRetry={reload} />

        {visibleNotifications.map((notification: any, index: number) => (
          <InfoCard key={notification.id || notification._id || index} onPress={() => void markRead(notification)}>
            <View style={styles.row}>
              <Text style={styles.type}>{filterLabels[notification.type as keyof typeof filterLabels] || notification.type}</Text>
              <Text style={[styles.readState, !notification.isRead && styles.unread]}>{notification.isRead ? 'Đã đọc' : 'Mới'}</Text>
            </View>
            <Text style={styles.title}>{notification.title || notification.message || notification.routeName || 'Thông báo BusDN'}</Text>
            <Text style={styles.meta}>{notification.description || notification.content || notification.routeChangeType || notification.message}</Text>
            <Text style={styles.date}>{formatDate(notification.createdAt || notification.updatedAt || notification.sentAt)}</Text>
          </InfoCard>
        ))}
      </PassengerScreen>
      <BottomNav active="notifications" />
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  type: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  readState: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  unread: { color: colors.error },
  title: { marginTop: 8, color: colors.primary, fontSize: 15, fontWeight: '900' },
  meta: { marginTop: 6, color: colors.text, fontSize: 12, lineHeight: 18 },
  date: { marginTop: 9, color: colors.muted, fontSize: 10, fontWeight: '700' },
});
