import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import passengerApi, { type FeedbackCategory, type TravelHistoryRecord } from '@/api/passenger.api';
import { AppButton } from '@/components/AppButton';
import { EmptyState, LoadingState, PassengerLayout } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';
import { feedbackCategories } from '@/utils/feedbackDisplay';

type FormErrors = Partial<Record<'category' | 'title' | 'description' | 'ratingScore' | 'relatedTripId', string>>;

const formatTripLabel = (record: TravelHistoryRecord) => {
  const date = record.travelDate || record.boardingTime
    ? new Date(record.travelDate || record.boardingTime || '').toLocaleDateString('vi-VN')
    : 'Chưa có ngày';
  return `${record.routeNumber || 'Tuyến'} - ${record.boardingStop || 'Điểm lên'} đến ${record.destinationStop || 'Điểm xuống'} (${date})`;
};

export default function SubmitFeedbackScreen() {
  const params = useLocalSearchParams<{ relatedTripId?: string; tripCode?: string; routeName?: string }>();
  const [category, setCategory] = useState<FeedbackCategory>('SERVICE_QUALITY');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ratingScore, setRatingScore] = useState(0);
  const [relatedTripId, setRelatedTripId] = useState(params.relatedTripId || '');
  const [travelRecords, setTravelRecords] = useState<TravelHistoryRecord[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const loadTrips = async () => {
      setIsLoadingTrips(true);
      try {
        const data = await passengerApi.getTravelHistory();
        setTravelRecords(data.records || []);
      } catch {
        setTravelRecords([]);
      } finally {
        setIsLoadingTrips(false);
      }
    };
    void loadTrips();
  }, []);

  const selectedTrip = useMemo(() => travelRecords.find((record) => (
    record.tripId === relatedTripId || record.ticketId === relatedTripId
  )), [relatedTripId, travelRecords]);

  const validate = () => {
    const nextErrors: FormErrors = {};
    if (!feedbackCategories.some((item) => item.value === category)) {
      nextErrors.category = 'Vui lòng chọn danh mục hợp lệ.';
    }
    if (!title.trim()) {
      nextErrors.title = 'Vui lòng nhập tiêu đề.';
    }
    if (!description.trim()) {
      nextErrors.description = 'Vui lòng nhập nội dung.';
    } else if (description.trim().length < 20) {
      nextErrors.description = 'Nội dung cần ít nhất 20 ký tự.';
    }
    if (!ratingScore) {
      nextErrors.ratingScore = 'Vui lòng chọn điểm đánh giá.';
    }
    if (isLoadingTrips) {
      nextErrors.relatedTripId = 'Đang tải lịch sử chuyến, vui lòng chờ.';
    } else if (!relatedTripId || !selectedTrip) {
      nextErrors.relatedTripId = 'Feedback dịch vụ bắt buộc chọn một chuyến đã đi.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (isSubmitting || !validate()) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const feedback = await passengerApi.submitFeedback({
        category,
        title: title.trim(),
        description: description.trim(),
        ratingScore,
        relatedTripId,
        tripCode: selectedTrip?.tripId || selectedTrip?.ticketId || params.tripCode || relatedTripId,
        routeName: selectedTrip
          ? `${selectedTrip.routeNumber || ''} - ${selectedTrip.routeName || ''}`.trim()
          : params.routeName || '',
      });
      Alert.alert('Đã gửi góp ý', `Mã tham chiếu: ${feedback.referenceNumber || feedback.id}`, [
        { text: 'Xem chi tiết', onPress: () => router.replace({ pathname: '/feedback/[feedbackId]', params: { feedbackId: feedback.id || feedback.referenceNumber || '' } } as unknown as Href) },
        { text: 'Danh sách', onPress: () => router.replace('/my-feedback' as Href) },
      ]);
      setTitle('');
      setDescription('');
      setRatingScore(0);
    } catch (error) {
      const message = (error as { message?: string; errors?: Record<string, string> })?.errors
        ? Object.values((error as { errors: Record<string, string> }).errors).join(' ')
        : (error as { message?: string })?.message || 'Không thể gửi góp ý. Vui lòng thử lại.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PassengerLayout active="profile" subtitle="Chăm sóc khách hàng" title="Gửi góp ý">
      {submitError ? <InlineError message={submitError} /> : null}
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>Passenger Feedback</Text>
        <Text style={styles.heroTitle}>Gửi góp ý dịch vụ</Text>
        <Text style={styles.heroText}>Chọn chuyến đã đi và mô tả trải nghiệm để BusDN xử lý đúng ngữ cảnh.</Text>
      </View>

      <Text style={styles.label}>Danh mục</Text>
      <View style={styles.chips}>
        {feedbackCategories.map((item) => {
          const active = item.value === category;
          return (
            <Pressable key={item.value} onPress={() => setCategory(item.value)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {errors.category ? <FieldError message={errors.category} /> : null}

      <Field label="Tiêu đề" value={title} onChangeText={setTitle} placeholder="Nhập tiêu đề ngắn" error={errors.title} />
      <Field
        label="Nội dung"
        value={description}
        onChangeText={setDescription}
        placeholder="Mô tả trải nghiệm, điểm tốt hoặc điều cần cải thiện..."
        multiline
        error={errors.description}
      />

      <Text style={styles.label}>Chuyến liên quan</Text>
      {isLoadingTrips ? <LoadingState label="Đang tải lịch sử chuyến" /> : null}
      {!isLoadingTrips && !travelRecords.length ? (
        <EmptyState title="Chưa có chuyến phù hợp" detail="Bạn cần có lịch sử chuyến đi trước khi gửi feedback dịch vụ." />
      ) : null}
      {!isLoadingTrips && travelRecords.map((record) => {
        const value = record.tripId || record.ticketId || record.id;
        const active = value === relatedTripId;
        return (
          <Pressable key={record.id} onPress={() => setRelatedTripId(value || '')} style={[styles.tripCard, active && styles.tripCardActive]}>
            <Text style={styles.tripTitle}>{formatTripLabel(record)}</Text>
            <Text style={styles.tripMeta}>{record.ticketId || record.tripId || 'Không có mã vé'}</Text>
          </Pressable>
        );
      })}
      {errors.relatedTripId ? <FieldError message={errors.relatedTripId} /> : null}

      <Text style={styles.label}>Đánh giá dịch vụ</Text>
      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((score) => (
          <Pressable key={score} onPress={() => setRatingScore(score)} style={[styles.ratingButton, ratingScore === score && styles.ratingButtonActive]}>
            <MaterialCommunityIcons color={ratingScore >= score ? '#006c49' : colors.outline} name={ratingScore >= score ? 'star' : 'star-outline'} size={24} />
            <Text style={styles.ratingText}>{score}</Text>
          </Pressable>
        ))}
      </View>
      {errors.ratingScore ? <FieldError message={errors.ratingScore} /> : null}

      <View style={styles.rules}>
        <Text style={styles.rulesTitle}>Quy định gửi góp ý</Text>
        <Text style={styles.rulesText}>Feedback dịch vụ phải gắn với một chuyến thật trong lịch sử của bạn. BusDN không nhận metadata admin từ ứng dụng hành khách.</Text>
      </View>

      <AppButton disabled={isSubmitting || isLoadingTrips} loading={isSubmitting} onPress={submit} title="Gửi góp ý" />
    </PassengerLayout>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline, error }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  error?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.secondary}
        style={[styles.input, multiline && styles.textArea, error && styles.inputError]}
        textAlignVertical={multiline ? 'top' : 'center'}
        value={value}
      />
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}

function FieldError({ message }: { message: string }) {
  return <Text style={styles.errorText}>{message}</Text>;
}

function InlineError({ message }: { message: string }) {
  return (
    <View style={styles.inlineError}>
      <MaterialCommunityIcons color={colors.error} name="alert-circle-outline" size={20} />
      <Text style={styles.inlineErrorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 8, borderRadius: 24, backgroundColor: colors.primaryContainer, padding: 18 },
  heroKicker: { color: '#a6f2d1', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  heroTitle: { color: colors.white, fontSize: 24, fontWeight: '900' },
  heroText: { color: '#d8f6e7', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  field: { gap: 8 },
  label: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  input: { minHeight: 52, borderWidth: 1, borderColor: 'transparent', borderRadius: 18, backgroundColor: colors.card, paddingHorizontal: 14, color: colors.text, fontSize: 14, fontWeight: '800' },
  inputError: { borderColor: colors.error },
  textArea: { minHeight: 132, paddingTop: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, backgroundColor: colors.card, paddingHorizontal: 13, paddingVertical: 9 },
  chipActive: { backgroundColor: colors.primaryContainer },
  chipText: { color: colors.secondary, fontSize: 12, fontWeight: '900' },
  chipTextActive: { color: colors.white },
  tripCard: { gap: 5, borderWidth: 1, borderColor: 'transparent', borderRadius: 18, backgroundColor: colors.card, padding: 14 },
  tripCardActive: { borderColor: '#006c49', backgroundColor: '#d8f6e7' },
  tripTitle: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  tripMeta: { color: colors.secondary, fontSize: 11, fontWeight: '700' },
  ratingRow: { flexDirection: 'row', gap: 8 },
  ratingButton: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.card },
  ratingButtonActive: { backgroundColor: '#d8f6e7' },
  ratingText: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  rules: { gap: 8, borderRadius: 22, backgroundColor: '#d8f6e7', padding: 16 },
  rulesTitle: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  rulesText: { color: colors.secondary, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  errorText: { color: colors.error, fontSize: 12, fontWeight: '800' },
  inlineError: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 18, backgroundColor: colors.errorContainer, padding: 13 },
  inlineErrorText: { flex: 1, color: colors.error, fontSize: 12, fontWeight: '800' },
});
