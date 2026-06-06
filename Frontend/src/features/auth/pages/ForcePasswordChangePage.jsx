import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore.js';

const passwordRules = [
  { label: 'It nhat 8 ky tu', test: (value) => value.length >= 8 },
  { label: 'Co chu hoa va chu thuong', test: (value) => /[A-Z]/.test(value) && /[a-z]/.test(value) },
  { label: 'Co so va ky tu dac biet', test: (value) => /[0-9]/.test(value) && /[@$!%*?&]/.test(value) },
];

const ForcePasswordChangePage = () => {
  const navigate = useNavigate();
  const { changePassword, user, isLoading } = useAuthStore();
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState('');

  const checks = useMemo(() => passwordRules.map((rule) => ({
    ...rule,
    passed: rule.test(form.newPassword),
  })), [form.newPassword]);
  const canSubmit = form.currentPassword
    && form.newPassword
    && form.confirmPassword
    && checks.every((rule) => rule.passed)
    && form.newPassword === form.confirmPassword;

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) {
      setMessage('Vui long kiem tra lai mat khau moi va xac nhan mat khau.');
      return;
    }

    try {
      await changePassword(form);
      navigate(user?.role === 'ADMIN' ? '/admin/users' : '/', { replace: true });
    } catch (error) {
      setMessage(error?.message || 'Khong the doi mat khau. Vui long thu lai.');
    }
  };

  return (
    <main className="min-h-screen bg-[#eefaf6] px-4 py-10 text-slate-950">
      <section className="mx-auto max-w-xl rounded-[28px] border border-emerald-100 bg-white p-8 shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
        <span className="rounded-full bg-emerald-100 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-emerald-700">
          Bao mat tai khoan
        </span>
        <h1 className="mt-6 text-3xl font-black">Doi mat khau lan dau</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Tai khoan nhan su moi can doi mat khau tam thoi truoc khi tiep tuc su dung he thong.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Mat khau hien tai</span>
            <input
              type="password"
              value={form.currentPassword}
              onChange={(event) => updateField('currentPassword', event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-emerald-400"
              autoComplete="current-password"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold">Mat khau moi</span>
            <input
              type="password"
              value={form.newPassword}
              onChange={(event) => updateField('newPassword', event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-emerald-400"
              autoComplete="new-password"
            />
          </label>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            {checks.map((rule) => (
              <div key={rule.label} className={`flex items-center gap-2 text-sm ${rule.passed ? 'text-emerald-700' : 'text-slate-500'}`}>
                <span className="material-symbols-outlined text-base">{rule.passed ? 'check_circle' : 'radio_button_unchecked'}</span>
                {rule.label}
              </div>
            ))}
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-bold">Xac nhan mat khau moi</span>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(event) => updateField('confirmPassword', event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-emerald-400"
              autoComplete="new-password"
            />
          </label>

          {message ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading || !canSubmit}
            className="h-12 w-full rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white shadow-[0_14px_28px_rgba(4,120,87,0.22)] disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isLoading ? 'Dang cap nhat...' : 'Doi mat khau va tiep tuc'}
          </button>
        </form>
      </section>
    </main>
  );
};

export default ForcePasswordChangePage;
