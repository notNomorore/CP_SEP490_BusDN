import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import toast from '../../../../shared/utils/toast.js';
import {
  Eye,
  LoaderCircle,
  Pencil,
  Plus,
  Power,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import AdminPromotionShell from '../components/AdminPromotionShell.jsx';
import promotionAdminService from '../services/promotionAdminService.js';

const fieldClassName =
  'w-full rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-outline/70 focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20';

const defaultFormValues = {
  code: '',
  name: '',
  description: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  maxDiscountAmount: '',
  minOrderAmount: 0,
  applicableTo: 'ALL_ROUTES',
  routeIds: '',
  startDate: '',
  endDate: '',
  usageLimit: '',
  usagePerUser: 1,
  status: 'ACTIVE',
  notifyPassengers: false,
  notificationScheduledAt: '',
};

const statusClassName = {
  ACTIVE: 'bg-secondary-container text-on-secondary-container',
  INACTIVE: 'bg-surface-container text-on-surface-variant',
  EXPIRED: 'bg-error-container text-on-error-container',
};

const formatDate = (value) => {
  if (!value) {
    return 'N/A';
  }

  try {
    return format(new Date(value), 'dd/MM/yyyy');
  } catch {
    return 'N/A';
  }
};

const toDateInput = (value) => {
  if (!value) {
    return '';
  }

  try {
    return format(new Date(value), 'yyyy-MM-dd');
  } catch {
    return '';
  }
};

const toDateTimeInput = (value) => {
  if (!value) {
    return '';
  }

  try {
    const date = new Date(value);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16);
  } catch {
    return '';
  }
};

const normalizeNumber = (value) => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  return Number(value);
};

const buildPayload = (formValues) => {
  return {
    ...formValues,
    code: formValues.code.trim().toUpperCase(),
    name: formValues.name.trim(),
    description: formValues.description.trim(),
    discountValue: normalizeNumber(formValues.discountValue),
    maxDiscountAmount: normalizeNumber(formValues.maxDiscountAmount) ?? null,
    minOrderAmount: normalizeNumber(formValues.minOrderAmount) ?? 0,
    usageLimit: normalizeNumber(formValues.usageLimit) ?? null,
    usagePerUser: normalizeNumber(formValues.usagePerUser) ?? 1,
    notifyPassengers: Boolean(formValues.notifyPassengers),
    notificationScheduledAt: formValues.notifyPassengers && formValues.notificationScheduledAt
      ? new Date(formValues.notificationScheduledAt).toISOString()
      : null,
    routeIds:
      formValues.applicableTo === 'SELECTED_ROUTES'
        ? formValues.routeIds
          .split(',')
          .map((routeId) => routeId.trim())
          .filter(Boolean)
        : [],
  };
};

