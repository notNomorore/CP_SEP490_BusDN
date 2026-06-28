import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../../../features/auth/stores/authStore.js';
import useAdminI18n from '../../i18n/adminI18n.js';
import apiClient from '../../services/apiClient.js';
import useTheme from '../../hooks/useTheme.js';
import getRoleLandingPath from '../../../features/auth/utils/roleRedirect.js';

const Header = ({ forceDarkMode = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isAdmin, isDriver, isBusAssistant, logout } = useAuthStore();
  const { language, toggleLanguage, t } = useAdminI18n();
  const [isScrolled, setIsScrolled] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isDarkMode } = useTheme();
  const effectiveDarkMode = forceDarkMode || isDarkMode;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { key: 'passenger.nav.manageBooking', path: '/profile', requiresAuth: true },
    { key: 'passenger.nav.promotions', path: '/admin/promotions', requiresAuth: true, adminOnly: true },
    { key: 'passenger.nav.revenue', path: '/admin/revenue', requiresAuth: true, adminOnly: true },
    { key: 'passenger.nav.walkIn', path: '/admin/walkin-tickets', requiresAuth: true, adminOnly: true },
    { key: 'passenger.nav.compliance', path: '/admin/passenger-compliance', requiresAuth: true, adminOnly: true },
    { key: 'passenger.nav.analytics', path: '/admin/analytics/route-efficiency', requiresAuth: true, adminOnly: true },
    { key: 'passenger.nav.incidents', path: '/admin/incidents', requiresAuth: true, adminOnly: true },
    { key: 'passenger.nav.monitoring', path: '/admin/system-monitoring', requiresAuth: true, adminOnly: true },
    { key: 'passenger.nav.partner', href: '/#partners', hideForAdmin: true },
    { key: 'passenger.nav.routes', path: '/search', hideForAdmin: true },
    { key: 'passenger.nav.tickets', label: 'My Tickets', path: '/my-tickets', requiresAuth: true, hideForAdmin: true },
    { key: 'passenger.nav.history', label: 'Travel History', path: '/travel-history', requiresAuth: true, hideForAdmin: true },
    { key: 'passenger.nav.feedback', label: 'Submit Feedback', path: '/submit-feedback', requiresAuth: true, hideForAdmin: true },
    { key: 'passenger.nav.myFeedback', label: 'My Feedback', path: '/my-feedback', requiresAuth: true, hideForAdmin: true },
    { key: 'passenger.nav.reportLostItem', label: 'Report Lost Item', path: '/report-lost-item', requiresAuth: true, hideForAdmin: true },
    { key: 'passenger.nav.lostItems', label: 'Lost Items', path: '/lost-item-cases', requiresAuth: true, hideForAdmin: true },
    { key: 'passenger.nav.help', href: '/#support', hideForAdmin: true }
  ].filter((link) => (!link.adminOnly || isAdmin()) && (!link.hideForAdmin || !isAdmin()));

  const isLoginPage = location.pathname === '/auth/login' || location.pathname === '/login';
  const authCta = isLoginPage
    ? { label: 'Create Account', path: '/auth/register' }
    : { label: 'Sign In', path: '/auth/login' };

  const displayName = user?.fullName?.trim() || t('passenger.fallbackName');
  const profileInitial = displayName.charAt(0).toUpperCase();
  const nextLanguageLabel = t('admin.header.switchLanguage');
  const isOperationsUser = isAuthenticated && (isDriver() || isBusAssistant());
  const unreadNotificationCount = notifications.filter((notification) => !notification.isRead).length;
  const primaryTextClass = effectiveDarkMode ? 'text-surface-bright' : 'text-primary';
  const secondaryTextClass = effectiveDarkMode ? 'text-surface-variant/80' : 'text-on-surface-variant';
  const subtleControlClass = effectiveDarkMode
    ? 'border-white/10 bg-white/10 text-surface-bright hover:bg-white/15'
    : 'border-outline-variant/60 bg-white text-primary hover:bg-surface-container-low';

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (!isOperationsUser) {
      setNotifications([]);
      setIsNotificationsOpen(false);
      setSelectedNotification(null);
      return undefined;
    }

    let isMounted = true;

    const loadNotifications = async () => {
      try {
        const response = await apiClient.get('/schedule-operations/operation-notifications');
        if (isMounted) {
          setNotifications(response.data?.notifications || []);
        }
      } catch {
        if (isMounted) {
          setNotifications([]);
        }
      }
    };

    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 60000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [isOperationsUser]);

  const formatNotificationTime = (value) => {
    if (!value) return '';

    try {
      return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value));
    } catch {
      return '';
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleBrandClick = () => {
    navigate(getRoleLandingPath(user));
  };

  const handleNavClick = (event, link) => {
    if (!link.path) {
      return;
    }

    event.preventDefault();
    if (link.requiresAuth && !isAuthenticated) {
      navigate('/auth/login');
      return;
    }

    if (link.adminOnly && !isAdmin()) {
      navigate('/');
      return;
    }

    navigate(link.path);
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
            onClick={handleBrandClick}
            className={`text-2xl font-display font-black tracking-tight hover:opacity-80 ${primaryTextClass}`}
            type="button"
          >
            BusDN
          </button>

          {/* Navigation - Hidden on mobile */}
          <nav className="hidden lg:flex items-center gap-4">
            {navLinks.map((link) => {
              const isActive = link.path && location.pathname.startsWith(link.path);

              return (
                <a
                  key={link.key}
                  href={link.path || link.href}
                  onClick={(event) => handleNavClick(event, link)}
                  className={`text-label-md font-body transition-all ${
                    isActive
                      ? effectiveDarkMode
                        ? 'border-b-2 border-tertiary-fixed pb-1 font-bold text-tertiary-fixed'
                        : 'border-b-2 border-primary pb-1 font-bold text-primary'
                      : `${secondaryTextClass} rounded-lg px-2 py-1 hover:bg-surface-container-low/80 hover:text-primary`
                  }`}
                >
                  {link.label || t(link.key)}
                </a>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4 text-on-primary">
          <div className="hidden md:flex items-center gap-4 mr-4">
            <span className={`text-label-md font-body ${secondaryTextClass}`}>{t('passenger.header.hotline')}</span>
            <button
              type="button"
              onClick={toggleLanguage}
              title={nextLanguageLabel}
              aria-label={nextLanguageLabel}
              className={`inline-flex h-10 min-w-14 items-center justify-center rounded-full border px-3 text-sm font-black ${subtleControlClass}`}
            >
              {language === 'en' ? 'EN' : 'VN'}
            </button>
            <span className={`material-symbols-outlined ${primaryTextClass}`} aria-hidden="true">
              help_outline
            </span>
          </div>

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              {isAdmin() ? (
                <>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/routes')}
                    className="hidden rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-surface-bright hover:bg-white/10 xl:inline-flex"
                  >
                    Route Management
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/users')}
                    className="hidden rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-surface-bright hover:bg-white/10 xl:inline-flex"
                  >
                    User Accounts
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/priority-verification')}
                    className="hidden rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-surface-bright hover:bg-white/10 xl:inline-flex"
                  >
                    Verify Profiles
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/customer-support')}
                    className="hidden rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-surface-bright hover:bg-white/10 xl:inline-flex"
                  >
                    Customer Support
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/routes')}
                    className={`hidden rounded-full border px-4 py-2 text-sm font-semibold xl:inline-flex ${
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
                    className={`hidden rounded-full border px-4 py-2 text-sm font-semibold xl:inline-flex ${
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
              ) : isDriver() || isBusAssistant() ? (
                <>
                  {isBusAssistant() ? (
                    <button
                      type="button"
                      onClick={() => navigate('/bus-assistant/validate-ticket')}
                      className="hidden rounded-full border border-emerald-300 bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-200 lg:inline-flex"
                    >
                      Bus Assistant
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => navigate(isBusAssistant() ? '/bus-assistant/shift-revenue' : '/operations/schedule')}
                    className={`hidden rounded-full border px-4 py-2 text-sm font-semibold lg:inline-flex ${subtleControlClass}`}
                  >
                    {isBusAssistant() ? 'Shift Revenue' : 'Operations Schedule'}
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setIsNotificationsOpen((current) => !current);
                        setSelectedNotification(null);
                      }}
                      className={`relative inline-flex h-11 w-11 items-center justify-center rounded-full border ${subtleControlClass}`}
                      aria-label={t('passenger.header.notifications')}
                    >
                      <span className="material-symbols-outlined text-[22px]">notifications</span>
                      {unreadNotificationCount > 0 ? (
                        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                          {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                        </span>
                      ) : null}
                    </button>

                    {isNotificationsOpen ? (
                      <div className="absolute right-0 top-14 z-[60] w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/15 bg-white text-slate-950 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                          <div>
                            <p className="text-sm font-black">Thông báo vận hành</p>
                            <p className="text-xs text-slate-500">
                              {notifications.length} thông báo từ điều hành
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => navigate('/operations/schedule')}
                            className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                          >
                            Lịch chạy
                          </button>
                        </div>

                        <div className="max-h-[360px] overflow-y-auto">
                          {!notifications.length ? (
                            <div className="px-4 py-8 text-center text-sm text-slate-500">
                              Chưa có thông báo vận hành.
                            </div>
                          ) : notifications.map((notification) => (
                            <button
                              key={notification.id}
                              type="button"
                              onClick={() => setSelectedNotification(notification)}
                              className={`block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-emerald-50 ${
                                selectedNotification?.id === notification.id ? 'bg-emerald-50' : 'bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="line-clamp-1 text-sm font-black text-slate-950">
                                  {notification.title}
                                </span>
                                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                  {notification.priority || 'NORMAL'}
                                </span>
                              </div>
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                                {notification.message}
                              </p>
                              <p className="mt-2 text-[11px] font-semibold text-slate-400">
                                {formatNotificationTime(notification.createdAt || notification.activeFrom)}
                              </p>
                            </button>
                          ))}
                        </div>

                        {selectedNotification ? (
                          <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                              Chi tiết
                            </p>
                            <h4 className="mt-1 text-sm font-black text-slate-950">
                              {selectedNotification.title}
                            </h4>
                            <p className="mt-2 text-sm leading-6 text-slate-700">
                              {selectedNotification.message}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}

              <button
                type="button"
                onClick={() => navigate('/profile')}
                className={`flex items-center gap-3 rounded-full border px-3 py-2 text-left backdrop-blur-md ${
                  effectiveDarkMode
                    ? 'border-white/10 bg-white/10 text-surface-bright hover:bg-white/15'
                    : 'border-slate-200 bg-white/80 text-slate-800 hover:bg-white'
                }`}
                aria-label={t('passenger.header.profile')}
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
                    {t('passenger.header.signedIn')}
                  </span>
                  <span className={`text-sm font-semibold ${effectiveDarkMode ? 'text-surface-bright' : 'text-slate-900'}`}>
                    {displayName}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                title={t('passenger.header.signOut')}
                aria-label={t('passenger.header.signOut')}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full border ${
                  effectiveDarkMode
                    ? 'border-white/10 text-surface-bright hover:bg-white/10'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">logout</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => navigate(authCta.path)}
              className="rounded-full bg-on-tertiary-container px-4 py-2 font-bold text-primary hover:shadow-lg sm:px-6"
            >
              {t(authCta.key)}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((current) => !current)}
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border lg:hidden ${subtleControlClass}`}
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-primary-navigation"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {isMobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {isMobileMenuOpen ? (
        <div
          id="mobile-primary-navigation"
          className={`border-t px-4 pb-5 pt-3 lg:hidden ${
            effectiveDarkMode
              ? 'border-white/10 bg-primary/95'
              : 'border-outline-variant/40 bg-white/95'
          }`}
        >
          <nav aria-label="Mobile primary navigation" className="mx-auto grid max-w-screen-2xl gap-1">
            {navLinks.map((link) => {
              const isActive = link.path && location.pathname.startsWith(link.path);
              const itemClassName = `flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold ${
                isActive
                  ? 'bg-on-tertiary-container text-primary'
                  : effectiveDarkMode
                    ? 'text-surface-bright hover:bg-white/10'
                    : 'text-on-surface hover:bg-surface-container-low'
              }`;

              return link.path ? (
                <button
                  key={link.key}
                  type="button"
                  onClick={(event) => handleNavClick(event, link)}
                  className={`${itemClassName} w-full text-left`}
                >
                  {link.label || t(link.key)}
                </button>
              ) : (
                <a key={link.key} href={link.href} className={itemClassName}>
                  {link.label || t(link.key)}
                </a>
              );
            })}
            <button
              type="button"
              onClick={toggleLanguage}
              className={`mt-2 flex min-h-11 items-center justify-between rounded-xl border px-4 text-sm font-semibold ${subtleControlClass}`}
            >
              <span>{nextLanguageLabel}</span>
              <span className="font-black">{language === 'en' ? 'EN' : 'VN'}</span>
            </button>
          </nav>
        </div>
      ) : null}

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
