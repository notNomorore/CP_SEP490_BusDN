import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';

export default function VerifyOtpScreen() {
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [message, setMessage] = useState('');
  const pendingRegistration = useAuthStore((state) => state.pendingRegistration);
  const verifyOtp = useAuthStore((state) => state.verifyOtp);
  const resendOtp = useAuthStore((state) => state.resendOtp);
  const clearError = useAuthStore((state) => state.clearError);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);

  useEffect(() => {
    if (!pendingRegistration) {
      router.replace('/auth/register');
    }
  }, [pendingRegistration]);

  useEffect(() => () => clearError(), [clearError]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((value) => Math.max(value - 1, 0)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleVerify = async () => {
    if (!pendingRegistration) return;
    clearError();

    try {
      await verifyOtp({
        email: pendingRegistration.email,
        phone: pendingRegistration.phone,
        otp,
      });
      setMessage('Registration completed. You can sign in now.');
      setTimeout(() => router.replace('/auth/login'), 900);
    } catch {
      // Store owns the visible error message.
    }
  };

  const handleResend = async () => {
    clearError();
    try {
      await resendOtp();
      setOtp('');
      setCountdown(60);
      setMessage('A new OTP was sent.');
    } catch {
      // Store owns the visible error message.
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Verify Account</Text>
          <Text style={styles.title}>Enter the 6-digit OTP</Text>
          <Text style={styles.subtitle}>
            We sent a verification code to {pendingRegistration?.identifier || 'your account'}.
          </Text>
        </View>

        {message ? <Text aria-live="polite" style={styles.message}>{message}</Text> : null}
        {error ? (
          <Text accessibilityRole="alert" aria-live="assertive" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <View style={styles.form}>
          <AppInput
            label="Verification code"
            value={otp}
            onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            style={styles.otpInput}
          />

          <AppButton
            title="Verify Account"
            loading={isLoading}
            disabled={otp.length !== 6}
            onPress={handleVerify}
          />

          <AppButton
            title={countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
            variant="secondary"
            disabled={isLoading || countdown > 0}
            onPress={handleResend}
          />

          <AppButton
            title="Back to Register"
            variant="secondary"
            onPress={() => router.replace('/auth/register')}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
  },
  header: {
    gap: 10,
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
    gap: 16,
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 10,
  },
  message: {
    borderRadius: 12,
    backgroundColor: colors.surfaceLow,
    color: colors.primary,
    padding: 14,
    fontSize: 14,
  },
  error: {
    borderRadius: 12,
    backgroundColor: colors.errorContainer,
    color: colors.error,
    padding: 14,
    fontSize: 14,
  },
});
