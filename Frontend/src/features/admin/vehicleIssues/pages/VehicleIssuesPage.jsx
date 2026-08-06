import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  AlertTriangle,
  BellRing,
  BusFront,
  ClipboardCheck,
  Eye,
  LoaderCircle,
  MapPin,
  RefreshCcw,
  ShieldAlert,
  Wrench,
  X,
} from 'lucide-react';
import toast from '../../../../shared/utils/toast.js';
import AdminPromotionShell from '../../promotions/components/AdminPromotionShell.jsx';
import { ReplacementVehicleModal } from '../../vehicleReassignments';
import vehicleIssueService from '../services/vehicleIssueService.js';
import useAdminI18n from '../../../../shared/i18n/adminI18n.js';

const fieldClassName =
  'w-full rounded-xl border border-outline-variant/50 bg-surface px-3 py-2.5 text-sm text-on-surface focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20';

const issueTypes = [
  'engine',
  'brake',
  'tire',
  'accident',
  'door',
  'air_conditioner',
  'gps_device',
  'ticket_scanner',
  'cleanliness',
  'safety_equipment',
  'other',
];
const severities = ['low', 'medium', 'high', 'critical'];
const statuses = ['new', 'reviewed', 'maintenance_required', 'no_action_needed', 'resolved', 'dismissed'];
const emergencyStatuses = ['REPORTED', 'CONFIRMED', 'STANDBY_BUS_DISPATCHED', 'RESOLVED'];

const defaultFilters = {
  page: 1,
  limit: 10,
  status: '',
  severity: '',
  vehicleId: '',
  issueType: '',
  emergency: '',
  emergencyStatus: '',
  startDate: '',
  endDate: '',
};

const severityClassName = {
  low: 'bg-secondary-container text-on-secondary-container',
  medium: 'bg-primary-fixed text-on-primary-fixed',
  high: 'bg-[#ffe0b2] text-[#7a3e00]',
  critical: 'bg-error-container text-on-error-container ring-1 ring-error/40',
};

const statusClassName = {
  new: 'bg-primary-fixed text-on-primary-fixed',
  reviewed: 'bg-[#dbeafe] text-[#1e40af]',
  maintenance_required: 'bg-[#ffe0b2] text-[#7a3e00]',
  no_action_needed: 'bg-secondary-container text-on-secondary-container',
  resolved: 'bg-secondary-container text-on-secondary-container',
  dismissed: 'bg-surface-container text-on-surface-variant',
};

const emergencyStatusClassName = {
  REPORTED: 'bg-error-container text-on-error-container ring-1 ring-error/40',
  CONFIRMED: 'bg-[#ffe0b2] text-[#7a3e00]',
  STANDBY_BUS_DISPATCHED: 'bg-[#dbeafe] text-[#1e40af]',
  RESOLVED: 'bg-secondary-container text-on-secondary-container',
};

const breakdownTypeLabel = {
  ENGINE_FAILURE: 'Engine Failure',
  BRAKE_FAILURE: 'Brake Failure',
  FLAT_TIRE: 'Flat Tire',
  ACCIDENT: 'Accident',
  OTHER: 'Other',
};

const emergencyNextActionLabel = {
  REPORTED: 'Confirm Breakdown',
  CONFIRMED: 'Dispatch Standby Bus',
  STANDBY_BUS_DISPATCHED: 'Mark Resolved',
  RESOLVED: 'View Detail',
};

const emergencyStepLabel = {
  REPORTED: 'Step 1 of 3',
  CONFIRMED: 'Step 2 of 3',
  STANDBY_BUS_DISPATCHED: 'Step 3 of 3',
  RESOLVED: 'Resolved',
};

const uc43NextActionLabel = {
  new: 'Review pre-trip issue',
  reviewed: 'Decide follow-up',
  maintenance_required: 'Track maintenance',
  no_action_needed: 'Ready to close',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  try {
    return format(new Date(value), 'dd/MM/yyyy HH:mm');
  } catch {
    return 'N/A';
  }
};

const formatWorkflowDateTime = (value, fallback) => (value ? formatDateTime(value) : fallback);

const labelize = (value) => String(value || 'N/A').replaceAll('_', ' ');
const translateLabel = (value, tp) => tp(labelize(value));

