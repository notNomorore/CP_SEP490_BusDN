import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import useAuthStore from '../stores/authStore.js';
import { savePendingRegistrationOtp } from '../services/registrationOtpSession.js';

const splitIdentifier = (identifier) => {
  const normalized = identifier.trim();

  if (normalized.includes('@')) {
    return { email: normalized.toLowerCase(), phone: undefined };
  }

  return { email: undefined, phone: normalized.replace(/\s+/g, '') };
};

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
    return Object.values(error).flat().join(' ');
  }

  return 'Unable to complete registration.';
};

const passwordRules = [
  {
    key: 'length',
    label: 'At least 8 characters',
    test: (value) => value.length >= 8
  },
  {
    key: 'upper',
    label: 'Includes one uppercase letter',
    test: (value) => /[A-Z]/.test(value)
  },
  {
    key: 'lower',
    label: 'Includes one lowercase letter',
    test: (value) => /[a-z]/.test(value)
  },
  {
    key: 'number',
    label: 'Includes one number',
    test: (value) => /[0-9]/.test(value)
  },
  {
    key: 'special',
    label: 'Includes one special character',
    test: (value) => /[@$!%*?&]/.test(value)
  }
];

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  useEffect(() => () => clearError(), [clearError]);

  const passwordChecks = passwordRules.map((rule) => ({
    ...rule,
    isValid: rule.test(password),
  }));
  const isPasswordValid = passwordChecks.every((rule) => rule.isValid);
  const passwordsMatch = confirmPassword.length > 0 && confirmPassword === password;
  const canSubmit =
    fullName.trim()
    && identifier.trim()
    && agreeToTerms
    && isPasswordValid
    && passwordsMatch;

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearError();

    const { email, phone } = splitIdentifier(identifier);

    try {
      const result = await register({
        fullName: fullName.trim(),
        email,
        phone,
        password,
        confirmPassword,
      });

      savePendingRegistrationOtp({
        email,
        phone,
        identifier: identifier.trim(),
        expiresAt: result.expiresAt || '',
      });
      navigate('/auth/verify-otp');
    } catch {
      // Error state is handled by the store.
    }
  };

  return (
    <AuthShell
      eyebrow="New Account"
      heroTitle="Build your transit profile once, move faster every trip after."
      heroDescription="Create your Veridian Transit account to save routes, manage travel history, and unlock a cleaner booking flow across devices."
      heroImage="https://lh3.googleusercontent.com/aida-public/AB6AXuAJ0-46nGESJSMPeGRP-CE-D8JvDly9UpS2IuR4ExR-2mfpkgtDbYsnKM8c6LRR3L0WHKPYPHRsorX-jwR_51bHyNx-pdQsiHNm6Nkqs_S01BqkMSvKRfrmqNUp_PUuJay4TeFoy98DeSVH_z0FyUg-RHC7A5UPz00GKKvb9HPAXnE2hIMheiaEk8uTVlk9941sRBm6mVXM16HzsUqeVyVnouuY-DqgDGG6BXU-cr-ZHMX0a_yizZecfMAbRZNJLtA30wee7a6jJfA"
      heroChips={[
        { icon: 'directions_bus', label: 'Personal trip hub' },
        { icon: 'verified_user', label: 'Safer verification' }
      ]}
      imagePosition="right"
    >
      <div className="space-y-8">
        <div className="space-y-3">
          <span className="inline-flex rounded-full bg-primary/5 px-3 py-1 text-sm font-semibold text-on-tertiary-fixed-variant">
            Register
          </span>
          <div>
            <h2 className="text-3xl font-headline font-black tracking-tight text-primary">
              Create your account
            </h2>
            <p className="mt-2 text-body-lg text-on-surface-variant">
              Set up your traveler identity and keep your transit planning in one secure place.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
            {getErrorMessage(error)}
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-on-surface">Full name</span>
            <input
              type="text"
              name="fullName"
              autoComplete="name"
              placeholder="Nguyen Van A"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="w-full rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 text-base text-on-surface shadow-sm placeholder:text-outline/70 focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-on-surface">
              Email or phone number
            </span>
            <input
              type="text"
              name="identity"
              autoComplete="username"
              placeholder="name@example.com or 0912345678"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="w-full rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 text-base text-on-surface shadow-sm placeholder:text-outline/70 focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-on-surface">Password</span>
            <span className="flex items-center gap-3 rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 shadow-sm focus-within:border-on-tertiary-container focus-within:ring-2 focus-within:ring-on-tertiary-container/20">
              <span className="material-symbols-outlined text-outline">lock</span>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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

          <div className="grid gap-3 rounded-3xl bg-surface-container-low p-4">
            {passwordChecks.map((rule) => (
              <div
                key={rule.key}
                className={`flex items-center gap-3 text-sm ${
                  rule.isValid ? 'text-on-tertiary-container' : 'text-outline'
                }`}
              >
                <span className="material-symbols-outlined text-base">
                  {rule.isValid ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <span>{rule.label}</span>
              </div>
            ))}
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-on-surface">Confirm password</span>
            <span className="flex items-center gap-3 rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 shadow-sm focus-within:border-on-tertiary-container focus-within:ring-2 focus-within:ring-on-tertiary-container/20">
              <span className="material-symbols-outlined text-outline">password</span>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full border-0 bg-transparent p-0 text-base text-on-surface placeholder:text-outline/70 focus:ring-0"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                className="text-outline hover:text-primary"
                aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
              >
                <span className="material-symbols-outlined">
                  {showConfirmPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </span>
            {confirmPassword && !passwordsMatch && (
              <p className="text-sm text-error">Passwords do not match.</p>
            )}
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-outline-variant/40 bg-white/70 px-4 py-3 text-sm text-on-surface-variant">
            <input
              type="checkbox"
              checked={agreeToTerms}
              onChange={(event) => setAgreeToTerms(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-outline-variant text-on-tertiary-container focus:ring-on-tertiary-container"
            />
            <span>
              I agree to the{' '}
              <span className="font-semibold text-on-tertiary-fixed-variant">
                Terms
              </span>{' '}
              and{' '}
              <span className="font-semibold text-on-tertiary-fixed-variant">
                Privacy Policy
              </span>
              .
            </span>
          </label>

          <button
            type="submit"
            disabled={isLoading || !canSubmit}
            className="w-full rounded-full bg-primary px-6 py-4 text-base font-bold text-on-primary shadow-lg shadow-primary/15 hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-body-md text-on-surface-variant">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-bold text-on-tertiary-fixed-variant hover:text-primary"
          >
            Sign in now
          </Link>
        </p>
      </div>
    </AuthShell>
  );
};

export default RegisterPage;
