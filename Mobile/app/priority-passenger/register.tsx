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

const genders = ['Female', 'Male', 'Other'] as const;

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

  const canContinue = useMemo(() => Object.values(form).some((value) => value.trim().length > 0), [form]);

  const update = <K extends keyof PriorityRegistrationDraft>(field: K, value: PriorityRegistrationDraft[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleContinue = () => {
    const validationErrors = validatePriorityRegistration(form);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      Alert.alert('Check your information', Object.values(validationErrors)[0]);
      return;
    }

    saveDraft(form);
    router.push('/priority-passenger/upload-documents');
  };

  const selectDate = (date: Date) => {
    if (date > new Date()) {
      return;
    }

    update('dateOfBirth', formatDateInput(date));
    setCalendarMonth(date);
    setShowDatePicker(false);
  };

  const changeMonth = (offset: number) => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" hitSlop={10} onPress={() => router.back()}>
          <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
        </Pressable>
        <View>
          <Text style={styles.kicker}>STEP 1 OF 2</Text>
          <Text style={styles.headerTitle}>Passenger Information</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Personal Details</Text>
        <AppInput label="Full Name" value={form.fullName} error={errors.fullName} onChangeText={(value) => update('fullName', value)} />
        <View style={styles.fieldGroup}>
          <AppInput label="Date of Birth" value={form.dateOfBirth} error={errors.dateOfBirth} placeholder="YYYY-MM-DD" onChangeText={(value) => update('dateOfBirth', value)} />
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowDatePicker(true)}
            style={({ pressed }) => [styles.calendarButton, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons color={colors.primary} name="calendar-month-outline" size={20} />
            <Text style={styles.calendarButtonText}>Choose from calendar</Text>
          </Pressable>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Gender</Text>
          <View style={styles.chipRow}>
            {genders.map((gender) => (
              <Pressable
                key={gender}
                onPress={() => update('gender', gender)}
                style={[styles.chip, form.gender === gender && styles.chipActive]}
              >
                <Text style={[styles.chipText, form.gender === gender && styles.chipTextActive]}>{gender}</Text>
              </Pressable>
            ))}
          </View>
          {errors.gender ? <Text style={styles.error}>{errors.gender}</Text> : null}
        </View>

        <AppInput label="Phone Number" value={form.phoneNumber} error={errors.phoneNumber} keyboardType="phone-pad" onChangeText={(value) => update('phoneNumber', value)} />
        <AppInput label="Email Address (optional)" value={form.email} error={errors.email} keyboardType="email-address" onChangeText={(value) => update('email', value)} />
        <AppInput label="Residential Address" value={form.residentialAddress} error={errors.residentialAddress} multiline onChangeText={(value) => update('residentialAddress', value)} style={styles.textArea} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Priority Information</Text>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Priority Type</Text>
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

        <AppInput label="Identification Number" value={form.identityNumber} error={errors.identityNumber} onChangeText={(value) => update('identityNumber', value)} />
        <AppInput label="Reason for Priority Request" value={form.reason} error={errors.reason} multiline onChangeText={(value) => update('reason', value)} style={styles.reasonArea} />
      </View>

      <View style={styles.actions}>
        <AppButton title="Back" variant="secondary" onPress={() => router.back()} />
        <AppButton title="Continue" disabled={!canContinue} onPress={handleContinue} />
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
        transparent
        visible={showDatePicker}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModal}>
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

            <View style={styles.weekRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <Text key={`${day}-${index}`} style={styles.weekDay}>{day}</Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {getCalendarDays(calendarMonth).map((date, index) => {
                const selected = date ? formatDateInput(date) === form.dateOfBirth : false;
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
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarTitle: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  weekRow: { flexDirection: 'row' },
  weekDay: { flex: 1, textAlign: 'center', color: colors.muted, fontSize: 12, fontWeight: '900' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  dayCellSelected: { backgroundColor: colors.primary },
  dayCellDisabled: { opacity: 0.35 },
  dayText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  dayTextSelected: { color: colors.white },
  dayTextDisabled: { color: colors.muted },
  calendarActions: { marginTop: 4 },
  actions: { gap: 12, paddingBottom: 20 },
});
