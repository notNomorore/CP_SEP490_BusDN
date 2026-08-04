import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { validateRegisterForm } from '@/auth/validation/register';
import { useAuthStore } from '@/store/auth.store';

export function useRegister() {
  const [fullName, setFullName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [success, setSuccess] = useState(false);

  const storeRegister = useAuthStore((state) => state.register);
  const clearError = useAuthStore((state) => state.clearError);
  const loading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);

  const validation = useMemo(
    () => validateRegisterForm({
      fullName,
      identifier,
      password,
      confirmPassword,
      agreeToTerms,
    }),
    [agreeToTerms, confirmPassword, fullName, identifier, password],
  );

  useEffect(() => () => clearError(), [clearError]);

  const register = useCallback(async () => {
    clearError();
    setSuccess(false);

    try {
      await storeRegister({
        fullName: fullName.trim(),
        identifier: identifier.trim(),
        email: validation.identifier.email,
        phone: validation.identifier.phone,
        password,
        confirmPassword,
      });
      setSuccess(true);
      router.push('/auth/verify-otp');
    } catch {
      setSuccess(false);
    }
  }, [clearError, confirmPassword, fullName, identifier, password, storeRegister, validation.identifier.email, validation.identifier.phone]);

  const toggleAgreeToTerms = useCallback(() => {
    setAgreeToTerms((value) => !value);
  }, []);

  return {
    fullName,
    setFullName,
    identifier,
    setIdentifier,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    agreeToTerms,
    toggleAgreeToTerms,
    canSubmit: validation.canSubmit,
    confirmPasswordError: validation.confirmPasswordError,
    error,
    loading,
    passwordValidation: validation.passwordValidation,
    register,
    success,
  };
}

export default useRegister;
