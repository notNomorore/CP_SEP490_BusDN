import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '../stores/authStore.js';
import authService from '../services/authService.js';
import AuthShell from '../components/AuthShell.jsx';

const Login = ({ onClose }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isLoading, error, clearError, isAuthenticated } = useAuthStore();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [message, setMessage] = useState('');
  const [view, setView] = useState('login'); // 'login' | 'forgot-email' | 'forgot-otp' | 'forgot-reset'

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotResetToken, setForgotResetToken] = useState('');
  const [forgotResendCountdown, setForgotResendCountdown] = useState(0);

  // Check for messages from redirects
  useEffect(() => {
    if (searchParams.get('registered') === '1') {
      setMessage('✓ Registration completed. Please sign in.');
    } else if (searchParams.get('reset') === '1') {
      setMessage('✓ Password reset successful. Please sign in.');
    }

    // Restore session if already logged in
    if (isAuthenticated) {
      const redirect = searchParams.get('redirect') || '/';
      navigate(redirect);
    }
  }, [isAuthenticated, navigate, searchParams]);

  // Resend timer
  useEffect(() => {
    if (forgotResendCountdown <= 0) return undefined;

    const timer = setTimeout(() => {
      setForgotResendCountdown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => clearTimeout(timer);
  }, [forgotResendCountdown]);

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();
    clearError();

    if (!identifier.trim() || !password) {
      return;
    }

    try {
      await login(identifier, password);
      // Will navigate on isAuthenticated change
    } catch (err) {
      // Error is already in store
    }
  };

  // Handle forgot password request
  const handleForgotPasswordRequest = async (e) => {
    e.preventDefault();
    clearError();

    if (!forgotEmail.trim()) {
      return;
    }

    try {
      const response = await authService.requestPasswordReset({
        email: forgotEmail,
      });
      
      setForgotResetToken(response.token);
      setView('forgot-otp');
      setForgotResendCountdown(60);
    } catch (err) {
      // Error is already in store or response
      console.error('Forgot password error:', err);
    }
  };

  // Handle verify forgot OTP
  const handleVerifyForgotOTP = async (e) => {
    e.preventDefault();
    clearError();

    if (!forgotOtp.trim() || forgotOtp.length !== 6) {
      return;
    }

    try {
      // Just verify that OTP is being handled - actual verification happens on password reset
      setView('forgot-reset');
    } catch (err) {
      console.error('OTP verification error:', err);
    }
  };

  // Handle reset password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    clearError();

    if (!forgotPassword || !forgotConfirmPassword) {
      return;
    }

    if (forgotPassword !== forgotConfirmPassword) {
      return;
    }

    try {
      await authService.resetPassword({
        token: forgotResetToken,
        otp: forgotOtp,
        newPassword: forgotPassword,
        confirmPassword: forgotConfirmPassword,
      });

      setMessage('✓ Password reset successful. Please sign in.');
      returnToLogin();
    } catch (err) {
      console.error('Password reset error:', err);
    }
  };

  const returnToLogin = () => {
    setView('login');
    setForgotEmail('');
    setForgotOtp('');
    setForgotPassword('');
    setForgotConfirmPassword('');
    setForgotResetToken('');
  };

  // Handle resend OTP for password reset
  const handleResendPasswordResetOTP = async () => {
    clearError();
    try {
      const response = await authService.requestPasswordReset({
        email: forgotEmail,
      });
      
      setForgotResetToken(response.token);
      setForgotResendCountdown(60);
    } catch (err) {
      console.error('Resend OTP error:', err);
    }
  };

  return (
    <AuthShell
      eyebrow={
        view === 'login'
          ? 'Welcome Back'
          : view === 'forgot-email'
            ? 'Forgot Password?'
            : 'Reset Password'
      }
      heroTitle={
        view === 'login'
          ? 'Your next ride starts with one secure sign-in.'
          : 'Reset your password to regain access to your account.'
      }
    >
      {/* Login View */}
      {view === 'login' && (
        <div className="space-y-8">
          <div className="space-y-3">
            <span className="inline-flex rounded-full bg-primary/5 px-3 py-1 text-sm font-semibold text-on-tertiary-fixed-variant">
              Sign in
            </span>
            <div>
              <h2 className="text-3xl font-headline font-black tracking-tight text-primary">
                Login to your account
              </h2>
              <p className="mt-2 text-body-lg text-on-surface-variant">
                Enter your email or phone number to continue to your bookings.
              </p>
            </div>
          </div>

          {message && (
            <div className="rounded-lg bg-green-50 p-4 text-green-800 text-sm border border-green-200">
              {message}
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-red-800 text-sm border border-red-200">
              {typeof error === 'string' ? error : JSON.stringify(error)}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleLogin}>
            {/* Email/Phone Input */}
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                Email or phone number
              </span>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="example@email.com or 0123456789"
                className="w-full rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 text-base text-on-surface placeholder:text-outline/70 focus:border-on-tertiary-container focus:outline-none focus:ring-2 focus:ring-on-tertiary-container/20 shadow-sm"
              />
            </label>

            {/* Password Input */}
            <label className="block space-y-2">
              <span className="flex items-center justify-between text-sm font-semibold text-on-surface">
                <span>Password</span>
                <button
                  type="button"
                  onClick={() => setView('forgot-email')}
                  className="text-xs font-bold uppercase tracking-[0.18em] text-on-tertiary-fixed-variant hover:text-primary"
                >
                  Forgot password?
                </button>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 text-base text-on-surface placeholder:text-outline/70 focus:border-on-tertiary-container focus:outline-none focus:ring-2 focus:ring-on-tertiary-container/20 shadow-sm"
              />
            </label>

            {/* Remember Device */}
            <div className="flex items-center justify-between gap-4 text-sm text-on-surface-variant">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="h-4 w-4 rounded border-outline-variant text-on-tertiary-container focus:ring-on-tertiary-container"
                />
                <span>Remember this device</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !identifier.trim() || !password}
              className="w-full rounded-2xl bg-on-tertiary-fixed-variant px-6 py-3 text-center text-base font-semibold text-on-tertiary-fixed tracking-wide hover:bg-on-tertiary-fixed-variant/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>

            {/* Register Link */}
            <div className="text-center text-sm text-on-surface-variant">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/auth/register')}
                className="font-semibold text-primary hover:underline"
              >
                Sign up here
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Forgot Password - Email View */}
      {view === 'forgot-email' && (
        <div className="space-y-8">
          <div className="space-y-3">
            <span className="inline-flex rounded-full bg-primary/5 px-3 py-1 text-sm font-semibold text-on-tertiary-fixed-variant">
              Step 1 of 3
            </span>
            <div>
              <h2 className="text-3xl font-headline font-black tracking-tight text-primary">
                Forgot your password?
              </h2>
              <p className="mt-2 text-body-lg text-on-surface-variant">
                Enter your email to receive a verification code.
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-red-800 text-sm border border-red-200">
              {typeof error === 'string' ? error : JSON.stringify(error)}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleForgotPasswordRequest}>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                Email address
              </span>
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 text-base text-on-surface placeholder:text-outline/70 focus:border-on-tertiary-container focus:outline-none focus:ring-2 focus:ring-on-tertiary-container/20 shadow-sm"
              />
            </label>

            <button
              type="submit"
              disabled={isLoading || !forgotEmail.trim()}
              className="w-full rounded-2xl bg-on-tertiary-fixed-variant px-6 py-3 text-center text-base font-semibold text-on-tertiary-fixed tracking-wide hover:bg-on-tertiary-fixed-variant/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isLoading ? 'Sending...' : 'Send verification code'}
            </button>

            <button
              type="button"
              onClick={returnToLogin}
              className="w-full rounded-2xl border border-outline-variant/60 px-6 py-3 text-center text-base font-semibold text-on-surface hover:bg-surface-container transition"
            >
              Back to login
            </button>
          </form>
        </div>
      )}

      {/* Forgot Password - OTP View */}
      {view === 'forgot-otp' && (
        <div className="space-y-8">
          <div className="space-y-3">
            <span className="inline-flex rounded-full bg-primary/5 px-3 py-1 text-sm font-semibold text-on-tertiary-fixed-variant">
              Step 2 of 3
            </span>
            <div>
              <h2 className="text-3xl font-headline font-black tracking-tight text-primary">
                Verify your email
              </h2>
              <p className="mt-2 text-body-lg text-on-surface-variant">
                Enter the 6-digit code we sent to {forgotEmail}.
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-red-800 text-sm border border-red-200">
              {typeof error === 'string' ? error : JSON.stringify(error)}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleVerifyForgotOTP}>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                Verification code
              </span>
              <input
                type="text"
                value={forgotOtp}
                onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength="6"
                className="w-full rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 text-base text-on-surface placeholder:text-outline/70 focus:border-on-tertiary-container focus:outline-none focus:ring-2 focus:ring-on-tertiary-container/20 shadow-sm text-center tracking-widest text-lg font-semibold"
              />
            </label>

            <button
              type="submit"
              disabled={isLoading || forgotOtp.length !== 6}
              className="w-full rounded-2xl bg-on-tertiary-fixed-variant px-6 py-3 text-center text-base font-semibold text-on-tertiary-fixed tracking-wide hover:bg-on-tertiary-fixed-variant/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isLoading ? 'Verifying...' : 'Verify code'}
            </button>

            <div className="text-center text-sm text-on-surface-variant">
              {forgotResendCountdown > 0 ? (
                <span>Resend code in {forgotResendCountdown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendPasswordResetOTP}
                  className="text-primary font-semibold hover:underline"
                >
                  Resend code
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={returnToLogin}
              className="w-full rounded-2xl border border-outline-variant/60 px-6 py-3 text-center text-base font-semibold text-on-surface hover:bg-surface-container transition"
            >
              Back to login
            </button>
          </form>
        </div>
      )}

      {/* Forgot Password - Reset View */}
      {view === 'forgot-reset' && (
        <div className="space-y-8">
          <div className="space-y-3">
            <span className="inline-flex rounded-full bg-primary/5 px-3 py-1 text-sm font-semibold text-on-tertiary-fixed-variant">
              Step 3 of 3
            </span>
            <div>
              <h2 className="text-3xl font-headline font-black tracking-tight text-primary">
                Create a new password
              </h2>
              <p className="mt-2 text-body-lg text-on-surface-variant">
                Your email has been verified. Set a new password to regain access.
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-red-800 text-sm border border-red-200">
              {typeof error === 'string' ? error : JSON.stringify(error)}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleResetPassword}>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                New password
              </span>
              <input
                type="password"
                value={forgotPassword}
                onChange={(e) => setForgotPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 text-base text-on-surface placeholder:text-outline/70 focus:border-on-tertiary-container focus:outline-none focus:ring-2 focus:ring-on-tertiary-container/20 shadow-sm"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                Confirm password
              </span>
              <input
                type="password"
                value={forgotConfirmPassword}
                onChange={(e) => setForgotConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 text-base text-on-surface placeholder:text-outline/70 focus:border-on-tertiary-container focus:outline-none focus:ring-2 focus:ring-on-tertiary-container/20 shadow-sm"
              />
            </label>

            <button
              type="submit"
              disabled={
                isLoading
                || !forgotPassword
                || !forgotConfirmPassword
                || forgotPassword !== forgotConfirmPassword
              }
              className="w-full rounded-2xl bg-on-tertiary-fixed-variant px-6 py-3 text-center text-base font-semibold text-on-tertiary-fixed tracking-wide hover:bg-on-tertiary-fixed-variant/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isLoading ? 'Resetting...' : 'Reset password'}
            </button>

            <button
              type="button"
              onClick={returnToLogin}
              className="w-full rounded-2xl border border-outline-variant/60 px-6 py-3 text-center text-base font-semibold text-on-surface hover:bg-surface-container transition"
            >
              Back to login
            </button>
          </form>
        </div>
      )}
    </AuthShell>
  );
};

export default Login;
