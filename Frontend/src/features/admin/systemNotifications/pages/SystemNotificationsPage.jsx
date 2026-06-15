import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  Eye,
  LoaderCircle,
  RefreshCcw,
  Send,
  XCircle,
} from 'lucide-react';
import toast from '../../../../shared/utils/toast.js';
import systemNotificationService from '../services/systemNotificationService.js';

const notificationTypes = [
  ['general', 'General'],
  ['route_update', 'Route update'],
  ['delay_alert', 'Delay alert'],
  ['service_interruption', 'Service interruption'],
  ['emergency', 'Emergency'],
  ['maintenance', 'Maintenance'],
  ['promotion', 'Promotion'],
];

const priorities = [
  ['low', 'Low'],
  ['normal', 'Normal'],
  ['high', 'High'],
  ['urgent', 'Urgent'],
];

const audiences = [
  ['all', 'All users'],
  ['passengers', 'Passengers'],
  ['drivers', 'Drivers'],
  ['bus_assistants', 'Bus assistants'],
  ['admins', 'Admins'],
  ['route_passengers', 'Route passengers'],
  ['trip_staff', 'Trip staff'],
  ['specific_users', 'Specific users'],
];

const fieldClassName = 'w-full rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-outline/70 focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20';

const defaultForm = {
  title: '',
  message: '',
  type: 'general',
  priority: 'normal',
  targetAudience: 'all',
  routeId: '',
  tripId: '',
  userIds: '',
  sendMode: 'now',
  scheduledAt: '',
  expiresAt: '',
};

const badgeClassName = {
  draft: 'bg-surface-container text-on-surface-variant',
  scheduled: 'bg-tertiary-container text-on-tertiary-container',
  sent: 'bg-secondary-container text-on-secondary-container',
  cancelled: 'bg-error-container text-on-error-container',
  urgent: 'bg-error text-on-error',
  high: 'bg-error-container text-on-error-container',
  normal: 'bg-primary-container text-primary',
  low: 'bg-surface-container text-on-surface-variant',
};

const formatDateTime = (value) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString();
};

const parseCsvIds = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const buildPayload = (form) => {
  const payload = {
    title: form.title.trim(),
    message: form.message.trim(),
    type: form.type,
    priority: form.priority,
    targetAudience: form.targetAudience,
    expiresAt: form.expiresAt || undefined,
  };

  if (form.targetAudience === 'route_passengers') payload.routeId = form.routeId.trim();
  if (form.targetAudience === 'trip_staff') payload.tripId = form.tripId.trim();
  if (form.targetAudience === 'specific_users') payload.userIds = parseCsvIds(form.userIds);
  if (form.sendMode === 'schedule' && form.scheduledAt) payload.scheduledAt = form.scheduledAt;

  return payload;
};

const validateForm = (form) => {
  const errors = {};
  if (!form.title.trim()) errors.title = 'Title is required';
  if (!form.message.trim()) errors.message = 'Message is required';
  if (form.targetAudience === 'route_passengers' && !form.routeId.trim()) errors.routeId = 'Route ID is required';
  if (form.targetAudience === 'trip_staff' && !form.tripId.trim()) errors.tripId = 'Trip ID is required';
  if (form.targetAudience === 'specific_users' && parseCsvIds(form.userIds).length === 0) errors.userIds = 'At least one user ID is required';
  if (form.sendMode === 'schedule' && !form.scheduledAt) errors.scheduledAt = 'Schedule time is required';
  return errors;
};

const PreviewPanel = ({ form }) => {
  const isUrgent = form.priority === 'urgent' || form.type === 'emergency';
  const audienceLabel = audiences.find(([value]) => value === form.targetAudience)?.[1] || form.targetAudience;

  return (
    <section className={`rounded-2xl border p-5 ${isUrgent ? 'border-error bg-error-container/80 text-on-error-container' : 'border-outline-variant/35 bg-white/85'}`}>
      <div className="flex items-center gap-3">
        {isUrgent ? <AlertTriangle className="h-5 w-5" /> : <BellRing className="h-5 w-5 text-primary" />}
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-outline">Preview</p>
          <h2 className="mt-1 text-lg font-headline font-black">{form.title || 'Notification title'}</h2>
        </div>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{form.message || 'Notification message appears here before broadcast.'}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full bg-surface px-3 py-1 text-primary">{audienceLabel}</span>
        <span className="rounded-full bg-surface px-3 py-1 text-primary">{form.type}</span>
        <span className={`rounded-full px-3 py-1 ${badgeClassName[form.priority] || badgeClassName.normal}`}>{form.priority}</span>
      </div>
    </section>
  );
};

