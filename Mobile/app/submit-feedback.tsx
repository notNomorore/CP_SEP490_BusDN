import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import passengerApi, { type FeedbackCategory, type TravelHistoryRecord } from '@/api/passenger.api';
import { AppButton } from '@/components/AppButton';
import { EmptyState, LoadingState, PassengerLayout } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';
import { feedbackCategories } from '@/utils/feedbackDisplay';

type FormErrors = Partial<Record<'category' | 'title' | 'description' | 'ratingScore' | 'relatedTripId', string>>;

const feedbackTripWindowDays = 7;
const feedbackTripWindowMs = feedbackTripWindowDays * 24 * 60 * 60 * 1000;
const tripValueOf = (record: TravelHistoryRecord) => record.tripId || record.ticketId || record.id || '';
const countCharacters = (value: string) => value.trim().length;
const tripTimeOf = (record: TravelHistoryRecord) => {
  const rawValue = record.arrivalTime || record.boardingTime || record.travelDate;
  const date = rawValue ? new Date(rawValue) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const formatTripLabel = (record: TravelHistoryRecord) => {
  const date = record.travelDate || record.boardingTime
    ? new Date(record.travelDate || record.boardingTime || '').toLocaleDateString('vi-VN')
    : 'Chưa có ngày';
  return `${record.routeNumber || 'Tuyến'} - ${record.boardingStop || 'Điểm lên'} đến ${record.destinationStop || 'Điểm xuống'} (${date})`;
};

const isFeedbackEligibleTrip = (record: TravelHistoryRecord) => {
  const routeNumber = record.routeNumber?.trim().toUpperCase();
  if (routeNumber === 'DN10') return false;
  if (formatTripLabel(record).trim().toUpperCase().startsWith('DN10 ')) return false;
  const tripTime = tripTimeOf(record);
  if (!tripTime) return false;
  const elapsedMs = Date.now() - tripTime.getTime();
  return elapsedMs >= 0 && elapsedMs <= feedbackTripWindowMs;
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
  const [tripDropdownOpen, setTripDropdownOpen] = useState(false);

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

  const tripOptions = useMemo(() => {
    const seen = new Set<string>();
    return travelRecords.filter((record) => {
      if (!isFeedbackEligibleTrip(record)) return false;
      const value = tripValueOf(record);
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }, [travelRecords]);
  const selectedTrip = useMemo(() => tripOptions.find((record) => tripValueOf(record) === relatedTripId), [relatedTripId, tripOptions]);

  useEffect(() => {
    if (isLoadingTrips || !relatedTripId) return;
    if (!selectedTrip) {
      setRelatedTripId('');
    }
  }, [isLoadingTrips, relatedTripId, selectedTrip]);

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
    } else if (countCharacters(description) < 10) {
      nextErrors.description = 'Nội dung cần ít nhất 10 chữ.';
    }
    if (!ratingScore) {
      nextErrors.ratingScore = 'Vui lòng chọn điểm đánh giá.';
    }
    if (isLoadingTrips) {
      nextErrors.relatedTripId = 'Đang tải lịch sử chuyến, vui lòng chờ.';
    } else if (!relatedTripId || !selectedTrip) {
      nextErrors.relatedTripId = `Feedback dịch vụ chỉ được gửi trong vòng ${feedbackTripWindowDays} ngày từ thời gian đi xe.`;
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
      {!isLoadingTrips && !tripOptions.length ? (
        <EmptyState title="Chưa có chuyến phù hợp" detail={`Bạn chỉ có thể gửi góp ý cho chuyến đã đi trong vòng ${feedbackTripWindowDays} ngày gần nhất.`} />
      ) : null}
      {!isLoadingTrips && tripOptions.length ? (
        <TripDropdown
          onSelect={(record) => {
            setRelatedTripId(tripValueOf(record));
            setTripDropdownOpen(false);
          }}
          open={tripDropdownOpen}
          records={tripOptions}
          selectedRecord={selectedTrip}
          selectedValue={relatedTripId}
          onToggle={() => setTripDropdownOpen((current) => !current)}
        />
      ) : null}
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
        <Text style={styles.rulesText}>Feedback dịch vụ phải gắn với một chuyến thật trong lịch sử của bạn và chỉ được gửi trong vòng {feedbackTripWindowDays} ngày từ thời gian đi xe.</Text>
      </View>

      <AppButton disabled={isSubmitting || isLoadingTrips} loading={isSubmitting} onPress={submit} title="Gửi góp ý" />
    </PassengerLayout>
  );
}

function TripDropdown({
  onSelect,
  onToggle,
  open,
  records,
  selectedRecord,
  selectedValue,
}: {
  onSelect: (record: TravelHistoryRecord) => void;
  onToggle: () => void;
  open: boolean;
  records: TravelHistoryRecord[];
  selectedRecord?: TravelHistoryRecord;
  selectedValue: string;
}) {
  return (
    <View style={styles.dropdownWrap}>
      <Pressable
        accessibilityLabel="Chọn một chuyến hoặc tuyến liên quan"
        accessibilityRole="button"
        onPress={onToggle}
        style={[styles.dropdownField, open && styles.dropdownFieldOpen]}
      >
        <View style={styles.dropdownValue}>
          <Text numberOfLines={2} style={[styles.dropdownTitle, !selectedRecord && styles.dropdownPlaceholder]}>
            {selectedRecord ? formatTripLabel(selectedRecord) : 'Chọn một chuyến/tuyến liên quan'}
          </Text>
        </View>
        <MaterialCommunityIcons color={colors.primary} name={open ? 'chevron-up' : 'chevron-down'} size={22} />
      </Pressable>

      {open ? (
        <View style={styles.dropdownMenu}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={records.length > 5}
            style={styles.dropdownScroll}
          >
            {records.map((record) => {
              const value = tripValueOf(record);
              const active = value === selectedValue;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={value}
                  onPress={() => onSelect(record)}
                  style={[styles.dropdownOption, active && styles.dropdownOptionActive]}
                >
                  <View style={styles.dropdownOptionCopy}>
                    <Text numberOfLines={2} style={[styles.dropdownOptionTitle, active && styles.dropdownOptionTitleActive]}>
                      {formatTripLabel(record)}
                    </Text>
                  </View>
                  {active ? <MaterialCommunityIcons color={colors.white} name="check-circle" size={20} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
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
  dropdownWrap: { gap: 8 },
  dropdownField: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'transparent', borderRadius: 18, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 10 },
  dropdownFieldOpen: { borderColor: '#006c49' },
  dropdownValue: { flex: 1 },
  dropdownTitle: { color: colors.primary, fontSize: 13, lineHeight: 18, fontWeight: '900' },
  dropdownPlaceholder: { color: colors.secondary },
  dropdownMenu: { overflow: 'hidden', borderWidth: 1, borderColor: '#d5e4dd', borderRadius: 18, backgroundColor: colors.card },
  dropdownScroll: { maxHeight: 360 },
  dropdownOption: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d5e4dd', paddingHorizontal: 14, paddingVertical: 11 },
  dropdownOptionActive: { backgroundColor: colors.primaryContainer },
  dropdownOptionCopy: { flex: 1 },
  dropdownOptionTitle: { color: colors.primary, fontSize: 13, lineHeight: 18, fontWeight: '900' },
  dropdownOptionTitleActive: { color: colors.white },
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
