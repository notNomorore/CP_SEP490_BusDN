import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  LoaderCircle,
  RefreshCcw,
  ShieldCheck,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import toast from '../../../../shared/utils/toast.js';
import AdminPromotionShell from '../../promotions/components/AdminPromotionShell.jsx';
import maintenanceApprovalService from '../services/maintenanceApprovalService.js';

const fieldClassName =
  'w-full rounded-xl border border-outline-variant/50 bg-surface px-3 py-2.5 text-sm text-on-surface focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20';

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  try {
    return format(new Date(value), 'dd/MM/yyyy HH:mm');
  } catch {
    return 'N/A';
  }
};

const labelize = (value) => String(value || 'N/A').replaceAll('_', ' ');

const getVehicleLabel = (task) => (
  task?.vehicle?.plateNumber
  || task?.vehicle?.busCode
  || task?.vehicle?.vehicleCode
  || task?.vehicleId
  || 'N/A'
);

const ApprovalModal = ({ task, isSaving, onClose, onSubmit }) => {
  const [safetyCheckPassed, setSafetyCheckPassed] = useState(true);
  const [approvalNote, setApprovalNote] = useState('');

  useEffect(() => {
    setSafetyCheckPassed(true);
    setApprovalNote('');
  }, [task]);

  if (!task) return null;

  const blockingIssues = task.returnToServiceCheck?.blockingCriticalIssues || [];

  const submit = () => {
    if (!safetyCheckPassed) {
      toast.error('Safety check must pass before approval');
      return;
    }
    if (blockingIssues.length) {
      toast.error('Resolve or dismiss critical issues before approval');
      return;
    }
    onSubmit({ safetyCheckPassed, approvalNote: approvalNote.trim() });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-outline">Approve maintenance</p>
            <h3 className="mt-2 text-xl font-headline font-black text-primary">{getVehicleLabel(task)}</h3>
          </div>
          <button type="button" title="Close" onClick={onClose} className="rounded-full p-2 hover:bg-surface-container">
            <X className="h-5 w-5" />
          </button>
        </div>

        {blockingIssues.length ? (
          <div className="mt-4 rounded-xl border border-error/35 bg-error-container/30 p-3 text-sm font-semibold text-on-error-container">
            Critical unresolved issues block approval.
          </div>
        ) : null}

        <label className="mt-5 flex items-center gap-3 rounded-xl border border-outline-variant/40 p-3 text-sm font-bold text-on-surface">
          <input
            type="checkbox"
            checked={safetyCheckPassed}
            onChange={(event) => setSafetyCheckPassed(event.target.checked)}
            className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
          />
          Safety check passed
        </label>

        <label className="mt-5 block space-y-2">
          <span className="text-sm font-semibold text-on-surface">Approval note</span>
          <textarea
            value={approvalNote}
            onChange={(event) => setApprovalNote(event.target.value)}
            className={`${fieldClassName} min-h-[120px] resize-none`}
            placeholder="Return-to-service notes"
          />
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full border px-5 py-2.5 text-sm font-bold">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isSaving || blockingIssues.length > 0}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Approve
          </button>
        </div>
      </div>
    </div>
  );
};