const validateForm = (values) => {
  const errors = {};

  if (!values.code.trim()) {
    errors.code = 'Promotion code is required';
  }

  if (!values.name.trim()) {
    errors.name = 'Promotion name is required';
  }

  const discountValue = Number(values.discountValue);
  if (!discountValue || discountValue <= 0) {
    errors.discountValue = 'Discount value must be greater than 0';
  } else if (values.discountType === 'PERCENTAGE' && discountValue > 100) {
    errors.discountValue = 'Percentage discount cannot exceed 100';
  }

  if (!values.startDate || !values.endDate) {
    errors.endDate = 'Start date and end date are required';
  } else if (new Date(values.startDate) >= new Date(values.endDate)) {
    errors.endDate = 'Start date must be before end date';
  }

  if (values.applicableTo === 'SELECTED_ROUTES' && !values.routeIds.trim()) {
    errors.routeIds = 'Route IDs are required for selected routes';
  }

  if (values.usageLimit && Number(values.usageLimit) < 1) {
    errors.usageLimit = 'Usage limit must be greater than 0';
  }

  if (values.usagePerUser && Number(values.usagePerUser) < 1) {
    errors.usagePerUser = 'Usage per user must be greater than 0';
  }

  if (values.maxDiscountAmount && Number(values.maxDiscountAmount) < 0) {
    errors.maxDiscountAmount = 'Max discount amount cannot be negative';
  }

  if (values.minOrderAmount && Number(values.minOrderAmount) < 0) {
    errors.minOrderAmount = 'Minimum order amount cannot be negative';
  }

  if (values.notifyPassengers) {
    if (!values.notificationScheduledAt) {
      errors.notificationScheduledAt = 'Notification time is required';
    } else {
      const scheduledAt = new Date(values.notificationScheduledAt);
      const startDate = values.startDate ? new Date(`${values.startDate}T00:00`) : null;
      const endDate = values.endDate ? new Date(`${values.endDate}T23:59:59`) : null;

      if (Number.isNaN(scheduledAt.getTime())) {
        errors.notificationScheduledAt = 'Invalid notification time';
      } else if (scheduledAt <= new Date()) {
        errors.notificationScheduledAt = 'Notification time cannot be in the past';
      } else if (startDate && scheduledAt < startDate) {
        errors.notificationScheduledAt = 'Notification time must be within promotion validity period';
      } else if (endDate && scheduledAt > endDate) {
        errors.notificationScheduledAt = 'Notification time must be within promotion validity period';
      }
    }
  }

  return errors;
};

