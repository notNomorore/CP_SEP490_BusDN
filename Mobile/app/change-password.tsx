import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import profileApi from '@/api/profile.api';
import { colors } from '@/constants/colors';
import { getErrorMessage } from '@/utils/validation';

type FieldName = 'current' | 'new' | 'confirm';
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function PasswordInput({
  label,
  icon,
  placeholder,
  value,
  visible,
  error,
  onChangeText,
  onToggle,
}: {
  label: string;
  icon: IconName;
  placeholder: string;
  value: string;
  visible: boolean;
  error?: string;
  onChangeText: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputShell, error ? styles.inputError : null]}>
        <MaterialCommunityIcons color={colors.outline} name={icon} size={21} />
        <TextInput
          accessibilityLabel={label}
          autoCapitalize="none"
          autoComplete="off"
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#8b9691"
          secureTextEntry={!visible}
          style={styles.input}
          value={value}
        />
        <Pressable
          accessibilityLabel={visible ? `Hide ${label}` : `Show ${label}`}
          accessibilityRole="button"
          hitSlop={10}
          onPress={onToggle}
        >
          <MaterialCommunityIcons
            color={colors.outline}
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={21}
          />
        </Pressable>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function passwordStrength(value: string) {
  let score = 0;
  if (value.length > 0) score += 1;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[@$!%*?&]/.test(value)) score += 1;

  if (score === 0) return { label: 'Empty', progress: 0, color: colors.outline };
  if (score <= 2) return { label: 'Weak', progress: 0.4, color: colors.error };
  if (score <= 4) return { label: 'Good', progress: 0.78, color: colors.secondary };
  return { label: 'Excellent', progress: 1, color: colors.accent };
}

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [visible, setVisible] = useState<Record<FieldName, boolean>>({
    current: false,
    new: false,
    confirm: false,
  });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const strength = useMemo(() => passwordStrength(newPassword), [newPassword]);

  const toggle = (field: FieldName) => {
    setVisible((current) => ({ ...current, [field]: !current[field] }));
  };

  const validate = () => {
    const nextErrors: Partial<Record<FieldName, string>> = {};
    if (!currentPassword) nextErrors.current = 'Current password is required.';
    if (!newPassword) {
      nextErrors.new = 'New password is required.';
    } else if (newPassword.length < 8) {
      nextErrors.new = 'New password must be at least 8 characters.';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(newPassword)) {
      nextErrors.new = 'Include uppercase, lowercase, number, and special character.';
    } else if (newPassword === currentPassword) {
      nextErrors.new = 'New password must be different from the current password.';
    }
    if (!confirmPassword) {
      nextErrors.confirm = 'Please confirm your new password.';
    } else if (confirmPassword !== newPassword) {
      nextErrors.confirm = 'Passwords do not match.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await profileApi.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
      Alert.alert('Password Updated', 'Your password was changed successfully.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Unable to Update Password', getErrorMessage(error, 'Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <Pressable accessibilityLabel="Go back" hitSlop={8} onPress={() => router.back()} style={styles.headerButton}>
            <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={24} />
          </Pressable>
          <Text style={styles.headerTitle}>Change Password</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.lockCircle}>
              <MaterialCommunityIcons color="#b5efd1" name="lock" size={37} />
            </View>
            <Text style={styles.heroTitle}>Secure Your Account</Text>
            <Text style={styles.heroSubtitle}>
              Updating your password regularly helps keep your transit data and payment methods safe.
            </Text>
          </View>

          <View style={styles.formCard}>
            <PasswordInput
              error={errors.current}
              icon="key-outline"
              label="Current Password"
              onChangeText={(value) => {
                setCurrentPassword(value);
                if (errors.current) setErrors((current) => ({ ...current, current: undefined }));
              }}
              onToggle={() => toggle('current')}
              placeholder="Enter current password"
              value={currentPassword}
              visible={visible.current}
            />

            <PasswordInput
              error={errors.new}
              icon="shield-lock-outline"
              label="New Password"
              onChangeText={(value) => {
                setNewPassword(value);
                if (errors.new) setErrors((current) => ({ ...current, new: undefined }));
              }}
              onToggle={() => toggle('new')}
              placeholder="Min. 8 characters"
              value={newPassword}
              visible={visible.new}
            />

            <View style={styles.strengthArea}>
              <View style={styles.strengthLabels}>
                <Text style={styles.strengthTitle}>PASSWORD STRENGTH</Text>
                <Text style={[styles.strengthValue, { color: strength.color }]}>{strength.label}</Text>
              </View>
              <View style={styles.strengthTrack}>
                <View
                  style={[
                    styles.strengthFill,
                    { backgroundColor: strength.color, width: `${strength.progress * 100}%` },
                  ]}
                />
              </View>
            </View>

            <PasswordInput
              error={errors.confirm}
              icon="shield-check-outline"
              label="Confirm New Password"
              onChangeText={(value) => {
                setConfirmPassword(value);
                if (errors.confirm) setErrors((current) => ({ ...current, confirm: undefined }));
              }}
              onToggle={() => toggle('confirm')}
              placeholder="Repeat new password"
              value={confirmPassword}
              visible={visible.confirm}
            />

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.updateButton,
                  isSubmitting && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.updateText}>Update Password</Text>
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={() => router.back()}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.noticeCard}>
            <MaterialCommunityIcons color={colors.accent} name="information" size={22} />
            <Text style={styles.noticeText}>
              <Text style={styles.noticeStrong}>For your safety, </Text>
              use a strong password containing letters, numbers, and special characters. Avoid common
              words or easily guessed sequences.
            </Text>
          </View>

          <View style={styles.decorativeCard}>
            <MaterialCommunityIcons color="rgba(0,49,32,0.13)" name="subway-variant" size={86} />
            <View style={styles.decorativeLines}>
              <View style={styles.decorativeLineWide} />
              <View style={styles.decorativeLineShort} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  keyboardView: { flex: 1 },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  headerTitle: { color: colors.primary, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  content: { width: '100%', maxWidth: 500, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 20, paddingBottom: 36 },
  hero: { alignItems: 'center', marginBottom: 29 },
  lockCircle: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center', marginBottom: 15, borderRadius: 35, backgroundColor: colors.primaryContainer, shadowColor: colors.primary, shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.14, shadowRadius: 14, elevation: 5 },
  heroTitle: { color: colors.primary, fontSize: 23, fontWeight: '900', letterSpacing: -0.6 },
  heroSubtitle: { maxWidth: 330, marginTop: 7, color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  formCard: { gap: 20, padding: 25, borderRadius: 34, backgroundColor: colors.white, shadowColor: colors.primary, shadowOffset: { width: 0, height: 17 }, shadowOpacity: 0.06, shadowRadius: 24, elevation: 5 },
  fieldGroup: { gap: 7 },
  label: { paddingHorizontal: 3, color: colors.secondary, fontSize: 12, fontWeight: '800' },
  inputShell: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: 'transparent', borderRadius: 13, backgroundColor: colors.surfaceLow },
  inputError: { borderColor: colors.error },
  input: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 13 },
  errorText: { paddingHorizontal: 3, color: colors.error, fontSize: 11, lineHeight: 16 },
  strengthArea: { marginTop: -13, paddingHorizontal: 3 },
  strengthLabels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  strengthTitle: { color: colors.outline, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  strengthValue: { fontSize: 9, fontWeight: '900' },
  strengthTrack: { height: 4, overflow: 'hidden', borderRadius: 2, backgroundColor: '#dbe5e1' },
  strengthFill: { height: '100%', borderRadius: 2 },
  actions: { gap: 5, marginTop: 4 },
  updateButton: { height: 55, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.23, shadowRadius: 12, elevation: 7 },
  updateText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  cancelButton: { height: 51, alignItems: 'center', justifyContent: 'center', borderRadius: 26 },
  cancelText: { color: colors.secondary, fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
  noticeCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 25, padding: 20, borderRadius: 20, backgroundColor: 'rgba(224,234,230,0.65)' },
  noticeText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 19 },
  noticeStrong: { color: colors.primary, fontWeight: '900' },
  decorativeCard: { height: 112, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', overflow: 'hidden', marginTop: 22, borderRadius: 25, backgroundColor: '#dcebe4', opacity: 0.58 },
  decorativeLines: { gap: 13 },
  decorativeLineWide: { width: 145, height: 10, borderRadius: 5, backgroundColor: 'rgba(0,49,32,0.11)' },
  decorativeLineShort: { width: 95, height: 10, borderRadius: 5, backgroundColor: 'rgba(0,49,32,0.08)' },
});
