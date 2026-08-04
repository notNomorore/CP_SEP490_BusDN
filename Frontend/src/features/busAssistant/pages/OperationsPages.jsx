import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  RefreshCw,
  Route,
  Send,
  UserRound,
  XCircle,
} from 'lucide-react';
import useTheme from '../../../shared/hooks/useTheme.js';
import useLanguage from '../../../shared/hooks/useLanguage.js';
import useAuthStore from '../../auth/stores/authStore.js';
import scheduleOperationsService from '../../scheduleOperations/services/scheduleOperationsService.js';
import { translateBusAssistantPhrase } from '../busAssistantPhraseTranslations.js';

const toInputDate = (date) => date.toISOString().slice(0, 10);

const toLocalInputDate = (date) => {
  const value = new Date(date);
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
};

const addCalendarDays = (value, days) => {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toLocalInputDate(date);
};

const getWeekRange = (anchor = new Date()) => {
  const date = new Date(`${toLocalInputDate(anchor)}T00:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  const from = toLocalInputDate(date);
  return { from, to: addCalendarDays(from, 6) };
};

const getLocale = (language) => (language === 'vi' ? 'vi-VN' : 'en-US');

const formatShiftDate = (value, language = 'vi') => new Date(`${value}T00:00:00`).toLocaleDateString(getLocale(language), {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});

const formatShortDate = (value, language = 'vi') => {
  if (!value) return '--/--';
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(getLocale(language), { day: '2-digit', month: '2-digit' });
};

const formatCompactDate = (value, language = 'vi') => {
  if (!value) return '--/--/----';
  const [year, month, day] = value.split('-');
  return language === 'vi' ? `${day}/${month}/${year}` : `${month}/${day}/${year}`;
};

const toShiftMinutes = (value) => {
  if (!value) return null;
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const getShiftDurationHours = (shift) => {
  const start = toShiftMinutes(shift.startTime);
  const end = toShiftMinutes(shift.endTime);
  if (start === null || end === null) return 0;
  const minutes = end >= start ? end - start : end + (24 * 60) - start;
  return minutes / 60;
};

const formatHours = (value) => `${Number(value || 0).toFixed(1).replace('.0', '')}h`;

const isWorkShiftSchedule = (shift = {}) => {
  const source = String(shift.source || '').toUpperCase();
  const code = String(shift.shiftCode || '').toUpperCase();
  return source !== 'TRIP_SCHEDULE' && !code.startsWith('TRIP-');
};

const getDefaultRange = () => {
  const from = new Date();
  from.setDate(from.getDate() - 7);
  const to = new Date();
  to.setDate(to.getDate() + 7);

  return {
    from: toInputDate(from),
    to: toInputDate(to),
  };
};

const getErrorMessage = (error) => (
  error?.response?.data?.message
  || error?.message
  || 'Could not load data. Please try again.'
);

const formatDate = (value, language = 'vi') => {
  if (!value) return 'Not available';
  return new Date(value).toLocaleDateString(getLocale(language), {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatTime = (value, language = 'vi') => {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString(getLocale(language), {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateTime = (value, language = 'vi') => {
  if (!value) return 'No update time available';
  return new Date(value).toLocaleString(getLocale(language), {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const statusLabels = {
  PENDING: 'Pending acceptance',
  ASSIGNED: 'Assigned',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  READY: 'Vehicle ready',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const statusClass = {
  PENDING: 'bg-amber-100 text-amber-900',
  ASSIGNED: 'bg-amber-100 text-amber-900',
  ACCEPTED: 'bg-emerald-100 text-emerald-800',
  READY: 'bg-emerald-100 text-emerald-800',
  IN_PROGRESS: 'bg-cyan-100 text-cyan-800',
  COMPLETED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-rose-100 text-rose-800',
  CANCELLED: 'bg-rose-100 text-rose-800',
  SCHEDULED: 'bg-slate-100 text-slate-700',
};

const incidentStatusLabels = {
  PENDING: 'Pending',
  IN_PROGRESS: 'Processing',
  RESOLVED: 'Resolved',
  REJECTED: 'Closed',
};

const busAssistantIncidentTypes = [
  {
    value: 'PASSENGER_VIOLATION',
    title: 'Report passenger violation',
    description: 'Record a passenger bus-rule, ticket, or safety violation.',
  },
  {
    value: 'PASSENGER_CONFLICT',
    title: 'Report passenger conflict',
    description: 'Record a dispute, argument, or situation requiring operation support.',
  },
  {
    value: 'FOUND_ITEM',
    title: 'Report found item',
    description: 'Record lost property found on the bus for lost-and-found handling.',
  },
];

const violationCategories = [
  { value: 'NO_TICKET', label: 'No ticket / ticket not scanned' },
  { value: 'WRONG_TICKET', label: 'Wrong ticket type' },
  { value: 'SMOKING', label: 'Smoking on the bus' },
  { value: 'LITTERING', label: 'Littering on the bus' },
  { value: 'UNSAFE_BEHAVIOR', label: 'Unsafe behavior' },
  { value: 'DISTURBANCE', label: 'Noise / disturbing passengers' },
  { value: 'OTHER', label: 'Other' },
];

const conflictCategories = [
  { value: 'ARGUMENT', label: 'Argument / disturbance' },
  { value: 'FARE_DISPUTE', label: 'Fare / payment dispute' },
  { value: 'SEAT_DISPUTE', label: 'Seat dispute' },
  { value: 'HARASSMENT', label: 'Harassment / threat' },
  { value: 'SAFETY_RISK', label: 'Safety risk' },
  { value: 'OTHER', label: 'Other' },
];

const incidentSeverities = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

const getTripTitle = (assignment) => {
  const route = assignment.route || {};
  return `${route.origin || 'Start point'} → ${route.destination || route.name || 'End point'}`;
};

const PageShell = ({
  title,
  subtitle,
  icon: Icon,
  children,
  filters,
  setFilters,
  onRefresh,
  isLoading,
  error,
  success,
}) => {
  const { isDarkMode } = useTheme();
  const shellClass = isDarkMode
    ? 'rounded border border-white/10 bg-white/[0.04] text-slate-100'
    : 'rounded border border-emerald-100 bg-white text-slate-950 shadow-sm';
  const inputClass = isDarkMode
    ? 'rounded border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400'
    : 'rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-emerald-500';
  const mutedText = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <section className={shellClass}>
      <div className={isDarkMode ? 'border-b border-white/10 p-4' : 'border-b border-slate-200 p-4'}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
              <Icon size={16} />
              Bus Assistant Operations
            </p>
            <h1 className="mt-2 text-xl font-black">{title}</h1>
            <p className={`mt-1 text-sm ${mutedText}`}>{subtitle}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input
              type="date"
              className={inputClass}
              value={filters.from}
              onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
            />
            <input
              type="date"
              className={inputClass}
              value={filters.to}
              onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
            />
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-60"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        {error ? <div className="mb-4 rounded border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">{error}</div> : null}
        {success ? <div className="mb-4 rounded border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">{success}</div> : null}
        {children}
      </div>
    </section>
  );
};

const BusAssistantIncidentPanel = ({ assignment, isProcessing, onReportIncident }) => {
  const { isDarkMode } = useTheme();
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    type: assignment.tripStatus === 'COMPLETED' ? 'FOUND_ITEM' : 'PASSENGER_VIOLATION',
    severity: 'MEDIUM',
    violationCategory: 'NO_TICKET',
    passengerDescription: '',
    conflictCategory: 'ARGUMENT',
    partiesInvolved: '',
    actionTaken: '',
    itemName: '',
    itemDescription: '',
    foundLocation: '',
    handedTo: '',
    description: '',
  });

  const mutedText = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const inputClass = isDarkMode
    ? 'w-full rounded border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400'
    : 'w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-emerald-500';
  const canReportRunning = assignment.tripStatus === 'IN_PROGRESS';
  const canReportFoundItem = assignment.tripStatus === 'COMPLETED';
  const allowedTypes = busAssistantIncidentTypes.filter((type) => (
    canReportFoundItem ? type.value === 'FOUND_ITEM' : type.value !== 'FOUND_ITEM'
  ));
  const canUseForm = assignment.actorRole === 'BUS_ASSISTANT'
    && assignment.acceptanceStatus === 'ACCEPTED'
    && (canReportRunning || canReportFoundItem);

  useEffect(() => {
    if (!allowedTypes.some((type) => type.value === form.type)) {
      setForm((current) => ({ ...current, type: allowedTypes[0]?.value || 'PASSENGER_VIOLATION' }));
    }
  }, [allowedTypes, form.type]);

  if (!canUseForm) return null;

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = () => {
    if (form.description.trim().length < 10) {
      window.alert(translateBusAssistantPhrase('Please describe the situation using at least 10 characters.', language));
      return;
    }
    if (form.type === 'PASSENGER_VIOLATION' && form.actionTaken.trim().length < 3) {
      window.alert(translateBusAssistantPhrase('Please enter the action taken for the passenger violation.', language));
      return;
    }
    if (form.type === 'PASSENGER_CONFLICT' && form.actionTaken.trim().length < 3) {
      window.alert(translateBusAssistantPhrase('Please enter the action taken for the conflict.', language));
      return;
    }
    if (form.type === 'FOUND_ITEM' && (form.itemName.trim().length < 2 || form.foundLocation.trim().length < 3)) {
      window.alert(translateBusAssistantPhrase('Please enter the found item name and where it was found.', language));
      return;
    }

    onReportIncident(assignment.id, {
      ...form,
      severity: form.type === 'FOUND_ITEM' ? 'LOW' : form.severity,
      locationText: form.type === 'FOUND_ITEM' ? form.foundLocation : getTripTitle(assignment),
    });
    setIsOpen(false);
    setForm((current) => ({
      ...current,
      passengerDescription: '',
      partiesInvolved: '',
      actionTaken: '',
      itemName: '',
      itemDescription: '',
      foundLocation: '',
      handedTo: '',
      description: '',
    }));
  };

  return (
    <section className={isDarkMode ? 'mt-4 rounded border border-rose-400/30 bg-rose-500/10 p-4' : 'mt-4 rounded border border-rose-100 bg-rose-50/80 p-4'}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-rose-600" />
            <p className="font-black">Trip incident report</p>
          </div>
          <p className={`mt-1 text-sm ${mutedText}`}>
            Report passenger violations or conflicts while the trip is running. Found items can be reported after trip completion.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          disabled={isProcessing}
          className="inline-flex items-center justify-center gap-2 rounded bg-rose-700 px-4 py-2 text-sm font-black text-white hover:bg-rose-800 disabled:opacity-50"
        >
          <AlertTriangle size={16} />
          {isOpen ? 'Close report' : 'Report incident'}
        </button>
      </div>

      {isOpen ? (
        <div className="mt-4 space-y-4 rounded bg-white/80 p-4">
          <div className="grid gap-3 lg:grid-cols-3">
            {allowedTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => updateForm('type', type.value)}
                disabled={isProcessing}
                className={`rounded border p-3 text-left ${
                  form.type === type.value
                    ? 'border-emerald-500 bg-emerald-100 text-emerald-950'
                    : 'border-slate-200 bg-white text-slate-900'
                }`}
              >
                <p className="font-black">{type.title}</p>
                <p className="mt-1 text-xs text-slate-500">{type.description}</p>
              </button>
            ))}
          </div>

          {form.type !== 'FOUND_ITEM' ? (
            <label className="block space-y-1">
              <span className={`text-xs font-bold uppercase ${mutedText}`}>Severity</span>
              <select className={inputClass} value={form.severity} onChange={(event) => updateForm('severity', event.target.value)} disabled={isProcessing}>
                {incidentSeverities.map((severity) => <option key={severity.value} value={severity.value}>{severity.label}</option>)}
              </select>
            </label>
          ) : null}

          {form.type === 'PASSENGER_VIOLATION' ? (
            <div className="grid gap-3 lg:grid-cols-3">
              <label className="space-y-1">
                <span className={`text-xs font-bold uppercase ${mutedText}`}>Violation type</span>
                <select className={inputClass} value={form.violationCategory} onChange={(event) => updateForm('violationCategory', event.target.value)} disabled={isProcessing}>
                  {violationCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className={`text-xs font-bold uppercase ${mutedText}`}>Passenger description</span>
                <input className={inputClass} value={form.passengerDescription} onChange={(event) => updateForm('passengerDescription', event.target.value)} disabled={isProcessing} placeholder="Example: blue shirt, standing near the rear door" />
              </label>
              <label className="space-y-1">
                <span className={`text-xs font-bold uppercase ${mutedText}`}>Action taken</span>
                <input className={inputClass} value={form.actionTaken} onChange={(event) => updateForm('actionTaken', event.target.value)} disabled={isProcessing} placeholder="Example: reminded about rules, requested ticket scan" />
              </label>
            </div>
          ) : null}

          {form.type === 'PASSENGER_CONFLICT' ? (
            <div className="grid gap-3 lg:grid-cols-3">
              <label className="space-y-1">
                <span className={`text-xs font-bold uppercase ${mutedText}`}>Conflict category</span>
                <select className={inputClass} value={form.conflictCategory} onChange={(event) => updateForm('conflictCategory', event.target.value)} disabled={isProcessing}>
                  {conflictCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className={`text-xs font-bold uppercase ${mutedText}`}>Parties involved</span>
                <input className={inputClass} value={form.partiesInvolved} onChange={(event) => updateForm('partiesInvolved', event.target.value)} disabled={isProcessing} placeholder="Example: 2 passengers in the middle-row seats" />
              </label>
              <label className="space-y-1">
                <span className={`text-xs font-bold uppercase ${mutedText}`}>Action taken</span>
                <input className={inputClass} value={form.actionTaken} onChange={(event) => updateForm('actionTaken', event.target.value)} disabled={isProcessing} placeholder="Example: separated passengers, notified driver" />
              </label>
            </div>
          ) : null}

          {form.type === 'FOUND_ITEM' ? (
            <div className="grid gap-3 lg:grid-cols-3">
              <label className="space-y-1">
                <span className={`text-xs font-bold uppercase ${mutedText}`}>Item name</span>
                <input className={inputClass} value={form.itemName} onChange={(event) => updateForm('itemName', event.target.value)} disabled={isProcessing} placeholder="Example: black leather wallet" />
              </label>
              <label className="space-y-1">
                <span className={`text-xs font-bold uppercase ${mutedText}`}>Found location</span>
                <input className={inputClass} value={form.foundLocation} onChange={(event) => updateForm('foundLocation', event.target.value)} disabled={isProcessing} placeholder="Example: seat 12" />
              </label>
              <label className="space-y-1">
                <span className={`text-xs font-bold uppercase ${mutedText}`}>Handed over to</span>
                <input className={inputClass} value={form.handedTo} onChange={(event) => updateForm('handedTo', event.target.value)} disabled={isProcessing} placeholder="Example: terminal operations desk" />
              </label>
            </div>
          ) : null}

          <label className="block space-y-1">
            <span className={`text-xs font-bold uppercase ${mutedText}`}>Detailed description</span>
            <textarea
              className={inputClass}
              rows={3}
              value={form.description}
              onChange={(event) => updateForm('description', event.target.value)}
              disabled={isProcessing}
              placeholder="Describe the situation clearly and include the action taken."
            />
          </label>

          <button
            type="button"
            onClick={submit}
            disabled={isProcessing}
            className="inline-flex items-center justify-center gap-2 rounded bg-rose-700 px-4 py-2 text-sm font-black text-white hover:bg-rose-800 disabled:opacity-50"
          >
            <Send size={16} />
            Submit report
          </button>
        </div>
      ) : null}
    </section>
  );
};

const TripCard = ({ assignment, onAccept, onReject, onReportIncident, isProcessing }) => {
  const { isDarkMode } = useTheme();
  const mutedText = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const status = assignment.acceptanceStatus || assignment.shiftStatus || assignment.tripStatus;
  const canDecide = ['PENDING', 'ASSIGNED'].includes(assignment.acceptanceStatus || assignment.shiftStatus);
  const isAssistantAccepted = assignment.actorRole === 'BUS_ASSISTANT'
    && assignment.acceptanceStatus === 'ACCEPTED'
    && !['IN_PROGRESS', 'COMPLETED'].includes(assignment.tripStatus);
  const isAssistantRejected = assignment.actorRole === 'BUS_ASSISTANT'
    && assignment.acceptanceStatus === 'REJECTED';
  return (
    <article className={isDarkMode ? 'rounded border border-white/10 bg-slate-950 p-4' : 'rounded border border-slate-200 bg-white p-4'}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-emerald-500 px-2 py-1 text-xs font-black text-white">
              {assignment.route?.routeNumber || 'BUS'}
            </span>
            <span className="text-sm font-bold text-slate-500">{assignment.tripCode || assignment.shiftCode}</span>
          </div>
          <h2 className="mt-2 text-lg font-black">{getTripTitle(assignment)}</h2>
          <p className={`mt-1 text-sm ${mutedText}`}>{assignment.route?.name || 'Route name unavailable'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass[status] || statusClass.SCHEDULED}`}>
            {statusLabels[status] || status}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass[assignment.tripStatus] || statusClass.SCHEDULED}`}>
            {statusLabels[assignment.tripStatus] || assignment.tripStatus}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <InfoBox label="Operation date" value={formatDate(assignment.scheduledStart)} icon={CalendarDays} />
        <InfoBox label="Time" value={`${formatTime(assignment.scheduledStart)} - ${formatTime(assignment.scheduledEnd)}`} icon={Clock3} />
        <InfoBox label="Vehicle" value={assignment.vehicle?.plateNumber || assignment.vehicle?.code || 'Not available'} icon={Route} />
        <InfoBox label="Role" value="Bus assistant" icon={CheckCircle2} />
      </div>

      <div className={isDarkMode ? 'mt-4 rounded bg-white/5 p-3 text-sm' : 'mt-4 rounded bg-slate-50 p-3 text-sm'}>
        <p><span className={mutedText}>Driver:</span> <strong>{assignment.driver?.fullName || 'Not assigned'}</strong></p>
        <p className="mt-1"><span className={mutedText}>Notes:</span> {assignment.notes || 'No notes.'}</p>
      </div>

      {isAssistantAccepted ? (
        <div className="mt-4 rounded border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">
          The bus assistant accepted this trip. Please wait for the driver to begin operation.
        </div>
      ) : null}

      {isAssistantRejected ? (
        <div className="mt-4 rounded border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">
          The bus assistant rejected this trip. The reason was sent to the administrator for reassignment.
        </div>
      ) : null}

      {canDecide ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => onReject(assignment.id)}
            disabled={isProcessing}
            className="inline-flex items-center justify-center gap-2 rounded border border-rose-300 px-4 py-2 text-sm font-black text-rose-600 disabled:opacity-50"
          >
            <XCircle size={16} />
            Reject trip
          </button>
          <button
            type="button"
            onClick={() => onAccept(assignment.id)}
            disabled={isProcessing}
            className="inline-flex items-center justify-center gap-2 rounded bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50"
          >
            <CheckCircle2 size={16} />
            Accept trip
          </button>
        </div>
      ) : null}

      <BusAssistantIncidentPanel
        assignment={assignment}
        isProcessing={isProcessing}
        onReportIncident={onReportIncident}
      />

    </article>
  );
};

const InfoBox = ({ label, value, icon: Icon }) => (
  <div className="rounded bg-emerald-50 px-3 py-3 text-slate-950">
    <p className="flex items-center gap-2 text-xs font-black uppercase text-slate-500">
      <Icon size={15} className="text-emerald-700" />
      {label}
    </p>
    <p className="mt-1 font-black">{value}</p>
  </div>
);

const EmptyState = ({ children }) => {
  const { isDarkMode } = useTheme();
  return (
    <div className={isDarkMode ? 'rounded border border-dashed border-white/10 p-10 text-center text-slate-400' : 'rounded border border-dashed border-slate-300 p-10 text-center text-slate-500'}>
      {children}
    </div>
  );
};

const OperationNotificationCard = ({ notification }) => {
  const { isDarkMode } = useTheme();
  const { language } = useLanguage();
  const metadata = notification.metadata || {};
  const isIncidentResponse = notification.sourceType === 'INCIDENT_REPORT_STATUS'
    || metadata.notificationKind === 'INCIDENT_RESPONSE';
  const status = metadata.currentStatus;
  const statusLabel = translateBusAssistantPhrase(
    metadata.currentStatusLabel || incidentStatusLabels[status] || status,
    language
  );
  const title = translateBusAssistantPhrase(notification.title, language);
  const messageLines = String(notification.message || '')
    .split('\n')
    .map((line) => translateBusAssistantPhrase(line.trim(), language))
    .filter(Boolean);
  const cardClass = isDarkMode
    ? 'rounded border border-white/10 bg-slate-950 p-4 text-slate-100'
    : 'rounded border border-emerald-100 bg-white p-4 text-slate-950 shadow-sm';
  const iconClass = isIncidentResponse
    ? 'bg-emerald-100 text-emerald-800'
    : 'bg-cyan-100 text-cyan-800';
  const statusChipClass = {
    PENDING: 'bg-amber-100 text-amber-900',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    RESOLVED: 'bg-emerald-100 text-emerald-800',
    REJECTED: 'bg-slate-100 text-slate-700',
  }[status] || 'bg-slate-100 text-slate-700';

  return (
    <article className={cardClass}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className={`mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
            {isIncidentResponse ? <CheckCircle2 size={20} /> : <BellRing size={20} />}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {statusLabel ? (
                <span className={`rounded-full px-3 py-1 text-xs font-black ${statusChipClass}`}>
                  {statusLabel}
                </span>
              ) : null}
            </div>
            <h2 className="mt-2 text-lg font-black">{title}</h2>
            <div className={isDarkMode ? 'mt-2 space-y-1 text-sm text-slate-300' : 'mt-2 space-y-1 text-sm text-slate-600'}>
              {messageLines.length ? messageLines.map((line) => (
                <p key={line}>{line}</p>
              )) : <p>No details available.</p>}
            </div>
          </div>
        </div>
        <p className={isDarkMode ? 'shrink-0 text-xs font-semibold text-slate-400' : 'shrink-0 text-xs font-semibold text-slate-500'}>
          {formatDateTime(notification.updatedAt || notification.createdAt || notification.activeFrom, language)}
        </p>
      </div>
    </article>
  );
};