const SystemNotificationsPage = () => {
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({ search: '', status: '', page: 1, limit: 10 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [detail, setDetail] = useState(null);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await systemNotificationService.getNotifications(filters);
      setNotifications(response.data || []);
      setPagination(response.meta || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (error) {
      toast.error(error.message || 'Unable to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const payloadPreview = useMemo(() => buildPayload(form), [form]);

  const updateForm = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'targetAudience') {
        next.routeId = '';
        next.tripId = '';
        next.userIds = '';
      }
      if (field === 'priority' && value === 'urgent') {
        next.type = next.type === 'general' ? 'emergency' : next.type;
      }
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSending(true);
    try {
      await systemNotificationService.broadcast(payloadPreview);
      toast.success(form.sendMode === 'schedule' ? 'Notification scheduled' : 'Notification broadcast sent');
      setForm(defaultForm);
      await loadNotifications();
    } catch (error) {
      toast.error(error.message || 'Broadcast failed');
    } finally {
      setIsSending(false);
    }
  };

  const cancelNotification = async (notification) => {
    try {
      await systemNotificationService.cancel(notification._id);
      toast.success('Notification cancelled');
      await loadNotifications();
    } catch (error) {
      toast.error(error.message || 'Unable to cancel notification');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-outline">Admin / System Notification Center</p>
          <h1 className="mt-2 text-3xl font-headline font-black text-primary">System Notifications</h1>
          <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
            Broadcast operational announcements, urgent alerts, route updates, and service notices to targeted BusDN users.
          </p>
        </div>
        <button
          type="button"
          onClick={loadNotifications}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-outline-variant/60 px-5 py-3 text-sm font-bold text-primary hover:bg-surface-container-low"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-outline-variant/35 bg-white/85 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Send className="h-5 w-5 text-on-tertiary-container" />
            <h2 className="text-lg font-bold text-primary">Create broadcast</h2>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-on-surface">Title</span>
              <input value={form.title} onChange={(event) => updateForm('title', event.target.value)} className={fieldClassName} placeholder="Service update for Route 03" />
              {errors.title ? <span className="text-sm text-error">{errors.title}</span> : null}
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-on-surface">Message</span>
              <textarea value={form.message} onChange={(event) => updateForm('message', event.target.value)} className={`${fieldClassName} min-h-[132px] resize-none`} placeholder="Write the announcement passengers and staff will receive." />
              {errors.message ? <span className="text-sm text-error">{errors.message}</span> : null}
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">Type</span>
              <select value={form.type} onChange={(event) => updateForm('type', event.target.value)} className={fieldClassName}>
                {notificationTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">Priority</span>
              <select value={form.priority} onChange={(event) => updateForm('priority', event.target.value)} className={fieldClassName}>
                {priorities.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">Target audience</span>
              <select value={form.targetAudience} onChange={(event) => updateForm('targetAudience', event.target.value)} className={fieldClassName}>
                {audiences.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">Delivery</span>
              <select value={form.sendMode} onChange={(event) => updateForm('sendMode', event.target.value)} className={fieldClassName}>
                <option value="now">Send now</option>
                <option value="schedule">Schedule</option>
              </select>
            </label>

            {form.targetAudience === 'route_passengers' ? (
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-on-surface">Route ID</span>
                <input value={form.routeId} onChange={(event) => updateForm('routeId', event.target.value)} className={fieldClassName} placeholder="Route ObjectId" />
                {errors.routeId ? <span className="text-sm text-error">{errors.routeId}</span> : null}
              </label>
            ) : null}

            {form.targetAudience === 'trip_staff' ? (
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-on-surface">Trip ID</span>
                <input value={form.tripId} onChange={(event) => updateForm('tripId', event.target.value)} className={fieldClassName} placeholder="Trip or trip schedule ObjectId" />
                {errors.tripId ? <span className="text-sm text-error">{errors.tripId}</span> : null}
              </label>
            ) : null}

            {form.targetAudience === 'specific_users' ? (
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-on-surface">User IDs</span>
                <input value={form.userIds} onChange={(event) => updateForm('userIds', event.target.value)} className={fieldClassName} placeholder="Comma separated user ObjectIds" />
                {errors.userIds ? <span className="text-sm text-error">{errors.userIds}</span> : null}
              </label>
            ) : null}

            {form.sendMode === 'schedule' ? (
              <label className="space-y-2">
                <span className="text-sm font-semibold text-on-surface">Scheduled at</span>
                <input type="datetime-local" value={form.scheduledAt} onChange={(event) => updateForm('scheduledAt', event.target.value)} className={fieldClassName} />
                {errors.scheduledAt ? <span className="text-sm text-error">{errors.scheduledAt}</span> : null}
              </label>
            ) : null}

            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">Expires at</span>
              <input type="datetime-local" value={form.expiresAt} onChange={(event) => updateForm('expiresAt', event.target.value)} className={fieldClassName} />
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setForm(defaultForm);
                setErrors({});
              }}
              className="rounded-full border border-outline-variant/60 px-5 py-3 text-sm font-bold text-primary hover:bg-surface-container-low"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={isSending}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {form.sendMode === 'schedule' ? 'Save schedule' : 'Broadcast now'}
            </button>
          </div>
        </form>

        <div className="space-y-6">
          <PreviewPanel form={form} />
          <section className="rounded-2xl border border-outline-variant/35 bg-white/85 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <CalendarClock className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-primary">Payload preview</h2>
            </div>
            <pre className="mt-4 max-h-[260px] overflow-auto rounded-2xl bg-surface-container-low p-4 text-xs text-on-surface-variant">
              {JSON.stringify(payloadPreview, null, 2)}
            </pre>
          </section>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-outline-variant/35 bg-white/85 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-outline-variant/30 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-primary">Notification history</h2>
            <p className="text-sm text-on-surface-variant">Stored broadcast records for audit and review.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_160px]">
            <input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))}
              className={fieldClassName}
              placeholder="Search title or message"
            />
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}
              className={fieldClassName}
            >
              <option value="">All status</option>
              <option value="sent">Sent</option>
              <option value="scheduled">Scheduled</option>
              <option value="cancelled">Cancelled</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-outline-variant/30 text-left text-sm">
            <thead className="bg-surface-container-low text-xs uppercase tracking-[0.14em] text-outline">
              <tr>
                <th className="px-5 py-4">Notification</th>
                <th className="px-5 py-4">Audience</th>
                <th className="px-5 py-4">Priority</th>
                <th className="px-5 py-4">Recipients</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Created</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {isLoading ? (
                <tr><td colSpan="7" className="px-5 py-10 text-center text-on-surface-variant">Loading notifications...</td></tr>
              ) : notifications.length ? notifications.map((notification) => (
                <tr key={notification._id} className={notification.priority === 'urgent' || notification.type === 'emergency' ? 'bg-error-container/30' : 'hover:bg-surface-container-low/70'}>
                  <td className="px-5 py-4">
                    <p className="font-bold text-primary">{notification.title}</p>
                    <p className="mt-1 line-clamp-1 max-w-md text-xs text-on-surface-variant">{notification.message}</p>
                    <p className="mt-1 text-xs font-semibold text-outline">{notification.type}</p>
                  </td>
                  <td className="px-5 py-4 text-on-surface">{notification.targetAudience}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${badgeClassName[notification.priority] || badgeClassName.normal}`}>{notification.priority}</span>
                  </td>
                  <td className="px-5 py-4 text-on-surface">{notification.deliverySummary?.resolvedCount ?? notification.recipientUserIds?.length ?? 0}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${badgeClassName[notification.status] || badgeClassName.draft}`}>{notification.status}</span>
                  </td>
                  <td className="px-5 py-4 text-on-surface-variant">{formatDateTime(notification.createdAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button type="button" title="View detail" onClick={() => setDetail(notification)} className="rounded-full p-2 text-primary hover:bg-surface-container">
                        <Eye className="h-4 w-4" />
                      </button>
                      {notification.status === 'scheduled' ? (
                        <button type="button" title="Cancel" onClick={() => cancelNotification(notification)} className="rounded-full p-2 text-error hover:bg-error-container">
                          <XCircle className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="7" className="px-5 py-10 text-center text-on-surface-variant">No notification records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-outline-variant/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-on-surface-variant">Page {pagination.page} of {pagination.totalPages} - {pagination.total} records</p>
          <div className="flex gap-2">
            <button type="button" disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))} className="rounded-full border border-outline-variant/60 px-4 py-2 text-sm font-bold text-primary disabled:opacity-40">Previous</button>
            <button type="button" disabled={filters.page >= pagination.totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))} className="rounded-full border border-outline-variant/60 px-4 py-2 text-sm font-bold text-primary disabled:opacity-40">Next</button>
          </div>
        </div>
      </section>

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-outline">{detail.targetAudience}</p>
                <h2 className="mt-2 text-2xl font-headline font-extrabold text-primary">{detail.title}</h2>
              </div>
              <button type="button" onClick={() => setDetail(null)} className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-on-surface">{detail.message}</p>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                ['Type', detail.type],
                ['Priority', detail.priority],
                ['Status', detail.status],
                ['Route ID', detail.routeId || 'N/A'],
                ['Trip ID', detail.tripId || 'N/A'],
                ['Scheduled', formatDateTime(detail.scheduledAt)],
                ['Expires', formatDateTime(detail.expiresAt)],
                ['Sent', formatDateTime(detail.deliverySummary?.sentAt)],
                ['Recipients', detail.deliverySummary?.resolvedCount ?? detail.recipientUserIds?.length ?? 0],
                ['Created by', detail.createdBy?.fullName || detail.createdBy?.email || 'Admin'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-surface-container-low p-4">
                  <dt className="text-xs font-bold uppercase tracking-[0.16em] text-outline">{label}</dt>
                  <dd className="mt-2 break-words text-sm font-semibold text-on-surface">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SystemNotificationsPage;
