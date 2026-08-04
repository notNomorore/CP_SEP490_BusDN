import { StyleSheet, Text, View } from 'react-native';

import { useVerifyOtp } from '@/auth/hooks/useVerifyOtp';
import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/colors';

export default function VerifyOtpScreen() {
  const {
    otp,
    setOtp,
    countdown,
    canResend,
    canVerify,
    error,
    loading,
    successMessage,
    verificationTarget,
    verifyOtp,
    resendOtp,
    backToRegister,
  } = useVerifyOtp();

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Verify Account</Text>
          <Text style={styles.title}>Enter the 6-digit OTP</Text>
          <Text style={styles.subtitle}>
            We sent a verification code to {verificationTarget}.
          </Text>
        </View>

        {successMessage ? <Text aria-live="polite" style={styles.message}>{successMessage}</Text> : null}
        {error ? (
          <Text accessibilityRole="alert" aria-live="assertive" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <View style={styles.form}>
          <AppInput
            label="Verification code"
            value={otp}
            onChangeText={setOtp}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            style={styles.otpInput}
          />

          <AppButton
            title="Verify Account"
            loading={loading}
            disabled={!canVerify}
            onPress={verifyOtp}
          />

          <AppButton
            title={countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
            variant="secondary"
            disabled={loading || !canResend}
            onPress={resendOtp}
          />

          <AppButton
            title="Back to Register"
            variant="secondary"
            onPress={backToRegister}
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
