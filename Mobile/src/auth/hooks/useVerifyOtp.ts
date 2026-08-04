import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { isValidOtp, sanitizeOtpInput } from '@/auth/validation/otp';
import { useAuthStore } from '@/store/auth.store';

const RESEND_COUNTDOWN_SECONDS = 60;
const SUCCESS_REDIRECT_DELAY_MS = 900;

export function useVerifyOtp() {
  const [otp, setOtpValue] = useState('');
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN_SECONDS);
  const [successMessage, setSuccessMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const pendingRegistration = useAuthStore((state) => state.pendingRegistration);
  const storeVerifyOtp = useAuthStore((state) => state.verifyOtp);
  const storeResendOtp = useAuthStore((state) => state.resendOtp);
  const clearError = useAuthStore((state) => state.clearError);
  const loading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);

  const canVerify = useMemo(() => isValidOtp(otp), [otp]);
  const canResend = countdown <= 0;

  useEffect(() => {
    if (!pendingRegistration) {
      router.replace('/auth/register');
    }
  }, [pendingRegistration]);

  useEffect(() => () => clearError(), [clearError]);

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = setTimeout(() => setCountdown((value) => Math.max(value - 1, 0)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const setOtp = useCallback((value: string) => {
    setOtpValue(sanitizeOtpInput(value));
  }, []);

  const verifyOtp = useCallback(async () => {
    if (!pendingRegistration) return;
    clearError();
    setSuccess(false);

    try {
      await storeVerifyOtp({
        email: pendingRegistration.email,
        phone: pendingRegistration.phone,
        otp,
      });
      setSuccess(true);
      setSuccessMessage('Registration completed. You can sign in now.');
      setTimeout(() => router.replace('/auth/login'), SUCCESS_REDIRECT_DELAY_MS);
    } catch {
      setSuccess(false);
    }
  }, [clearError, otp, pendingRegistration, storeVerifyOtp]);

  const resendOtp = useCallback(async () => {
    clearError();
    setSuccess(false);

    try {
      await storeResendOtp();
      setOtpValue('');
      setCountdown(RESEND_COUNTDOWN_SECONDS);
      setSuccessMessage('A new OTP was sent.');
      setSuccess(true);
    } catch {
      setSuccess(false);
    }
  }, [clearError, storeResendOtp]);

  const backToRegister = useCallback(() => {
    router.replace('/auth/register');
  }, []);

  return {
    otp,
    setOtp,
    countdown,
    canResend,
    canVerify,
    error,
    loading,
    success,
    successMessage,
    verificationTarget: pendingRegistration?.identifier || 'your account',
    verifyOtp,
    resendOtp,
    backToRegister,
  };
}

export default useVerifyOtp;
