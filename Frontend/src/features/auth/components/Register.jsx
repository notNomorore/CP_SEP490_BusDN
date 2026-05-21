import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore.js';
import AuthShell from '../components/AuthShell.jsx';

const Register = () => {
  const navigate = useNavigate();
  const { register, verifyOTP, isLoading, error, clearError } = useAuthStore();

  // Step 0: Personal Info
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 1: OTP Verification
  const [otp, setOtp] = useState('');
  const [otpResendCountdown, setOtpResendCountdown] = useState(0);
  const [userId, setUserId] = useState(null);

  // Current step
  const [step, setStep] = useState('personal'); // 'personal' | 'otp' | 'success'

  // OTP resend timer
  useEffect(() => {
    if (otpResendCountdown <= 0) return undefined;

    const timer = setTimeout(() => {
      setOtpResendCountdown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => clearTimeout(timer);
  }, [otpResendCountdown]);

  // Password validation rules
  const passwordRules = [
    { id: 'length', label: 'At least 8 characters', test: (pwd) => pwd.length >= 8 },
    { id: 'uppercase', label: 'Uppercase letter', test: (pwd) => /[A-Z]/.test(pwd) },
    { id: 'lowercase', label: 'Lowercase letter', test: (pwd) => /[a-z]/.test(pwd) },
    { id: 'number', label: 'One number', test: (pwd) => /\d/.test(pwd) },
    { id: 'special', label: 'Special character (@$!%*?&)', test: (pwd) => /[@$!%*?&]/.test(pwd) },
  ];

  const passedRules = passwordRules.filter((rule) => rule.test(password));
  const isPasswordValid = passedRules.length === passwordRules.length;
  const passwordsMatch = password === confirmPassword;

  // Handle personal info submission
  const handlePersonalInfoSubmit = async (e) => {
    e.preventDefault();
    clearError();

    if (!fullName.trim() || !password || !isPasswordValid || !passwordsMatch) {
      return;
    }

    if (!email.trim() && !phone.trim()) {
      return;
    }

    try {
      const result = await register({
        fullName,
        email: email || undefined,
        phone: phone || undefined,
        password,
        confirmPassword,
      });

      setUserId(result.userId);
      setStep('otp');
      setOtpResendCountdown(60);
    } catch (err) {
      // Error is in store
    }
  };

  // Handle OTP verification
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    clearError();

    if (!otp || otp.length !== 6) {
      return;
    }

    try {
      await verifyOTP({
        email: email || undefined,
        phone: phone || undefined,
        otp,
      });

      setStep('success');

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/auth/login?registered=1');
      }, 2000);
    } catch (err) {
      // Error is in store
    }
  };

  // Handle resend OTP
  const handleResendOtp = async () => {
    clearError();
    try {
      await register({
        fullName,
        email: email || undefined,
        phone: phone || undefined,
        password,
        confirmPassword,
      });

      setOtpResendCountdown(60);
    } catch (err) {
      // Error is in store
    }
  };

  // Step 0: Personal Information
  if (step === 'personal') {
    return (
      <AuthShell
        eyebrow="Sign Up"
        heroTitle="Create your account in seconds"
        heroDescription="Join our platform and start booking your rides today. Quick, secure, and easy."
      >
        <div className="space-y-8">
          <div className="space-y-3">
            <span className="inline-flex rounded-full bg-primary/5 px-3 py-1 text-sm font-semibold text-on-tertiary-fixed-variant">
              Step 1 of 2
            </span>
            <div>
              <h2 className="text-3xl font-headline font-black tracking-tight text-primary">
                Create your account
              </h2>
              <p className="mt-2 text-body-lg text-on-surface-variant">
                Provide your information to get started.
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-red-800 text-sm border border-red-200">
              {typeof error === 'string' ? error : JSON.stringify(error)}
            </div>
          )}

          <form className="space-y-5" onSubmit={handlePersonalInfoSubmit}>
            {/* Full Name */}
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                Full name
              </span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 text-base text-on-surface placeholder:text-outline/70 focus:border-on-tertiary-container focus:outline-none focus:ring-2 focus:ring-on-tertiary-container/20 shadow-sm"
              />
            </label>

            {/* Email or Phone */}
            <div className="grid grid-cols-2 gap-4">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-on-surface">
                  Email (optional)
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 text-base text-on-surface placeholder:text-outline/70 focus:border-on-tertiary-container focus:outline-none focus:ring-2 focus:ring-on-tertiary-container/20 shadow-sm"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-on-surface">
                  Phone (optional)
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0123456789"
                  className="w-full rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 text-base text-on-surface placeholder:text-outline/70 focus:border-on-tertiary-container focus:outline-none focus:ring-2 focus:ring-on-tertiary-container/20 shadow-sm"
                />
              </label>
            </div>

            {/* Password */}
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                Password
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 text-base text-on-surface placeholder:text-outline/70 focus:border-on-tertiary-container focus:outline-none focus:ring-2 focus:ring-on-tertiary-container/20 shadow-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-xs text-on-surface-variant hover:text-primary"
              >
                {showPassword ? 'Hide' : 'Show'} password
              </button>
            </label>

            {/* Password Rules */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-on-surface-variant">
                Password must include:
              </p>
              <div className="space-y-1">
                {passwordRules.map((rule) => {
                  const passed = rule.test(password);
                  return (
                    <div
                      key={rule.id}
                      className={`flex items-center gap-2 text-xs ${
                        passed ? 'text-green-600' : 'text-on-surface-variant'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        passed ? 'bg-green-600 text-white' : 'bg-outline-variant/30'
                      }`}>
                        {passed ? '✓' : ''}
                      </span>
                      {rule.label}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Confirm Password */}
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                Confirm password
              </span>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 text-base text-on-surface placeholder:text-outline/70 focus:border-on-tertiary-container focus:outline-none focus:ring-2 focus:ring-on-tertiary-container/20 shadow-sm"
              />
              {confirmPassword && !passwordsMatch && (
                <p className="text-xs text-red-600">Passwords do not match</p>
              )}
            </label>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={
                isLoading
                || !fullName.trim()
                || (!email.trim() && !phone.trim())
                || !isPasswordValid
                || !passwordsMatch
              }
              className="w-full rounded-2xl bg-on-tertiary-fixed-variant px-6 py-3 text-center text-base font-semibold text-on-tertiary-fixed tracking-wide hover:bg-on-tertiary-fixed-variant/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isLoading ? 'Creating account...' : 'Continue'}
            </button>

            {/* Login Link */}
            <div className="text-center text-sm text-on-surface-variant">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/auth/login')}
                className="font-semibold text-primary hover:underline"
              >
                Sign in
              </button>
            </div>
          </form>
        </div>
      </AuthShell>
    );
  }

  // Step 1: OTP Verification
  if (step === 'otp') {
    return (
      <AuthShell
        eyebrow="Verify Email"
        heroTitle="Verify your email address"
        heroDescription="We've sent a verification code to your email. Enter it below to complete registration."
      >
        <div className="space-y-8">
          <div className="space-y-3">
            <span className="inline-flex rounded-full bg-primary/5 px-3 py-1 text-sm font-semibold text-on-tertiary-fixed-variant">
              Step 2 of 2
            </span>
            <div>
              <h2 className="text-3xl font-headline font-black tracking-tight text-primary">
                Verify your email
              </h2>
              <p className="mt-2 text-body-lg text-on-surface-variant">
                Enter the 6-digit code sent to {email || phone}.
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-red-800 text-sm border border-red-200">
              {typeof error === 'string' ? error : JSON.stringify(error)}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleOtpSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                Verification code
              </span>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength="6"
                className="w-full rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 text-base text-on-surface placeholder:text-outline/70 focus:border-on-tertiary-container focus:outline-none focus:ring-2 focus:ring-on-tertiary-container/20 shadow-sm text-center tracking-widest text-lg font-semibold"
              />
            </label>

            <button
              type="submit"
              disabled={isLoading || otp.length !== 6}
              className="w-full rounded-2xl bg-on-tertiary-fixed-variant px-6 py-3 text-center text-base font-semibold text-on-tertiary-fixed tracking-wide hover:bg-on-tertiary-fixed-variant/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isLoading ? 'Verifying...' : 'Verify email'}
            </button>

            <div className="text-center text-sm text-on-surface-variant">
              {otpResendCountdown > 0 ? (
                <span>Resend code in {otpResendCountdown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  className="text-primary font-semibold hover:underline"
                >
                  Resend code
                </button>
              )}
            </div>
          </form>
        </div>
      </AuthShell>
    );
  }

  // Step 2: Success
  if (step === 'success') {
    return (
      <AuthShell
        eyebrow="Account Created"
        heroTitle="Welcome!"
        heroDescription="Your account has been created successfully."
      >
        <div className="space-y-8 text-center">
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-4xl">✓</span>
            </div>
            <h2 className="text-3xl font-headline font-black tracking-tight text-primary">
              Account created!
            </h2>
            <p className="text-body-lg text-on-surface-variant">
              Your account is ready. Redirecting to login...
            </p>
          </div>
        </div>
      </AuthShell>
    );
  }

  return null;
};

export default Register;