export const AssignedTripsPage = () => {
  const { language } = useLanguage();
  const [filters, setFilters] = useState(getDefaultRange);
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const payload = await scheduleOperationsService.getAssignedTrips(filters);
      setAssignments(payload.trips || []);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const runDecision = async (assignmentId, action, message) => {
    setProcessingId(assignmentId);
    setError('');
    setSuccess('');
    try {
      await action();
      setSuccess(message);
      await load();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setProcessingId('');
    }
  };

  const rejectTrip = (assignmentId) => {
    const reason = window.prompt(translateBusAssistantPhrase('Enter a reason for rejecting the assigned trip:', language));
    if (!reason?.trim()) return;
    runDecision(
      assignmentId,
      () => scheduleOperationsService.rejectAssignedTrip(assignmentId, { reason: reason.trim() }),
      'The trip rejection was sent to operations.'
    );
  };

  const reportIncident = (assignmentId, payload) => {
    runDecision(
      assignmentId,
      () => scheduleOperationsService.reportOperationIncident(assignmentId, payload),
      'The report was sent to operations. You may submit another report for a new situation.'
    );
  };

  return (
    <PageShell
      title="Assigned trips"
      subtitle="View trips assigned by operations and accept or reject them when necessary."
      icon={Route}
      filters={filters}
      setFilters={setFilters}
      onRefresh={load}
      isLoading={isLoading}
      error={error}
      success={success}
    >
      <div className="space-y-4">
        {assignments.length ? assignments.map((assignment) => (
          <TripCard
            key={assignment.id}
            assignment={assignment}
            isProcessing={processingId === assignment.id}
            onAccept={(assignmentId) => runDecision(
              assignmentId,
              () => scheduleOperationsService.acceptAssignedTrip(assignmentId),
              'The assigned trip was accepted.'
            )}
            onReject={rejectTrip}
            onReportIncident={reportIncident}
          />
        )) : <EmptyState>No trips were assigned during this period.</EmptyState>}
      </div>
    </PageShell>
  );
};

