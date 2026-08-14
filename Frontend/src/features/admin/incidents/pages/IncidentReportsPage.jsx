import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import toast from '../../../../shared/utils/toast.js';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eye,
  LoaderCircle,
  RefreshCcw,
  Search,
  ShieldAlert,
  TimerReset,
  X,
} from 'lucide-react';
import AdminPromotionShell from '../../promotions/components/AdminPromotionShell.jsx';
import FileViewerModal, {
  getFileDisplayName,
  resolveFileUrl,
} from '../../../../shared/components/common/FileViewerModal.jsx';
import incidentReportService from '../services/incidentReportService.js';
import adminService from '../../services/adminService.js';
import useAdminI18n from '../../../../shared/i18n/adminI18n.js';

const fieldClassName =
  'w-full rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-outline/70 focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20';

const incidentTypes = [
  'ACCIDENT',
  'TRAFFIC_CONGESTION',
  'TRIP_REJECTION',
  'GPS_LOST_SIGNAL',
  'VEHICLE_IDLE_TOO_LONG',
  'SEVERE_DELAY',
  'OTHER',
];
const INCIDENT_SCOPE = 'operations';
const severityOptions = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const statusOptions = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];

const handlingActionOptions = [
  { value: 'TRIAGE_ONLY', label: 'Record and monitor only' },
  { value: 'DISPATCH_SUPPORT', label: 'Dispatch on-site support' },
  { value: 'REASSIGN_TRIP', label: 'Reassign trip or staff' },
  { value: 'SEND_MAINTENANCE', label: 'Send technical or maintenance team' },
  { value: 'CONTACT_REPORTER', label: 'Contact reporter' },
  { value: 'NOTIFY_PASSENGERS', label: 'Notify affected passengers' },
  { value: 'CALL_EMERGENCY_SERVICE', label: 'Call emergency services' },
  { value: 'MARK_INVALID', label: 'Close as invalid report' },
];

const defaultFilters = {
  page: 1,
  limit: 10,
  scope: INCIDENT_SCOPE,
  keyword: '',
  incidentType: '',
  severity: '',
  status: '',
  routeId: '',
  vehicleId: '',
  startDate: '',
  endDate: '',
};

const formatDateTime = (value) => {
  if (!value) {
    return 'N/A';
  }

  try {
    return format(new Date(value), 'dd/MM/yyyy HH:mm');
  } catch {
    return 'N/A';
  }
};

const severityClassName = {
  LOW: 'bg-secondary-container text-on-secondary-container',
  MEDIUM: 'bg-primary-fixed text-on-primary-fixed',
  HIGH: 'bg-[#ffe0b2] text-[#7a3e00]',
  CRITICAL: 'bg-error-container text-on-error-container ring-1 ring-error/30',
};

const statusClassName = {
  PENDING: 'bg-primary-fixed text-on-primary-fixed',
  IN_PROGRESS: 'bg-[#dbeafe] text-[#1e40af]',
  RESOLVED: 'bg-secondary-container text-on-secondary-container',
  REJECTED: 'bg-surface-container text-on-surface-variant',
};

const incidentTypeLabel = {
  ACCIDENT: 'Accident',
  TRAFFIC_CONGESTION: 'Traffic congestion',
  TRIP_REJECTION: 'Trip rejection',
  VEHICLE_ISSUE: 'Pre-trip vehicle issue',
  VEHICLE_BREAKDOWN: 'Vehicle breakdown during trip',
  PASSENGER_VIOLATION: 'Passenger violation',
  PASSENGER_CONFLICT: 'Passenger conflict',
  LOST_ITEM: 'Lost item',
  FOUND_ITEM: 'Found item',
  GPS_LOST_SIGNAL: 'GPS lost signal',
  VEHICLE_IDLE_TOO_LONG: 'Vehicle idle too long',
  SEVERE_DELAY: 'Severe delay',
  OTHER: 'Other',
};

const statusLabel = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  REJECTED: 'Closed',
};

const getDisplayStatus = (incident) => (
  ['TRAFFIC_CONGESTION', 'ACCIDENT'].includes(incident?.incidentType)
    ? (incident?.status === 'RESOLVED' ? 'RESOLVED' : 'PENDING')
    : incident?.status
);

