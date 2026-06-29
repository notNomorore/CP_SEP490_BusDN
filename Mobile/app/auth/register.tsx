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
          <Text style={styles.kicker}>New Account</Text>
          <Text style={styles.title}>Create your BusDN account</Text>
          <Text style={styles.subtitle}>
            Registration follows the web flow and requires OTP verification before login.
          </Text>
        </View>

        {error ? (
          <Text accessibilityRole="alert" aria-live="assertive" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <View style={styles.form}>
          <AppInput
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Nguyen Van A"
            textContentType="name"
            autoComplete="name"
          />
          <AppInput
            label="Email or phone number"
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="name@example.com or 0912345678"
            keyboardType="email-address"
            textContentType="username"
            autoComplete="username"
          />
          <AppInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            textContentType="newPassword"
            autoComplete="password-new"
          />

          <View style={styles.rules}>
            {passwordValidation.checks.map((check) => (
              <Text key={check.key} style={[styles.rule, check.valid && styles.ruleValid]}>
                {check.valid ? '✓' : '-'} {check.label}
              </Text>
            ))}
          </View>

          <AppInput
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm password"
            secureTextEntry
            textContentType="newPassword"
            autoComplete="password-new"
            error={confirmPassword && !passwordsMatch ? 'Passwords do not match.' : undefined}
          />

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreeToTerms }}
            accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
            hitSlop={8}
            style={styles.termsRow}
            onPress={() => setAgreeToTerms((value) => !value)}
          >
            <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}>
              {agreeToTerms ? <Text style={styles.checkboxText}>✓</Text> : null}
            </View>
            <Text style={styles.termsText}>I agree to the Terms of Service and Privacy Policy.</Text>
          </Pressable>

          <AppButton
            title="Create Account"
            loading={isLoading}
            disabled={!canSubmit}
            onPress={handleRegister}
          />
        </View>

        <Text style={styles.footerText}>
          Already have an account?{' '}
          <Link href="/auth/login" style={styles.link}>
            Sign in
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
