import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import passengerApi, {
  type NotificationListResult,
  type NotificationRecord,
  type NotificationSubscriptionRecord,
} from '@/api/passenger.api';
import { EmptyState, LoadingState, PassengerLayout } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';
import { getErrorMessage } from '@/utils/validation';

type FilterKey = 'all' | 'arrival' | 'delay' | 'routeChange' | 'system';
type PermissionStatus = 'granted' | 'prompt' | 'denied' | 'unsupported';
type SubscriptionKey = 'arrival' | 'delay' | 'routeChange';

const POLL_INTERVAL_MS = 30000;

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'arrival', label: 'Xe đến' },
  { key: 'delay', label: 'Trễ' },
  { key: 'routeChange', label: 'Đổi tuyến' },
  { key: 'system', label: 'Hệ thống' },
];

const typeConfig = {
  arrival: {
    label: 'Xe sắp đến',
    title: 'Xe buýt sắp đến',
    icon: 'bus',
    tone: 'success',
  },
  delay: {
    label: 'Trễ chuyến',
    title: 'Chuyến bị trễ',
    icon: 'clock-alert-outline',
    tone: 'danger',
  },
  routeChange: {
    label: 'Thay đổi tuyến',
    title: 'Tuyến đã cập nhật',
    icon: 'routes',
    tone: 'info',
  },
  promotion: {
    label: 'Khuyến mãi',
    title: 'Khuyến mãi',
    icon: 'ticket-percent-outline',
    tone: 'neutral',
  },
  system: {
    label: 'Hệ thống',
    title: 'Thông báo BusDN',
    icon: 'bell-outline',
    tone: 'neutral',
  },
} as const;

const stringOf = (value: unknown) => (value === undefined || value === null ? '' : String(value));

const idOf = (item: NotificationRecord) => (
  stringOf(item.id || item._id || item.metadata?.notificationId || `${item.type}-${item.createdAt}`)
);

