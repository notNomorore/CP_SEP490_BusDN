import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

import passengerApi, { type LostItemCase } from '@/api/passenger.api';
import { EmptyState, LoadingState, PassengerLayout, StatusPill } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';
import { formatLostItemCaseCode, getLostItemCategoryLabel, getLostItemStatusInfo, lostItemStatuses } from '@/utils/lostItemDisplay';

const formatDate = (value?: string) => (
  value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Chưa có'
);

export default function MyLostItemsScreen() {
  const [items, setItems] = useState<LostItemCase[]>([]);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const result = await passengerApi.getMyLostItems();
      setItems(result.items || []);
    } catch (err) {
      setError((err as { message?: string })?.message || 'Không thể tải hồ sơ đồ thất lạc.');
    } finally {
      refresh ? setRefreshing(false) : setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return items.filter((item) => {
      const caseStatus = item.currentCaseStatus || item.status || 'SUBMITTED';
      const matchStatus = status === 'ALL' || caseStatus === status;
      const matchKeyword = !keyword || [
        item.caseId,
        item.referenceNumber,
        item.lostItem?.itemName,
        item.lostItem?.itemCategory,
        item.routeName,
        item.description,
      ].some((value) => String(value || '').toLowerCase().includes(keyword));
      return matchStatus && matchKeyword;
    });
  }, [items, search, status]);

  return (
    <PassengerLayout
      active="profile"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}
      rightAction={(
        <Pressable accessibilityLabel="Báo mất đồ" onPress={() => router.push('/report-lost-item' as Href)} style={styles.iconButton}>
          <MaterialCommunityIcons color={colors.primary} name="plus" size={22} />
        </Pressable>
      )}
      subtitle="Theo dõi trạng thái xử lý"
      title="Hồ sơ thất lạc"
    >
      <View style={styles.searchBox}>
        <MaterialCommunityIcons color={colors.secondary} name="magnify" size={20} />
        <TextInput
          onChangeText={setSearch}
          placeholder="Tìm mã hồ sơ, đồ vật, tuyến..."
          placeholderTextColor={colors.secondary}
          style={styles.searchInput}
          value={search}
        />
      </View>

      <View style={styles.statusWrap}>
        {lostItemStatuses.map((item) => {
          const active = item.value === status;
          return (
            <Pressable key={item.value} onPress={() => setStatus(item.value)} style={[styles.statusChip, active && styles.statusChipActive]}>
              <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? <LoadingState label="Đang tải hồ sơ đồ thất lạc" /> : null}
      {!loading && error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => load()} style={styles.retryButton}><Text style={styles.retryText}>Thử lại</Text></Pressable>
        </View>
      ) : null}
      {!loading && !error && !filteredItems.length ? (
        <EmptyState icon="package-variant-closed-remove" title="Chưa có hồ sơ phù hợp" detail="Báo mất đồ để BusDN hỗ trợ tìm kiếm và cập nhật trạng thái tại đây." />
      ) : null}

      {!loading && !error && filteredItems.map((item) => {
        const statusInfo = getLostItemStatusInfo(item.currentCaseStatus || item.status);
        const caseId = item.caseId || item.referenceNumber || item.id;
        return (
          <Pressable
            key={item.id}
            onPress={() => router.push({ pathname: '/lost-items/[caseId]', params: { caseId } } as unknown as Href)}
            style={styles.card}
          >
            <View style={styles.cardTop}>
              <View style={styles.caseBadge}>
                <MaterialCommunityIcons color={colors.white} name="package-variant" size={14} />
                <Text style={styles.caseBadgeText}>{formatLostItemCaseCode(caseId)}</Text>
              </View>
              <StatusPill label={statusInfo.label} tone={statusInfo.tone} />
            </View>
            <Text numberOfLines={2} style={styles.title}>{item.lostItem?.itemName || item.title || 'Đồ thất lạc'}</Text>
            <Text numberOfLines={1} style={styles.meta}>{getLostItemCategoryLabel(item.lostItem?.itemCategory)} - {item.routeName || item.tripCode || 'Chưa liên kết chuyến'}</Text>
            <View style={styles.footer}>
              <Text style={styles.footerText}>Mất lúc {formatDate(item.lostItem?.lostAt)}</Text>
              <Text style={styles.footerText}>Cập nhật {formatDate(item.lastUpdatedAt || item.updatedAt)}</Text>
            </View>
          </Pressable>
        );
      })}
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
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  caseBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: colors.primaryContainer, paddingHorizontal: 10, paddingVertical: 6 },
  caseBadgeText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  title: { color: colors.primary, fontSize: 17, lineHeight: 22, fontWeight: '900' },
  meta: { color: colors.secondary, fontSize: 12, fontWeight: '700' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footerText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  errorCard: { gap: 10, borderRadius: 20, backgroundColor: colors.errorContainer, padding: 16 },
  errorText: { color: colors.error, fontSize: 13, fontWeight: '800' },
  retryButton: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: colors.white, paddingHorizontal: 13, paddingVertical: 8 },
  retryText: { color: colors.error, fontSize: 12, fontWeight: '900' },
});
