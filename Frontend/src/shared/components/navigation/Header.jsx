import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../../../features/auth/stores/authStore.js';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isAdmin, logout } = useAuthStore();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Ticket History', href: '/my-tickets' },
    { label: 'Travel History', href: '/travel-history' },
    { label: 'Submit Feedback', href: '/submit-feedback' },
    { label: 'Report Lost Item', href: '/report-lost-item' },
    { label: 'Lost Item Status', href: '/lost-item-cases' },
    { label: 'Become a Partner', href: '#' },
    { label: 'Routes', href: '/search' },
    { label: 'Help', href: '#' }
  ];

  const authCta =
    location.pathname === '/auth/register'
      ? { label: 'Sign In', path: '/auth/login' }
      : location.pathname === '/auth/login'
        ? { label: 'Create Account', path: '/auth/register' }
        : { label: 'Sign In', path: '/auth/login' };

  const displayName = user?.fullName?.trim() || 'Passenger';
  const profileInitial = displayName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'glass-nav shadow-2xl shadow-primary/20'
          : 'bg-primary shadow-2xl shadow-primary/20'
      }`}
    >
      <div className="flex justify-between items-center w-full px-6 py-4 max-w-screen-2xl mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <button
            onClick={() => navigate('/')}
            className="text-2xl font-display font-black tracking-tight text-surface-bright hover:opacity-90 transition-opacity"
          >
            Veridian Transit
          </button>

          {/* Navigation - Hidden on mobile */}
          <nav className="hidden lg:flex items-center gap-6">
            {navLinks.map((link, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (link.href !== '#') {
                    navigate(link.href);
                  }
                }}
                className={`text-label-md font-body transition-all ${
                  location.pathname === link.href
                    ? 'text-tertiary-fixed font-bold border-b-2 border-tertiary-fixed pb-1'
                    : 'text-surface-variant/80 hover:text-surface-bright hover:bg-primary-container/50 px-2 py-1 rounded'
                }`}
              >
                {link.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4 text-on-primary">
          {/* Support Info - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-4 mr-4">
            <span className="text-label-md font-body opacity-80">Hotline 24/7</span>
            <span className="material-symbols-outlined text-surface-bright">
              language
            </span>
            <span className="material-symbols-outlined text-surface-bright">
              help_outline
            </span>
          </div>

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              {isAdmin() ? (
                <>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/priority-verification')}
                    className="hidden rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-surface-bright hover:bg-white/10 lg:inline-flex"
                  >
                    Verify Profiles
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/customer-support')}
                    className="hidden rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-surface-bright hover:bg-white/10 lg:inline-flex"
                  >
                    Customer Support
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/priority-profile')}
                  className="hidden rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-surface-bright hover:bg-white/10 lg:inline-flex"
                >
                  Priority Profile
                </button>
              )}

              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-left text-surface-bright backdrop-blur-md hover:bg-white/15"
                aria-label="Current user profile"
              >
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={displayName}
                    className="h-10 w-10 rounded-full object-cover border border-white/20"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-on-tertiary-container font-bold text-primary">
                    {profileInitial}
                  </span>
                )}
                <span className="hidden md:flex flex-col">
                  <span className="text-xs uppercase tracking-[0.2em] text-surface-variant/70">
                    Signed in
                  </span>
                  <span className="text-sm font-semibold text-surface-bright">
                    {displayName}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-surface-bright hover:bg-white/10"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate(authCta.path)}
              className="bg-on-tertiary-container text-primary font-bold px-6 py-2 rounded-full active:scale-95 transition-transform hover:shadow-lg"
            >
              {authCta.label}
            </button>
          )}
        </div>
      </div>

      <style>{`
        .glass-nav {
          backdrop-filter: blur(12px);
          background-color: rgba(0, 26, 15, 0.85);
        }
      `}</style>
    </header>
  );
};

export default Header;
