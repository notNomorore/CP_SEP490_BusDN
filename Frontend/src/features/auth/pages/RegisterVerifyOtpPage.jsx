import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import useAuthStore from '../stores/authStore.js';
import {
  clearPendingRegistrationOtp,
  loadPendingRegistrationOtp,
  updatePendingRegistrationOtp,
} from '../services/registrationOtpSession.js';

const getErrorMessage = (error) => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (Array.isArray(error)) return error.join(', ');
  if (typeof error === 'object') return Object.values(error).flat().join(' ');
  return 'Unable to verify OTP.';
};

const RegisterVerifyOtpPage = () => {
  const navigate = useNavigate();
  const { verifyOTP, resendOtp, isLoading, error, clearError } = useAuthStore();
  const [pendingOtp, setPendingOtp] = useState(() => loadPendingRegistrationOtp());
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isVerified, setIsVerified] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const pending = loadPendingRegistrationOtp();

    if (!pending?.email && !pending?.phone) {
      navigate('/auth/register', { replace: true });
      return;
    }

    setPendingOtp(pending);
    setDevOtp(pending.devOtp || '');
    setOtp(pending.devOtp || '');
    setCountdown(60);
  }, [navigate]);

  useEffect(() => () => clearError(), [clearError]);

  useEffect(() => {
    if (countdown <= 0) return undefined;

    const timer = window.setTimeout(() => {
      setCountdown((value) => Math.max(value - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [countdown]);

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    clearError();

    if (!pendingOtp) return;

    try {
      await verifyOTP({
        email: pendingOtp.email || undefined,
        phone: pendingOtp.phone || undefined,
        otp,
      });

      clearPendingRegistrationOtp();
      setSuccessMessage('OTP verified successfully. Registration completed. Redirecting to login...');
      setIsVerified(true);
      window.setTimeout(() => {
        navigate('/auth/login?registered=1', { replace: true });
      }, 1800);
    } catch {
      // Error state is handled by the store.
    }
  };

  const handleResendOtp = async () => {
    clearError();

    if (!pendingOtp) return;

    try {
      const result = await resendOtp({
        email: pendingOtp.email || undefined,
        phone: pendingOtp.phone || undefined,
      });

      const nextPending = updatePendingRegistrationOtp({
        ...pendingOtp,
        devOtp: result.devOtp || '',
        expiresAt: result.expiresAt || pendingOtp.expiresAt,
      });

      setPendingOtp(nextPending);
      setDevOtp(nextPending.devOtp || '');
      setOtp(nextPending.devOtp || '');
      setCountdown(60);
    } catch {
      // Error state is handled by the store.
    }
  };

  if (isVerified) {
    return (
      <AuthShell
        eyebrow="Account Ready"
        heroTitle="Verification completed successfully."
        heroDescription="Your Veridian Transit account is now active. Continue to sign in and start using the system."
        heroImage="https://lh3.googleusercontent.com/aida-public/AB6AXuAJ0-46nGESJSMPeGRP-CE-D8JvDly9UpS2IuR4ExR-2mfpkgtDbYsnKM8c6LRR3L0WHKPYPHRsorX-jwR_51bHyNx-pdQsiHNm6Nkqs_S01BqkMSvKRfrmqNUp_PUuJay4TeFoy98DeSVH_z0FyUg-RHC7A5UPz00GKKvb9HPAXnE2hIMheiaEk8uTVlk9941sRBm6mVXM16HzsUqeVyVnouuY-DqgDGG6BXU-cr-ZHMX0a_yizZecfMAbRZNJLtA30wee7a6jJfA"
        heroChips={[
          { icon: 'task_alt', label: 'Verified profile' },
          { icon: 'login', label: 'Ready to sign in' }
        ]}
        imagePosition="right"
      >
        <div className="space-y-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-on-tertiary-container/10 text-on-tertiary-container">
            <span className="material-symbols-outlined text-5xl">check_circle</span>
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-headline font-black tracking-tight text-primary">
              Account created
            </h2>
            <p className="text-body-lg text-on-surface-variant">
              {successMessage || 'Your registration is complete. Redirecting to the login page...'}
            </p>
          </div>
          <Link
            to="/auth/login?registered=1"
            className="inline-flex rounded-full bg-primary px-6 py-4 text-base font-bold text-on-primary shadow-lg shadow-primary/15 hover:bg-primary-container"
          >
            Go to Sign In
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Verify Account"
      heroTitle="Confirm the OTP to activate your account."
      heroDescription="Enter the 6-digit code from your inbox or SMS to complete the account verification step."
      heroImage="https://lh3.googleusercontent.com/aida-public/AB6AXuAJ0-46nGESJSMPeGRP-CE-D8JvDly9UpS2IuR4ExR-2mfpkgtDbYsnKM8c6LRR3L0WHKPYPHRsorX-jwR_51bHyNx-pdQsiHNm6Nkqs_S01BqkMSvKRfrmqNUp_PUuJay4TeFoy98DeSVH_z0FyUg-RHC7A5UPz00GKKvb9HPAXnE2hIMheiaEk8uTVlk9941sRBm6mVXM16HzsUqeVyVnouuY-DqgDGG6BXU-cr-ZHMX0a_yizZecfMAbRZNJLtA30wee7a6jJfA"
      heroChips={[
        { icon: 'mail', label: 'Check inbox' },
        { icon: 'sms', label: 'Check phone' }
      ]}
      imagePosition="right"
    >
      <div className="space-y-8">
        <div className="space-y-3">
          <span className="inline-flex rounded-full bg-primary/5 px-3 py-1 text-sm font-semibold text-on-tertiary-fixed-variant">
            Verify OTP
          </span>
          <div>
            <h2 className="text-3xl font-headline font-black tracking-tight text-primary">
              Activate your account
            </h2>
            <p className="mt-2 text-body-lg text-on-surface-variant">
              We sent a 6-digit code to {pendingOtp?.identifier || pendingOtp?.email || pendingOtp?.phone}. Enter it to complete registration.
            </p>
          </div>
        </div>

        {devOtp && (
          <div className="rounded-2xl border border-on-tertiary-container/20 bg-on-tertiary-container/10 px-4 py-3 text-sm text-on-tertiary-fixed-variant">
            Development OTP: <span className="font-bold tracking-[0.25em]">{devOtp}</span>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
            {getErrorMessage(error)}
          </div>
        )}

        <form className="space-y-5" onSubmit={handleVerifyOtp}>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-on-surface">
              Verification code
            </span>
            <input
              type="text"
              name="otp"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              placeholder="000000"
              className="w-full rounded-2xl border border-outline-variant/60 bg-white px-4 py-4 text-center text-2xl font-bold tracking-[0.45em] text-on-surface shadow-sm placeholder:tracking-[0.2em] placeholder:text-outline/70 focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20"
            />
          </label>

          <button
            type="submit"
            disabled={isLoading || otp.length !== 6}
            className="w-full rounded-full bg-primary px-6 py-4 text-base font-bold text-on-primary shadow-lg shadow-primary/15 hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Verifying...' : 'Verify Account'}
          </button>

          <div className="flex items-center justify-between gap-4 text-sm text-on-surface-variant">
            <button
              type="button"
              onClick={() => navigate('/auth/register')}
              className="font-semibold text-secondary hover:text-primary"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={isLoading || countdown > 0}
              className="font-semibold text-on-tertiary-fixed-variant hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
            </button>
          </div>
        </form>
      </div>
    </AuthShell>
  );
};

export default RegisterVerifyOtpPage;
