import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import passengerApi, { type PassengerFeedback } from '@/api/passenger.api';
import { AppButton } from '@/components/AppButton';
import { EmptyState, LoadingState, PassengerLayout, StatusPill } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';
import { getFeedbackCategoryLabel, getFeedbackStatusInfo } from '@/utils/feedbackDisplay';

const formatDate = (value?: string) => (
  value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Chưa có'
);

export default function FeedbackDetailScreen() {
  const { feedbackId } = useLocalSearchParams<{ feedbackId: string }>();
  const [feedback, setFeedback] = useState<PassengerFeedback | null>(null);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [replying, setReplying] = useState(false);
  const [error, setError] = useState('');
  const [replyError, setReplyError] = useState('');

  const load = useCallback(async () => {
    if (!feedbackId) {
      setLoading(false);
      setError('Thiếu mã góp ý.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setFeedback(await passengerApi.getFeedbackDetail(feedbackId));
    } catch (err) {
      setError((err as { message?: string })?.message || 'Không thể tải chi tiết góp ý.');
    } finally {
      setLoading(false);
    }
  }, [feedbackId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedConversation = useMemo(() => (
    [...(feedback?.conversation || [])].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
  ), [feedback?.conversation]);

  const statusInfo = getFeedbackStatusInfo(feedback?.status);

  const submitReply = async () => {
    if (!feedback?.id || replying) return;
    const message = reply.trim();
    if (!message) {
      setReplyError('Vui lòng nhập nội dung bổ sung.');
      return;
    }
    setReplying(true);
    setReplyError('');
    try {
      setFeedback(await passengerApi.replyToFeedback(feedback.id, { message }));
      setReply('');
    } catch (err) {
      const messageText = (err as { message?: string })?.message || 'Không thể gửi phản hồi bổ sung. Trạng thái có thể đã thay đổi.';
      setReplyError(messageText);
      await load();
    } finally {
      setReplying(false);
    }
  };

  return (
    <PassengerLayout active="profile" subtitle={feedback?.referenceNumber || 'Chi tiết góp ý'} title="Chi tiết góp ý">
      {loading ? <LoadingState label="Đang tải chi tiết" /> : null}
      {!loading && error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load} style={styles.retryButton}><Text style={styles.retryText}>Thử lại</Text></Pressable>
        </View>
      ) : null}
      {!loading && !error && !feedback ? <EmptyState title="Không tìm thấy góp ý" /> : null}
      {feedback ? (
        <>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <Text style={styles.reference}>{feedback.referenceNumber || feedback.id}</Text>
              <StatusPill label={statusInfo.label} tone={statusInfo.tone} />
            </View>
            <Text style={styles.title}>{feedback.title || 'Góp ý dịch vụ'}</Text>
            <Text style={styles.description}>{statusInfo.description}</Text>
          </View>

          <View style={styles.infoGrid}>
            <Info label="Danh mục" value={getFeedbackCategoryLabel(feedback.category)} />
            <Info label="Đánh giá" value={`${feedback.ratingScore || feedback.rating || '-'} / 5`} />
            <Info label="Chuyến/tuyến" value={feedback.routeName || feedback.tripCode || 'Chưa có'} />
            <Info label="Ngày gửi" value={formatDate(feedback.createdAt)} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nội dung đã gửi</Text>
            <Text style={styles.bodyText}>{feedback.description || 'Không có nội dung.'}</Text>
          </View>

          {feedback.adminResponse || feedback.resolutionSummary ? (
            <View style={styles.adminCard}>
              <Text style={styles.cardTitle}>Phản hồi từ BusDN</Text>
              {feedback.adminResponse ? <Text style={styles.bodyText}>{feedback.adminResponse}</Text> : null}
              {feedback.resolutionSummary ? <Text style={styles.bodyText}>Kết luận: {feedback.resolutionSummary}</Text> : null}
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons color={colors.primary} name="message-reply-text-outline" size={21} />
              <Text style={styles.cardTitle}>Trao đổi</Text>
            </View>
            {!sortedConversation.length ? <Text style={styles.bodyText}>Chưa có tin nhắn trao đổi.</Text> : null}
            {sortedConversation.map((message) => {
              const isAdmin = message.senderRole === 'ADMIN';
              return (
                <View key={message.id || `${message.createdAt}-${message.message}`} style={[styles.message, isAdmin ? styles.adminMessage : styles.passengerMessage]}>
                  <View style={styles.messageTop}>
                    <Text style={styles.messageSender}>{isAdmin ? 'BusDN Support' : 'Bạn'}</Text>
                    <Text style={styles.messageTime}>{formatDate(message.createdAt)}</Text>
                  </View>
                  <Text style={styles.messageBody}>{message.message || ''}</Text>
                </View>
              );
            })}
          </View>

          {statusInfo.canReply ? (
            <View style={styles.replyBox}>
              <Text style={styles.cardTitle}>Bổ sung thông tin</Text>
              <TextInput
                multiline
                onChangeText={setReply}
                placeholder="Nhập thông tin BusDN yêu cầu bổ sung..."
                placeholderTextColor={colors.secondary}
                style={styles.replyInput}
                textAlignVertical="top"
                value={reply}
              />
              {replyError ? <Text style={styles.errorText}>{replyError}</Text> : null}
              <AppButton disabled={replying || !reply.trim()} loading={replying} onPress={submitReply} title="Gửi bổ sung" />
            </View>
          ) : null}
        </>
      ) : null}
    </PassengerLayout>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 10, borderRadius: 24, backgroundColor: colors.primaryContainer, padding: 18 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  reference: { flex: 1, color: '#a6f2d1', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: colors.white, fontSize: 22, lineHeight: 28, fontWeight: '900' },
  description: { color: '#d8f6e7', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  infoItem: { width: '47.5%', flexGrow: 1, borderRadius: 18, backgroundColor: colors.card, padding: 13 },
  infoLabel: { color: colors.secondary, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  infoValue: { marginTop: 5, color: colors.primary, fontSize: 13, fontWeight: '900' },
  card: { gap: 12, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  adminCard: { gap: 10, borderRadius: 22, backgroundColor: '#d8f6e7', padding: 16 },
  cardTitle: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  bodyText: { color: colors.secondary, fontSize: 13, lineHeight: 20, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  message: { gap: 7, borderRadius: 18, padding: 13 },
  adminMessage: { backgroundColor: '#d8f6e7' },
  passengerMessage: { backgroundColor: colors.surfaceLow },
  messageTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  messageSender: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  messageTime: { color: colors.secondary, fontSize: 10, fontWeight: '700' },
  messageBody: { color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  replyBox: { gap: 12, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  replyInput: { minHeight: 110, borderRadius: 18, backgroundColor: colors.surfaceLow, padding: 13, color: colors.text, fontSize: 13, fontWeight: '700' },
  errorCard: { gap: 10, borderRadius: 20, backgroundColor: colors.errorContainer, padding: 16 },
  errorText: { color: colors.error, fontSize: 12, fontWeight: '800' },
  retryButton: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: colors.white, paddingHorizontal: 13, paddingVertical: 8 },
  retryText: { color: colors.error, fontSize: 12, fontWeight: '900' },
});
