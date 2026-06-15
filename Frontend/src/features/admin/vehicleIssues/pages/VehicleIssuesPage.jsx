import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  AlertTriangle,
  ClipboardCheck,
  Eye,
  LoaderCircle,
  RefreshCcw,
  ShieldAlert,
  Wrench,
  X,
} from 'lucide-react';
import toast from '../../../../shared/utils/toast.js';
import AdminPromotionShell from '../../promotions/components/AdminPromotionShell.jsx';
import { ReplacementVehicleModal } from '../../vehicleReassignments';
import vehicleIssueService from '../services/vehicleIssueService.js';

const fieldClassName =
  'w-full rounded-xl border border-outline-variant/50 bg-surface px-3 py-2.5 text-sm text-on-surface focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20';

const issueTypes = [
  'engine',
  'brake',
  'tire',
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

const defaultFilters = {
  page: 1,
  limit: 10,
  status: '',
  severity: '',
  vehicleId: '',
  issueType: '',
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

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  try {
    return format(new Date(value), 'dd/MM/yyyy HH:mm');
  } catch {
    return 'N/A';
  }
};

const labelize = (value) => String(value || 'N/A').replaceAll('_', ' ');

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

const ReviewModal = ({ issue, action, isSaving, onClose, onSubmit }) => {
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
      toast.error('Admin note is required for this decision');
      return;
    }

    if (action === 'assign_replacement_vehicle' && !replacementVehicleId.trim()) {
      toast.error('Replacement vehicle ID is required');
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
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-outline">Review decision</p>
            <h3 className="mt-2 text-xl font-headline font-black text-primary">{actionCopy[action]}</h3>
          </div>
          <button type="button" title="Close" onClick={onClose} className="rounded-full p-2 hover:bg-surface-container">
            <X className="h-5 w-5" />
          </button>
        </div>

        {issue.severity === 'critical' ? (
          <div className="mt-4 rounded-xl border border-error/30 bg-error-container/30 p-3 text-sm font-semibold text-on-error-container">
            Critical safety issue. Take this vehicle out of service unless maintenance confirms it is safe.
          </div>
        ) : null}

        {action === 'assign_replacement_vehicle' ? (
          <label className="mt-5 block space-y-2">
            <span className="text-sm font-semibold text-on-surface">Replacement vehicle ID</span>
            <input
              value={replacementVehicleId}
              onChange={(event) => setReplacementVehicleId(event.target.value)}
              className={fieldClassName}
              placeholder="FleetBus ObjectId"
            />
          </label>
        ) : null}

        <label className="mt-5 block space-y-2">
          <span className="text-sm font-semibold text-on-surface">Admin note</span>
          <textarea
            value={adminNote}
            onChange={(event) => setAdminNote(event.target.value)}
            className={`${fieldClassName} min-h-[140px] resize-none`}
            placeholder="Decision reason and follow-up notes"
          />
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full border px-5 py-2.5 text-sm font-bold">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            Save decision
          </button>
        </div>
      </div>
    </div>
  );
};

