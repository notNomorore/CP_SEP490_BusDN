import { Link, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';
import { splitIdentifier, validatePassword } from '@/utils/validation';

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  const register = useAuthStore((state) => state.register);
  const clearError = useAuthStore((state) => state.clearError);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);

  const passwordValidation = useMemo(() => validatePassword(password), [password]);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const canSubmit =
    Boolean(fullName.trim()) &&
    Boolean(identifier.trim()) &&
    passwordValidation.isValid &&
    passwordsMatch &&
    agreeToTerms;

  useEffect(() => () => clearError(), [clearError]);

  const handleRegister = async () => {
    clearError();
    const { email, phone } = splitIdentifier(identifier);

    try {
      await register({
        fullName: fullName.trim(),
        identifier: identifier.trim(),
        email,
        phone,
        password,
        confirmPassword,
      });
      router.push('/auth/verify-otp');
    } catch {
      // Store owns the visible error message.
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Tài khoản mới</Text>
          <Text style={styles.title}>Tạo tài khoản BusDN</Text>
          <Text style={styles.subtitle}>
            Đăng ký cần xác thực OTP trước khi đăng nhập.
          </Text>
        </View>

        {error ? (
          <Text accessibilityRole="alert" aria-live="assertive" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <View style={styles.form}>
          <AppInput
            label="Họ và tên"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Nguyen Van A"
            textContentType="name"
            autoComplete="name"
          />
          <AppInput
            label="Email hoặc số điện thoại"
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="name@example.com or 0912345678"
            keyboardType="email-address"
            textContentType="username"
            autoComplete="username"
          />
          <AppInput
            label="Mật khẩu"
            value={password}
            onChangeText={setPassword}
            placeholder="Mật khẩu"
            secureTextEntry
            textContentType="newPassword"
            autoComplete="password-new"
          />

          <View style={styles.rules}>
            {passwordValidation.checks.map((check) => (
              <Text key={check.key} style={[styles.rule, check.valid && styles.ruleValid]}>
                {check.valid ? 'âœ“' : '-'} {check.label}
              </Text>
            ))}
          </View>

          <AppInput
            label="Xác nhận mật khẩu"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Xác nhận mật khẩu"
            secureTextEntry
            textContentType="newPassword"
            autoComplete="password-new"
            error={confirmPassword && !passwordsMatch ? 'Mật khẩu không khớp.' : undefined}
          />

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreeToTerms }}
            accessibilityLabel="I agree to the Điều khoản dịch vụ and Chính sách quyền riêng tư"
            hitSlop={8}
            style={styles.termsRow}
            onPress={() => setAgreeToTerms((value) => !value)}
          >
            <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}>
              {agreeToTerms ? <Text style={styles.checkboxText}>âœ“</Text> : null}
            </View>
            <Text style={styles.termsText}>Tôi đồng ý với Điều khoản dịch vụ và Chính sách quyền riêng tư.</Text>
          </Pressable>

          <AppButton
            title="Tạo tài khoản"
            loading={isLoading}
            disabled={!canSubmit}
            onPress={handleRegister}
          />
        </View>

        <Text style={styles.footerText}>
          Đã có tài khoản?{' '}
          <Link href="/auth/login" style={styles.link}>
            Đăng nhập
          </Link>
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 24,
  },
  header: {
    gap: 10,
    paddingTop: 10,
  },
  kicker: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  form: {
    gap: 18,
  },
  error: {
    borderRadius: 12,
    backgroundColor: colors.errorContainer,
    color: colors.error,
    padding: 14,
    fontSize: 14,
  },
  rules: {
    gap: 8,
    borderRadius: 12,
    backgroundColor: colors.surfaceLow,
    padding: 14,
  },
  rule: {
    color: colors.muted,
    fontSize: 13,
  },
  ruleValid: {
    color: colors.accent,
    fontWeight: '700',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: 6,
    backgroundColor: colors.card,
  },
  checkboxChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkboxText: {
    color: colors.white,
    fontWeight: '900',
  },
  termsText: {
    flex: 1,
    color: colors.muted,
    lineHeight: 20,
  },
  footerText: {
    color: colors.muted,
    textAlign: 'center',
    fontSize: 15,
    paddingBottom: 18,
  },
  link: {
    color: colors.primary,
    fontWeight: '800',
  },
});
