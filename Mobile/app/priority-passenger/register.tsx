import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PROFILE_TYPES } from '@/api/priorityProfile.api';
import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/colors';
import usePriorityProfileStore, { initialPriorityDraft } from '@/store/priorityProfile.store';
import type { PriorityProfileType, PriorityRegistrationDraft } from '@/types/priorityProfile';
import { validatePriorityRegistration } from '@/utils/validation';

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(2000, 0, 1);
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? new Date(2000, 0, 1) : date;
};

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const getCalendarDays = (monthDate: Date) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(year, month, index + 1)),
  ];
};

export default function RegisterPriorityProfileScreen() {
  const savedDraft = usePriorityProfileStore((state) => state.draft);
  const saveDraft = usePriorityProfileStore((state) => state.saveDraft);
  const [form, setForm] = useState<PriorityRegistrationDraft>(
    savedDraft.fullName ? savedDraft : initialPriorityDraft,
  );
  const [errors, setErrors] = useState<Partial<Record<keyof PriorityRegistrationDraft, string>>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => parseDateInput(savedDraft.dateOfBirth));
  const [selectedBirthDate, setSelectedBirthDate] = useState<Date | null>(() => (
    savedDraft.dateOfBirth ? parseDateInput(savedDraft.dateOfBirth) : null
  ));

  const canContinue = useMemo(() => Object.values(form).some((value) => value.trim().length > 0), [form]);
  const decadeStart = useMemo(() => Math.floor(calendarMonth.getFullYear() / 10) * 10, [calendarMonth]);
  const decadeYears = useMemo(() => Array.from({ length: 12 }, (_, index) => decadeStart + index), [decadeStart]);

  const update = <K extends keyof PriorityRegistrationDraft>(field: K, value: PriorityRegistrationDraft[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleContinue = () => {
    const validationErrors = validatePriorityRegistration(form);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      Alert.alert('Kiểm tra thông tin', Object.values(validationErrors)[0]);
      return;
    }

    saveDraft(form);
    router.push('/priority-passenger/upload-documents');
  };

  const openDatePicker = () => {
    const initialDate = form.dateOfBirth ? parseDateInput(form.dateOfBirth) : selectedBirthDate || new Date(2000, 0, 1);
    setSelectedBirthDate(form.dateOfBirth ? initialDate : selectedBirthDate);
    setCalendarMonth(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
    setShowDatePicker(true);
  };

  const selectDate = (date: Date) => {
    if (date > new Date()) {
      return;
    }

    setSelectedBirthDate(date);
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  const changeMonth = (offset: number) => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const changeYear = (offset: number) => {
    setCalendarMonth((current) => new Date(current.getFullYear() + offset, current.getMonth(), 1));
  };

  const selectMonth = (month: number) => {
    setCalendarMonth((current) => new Date(current.getFullYear(), month, 1));
  };

  const selectYear = (year: number) => {
    setCalendarMonth((current) => new Date(year, current.getMonth(), 1));
  };

  const applySelectedDate = () => {
    if (!selectedBirthDate) {
      return;
    }

    update('dateOfBirth', formatDateInput(selectedBirthDate));
    setShowDatePicker(false);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" hitSlop={10} onPress={() => router.back()}>
          <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
        </Pressable>
        <View>
          <Text style={styles.kicker}>STEP 1 OF 2</Text>
          <Text style={styles.headerTitle}>Đăng ký hồ sơ ưu tiên</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Thông tin hồ sơ ưu tiên</Text>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Nhóm ưu tiên</Text>
          <View style={styles.optionList}>
            {PROFILE_TYPES.map((type) => (
              <Pressable
                key={type.value}
                onPress={() => update('profileType', type.value as PriorityProfileType)}
                style={[styles.option, form.profileType === type.value && styles.optionActive]}
              >
                <Text style={[styles.optionText, form.profileType === type.value && styles.optionTextActive]}>{type.label}</Text>
                {form.profileType === type.value ? (
                  <MaterialCommunityIcons color={colors.white} name="check" size={18} />
                ) : null}
              </Pressable>
            ))}
          </View>
          {errors.profileType ? <Text style={styles.error}>{errors.profileType}</Text> : null}
        </View>

        <AppInput label="Họ và tên" value={form.fullName} error={errors.fullName} placeholder="Điền tên hành khách" onChangeText={(value) => update('fullName', value)} />
        <View style={styles.fieldGroup}>
          <AppInput label="Ngày sinh" value={form.dateOfBirth} error={errors.dateOfBirth} placeholder="YYYY-MM-DD" onChangeText={(value) => update('dateOfBirth', value)} />
          <Pressable
            accessibilityRole="button"
            onPress={openDatePicker}
            style={({ pressed }) => [styles.calendarButton, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons color={colors.primary} name="calendar-month-outline" size={20} />
            <Text style={styles.calendarButtonText}>Chọn ngày sinh</Text>
          </Pressable>
        </View>

        <AppInput label="Số CCCD/CMND" value={form.identityNumber} error={errors.identityNumber} placeholder="012345678901" onChangeText={(value) => update('identityNumber', value)} />
        <View style={styles.fieldGroup}>
          <AppInput label="Mã số trên giấy tờ ưu tiên" value={form.cardNumber} error={errors.cardNumber} placeholder="Mã thẻ sinh viên, số giấy xác nhận..." onChangeText={(value) => update('cardNumber', value)} />
          <Text style={styles.helperText}>Có thể bỏ trống nếu giấy tờ của bạn không có mã số riêng.</Text>
        </View>
        <View style={styles.fieldGroup}>
          <AppInput label="Nơi cấp giấy tờ ưu tiên" value={form.issuingAuthority} error={errors.issuingAuthority} placeholder="Trường học, bệnh viện, UBND..." onChangeText={(value) => update('issuingAuthority', value)} />
          <Text style={styles.helperText}>Nhập cơ quan/trường học/bệnh viện cấp hoặc xác nhận giấy tờ này.</Text>
        </View>
        <AppInput label="Lý do đăng ký ưu tiên" value={form.reason} error={errors.reason} multiline placeholder="Mô tả ngắn gọn quyền ưu tiên hoặc chính sách giảm giá cần áp dụng." onChangeText={(value) => update('reason', value)} style={styles.reasonArea} />
      </View>

      <View style={styles.actions}>
        <AppButton title="Quay lại" variant="secondary" onPress={() => router.back()} />
        <AppButton title="Tiếp tục" disabled={!canContinue} onPress={handleContinue} />
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
        transparent
        visible={showDatePicker}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModal}>
            <View style={styles.calendarHero}>
              <View>
                <Text style={styles.calendarKicker}>DATE OF BIRTH</Text>
                <Text style={styles.calendarHeroTitle}>
                  {selectedBirthDate ? formatDateInput(selectedBirthDate) : 'Select a date'}
                </Text>
              </View>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setShowDatePicker(false)} style={styles.closeCalendarButton}>
                <MaterialCommunityIcons color={colors.primary} name="close" size={22} />
              </Pressable>
            </View>

            <View style={styles.calendarHeader}>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => changeMonth(-1)}>
                <MaterialCommunityIcons color={colors.primary} name="chevron-left" size={26} />
              </Pressable>
              <Text style={styles.calendarTitle}>
                {monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
              </Text>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => changeMonth(1)}>
                <MaterialCommunityIcons color={colors.primary} name="chevron-right" size={26} />
              </Pressable>
            </View>

            <View style={styles.decadeHeader}>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => changeYear(-10)} style={styles.decadeButton}>
                <MaterialCommunityIcons color={colors.primary} name="chevron-double-left" size={20} />
              </Pressable>
              <Text style={styles.decadeTitle}>{decadeStart} - {decadeStart + 11}</Text>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => changeYear(10)} style={styles.decadeButton}>
                <MaterialCommunityIcons color={colors.primary} name="chevron-double-right" size={20} />
              </Pressable>
            </View>

            <View style={styles.yearGrid}>
              {decadeYears.map((year) => {
                const active = year === calendarMonth.getFullYear();
                const disabled = year > new Date().getFullYear();

                return (
                  <Pressable
                    key={year}
                    accessibilityRole="button"
                    disabled={disabled}
                    onPress={() => selectYear(year)}
                    style={({ pressed }) => [
                      styles.yearCell,
                      active && styles.yearCellActive,
                      pressed && styles.pressed,
                      disabled && styles.disabledOption,
                    ]}
                  >
                    <Text style={[
                      styles.yearCellText,
                      active && styles.yearCellTextActive,
                      disabled && styles.disabledOptionText,
                    ]}
                    >
                      {year}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.monthGrid}>
              {monthNames.map((month, index) => {
                const active = index === calendarMonth.getMonth();
                const disabled = new Date(calendarMonth.getFullYear(), index, 1) > new Date();

                return (
                  <Pressable
                    key={month}
                    accessibilityRole="button"
                    disabled={disabled}
                    onPress={() => selectMonth(index)}
                    style={({ pressed }) => [
                      styles.monthChip,
                      active && styles.monthChipActive,
                      pressed && styles.pressed,
                      disabled && styles.disabledOption,
                    ]}
                  >
                    <Text style={[
                      styles.monthChipText,
                      active && styles.monthChipTextActive,
                      disabled && styles.disabledOptionText,
                    ]}
                    >
                      {month.slice(0, 3)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.weekRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <Text key={`${day}-${index}`} style={styles.weekDay}>{day}</Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {getCalendarDays(calendarMonth).map((date, index) => {
                const selected = date && selectedBirthDate ? formatDateInput(date) === formatDateInput(selectedBirthDate) : false;
                const disabled = date ? date > new Date() : true;

                return (
                  <Pressable
                    key={date ? date.toISOString() : `empty-${index}`}
                    accessibilityRole="button"
                    disabled={!date || disabled}
                    onPress={() => date && selectDate(date)}
                    style={[
                      styles.dayCell,
                      selected && styles.dayCellSelected,
                      disabled && styles.dayCellDisabled,
                    ]}
                  >
                    <Text style={[
                      styles.dayText,
                      selected && styles.dayTextSelected,
                      disabled && styles.dayTextDisabled,
                    ]}
                    >
                      {date?.getDate() || ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.calendarActions}>
              <AppButton title="Cancel" variant="secondary" onPress={() => setShowDatePicker(false)} />
              <AppButton title="Apply date" disabled={!selectedBirthDate} onPress={applySelectedDate} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  kicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  headerTitle: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  card: { gap: 16, marginBottom: 16, padding: 18, borderRadius: 22, backgroundColor: colors.card },
  sectionTitle: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  fieldGroup: { gap: 8 },
  label: { color: colors.secondary, fontSize: 14, fontWeight: '700' },
  helperText: { color: colors.muted, fontSize: 12, fontWeight: '600', lineHeight: 18 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 42, justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.card, paddingHorizontal: 14 },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  chipTextActive: { color: colors.white },
  calendarButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surfaceLow },
  calendarButtonText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  optionList: { gap: 8 },
  option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surfaceLow, paddingHorizontal: 14 },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  optionText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  optionTextActive: { color: colors.white },
  textArea: { minHeight: 88, paddingTop: 14, textAlignVertical: 'top' },
  reasonArea: { minHeight: 112, paddingTop: 14, textAlignVertical: 'top' },
  error: { color: colors.error, fontSize: 13 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)', padding: 20 },
  calendarModal: { gap: 14, borderRadius: 24, backgroundColor: colors.card, padding: 18 },
  calendarHero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 18, backgroundColor: colors.surfaceLow, padding: 14 },
  calendarKicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  calendarHeroTitle: { marginTop: 4, color: colors.primary, fontSize: 20, fontWeight: '900' },
  closeCalendarButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: colors.card },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarTitle: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  decadeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  decadeButton: { width: 42, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.surfaceLow },
  decadeTitle: { flex: 1, textAlign: 'center', color: colors.secondary, fontSize: 13, fontWeight: '900' },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  yearCell: { width: '23.5%', minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.surfaceLow },
  yearCellActive: { backgroundColor: colors.primary },
  yearCellText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  yearCellTextActive: { color: colors.white },
  disabledOption: { opacity: 0.35 },
  disabledOptionText: { color: colors.muted },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  monthChip: { width: '23.5%', minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.card },
  monthChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  monthChipText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  monthChipTextActive: { color: colors.white },
  weekRow: { flexDirection: 'row' },
  weekDay: { flex: 1, textAlign: 'center', color: colors.muted, fontSize: 12, fontWeight: '900' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  dayCellSelected: { backgroundColor: colors.primary },
  dayCellDisabled: { opacity: 0.35 },
  dayText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  dayTextSelected: { color: colors.white },
  dayTextDisabled: { color: colors.muted },
  calendarActions: { gap: 10, marginTop: 4 },
  actions: { gap: 12, paddingBottom: 20 },
});