const DetailDrawer = ({ issue, isLoading, onClose, onAction }) => {
  const tripAffected = ['PLANNED', 'ASSIGNED', 'IN_PROGRESS'].includes(issue?.trip?.status);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/35">
      <button type="button" aria-label="Close detail" onClick={onClose} className="flex-1" />
      <aside className="h-full w-full max-w-3xl overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-outline">Vehicle issue detail</p>
            <h2 className="mt-2 text-2xl font-headline font-black text-primary">
              {issue ? labelize(issue.issueType) : 'Loading issue...'}
            </h2>
          </div>
          <button type="button" title="Close" onClick={onClose} className="rounded-full p-2 hover:bg-surface-container">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-primary">
            <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
            Loading issue detail...
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {issue?.severity === 'critical' ? (
              <div className="rounded-2xl border border-error/35 bg-error-container/30 p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-error" />
                  <div>
                    <p className="font-bold text-on-error-container">Critical safety issue</p>
                    <p className="mt-1 text-sm text-on-error-container">
                      {issue.criticalSafetyRecommendation}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl bg-surface-container-low p-4">
              <p className="text-sm leading-7 text-on-surface">{issue?.description}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onAction('mark_reviewed')} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white">Mark reviewed</button>
              <button type="button" onClick={() => onAction('no_action_needed')} className="rounded-full border px-4 py-2 text-sm font-bold">No action needed</button>
              <button type="button" onClick={() => onAction('create_maintenance_task')} className="rounded-full border px-4 py-2 text-sm font-bold">Create maintenance task</button>
              <button type="button" onClick={() => onAction('mark_vehicle_under_maintenance')} className="rounded-full border border-error/40 px-4 py-2 text-sm font-bold text-error">Mark vehicle under maintenance</button>
              {tripAffected ? (
                <button type="button" onClick={() => onAction('assign_replacement_vehicle')} className="rounded-full border px-4 py-2 text-sm font-bold">Assign replacement vehicle</button>
              ) : null}
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ['Vehicle', issue?.vehicle?.plateNumber || issue?.vehicle?.busCode || issue?.vehicleId],
                ['Vehicle status', issue?.vehicle?.status],
                ['Trip', issue?.trip?.scheduleCode || issue?.tripId || 'N/A'],
                ['Trip status', issue?.trip?.status || 'N/A'],
                ['Driver', issue?.trip?.driver?.fullName || issue?.reportedBy?.fullName || 'Unknown'],
                ['Reported at', formatDateTime(issue?.reportedAt)],
                ['Location', issue?.location?.text || 'N/A'],
                ['Admin note', issue?.adminNote || 'N/A'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-outline-variant/30 p-4">
                  <dt className="text-xs font-bold uppercase tracking-[0.12em] text-outline">{label}</dt>
                  <dd className="mt-2 break-words text-sm font-semibold text-on-surface">{value || 'N/A'}</dd>
                </div>
              ))}
            </dl>

            <section>
              <h3 className="text-lg font-bold text-primary">Maintenance history</h3>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-outline-variant/30 p-4">
                  <p className="font-bold text-on-surface">Previous issues</p>
                  <div className="mt-3 space-y-3">
                    {issue?.maintenanceHistory?.relatedIssues?.length ? issue.maintenanceHistory.relatedIssues.map((item) => (
                      <div key={item._id} className="rounded-xl bg-surface-container-low p-3 text-sm">
                        <p className="font-bold text-primary">{labelize(item.issueType)} - {item.severity}</p>
                        <p className="text-on-surface-variant">{item.status} on {formatDateTime(item.reportedAt)}</p>
                      </div>
                    )) : <p className="text-sm text-on-surface-variant">No previous issues.</p>}
                  </div>
                </div>
                <div className="rounded-2xl border border-outline-variant/30 p-4">
                  <p className="font-bold text-on-surface">Maintenance tasks</p>
                  <div className="mt-3 space-y-3">
                    {issue?.maintenanceHistory?.maintenanceTasks?.length ? issue.maintenanceHistory.maintenanceTasks.map((item) => (
                      <div key={item._id} className="rounded-xl bg-surface-container-low p-3 text-sm">
                        <p className="font-bold text-primary">{item.title}</p>
                        <p className="text-on-surface-variant">{item.status} - {formatDateTime(item.createdAt)}</p>
                      </div>
                    )) : <p className="text-sm text-on-surface-variant">No maintenance tasks.</p>}
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
  const [filters, setFilters] = useState(defaultFilters);
  const [issues, setIssues] = useState([]);
  const [meta, setMeta] = useState({
    page: 1,
    totalPages: 1,
    newIssues: 0,
    criticalIssues: 0,
    vehiclesAffected: 0,
    maintenanceRequired: 0,
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
      toast.error(error.message || 'Unable to load vehicle issues');
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
      toast.error(error.message || 'Unable to load vehicle issue detail');
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
      toast.success('Vehicle issue decision stored');
      await loadIssues();
    } catch (error) {
      toast.error(error.message || 'Unable to review vehicle issue');
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

  const kpis = useMemo(() => ([
    ['New issues', meta.newIssues, 'Awaiting admin review', ClipboardCheck, false],
    ['Critical issues', meta.criticalIssues, 'Safety priority', AlertTriangle, true],
    ['Vehicles affected', meta.vehiclesAffected, 'Unique vehicles in filter', ShieldAlert, false],
    ['Maintenance required', meta.maintenanceRequired, 'Needs workshop follow-up', Wrench, false],
  ]), [meta]);

  return (
    <AdminPromotionShell
      title="Vehicle Issues"
      subtitle="Review driver-reported vehicle defects and decide operational follow-up for affected trips and buses."
      action={(
        <button type="button" onClick={loadIssues} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white">
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      )}
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map(([label, value, detailText, Icon, critical]) => (
          <KpiCard key={label} label={label} value={value} detail={detailText} icon={Icon} critical={critical} />
        ))}
      </section>

      <section className="mt-6 rounded-2xl border border-outline-variant/35 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className={fieldClassName}>
            <option value="">All status</option>
            {statuses.map((option) => <option key={option} value={option}>{labelize(option)}</option>)}
          </select>
          <select value={filters.severity} onChange={(event) => updateFilter('severity', event.target.value)} className={fieldClassName}>
            <option value="">All severity</option>
            {severities.map((option) => <option key={option} value={option}>{labelize(option)}</option>)}
          </select>
          <select value={filters.issueType} onChange={(event) => updateFilter('issueType', event.target.value)} className={fieldClassName}>
            <option value="">All issue types</option>
            {issueTypes.map((option) => <option key={option} value={option}>{labelize(option)}</option>)}
          </select>
          <input value={filters.vehicleId} onChange={(event) => updateFilter('vehicleId', event.target.value)} className={fieldClassName} placeholder="Vehicle ObjectId" />
          <input type="date" value={filters.startDate} onChange={(event) => updateFilter('startDate', event.target.value)} className={fieldClassName} />
          <input type="date" value={filters.endDate} onChange={(event) => updateFilter('endDate', event.target.value)} className={fieldClassName} />
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-outline-variant/35 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] divide-y divide-outline-variant/30 text-left text-sm">
            <thead className="bg-surface-container-low text-xs uppercase tracking-[0.12em] text-outline">
              <tr>
                {['Issue', 'Vehicle', 'Trip', 'Driver', 'Severity', 'Status', 'Reported', 'Action'].map((heading) => (
                  <th key={heading} className="px-4 py-4">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {isLoading ? (
                <tr><td colSpan="8" className="px-5 py-12 text-center text-on-surface-variant">Loading vehicle issues...</td></tr>
              ) : issues.length ? issues.map((issue) => (
                <tr key={issue._id} className={issue.severity === 'critical' ? 'bg-error-container/20' : 'hover:bg-surface-container-low/70'}>
                  <td className="px-4 py-4">
                    <p className="font-bold text-primary">{labelize(issue.issueType)}</p>
                    <p className="mt-1 max-w-[260px] truncate text-xs text-on-surface-variant">{issue.description}</p>
                  </td>
                  <td className="px-4 py-4">{issue.vehicle?.plateNumber || issue.vehicle?.busCode || issue.vehicleId || 'N/A'}</td>
                  <td className="px-4 py-4">{issue.trip?.scheduleCode || issue.tripId || 'N/A'}</td>
                  <td className="px-4 py-4">{issue.reportedBy?.fullName || issue.trip?.driver?.fullName || 'Unknown'}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${severityClassName[issue.severity]}`}>{labelize(issue.severity)}</span></td>
                  <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClassName[issue.status]}`}>{labelize(issue.status)}</span></td>
                  <td className="px-4 py-4">{formatDateTime(issue.reportedAt)}</td>
                  <td className="px-4 py-4">
                    <button type="button" title="View issue detail" onClick={() => openDetail(issue._id)} className="rounded-full p-2 text-primary hover:bg-surface-container">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="8" className="px-5 py-12 text-center text-on-surface-variant">No vehicle issues found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-outline-variant/30 px-5 py-4">
          <p className="text-sm text-on-surface-variant">Page {meta.page} of {meta.totalPages}</p>
          <div className="flex gap-2">
            <button type="button" disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))} className="rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-40">Previous</button>
            <button type="button" disabled={filters.page >= meta.totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))} className="rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-40">Next</button>
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
        title="Assign Replacement Vehicle"
        onClose={() => setReplacementModalOpen(false)}
        onConfirm={submitIssueReplacement}
        onAssigned={() => {
          setReplacementModalOpen(false);
        }}
      />
    </AdminPromotionShell>
  );
};

export default VehicleIssuesPage;
