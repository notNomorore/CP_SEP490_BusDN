import React from 'react';
import useTheme from '../../../shared/hooks/useTheme.js';

export const money = (value) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(Number(value) || 0);

export const Field = ({ label, children }) => {
  const { isDarkMode } = useTheme();

  return (
    <label className="block">
      <span className={isDarkMode ? 'mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400' : 'mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600'}>
        {label}
      </span>
      {children}
    </label>
  );
};

export const inputClass = 'w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none ring-emerald-300 focus:border-emerald-500 focus:ring-2';

export const Panel = ({ title, children, action }) => {
  const { isDarkMode } = useTheme();

  return (
    <section className={isDarkMode ? 'rounded border border-white/10 bg-white/[0.04]' : 'rounded border border-slate-200 bg-white shadow-sm'}>
      <div className={isDarkMode ? 'flex items-center justify-between border-b border-white/10 px-4 py-3' : 'flex items-center justify-between border-b border-slate-200 px-4 py-3'}>
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
};

export const Metric = ({ label, value }) => {
  const { isDarkMode } = useTheme();

  return (
    <div className={isDarkMode ? 'rounded border border-white/10 bg-white/[0.05] p-4' : 'rounded border border-slate-200 bg-white p-4 shadow-sm'}>
      <p className={isDarkMode ? 'text-xs font-semibold uppercase tracking-wide text-slate-400' : 'text-xs font-semibold uppercase tracking-wide text-slate-500'}>{label}</p>
      <p className={isDarkMode ? 'mt-2 text-2xl font-semibold text-white' : 'mt-2 text-2xl font-semibold text-slate-950'}>{value}</p>
    </div>
  );
};

export const Alert = ({ type = 'info', children }) => {
  const { isDarkMode } = useTheme();
  const classes = isDarkMode ? {
    info: 'border-sky-400/40 bg-sky-400/10 text-sky-100',
    success: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100',
    error: 'border-rose-400/40 bg-rose-400/10 text-rose-100',
  } : {
    info: 'border-sky-200 bg-sky-50 text-sky-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-rose-200 bg-rose-50 text-rose-800',
  };
  return <div className={`rounded border px-4 py-3 text-sm ${classes[type]}`}>{children}</div>;
};
