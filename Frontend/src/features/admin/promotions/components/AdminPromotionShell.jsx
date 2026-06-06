import React from 'react';
import { BarChart3, ReceiptText, TicketPercent } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import Header from '../../../../shared/components/navigation/Header.jsx';
import Footer from '../../../../shared/components/common/Footer.jsx';

const navItems = [
  {
    label: 'Promotions',
    path: '/admin/promotions',
    icon: TicketPercent,
  },
  {
    label: 'Statistics',
    path: '/admin/promotions/statistics',
    icon: BarChart3,
  },
  {
    label: 'Revenue',
    path: '/admin/revenue',
    icon: ReceiptText,
  },
];

const AdminPromotionShell = ({ children, title, subtitle, action }) => {
  const location = useLocation();

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-28 lg:px-6">
        <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-outline">
              Admin module
            </p>
            <h1 className="mt-2 text-3xl font-headline font-extrabold text-primary">
              {title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">{subtitle}</p>
          </div>
          {action}
        </div>

        <div className="mb-6 flex flex-wrap gap-2 rounded-[24px] border border-outline-variant/40 bg-white/75 p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`inline-flex items-center gap-2 rounded-[18px] px-4 py-2 text-sm font-bold ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-primary hover:bg-surface-container-low'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        {children}
      </main>
      <Footer />
    </div>
  );
};

export default AdminPromotionShell;
