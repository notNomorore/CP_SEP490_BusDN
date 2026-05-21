import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
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
    return Object.values(error).flat().join(' ');
  }

  return 'Unable to complete sign in.';
};

const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (searchParams.get('registered') === '1') {
      setMessage('Registration completed. You can sign in now.');
    }
  }, [searchParams]);

  useEffect(() => () => clearError(), [clearError]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearError();

    try {
      await login(identifier.trim(), password);
    } catch {
      // Error state is handled by the store.
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome Back"
      heroTitle="Your next ride starts with one secure sign-in."
      heroDescription="Continue your Veridian Transit journey with faster booking access, route history, and support tools kept in one place."
      heroImage="https://lh3.googleusercontent.com/aida-public/AB6AXuD7rt0_hvCv7aGG4-oCaa9u-tKEzia1J8kBU6-3dCQYwxSrvgsbzWmL15b7fbNop_dnnYNXhqbgoVMbgHfrowGfdNsnbCMBrWyF1G1Zsyg_EjBKUAlJF-hyi7oDmsHrdQlzG-4PNwVUf5mU2UxqdG_kUTAgSlj0b-Am-plOE3ikrkdVN1i58KFHFQVsR0XjaITv54utBo3c2uJndkGIywZ2s03FSLGk9vAUAyYhEbr9OqXtRSzIqbPBckaBha_gyV0GZibVzdfl4CM"
      heroChips={[
        { icon: 'speed', label: 'Fast boarding access' },
        { icon: 'shield_lock', label: 'Protected account' }
      ]}
    >
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
              Enter your email or phone number to continue to your bookings and transit tools.
            </p>
          </div>
        </div>

        {message && (
          <div className="rounded-2xl border border-on-tertiary-container/20 bg-on-tertiary-container/10 px-4 py-3 text-sm text-on-tertiary-fixed-variant">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
            {getErrorMessage(error)}
          </div>
        )}

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
                onChange={(event) => setIdentifier(event.target.value)}
                className="w-full border-0 bg-transparent p-0 text-base text-on-surface placeholder:text-outline/70 focus:ring-0"
              />
            </span>
          </label>

          <label className="block space-y-2">
            <span className="flex items-center justify-between text-sm font-semibold text-on-surface">
              <span>Password</span>
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-outline">
                Secure auth
              </span>
            </span>
            <span className="flex items-center gap-3 rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 shadow-sm focus-within:border-on-tertiary-container focus-within:ring-2 focus-within:ring-on-tertiary-container/20">
              <span className="material-symbols-outlined text-outline">lock</span>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
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
            disabled={isLoading || !identifier.trim() || !password}
            className="w-full rounded-full bg-primary px-6 py-4 text-base font-bold text-on-primary shadow-lg shadow-primary/15 hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-body-md text-on-surface-variant">
          New to Veridian Transit?{' '}
          <Link
            to="/register"
            className="font-bold text-on-tertiary-fixed-variant hover:text-primary"
          >
            Create an account
          </Link>
        </p>
      </div>
    </AuthShell>
  );
};

export default LoginPage;
