import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, type Href, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import passengerApi, { type LostItemAttachmentAsset, type LostItemCategory, type TravelHistoryRecord } from '@/api/passenger.api';
import { AppButton } from '@/components/AppButton';
import { EmptyState, LoadingState, PassengerLayout } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';
import { lostItemCategories } from '@/utils/lostItemDisplay';

type FormErrors = Partial<Record<'itemName' | 'itemCategory' | 'itemDescription' | 'lostAt' | 'lastSeenLocation' | 'contact' | 'attachments', string>>;

const tripValueOf = (record: TravelHistoryRecord) => record.tripId || record.ticketId || record.id || '';

const formatTripLabel = (record: TravelHistoryRecord) => {
  const date = record.travelDate || record.boardingTime
    ? new Date(record.travelDate || record.boardingTime || '').toLocaleDateString('vi-VN')
    : 'Chưa có ngày';
  return `${record.routeNumber || 'Tuyến'} - ${record.boardingStop || 'Điểm lên'} đến ${record.destinationStop || 'Điểm xuống'} (${date})`;
};

const toDateTimeValue = (date = new Date()) => {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

export default function ReportLostItemScreen() {
  const params = useLocalSearchParams<{ relatedTripId?: string; tripCode?: string; routeName?: string }>();
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState<LostItemCategory>('PERSONAL_BELONGINGS');
  const [itemDescription, setItemDescription] = useState('');
  const [relatedTripId, setRelatedTripId] = useState(params.relatedTripId || '');
  const [routeName, setRouteName] = useState(params.routeName || '');
  const [lostAt, setLostAt] = useState(toDateTimeValue());
  const [lastSeenLocation, setLastSeenLocation] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [attachments, setAttachments] = useState<LostItemAttachmentAsset[]>([]);
  const [travelRecords, setTravelRecords] = useState<TravelHistoryRecord[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tripDropdownOpen, setTripDropdownOpen] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
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

  const tripOptions = useMemo(() => {
    const seen = new Set<string>();
    return travelRecords.filter((record) => {
      const value = tripValueOf(record);
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }, [travelRecords]);
  const selectedTrip = useMemo(() => tripOptions.find((record) => tripValueOf(record) === relatedTripId), [relatedTripId, tripOptions]);

  const selectTrip = (record: TravelHistoryRecord) => {
    const value = tripValueOf(record);
    setRelatedTripId(value);
    setRouteName(`${record.routeNumber || ''} - ${record.routeName || ''}`.trim());
    setLastSeenLocation((current) => current || `${record.boardingStop || 'Điểm lên'} đến ${record.destinationStop || 'Điểm xuống'}`);
    setTripDropdownOpen(false);
  };

  const pickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Chưa có quyền truy cập ảnh', 'Vui lòng cấp quyền để chọn hình ảnh mô tả đồ thất lạc.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82,
      selectionLimit: Math.max(1, 5 - attachments.length),
    });

    if (result.canceled) return;
    const nextAssets = result.assets.map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName || `lost-item-${Date.now()}-${index + 1}.jpg`,
      fileName: asset.fileName || `lost-item-${Date.now()}-${index + 1}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
    }));
    setAttachments((current) => [...current, ...nextAssets].slice(0, 5));
    setErrors((current) => ({ ...current, attachments: '' }));
  };

  const removeImage = (uri: string) => {
    setAttachments((current) => current.filter((asset) => asset.uri !== uri));
  };

  const validate = () => {
    const nextErrors: FormErrors = {};
    if (!itemName.trim()) nextErrors.itemName = 'Vui lòng nhập tên đồ thất lạc.';
    if (!lostItemCategories.some((category) => category.value === itemCategory)) nextErrors.itemCategory = 'Vui lòng chọn danh mục hợp lệ.';
    if (!itemDescription.trim() || itemDescription.trim().length < 10) nextErrors.itemDescription = 'Mô tả cần ít nhất 10 ký tự.';
    if (!lastSeenLocation.trim()) nextErrors.lastSeenLocation = 'Vui lòng nhập vị trí hoặc trạm phát hiện bị mất đồ.';
    if (!lostAt || Number.isNaN(new Date(lostAt).getTime())) nextErrors.lostAt = 'Vui lòng nhập thời gian hợp lệ.';
    else if (new Date(lostAt).getTime() > Date.now()) nextErrors.lostAt = 'Thời gian bị mất không được ở tương lai.';
    if (!contactPhone.trim() && !contactEmail.trim()) nextErrors.contact = 'Vui lòng nhập số điện thoại hoặc email liên hệ.';
    if (attachments.length > 5) nextErrors.attachments = 'Chỉ được chọn tối đa 5 hình ảnh.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (isSubmitting || !validate()) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const supportCase = await passengerApi.submitLostItem({
        itemName,
        itemCategory,
        itemDescription,
        lastSeenLocation,
        lostAt,
        contactPhone,
        contactEmail,
        relatedTripId,
        tripCode: selectedTrip?.tripId || selectedTrip?.ticketId || params.tripCode || relatedTripId,
        routeName,
        attachments,
      });
      Alert.alert('Đã gửi báo mất đồ', `Mã hồ sơ: ${supportCase.caseId || supportCase.referenceNumber || supportCase.id}`, [
        { text: 'Xem hồ sơ', onPress: () => router.replace({ pathname: '/lost-items/[caseId]', params: { caseId: supportCase.caseId || supportCase.referenceNumber || supportCase.id } } as unknown as Href) },
        { text: 'Danh sách', onPress: () => router.replace('/my-lost-items' as Href) },
      ]);
      setItemName('');
      setItemDescription('');
      setRelatedTripId('');
      setRouteName('');
      setLastSeenLocation('');
      setAttachments([]);
    } catch (error) {
      const message = (error as { message?: string; errors?: Record<string, string> })?.errors
        ? Object.values((error as { errors: Record<string, string> }).errors).join(' ')
        : (error as { message?: string })?.message || 'Không thể gửi báo mất đồ. Vui lòng thử lại.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PassengerLayout active="profile" subtitle="Chăm sóc khách hàng" title="Báo mất đồ">
      {submitError ? <InlineError message={submitError} /> : null}

      <Field label="Tên đồ thất lạc" value={itemName} onChangeText={setItemName} placeholder="Ví, điện thoại, balo..." error={errors.itemName} />

      <Text style={styles.label}>Danh mục đồ thất lạc</Text>
      <View style={styles.categoryGrid}>
        {lostItemCategories.map((category) => {
          const active = category.value === itemCategory;
          return (
            <Pressable key={category.value} onPress={() => setItemCategory(category.value)} style={[styles.categoryChip, active && styles.categoryChipActive]}>
              <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{category.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {errors.itemCategory ? <FieldError message={errors.itemCategory} /> : null}

      <Field
        error={errors.itemDescription}
        label="Mô tả đồ thất lạc"
        multiline
        onChangeText={setItemDescription}
        placeholder="Màu sắc, thương hiệu, kích thước, dấu hiệu nhận biết..."
        value={itemDescription}
      />

      <Text style={styles.label}>Chuyến đi liên quan</Text>
      <Text style={styles.helper}>Chọn chuyến đi mà bạn có thể đã làm mất đồ</Text>
      {isLoadingTrips ? <LoadingState label="Đang tải lịch sử chuyến" /> : null}
      {!isLoadingTrips && !tripOptions.length ? <EmptyState title="Chưa có chuyến phù hợp" detail="Bạn vẫn có thể nhập tuyến và vị trí bên dưới." /> : null}
      {!isLoadingTrips && tripOptions.length ? (
        <TripDropdown
          onSelect={selectTrip}
          open={tripDropdownOpen}
          records={tripOptions}
          selectedRecord={selectedTrip}
          selectedValue={relatedTripId}
          onToggle={() => setTripDropdownOpen((current) => !current)}
        />
      ) : null}

      <Field label="Thông tin tuyến" value={routeName} onChangeText={setRouteName} placeholder="DN01 - Da Nang Central đến My Khe Beach" />
      <Field label="Thời gian dự kiến bị mất" value={lostAt} onChangeText={setLostAt} placeholder="YYYY-MM-DDTHH:mm" error={errors.lostAt} />
      <Field label="Địa điểm hoặc trạm phát hiện bị mất" value={lastSeenLocation} onChangeText={setLastSeenLocation} placeholder="Trên xe, trạm, khu vực ghế ngồi..." error={errors.lastSeenLocation} />

      <View style={styles.twoColumn}>
        <Field label="Số điện thoại liên hệ" value={contactPhone} onChangeText={setContactPhone} placeholder="Số điện thoại" />
        <Field label="Email liên hệ" value={contactEmail} onChangeText={setContactEmail} placeholder="Email" />
      </View>
      {errors.contact ? <FieldError message={errors.contact} /> : null}

      <Text style={styles.label}>Hình ảnh mô tả</Text>
      <Pressable disabled={attachments.length >= 5} onPress={pickImages} style={[styles.uploadBox, attachments.length >= 5 && styles.disabled]}>
        <MaterialCommunityIcons color={colors.secondary} name="image-plus" size={28} />
        <Text style={styles.uploadTitle}>{attachments.length ? `${attachments.length}/5 hình đã chọn` : 'Chọn hình ảnh'}</Text>
        <Text style={styles.uploadText}>Hỗ trợ JPG, PNG, WEBP. Tối đa 5 hình.</Text>
      </Pressable>
      {errors.attachments ? <FieldError message={errors.attachments} /> : null}
      {attachments.length ? (
        <ScrollView contentContainerStyle={styles.imageStrip} horizontal showsHorizontalScrollIndicator={false}>
          {attachments.map((asset) => (
            <View key={asset.uri} style={styles.imageThumb}>
              <Image source={{ uri: asset.uri }} style={styles.image} />
              <Pressable onPress={() => removeImage(asset.uri)} style={styles.removeImage}>
                <MaterialCommunityIcons color={colors.white} name="close" size={15} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.rules}>
        <Text style={styles.rulesTitle}>Lưu ý</Text>
        <Text style={styles.rulesText}>Cung cấp càng nhiều chi tiết càng tốt để nhân viên dễ xác minh. BusDN sẽ cập nhật trạng thái trong mục Hồ sơ của tôi.</Text>
      </View>

      <AppButton disabled={isSubmitting} loading={isSubmitting} onPress={submit} title="Gửi báo mất đồ" />
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
      <Pressable accessibilityRole="button" onPress={onToggle} style={[styles.dropdownField, open && styles.dropdownFieldOpen]}>
        <Text numberOfLines={2} style={[styles.dropdownTitle, !selectedRecord && styles.dropdownPlaceholder]}>
          {selectedRecord ? formatTripLabel(selectedRecord) : 'Chọn chuyến đi liên quan'}
        </Text>
        <MaterialCommunityIcons color={colors.primary} name={open ? 'chevron-up' : 'chevron-down'} size={22} />
      </Pressable>
      {open ? (
        <View style={styles.dropdownMenu}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={records.length > 5} style={styles.dropdownScroll}>
            {records.map((record) => {
              const value = tripValueOf(record);
              const active = value === selectedValue;
              return (
                <Pressable key={value} onPress={() => onSelect(record)} style={[styles.dropdownOption, active && styles.dropdownOptionActive]}>
                  <Text numberOfLines={2} style={[styles.dropdownOptionTitle, active && styles.dropdownOptionTitleActive]}>{formatTripLabel(record)}</Text>
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

function Field({ label, value, onChangeText, placeholder, multiline, error }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean; error?: string }) {
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
  field: { gap: 8 },
  label: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  helper: { marginTop: -8, color: colors.secondary, fontSize: 12, fontWeight: '700' },
  input: { minHeight: 52, borderWidth: 1, borderColor: 'transparent', borderRadius: 18, backgroundColor: colors.card, paddingHorizontal: 14, color: colors.text, fontSize: 14, fontWeight: '800' },
  inputError: { borderColor: colors.error },
  textArea: { minHeight: 132, paddingTop: 14 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { borderRadius: 999, backgroundColor: colors.card, paddingHorizontal: 13, paddingVertical: 9 },
  categoryChipActive: { backgroundColor: colors.primaryContainer },
  categoryText: { color: colors.secondary, fontSize: 12, fontWeight: '900' },
  categoryTextActive: { color: colors.white },
  dropdownWrap: { gap: 8 },
  dropdownField: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'transparent', borderRadius: 18, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 10 },
  dropdownFieldOpen: { borderColor: '#006c49' },
  dropdownTitle: { flex: 1, color: colors.primary, fontSize: 13, lineHeight: 18, fontWeight: '900' },
  dropdownPlaceholder: { color: colors.secondary },
  dropdownMenu: { overflow: 'hidden', borderWidth: 1, borderColor: '#d5e4dd', borderRadius: 18, backgroundColor: colors.card },
  dropdownScroll: { maxHeight: 360 },
  dropdownOption: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d5e4dd', paddingHorizontal: 14, paddingVertical: 11 },
  dropdownOptionActive: { backgroundColor: colors.primaryContainer },
  dropdownOptionTitle: { flex: 1, color: colors.primary, fontSize: 13, lineHeight: 18, fontWeight: '900' },
  dropdownOptionTitleActive: { color: colors.white },
  twoColumn: { gap: 14 },
  uploadBox: { minHeight: 126, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.outline, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  uploadTitle: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  uploadText: { color: colors.secondary, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  imageStrip: { gap: 10 },
  imageThumb: { width: 92, height: 92, overflow: 'hidden', borderRadius: 18, backgroundColor: colors.surfaceHigh },
  image: { width: '100%', height: '100%' },
  removeImage: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(0,26,15,0.72)' },
  disabled: { opacity: 0.55 },
  rules: { gap: 8, borderRadius: 22, backgroundColor: '#d8f6e7', padding: 16 },
  rulesTitle: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  rulesText: { color: colors.secondary, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  errorText: { color: colors.error, fontSize: 12, fontWeight: '800' },
  inlineError: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 18, backgroundColor: colors.errorContainer, padding: 13 },
  inlineErrorText: { flex: 1, color: colors.error, fontSize: 12, fontWeight: '800' },
});