export const ShiftSchedulePage = () => {
  const { language } = useLanguage();
  const [filters, setFilters] = useState(() => getWeekRange());
  const [shifts, setShifts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuthStore();

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const payload = await scheduleOperationsService.getShiftSchedule(filters);
      setShifts(payload.shifts || []);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const weekDays = useMemo(() => (
    Array.from({ length: 7 }, (_, index) => addCalendarDays(filters.from, index))
  ), [filters.from]);

  const workShifts = useMemo(() => shifts.filter(isWorkShiftSchedule), [shifts]);

  const shiftsByDate = useMemo(() => workShifts.reduce((result, shift) => {
    const key = toLocalInputDate(shift.workDate);
    result[key] = [...(result[key] || []), shift];
    return result;
  }, {}), [workShifts]);

  const weeklyStats = useMemo(() => {
    const totalHours = workShifts.reduce((total, shift) => total + getShiftDurationHours(shift), 0);
    const assignedCount = workShifts.filter((shift) => ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(shift.assignmentStatus)).length;
    const completedCount = workShifts.filter((shift) => shift.assignmentStatus === 'COMPLETED').length;

    return {
      totalHours,
      shiftCount: workShifts.length,
      assignedCount,
      completedCount,
    };
  }, [workShifts]);

  const changeWeek = (offset) => {
    setFilters(getWeekRange(addCalendarDays(filters.from, offset * 7)));
  };

  const selectWeek = (value) => {
    if (value) setFilters(getWeekRange(value));
  };

  const profileName = user?.fullName || user?.name || 'BusDN bus assistant';
  const profileId = user?.employeeCode || user?.staffCode || user?.username || user?.email || 'BUS-ASSISTANT';

  return (
    <section className="min-h-[calc(100vh-96px)] rounded-[32px] bg-[#effaf5] p-5 text-[#061c13] shadow-[0_24px_60px_rgba(0,26,15,0.08)] lg:p-8">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight">Shift schedule</h1>
            <span className="hidden h-7 w-px bg-emerald-950/10 sm:block" />
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900/75">
              <CalendarDays size={17} />
              {formatCompactDate(filters.from, language)} - {formatCompactDate(filters.to, language)}
            </span>
          </div>
          <p className="mt-8 text-3xl font-black tracking-tight lg:text-4xl">Bus assistant activity</p>
          <p className="mt-2 max-w-2xl text-base text-emerald-950/72">
            Track your assigned shifts by week. Your shift details appear here.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-5 py-3 text-sm font-black text-emerald-950 shadow-[0_10px_26px_rgba(0,26,15,0.06)]">
            <CheckCircle2 size={18} className="text-emerald-500" />
            System Status: Active
          </span>
          <button
            type="button"
            onClick={load}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-full bg-[#001f14] px-6 py-4 text-sm font-black text-white shadow-[0_18px_34px_rgba(0,26,15,0.22)] disabled:opacity-60"
          >
            <Plus size={18} />
            Refresh
          </button>
        </div>
      </header>

      {error ? <div className="mt-5 rounded-2xl bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700 shadow-[0_12px_30px_rgba(127,29,29,0.08)]">{error}</div> : null}

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#00452d] text-white shadow-[0_12px_26px_rgba(0,26,15,0.18)]">
            <CalendarDays size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black">Weekly work schedule</h2>
            <p className="text-sm font-semibold text-emerald-950/60">
              {formatCompactDate(filters.from, language)} - {formatCompactDate(filters.to, language)} · {workShifts.length} assigned shifts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => changeWeek(-1)} className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white text-emerald-950 shadow-[0_10px_24px_rgba(0,26,15,0.06)]" title="Previous week">
            <ChevronLeft size={20} />
          </button>
          <input
            type="date"
            value={filters.from}
            onChange={(event) => selectWeek(event.target.value)}
            className="h-12 rounded-xl bg-white px-4 text-sm font-bold text-emerald-950 outline-none shadow-[0_10px_24px_rgba(0,26,15,0.06)]"
            aria-label="Select a day in the week to view"
          />
          <button type="button" onClick={() => setFilters(getWeekRange())} className="h-12 rounded-xl bg-white px-5 text-sm font-black text-emerald-950 shadow-[0_10px_24px_rgba(0,26,15,0.06)]">
            This week
          </button>
          <button type="button" onClick={() => changeWeek(1)} className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white text-emerald-950 shadow-[0_10px_24px_rgba(0,26,15,0.06)]" title="Next week">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto pb-2">
        <div className="grid min-w-[1120px] grid-cols-7 gap-4">
          {weekDays.map((date) => {
            const dayShifts = shiftsByDate[date] || [];
            const isToday = date === toLocalInputDate(new Date());
            return (
              <section
                key={date}
                className={`min-h-[290px] rounded-[28px] p-5 shadow-[0_16px_32px_rgba(0,26,15,0.05)] ${
                  isToday ? 'bg-[#00452d] text-white ring-4 ring-emerald-100' : 'bg-[#e8f4ef] text-emerald-950'
                }`}
              >
                <div>
                  <p className={`text-xs font-black uppercase tracking-[0.18em] ${isToday ? 'text-emerald-300' : 'text-emerald-900/55'}`}>
                    {formatShiftDate(date, language)}
                  </p>
                  <p className="mt-1 text-2xl font-black">{formatShortDate(date, language)}</p>
                </div>

                <div className="mt-5 space-y-3">
                  {dayShifts.length ? dayShifts.map((shift) => (
                    <article
                      key={shift.id || `${shift.workDate}-${shift.startTime}-${shift.endTime}`}
                      className={`rounded-2xl p-5 shadow-[0_12px_24px_rgba(0,26,15,0.08)] ${
                        isToday ? 'bg-white/12 text-white' : 'bg-white text-emerald-950'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-lg font-black">{shift.startTime} - {shift.endTime}</p>
                        <span className="shrink-0 rounded-full bg-emerald-300 px-3 py-1 text-[10px] font-black uppercase text-emerald-950">
                          {statusLabels[shift.assignmentStatus] || 'Assigned'}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-black">{shift.shiftName || 'Work shift'}</p>
                      <p className={`mt-4 text-xs leading-5 ${isToday ? 'text-white/78' : 'text-emerald-950/62'}`}>
                        {shift.description || shift.notes || 'This shift was assigned automatically from the operation schedule.'}
                      </p>
                    </article>
                  )) : (
                    <div className={`rounded-2xl px-4 py-8 text-center text-sm font-semibold ${isToday ? 'bg-white/12 text-white/70' : 'bg-white/70 text-emerald-950/45'}`}>
                      No shifts
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_320px]">
        <section className="rounded-[28px] bg-white p-7 shadow-[0_20px_40px_rgba(0,26,15,0.06)]">
          <h2 className="text-xl font-black">This week's performance</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-[#f2fcf8] p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-950/55">Total hours</p>
              <p className="mt-3 text-2xl font-black">{formatHours(weeklyStats.totalHours)}</p>
            </div>
            <div className="rounded-2xl bg-[#f2fcf8] p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-950/55">Number of shifts</p>
              <p className="mt-3 text-2xl font-black">{String(weeklyStats.shiftCount).padStart(2, '0')}</p>
            </div>
            <div className="rounded-2xl bg-[#f2fcf8] p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-950/55">Assigned</p>
              <p className="mt-3 text-2xl font-black text-emerald-600">{weeklyStats.assignedCount}</p>
            </div>
            <div className="rounded-2xl bg-[#f2fcf8] p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-950/55">Completed</p>
              <p className="mt-3 text-2xl font-black">{weeklyStats.completedCount}</p>
            </div>
          </div>
        </section>

        <aside className="rounded-[28px] bg-[#00452d] p-7 text-white shadow-[0_20px_40px_rgba(0,26,15,0.12)]">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-900 ring-4 ring-emerald-400/30">
              <UserRound size={28} />
            </div>
            <div>
              <h2 className="text-xl font-black">{profileName}</h2>
              <p className="text-sm font-semibold text-emerald-200">ID: {profileId}</p>
            </div>
          </div>
          <p className="mt-6 text-sm leading-6 text-emerald-50/80">
            The schedule only shows shifts assigned to the signed-in account. Please arrive before the shift starts.
          </p>
        </aside>
      </div>
    </section>
  );
};
export const OperationNotificationsPage = () => {
  const [filters, setFilters] = useState(getDefaultRange);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true);
      setError('');
    }
    try {
      const payload = await scheduleOperationsService.getOperationNotifications(filters);
      setNotifications(payload.notifications || []);
    } catch (requestError) {
      if (!silent) {
        setError(getErrorMessage(requestError));
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      load({ silent: true });
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [load]);

  return (
    <PageShell
      title="Operation notifications"
      subtitle="Track operation responses, trip changes, and updates to submitted reports."
      icon={BellRing}
      filters={filters}
      setFilters={setFilters}
      onRefresh={load}
      isLoading={isLoading}
      error={error}
    >
      <div className="space-y-3">
        {notifications.length ? notifications.map((notification) => (
          <OperationNotificationCard key={notification.id} notification={notification} />
        )) : <EmptyState>No operation notifications during this period.</EmptyState>}
      </div>
    </PageShell>
  );
};

export default AssignedTripsPage;
