import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import scheduleOperationsApi from '@/api/scheduleOperations.api';
import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';
import type { OperationNotification } from '@/types/scheduleOperations';
import { goBackOrReplace } from '@/utils/navigation';
import { formatDate, formatTime, getWeekRange } from '@/utils/scheduleOperations';
import { getErrorMessage } from '@/utils/validation';

const priorityColor = (priority?: string) => {
  const normalized = String(priority || '').toUpperCase();
  if (normalized === 'URGENT' || normalized === 'HIGH') return colors.error;
  if (normalized === 'MEDIUM') return '#b26b00';
  return colors.accent;
};

export default function DriverNotificationsScreen() {
  const user = useAuthStore((state) => state.user);
  const [notifications, setNotifications] = useState<OperationNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadNotifications = useCallback(async (refresh = false) => {
    refresh ? setIsRefreshing(true) : setIsLoading(true);
    try {
      const payload = await scheduleOperationsApi.getOperationNotifications(getWeekRange());
      setNotifications(payload.notifications || []);
    } catch (error) {
      Alert.alert('Không thể tải thông báo', getErrorMessage(error, 'Không thể tải thông báo vận hành.'));
    } finally {
      refresh ? setIsRefreshing(false) : setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications],
  );

  return (
    <View style={styles.screenShell}>
      <Screen>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Quay lại" hitSlop={10} onPress={() => goBackOrReplace('/driver-assistant')}>
            <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>LỊCH VÀ PHÂN CÔNG</Text>
            <Text style={styles.title}>Thông báo vận hành</Text>
          </View>
          <Pressable
            accessibilityLabel="Làm mới thông báo"
            disabled={isRefreshing}
            hitSlop={8}
            onPress={() => void loadNotifications(true)}
            style={styles.refreshButton}
          >
            {isRefreshing ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <MaterialCommunityIcons color={colors.primary} name="refresh" size={22} />
            )}
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>Thông báo chưa đọc</Text>
            <Text style={styles.summaryValue}>{unreadCount}</Text>
          </View>
          <MaterialCommunityIcons color="rgba(43,164,113,0.14)" name="bell-badge-outline" size={64} />
        </View>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Đang tải thông báo vận hành...</Text>
          </View>
        ) : (
          <View style={styles.notificationList}>
            {notifications.length === 0 ? (
              <Text style={styles.emptyText}>Không có thông báo vận hành trong khoảng thời gian này.</Text>
            ) : notifications.map((notification) => {
              const tone = priorityColor(notification.priority);
              return (
                <View key={notification.id} style={styles.notificationCard}>
                  <View style={[styles.priorityRail, { backgroundColor: tone }]} />
                  <View style={styles.notificationBody}>
                    <View style={styles.notificationHeader}>
                      {!notification.isRead ? <View style={styles.unreadDot} /> : null}
                    </View>
                    <Text style={styles.notificationTitle}>{notification.title || 'Thông báo vận hành'}</Text>
                    <Text style={styles.notificationMessage}>{notification.message || 'Không có nội dung.'}</Text>
                    <View style={styles.metaRow}>
                      <MaterialCommunityIcons color={colors.muted} name="clock-outline" size={15} />
                      <Text style={styles.metaText}>
                        {formatDate(notification.createdAt || notification.activeFrom || '')} • {formatTime(notification.createdAt || notification.activeFrom)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Screen>
      <RoleBottomNav active="notifications" role={user?.role} />
    </View>
  );
}

const styles = StyleSheet.create({
  screenShell: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  headerText: { flex: 1 },
  refreshButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.card },
  kicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.primary, fontSize: 25, fontWeight: '900' },
  summaryCard: { minHeight: 112, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden', borderRadius: 24, backgroundColor: colors.card, padding: 18 },
  summaryLabel: { color: colors.muted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  summaryValue: { marginTop: 4, color: colors.primary, fontSize: 34, fontWeight: '900' },
  loading: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.muted, fontWeight: '700' },
  notificationList: { gap: 12, marginTop: 18, paddingBottom: 96 },
  emptyText: { borderRadius: 18, backgroundColor: colors.surfaceLow, padding: 16, color: colors.muted, fontSize: 13, fontWeight: '700' },
  notificationCard: { flexDirection: 'row', overflow: 'hidden', borderRadius: 20, backgroundColor: colors.card },
  priorityRail: { width: 5 },
  notificationBody: { flex: 1, gap: 8, padding: 15 },
  notificationHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  notificationTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  notificationMessage: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
});
