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
  const { language } = useAdminI18n();
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
    { key: 'passenger.nav.manageBooking', label: 'Hồ sơ', path: '/profile', requiresAuth: true },
    { key: 'passenger.nav.promotions', label: 'Khuyến mãi', path: '/admin/promotions', requiresAuth: true, adminOnly: true },
    { key: 'passenger.nav.revenue', label: 'Doanh thu', path: '/admin/revenue', requiresAuth: true, adminOnly: true },
    { key: 'passenger.nav.walkIn', label: 'Vé tại quầy', path: '/admin/walkin-tickets', requiresAuth: true, adminOnly: true },
    { key: 'passenger.nav.compliance', label: 'Tuân thủ', path: '/admin/passenger-compliance', requiresAuth: true, adminOnly: true },
    { key: 'passenger.nav.analytics', label: 'Phân tích', path: '/admin/analytics/route-efficiency', requiresAuth: true, adminOnly: true },
    { key: 'passenger.nav.incidents', label: 'Sự cố', path: '/admin/incidents', requiresAuth: true, adminOnly: true },
    { key: 'passenger.nav.monitoring', label: 'Giám sát', path: '/admin/system-monitoring', requiresAuth: true, adminOnly: true },
    { key: 'passenger.nav.partner', label: 'Đối tác', href: '/#partners', hideForAdmin: true },
    { key: 'passenger.nav.routes', label: 'Tuyến xe', path: '/search', hideForAdmin: true },
    {
      key: 'passenger.nav.buyTickets',
      label: 'Mua vé',
      path: '/tickets/purchase',
      activePaths: ['/tickets/purchase', '/tickets/checkout', '/payment/success', '/payment/failed'],
      requiresAuth: true,
      hideForAdmin: true,
    },
    { key: 'passenger.nav.tickets', label: 'Vé của tôi', path: '/my-tickets', requiresAuth: true, hideForAdmin: true },
    { key: 'passenger.nav.transactions', label: 'Lịch sử giao dịch', path: '/transactions', requiresAuth: true, hideForAdmin: true },
    { key: 'passenger.nav.history', label: 'Lịch sử', path: '/travel-history', requiresAuth: true, hideForAdmin: true },
    { key: 'passenger.nav.feedback', label: 'Góp ý', path: '/submit-feedback', requiresAuth: true, hideForAdmin: true },
    { key: 'passenger.nav.myFeedback', label: 'Góp ý của tôi', path: '/my-feedback', requiresAuth: true, hideForAdmin: true },
    { key: 'passenger.nav.reportLostItem', label: 'Báo mất đồ', path: '/report-lost-item', requiresAuth: true, hideForAdmin: true },
    { key: 'passenger.nav.lostItems', label: 'Đồ thất lạc', path: '/lost-item-cases', requiresAuth: true, hideForAdmin: true },
    { key: 'passenger.nav.help', label: 'Trợ giúp', href: '/#support', hideForAdmin: true }
  ].filter((link) => (!link.adminOnly || isAdmin()) && (!link.hideForAdmin || !isAdmin()));

  const isLoginPage = location.pathname === '/auth/login' || location.pathname === '/login';
  const authCta = isLoginPage
    ? { label: 'Tạo tài khoản', path: '/auth/register' }
    : { label: 'Đăng nhập', path: '/auth/login' };

  const displayName = user?.fullName?.trim() || 'Hành khách';
  const profileInitial = displayName.charAt(0).toUpperCase();
  const isOperationsUser = isAuthenticated && (isDriver() || isBusAssistant());
  const isNotificationUser = isAuthenticated && !isAdmin();
  const unreadNotificationCount = notifications.filter((notification) => !notification.isRead).length;
  const primaryTextClass = effectiveDarkMode ? 'text-surface-bright' : 'text-primary';
  const secondaryTextClass = effectiveDarkMode ? 'text-surface-variant/80' : 'text-on-surface-variant';
  const subtleControlClass = effectiveDarkMode
    ? 'border-white/10 bg-white/10 text-surface-bright hover:bg-white/15'
    : 'border-outline-variant/60 bg-white text-primary hover:bg-surface-container-low';
  const hiddenPassengerNavKeys = new Set([
    'passenger.nav.manageBooking',
    'passenger.nav.partner',
    'passenger.nav.help',
  ]);
  const publicNavKeys = new Set([
    'passenger.nav.routes',
    'passenger.nav.buyTickets',
  ]);
  const mobileNavLinks = navLinks.filter((link) => {
    if (hiddenPassengerNavKeys.has(link.key)) {
      return false;
    }

    if (!isAuthenticated && !isAdmin()) {
      return publicNavKeys.has(link.key);
    }

    return true;
  });
  const desktopNavLinks = mobileNavLinks;

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
    if (!isNotificationUser) {
      setNotifications([]);
      setIsNotificationsOpen(false);
      setSelectedNotification(null);
      return undefined;
    }

    let isMounted = true;

    const loadNotifications = async () => {
      try {
        const response = isOperationsUser
          ? await apiClient.get('/schedule-operations/operation-notifications')
          : await apiClient.get('/notifications/me');
        if (isMounted) {
          setNotifications(response.data?.notifications || response.data || []);
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
  }, [isNotificationUser, isOperationsUser]);

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

  const copyPromotionCode = async (code) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Clipboard support is best-effort; the code is still visible in the notification.
    }
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

    setIsMobileMenuOpen(false);
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
      <div className={`mx-auto flex h-[72px] w-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 ${
        isAuthenticated ? 'max-w-screen-2xl' : 'max-w-5xl'
      }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <button
            onClick={handleBrandClick}
            className={`shrink-0 text-2xl font-display font-black tracking-tight hover:opacity-80 ${primaryTextClass}`}
            type="button"
          >
            BusDN
          </button>

          {/* Navigation - Hidden on mobile */}
          <nav className={`hidden min-w-0 items-center gap-1 overflow-hidden rounded-full border border-outline-variant/30 bg-white/70 p-1 shadow-sm shadow-slate-200/50 backdrop-blur lg:flex ${
            isAuthenticated
              ? 'flex-1 justify-center'
              : 'w-auto justify-center'
          }`}
          >
            {desktopNavLinks.map((link) => {
              const isActive = link.path && (
                location.pathname.startsWith(link.path)
                || link.activePaths?.some((path) => location.pathname.startsWith(path))
              );

              return (
                <a
                  key={link.key}
                  href={link.path || link.href}
                  onClick={(event) => handleNavClick(event, link)}
                  className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[12px] font-bold transition-all xl:px-3 ${
                    isActive
                      ? 'bg-primary text-white shadow-sm shadow-primary/20'
                      : `${secondaryTextClass} hover:bg-white hover:text-primary`
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-on-primary">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              {isAdmin() ? (
                <>
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
                    Tuyến xe
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
                    Tài khoản
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
                      Phụ xe
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => navigate(isBusAssistant() ? '/bus-assistant/shift-revenue' : '/operations/schedule')}
                    className={`hidden rounded-full border px-4 py-2 text-sm font-semibold lg:inline-flex ${subtleControlClass}`}
                  >
                    {isBusAssistant() ? 'Doanh thu ca' : 'Lịch vận hành'}
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setIsNotificationsOpen((current) => !current);
                        setSelectedNotification(null);
                      }}
                      className={`relative inline-flex h-11 w-11 items-center justify-center rounded-full border ${subtleControlClass}`}
                      aria-label="Thông báo"
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
                            {selectedNotification.promotionCode ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => copyPromotionCode(selectedNotification.promotionCode)}
                                  className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-50"
                                >
                                  Sao chép {selectedNotification.promotionCode}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => navigate(selectedNotification.actionUrl || '/tickets/purchase')}
                                  className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                                >
                                  Dùng mã
                                </button>
                              </div>
                            ) : null}
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
                    Hồ sơ ưu tiên
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setIsNotificationsOpen((current) => !current);
                        setSelectedNotification(null);
                      }}
                      className={`relative inline-flex h-11 w-11 items-center justify-center rounded-full border ${subtleControlClass}`}
                      aria-label="Thông báo"
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
                        <div className="border-b border-slate-100 px-4 py-3">
                          <p className="text-sm font-black">Thông báo</p>
                          <p className="text-xs text-slate-500">{notifications.length} thông báo</p>
                        </div>

                        <div className="max-h-[360px] overflow-y-auto">
                          {!notifications.length ? (
                            <div className="px-4 py-8 text-center text-sm text-slate-500">
                              Chưa có thông báo.
                            </div>
                          ) : notifications.map((notification) => (
                            <button
                              key={notification.id || notification._id}
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
                                  {notification.type || notification.priority || 'INFO'}
                                </span>
                              </div>
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                                {notification.message}
                              </p>
                              <p className="mt-2 text-[11px] font-semibold text-slate-400">
                                {formatNotificationTime(notification.deliverySummary?.sentAt || notification.createdAt)}
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
                            {selectedNotification.promotionCode ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => copyPromotionCode(selectedNotification.promotionCode)}
                                  className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-50"
                                >
                                  Sao chép {selectedNotification.promotionCode}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => navigate(selectedNotification.actionUrl || '/tickets/purchase')}
                                  className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                                >
                                  Dùng mã
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={() => navigate('/profile')}
                className={`flex h-12 items-center gap-2 rounded-full border px-2.5 text-left backdrop-blur-md ${
                  effectiveDarkMode
                    ? 'border-white/10 bg-white/10 text-surface-bright hover:bg-white/15'
                    : 'border-slate-200 bg-white/80 text-slate-800 hover:bg-white'
                }`}
                aria-label="Hồ sơ"
              >
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={displayName}
                    className={`h-9 w-9 rounded-full object-cover ${effectiveDarkMode ? 'border border-white/20' : 'border border-slate-200'}`}
                  />
                ) : (
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full font-bold ${
                    effectiveDarkMode ? 'bg-on-tertiary-container text-primary' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {profileInitial}
                  </span>
                )}
                <span className="hidden max-w-36 flex-col xl:flex">
                  <span className={`text-[10px] uppercase tracking-[0.16em] ${effectiveDarkMode ? 'text-surface-variant/70' : 'text-slate-500'}`}>
                    Đã đăng nhập
                  </span>
                  <span className={`truncate text-sm font-bold ${effectiveDarkMode ? 'text-surface-bright' : 'text-slate-900'}`}>
                    {displayName}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                title="Đăng xuất"
                aria-label="Đăng xuất"
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
              className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-sm shadow-emerald-900/10 transition-all hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-900/15 sm:px-6"
            >
              {authCta.label}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((current) => !current)}
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border lg:hidden ${subtleControlClass}`}
            aria-label={isMobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
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
          <nav aria-label="Điều hướng chính trên di động" className="mx-auto grid max-w-screen-2xl gap-1">
            {mobileNavLinks.map((link) => {
              const isActive = link.path && (
                location.pathname.startsWith(link.path)
                || link.activePaths?.some((path) => location.pathname.startsWith(path))
              );
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
                  {link.label}
                </button>
              ) : (
                <a key={link.key} href={link.href} className={itemClassName}>
                  {link.label}
                </a>
              );
            })}
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
