import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

import passengerApi, { type PassengerFeedback } from '@/api/passenger.api';
import { EmptyState, LoadingState, PassengerLayout, StatusPill } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';
import { feedbackStatuses, getFeedbackCategoryLabel, getFeedbackStatusInfo } from '@/utils/feedbackDisplay';

const formatDate = (value?: string) => (
  value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Chưa có'
);

export default function MyFeedbackScreen() {
  const [items, setItems] = useState<PassengerFeedback[]>([]);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const result = await passengerApi.getMyFeedback({ status, search: search.trim(), page, limit: 10 });
      setItems(result.items || []);
      setTotalPages(result.meta.totalPages || 1);
    } catch (err) {
      setError((err as { message?: string })?.message || 'Không thể tải danh sách góp ý.');
    } finally {
      refresh ? setRefreshing(false) : setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PassengerLayout
      active="profile"
      subtitle="Theo dõi phản hồi đã gửi"
      title="Góp ý của tôi"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />}
      rightAction={(
        <Pressable accessibilityLabel="Gửi góp ý" onPress={() => router.push('/submit-feedback')} style={styles.iconButton}>
          <MaterialCommunityIcons color={colors.primary} name="plus" size={22} />
        </Pressable>
      )}
    >
      <View style={styles.searchBox}>
        <MaterialCommunityIcons color={colors.secondary} name="magnify" size={20} />
        <TextInput
          onChangeText={(value) => {
            setSearch(value);
            setPage(1);
          }}
          onSubmitEditing={() => load()}
          placeholder="Tìm theo tiêu đề hoặc mã tham chiếu"
          placeholderTextColor={colors.secondary}
          style={styles.searchInput}
          value={search}
        />
      </View>

      <View style={styles.statusWrap}>
        {feedbackStatuses.map((item) => {
          const active = item.value === status;
          return (
            <Pressable
              key={item.value}
              onPress={() => {
                setStatus(item.value);
                setPage(1);
              }}
              style={[styles.statusChip, active && styles.statusChipActive]}
            >
              <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? <LoadingState label="Đang tải góp ý" /> : null}
      {!loading && error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => load()} style={styles.retryButton}><Text style={styles.retryText}>Thử lại</Text></Pressable>
        </View>
      ) : null}
      {!loading && !error && !items.length ? (
        <EmptyState icon="message-text-outline" title="Chưa có góp ý" detail="Gửi phản hồi đầu tiên để BusDN hỗ trợ bạn." />
      ) : null}

      {!loading && !error && items.map((item) => {
        const statusInfo = getFeedbackStatusInfo(item.status);
        return (
          <Pressable
            key={item.id}
            onPress={() => router.push({ pathname: '/feedback/[feedbackId]', params: { feedbackId: item.id } } as unknown as Href)}
            style={styles.card}
          >
            <View style={styles.cardTop}>
              <StatusPill label={statusInfo.label} tone={statusInfo.tone} />
            </View>
            <Text numberOfLines={2} style={styles.title}>{item.title || 'Góp ý dịch vụ'}</Text>
            <Text numberOfLines={1} style={styles.meta}>{getFeedbackCategoryLabel(item.category)} - {item.routeName || item.tripCode || 'Chưa có tuyến'}</Text>
            <View style={styles.footer}>
              <Text style={styles.footerText}>★ {item.ratingScore || item.rating || '-'} / 5</Text>
              <Text style={styles.footerText}>Cập nhật {formatDate(item.updatedAt)}</Text>
            </View>
            {statusInfo.canReply ? <Text style={styles.replyHint}>BusDN đang chờ bạn bổ sung thông tin.</Text> : null}
          </Pressable>
        );
      })}

      {!loading && !error && items.length ? (
        <View style={styles.pagination}>
          <Pressable disabled={page <= 1} onPress={() => setPage((current) => Math.max(1, current - 1))} style={[styles.pageButton, page <= 1 && styles.disabled]}>
            <Text style={styles.pageText}>Trước</Text>
          </Pressable>
          <Text style={styles.pageCount}>{page}/{totalPages}</Text>
          <Pressable disabled={page >= totalPages} onPress={() => setPage((current) => current + 1)} style={[styles.pageButton, page >= totalPages && styles.disabled]}>
            <Text style={styles.pageText}>Sau</Text>
          </Pressable>
        </View>
      ) : null}
    </PassengerLayout>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.card },
  searchBox: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 18, backgroundColor: colors.card, paddingHorizontal: 14 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  statusWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: { borderRadius: 999, backgroundColor: colors.card, paddingHorizontal: 13, paddingVertical: 9 },
  statusChipActive: { backgroundColor: colors.primaryContainer },
  statusChipText: { color: colors.secondary, fontSize: 12, fontWeight: '900' },
  statusChipTextActive: { color: colors.white },
  card: { gap: 9, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  title: { color: colors.primary, fontSize: 17, lineHeight: 22, fontWeight: '900' },
  meta: { color: colors.secondary, fontSize: 12, fontWeight: '700' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footerText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  replyHint: { color: '#6f5200', fontSize: 12, fontWeight: '900' },
  errorCard: { gap: 10, borderRadius: 20, backgroundColor: colors.errorContainer, padding: 16 },
  errorText: { color: colors.error, fontSize: 13, fontWeight: '800' },
  retryButton: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: colors.white, paddingHorizontal: 13, paddingVertical: 8 },
  retryText: { color: colors.error, fontSize: 12, fontWeight: '900' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  pageButton: { borderRadius: 999, backgroundColor: colors.card, paddingHorizontal: 15, paddingVertical: 10 },
  disabled: { opacity: 0.45 },
  pageText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  pageCount: { color: colors.secondary, fontSize: 12, fontWeight: '900' },
});