const RejectModal = ({ task, isSaving, onClose, onSubmit }) => {
  const [approvalNote, setApprovalNote] = useState('');

  useEffect(() => {
    setApprovalNote('');
  }, [task]);

  if (!task) return null;

  const submit = () => {
    if (!approvalNote.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    onSubmit({ approvalNote: approvalNote.trim(), safetyCheckPassed: false });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-outline">Reject completion</p>
            <h3 className="mt-2 text-xl font-headline font-black text-primary">{getVehicleLabel(task)}</h3>
          </div>
          <button type="button" title="Close" onClick={onClose} className="rounded-full p-2 hover:bg-surface-container">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mt-5 block space-y-2">
          <span className="text-sm font-semibold text-on-surface">Rejection reason</span>
          <textarea
            value={approvalNote}
            onChange={(event) => setApprovalNote(event.target.value)}
            className={`${fieldClassName} min-h-[140px] resize-none`}
            placeholder="Required rework and safety concerns"
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
            className="inline-flex items-center gap-2 rounded-full bg-error px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            Reject
          </button>
        </div>
      </div>
    </div>
  );
};

const DetailDrawer = ({ task, onClose, onApprove, onReject }) => {
  if (!task) return null;

  const issue = task.issue;
  const blockingIssues = task.returnToServiceCheck?.blockingCriticalIssues || [];

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/35">
      <button type="button" aria-label="Close detail" onClick={onClose} className="flex-1" />
      <aside className="h-full w-full max-w-3xl overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-outline">Maintenance approval</p>
            <h2 className="mt-2 text-2xl font-headline font-black text-primary">{task.title}</h2>
            <p className="mt-1 text-sm font-semibold text-on-surface-variant">{getVehicleLabel(task)}</p>
          </div>
          <button type="button" title="Close" onClick={onClose} className="rounded-full p-2 hover:bg-surface-container">
            <X className="h-5 w-5" />
          </button>
        </div>

        {blockingIssues.length ? (
          <div className="mt-6 rounded-2xl border border-error/35 bg-error-container/30 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-error" />
              <div>
                <p className="font-bold text-on-error-container">Critical issue blocks return to service</p>
                <div className="mt-3 space-y-2">
                  {blockingIssues.map((item) => (
                    <div key={item._id} className="rounded-xl bg-white/70 p-3 text-sm text-on-error-container">
                      <p className="font-bold">{labelize(item.issueType)} - {labelize(item.status)}</p>
                      <p className="mt-1">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onApprove(task)}
            disabled={blockingIssues.length > 0}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            Approve
          </button>
          <button type="button" onClick={() => onReject(task)} className="inline-flex items-center gap-2 rounded-full border border-error/40 px-4 py-2 text-sm font-bold text-error">
            <XCircle className="h-4 w-4" />
            Reject
          </button>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            ['Vehicle', getVehicleLabel(task)],
            ['Vehicle status', task.vehicle?.status],
            ['Task status', labelize(task.status)],
            ['Approval status', labelize(task.approvalStatus)],
            ['Priority', labelize(task.priority)],
            ['Completed at', formatDateTime(task.updatedAt)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-outline-variant/30 p-4">
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-outline">{label}</dt>
              <dd className="mt-2 break-words text-sm font-semibold text-on-surface">{value || 'N/A'}</dd>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border border-outline-variant/30 p-4">
          <h3 className="font-bold text-primary">Maintenance result</h3>
          <p className="mt-3 text-sm leading-7 text-on-surface">{task.description}</p>
          {task.adminNote ? <p className="mt-3 text-sm text-on-surface-variant">{task.adminNote}</p> : null}
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-outline-variant/30 p-4">
            <h3 className="font-bold text-primary">Issue summary</h3>
            {issue ? (
              <div className="mt-3 space-y-2 text-sm">
                <p className="font-bold text-on-surface">{labelize(issue.issueType)} - {labelize(issue.severity)}</p>
                <p className="text-on-surface-variant">{issue.description}</p>
                <p className="text-on-surface-variant">Status: {labelize(issue.status)}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-on-surface-variant">No linked issue.</p>
            )}
          </div>

          <div className="rounded-2xl border border-outline-variant/30 p-4">
            <h3 className="font-bold text-primary">Checklist</h3>
            <div className="mt-3 space-y-2 text-sm text-on-surface">
              <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Safety check required at approval</p>
              <p className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-primary" /> Completion reviewed by admin</p>
              <p className="flex items-center gap-2"><Wrench className="h-4 w-4 text-primary" /> Vehicle remains unavailable until approved</p>
            </div>
          </div>
        </section>

        {issue?.photos?.length ? (
          <section className="mt-6 rounded-2xl border border-outline-variant/30 p-4">
            <h3 className="font-bold text-primary">Photos</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {issue.photos.map((photo) => (
                <a key={photo} href={photo} target="_blank" rel="noreferrer" className="truncate rounded-xl bg-surface-container-low p-3 text-sm font-semibold text-primary">
                  {photo}
                </a>
              ))}
            </div>
          </section>
        ) : null}
      </aside>
    </div>
  );
};

const MaintenanceApprovalPage = () => {
  const [tasks, setTasks] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = useState({ page: 1, limit: 10 });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [approveTask, setApproveTask] = useState(null);
  const [rejectTask, setRejectTask] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await maintenanceApprovalService.getPendingApproval(filters);
      setTasks(response.data || []);
      setMeta((current) => ({ ...current, ...(response.meta || {}) }));
    } catch (error) {
      toast.error(error.message || 'Unable to load maintenance approvals');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const counts = useMemo(() => {
    const criticalBlocked = tasks.filter((task) => task.returnToServiceCheck?.blockingCriticalIssues?.length).length;
    return { pending: meta.total || tasks.length, criticalBlocked };
  }, [meta.total, tasks]);

  const submitApprove = async (payload) => {
    setIsSaving(true);
    try {
      await maintenanceApprovalService.approveTask(approveTask._id, payload);
      toast.success('Maintenance approved');
      setApproveTask(null);
      setSelectedTask(null);
      await loadTasks();
    } catch (error) {
      toast.error(error.message || 'Unable to approve maintenance');
    } finally {
      setIsSaving(false);
    }
  };

  const submitReject = async (payload) => {
    setIsSaving(true);
    try {
      await maintenanceApprovalService.rejectTask(rejectTask._id, payload);
      toast.success('Maintenance rejected for rework');
      setRejectTask(null);
      setSelectedTask(null);
      await loadTasks();
    } catch (error) {
      toast.error(error.message || 'Unable to reject maintenance');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminPromotionShell
      title="Maintenance Approval"
      subtitle="Review completed maintenance before vehicles return to passenger service."
      action={(
        <button type="button" onClick={loadTasks} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white">
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      )}
    >
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-outline-variant/35 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-outline">Pending approval</p>
          <p className="mt-3 text-3xl font-headline font-black text-primary">{counts.pending}</p>
        </div>
        <div className="rounded-2xl border border-error/35 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-outline">Critical blocked</p>
          <p className="mt-3 text-3xl font-headline font-black text-error">{counts.criticalBlocked}</p>
        </div>
        <div className="rounded-2xl border border-outline-variant/35 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-outline">Vehicle release rule</p>
          <p className="mt-3 text-sm font-semibold text-on-surface-variant">Approved tasks restore vehicle availability only after safety clearance.</p>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-outline-variant/35 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1000px] divide-y divide-outline-variant/30 text-left text-sm">
            <thead className="bg-surface-container-low text-xs uppercase tracking-[0.12em] text-outline">
              <tr>
                {['Task', 'Vehicle', 'Issue', 'Priority', 'Completed', 'Safety', 'Action'].map((heading) => (
                  <th key={heading} className="px-4 py-4">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {isLoading ? (
                <tr><td colSpan="7" className="px-5 py-12 text-center text-on-surface-variant">Loading maintenance tasks...</td></tr>
              ) : tasks.length ? tasks.map((task) => {
                const blockingIssues = task.returnToServiceCheck?.blockingCriticalIssues || [];
                return (
                  <tr key={task._id} className={blockingIssues.length ? 'bg-error-container/20' : 'hover:bg-surface-container-low/70'}>
                    <td className="px-4 py-4">
                      <p className="font-bold text-primary">{task.title}</p>
                      <p className="mt-1 max-w-[280px] truncate text-xs text-on-surface-variant">{task.description}</p>
                    </td>
                    <td className="px-4 py-4">{getVehicleLabel(task)}</td>
                    <td className="px-4 py-4">{task.issue ? `${labelize(task.issue.issueType)} (${labelize(task.issue.status)})` : 'N/A'}</td>
                    <td className="px-4 py-4">{labelize(task.priority)}</td>
                    <td className="px-4 py-4">{formatDateTime(task.updatedAt)}</td>
                    <td className="px-4 py-4">
                      {blockingIssues.length ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-error-container px-3 py-1 text-xs font-bold text-on-error-container">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary-container px-3 py-1 text-xs font-bold text-on-secondary-container">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Clear
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <button type="button" title="View approval detail" onClick={() => setSelectedTask(task)} className="rounded-full p-2 text-primary hover:bg-surface-container">
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="7" className="px-5 py-12 text-center text-on-surface-variant">No completed maintenance tasks are waiting for approval.</td></tr>
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

      <DetailDrawer
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onApprove={setApproveTask}
        onReject={setRejectTask}
      />
      <ApprovalModal
        task={approveTask}
        isSaving={isSaving}
        onClose={() => setApproveTask(null)}
        onSubmit={submitApprove}
      />
      <RejectModal
        task={rejectTask}
        isSaving={isSaving}
        onClose={() => setRejectTask(null)}
        onSubmit={submitReject}
      />
    </AdminPromotionShell>
  );
};

export default MaintenanceApprovalPage;
