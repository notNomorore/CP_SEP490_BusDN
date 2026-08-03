import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';

import passengerApi, { type LostItemCase, type LostItemTimelineRecord } from '@/api/passenger.api';
import { EmptyState, LoadingState, PassengerLayout, StatusPill } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';
import { formatLostItemCaseCode, getLostItemCategoryLabel, getLostItemStatusInfo } from '@/utils/lostItemDisplay';

const formatDate = (value?: string) => (
  value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Chưa có'
);

export default function LostItemCaseDetailScreen() {
  const { caseId } = useLocalSearchParams<{ caseId: string }>();
  const [supportCase, setSupportCase] = useState<LostItemCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (!caseId) {
      setError('Thiếu mã hồ sơ đồ thất lạc.');
      setLoading(false);
      return;
    }
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      setSupportCase(await passengerApi.getLostItemDetail(caseId));
    } catch (err) {
      setError((err as { message?: string })?.message || 'Không thể tải chi tiết hồ sơ.');
    } finally {
      refresh ? setRefreshing(false) : setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusInfo = getLostItemStatusInfo(supportCase?.currentCaseStatus || supportCase?.status);
  const recoveryInfo = getLostItemStatusInfo(supportCase?.lostItem?.recoveryStatus);
  const timeline = useMemo(() => supportCase?.timeline || [], [supportCase?.timeline]);

  return (
    <PassengerLayout
      active="profile"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}
      subtitle={supportCase ? formatLostItemCaseCode(supportCase.caseId || supportCase.referenceNumber || supportCase.id) : 'Chi tiết hồ sơ'}
      title="Hồ sơ thất lạc"
    >
      {loading ? <LoadingState label="Đang tải chi tiết hồ sơ" /> : null}
      {!loading && error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      {!loading && !error && !supportCase ? <EmptyState title="Không tìm thấy hồ sơ" /> : null}

      {supportCase ? (
        <>
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <View style={styles.iconBox}>
                <MaterialCommunityIcons color={colors.primary} name="package-variant-closed" size={26} />
              </View>
              <View style={styles.summaryCopy}>
                <Text style={styles.caseCode}>{formatLostItemCaseCode(supportCase.caseId || supportCase.referenceNumber || supportCase.id)}</Text>
                <Text numberOfLines={2} style={styles.itemName}>{supportCase.lostItem?.itemName || supportCase.title || 'Đồ thất lạc'}</Text>
              </View>
            </View>
            <View style={styles.pillRow}>
              <StatusPill label={statusInfo.label} tone={statusInfo.tone} />
              <StatusPill label={`Tìm kiếm: ${recoveryInfo.label}`} tone={recoveryInfo.tone} />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Thông tin báo mất đồ</Text>
            <Info label="Tên đồ vật" value={supportCase.lostItem?.itemName} />
            <Info label="Loại đồ vật" value={getLostItemCategoryLabel(supportCase.lostItem?.itemCategory)} />
            <Info label="Mô tả" value={supportCase.description || supportCase.lostItem?.itemDescription} multiline />
            <Info label="Vị trí dự kiến bị mất" value={supportCase.lostItem?.lastSeenLocation} multiline />
            <Info label="Thời gian bị mất" value={formatDate(supportCase.lostItem?.lostAt)} />
            <Info label="Chuyến/tuyến" value={supportCase.routeName || supportCase.tripCode || supportCase.relatedTripId} />
            <Info label="Liên hệ" value={[supportCase.contactPhone, supportCase.contactEmail].filter(Boolean).join(' - ')} />
            <Info label="Cập nhật lần cuối" value={formatDate(supportCase.lastUpdatedAt || supportCase.updatedAt)} />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Tiến trình xử lý</Text>
            {timeline.length ? timeline.map((item, index) => (
              <TimelineItem key={`${item.status}-${item.timestamp}-${index}`} item={item} last={index === timeline.length - 1} />
            )) : <EmptyState icon="timeline-clock-outline" title="Chưa có tiến trình" detail="BusDN sẽ cập nhật khi hồ sơ được xử lý." />}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Phản hồi từ nhân viên</Text>
            {supportCase.administratorNotes?.length ? supportCase.administratorNotes.map((note, index) => (
              <View key={`${note.createdAt}-${index}`} style={styles.note}>
                <Text style={styles.noteText}>{note.message}</Text>
                <Text style={styles.noteMeta}>{note.responder?.fullName || 'BusDN'} - {formatDate(note.createdAt)}</Text>
              </View>
            )) : <Text style={styles.emptyText}>Chưa có phản hồi từ nhân viên.</Text>}
          </View>

          <View style={styles.rules}>
            <Text style={styles.rulesTitle}>Kết quả / hướng dẫn</Text>
            <Text style={styles.rulesText}>{supportCase.collectionInstructions || 'Chưa có kết quả tìm kiếm. Vui lòng theo dõi trạng thái hồ sơ trong mục này.'}</Text>
          </View>

          {refreshing ? <ActivityIndicator color={colors.accent} /> : null}
        </>
      ) : null}
    </PassengerLayout>
  );
}

