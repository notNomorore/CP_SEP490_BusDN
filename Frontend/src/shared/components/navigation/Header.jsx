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
    { label: 'Mua vé', href: '/buy-tickets' },
    { label: 'Lịch sử', href: '/travel-history' },
    { label: 'Góp ý của tôi', href: '/my-feedback' },
    { label: 'Báo mất đồ', href: '/report-lost-item' },
    { label: 'Đồ thất lạc', href: '/lost-item-cases' },
    { label: 'Đối tác', href: '#' },
    { label: 'Tuyến xe', href: '/search' },
    { label: 'Trợ giúp', href: '#' },
  ];

  const authCta =
    location.pathname === '/auth/register'
      ? { label: 'Đăng nhập', path: '/auth/login' }
      : location.pathname === '/auth/login'
        ? { label: 'Tạo tài khoản', path: '/auth/register' }
        : { label: 'Đăng nhập', path: '/auth/login' };

  const displayName = user?.fullName?.trim() || 'Hành khách';
  const profileInitial = displayName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 h-20 transition-all duration-300 ${
        isScrolled
          ? 'glass-nav shadow-2xl shadow-primary/20'
          : 'bg-primary shadow-2xl shadow-primary/20'
      }`}
    >
      <div className="mx-auto flex h-full w-full max-w-screen-2xl items-center justify-between gap-4 px-6">
        <div className="flex min-w-0 items-center gap-5">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="shrink-0 whitespace-nowrap text-xl font-display font-black leading-none tracking-tight text-surface-bright transition-opacity hover:opacity-90 xl:text-2xl"
          >
            Veridian Transit
          </button>

          <nav className="hidden min-w-0 items-center gap-2 lg:flex xl:gap-3">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.href;

              return (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => {
                    if (link.href !== '#') {
                      navigate(link.href);
                    }
                  }}
                  className={`whitespace-nowrap rounded-lg px-2 py-2 text-xs font-bold leading-tight transition-all xl:text-[13px] ${
                    isActive
                      ? 'text-tertiary-fixed'
                      : 'text-surface-variant/80 hover:bg-primary-container/50 hover:text-surface-bright'
                  }`}
                >
                  <span className={isActive ? 'border-b-2 border-tertiary-fixed pb-1' : ''}>
                    {link.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-on-primary xl:gap-3">
          <div className="hidden items-center gap-3 xl:flex">
            <span className="whitespace-nowrap text-xs font-bold opacity-80">Hotline 24/7</span>
            <span className="material-symbols-outlined text-surface-bright">language</span>
            <span className="material-symbols-outlined text-surface-bright">help_outline</span>
          </div>

          {isAuthenticated ? (
            <div className="flex items-center gap-2 xl:gap-3">
              {isAdmin() ? (
                <>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/priority-verification')}
                    className="hidden whitespace-nowrap rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-surface-bright hover:bg-white/10 xl:inline-flex"
                  >
                    Duyệt hồ sơ
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/customer-support')}
                    className="hidden whitespace-nowrap rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-surface-bright hover:bg-white/10 xl:inline-flex"
                  >
                    Hỗ trợ khách hàng
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/priority-profile')}
                  className="hidden whitespace-nowrap rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-surface-bright hover:bg-white/10 xl:inline-flex"
                >
                  Hồ sơ ưu tiên
                </button>
              )}

              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="flex max-w-[210px] items-center gap-2 rounded-full border border-white/10 bg-white/10 px-2.5 py-2 text-left text-surface-bright backdrop-blur-md hover:bg-white/15"
                aria-label="Hồ sơ người dùng hiện tại"
              >
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={displayName}
                    className="h-9 w-9 shrink-0 rounded-full border border-white/20 object-cover"
                  />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-on-tertiary-container font-bold text-primary">
                    {profileInitial}
                  </span>
                )}
                <span className="hidden min-w-0 flex-col md:flex">
                  <span className="truncate text-[10px] uppercase tracking-[0.16em] text-surface-variant/70">
                    Đã đăng nhập
                  </span>
                  <span className="truncate text-sm font-semibold text-surface-bright">
                    {displayName}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="whitespace-nowrap rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-surface-bright hover:bg-white/10"
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => navigate(authCta.path)}
              className="whitespace-nowrap rounded-full bg-on-tertiary-container px-6 py-2 font-bold text-primary transition-transform hover:shadow-lg active:scale-95"
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
