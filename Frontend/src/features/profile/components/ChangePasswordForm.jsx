import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LockKeyhole, ShieldEllipsis } from 'lucide-react';
import { passwordFormSchema } from '../schemas/profileSchema.js';

const fieldClassName =
  'w-full rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-outline/70 focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20';

const ChangePasswordForm = ({ onSubmit, isSubmitting }) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const submitHandler = async (values) => {
    await onSubmit(values);
    reset();
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(submitHandler)}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface">Current password</span>
          <input
            type="password"
            {...register('currentPassword')}
            className={fieldClassName}
            placeholder="Enter current password"
          />
          {errors.currentPassword ? (
            <span className="text-sm text-error">{errors.currentPassword.message}</span>
          ) : null}
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface">New password</span>
          <input
            type="password"
            {...register('newPassword')}
            className={fieldClassName}
            placeholder="Create a stronger password"
          />
          {errors.newPassword ? (
            <span className="text-sm text-error">{errors.newPassword.message}</span>
          ) : null}
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-semibold text-on-surface">Confirm new password</span>
        <input
          type="password"
          {...register('confirmPassword')}
          className={fieldClassName}
          placeholder="Re-enter new password"
        />
        {errors.confirmPassword ? (
          <span className="text-sm text-error">{errors.confirmPassword.message}</span>
        ) : null}
      </label>

      <div className="rounded-[24px] bg-surface-container-low p-4">
        <div className="flex items-start gap-3">
          <ShieldEllipsis className="mt-0.5 h-5 w-5 text-on-tertiary-container" />
          <p className="text-sm leading-6 text-on-surface-variant">
            Passwords must contain uppercase, lowercase, number, and special character to satisfy BusDN security rules.
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LockKeyhole className="h-4 w-4" />
        {isSubmitting ? 'Updating password...' : 'Change password'}
      </button>
    </form>
  );
};

export default ChangePasswordForm;