const incidentTableColumns = [
  { label: 'Incident ID', className: 'w-[6%]' },
  { label: 'Type', className: 'w-[9%]' },
  { label: 'Title', className: 'w-[20%]' },
  { label: 'Reporter', className: 'w-[9%]' },
  { label: 'Route', className: 'w-[20%]' },
  { label: 'Vehicle', className: 'w-[10%]' },
  { label: 'Severity', className: 'w-[7%] text-center' },
  { label: 'Status', className: 'w-[7%] text-center' },
  { label: 'Created', className: 'w-[7%]' },
  { label: 'Handle', className: 'w-[5%] text-center' },
];

const getStatusActionHint = (status) => ({
  PENDING: 'New reports must be accepted, classified by impact, and assigned to the right team.',
  IN_PROGRESS: 'The report is being processed. Admin updates coordination actions and follow-up results.',
  RESOLVED: 'The report has a final resolution result for post-operation review.',
  REJECTED: 'The report was closed because it is invalid or lacks enough evidence.',
}[status] || 'Update report handling status.');

const MetricCard = ({ label, value, detail, icon: Icon, critical = false }) => (
  <div className={`rounded-[24px] border bg-white/85 p-5 shadow-sm ${
    critical ? 'border-error/30' : 'border-outline-variant/35'
  }`}>
    <div className="flex items-center justify-between gap-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-outline">{label}</p>
      <div className={`rounded-full p-2 ${
        critical ? 'bg-error-container text-on-error-container' : 'bg-primary-fixed text-on-primary-fixed'
      }`}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
    <p className="mt-4 text-3xl font-headline font-extrabold text-primary">{value}</p>
    <p className="mt-2 text-sm text-on-surface-variant">{detail}</p>
  </div>
);

