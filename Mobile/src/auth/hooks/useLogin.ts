import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { canSubmitLogin } from '@/auth/validation/login';
import { useAuthStore } from '@/store/auth.store';
import { getRoleHomeRoute } from '@/utils/roleNavigation';

export function useLogin() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const storeLogin = useAuthStore((state) => state.login);
  const clearError = useAuthStore((state) => state.clearError);
  const loading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const error = useAuthStore((state) => state.error);

  const canSubmit = useMemo(
    () => canSubmitLogin({ identifier, password }),
    [identifier, password],
  );

  useEffect(() => () => clearError(), [clearError]);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(getRoleHomeRoute(user?.role));
    }
  }, [isAuthenticated, user?.role]);

  const login = useCallback(async () => {
    clearError();
    try {
      await storeLogin(identifier.trim(), password);
      const loggedInUser = useAuthStore.getState().user;
      router.replace(getRoleHomeRoute(loggedInUser?.role));
    } catch {
      // The auth store owns the visible API error message.
    }
  }, [clearError, identifier, password, storeLogin]);

  const openRegister = useCallback(() => {
    router.push('/auth/register');
  }, []);

  const showForgotPasswordUnavailable = useCallback(() => {
    Alert.alert('Forgot Password', 'Password recovery is not available in the mobile app yet.');
  }, []);

  const showGoogleLoginUnavailable = useCallback(() => {
    Alert.alert('Google Sign-In', 'Google sign-in is not available in the mobile app yet.');
  }, []);

  return {
    identifier,
    setIdentifier,
    password,
    setPassword,
    canSubmit,
    error,
    loading,
    login,
    openRegister,
    showForgotPasswordUnavailable,
    showGoogleLoginUnavailable,
  };
}

export default useLogin;
