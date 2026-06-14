import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import useAuthStore from '../stores/authStore.js';

const ForcePasswordChangePage = () => {
  const navigate = useNavigate();
  const { changePassword, isLoading, error, clearError } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearError();
    setLocalError('');

    if (newPassword !== confirmPassword) {
      setLocalError('Mật khẩu xác nhận không khớp.');
      return;
    }

    if (newPassword === currentPassword) {
      setLocalError('Mật khẩu mới không được trùng mật khẩu tạm thời.');
      return;
    }

    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      navigate('/', { replace: true });
    } catch {
      // Store error is rendered below.
    }
  };

  return (
    <AuthShell
      eyebrow="Bảo mật tài khoản"
      heroTitle="Đổi mật khẩu trước khi tiếp tục."
      heroDescription="Mật khẩu tạm thời chỉ dùng để đăng nhập lần đầu. Bạn phải đặt mật khẩu mới để vào hệ thống."
    >
      <div className="space-y-7">
        <div>
          <h2 className="text-3xl font-headline font-black tracking-tight text-primary">Đổi mật khẩu lần đầu</h2>
          <p className="mt-2 text-body-lg text-on-surface-variant">
            Không tiếp tục sử dụng mật khẩu được gửi qua email.
          </p>
        </div>

        {(localError || error) ? (
          <div className="rounded-2xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
            {localError || (typeof error === 'string' ? error : JSON.stringify(error))}
          </div>
        ) : null}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-on-surface">Mật khẩu tạm thời</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 text-base text-on-surface focus:border-on-tertiary-container focus:outline-none focus:ring-2 focus:ring-on-tertiary-container/20"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-on-surface">Mật khẩu mới</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 text-base text-on-surface focus:border-on-tertiary-container focus:outline-none focus:ring-2 focus:ring-on-tertiary-container/20"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-on-surface">Xác nhận mật khẩu mới</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 text-base text-on-surface focus:border-on-tertiary-container focus:outline-none focus:ring-2 focus:ring-on-tertiary-container/20"
            />
          </label>

          <button
            type="submit"
            disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
            className="w-full rounded-full bg-primary px-6 py-4 text-base font-bold text-on-primary shadow-lg shadow-primary/15 hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Đang cập nhật...' : 'Đổi mật khẩu và tiếp tục'}
          </button>
        </form>
      </div>
    </AuthShell>
  );
};

export default ForcePasswordChangePage;