const metadataValue = (item: NotificationRecord, keys: string[]) => {
  for (const key of keys) {
    const value = item.metadata?.[key] ?? (item as unknown as Record<string, unknown>)[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return '';
};

const classifyNotification = (item: NotificationRecord): keyof typeof typeConfig => {
  const raw = `${item.type || ''} ${item.metadata?.type || ''} ${item.metadata?.notificationType || ''}`.toLowerCase();
  if (raw.includes('arrival') || raw.includes('eta')) return 'arrival';
  if (raw.includes('delay')) return 'delay';
  if (raw.includes('route_change') || raw.includes('route-change') || raw.includes('route update') || raw.includes('route_update')) return 'routeChange';
  if (raw.includes('promotion')) return 'promotion';
  return 'system';
};

const notificationTime = (item: NotificationRecord) => (
  item.sentAt || item.deliverySummary?.sentAt || item.createdAt || ''
);

const formatRelativeTime = (value?: string) => {
  if (!value) return 'Gần đây';
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return 'Gần đây';
  const diffMinutes = Math.max(Math.floor((Date.now() - time) / 60000), 0);
  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Hôm qua';
  return new Date(value).toLocaleDateString('vi-VN');
};

const buildEtaLine = (item: NotificationRecord) => {
  const etaRaw = metadataValue(item, ['etaMinutes', 'estimatedMinutes', 'minutesUntilArrival']);
  if (!etaRaw) return '';
  const eta = Number(etaRaw);
  if (Number.isNaN(eta)) return '';
  if (eta < 1) return 'Xe buýt đang đến trạm.';
  return `Xe buýt sẽ đến trong khoảng ${eta} phút.`;
};

const buildDelayLine = (item: NotificationRecord) => {
  const delayRaw = metadataValue(item, ['delayMinutes', 'delayDurationMinutes']);
  const delay = Number(delayRaw);
  if (!delayRaw || Number.isNaN(delay) || delay < 0) return '';
  return `Chuyến bị trễ ${delay} phút.`;
};

const translateNotificationTitle = (title: string) => {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'feedback response received') return 'Đã nhận phản hồi góp ý';
  if (normalized.includes('promotion')) return 'Khuyến mãi';
  if (normalized.includes('bus approaching')) return 'Xe buýt sắp đến';
  if (normalized.includes('route change')) return 'Thay đổi tuyến';
  if (normalized.includes('delay')) return 'Chuyến bị trễ';
  return title;
};

const translateNotificationMessage = (message: string) => {
  let next = message.trim();
  if (!next) return '';

  next = next.replace(
    /Your feedback has received a response from the administrator\.?/gi,
    'Góp ý của bạn đã có phản hồi từ quản trị viên.'
  );
  next = next.replace(
    /Use code ([A-Z0-9_-]+) to get ([0-9.,]+)\s*VND off your next BusDN ticket\. Valid until ([0-9/.-]+)\.?/gi,
    'Dùng mã $1 để giảm $2 VND cho vé BusDN tiếp theo. Có hiệu lực đến $3.'
  );
  next = next.replace(/Valid until/gi, 'Có hiệu lực đến');
  next = next.replace(/BusDN ticket/gi, 'vé BusDN');
  next = next.replace(/your next/gi, 'tiếp theo của bạn');
  return next;
};

const displayTitle = (item: NotificationRecord) => {
  const kind = classifyNotification(item);
  return translateNotificationTitle(item.title || typeConfig[kind].title);
};

const displayMessage = (item: NotificationRecord) => {
  const kind = classifyNotification(item);
  if (kind === 'arrival') return buildEtaLine(item) || translateNotificationMessage(item.message || item.body || '');
  if (kind === 'delay') return buildDelayLine(item) || translateNotificationMessage(item.message || item.body || '');
  return translateNotificationMessage(item.message || item.body || '');
};

const permissionStatus = (): PermissionStatus => {
  const browserNotification = (globalThis as unknown as { Notification?: { permission?: string } }).Notification;
  if (!browserNotification?.permission) return 'unsupported';
  if (browserNotification.permission === 'granted') return 'granted';
  if (browserNotification.permission === 'denied') return 'denied';
  return 'prompt';
};

const requestPermission = async (): Promise<PermissionStatus> => {
  const browserNotification = (globalThis as unknown as {
    Notification?: { requestPermission?: () => Promise<string> | string };
  }).Notification;
  if (!browserNotification?.requestPermission) return 'unsupported';
  const result = await browserNotification.requestPermission();
  if (result === 'granted' || result === 'denied') return result;
  return 'prompt';
};

const mergeNotifications = (current: NotificationRecord[], incoming: NotificationRecord[]) => {
  const byId = new Map<string, NotificationRecord>();
  [...incoming, ...current].forEach((item) => {
    byId.set(idOf(item), { ...byId.get(idOf(item)), ...item });
  });
  return Array.from(byId.values()).sort(
    (a, b) => new Date(notificationTime(b)).getTime() - new Date(notificationTime(a)).getTime()
  );
};

export default function NotificationsScreen() {
  const user = useAuthStore((state) => state.user);
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [pagination, setPagination] = useState<NotificationListResult['pagination']>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingType, setSavingType] = useState<SubscriptionKey | ''>('');
  const [permission, setPermission] = useState<PermissionStatus>(permissionStatus);
  const [arrivalSubs, setArrivalSubs] = useState<NotificationSubscriptionRecord[]>([]);
  const [delaySubs, setDelaySubs] = useState<NotificationSubscriptionRecord[]>([]);
  const [routeChangeSubs, setRouteChangeSubs] = useState<NotificationSubscriptionRecord[]>([]);
  const [realtimeHealthy, setRealtimeHealthy] = useState(true);

  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);
  const filteredItems = useMemo(() => (
    filter === 'all'
      ? items
      : items.filter((item) => classifyNotification(item) === filter)
  ), [filter, items]);

  const loadSubscriptions = useCallback(async () => {
    const [arrival, delay, routeChange] = await Promise.all([
      passengerApi.getArrivalNotificationSubscriptions(),
      passengerApi.getDelayNotificationSubscriptions(),
      passengerApi.getRouteChangeNotificationSubscriptions(),
    ]);
    setArrivalSubs(arrival || []);
    setDelaySubs(delay || []);
    setRouteChangeSubs(routeChange || []);
  }, []);

  const loadNotifications = useCallback(async (page = 1, mode: 'replace' | 'append' | 'poll' = 'replace') => {
    const result = await passengerApi.getNotificationPage({ page, limit: 20 });
    setPagination(result.pagination);
    setItems((current) => {
      if (mode === 'append') return mergeNotifications(current, result.items);
      if (mode === 'poll') return mergeNotifications(current, result.items);
      return mergeNotifications([], result.items);
    });
  }, []);

  const loadAll = useCallback(async (mode: 'initial' | 'refresh' | 'poll' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError('');
    try {
      await Promise.all([
        loadNotifications(1, mode === 'poll' ? 'poll' : 'replace'),
        loadSubscriptions(),
      ]);
      setRealtimeHealthy(true);
    } catch (err) {
      setRealtimeHealthy(false);
      if (mode !== 'poll') setError(getErrorMessage(err, 'Không thể tải thông báo.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadNotifications, loadSubscriptions]);

  useEffect(() => {
    void loadAll('initial');
  }, [loadAll, user?.id]);

  useEffect(() => {
    const timer = setInterval(() => {
      void loadAll('poll');
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadAll]);

  const markRead = async (item: NotificationRecord) => {
    const notificationId = idOf(item);
    if (!notificationId || item.isRead) return;
    setItems((current) => current.map((candidate) => (
      idOf(candidate) === notificationId ? { ...candidate, isRead: true, readAt: new Date().toISOString() } : candidate
    )));
    try {
      await passengerApi.markNotificationRead(notificationId);
    } catch (err) {
      setItems((current) => current.map((candidate) => (
        idOf(candidate) === notificationId ? { ...candidate, isRead: false, readAt: null } : candidate
      )));
      Alert.alert('Không thể đánh dấu đã đọc', getErrorMessage(err, 'Vui lòng thử lại.'));
    }
  };

  const markAllRead = async () => {
    const previous = items;
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, isRead: true, readAt: item.readAt || now })));
    try {
      await passengerApi.markAllNotificationsRead();
    } catch (err) {
      setItems(previous);
      Alert.alert('Không thể đánh dấu tất cả đã đọc', getErrorMessage(err, 'Vui lòng thử lại.'));
    }
  };

  const openNotification = async (item: NotificationRecord) => {
    await markRead(item);
    const kind = classifyNotification(item);
    const routeId = metadataValue(item, ['routeId']) || stringOf(item.routeId);
    const tripId = metadataValue(item, ['tripId']) || stringOf(item.tripId);
    const vehicleId = metadataValue(item, ['vehicleId', 'busId']);
    const stopId = metadataValue(item, ['stopId']);

    if ((kind === 'arrival' || kind === 'delay') && routeId) {
      const params = new URLSearchParams({ routeId });
      if (tripId) params.set('tripId', tripId);
      if (vehicleId) params.set('vehicleId', vehicleId);
      if (stopId) params.set('stopId', stopId);
      router.push(`/live-tracking?${params.toString()}` as Href);
      return;
    }

    if (kind === 'routeChange' && routeId) {
      router.push({ pathname: '/route-detail/[routeId]', params: { routeId } } as unknown as Href);
      return;
    }

    if (kind === 'promotion') {
      router.push('/buy-oneway-ticket');
      return;
    }

    if (item.actionUrl?.includes('profile') || kind === 'system') {
      router.push('/profile');
    }
  };

  const loadMore = async () => {
    const nextPage = Number(pagination.page || 1) + 1;
    if (loadingMore || nextPage > Number(pagination.totalPages || 1)) return;
    setLoadingMore(true);
    try {
      await loadNotifications(nextPage, 'append');
    } catch (err) {
      Alert.alert('Không thể tải thêm', getErrorMessage(err, 'Vui lòng thử lại.'));
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleGlobal = async (enabled: boolean) => {
    if (!user) {
      Alert.alert('Yêu cầu đăng nhập', 'Vui lòng đăng nhập bằng tài khoản hành khách để quản lý thông báo.');
      return;
    }

    const previousPermission = permission;
    setSavingGlobal(true);
    try {
      let nextPermission = permissionStatus();
      if (enabled && nextPermission === 'prompt') nextPermission = await requestPermission();
      setPermission(nextPermission);

      if (enabled && nextPermission === 'denied') {
        Alert.alert('Thông báo bị chặn', 'Hãy bật quyền thông báo trong cài đặt thiết bị rồi thử lại.');
        return;
      }

      await passengerApi.updateNotificationEnabled(user, enabled);
      await refreshUser();
    } catch (err) {
      setPermission(previousPermission);
      Alert.alert('Không thể lưu cài đặt', getErrorMessage(err, 'Vui lòng thử lại.'));
    } finally {
      setSavingGlobal(false);
    }
  };

  const disableSubscriptions = async (key: SubscriptionKey) => {
    const subscriptions = key === 'arrival' ? arrivalSubs : key === 'delay' ? delaySubs : routeChangeSubs;
    if (!subscriptions.length) {
      router.push('/route-search');
      setSettingsOpen(false);
      return;
    }

    setSavingType(key);
    try {
      if (key === 'arrival') {
        await Promise.all(subscriptions.map((item) => passengerApi.removeArrivalNotificationSubscription(item.subscriptionId)));
      } else if (key === 'delay') {
        await Promise.all(subscriptions.map((item) => passengerApi.removeDelayNotificationSubscription(item.subscriptionId)));
      } else {
        await Promise.all(subscriptions.map((item) => passengerApi.removeRouteChangeNotificationSubscription(item.subscriptionId)));
      }
      await loadSubscriptions();
    } catch (err) {
      Alert.alert('Không thể cập nhật loại thông báo', getErrorMessage(err, 'Vui lòng thử lại.'));
    } finally {
      setSavingType('');
    }
  };

  const renderPermissionText = () => {
    if (permission === 'granted') return 'Thiết bị đã cho phép nhận thông báo.';
    if (permission === 'prompt') return 'Chưa chọn quyền thông báo. BusDN chỉ hỏi quyền sau khi bạn bật thông báo.';
    if (permission === 'denied') return 'Quyền thông báo đang bị chặn trong trình duyệt hoặc cài đặt thiết bị.';
    return 'Phiên bản Mobile này chưa hỗ trợ quyền thông báo đẩy; tùy chọn tài khoản vẫn được lưu trên hệ thống.';
  };

  return (
    <PassengerLayout
      active="activity"
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.primary} onRefresh={() => void loadAll('refresh')} />}
      rightAction={(
        <Pressable accessibilityLabel="Mở cài đặt thông báo" hitSlop={10} onPress={() => setSettingsOpen(true)}>
          <MaterialCommunityIcons color={colors.primary} name="cog-outline" size={24} />
        </Pressable>
      )}
      subtitle={`${unreadCount} thông báo chưa đọc`}
      title="Thông báo"
      unreadCount={unreadCount}
    >
      <View style={styles.summary}>
        <View>
          <Text style={styles.summaryLabel}>Trung tâm thông báo</Text>
          <Text style={styles.summaryTitle}>{unreadCount ? `${unreadCount} chưa đọc` : 'Đã đọc hết'}</Text>
        </View>
        <Pressable accessibilityRole="button" disabled={!unreadCount} onPress={markAllRead} style={[styles.markAllButton, !unreadCount && styles.disabledButton]}>
          <MaterialCommunityIcons color={unreadCount ? colors.white : colors.muted} name="check-all" size={18} />
          <Text style={[styles.markAllText, !unreadCount && styles.disabledText]}>Đọc tất cả</Text>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((item) => (
          <Pressable key={item.key} onPress={() => setFilter(item.key)} style={[styles.filterChip, filter === item.key && styles.filterChipActive]}>
            <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {!realtimeHealthy ? (
        <View style={styles.inlineWarning}>
          <MaterialCommunityIcons color="#6f5200" name="wifi-alert" size={18} />
          <Text style={styles.inlineWarningText}>Không thể cập nhật theo thời gian thực. Kéo xuống để thử lại.</Text>
        </View>
      ) : null}

      {loading ? <LoadingState label="Đang tải thông báo" /> : null}
      {!loading && error ? <EmptyState icon="alert-circle-outline" title="Không thể tải thông báo" detail={error} /> : null}
      {!loading && !error && !filteredItems.length ? (
        <EmptyState title="Chưa có thông báo" detail={filter === 'all' ? 'Các cập nhật mới từ BusDN sẽ xuất hiện tại đây.' : 'Không có cập nhật phù hợp với bộ lọc.'} />
      ) : null}

      {!loading && !error && filteredItems.map((item) => (
        <NotificationCard
          item={item}
          key={idOf(item)}
          onMarkRead={() => void markRead(item)}
          onOpen={() => void openNotification(item)}
        />
      ))}

      {!loading && !error && Number(pagination.page || 1) < Number(pagination.totalPages || 1) ? (
        <Pressable disabled={loadingMore} onPress={loadMore} style={styles.loadMore}>
          {loadingMore ? <ActivityIndicator color={colors.primary} /> : <MaterialCommunityIcons color={colors.primary} name="dots-horizontal-circle-outline" size={18} />}
          <Text style={styles.loadMoreText}>Tải thêm</Text>
        </Pressable>
      ) : null}

      <Modal animationType="slide" transparent visible={settingsOpen} onRequestClose={() => setSettingsOpen(false)}>
        <View style={styles.modalShade}>
          <View style={styles.settingsPanel}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cài đặt thông báo</Text>
              <Pressable accessibilityLabel="Đóng cài đặt" hitSlop={10} onPress={() => setSettingsOpen(false)}>
                <MaterialCommunityIcons color={colors.primary} name="close" size={24} />
              </Pressable>
            </View>

            <SettingRow
              detail={renderPermissionText()}
              disabled={savingGlobal}
              icon="bell-ring-outline"
              label="Cho phép thông báo"
              loading={savingGlobal}
              onValueChange={toggleGlobal}
              value={Boolean(user?.notificationEnabled)}
            />
            <SettingRow
              detail={`${arrivalSubs.length} cảnh báo trạm đang bật`}
              disabled={savingType !== ''}
              icon="bus-clock"
              label="Xe sắp đến"
              loading={savingType === 'arrival'}
              onValueChange={() => void disableSubscriptions('arrival')}
              value={arrivalSubs.length > 0}
            />
            <SettingRow
              detail={`${delaySubs.length} cảnh báo trễ chuyến đang bật`}
              disabled={savingType !== ''}
              icon="clock-alert-outline"
              label="Chuyến bị trễ"
              loading={savingType === 'delay'}
              onValueChange={() => void disableSubscriptions('delay')}
              value={delaySubs.length > 0}
            />
            <SettingRow
              detail={`${routeChangeSubs.length} cảnh báo thay đổi tuyến đang bật`}
              disabled={savingType !== ''}
              icon="routes"
              label="Thay đổi tuyến"
              loading={savingType === 'routeChange'}
              onValueChange={() => void disableSubscriptions('routeChange')}
              value={routeChangeSubs.length > 0}
            />

            <Pressable onPress={() => { setSettingsOpen(false); router.push('/route-search'); }} style={styles.manageRoutesButton}>
              <MaterialCommunityIcons color={colors.primary} name="compass-outline" size={18} />
              <Text style={styles.manageRoutesText}>Quản lý thông báo tuyến và điểm dừng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </PassengerLayout>
  );
}

function NotificationCard({ item, onOpen, onMarkRead }: { item: NotificationRecord; onOpen: () => void; onMarkRead: () => void }) {
  const kind = classifyNotification(item);
  const config = typeConfig[kind];
  const isRead = Boolean(item.isRead);
  const routeNumber = metadataValue(item, ['routeNumber', 'routeCode']);
  const stopName = metadataValue(item, ['stopName']);
  const vehicle = metadataValue(item, ['vehicleId', 'busId', 'plateNumber']);

  return (
    <Pressable
      accessibilityLabel={`${config.label}: ${displayTitle(item)}`}
      accessibilityRole="button"
      onPress={onOpen}
      style={[styles.card, styles[`${config.tone}Card`], isRead && styles.readCard]}
    >
      <View style={[styles.iconBox, styles[`${config.tone}Icon`]]}>
        <MaterialCommunityIcons color={config.tone === 'danger' ? colors.error : colors.primary} name={config.icon} size={24} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={[styles.typeBadge, styles[`${config.tone}Badge`]]}>
            <Text style={[styles.typeText, styles[`${config.tone}Text`]]}>{config.label}</Text>
          </View>
          <Text style={styles.timeText}>{formatRelativeTime(notificationTime(item))}</Text>
        </View>
        <Text style={styles.cardTitle}>{displayTitle(item)}</Text>
        <Text style={styles.cardMessage}>{displayMessage(item)}</Text>
        <View style={styles.metaRow}>
          {routeNumber ? <MetaItem icon="map-marker-path" text={`Tuyến ${routeNumber}`} /> : null}
          {stopName ? <MetaItem icon="bus-stop" text={stopName} /> : null}
          {vehicle ? <MetaItem icon="identifier" text={vehicle} /> : null}
          <MetaItem icon={isRead ? 'check-circle-outline' : 'circle-medium'} text={isRead ? 'Đã đọc' : 'Chưa đọc'} />
        </View>
      </View>
      {!isRead ? (
        <Pressable accessibilityLabel="Đánh dấu thông báo đã đọc" hitSlop={8} onPress={onMarkRead} style={styles.readButton}>
          <MaterialCommunityIcons color={colors.primary} name="check" size={18} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function MetaItem({ icon, text }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; text: string }) {
  return (
    <View style={styles.metaItem}>
      <MaterialCommunityIcons color={colors.secondary} name={icon} size={14} />
      <Text numberOfLines={1} style={styles.metaText}>{text}</Text>
    </View>
  );
}

function SettingRow({
  detail,
  disabled,
  icon,
  label,
  loading,
  onValueChange,
  value,
}: {
  detail: string;
  disabled?: boolean;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  loading?: boolean;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View style={[styles.settingRow, disabled && styles.settingDisabled]}>
      <View style={styles.settingIcon}>
        <MaterialCommunityIcons color={colors.primary} name={icon} size={22} />
      </View>
      <View style={styles.settingCopy}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDetail}>{detail}</Text>
      </View>
      {loading ? <ActivityIndicator color={colors.primary} /> : (
        <Switch disabled={disabled} onValueChange={onValueChange} value={value} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    borderRadius: 22,
    backgroundColor: colors.primaryContainer,
    padding: 16,
  },
  summaryLabel: { color: '#bff0d8', fontSize: 12, fontWeight: '800' },
  summaryTitle: { marginTop: 4, color: colors.white, fontSize: 22, fontWeight: '900' },
  markAllButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 21,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
  },
  markAllText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  disabledButton: { backgroundColor: colors.surfaceHigh },
  disabledText: { color: colors.muted },
  filterRow: { flexDirection: 'row', gap: 8, marginHorizontal: -18, paddingHorizontal: 18 },
  filterChip: {
    minHeight: 38,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: 19,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
  },
  filterChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterText: { color: colors.secondary, fontSize: 12, fontWeight: '900' },
  filterTextActive: { color: colors.white },
  inlineWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: '#fff4cc',
    padding: 12,
  },
  inlineWarningText: { flex: 1, color: '#6f5200', fontSize: 12, fontWeight: '800' },
  card: {
    position: 'relative',
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(43,164,113,0.18)',
    borderRadius: 22,
    backgroundColor: '#d8f6e7',
    padding: 14,
    shadowColor: '#001a0f',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  readCard: { backgroundColor: colors.card, borderColor: 'rgba(193,200,195,0.5)', opacity: 0.72 },
  successCard: { backgroundColor: '#d8f6e7' },
  dangerCard: { backgroundColor: colors.errorContainer },
  infoCard: { backgroundColor: '#dce8ff' },
  neutralCard: { backgroundColor: colors.card },
  iconBox: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  successIcon: { backgroundColor: 'rgba(255,255,255,0.55)' },
  dangerIcon: { backgroundColor: 'rgba(255,255,255,0.6)' },
  infoIcon: { backgroundColor: 'rgba(255,255,255,0.58)' },
  neutralIcon: { backgroundColor: colors.surfaceLow },
  cardBody: { flex: 1, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  typeBadge: { alignSelf: 'flex-start', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3 },
  successBadge: { backgroundColor: colors.accent },
  dangerBadge: { backgroundColor: colors.error },
  infoBadge: { backgroundColor: '#1f5fad' },
  neutralBadge: { backgroundColor: colors.surfaceLow },
  typeText: { color: colors.white, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  successText: { color: colors.white },
  dangerText: { color: colors.white },
  infoText: { color: colors.white },
  neutralText: { color: colors.secondary },
  timeText: { color: colors.secondary, fontSize: 10, fontWeight: '800' },
  cardTitle: { color: colors.primary, fontSize: 17, fontWeight: '900' },
  cardMessage: { color: colors.secondary, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 2 },
  metaItem: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: colors.secondary, fontSize: 11, fontWeight: '800' },
  readButton: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.76)',
  },
  loadMore: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: 22,
    backgroundColor: colors.card,
  },
  loadMoreText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.28)' },
  settingsPanel: {
    gap: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.surface,
    padding: 18,
    paddingBottom: 28,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  modalTitle: { color: colors.primary, fontSize: 20, fontWeight: '900' },
  settingRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: 18,
    backgroundColor: colors.card,
    padding: 12,
  },
  settingDisabled: { opacity: 0.62 },
  settingIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.surfaceLow,
  },
  settingCopy: { flex: 1 },
  settingLabel: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  settingDetail: { marginTop: 3, color: colors.secondary, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  manageRoutesButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 22,
    backgroundColor: colors.surfaceLow,
  },
  manageRoutesText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
});
