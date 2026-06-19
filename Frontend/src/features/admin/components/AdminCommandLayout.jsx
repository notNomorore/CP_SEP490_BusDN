import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../../auth/stores/authStore.js';
import useAdminI18n, { getAdminMessage } from '../../../shared/i18n/adminI18n.js';
import { adminNavigation } from '../../../shared/i18n/adminMessages.js';

const AdminCommandLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { language, toggleLanguage, t } = useAdminI18n();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const displayName = user?.fullName?.trim() || 'Admin';
  const initial = displayName.charAt(0).toUpperCase();

  const activeItem = useMemo(() => {
    return [...adminNavigation]
      .sort((left, right) => right.path.length - left.path.length)
      .find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`))
      || adminNavigation[0];
  }, [location.pathname]);

  const visibleNavigation = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return adminNavigation;
    return adminNavigation.filter((item) => (
      getAdminMessage('vi', item.key).toLowerCase().includes(keyword)
      || getAdminMessage('en', item.key).toLowerCase().includes(keyword)
    ));
  }, [search]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  const sidebar = (
    <aside className="flex h-full w-[250px] shrink-0 flex-col overflow-hidden bg-primary-container px-3 py-4 text-primary-fixed-dim shadow-2xl shadow-primary/15">
      <div className="mb-4 px-3">
        <button type="button" onClick={() => navigate('/admin/dashboard')} className="text-left">
          <h1 className="text-lg font-headline font-extrabold text-primary-fixed">{t('admin.brand')}</h1>
          <p className="text-xs font-medium text-on-primary-container">{t('admin.subtitle')}</p>
        </button>
      </div>

      <nav aria-label={t('admin.navigation.label')} className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {visibleNavigation.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path !== '/admin/system-monitoring'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => `flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] font-semibold leading-tight transition-all ${
              isActive
                ? 'bg-on-tertiary-container text-on-primary shadow-lg shadow-black/10'
                : 'text-primary-fixed-dim hover:bg-on-primary-fixed-variant/20'
            }`}
          >
            <span className="material-symbols-outlined shrink-0 text-[20px]">{item.icon}</span>
            <span>{t(item.key)}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-3 space-y-2 px-1">
        <button
          type="button"
          disabled
          title={t('admin.common.emergencyUnavailable')}
          className="flex h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-error px-3 text-sm font-bold text-on-error opacity-70"
        >
          <span className="material-symbols-outlined text-lg">emergency</span>
          <span>{t('admin.common.emergencyAlert')}</span>
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary-fixed/15 px-3 text-sm font-bold text-primary-fixed hover:bg-on-primary-fixed-variant/20"
        >
          <span className="material-symbols-outlined text-lg">logout</span>
          <span>{t('admin.common.logout')}</span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface">
      <div className="hidden lg:block">{sidebar}</div>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-[80] flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t('admin.navigation.label')}
        >
          <button type="button" aria-label={t('admin.navigation.close')} onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-black/45" />
          <div className="relative h-full">{sidebar}</div>
        </div>
      ) : null}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="z-40 flex h-20 shrink-0 items-center justify-between gap-4 bg-surface/95 px-4 shadow-[0_20px_40px_rgba(0,26,15,0.06)] backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-xl p-2 hover:bg-surface-container-low lg:hidden"
              aria-label={t('admin.navigation.open')}
              aria-expanded={mobileOpen}
            >
              <span className="material-symbols-outlined" aria-hidden="true">menu</span>
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-headline font-black text-primary sm:text-xl">
                {t(activeItem.key)}
              </h2>
              <p className="hidden text-xs font-medium text-on-surface-variant sm:block">{t('admin.header.workspace')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <label className="relative hidden xl:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-64 rounded-full border-0 bg-surface-container-low py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-on-tertiary-container"
                placeholder={t('admin.header.search')}
                aria-label={t('admin.header.search')}
              />
            </label>
            <button
              type="button"
              disabled
              title={t('admin.header.notificationsUnavailable')}
              aria-label={t('admin.header.notificationsUnavailable')}
              className="relative cursor-not-allowed rounded-full p-2 text-on-surface-variant opacity-60"
            >
              <span className="material-symbols-outlined" aria-hidden="true">notifications</span>
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-error" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={toggleLanguage}
              title={t('admin.header.switchLanguage')}
              aria-label={t('admin.header.switchLanguage')}
              className="inline-flex h-10 min-w-12 items-center justify-center rounded-full border border-outline-variant/40 bg-surface-container-low px-3 text-sm font-black text-primary"
            >
              {language === 'en' ? 'EN' : 'VN'}
            </button>
            <div title={displayName} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-surface-container-highest bg-secondary-container text-sm font-black text-secondary">
              {initial}
            </div>
          </div>
        </header>

        <div className="admin-command-content min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>

      <style>{`
        .admin-command-content > div {
          min-height: auto;
        }
        .admin-command-content header.fixed,
        .admin-command-content > div > header,
        .admin-command-content .admin-global-module-tabs,
        .admin-command-content footer {
          display: none !important;
        }
        .admin-command-content .pt-28,
        .admin-command-content .pt-24 {
          padding-top: 0 !important;
        }
        .admin-command-content .min-h-screen {
          min-height: auto !important;
        }
        .admin-command-content main {
          max-width: none;
        }
      `}</style>
    </div>
  );
};

export default AdminCommandLayout;
