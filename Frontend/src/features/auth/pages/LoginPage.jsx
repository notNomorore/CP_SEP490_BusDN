import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import authService from '../services/authService.js';
import useAuthStore from '../stores/authStore.js';

const getErrorMessage = (error) => {
  if (!error) {
    return '';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (Array.isArray(error)) {
    return error.join(', ');
  }

  if (typeof error === 'object') {
    if (error.code === 'ACCOUNT_LOCKED') {
      const reason = error.reason ? ` Lý do: ${error.reason}.` : '';
      const lockedUntil = error.lockedUntil ? ` Thời hạn khóa đến: ${new Date(error.lockedUntil).toLocaleString('vi-VN')}.` : '';
      return error.message || `Tài khoản đã bị khóa.${reason}${lockedUntil} Vui lòng liên hệ quản trị viên để được hỗ trợ.`;
    }

    if (error.message) {
      return error.message;
    }

    if (error.statusCode === 401 || error.status === 401 || error.response?.status === 401) {
      return 'Email/số điện thoại hoặc mật khẩu không đúng, hoặc tài khoản chưa được phép đăng nhập.';
    }

    return Object.values(error).flat().join(' ');
  }

  return 'Unable to complete sign in.';
};

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    requestPasswordReset,
    resetPassword,
    isLoading,
    error,
    clearError,
  } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (searchParams.get('registered') === '1') {
      setMessage('Registration completed. You can sign in now.');
    }
  }, [searchParams]);

  useEffect(() => {
    const lockMessage = sessionStorage.getItem('authLockMessage');
    if (lockMessage) {
      setSubmitError(lockMessage);
      sessionStorage.removeItem('authLockMessage');
    }
  }, []);

  useEffect(() => () => clearError(), [clearError]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearError();
    setSubmitError('');
    setMessage('');
    setIsSubmittingLogin(true);

    try {
      const result = await authService.login(identifier.trim(), password);
      useAuthStore.setState({
        user: result.user,
        token: result.token,
        isAuthenticated: true,
        error: null,
      });
      if (result.user?.isFirstLogin && ['DRIVER', 'CONDUCTOR', 'BUS_ASSISTANT'].includes(result.user.role)) {
        navigate('/auth/force-change-password', { replace: true });
      }
    } catch (loginError) {
      const errorMessage = getErrorMessage(loginError) || 'Đăng nhập thất bại. Vui lòng kiểm tra tài khoản, mật khẩu hoặc trạng thái tài khoản.';
      setSubmitError(errorMessage);
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const openForgotPassword = () => {
    clearError();
    setSubmitError('');
    setMessage('');
    setResetIdentifier(identifier);
    setAuthMode('forgot-request');
  };

  const backToLogin = () => {
    clearError();
    setSubmitError('');
    setAuthMode('login');
    setResetToken('');
    setResetOtp('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleForgotPasswordRequest = async (event) => {
    event.preventDefault();
    clearError();
    setSubmitError('');
    setMessage('');

    try {
      const trimmedIdentifier = resetIdentifier.trim();
      const isEmail = trimmedIdentifier.includes('@');
      const result = await requestPasswordReset(
        isEmail
          ? { email: trimmedIdentifier }
          : { phoneNumber: trimmedIdentifier }
      );

      setResetToken(result.token || '');
      setAuthMode('forgot-reset');
      setMessage(
        result.devOtp
          ? `Verification code sent. Development OTP: ${result.devOtp}`
          : 'Verification code sent. Check your email or phone.'
      );
    } catch {
      // Error state is handled by the store.
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    clearError();
    setSubmitError('');
    setMessage('');

    if (newPassword !== confirmPassword) {
      setMessage('New password and confirmation do not match.');
      return;
    }

    try {
      await resetPassword({
        token: resetToken,
        otp: resetOtp,
        newPassword,
        confirmPassword,
      });

      backToLogin();
      setIdentifier(resetIdentifier);
      setMessage('Password reset successful. You can sign in now.');
    } catch {
      // Error state is handled by the store.
    }
  };

  const visibleError = submitError || getErrorMessage(error);

  return (
    <AuthShell
      eyebrow={authMode === 'login' ? 'Welcome Back' : 'Account Recovery'}
      heroTitle={
        authMode === 'login'
          ? 'Your next ride starts with one secure sign-in.'
          : 'Reset your password to recover your BusDN account.'
      }
      heroDescription="Continue your Veridian Transit journey with faster booking access, route history, and support tools kept in one place."
      heroImage="https://lh3.googleusercontent.com/aida-public/AB6AXuD7rt0_hvCv7aGG4-oCaa9u-tKEzia1J8kBU6-3dCQYwxSrvgsbzWmL15b7fbNop_dnnYNXhqbgoVMbgHfrowGfdNsnbCMBrWyF1G1Zsyg_EjBKUAlJF-hyi7oDmsHrdQlzG-4PNwVUf5mU2UxqdG_kUTAgSlj0b-Am-plOE3ikrkdVN1i58KFHFQVsR0XjaITv54utBo3c2uJndkGIywZ2s03FSLGk9vAUAyYhEbr9OqXtRSzIqbPBckaBha_gyV0GZibVzdfl4CM"
      heroChips={[
        { icon: 'speed', label: 'Fast boarding access' },
        { icon: 'shield_lock', label: 'Protected account' },
      ]}
    >
      <div className="space-y-8">
        <div className="space-y-3">
          <span className="inline-flex rounded-full bg-primary/5 px-3 py-1 text-sm font-semibold text-on-tertiary-fixed-variant">
            {authMode === 'login' ? 'Sign in' : 'Password reset'}
          </span>
          <div>
            <h2 className="text-3xl font-headline font-black tracking-tight text-primary">
              {authMode === 'login' ? 'Login to your account' : 'Recover account access'}
            </h2>
            <p className="mt-2 text-body-lg text-on-surface-variant">
              {authMode === 'login'
                ? 'Enter your email or phone number to continue to your bookings and transit tools.'
                : 'Use your account email or phone number, then enter the verification code and new password.'}
            </p>
          </div>
        </div>

        {visibleError && (
          <div
            className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-800 shadow-sm"
            role="alert"
            aria-live="assertive"
          >
            {visibleError}
          </div>
        )}

        {message && (
          <div className="rounded-2xl border border-on-tertiary-container/20 bg-on-tertiary-container/10 px-4 py-3 text-sm text-on-tertiary-fixed-variant">
            {message}
          </div>
        )}

        {authMode === 'login' && (
          <>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-on-surface">
                  Email or phone number
                </span>
                <span className="flex items-center gap-3 rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 shadow-sm focus-within:border-on-tertiary-container focus-within:ring-2 focus-within:ring-on-tertiary-container/20">
                  <span className="material-symbols-outlined text-outline">mail</span>
                  <input
                    type="text"
                    name="identity"
                    autoComplete="username"
                    placeholder="name@example.com"
                    value={identifier}
                    onChange={(event) => {
                      setIdentifier(event.target.value);
                      setSubmitError('');
                    }}
                    className="w-full border-0 bg-transparent p-0 text-base text-on-surface placeholder:text-outline/70 focus:ring-0"
                  />
                </span>
              </label>

              <label className="block space-y-2">
                <span className="flex items-center justify-between text-sm font-semibold text-on-surface">
                  <span>Password</span>
                  <button
                    type="button"
                    onClick={openForgotPassword}
                    className="text-xs font-bold uppercase tracking-[0.18em] text-on-tertiary-fixed-variant hover:text-primary"
                  >
                    Forgot password?
                  </button>
                </span>
                <span className="flex items-center gap-3 rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 shadow-sm focus-within:border-on-tertiary-container focus-within:ring-2 focus-within:ring-on-tertiary-container/20">
                  <span className="material-symbols-outlined text-outline">lock</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    placeholder="********"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setSubmitError('');
                    }}
                    className="w-full border-0 bg-transparent p-0 text-base text-on-surface placeholder:text-outline/70 focus:ring-0"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="text-outline hover:text-primary"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <span className="material-symbols-outlined">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </span>
              </label>

              <div className="flex items-center justify-between gap-4 text-sm text-on-surface-variant">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-outline-variant text-on-tertiary-container focus:ring-on-tertiary-container"
                  />
                  <span>Remember this device</span>
                </label>
                <span className="rounded-full bg-surface-container px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                  24/7 support
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmittingLogin || !identifier.trim() || !password}
                className="w-full rounded-full bg-primary px-6 py-4 text-base font-bold text-on-primary shadow-lg shadow-primary/15 hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingLogin ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-body-md text-on-surface-variant">
              New to Veridian Transit?{' '}
              <Link
                to="/auth/register"
                className="font-bold text-on-tertiary-fixed-variant hover:text-primary"
              >
                Create an account
              </Link>
            </p>
          </>
        )}

        {authMode === 'forgot-request' && (
          <form className="space-y-5" onSubmit={handleForgotPasswordRequest}>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                Email or phone number
              </span>
              <span className="flex items-center gap-3 rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 shadow-sm focus-within:border-on-tertiary-container focus-within:ring-2 focus-within:ring-on-tertiary-container/20">
                <span className="material-symbols-outlined text-outline">alternate_email</span>
                <input
                  type="text"
                  value={resetIdentifier}
                  onChange={(event) => setResetIdentifier(event.target.value)}
                  placeholder="name@example.com or 0901234567"
                  className="w-full border-0 bg-transparent p-0 text-base text-on-surface placeholder:text-outline/70 focus:ring-0"
                />
              </span>
            </label>

            <button
              type="submit"
              disabled={isLoading || !resetIdentifier.trim()}
              className="w-full rounded-full bg-primary px-6 py-4 text-base font-bold text-on-primary shadow-lg shadow-primary/15 hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Sending code...' : 'Send verification code'}
            </button>

            <button
              type="button"
              onClick={backToLogin}
              className="w-full rounded-full border border-outline-variant/60 bg-white px-6 py-4 text-base font-bold text-primary hover:bg-surface-container-low"
            >
              Back to login
            </button>
          </form>
        )}

        {authMode === 'forgot-reset' && (
          <form className="space-y-5" onSubmit={handleResetPassword}>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                Verification code
              </span>
              <span className="flex items-center gap-3 rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 shadow-sm focus-within:border-on-tertiary-container focus-within:ring-2 focus-within:ring-on-tertiary-container/20">
                <span className="material-symbols-outlined text-outline">pin</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={resetOtp}
                  onChange={(event) => setResetOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full border-0 bg-transparent p-0 text-base font-bold tracking-[0.28em] text-on-surface placeholder:text-outline/70 focus:ring-0"
                />
              </span>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                New password
              </span>
              <span className="flex items-center gap-3 rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 shadow-sm focus-within:border-on-tertiary-container focus-within:ring-2 focus-within:ring-on-tertiary-container/20">
                <span className="material-symbols-outlined text-outline">lock_reset</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="********"
                  className="w-full border-0 bg-transparent p-0 text-base text-on-surface placeholder:text-outline/70 focus:ring-0"
                />
              </span>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                Confirm password
              </span>
              <span className="flex items-center gap-3 rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 shadow-sm focus-within:border-on-tertiary-container focus-within:ring-2 focus-within:ring-on-tertiary-container/20">
                <span className="material-symbols-outlined text-outline">verified_user</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="********"
                  className="w-full border-0 bg-transparent p-0 text-base text-on-surface placeholder:text-outline/70 focus:ring-0"
                />
              </span>
            </label>

            <button
              type="submit"
              disabled={
                isLoading
                || resetOtp.length !== 6
                || !newPassword
                || !confirmPassword
              }
              className="w-full rounded-full bg-primary px-6 py-4 text-base font-bold text-on-primary shadow-lg shadow-primary/15 hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Resetting password...' : 'Reset password'}
            </button>

            <button
              type="button"
              onClick={backToLogin}
              className="w-full rounded-full border border-outline-variant/60 bg-white px-6 py-4 text-base font-bold text-primary hover:bg-surface-container-low"
            >
              Back to login
            </button>
          </form>
        )}
      </div>
    </AuthShell>
  );
};

export default LoginPage;