const BarList = ({ items, labelKey, valueKey = 'count' }) => {
  const { tp } = useAdminI18n();
  const max = useMemo(
    () => Math.max(...items.map((item) => Number(item[valueKey] || 0)), 1),
    [items, valueKey]
  );

  if (!items.length) {
    return <p className="py-8 text-center text-sm text-on-surface-variant">{tp('No statistics available.')}</p>;
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const value = Number(item[valueKey] || 0);
        const label = incidentTypeLabel[item[labelKey]] || item[labelKey] || 'Unassigned';
        return (
          <div key={`${item[labelKey]}-${value}`} className="space-y-2">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-semibold text-on-surface">{tp(label)}</span>
              <span className="text-on-surface-variant">{value}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-surface-container">
              <div
                className="h-full rounded-full bg-on-tertiary-container"
                style={{ width: `${Math.max((value / max) * 100, 5)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const IncidentDetailModal = ({
  incident,
  isLoading,
  isSaving,
  onClose,
  onUpdateStatus,
  onReassignStaff,
  onSendNotification,
}) => {
  const { tp } = useAdminI18n();
  const [status, setStatus] = useState(incident?.status || 'PENDING');
  const [handlingAction, setHandlingAction] = useState(incident?.handlingAction || 'TRIAGE_ONLY');
  const [resolutionSummary, setResolutionSummary] = useState(incident?.resolutionSummary || '');
  const [viewerFile, setViewerFile] = useState(null);
  const [staffOptions, setStaffOptions] = useState([]);
  const [replacementStaffId, setReplacementStaffId] = useState('');
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [staffNotification, setStaffNotification] = useState('');
  const [passengerNotification, setPassengerNotification] = useState('');
  const [sendingAudience, setSendingAudience] = useState('');
  const isPendingIncident = incident?.status === 'PENDING';
  const isSimpleDelayIncident = ['TRAFFIC_CONGESTION', 'ACCIDENT'].includes(incident?.incidentType);
  const displayStatus = getDisplayStatus(incident);
  const isClosedIncident = ['RESOLVED', 'REJECTED'].includes(incident?.status);
  const isStaffTripRejection = (
    incident?.incidentType === 'TRIP_REJECTION'
    && ['DRIVER', 'BUS_ASSISTANT'].includes(incident?.reporterRole)
  );
  const isDriverTripRejection = isStaffTripRejection && incident?.reporterRole === 'DRIVER';
  const replacementRoleLabel = isDriverTripRejection ? tp('driver') : tp('bus assistant');
  const replacementRoleLabelCapitalized = isDriverTripRejection ? tp('Driver') : tp('Bus assistant');
  const isWaitingReplacementAssistant = (
    isStaffTripRejection
    && incident?.status === 'IN_PROGRESS'
    && incident?.handlingAction === 'REASSIGN_TRIP'
    && !incident?.resolutionSummary
  );

  useEffect(() => {
    setStatus(incident?.status || 'PENDING');
    setHandlingAction(incident?.handlingAction || 'TRIAGE_ONLY');
    setResolutionSummary(incident?.resolutionSummary || '');
    setReplacementStaffId('');
  }, [incident]);

  useEffect(() => {
    if (!isStaffTripRejection || isClosedIncident) {
      return;
    }

    let isMounted = true;
    setIsLoadingStaff(true);
    adminService.getDrivers()
      .then((response) => {
        if (!isMounted) return;
        const staff = isDriverTripRejection ? (
          response?.drivers
          || response?.data?.drivers
          || response?.data?.data?.drivers
          || response?.driverStaff
          || response?.data?.driverStaff
          || response?.data?.data?.driverStaff
          || []
        ) : (
          response?.assistantStaff
          || response?.data?.assistantStaff
          || response?.data?.data?.assistantStaff
          || []
        );
        const reporterId = String(incident?.reporterId || incident?.reporter?._id || '');
        setStaffOptions(
          staff.filter((member) => String(member._id || member.id) !== reporterId)
        );
      })
      .catch((error) => {
        if (isMounted) {
          toast.error(error.message || `${tp('Unable to load staff list')}: ${replacementRoleLabel}`);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingStaff(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [incident, isClosedIncident, isDriverTripRejection, isStaffTripRejection, replacementRoleLabel]);

  const submitStatus = (nextStatus = status, overrides = {}) => {
    if (isWaitingReplacementAssistant && nextStatus === 'RESOLVED') {
      toast.error(`${tp('Complete only after the replacement staff accepts the trip')}: ${replacementRoleLabel}`);
      return;
    }

    if (!isSimpleDelayIncident && ['RESOLVED', 'REJECTED'].includes(nextStatus) && !resolutionSummary.trim()) {
      toast.error(tp('Resolution result is required before completing or closing the report'));
      return;
    }
    onUpdateStatus({
      status: nextStatus,
      skipResolution: isSimpleDelayIncident,
      handlingAction: overrides.handlingAction || handlingAction,
      resolutionSummary: resolutionSummary.trim(),
    });
  };

  const submitReassignStaff = () => {
    if (!replacementStaffId) {
      toast.error(`${tp('Please select replacement staff')}: ${replacementRoleLabel}`);
      return;
    }

    onReassignStaff({
      staffId: replacementStaffId,
    });
  };

  const sendManualNotification = async (audience, message, clearMessage) => {
    if (message.trim().length < 5) {
      toast.error(tp('Please enter a notification message of at least 5 characters'));
      return;
    }
    setSendingAudience(audience);
    const sent = await onSendNotification({ audience, message: message.trim() });
    if (sent) clearMessage('');
    setSendingAudience('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-8">
      <div className="w-full max-w-4xl rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-outline">
              {tp('Handle Incident Report')}
            </p>
            <h2 className="mt-2 text-2xl font-headline font-extrabold text-primary">
              {incident?.title || tp('Loading incident...')}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-surface-container">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-primary">
            <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
            {tp('Loading incident details...')}
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-5">
              <div className="rounded-[22px] bg-surface-container-low p-5">
                <p className="text-sm leading-7 text-on-surface">{incident?.description}</p>
              </div>

              <dl className="grid gap-4 sm:grid-cols-2">
                {[
                  ['Reporter', incident?.reporter?.fullName || tp('Unknown')],
                  ['Reporter role', incident?.reporterRole || incident?.reporter?.role || 'N/A'],
                  ['Route', incident?.route?.name || incident?.routeId || 'N/A'],
                  ['Trip', incident?.trip?.scheduleCode || incident?.trip?._id || incident?.tripId || 'N/A'],
                  ['Vehicle', incident?.vehicle?.label || incident?.vehicleId || 'N/A'],
                  ['Location', incident?.location || 'N/A'],
                  ['Coordinates', incident?.latitude != null ? `${incident.latitude}, ${incident.longitude}` : 'N/A'],
                  ['Handling action', tp(handlingActionOptions.find((item) => item.value === incident?.handlingAction)?.label || 'Not selected')],
                  ['Created', formatDateTime(incident?.createdAt)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[20px] border border-outline-variant/30 p-4">
                    <dt className="text-xs font-bold uppercase tracking-[0.14em] text-outline">{tp(label)}</dt>
                    <dd className="mt-2 break-words text-sm font-semibold text-on-surface">{value}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <h3 className="text-lg font-bold text-primary">{tp('Attachments')}</h3>
                <div className="mt-3 grid gap-3">
                  {incident?.attachments?.length ? incident.attachments.map((url) => {
                    const file = {
                      name: String(url).split('/').pop() || 'Attachment',
                      url: resolveFileUrl(url),
                    };

                    return (
                      <div
                        key={url}
                        className="flex flex-col gap-3 rounded-2xl border border-outline-variant/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-on-surface">
                            {getFileDisplayName(file)}
                          </p>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            {tp('Incident evidence')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setViewerFile(file)}
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-container"
                        >
                          <span className="material-symbols-outlined text-base">visibility</span>
                          {tp('View file')}
                        </button>
                      </div>
                    );
                  }) : <p className="text-sm text-on-surface-variant">{tp('No attachments.')}</p>}
                </div>
              </div>

              {!isSimpleDelayIncident && <div>
                <h3 className="text-lg font-bold text-primary">{tp('Status history')}</h3>
                <div className="mt-3 space-y-3">
                  {incident?.statusHistory?.length ? [...incident.statusHistory].reverse().map((entry, index) => (
                    <div key={`${entry.changedAt}-${index}`} className="rounded-[20px] bg-surface-container-low p-4">
                      <p className="text-sm font-bold text-primary">
                        {tp(statusLabel[entry.fromStatus] || entry.fromStatus || 'New')} {'->'} {tp(statusLabel[entry.toStatus] || entry.toStatus)}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {entry.changedBy?.fullName || 'Admin'} - {formatDateTime(entry.changedAt)}
                      </p>
                      {entry.handlingAction ? (
                        <p className="mt-2 text-xs text-on-surface-variant">
                          {tp(handlingActionOptions.find((item) => item.value === entry.handlingAction)?.label || entry.handlingAction || 'No action selected')}
                        </p>
                      ) : null}
                      {entry.resolutionSummary ? (
                        <p className="mt-2 rounded-2xl bg-white px-3 py-2 text-sm text-on-surface">
                          {entry.resolutionSummary}
                        </p>
                      ) : null}
                    </div>
                  )) : <p className="text-sm text-on-surface-variant">{tp('No status changes recorded.')}</p>}
                </div>
              </div>}
            </div>

            <aside className="h-fit rounded-[24px] border border-outline-variant/35 bg-surface-container-low p-5">
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${severityClassName[incident?.severity]}`}>
                  {tp(incident?.severity)}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClassName[displayStatus]}`}>
                  {isSimpleDelayIncident
                    ? (displayStatus === 'RESOLVED' ? 'Hoàn tất xử lý' : 'Chưa xử lý')
                    : tp(statusLabel[displayStatus] || displayStatus)}
                </span>
              </div>

              <div className="mt-5 rounded-[20px] border border-outline-variant/35 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-outline">
                  {tp('Process workflow')}
                </p>
                <h3 className="mt-2 text-lg font-headline font-extrabold text-primary">
                  {tp('Handle Incident Reports')}
                </h3>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                  {tp(getStatusActionHint(incident?.status))}
                </p>
                {isClosedIncident && (
                  <p className="mt-3 rounded-2xl bg-surface-container-low px-3 py-2 text-xs font-semibold text-on-surface-variant">
                    {tp('Closed reports are read-only. Admin can only review handling history and results.')}
                  </p>
                )}
              </div>

              {isPendingIncident && !isSimpleDelayIncident ? (
                <div className="mt-5 grid gap-2">
                  <button
                    type="button"
                    onClick={() => submitStatus('IN_PROGRESS')}
                    disabled={isSaving}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    {tp('Accept processing')}
                  </button>
                </div>
              ) : (
                <>
                  {isSimpleDelayIncident && !isClosedIncident ? (
                    <div className="mt-5 space-y-4">
                      <div className="rounded-[20px] border border-outline-variant/40 bg-white p-4">
                        <label className="block space-y-2">
                          <span className="text-sm font-bold text-primary">Thông báo cho tài xế và phụ xe</span>
                          <textarea value={staffNotification} onChange={(event) => setStaffNotification(event.target.value)} className={`${fieldClassName} min-h-[90px] resize-none`} placeholder="Admin nhập nội dung gửi cho nhân viên của chuyến..." />
                        </label>
                        <button type="button" onClick={() => sendManualNotification('TRIP_STAFF', staffNotification, setStaffNotification)} disabled={sendingAudience === 'TRIP_STAFF'} className="mt-3 w-full rounded-full bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
                          {sendingAudience === 'TRIP_STAFF' ? 'Đang gửi...' : 'Gửi cho tài xế và phụ xe'}
                        </button>
                      </div>
                      <div className="rounded-[20px] border border-outline-variant/40 bg-white p-4">
                        <label className="block space-y-2">
                          <span className="text-sm font-bold text-primary">Thông báo cho hành khách bị ảnh hưởng</span>
                          <textarea value={passengerNotification} onChange={(event) => setPassengerNotification(event.target.value)} className={`${fieldClassName} min-h-[110px] resize-none`} placeholder="Admin nhập nội dung gửi cho khách đang trên xe và khách mua vé đang đợi ở trạm chưa đi qua..." />
                        </label>
                        <button type="button" onClick={() => sendManualNotification('PASSENGERS', passengerNotification, setPassengerNotification)} disabled={sendingAudience === 'PASSENGERS'} className="mt-3 w-full rounded-full bg-green-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
                          {sendingAudience === 'PASSENGERS' ? 'Đang gửi...' : 'Gửi cho hành khách bị ảnh hưởng'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {!isSimpleDelayIncident && <label className="mt-5 block space-y-2">
                    <span className="text-sm font-semibold text-on-surface">{tp('Handling action')}</span>
                    <select value={handlingAction} onChange={(event) => setHandlingAction(event.target.value)} disabled={isClosedIncident} className={fieldClassName}>
                      {handlingActionOptions.map((option) => <option key={option.value} value={option.value}>{tp(option.label)}</option>)}
                    </select>
                  </label>}

                  {isStaffTripRejection && !isClosedIncident ? (
                    <div className="mt-4 rounded-[20px] border border-outline-variant/40 bg-white p-4">
                      <p className="text-sm font-bold text-primary">{tp('Assign replacement staff')}: {replacementRoleLabel}</p>
                      <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                        {tp('After assignment, the report remains in progress. When the replacement staff accepts the trip, the system automatically marks the report as resolved.')}
                      </p>
                      <label className="mt-3 block space-y-2">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-outline">{replacementRoleLabelCapitalized}</span>
                        <select
                          value={replacementStaffId}
                          onChange={(event) => {
                            setReplacementStaffId(event.target.value);
                            setHandlingAction('REASSIGN_TRIP');
                          }}
                          disabled={isSaving || isLoadingStaff}
                          className={fieldClassName}
                        >
                          <option value="">
                            {isLoadingStaff ? `${tp('Loading replacement staff')}...` : tp('Choose replacement staff')}
                          </option>
                          {staffOptions.map((member) => (
                            <option key={member._id || member.id} value={member._id || member.id}>
                              {member.fullName || member.email || replacementRoleLabelCapitalized}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={submitReassignStaff}
                        disabled={isSaving || isLoadingStaff || !replacementStaffId}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                      >
                        {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                        {tp('Assign replacement staff')}
                      </button>
                    </div>
                  ) : null}

                  {!isSimpleDelayIncident && <label className="mt-4 block space-y-2">
                    <span className="text-sm font-semibold text-on-surface">{tp('Resolution result')}</span>
                    <textarea
                      value={resolutionSummary}
                      onChange={(event) => setResolutionSummary(event.target.value)}
                      disabled={isClosedIncident || isWaitingReplacementAssistant}
                      className={`${fieldClassName} min-h-[110px] resize-none`}
                      placeholder={tp('Required when completing the report. Record the result, actions taken, and final status.')}
                    />
                    {isWaitingReplacementAssistant ? (
                      <span className="block text-xs leading-5 text-on-surface-variant">
                        {tp('The resolution result will be recorded automatically when replacement staff accepts the trip.')}
                      </span>
                    ) : null}
                  </label>}

                  <div className="mt-5 grid gap-2">
                    {incident?.status === 'IN_PROGRESS' && !isSimpleDelayIncident && (
                      <button
                        type="button"
                        onClick={() => submitStatus('IN_PROGRESS')}
                        disabled={isSaving || isClosedIncident}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-outline-variant/50 px-5 py-3 text-sm font-bold text-primary hover:bg-white disabled:opacity-60"
                      >
                        {tp('Update processing progress')}
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() => submitStatus(handlingAction === 'MARK_INVALID' ? 'REJECTED' : 'RESOLVED')}
                    disabled={isSaving || isClosedIncident || isWaitingReplacementAssistant}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-green-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    {tp('Complete processing')}
                  </button>
                  {!isSimpleDelayIncident && <button
                    type="button"
                    onClick={() => {
                      setHandlingAction('MARK_INVALID');
                      submitStatus('REJECTED', { handlingAction: 'MARK_INVALID' });
                    }}
                    disabled={isSaving || isClosedIncident}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-error/40 px-5 py-3 text-sm font-bold text-error hover:bg-error-container disabled:opacity-60"
                  >
                    {tp('Reject report')}
                  </button>}
                  </div>
                </>
              )}
            </aside>
          </div>
        )}
      </div>
      {viewerFile && (
        <FileViewerModal
          file={viewerFile}
          title={tp('Incident preview')}
          onClose={() => setViewerFile(null)}
        />
      )}
    </div>
  );
};

const IncidentReportsPage = () => {
  const { tp } = useAdminI18n();
  const [filters, setFilters] = useState(defaultFilters);
  const [incidents, setIncidents] = useState([]);
  const [meta, setMeta] = useState({
    page: 1,
    totalPages: 1,
    totalIncidents: 0,
    pendingCount: 0,
    inProgressCount: 0,
    resolvedCount: 0,
    criticalCount: 0,
  });
  const [statistics, setStatistics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [listResponse, statisticsResponse] = await Promise.all([
        incidentReportService.getIncidents(filters),
        incidentReportService.getOverviewStatistics({ scope: INCIDENT_SCOPE }),
      ]);
      setIncidents(listResponse.data || []);
      setMeta((current) => ({ ...current, ...(listResponse.meta || {}) }));
      setStatistics(statisticsResponse.data);
    } catch (error) {
      toast.error(error.message || tp('Unable to load incident reports'));
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value, page: 1 }));
  };

  const openDetail = async (id) => {
    setSelectedId(id);
    setDetail(null);
    setIsDetailLoading(true);
    try {
      const response = await incidentReportService.getIncident(id);
      setDetail(response.data);
    } catch (error) {
      toast.error(error.message || tp('Unable to load incident detail'));
      setSelectedId('');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const updateStatus = async (payload) => {
    setIsSaving(true);
    try {
      const response = await incidentReportService.updateStatus(selectedId, payload);
      setDetail(response.data);
      toast.success(tp('Incident status updated'));
      await loadData();
    } catch (error) {
      toast.error(error.message || tp('Unable to update incident status'));
    } finally {
      setIsSaving(false);
    }
  };

  const reassignStaff = async (payload) => {
    setIsSaving(true);
    try {
      const response = await incidentReportService.reassignStaff(selectedId, payload);
      setDetail(response.data);
      toast.success(tp('Replacement staff assigned. Waiting for the new staff member to accept the trip.'));
      await loadData();
    } catch (error) {
      toast.error(error.message || tp('Unable to assign replacement staff'));
    } finally {
      setIsSaving(false);
    }
  };

  const sendNotification = async (payload) => {
    try {
      const response = await incidentReportService.sendNotification(selectedId, payload);
      const recipientCount = response?.data?.recipientCount || 0;
      if (recipientCount === 0) {
        toast.error(payload.audience === 'PASSENGERS'
          ? 'Không tìm thấy hành khách trên xe hoặc hành khách đã thanh toán đang chờ ở trạm chưa đi qua.'
          : 'Không tìm thấy tài xế hoặc phụ xe đang được phân công cho chuyến.');
        return false;
      }
      toast.success(`Đã gửi thông báo đến ${recipientCount} người nhận.`);
      return true;
    } catch (error) {
      toast.error(error.message || 'Không thể gửi thông báo');
      return false;
    }
  };

  return (
    <AdminPromotionShell
      title={tp('Handle Incident Reports')}
      subtitle={tp('Receive, coordinate support, update resolution results, and keep the handling history for operation incident reports.')}
      action={(
        <button type="button" onClick={loadData} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white">
          <RefreshCcw className="h-4 w-4" />
          {tp('Refresh')}
        </button>
      )}
    >
      <section className="rounded-[28px] border border-outline-variant/35 bg-white/80 p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
            <input value={filters.keyword} onChange={(event) => updateFilter('keyword', event.target.value)} className={`${fieldClassName} pl-11`} placeholder={tp('Search title, description, location')} />
          </label>
          <select value={filters.incidentType} onChange={(event) => updateFilter('incidentType', event.target.value)} className={fieldClassName}>
            <option value="">{tp('All incident types')}</option>
            {incidentTypes.map((option) => <option key={option} value={option}>{tp(incidentTypeLabel[option] || option)}</option>)}
          </select>
          <select value={filters.severity} onChange={(event) => updateFilter('severity', event.target.value)} className={fieldClassName}>
            <option value="">{tp('All severity')}</option>
            {severityOptions.map((option) => <option key={option}>{tp(option)}</option>)}
          </select>
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className={fieldClassName}>
            <option value="">{tp('All status')}</option>
            {statusOptions.map((option) => <option key={option} value={option}>{tp(statusLabel[option] || option)}</option>)}
          </select>
          <input value={filters.routeId} onChange={(event) => updateFilter('routeId', event.target.value)} className={fieldClassName} placeholder={tp('Route ObjectId')} />
          <input value={filters.vehicleId} onChange={(event) => updateFilter('vehicleId', event.target.value)} className={fieldClassName} placeholder={tp('Vehicle ObjectId')} />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={filters.startDate} onChange={(event) => updateFilter('startDate', event.target.value)} className={fieldClassName} />
            <input type="date" value={filters.endDate} onChange={(event) => updateFilter('endDate', event.target.value)} className={fieldClassName} />
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label={tp('Total Incidents')} value={meta.totalIncidents} detail={tp('All recorded reports')} icon={ShieldAlert} />
        <MetricCard label={tp('Pending')} value={meta.pendingCount} detail={tp('Awaiting admin review')} icon={Clock3} />
        <MetricCard label={tp('In Progress')} value={meta.inProgressCount} detail={tp('Currently investigated')} icon={TimerReset} />
        <MetricCard label={tp('Resolved')} value={meta.resolvedCount} detail={tp('Investigation completed')} icon={CheckCircle2} />
        <MetricCard label={tp('Critical')} value={meta.criticalCount} detail={tp('Requires immediate attention')} icon={AlertTriangle} critical />
      </section>

      <section className="mt-6 overflow-hidden rounded-[28px] border border-outline-variant/35 bg-white/85 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] table-fixed divide-y divide-outline-variant/30 text-left text-sm">
            <thead className="bg-surface-container-low text-xs uppercase tracking-[0.12em] text-outline">
              <tr>
                {incidentTableColumns.map((column) => (
                  <th key={column.label} className={`px-4 py-4 ${column.className}`}>{tp(column.label)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {isLoading ? (
                <tr><td colSpan="10" className="px-5 py-12 text-center text-on-surface-variant">{tp('Loading incident reports...')}</td></tr>
              ) : incidents.length ? incidents.map((incident) => (
                <tr key={incident._id} className={incident.severity === 'CRITICAL' ? 'bg-error-container/20' : 'hover:bg-surface-container-low/70'}>
                  <td className="w-[6%] px-4 py-4 font-mono text-xs text-primary">{incident._id.slice(-8)}</td>
                  <td className="w-[9%] px-4 py-4 font-semibold">
                    <span className="line-clamp-2">{tp(incidentTypeLabel[incident.incidentType] || incident.incidentType)}</span>
                  </td>
                  <td className="w-[20%] px-4 py-4">
                    <p className="truncate font-bold text-primary">{incident.title}</p>
                    <p className="mt-1 truncate text-xs text-on-surface-variant">{incident.location || tp('Location not provided')}</p>
                  </td>
                  <td className="w-[9%] px-4 py-4">
                    <p className="truncate">{incident.reporter?.fullName || tp('Unknown')}</p>
                  </td>
                  <td className="w-[20%] px-4 py-4">
                    <p className="truncate font-semibold text-on-surface">
                      {incident.route?.name || incident.routeId || 'N/A'}
                    </p>
                    {incident.route?.routeNumber ? (
                      <p className="mt-1 text-xs text-on-surface-variant">{incident.route.routeNumber}</p>
                    ) : null}
                  </td>
                  <td className="w-[10%] px-4 py-4">
                    <p className="truncate font-semibold text-on-surface">
                      {incident.vehicle?.label || incident.vehicleId || 'N/A'}
                    </p>
                    {incident.vehicle?.status ? (
                      <p className="mt-1 text-xs text-on-surface-variant">{incident.vehicle.status}</p>
                    ) : null}
                  </td>
                  <td className="w-[7%] px-4 py-4 text-center"><span className={`inline-flex justify-center rounded-full px-3 py-1 text-xs font-bold ${severityClassName[incident.severity]}`}>{tp(incident.severity)}</span></td>
                  <td className="w-[7%] px-4 py-4 text-center"><span className={`inline-flex justify-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${statusClassName[getDisplayStatus(incident)]}`}>{['TRAFFIC_CONGESTION', 'ACCIDENT'].includes(incident.incidentType) ? (getDisplayStatus(incident) === 'RESOLVED' ? 'Hoàn tất xử lý' : 'Chưa xử lý') : tp(statusLabel[incident.status] || incident.status)}</span></td>
                  <td className="w-[7%] px-4 py-4">{formatDateTime(incident.createdAt)}</td>
                  <td className="w-[5%] px-4 py-4 text-center">
                    <button type="button" title={tp('View and handle report')} onClick={() => openDetail(incident._id)} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary-container">
                      <Eye className="h-4 w-4" />
                      {tp('Handle')}
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="10" className="px-5 py-12 text-center text-on-surface-variant">{tp('No incident reports found.')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-outline-variant/30 px-5 py-4">
          <p className="text-sm text-on-surface-variant">{tp(`Page ${meta.page} of ${meta.totalPages}`)}</p>
          <div className="flex gap-2">
            <button type="button" disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))} className="rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-40">{tp('Previous')}</button>
            <button type="button" disabled={filters.page >= meta.totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))} className="rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-40">{tp('Next')}</button>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        {[
          ['Incidents by type', statistics?.incidentsByType || [], 'incidentType'],
          ['Incidents by severity', statistics?.incidentsBySeverity || [], 'severity'],
          ['Incident trend over time', statistics?.incidentTrendByDate || [], 'date'],
        ].map(([title, items, labelKey]) => (
          <div key={title} className="rounded-[28px] border border-outline-variant/35 bg-white/85 p-5 shadow-sm">
            <h2 className="text-lg font-bold text-primary">{tp(title)}</h2>
            <div className="mt-5"><BarList items={items} labelKey={labelKey} /></div>
          </div>
        ))}
      </section>

      {selectedId ? (
        <IncidentDetailModal
          incident={detail}
          isLoading={isDetailLoading}
          isSaving={isSaving}
          onClose={() => {
            setSelectedId('');
            setDetail(null);
          }}
          onUpdateStatus={updateStatus}
          onReassignStaff={reassignStaff}
          onSendNotification={sendNotification}
        />
      ) : null}
    </AdminPromotionShell>
  );
};

export default IncidentReportsPage;
