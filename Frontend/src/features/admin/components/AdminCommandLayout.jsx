import React, { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../../auth/stores/authStore.js';
import useLanguage from '../../../shared/hooks/useLanguage.js';

const labels = {
  en: {
    brand: 'BusDN Command',
    subtitle: 'Regional Operations Center',
    center: 'Unified administration workspace',
    search: 'Search admin modules...',
    emergency: 'Emergency Alert',
    logout: 'Logout',
    switchLanguage: 'Switch to Vietnamese',
  },
  vi: {
    brand: 'Điều hành BusDN',
    subtitle: 'Trung tâm vận hành khu vực',
    center: 'Trung tâm điều hành quản trị thống nhất',
    search: 'Tìm chức năng quản trị...',
    emergency: 'Cảnh báo khẩn cấp',
    logout: 'Đăng xuất',
    switchLanguage: 'Switch to English',
  },
};

const navigation = [
  { path: '/admin/dashboard', label: 'Vận hành đội xe', labelEn: 'Fleet Operations', icon: 'directions_bus' },
  { path: '/admin/routes', label: 'Quản lý tuyến & lịch', labelEn: 'Routes & Scheduling', icon: 'map' },
  { path: '/admin/analytics/route-efficiency', label: 'Phân tích tuyến', labelEn: 'Route Analytics', icon: 'monitoring' },
  { path: '/admin/fare-operations', label: 'Vận hành giá vé', labelEn: 'Fare Operations', icon: 'payments' },
  { path: '/admin/promotions', label: 'Khuyến mãi', labelEn: 'Promotions', icon: 'sell' },
  { path: '/admin/promotions/statistics', label: 'Thống kê khuyến mãi', labelEn: 'Promotion Statistics', icon: 'bar_chart' },
  { path: '/admin/revenue', label: 'Doanh thu', labelEn: 'Revenue', icon: 'receipt_long' },
  { path: '/admin/walkin-tickets', label: 'Vé mua trực tiếp', labelEn: 'Walk-in Tickets', icon: 'confirmation_number' },
  { path: '/admin/incidents', label: 'Sự cố', labelEn: 'Incidents', icon: 'warning' },
  { path: '/admin/passenger-compliance', label: 'Vi phạm hành khách', labelEn: 'Passenger Compliance', icon: 'gpp_bad' },
  { path: '/admin/users', label: 'Quản lý người dùng', labelEn: 'User Management', icon: 'manage_accounts' },
  { path: '/admin/staff-performance', label: 'Hiệu suất nhân viên', labelEn: 'Staff Performance', icon: 'query_stats' },
  { path: '/admin/priority-verification', label: 'Xác minh ưu tiên', labelEn: 'Priority Verification', icon: 'verified_user' },
  { path: '/admin/customer-support', label: 'Hỗ trợ khách hàng', labelEn: 'Customer Support', icon: 'support_agent' },
  { path: '/admin/system-monitoring', label: 'Giám sát hệ thống', labelEn: 'System Monitoring', icon: 'admin_panel_settings' },
];

const AdminCommandLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { language, toggleLanguage } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const copy = labels[language] || labels.en;
  const displayName = user?.fullName?.trim() || 'Admin';
  const initial = displayName.charAt(0).toUpperCase();

  const activeItem = useMemo(() => {
    return [...navigation]
      .sort((left, right) => right.path.length - left.path.length)
      .find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`))
      || navigation[0];
  }, [location.pathname]);

  const visibleNavigation = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return navigation;
    return navigation.filter((item) => (
      item.label.toLowerCase().includes(keyword)
      || item.labelEn.toLowerCase().includes(keyword)
    ));
  }, [search]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const sidebar = (
    <aside className="flex h-full w-[250px] shrink-0 flex-col overflow-hidden bg-primary-container px-3 py-4 text-primary-fixed-dim shadow-2xl shadow-primary/15">
      <div className="mb-4 px-3">
        <button type="button" onClick={() => navigate('/admin/dashboard')} className="text-left">
          <h1 className="text-lg font-headline font-extrabold text-primary-fixed">{copy.brand}</h1>
          <p className="text-xs font-medium text-on-primary-container">{copy.subtitle}</p>
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
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
            <span>{language === 'vi' ? item.label : item.labelEn}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-3 space-y-2 px-1">
        <button type="button" className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-error px-3 text-sm font-bold text-on-error">
          <span className="material-symbols-outlined text-lg">emergency</span>
          <span>{copy.emergency}</span>
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary-fixed/15 px-3 text-sm font-bold text-primary-fixed hover:bg-on-primary-fixed-variant/20"
        >
          <span className="material-symbols-outlined text-lg">logout</span>
          <span>{copy.logout}</span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface">
      <div className="hidden lg:block">{sidebar}</div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[80] flex lg:hidden">
          <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-black/45" />
          <div className="relative h-full">{sidebar}</div>
        </div>
      ) : null}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="z-40 flex h-20 shrink-0 items-center justify-between gap-4 bg-surface/95 px-4 shadow-[0_20px_40px_rgba(0,26,15,0.06)] backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} className="rounded-xl p-2 hover:bg-surface-container-low lg:hidden">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-headline font-black text-primary sm:text-xl">
                {language === 'vi' ? activeItem.label : activeItem.labelEn}
              </h2>
              <p className="hidden text-xs font-medium text-on-surface-variant sm:block">{copy.center}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <label className="relative hidden xl:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-64 rounded-full border-0 bg-surface-container-low py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-on-tertiary-container"
                placeholder={copy.search}
              />
            </label>
            <button type="button" className="relative rounded-full p-2 text-on-surface-variant hover:bg-surface-container-low">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-error" />
            </button>
            <button
              type="button"
              onClick={toggleLanguage}
              title={copy.switchLanguage}
              className="inline-flex h-10 min-w-12 items-center justify-center rounded-full border border-outline-variant/40 bg-surface-container-low px-3 text-sm font-black text-primary"
            >
              {language === 'en' ? 'VI' : 'EN'}
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
