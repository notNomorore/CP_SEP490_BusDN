import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Banknote,
  BellRing,
  CalendarDays,
  ClipboardCheck,
  FileWarning,
  LogOut,
  Moon,
  Pencil,
  QrCode,
  ReceiptText,
  Route,
  Save,
  Sun,
  UserRound,
  X,
} from 'lucide-react';
import useLanguage from '../../../shared/hooks/useLanguage.js';
import useTheme from '../../../shared/hooks/useTheme.js';
import { getBusAssistantText } from '../busAssistantI18n.js';
import useAuthStore from '../../auth/stores/authStore.js';

const navItems = [
  { to: '/bus-assistant/assigned-trips', labelKey: 'assignedTrips', label: 'Chuyến được phân công', icon: Route },
  { to: '/bus-assistant/shift-schedule', labelKey: 'shiftSchedule', label: 'Lịch ca làm việc', icon: CalendarDays },
  { to: '/bus-assistant/operation-notifications', labelKey: 'operationNotifications', label: 'Thông báo vận hành', icon: BellRing },
  { to: '/bus-assistant/validate-ticket', labelKey: 'validateQr', icon: QrCode },
  { to: '/bus-assistant/walkin-ticket', labelKey: 'walkInTicket', icon: ReceiptText },
  { to: '/bus-assistant/incident-reports', labelKey: 'incidentReports', label: 'Báo cáo sự cố', icon: FileWarning },
  { to: '/bus-assistant/shift-revenue', labelKey: 'shiftRevenue', icon: Banknote },
  { to: '/bus-assistant/revenue-summary', labelKey: 'revenueSummary', icon: ClipboardCheck },
];

const navItemOrder = [
  '/bus-assistant/validate-ticket',
  '/bus-assistant/walkin-ticket',
  '/bus-assistant/incident-reports',
  '/bus-assistant/shift-revenue',
  '/bus-assistant/revenue-summary',
  '/bus-assistant/assigned-trips',
  '/bus-assistant/shift-schedule',
  '/bus-assistant/operation-notifications',
];

const orderedNavItems = navItemOrder
  .map((path) => navItems.find((item) => item.to === path))
  .filter(Boolean);