const PromotionFormModal = ({ initialValues, isSaving, onClose, onSubmit }) => {
  const [values, setValues] = useState(initialValues || defaultFormValues);
  const [errors, setErrors] = useState({});

  const updateValue = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validateForm(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    onSubmit(buildPayload(values));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-4xl rounded-[28px] bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-headline font-extrabold text-primary">
              {initialValues ? 'Edit promotion' : 'Create promotion'}
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Updated details apply only to future eligible transactions.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface">Code</span>
            <input
              value={values.code}
              onChange={(event) => updateValue('code', event.target.value.toUpperCase())}
              className={fieldClassName}
              placeholder="DANANG20"
            />
            {errors.code ? <span className="text-sm text-error">{errors.code}</span> : null}
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface">Name</span>
            <input
              value={values.name}
              onChange={(event) => updateValue('name', event.target.value)}
              className={fieldClassName}
              placeholder="Summer route discount"
            />
            {errors.name ? <span className="text-sm text-error">{errors.name}</span> : null}
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-on-surface">Description</span>
            <textarea
              value={values.description}
              onChange={(event) => updateValue('description', event.target.value)}
              className={`${fieldClassName} min-h-[96px] resize-none`}
              placeholder="Campaign notes for the admin team"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface">Discount type</span>
            <select
              value={values.discountType}
              onChange={(event) => updateValue('discountType', event.target.value)}
              className={fieldClassName}
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED_AMOUNT">Fixed amount</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface">Discount value</span>
            <input
              type="number"
              min="0"
              value={values.discountValue}
              onChange={(event) => updateValue('discountValue', event.target.value)}
              className={fieldClassName}
            />
            {errors.discountValue ? (
              <span className="text-sm text-error">{errors.discountValue}</span>
            ) : null}
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface">Max discount amount</span>
            <input
              type="number"
              min="0"
              value={values.maxDiscountAmount}
              onChange={(event) => updateValue('maxDiscountAmount', event.target.value)}
              className={fieldClassName}
            />
            {errors.maxDiscountAmount ? <span className="text-sm text-error">{errors.maxDiscountAmount}</span> : null}
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface">Min order amount</span>
            <input
              type="number"
              min="0"
              value={values.minOrderAmount}
              onChange={(event) => updateValue('minOrderAmount', event.target.value)}
              className={fieldClassName}
            />
            {errors.minOrderAmount ? <span className="text-sm text-error">{errors.minOrderAmount}</span> : null}
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface">Applicable to</span>
            <select
              value={values.applicableTo}
              onChange={(event) => updateValue('applicableTo', event.target.value)}
              className={fieldClassName}
            >
              <option value="ALL_ROUTES">All routes</option>
              <option value="SELECTED_ROUTES">Selected routes</option>
              <option value="MONTHLY_PASS">Monthly pass</option>
              <option value="E_TICKET">E-ticket</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface">Route IDs</span>
            <input
              value={values.routeIds}
              onChange={(event) => updateValue('routeIds', event.target.value)}
              disabled={values.applicableTo !== 'SELECTED_ROUTES'}
              className={fieldClassName}
              placeholder="Comma separated ObjectIds"
            />
            {errors.routeIds ? <span className="text-sm text-error">{errors.routeIds}</span> : null}
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface">Start date</span>
            <input
              type="date"
              value={values.startDate}
              onChange={(event) => updateValue('startDate', event.target.value)}
              className={fieldClassName}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface">End date</span>
            <input
              type="date"
              value={values.endDate}
              onChange={(event) => updateValue('endDate', event.target.value)}
              className={fieldClassName}
            />
            {errors.endDate ? <span className="text-sm text-error">{errors.endDate}</span> : null}
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface">Usage limit</span>
            <input
              type="number"
              min="1"
              value={values.usageLimit}
              onChange={(event) => updateValue('usageLimit', event.target.value)}
              className={fieldClassName}
            />
            {errors.usageLimit ? <span className="text-sm text-error">{errors.usageLimit}</span> : null}
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface">Usage per user</span>
            <input
              type="number"
              min="1"
              value={values.usagePerUser}
              onChange={(event) => updateValue('usagePerUser', event.target.value)}
              className={fieldClassName}
            />
            {errors.usagePerUser ? <span className="text-sm text-error">{errors.usagePerUser}</span> : null}
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface">Status</span>
            <select
              value={values.status}
              onChange={(event) => updateValue('status', event.target.value)}
              className={fieldClassName}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 md:col-span-2">
            <input
              type="checkbox"
              checked={values.notifyPassengers}
              disabled={values.notificationStatus === 'sent'}
              onChange={(event) => updateValue('notifyPassengers', event.target.checked)}
              className="h-4 w-4 rounded border-outline-variant text-primary"
            />
            <span>
              <span className="block text-sm font-semibold text-on-surface">
                Send notification to passengers
              </span>
              <span className="block text-xs text-on-surface-variant">
                Passengers will receive an in-app notification with this promotion code at the selected time.
              </span>
            </span>
          </label>
          {values.notifyPassengers ? (
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-on-surface">Notification send time</span>
              <input
                type="datetime-local"
                value={values.notificationScheduledAt}
                disabled={values.notificationStatus === 'sent'}
                onChange={(event) => updateValue('notificationScheduledAt', event.target.value)}
                className={fieldClassName}
              />
              {values.status !== 'ACTIVE' ? (
                <span className="text-sm text-on-surface-variant">
                  Notification will only be sent while the promotion is active and inside the validity period.
                </span>
              ) : null}
              {errors.notificationScheduledAt ? (
                <span className="text-sm text-error">{errors.notificationScheduledAt}</span>
              ) : null}
            </label>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-outline-variant/60 px-5 py-3 text-sm font-bold text-primary hover:bg-surface-container-low"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {isSaving ? 'Saving...' : 'Save promotion'}
          </button>
        </div>
      </form>
    </div>
  );
};

const PromotionManagementPage = () => {
  const [promotions, setPromotions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    discountType: '',
    startDate: '',
    endDate: '',
    page: 1,
    limit: 10,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [modalPromotion, setModalPromotion] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailPromotion, setDetailPromotion] = useState(null);

  const loadPromotions = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await promotionAdminService.getPromotions(filters);
      setPromotions(response.data || []);
      setPagination(response.meta || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (error) {
      toast.error(error.message || 'Unable to load promotions');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadPromotions();
  }, [loadPromotions]);

  const modalInitialValues = useMemo(() => {
    if (!modalPromotion) {
      return null;
    }

    return {
      ...defaultFormValues,
      ...modalPromotion,
      startDate: toDateInput(modalPromotion.startDate),
      endDate: toDateInput(modalPromotion.endDate),
      routeIds: (modalPromotion.routeIds || []).join(', '),
      maxDiscountAmount: modalPromotion.maxDiscountAmount ?? '',
      usageLimit: modalPromotion.usageLimit ?? '',
      notifyPassengers: Boolean(modalPromotion.notifyPassengers),
      notificationScheduledAt: toDateTimeInput(modalPromotion.notificationScheduledAt),
    };
  }, [modalPromotion]);

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value, page: 1 }));
  };

  const handleSave = async (payload) => {
    if (modalPromotion?.usedCount > 0) {
      const confirmed = window.confirm(
        'This promotion already has successful usage. Existing paid orders keep their stored discount snapshot; changes apply only to future purchases. Continue?'
      );
      if (!confirmed) return;
    }

    setIsSaving(true);

    try {
      if (modalPromotion) {
        const response = await promotionAdminService.updatePromotion(modalPromotion._id, payload);
        const warnings = response?.data?.warnings || [];
        toast.success('Promotion updated successfully');
        warnings.forEach((warning) => toast.error(warning));
      } else {
        await promotionAdminService.createPromotion(payload);
        toast.success('Promotion created successfully');
      }

      setModalPromotion(null);
      setIsCreateOpen(false);
      await loadPromotions();
    } catch (error) {
      toast.error(error.message || 'Promotion save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusToggle = async (promotion) => {
    const nextStatus = promotion.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (nextStatus === 'INACTIVE' && promotion.usedCount > 0) {
      const confirmed = window.confirm(
        'Deactivate this promotion? New purchases cannot apply it, but existing paid orders remain unchanged.'
      );
      if (!confirmed) return;
    }

    try {
      await promotionAdminService.updatePromotionStatus(promotion._id, nextStatus);
      toast.success('Promotion status updated');
      await loadPromotions();
    } catch (error) {
      toast.error(error.message || 'Status update failed');
    }
  };

  return (
    <AdminPromotionShell
      title="Promotion Management"
      subtitle="Create, edit, filter, and control promotional campaigns for future passenger transactions."
      action={(
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary-container"
        >
          <Plus className="h-4 w-4" />
          Create Promotion
        </button>
      )}
    >
      <section className="rounded-[28px] border border-outline-variant/35 bg-white/80 p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_160px_180px_160px_160px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
            <input
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              className={`${fieldClassName} pl-11`}
              placeholder="Search code, name, description"
            />
          </label>
          <select
            value={filters.status}
            onChange={(event) => updateFilter('status', event.target.value)}
            className={fieldClassName}
          >
            <option value="">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="EXPIRED">Expired</option>
          </select>
          <select
            value={filters.discountType}
            onChange={(event) => updateFilter('discountType', event.target.value)}
            className={fieldClassName}
          >
            <option value="">All discount types</option>
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED_AMOUNT">Fixed amount</option>
          </select>
          <input
            type="date"
            value={filters.startDate}
            onChange={(event) => updateFilter('startDate', event.target.value)}
            className={fieldClassName}
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(event) => updateFilter('endDate', event.target.value)}
            className={fieldClassName}
          />
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-[28px] border border-outline-variant/35 bg-white/85 shadow-sm">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 px-5 py-4">
          <SlidersHorizontal className="h-5 w-5 text-on-tertiary-container" />
          <h2 className="text-lg font-bold text-primary">Promotion list</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-outline-variant/30 text-left text-sm">
            <thead className="bg-surface-container-low text-xs uppercase tracking-[0.14em] text-outline">
              <tr>
                <th className="px-5 py-4">Code</th>
                <th className="px-5 py-4">Name</th>
                <th className="px-5 py-4">Discount</th>
                <th className="px-5 py-4">Validity</th>
                <th className="px-5 py-4">Usage</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="px-5 py-10 text-center text-on-surface-variant">
                    Loading promotions...
                  </td>
                </tr>
              ) : promotions.length ? (
                promotions.map((promotion) => (
                  <tr key={promotion._id} className="hover:bg-surface-container-low/70">
                    <td className="px-5 py-4 font-bold text-primary">{promotion.code}</td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-on-surface">{promotion.name}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{promotion.applicableTo}</p>
                    </td>
                    <td className="px-5 py-4 text-on-surface">
                      {promotion.discountType === 'PERCENTAGE'
                        ? `${promotion.discountValue}%`
                        : `${promotion.discountValue?.toLocaleString()} VND`}
                    </td>
                    <td className="px-5 py-4 text-on-surface-variant">
                      {formatDate(promotion.startDate)} to {formatDate(promotion.endDate)}
                    </td>
                    <td className="px-5 py-4 text-on-surface">
                      {promotion.usedCount || 0}
                      {promotion.usageLimit ? ` / ${promotion.usageLimit}` : ''}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          statusClassName[promotion.status] || statusClassName.INACTIVE
                        }`}
                      >
                        {promotion.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          title="View detail"
                          onClick={() => setDetailPromotion(promotion)}
                          className="rounded-full p-2 text-primary hover:bg-surface-container"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          onClick={() => setModalPromotion(promotion)}
                          className="rounded-full p-2 text-primary hover:bg-surface-container"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Activate or deactivate"
                          disabled={promotion.status === 'EXPIRED'}
                          onClick={() => handleStatusToggle(promotion)}
                          className="rounded-full p-2 text-primary hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Power className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-5 py-10 text-center text-on-surface-variant">
                    No promotions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-outline-variant/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-on-surface-variant">
            Page {pagination.page} of {pagination.totalPages} - {pagination.total} promotions
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={filters.page <= 1}
              onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
              className="rounded-full border border-outline-variant/60 px-4 py-2 text-sm font-bold text-primary disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={filters.page >= pagination.totalPages}
              onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
              className="rounded-full border border-outline-variant/60 px-4 py-2 text-sm font-bold text-primary disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {(isCreateOpen || modalPromotion) ? (
        <PromotionFormModal
          initialValues={modalInitialValues}
          isSaving={isSaving}
          onClose={() => {
            setIsCreateOpen(false);
            setModalPromotion(null);
          }}
          onSubmit={handleSave}
        />
      ) : null}

      {detailPromotion ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
          <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-outline">
                  {detailPromotion.code}
                </p>
                <h2 className="mt-2 text-2xl font-headline font-extrabold text-primary">
                  {detailPromotion.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailPromotion(null)}
                className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                ['Description', detailPromotion.description || 'N/A'],
                ['Discount type', detailPromotion.discountType],
                ['Discount value', detailPromotion.discountValue],
                ['Max discount', detailPromotion.maxDiscountAmount ?? 'N/A'],
                ['Min order', detailPromotion.minOrderAmount],
                ['Applicable to', detailPromotion.applicableTo],
                ['Routes', detailPromotion.routeIds?.join(', ') || 'N/A'],
                ['Validity', `${formatDate(detailPromotion.startDate)} to ${formatDate(detailPromotion.endDate)}`],
                ['Usage', `${detailPromotion.usedCount || 0}${detailPromotion.usageLimit ? ` / ${detailPromotion.usageLimit}` : ''}`],
                ['Usage per user', detailPromotion.usagePerUser],
                ['Status', detailPromotion.status],
                [
                  'Notification',
                  detailPromotion.notifyPassengers
                    ? `${detailPromotion.notificationStatus || 'pending'} at ${detailPromotion.notificationScheduledAt ? formatDate(detailPromotion.notificationScheduledAt) : 'N/A'}`
                    : 'Disabled',
                ],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[20px] bg-surface-container-low p-4">
                  <dt className="text-xs font-bold uppercase tracking-[0.16em] text-outline">
                    {label}
                  </dt>
                  <dd className="mt-2 break-words text-sm font-semibold text-on-surface">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : null}
    </AdminPromotionShell>
  );
};

export default PromotionManagementPage;