const emergencyGuidance = {
  REPORTED: 'Next step: confirm the breakdown before dispatching a standby bus.',
  CONFIRMED: 'Next step: choose a standby bus and dispatch it to continue the journey.',
  STANDBY_BUS_DISPATCHED: 'A standby bus has been dispatched. Mark resolved when the issue is fully handled.',
  RESOLVED: 'The issue has been resolved.',
};

const uc43Guidance = {
  new: 'Driver reported a vehicle issue during pre-trip inspection. Review the issue and choose an admin decision.',
  reviewed: 'The pre-trip issue has been acknowledged. Choose maintenance, replacement vehicle, no action, or close after checking.',
  maintenance_required: 'Maintenance is required. Track the maintenance task or replacement vehicle if the trip is affected.',
  no_action_needed: 'Admin marked this issue as no action needed. Close it after final verification.',
  resolved: 'The pre-trip issue has been resolved.',
  dismissed: 'The pre-trip issue has been dismissed after review.',
};

const KpiCard = ({ label, value, detail, icon: Icon, critical = false }) => (
  <div className={`rounded-2xl border bg-white p-4 shadow-sm ${critical ? 'border-error/40' : 'border-outline-variant/35'}`}>
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-outline">{label}</p>
      <span className={`rounded-xl p-2 ${critical ? 'bg-error-container text-on-error-container' : 'bg-primary-fixed text-on-primary-fixed'}`}>
        <Icon className="h-4 w-4" />
      </span>
    </div>
    <p className="mt-3 text-3xl font-headline font-black text-primary">{value}</p>
    <p className="mt-1 text-sm text-on-surface-variant">{detail}</p>
  </div>
);