function Info({ label, value, multiline }: { label: string; value?: string; multiline?: boolean }) {
  return (
    <View style={[styles.infoRow, multiline && styles.infoRowStack]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={multiline ? 5 : 2} style={[styles.infoValue, multiline && styles.infoValueStack]}>{value || 'Chưa có thông tin'}</Text>
    </View>
  );
}

function TimelineItem({ item, last }: { item: LostItemTimelineRecord; last: boolean }) {
  const statusInfo = getLostItemStatusInfo(item.status);
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        <View style={styles.timelineDot}>
          <MaterialCommunityIcons color={colors.white} name="check" size={13} />
        </View>
        {!last ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={styles.timelineCopy}>
        <Text style={styles.timelineTitle}>{statusInfo.label || item.label}</Text>
        <Text style={styles.timelineMessage}>{item.message || 'Hồ sơ đã được cập nhật.'}</Text>
        <Text style={styles.timelineTime}>{formatDate(item.timestamp)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: { gap: 14, borderRadius: 24, backgroundColor: colors.primaryContainer, padding: 18 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#b5efd1' },
  summaryCopy: { flex: 1 },
  caseCode: { color: '#a6f2d1', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  itemName: { marginTop: 4, color: colors.white, fontSize: 22, lineHeight: 27, fontWeight: '900' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { gap: 10, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  sectionTitle: { color: colors.primary, fontSize: 17, fontWeight: '900' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outline, paddingVertical: 9 },
  infoRowStack: { flexDirection: 'column', gap: 5 },
  infoLabel: { flex: 0.46, color: colors.secondary, fontSize: 12, fontWeight: '800' },
  infoValue: { flex: 1, color: colors.primary, fontSize: 12, fontWeight: '900', textAlign: 'right' },
  infoValueStack: { textAlign: 'left', lineHeight: 18 },
  timelineRow: { flexDirection: 'row', gap: 11 },
  timelineRail: { alignItems: 'center', width: 24 },
  timelineDot: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primaryContainer },
  timelineLine: { flex: 1, minHeight: 38, width: 2, backgroundColor: colors.outline },
  timelineCopy: { flex: 1, paddingBottom: 14 },
  timelineTitle: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  timelineMessage: { marginTop: 3, color: colors.secondary, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  timelineTime: { marginTop: 4, color: colors.muted, fontSize: 11, fontWeight: '800' },
  note: { gap: 5, borderRadius: 16, backgroundColor: colors.surfaceLow, padding: 12 },
  noteText: { color: colors.primary, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  noteMeta: { color: colors.secondary, fontSize: 11, fontWeight: '700' },
  emptyText: { color: colors.secondary, fontSize: 12, fontWeight: '700' },
  rules: { gap: 8, borderRadius: 22, backgroundColor: '#d8f6e7', padding: 16 },
  rulesTitle: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  rulesText: { color: colors.secondary, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  errorCard: { gap: 10, borderRadius: 20, backgroundColor: colors.errorContainer, padding: 16 },
  errorText: { color: colors.error, fontSize: 13, fontWeight: '800' },
});