const BusAssistantShell = () => {
  const navigate = useNavigate();
  const { language, toggleLanguage } = useLanguage();
  const { isDarkMode, toggleTheme } = useTheme();
  const { user, logout, updateProfile, isLoading } = useAuthStore();
  const t = getBusAssistantText(language);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ fullName: '', avatar: '' });
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  const displayName = user?.fullName || user?.email || 'Bus Assistant';
  const roleLabel = user?.role === 'BUS_ASSISTANT' ? t.busAssistantRole : user?.role || '';
  const initial = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    if (isProfileOpen) {
      setProfileForm({
        fullName: user?.fullName || '',
        avatar: user?.avatar || '',
      });
      setProfileMessage('');
      setProfileError('');
    }
  }, [isProfileOpen, user]);

  const handleLogout = async () => {
    await logout();
    navigate('/auth/login', { replace: true });
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setProfileMessage('');
    setProfileError('');

    try {
      await updateProfile({
        fullName: profileForm.fullName.trim(),
        avatar: profileForm.avatar.trim(),
      });
      setProfileMessage(t.profileUpdated);
    } catch {
      setProfileError(t.profileUpdateFailed);
    }
  };

  return (
    <div className={isDarkMode ? 'min-h-screen bg-slate-950 text-slate-100' : 'min-h-screen bg-[#f4f8f6] text-slate-950'}>
      <header className={isDarkMode ? 'border-b border-white/10 bg-slate-950/95' : 'border-b border-emerald-100 bg-white shadow-sm'}>
        <div className="flex w-full flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between xl:px-10 2xl:px-12">
          <button
            type="button"
            onClick={() => navigate('/bus-assistant/assigned-trips')}
            className="flex items-center gap-3 text-left"
          >
            <span className="grid h-10 w-10 place-items-center rounded bg-emerald-400 text-slate-950">
              <BadgeCheck size={22} />
            </span>
            <span>
              <span className="block text-lg font-semibold">{t.appTitle}</span>
              <span className={isDarkMode ? 'block text-xs text-slate-400' : 'block text-xs text-slate-500'}>{t.appSubtitle}</span>
            </span>
          </button>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <button
              type="button"
              onClick={toggleLanguage}
              title={t.switchLanguage}
              aria-label={t.switchLanguage}
              className={isDarkMode
                ? 'inline-flex h-10 w-12 shrink-0 items-center justify-center rounded border border-white/10 bg-white/5 text-sm font-bold text-slate-100 hover:bg-white/10'
                : 'inline-flex h-10 w-12 shrink-0 items-center justify-center rounded border border-emerald-100 bg-emerald-50 text-sm font-bold text-emerald-800 hover:bg-emerald-100'}
            >
              {t.languageButton}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              title={t.switchTheme}
              aria-label={t.switchTheme}
              className={isDarkMode
                ? 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10'
                : 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-amber-100 bg-amber-50 text-amber-700 hover:bg-amber-100'}
            >
              {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <div className={isDarkMode
              ? 'flex items-center gap-2 rounded border border-white/10 bg-white/[0.04] px-2 py-1.5'
              : 'flex items-center gap-2 rounded border border-emerald-100 bg-white px-2 py-1.5 shadow-sm'}
            >
              {user?.avatar ? (
                <img src={user.avatar} alt={displayName} className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
                  {initial}
                </span>
              )}
              <div className="hidden min-w-0 sm:block">
                <p className={isDarkMode ? 'text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400' : 'text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500'}>{t.signedIn}</p>
                <p className={isDarkMode ? 'max-w-[180px] truncate text-sm font-semibold text-white' : 'max-w-[180px] truncate text-sm font-semibold text-slate-950'}>{displayName}</p>
                <p className="max-w-[180px] truncate text-xs font-semibold text-emerald-500">{roleLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileOpen(true)}
                className={isDarkMode
                  ? 'inline-flex h-9 w-9 items-center justify-center rounded border border-white/10 text-slate-200 hover:bg-white/10'
                  : 'inline-flex h-9 w-9 items-center justify-center rounded border border-slate-200 text-slate-700 hover:bg-slate-100'}
                title={t.editProfile}
                aria-label={t.editProfile}
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className={isDarkMode
                  ? 'inline-flex h-9 w-9 items-center justify-center rounded border border-white/10 text-slate-200 hover:bg-white/10'
                  : 'inline-flex h-9 w-9 items-center justify-center rounded border border-slate-200 text-slate-700 hover:bg-slate-100'}
                title={t.logout}
                aria-label={t.logout}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="grid w-full gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[clamp(210px,15vw,280px)_minmax(0,1fr)] xl:px-10 2xl:px-12">
        <nav className={isDarkMode
          ? 'flex h-fit flex-col gap-2 rounded border border-white/10 bg-white/[0.04] p-3 lg:sticky lg:top-6'
          : 'flex h-fit flex-col gap-2 rounded border border-emerald-100 bg-white p-3 shadow-sm lg:sticky lg:top-6'}
        >
          {orderedNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => [
                  'inline-flex w-full items-center gap-2 rounded px-3 py-2 text-sm font-medium transition',
                  isActive
                    ? 'bg-emerald-400 text-slate-950'
                    : isDarkMode
                      ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                      : 'bg-emerald-50/60 text-slate-800 hover:bg-emerald-100',
                ].join(' ')}
              >
                <Icon size={16} />
                {t[item.labelKey] || item.label}
              </NavLink>
            );
          })}
        </nav>
        <section className="min-w-0">
          <Outlet />
        </section>
      </main>

      {isProfileOpen ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 px-4">
          <section className={isDarkMode
            ? 'w-full max-w-md rounded border border-white/10 bg-slate-900 text-slate-100 shadow-2xl'
            : 'w-full max-w-md rounded border border-slate-200 bg-white text-slate-950 shadow-2xl'}
          >
            <div className={isDarkMode ? 'flex items-center justify-between border-b border-white/10 px-4 py-3' : 'flex items-center justify-between border-b border-slate-200 px-4 py-3'}>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded bg-emerald-400 text-slate-950">
                  <UserRound size={20} />
                </span>
                <div>
                  <h2 className="text-base font-semibold">{t.profile}</h2>
                  <p className={isDarkMode ? 'text-xs text-slate-400' : 'text-xs text-slate-500'}>{displayName} - {roleLabel}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileOpen(false)}
                className={isDarkMode
                  ? 'inline-flex h-9 w-9 items-center justify-center rounded border border-white/10 hover:bg-white/10'
                  : 'inline-flex h-9 w-9 items-center justify-center rounded border border-slate-200 hover:bg-slate-100'}
                aria-label={t.cancel}
              >
                <X size={17} />
              </button>
            </div>
            <form onSubmit={handleProfileSubmit} className="space-y-4 p-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">{t.fullName}</span>
                <input
                  value={profileForm.fullName}
                  onChange={(event) => setProfileForm((current) => ({ ...current, fullName: event.target.value }))}
                  className="w-full rounded border border-white/10 bg-white px-3 py-2 text-sm text-slate-950 outline-none ring-emerald-300 focus:ring-2"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">{t.email}</span>
                <input
                  value={user?.email || ''}
                  readOnly
                  className={isDarkMode
                    ? 'w-full rounded border border-white/10 bg-slate-800 px-3 py-2 text-sm text-slate-300'
                    : 'w-full rounded border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700'}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">{t.role}</span>
                <input
                  value={roleLabel}
                  readOnly
                  className={isDarkMode
                    ? 'w-full rounded border border-white/10 bg-slate-800 px-3 py-2 text-sm text-slate-300'
                    : 'w-full rounded border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700'}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">{t.avatarUrl}</span>
                <input
                  value={profileForm.avatar}
                  onChange={(event) => setProfileForm((current) => ({ ...current, avatar: event.target.value }))}
                  className="w-full rounded border border-white/10 bg-white px-3 py-2 text-sm text-slate-950 outline-none ring-emerald-300 focus:ring-2"
                />
              </label>
              {profileMessage ? <p className="rounded border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">{profileMessage}</p> : null}
              {profileError ? <p className="rounded border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{profileError}</p> : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(false)}
                  className={isDarkMode
                    ? 'rounded border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10'
                    : 'rounded border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100'}
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !profileForm.fullName.trim()}
                  className="inline-flex items-center gap-2 rounded bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                >
                  <Save size={16} />
                  {isLoading ? t.saving : t.saveProfile}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
};

export default BusAssistantShell;