const VehicleIssueQueueCard = ({ issue, onOpen }) => {
  const { tp } = useAdminI18n();
  const emergency = issue.emergencyBreakdown?.isEmergency ? issue.emergencyBreakdown : null;
  const emergencyStatus = emergency?.incidentStatus;
  const isUc43 = !emergency;
  const vehicleLabel = issue.vehicle?.plateNumber || issue.vehicle?.busCode || issue.vehicleId || 'N/A';
  const tripLabel = issue.trip?.scheduleCode || issue.tripId || 'N/A';
  const driverLabel = issue.reportedBy?.fullName || issue.trip?.driver?.fullName || 'Unknown';
  const issueLabel = emergency
    ? breakdownTypeLabel[emergency.breakdownType] || labelize(emergency.breakdownType)
    : labelize(issue.issueType);
  const nextAction = emergency
    ? emergencyNextActionLabel[emergencyStatus] || 'View Detail'
    : uc43NextActionLabel[issue.status] || 'Review pre-trip issue';
  const workflowPercent = emergencyStatus === 'REPORTED'
    ? '33%'
    : emergencyStatus === 'CONFIRMED'
      ? '66%'
      : '100%';

  return (
    <article className={`rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
      issue.severity === 'critical' || emergency ? 'border-error/30' : 'border-outline-variant/35'
    }`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {emergency ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-error px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-white">
                <AlertTriangle className="h-3.5 w-3.5" />
                {tp('Emergency breakdown')}
              </span>
            ) : null}
            {isUc43 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-white">
                <ClipboardCheck className="h-3.5 w-3.5" />
                {tp('Pre-trip inspection issue')}
              </span>
            ) : null}
            <span className={`rounded-full px-2.5 py-1 text-xs font-black ${severityClassName[issue.severity] || severityClassName.medium}`}>
              {translateLabel(issue.severity, tp)}
            </span>
            {emergency ? (
              <span className={`rounded-full px-2.5 py-1 text-xs font-black ${emergencyStatusClassName[emergencyStatus] || statusClassName.new}`}>
                {translateLabel(emergencyStatus, tp)}
              </span>
            ) : (
              <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusClassName[issue.status] || statusClassName.new}`}>
                {translateLabel(issue.status, tp)}
              </span>
            )}
          </div>

          <h3 className="mt-3 truncate text-lg font-headline font-black text-primary">{tp(issueLabel)}</h3>
          <p className="mt-1 max-w-3xl truncate text-sm text-on-surface-variant">{issue.description || tp('No description provided.')}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Vehicle', vehicleLabel],
              ['Trip', tripLabel],
              ['Driver', driverLabel],
              ['Reported', formatDateTime(issue.reportedAt)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-surface-container-low px-3 py-2">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-outline">{tp(label)}</p>
                <p className="mt-1 truncate text-sm font-black text-on-surface">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 rounded-2xl border border-outline-variant/35 bg-surface px-4 py-3 xl:w-64">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-outline">{tp('Next admin action')}</p>
            <p className="mt-1 text-base font-headline font-black text-primary">{tp(nextAction)}</p>
            <p className="mt-1 text-xs font-bold text-on-surface-variant">
              {emergency ? tp(emergencyStepLabel[emergencyStatus] || 'Emergency workflow') : tp('Vehicle inspection workflow')}
            </p>
          </div>
          {emergency ? (
            <div className="h-2 overflow-hidden rounded-full bg-error-container">
              <div className="h-full rounded-full bg-error" style={{ width: workflowPercent }} />
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => onOpen(issue._id)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-white hover:bg-primary/90"
          >
            <Eye className="h-4 w-4" />
            {tp('Open Detail')}
          </button>
        </div>
      </div>
    </article>
  );
};

const ReviewModal = ({ issue, action, isSaving, onClose, onSubmit }) => {
  const { tp } = useAdminI18n();
  const [adminNote, setAdminNote] = useState(issue?.adminNote || '');
  const [replacementVehicleId, setReplacementVehicleId] = useState('');

  useEffect(() => {
    setAdminNote(issue?.adminNote || '');
    setReplacementVehicleId('');
  }, [issue, action]);

  if (!issue || !action) return null;

  const actionCopy = {
    mark_reviewed: 'Mark reviewed',
    no_action_needed: 'No action needed',
    create_maintenance_task: 'Create maintenance task',
    mark_vehicle_under_maintenance: 'Mark vehicle under maintenance',
    assign_replacement_vehicle: 'Assign replacement vehicle',
    resolved: 'Mark resolved',
    dismissed: 'Dismiss issue',
  };

  const submit = () => {
    if (['no_action_needed', 'dismissed'].includes(action) && !adminNote.trim()) {
      toast.error(tp('Admin note is required for this decision'));
      return;
    }

    if (action === 'assign_replacement_vehicle' && !replacementVehicleId.trim()) {
      toast.error(tp('Replacement vehicle ID is required'));
      return;
    }

    onSubmit({
      decision: action,
      adminNote: adminNote.trim(),
      markVehicleUnderMaintenance: action === 'mark_vehicle_under_maintenance',
      createMaintenanceTask: action === 'create_maintenance_task',
      replacementVehicleId: replacementVehicleId.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-outline">{tp('Review decision')}</p>
            <h3 className="mt-2 text-xl font-headline font-black text-primary">{tp(actionCopy[action])}</h3>
          </div>
          <button type="button" title={tp('Close')} onClick={onClose} className="rounded-full p-2 hover:bg-surface-container">
            <X className="h-5 w-5" />
          </button>
        </div>

        {issue.severity === 'critical' ? (
          <div className="mt-4 rounded-xl border border-error/30 bg-error-container/30 p-3 text-sm font-semibold text-on-error-container">
            {tp('Critical safety issue. Take this vehicle out of service unless maintenance confirms it is safe.')}
          </div>
        ) : null}

        {action === 'assign_replacement_vehicle' ? (
          <label className="mt-5 block space-y-2">
            <span className="text-sm font-semibold text-on-surface">{tp('Replacement vehicle ID')}</span>
            <input
              value={replacementVehicleId}
              onChange={(event) => setReplacementVehicleId(event.target.value)}
              className={fieldClassName}
              placeholder={tp('FleetBus ObjectId')}
            />
          </label>
        ) : null}

        <label className="mt-5 block space-y-2">
          <span className="text-sm font-semibold text-on-surface">{tp('Admin note')}</span>
          <textarea
            value={adminNote}
            onChange={(event) => setAdminNote(event.target.value)}
            className={`${fieldClassName} min-h-[140px] resize-none`}
            placeholder={tp('Decision reason and follow-up notes')}
          />
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full border px-5 py-2.5 text-sm font-bold">
            {tp('Cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            {tp('Save decision')}
          </button>
        </div>
      </div>
    </div>
  );
};

const LocationMap = ({ location }) => {
  const { tp } = useAdminI18n();
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);
  const hasUsableCoordinates = Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && !(Math.abs(latitude) < 0.000001 && Math.abs(longitude) < 0.000001);

  if (!hasUsableCoordinates) {
    return (
      <div className="rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container-low p-6 text-center text-sm font-semibold text-on-surface-variant">
        {tp('GPS location was not provided with this report.')}
      </div>
    );
  }

  const src = `https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;
  return (
    <div className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-low">
      <iframe
        title={tp('Emergency breakdown location')}
        src={src}
        className="h-72 w-full border-0"
        loading="lazy"
      />
      <div className="flex flex-wrap gap-4 px-4 py-3 text-xs font-bold text-on-surface-variant">
        <span>{tp('Latitude')}: {latitude.toFixed(6)}</span>
        <span>{tp('Longitude')}: {longitude.toFixed(6)}</span>
      </div>
    </div>
  );
};

const DetailDrawer = ({ issue, isLoading, onClose, onAction }) => {
  const { tp } = useAdminI18n();
  const tripAffected = ['PLANNED', 'ASSIGNED', 'IN_PROGRESS'].includes(issue?.trip?.status);
  const emergency = issue?.emergencyBreakdown?.isEmergency ? issue.emergencyBreakdown : null;
  const emergencyStatus = emergency?.incidentStatus;
  const isClosedVehicleIssue = ['resolved', 'dismissed'].includes(issue?.status);
  const canReviewAgain = ['new', 'no_action_needed'].includes(issue?.status);
  const canRequireMaintenance = ['new', 'reviewed'].includes(issue?.status);
  const canCloseAsNoAction = ['new', 'reviewed'].includes(issue?.status);
  const canResolveIssue = ['new', 'reviewed', 'maintenance_required', 'no_action_needed'].includes(issue?.status);
  const canDismissIssue = ['new', 'reviewed', 'maintenance_required'].includes(issue?.status);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/35">
      <button type="button" aria-label={tp('Close detail')} onClick={onClose} className="flex-1" />
      <aside className="h-full w-full max-w-3xl overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-outline">{tp('Vehicle issue detail')}</p>
            <h2 className="mt-2 text-2xl font-headline font-black text-primary">
              {issue ? translateLabel(issue.issueType, tp) : tp('Loading issue...')}
            </h2>
          </div>
          <button type="button" title={tp('Close')} onClick={onClose} className="rounded-full p-2 hover:bg-surface-container">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-primary">
            <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
            {tp('Loading issue detail...')}
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {issue?.severity === 'critical' ? (
              <div className="rounded-2xl border border-error/35 bg-error-container/30 p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-error" />
                  <div>
                    <p className="font-bold text-on-error-container">{tp('Critical safety issue')}</p>
                    <p className="mt-1 text-sm text-on-error-container">
                      {issue.criticalSafetyRecommendation}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {emergency ? (
              <div className="rounded-2xl border border-error/30 bg-error-container/20 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-error">{tp('Emergency breakdown')}</p>
                    <h3 className="mt-2 text-xl font-headline font-black text-primary">
                      {tp(breakdownTypeLabel[emergency.breakdownType] || labelize(emergency.breakdownType))}
                    </h3>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {tp(emergencyGuidance[emergencyStatus] || 'Track and handle the in-trip vehicle issue.')}
                    </p>
                  </div>
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${emergencyStatusClassName[emergencyStatus] || statusClassName.new}`}>
                    {translateLabel(emergencyStatus, tp)}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-xs font-bold uppercase text-outline">{tp('Reported at')}</p>
                    <p className="mt-1 text-sm font-bold text-on-surface">{formatDateTime(issue?.reportedAt)}</p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-xs font-bold uppercase text-outline">{tp('Confirmed at')}</p>
                    <p className="mt-1 text-sm font-bold text-on-surface">
                      {formatWorkflowDateTime(emergency.confirmedAt, emergencyStatus === 'REPORTED' ? tp('Waiting for admin confirmation') : tp('Not recorded'))}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-xs font-bold uppercase text-outline">{tp('Dispatch time')}</p>
                    <p className="mt-1 text-sm font-bold text-on-surface">
                      {formatWorkflowDateTime(
                        emergency.dispatchTime,
                        ['REPORTED', 'CONFIRMED'].includes(emergencyStatus) ? tp('Standby bus not dispatched') : tp('Not recorded')
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-xs font-bold uppercase text-outline">{tp('Standby bus')}</p>
                    <p className="mt-1 text-sm font-bold text-on-surface">
                      {emergency.standbyVehicle?.plateNumber || emergency.standbyVehicle?.busCode || emergency.standbyVehicleId || tp('No standby bus selected')}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {!emergency ? (
              <div className="rounded-2xl border border-primary/20 bg-primary-fixed/35 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">{tp('Pre-trip inspection issue')}</p>
                    <h3 className="mt-2 text-xl font-headline font-black text-primary">
                      {translateLabel(issue?.issueType, tp)}
                    </h3>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {tp(uc43Guidance[issue?.status] || 'Review this pre-trip vehicle issue and choose the next admin action.')}
                    </p>
                  </div>
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${statusClassName[issue?.status] || statusClassName.new}`}>
                    {translateLabel(issue?.status, tp)}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-xs font-bold uppercase text-outline">{tp('Reported at')}</p>
                    <p className="mt-1 text-sm font-bold text-on-surface">{formatDateTime(issue?.reportedAt)}</p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-xs font-bold uppercase text-outline">{tp('Decision')}</p>
                    <p className="mt-1 text-sm font-bold text-on-surface">{translateLabel(issue?.decision || 'waiting', tp)}</p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-xs font-bold uppercase text-outline">{tp('Reviewed at')}</p>
                    <p className="mt-1 text-sm font-bold text-on-surface">{formatDateTime(issue?.reviewedAt)}</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl bg-surface-container-low p-4">
              <p className="text-sm leading-7 text-on-surface">{issue?.description}</p>
            </div>

            {emergency ? (
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-error" />
                  <h3 className="text-lg font-bold text-primary">{tp('Current Location')}</h3>
                </div>
                <LocationMap location={issue?.location} />
              </section>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {emergency ? (
                <>
                  {emergencyStatus === 'REPORTED' ? (
                    <button type="button" onClick={() => onAction('confirm_emergency')} className="rounded-full bg-error px-4 py-2 text-sm font-bold text-white">{tp('Confirm Breakdown')}</button>
                  ) : null}
                  {emergencyStatus === 'CONFIRMED' ? (
                    <button type="button" onClick={() => onAction('dispatch_standby_bus')} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white">
                      <BusFront className="h-4 w-4" />
                      {tp('Dispatch Standby Bus')}
                    </button>
                  ) : null}
                  {emergencyStatus === 'STANDBY_BUS_DISPATCHED' ? (
                    <button type="button" onClick={() => onAction('resolve_emergency')} className="rounded-full bg-secondary px-4 py-2 text-sm font-bold text-white">{tp('Mark Resolved')}</button>
                  ) : null}
                </>
              ) : !isClosedVehicleIssue ? (
                <>
                  {canReviewAgain ? (
                    <button type="button" onClick={() => onAction('mark_reviewed')} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white">{tp('Mark reviewed')}</button>
                  ) : null}
                  {canCloseAsNoAction ? (
                    <button type="button" onClick={() => onAction('no_action_needed')} className="rounded-full border px-4 py-2 text-sm font-bold">{tp('No action needed')}</button>
                  ) : null}
                  {canRequireMaintenance ? (
                    <button type="button" onClick={() => onAction('create_maintenance_task')} className="rounded-full border px-4 py-2 text-sm font-bold">{tp('Create maintenance task')}</button>
                  ) : null}
                  {canRequireMaintenance ? (
                    <button type="button" onClick={() => onAction('mark_vehicle_under_maintenance')} className="rounded-full border border-error/40 px-4 py-2 text-sm font-bold text-error">{tp('Mark vehicle under maintenance')}</button>
                  ) : null}
                  {tripAffected && canRequireMaintenance ? (
                    <button type="button" onClick={() => onAction('assign_replacement_vehicle')} className="rounded-full border px-4 py-2 text-sm font-bold">{tp('Assign replacement vehicle')}</button>
                  ) : null}
                  {canResolveIssue ? (
                    <button type="button" onClick={() => onAction('resolved')} className="rounded-full bg-secondary px-4 py-2 text-sm font-bold text-white">{tp('Mark resolved')}</button>
                  ) : null}
                  {canDismissIssue ? (
                    <button type="button" onClick={() => onAction('dismissed')} className="rounded-full border border-error/40 px-4 py-2 text-sm font-bold text-error">{tp('Dismiss issue')}</button>
                  ) : null}
                </>
              ) : (
                <span className="rounded-full bg-secondary-container px-4 py-2 text-sm font-bold text-on-secondary-container">
                  {tp('This vehicle inspection issue is closed')}
                </span>
              )}
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ['Vehicle', issue?.vehicle?.plateNumber || issue?.vehicle?.busCode || issue?.vehicleId],
                ['Vehicle status', issue?.vehicle?.status],
                ['Trip', issue?.trip?.scheduleCode || issue?.tripId || 'N/A'],
                ['Trip status', issue?.trip?.status || 'N/A'],
                ['Driver', issue?.trip?.driver?.fullName || issue?.reportedBy?.fullName || tp('Unknown')],
                ['Reported at', formatDateTime(issue?.reportedAt)],
                ['Location', issue?.location?.text || 'N/A'],
                ['Admin note', issue?.adminNote || 'N/A'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-outline-variant/30 p-4">
                  <dt className="text-xs font-bold uppercase tracking-[0.12em] text-outline">{tp(label)}</dt>
                  <dd className="mt-2 break-words text-sm font-semibold text-on-surface">{value || 'N/A'}</dd>
                </div>
              ))}
            </dl>

            <section>
              <h3 className="text-lg font-bold text-primary">{tp('Maintenance history')}</h3>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-outline-variant/30 p-4">
                  <p className="font-bold text-on-surface">{tp('Previous issues')}</p>
                  <div className="mt-3 space-y-3">
                    {issue?.maintenanceHistory?.relatedIssues?.length ? issue.maintenanceHistory.relatedIssues.map((item) => (
                      <div key={item._id} className="rounded-xl bg-surface-container-low p-3 text-sm">
                        <p className="font-bold text-primary">{translateLabel(item.issueType, tp)} - {translateLabel(item.severity, tp)}</p>
                        <p className="text-on-surface-variant">{translateLabel(item.status, tp)} {tp('on')} {formatDateTime(item.reportedAt)}</p>
                      </div>
                    )) : <p className="text-sm text-on-surface-variant">{tp('No previous issues.')}</p>}
                  </div>
                </div>
                <div className="rounded-2xl border border-outline-variant/30 p-4">
                  <p className="font-bold text-on-surface">{tp('Maintenance tasks')}</p>
                  <div className="mt-3 space-y-3">
                    {issue?.maintenanceHistory?.maintenanceTasks?.length ? issue.maintenanceHistory.maintenanceTasks.map((item) => (
                      <div key={item._id} className="rounded-xl bg-surface-container-low p-3 text-sm">
                        <p className="font-bold text-primary">{item.title}</p>
                        <p className="text-on-surface-variant">{translateLabel(item.status, tp)} - {formatDateTime(item.createdAt)}</p>
                      </div>
                    )) : <p className="text-sm text-on-surface-variant">{tp('No maintenance tasks.')}</p>}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
};

const VehicleIssuesPage = () => {
  const { tp } = useAdminI18n();
  const [filters, setFilters] = useState(defaultFilters);
  const [issues, setIssues] = useState([]);
  const [meta, setMeta] = useState({
    page: 1,
    totalPages: 1,
    newIssues: 0,
    criticalIssues: 0,
    vehiclesAffected: 0,
    maintenanceRequired: 0,
    preTripIssues: 0,
    emergencyReported: 0,
    emergencyConfirmed: 0,
    standbyDispatched: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [reviewAction, setReviewAction] = useState('');
  const [replacementModalOpen, setReplacementModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadIssues = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await vehicleIssueService.getIssues(filters);
      setIssues(response.data || []);
      setMeta((current) => ({ ...current, ...(response.meta || {}) }));
    } catch (error) {
      toast.error(error.message || tp('Unable to load vehicle issues'));
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value, page: 1 }));
  };

  const openDetail = async (id) => {
    setSelectedId(id);
    setDetail(null);
    setIsDetailLoading(true);
    try {
      const response = await vehicleIssueService.getIssue(id);
      setDetail(response.data);
    } catch (error) {
      toast.error(error.message || tp('Unable to load vehicle issue detail'));
      setSelectedId('');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const submitReview = async (payload) => {
    setIsSaving(true);
    try {
      const response = await vehicleIssueService.reviewIssue(selectedId, payload);
      setDetail(response.data);
      setReviewAction('');
      toast.success(tp('Vehicle issue decision stored'));
      await loadIssues();
    } catch (error) {
      toast.error(error.message || tp('Unable to review vehicle issue'));
    } finally {
      setIsSaving(false);
    }
  };

  const submitIssueReplacement = async (payload) => {
    setIsSaving(true);
    try {
      const response = await vehicleIssueService.reviewIssue(selectedId, {
        decision: 'assign_replacement_vehicle',
        adminNote: payload.note,
        reason: payload.reason,
        replacementVehicleId: payload.replacementVehicleId,
        notifyStaff: payload.notifyStaff,
        notifyPassengers: payload.notifyPassengers,
      });
      setDetail(response.data);
      await loadIssues();
      return response;
    } finally {
      setIsSaving(false);
    }
  };

  const confirmEmergencyBreakdown = async () => {
    setIsSaving(true);
    try {
      const response = await vehicleIssueService.confirmEmergencyBreakdown(selectedId, {
        adminNote: 'Emergency breakdown verified by operation center.',
      });
      setDetail(response.data);
      toast.success(tp('Emergency breakdown confirmed'));
      await loadIssues();
    } catch (error) {
      toast.error(error.message || tp('Unable to confirm emergency breakdown'));
    } finally {
      setIsSaving(false);
    }
  };

  const dispatchStandbyBus = async (payload) => {
    setIsSaving(true);
    try {
      const response = await vehicleIssueService.dispatchStandbyBus(selectedId, {
        standbyVehicleId: payload.replacementVehicleId,
        adminNote: payload.note,
      });
      setDetail(response.data);
      await loadIssues();
      return response;
    } finally {
      setIsSaving(false);
    }
  };

  const resolveEmergencyBreakdown = async () => {
    setIsSaving(true);
    try {
      const response = await vehicleIssueService.resolveEmergencyBreakdown(selectedId, {
        adminNote: 'Emergency workflow resolved after standby bus dispatch.',
      });
      setDetail(response.data);
      toast.success(tp('Emergency breakdown resolved'));
      await loadIssues();
    } catch (error) {
      toast.error(error.message || tp('Unable to resolve emergency breakdown'));
    } finally {
      setIsSaving(false);
    }
  };

  const kpis = useMemo(() => ([
    ['New issues', meta.newIssues, 'Awaiting admin review', ClipboardCheck, false],
    ['Pre-trip issues', meta.preTripIssues, 'Vehicle inspection issues', ClipboardCheck, false],
    ['Critical issues', meta.criticalIssues, 'Safety priority', AlertTriangle, true],
    ['Vehicles affected', meta.vehiclesAffected, 'Unique vehicles in filter', ShieldAlert, false],
    ['Emergency breakdowns', meta.emergencyReported + meta.emergencyConfirmed, 'Reported or confirmed breakdowns', BellRing, true],
    ['Standby dispatched', meta.standbyDispatched, 'Passenger notification triggered', BusFront, false],
    ['Maintenance required', meta.maintenanceRequired, 'Needs workshop follow-up', Wrench, false],
  ]), [meta]);

  return (
    <AdminPromotionShell
      title={tp('Vehicle Issues')}
      subtitle={tp('Review driver-reported vehicle defects and decide operational follow-up for affected trips and buses.')}
      action={(
        <button type="button" onClick={loadIssues} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white">
          <RefreshCcw className="h-4 w-4" />
          {tp('Refresh')}
        </button>
      )}
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        {kpis.map(([label, value, detailText, Icon, critical]) => (
          <KpiCard key={label} label={tp(label)} value={value} detail={tp(detailText)} icon={Icon} critical={critical} />
        ))}
      </section>

      <section className="mt-6 rounded-2xl border border-outline-variant/35 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className={fieldClassName}>
            <option value="">{tp('All status')}</option>
            {statuses.map((option) => <option key={option} value={option}>{translateLabel(option, tp)}</option>)}
          </select>
          <select value={filters.severity} onChange={(event) => updateFilter('severity', event.target.value)} className={fieldClassName}>
            <option value="">{tp('All severity')}</option>
            {severities.map((option) => <option key={option} value={option}>{translateLabel(option, tp)}</option>)}
          </select>
          <select value={filters.issueType} onChange={(event) => updateFilter('issueType', event.target.value)} className={fieldClassName}>
            <option value="">{tp('All issue types')}</option>
            {issueTypes.map((option) => <option key={option} value={option}>{translateLabel(option, tp)}</option>)}
          </select>
          <input value={filters.vehicleId} onChange={(event) => updateFilter('vehicleId', event.target.value)} className={fieldClassName} placeholder={tp('Vehicle ObjectId')} />
          <select value={filters.emergency} onChange={(event) => updateFilter('emergency', event.target.value)} className={fieldClassName}>
            <option value="">{tp('All workflows')}</option>
            <option value="true">{tp('Emergency breakdown only')}</option>
            <option value="false">{tp('Pre-trip inspection only')}</option>
          </select>
          <select value={filters.emergencyStatus} onChange={(event) => updateFilter('emergencyStatus', event.target.value)} className={fieldClassName}>
            <option value="">{tp('All emergency status')}</option>
            {emergencyStatuses.map((option) => <option key={option} value={option}>{translateLabel(option, tp)}</option>)}
          </select>
          <input type="date" value={filters.startDate} onChange={(event) => updateFilter('startDate', event.target.value)} className={fieldClassName} />
          <input type="date" value={filters.endDate} onChange={(event) => updateFilter('endDate', event.target.value)} className={fieldClassName} />
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-outline-variant/35 bg-white shadow-sm">
        <div className="border-b border-outline-variant/30 bg-surface-container-low px-5 py-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-outline">{tp('Operations queue')}</p>
              <h2 className="mt-1 text-xl font-headline font-black text-primary">{tp('Vehicle issue handling')}</h2>
            </div>
            <p className="text-sm font-semibold text-on-surface-variant">
              {tp('Showing vehicle issues')
                .replace('{shown}', issues.length)
                .replace('{total}', meta.total || issues.length)}
            </p>
          </div>
        </div>
        <div className="space-y-3 bg-surface-container-low/40 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center rounded-2xl bg-white px-5 py-12 text-on-surface-variant">
              <LoaderCircle className="mr-3 h-5 w-5 animate-spin text-primary" />
              {tp('Loading vehicle issues...')}
            </div>
          ) : issues.length ? issues.map((issue) => (
            <VehicleIssueQueueCard key={issue._id} issue={issue} onOpen={openDetail} />
          )) : (
            <div className="rounded-2xl bg-white px-5 py-12 text-center text-sm font-semibold text-on-surface-variant">
              {tp('No vehicle issues found.')}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-outline-variant/30 px-5 py-4">
          <p className="text-sm text-on-surface-variant">{tp(`Page ${meta.page} of ${meta.totalPages}`)}</p>
          <div className="flex gap-2">
            <button type="button" disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))} className="rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-40">{tp('Previous')}</button>
            <button type="button" disabled={filters.page >= meta.totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))} className="rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-40">{tp('Next')}</button>
          </div>
        </div>
      </section>

      {selectedId ? (
        <DetailDrawer
          issue={detail}
          isLoading={isDetailLoading}
          onClose={() => {
            setSelectedId('');
            setDetail(null);
          }}
          onAction={(action) => {
            if (action === 'confirm_emergency') {
              void confirmEmergencyBreakdown();
              return;
            }
            if (action === 'dispatch_standby_bus') {
              setReplacementModalOpen(true);
              return;
            }
            if (action === 'resolve_emergency') {
              void resolveEmergencyBreakdown();
              return;
            }
            if (action === 'assign_replacement_vehicle') {
              setReplacementModalOpen(true);
              return;
            }
            setReviewAction(action);
          }}
        />
      ) : null}

      <ReviewModal
        issue={detail}
        action={reviewAction}
        isSaving={isSaving}
        onClose={() => setReviewAction('')}
        onSubmit={submitReview}
      />

      <ReplacementVehicleModal
        open={replacementModalOpen}
        tripId={detail?.tripId}
        requiredCapacity={detail?.vehicle?.capacity}
        title={detail?.emergencyBreakdown?.isEmergency ? tp('Dispatch Standby Bus') : tp('Assign Replacement Vehicle')}
        onClose={() => setReplacementModalOpen(false)}
        onConfirm={detail?.emergencyBreakdown?.isEmergency ? dispatchStandbyBus : submitIssueReplacement}
        onAssigned={() => {
          setReplacementModalOpen(false);
        }}
      />
    </AdminPromotionShell>
  );
};

export default VehicleIssuesPage;
