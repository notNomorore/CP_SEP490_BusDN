import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../../../features/auth/stores/authStore.js';
import useTheme from '../../hooks/useTheme.js';

const Header = ({ forceDarkMode = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isAdmin, logout } = useAuthStore();
  const { isDarkMode, toggleTheme } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const effectiveDarkMode = forceDarkMode || isDarkMode;
  const canAccessAdmin = isAdmin();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Manage Booking', href: '#' },
    { label: 'Become a Partner', href: '#' },
    { label: 'Routes', href: '/search' },
    { label: 'Help', href: '#' },
  ];

  const authCta =
    location.pathname === '/auth/register' || location.pathname === '/register'
      ? { label: 'Sign In', path: '/auth/login' }
      : { label: 'Create Account', path: '/auth/register' };

  const displayName = user?.fullName?.trim() || 'Hanh khach';
  const profileInitial = displayName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        effectiveDarkMode
          ? (
            isScrolled
              ? 'glass-nav-dark shadow-2xl shadow-primary/20'
              : 'bg-primary shadow-2xl shadow-primary/20'
          )
          : (
            isScrolled
              ? 'glass-nav-light shadow-xl shadow-slate-300/30'
              : 'bg-white/95 shadow-lg shadow-slate-300/20'
          )
      }`}
    >
      <div className="flex justify-between items-center w-full px-6 py-4 max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-8">
          <button
            type="button"
            onClick={() => navigate('/')}
            className={`text-2xl font-display font-black tracking-tight transition-opacity hover:opacity-90 ${
              effectiveDarkMode ? 'text-surface-bright' : 'text-slate-900'
            }`}
          >
            Veridian Transit
          </button>

          <nav className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) => (
              <button
                key={link.label}
                type="button"
                onClick={() => {
                  if (link.href !== '#') {
                    navigate(link.href);
                  }
                }}
                className={`text-label-md font-body transition-all ${
                  location.pathname === link.href
                    ? `${effectiveDarkMode ? 'text-tertiary-fixed border-tertiary-fixed' : 'text-emerald-700 border-emerald-500'} font-bold border-b-2 pb-1`
                    : `${effectiveDarkMode ? 'text-surface-variant/80 hover:text-surface-bright hover:bg-primary-container/50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'} px-2 py-1 rounded`
                }`}
              >
                {link.label}
              </button>
            ))}
          </nav>
        </div>

        <div className={`flex items-center gap-4 ${effectiveDarkMode ? 'text-on-primary' : 'text-slate-700'}`}>
          <div className="hidden md:flex items-center gap-4 mr-4">
            <span className="text-label-md font-body opacity-80">Hotline 24/7</span>
            <button
              type="button"
              onClick={toggleTheme}
              className={`rounded-full border p-2 transition-colors ${
                effectiveDarkMode
                  ? 'border-white/10 bg-white/5 text-surface-bright hover:bg-white/10'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isDarkMode ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
            <span className={`material-symbols-outlined ${effectiveDarkMode ? 'text-surface-bright' : 'text-slate-600'}`}>
              language
            </span>
            <span className={`material-symbols-outlined ${effectiveDarkMode ? 'text-surface-bright' : 'text-slate-600'}`}>
              help_outline
            </span>
          </div>

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              {canAccessAdmin ? (
                <>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/priority-verification')}
                    className={`hidden rounded-full border px-4 py-2 text-sm font-semibold lg:inline-flex ${
                      location.pathname === '/admin/priority-verification'
                        ? 'border-emerald-300 bg-emerald-300 text-slate-950'
                        : effectiveDarkMode
                          ? 'border-white/10 text-surface-bright hover:bg-white/10'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Verify Profiles
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/customer-support')}
                    className={`hidden rounded-full border px-4 py-2 text-sm font-semibold lg:inline-flex ${
                      location.pathname === '/admin/customer-support'
                        ? 'border-emerald-300 bg-emerald-300 text-slate-950'
                        : effectiveDarkMode
                          ? 'border-white/10 text-surface-bright hover:bg-white/10'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Customer Support
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/routes')}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                      location.pathname === '/admin/routes'
                        ? 'border-emerald-300 bg-emerald-300 text-slate-950'
                        : effectiveDarkMode
                          ? 'border-white/10 text-surface-bright hover:bg-white/10'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Route Control
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/users')}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                      location.pathname === '/admin/users'
                        ? 'border-emerald-300 bg-emerald-300 text-slate-950'
                        : effectiveDarkMode
                          ? 'border-white/10 text-surface-bright hover:bg-white/10'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Accounts
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/priority-profile')}
                  className={`hidden rounded-full border px-4 py-2 text-sm font-semibold lg:inline-flex ${
                    effectiveDarkMode
                      ? 'border-white/10 text-surface-bright hover:bg-white/10'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Priority Profile
                </button>
              )}

              <button
                type="button"
                onClick={() => navigate('/profile')}
                className={`flex items-center gap-3 rounded-full border px-3 py-2 text-left backdrop-blur-md ${
                  effectiveDarkMode
                    ? 'border-white/10 bg-white/10 text-surface-bright hover:bg-white/15'
                    : 'border-slate-200 bg-white/80 text-slate-800 hover:bg-white'
                }`}
                aria-label="Current user profile"
              >
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={displayName}
                    className={`h-10 w-10 rounded-full object-cover ${effectiveDarkMode ? 'border border-white/20' : 'border border-slate-200'}`}
                  />
                ) : (
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${
                    effectiveDarkMode ? 'bg-on-tertiary-container text-primary' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {profileInitial}
                  </span>
                )}
                <span className="hidden md:flex flex-col">
                  <span className={`text-xs uppercase tracking-[0.2em] ${effectiveDarkMode ? 'text-surface-variant/70' : 'text-slate-500'}`}>
                    Signed in
                  </span>
                  <span className={`text-sm font-semibold ${effectiveDarkMode ? 'text-surface-bright' : 'text-slate-900'}`}>
                    {displayName}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                  effectiveDarkMode
                    ? 'border-white/10 text-surface-bright hover:bg-white/10'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => navigate(authCta.path)}
              className={`font-bold px-6 py-2 rounded-full active:scale-95 transition-transform hover:shadow-lg ${
                effectiveDarkMode
                  ? 'bg-on-tertiary-container text-primary'
                  : 'bg-emerald-500 text-white'
              }`}
            >
              {authCta.label}
            </button>
          )}
        </div>
      </div>

      <style>{`
        .glass-nav-dark {
          backdrop-filter: blur(12px);
          background-color: rgba(0, 26, 15, 0.85);
        }
        .glass-nav-light {
          backdrop-filter: blur(12px);
          background-color: rgba(255, 255, 255, 0.86);
        }
      `}</style>
    </header>
  );
};

export default Header;
