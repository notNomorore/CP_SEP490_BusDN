import React, { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from '../../../../shared/utils/toast.js';
import {
  AlertOctagon,
  Ban,
  Eye,
  FileWarning,
  LoaderCircle,
  RefreshCcw,
  ShieldBan,
  UserRoundX,
  X,
} from 'lucide-react';
import AdminPromotionShell from '../../promotions/components/AdminPromotionShell.jsx';
import passengerComplianceService from '../services/passengerComplianceService.js';

const fieldClass = 'w-full rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20';
const types = ['FARE_EVASION', 'INVALID_TICKET', 'DISORDERLY_BEHAVIOR', 'HARASSMENT', 'PROPERTY_DAMAGE', 'OTHER'];
const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const statuses = ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'];
const restrictionTypes = ['WARNING', 'TEMPORARY_SUSPENSION', 'ROUTE_BAN', 'ACCOUNT_SUSPENSION'];
const initialFilters = {
  page: 1,
  limit: 10,
  passengerId: '',
  violationType: '',
  severity: '',
  status: '',
  routeId: '',
  startDate: '',
  endDate: '',
};

const dateTime = (value) => {
  try {
    return value ? format(new Date(value), 'dd/MM/yyyy HH:mm') : 'N/A';
  } catch {
    return 'N/A';
  }
};

const severityClass = {
  LOW: 'bg-secondary-container text-on-secondary-container',
  MEDIUM: 'bg-primary-fixed text-on-primary-fixed',
  HIGH: 'bg-[#ffe0b2] text-[#7a3e00]',
  CRITICAL: 'bg-error-container text-on-error-container',
};
const restrictionClass = {
  ACTIVE: 'bg-error-container text-on-error-container',
  REVOKED: 'bg-surface-container text-on-surface-variant',
  EXPIRED: 'bg-primary-fixed text-on-primary-fixed',
};

const Metric = ({ label, value, icon: Icon, critical }) => (
  <div className={`rounded-[24px] border bg-white/85 p-5 shadow-sm ${critical ? 'border-error/30' : 'border-outline-variant/35'}`}>
    <div className="flex items-center justify-between">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-outline">{label}</p>
      <Icon className={`h-5 w-5 ${critical ? 'text-error' : 'text-on-tertiary-container'}`} />
    </div>
    <p className="mt-4 text-3xl font-headline font-extrabold text-primary">{value || 0}</p>
  </div>
);

const ApplyRestrictionModal = ({ violation, onClose, onSaved }) => {
  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);
  const [form, setForm] = useState({
    restrictionType: violation?.recommendedRestriction || 'WARNING',
    reason: '',
    startDate: format(now, "yyyy-MM-dd'T'HH:mm"),
    endDate: format(nextWeek, "yyyy-MM-dd'T'HH:mm"),
  });
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.reason.trim()) {
      toast.error('Restriction reason is required');
      return;
    }
    setSaving(true);
    try {
      await passengerComplianceService.applyRestriction({
        passengerId: violation.passengerId,
        violationId: violation._id,
        ...form,
        reason: form.reason.trim(),
      });
      toast.success('Passenger restriction applied');
      onSaved();
    } catch (error) {
      toast.error(error.message || 'Unable to apply restriction');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 px-4 py-8">
      <form onSubmit={submit} className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-outline">Apply restriction</p>
            <h2 className="mt-2 text-2xl font-extrabold text-primary">{violation.passenger?.fullName}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-surface-container"><X className="h-5 w-5" /></button>
        </div>
        {violation.severity === 'CRITICAL' ? (
          <div className="mt-5 rounded-2xl bg-error-container p-4 text-sm text-on-error-container">
            Critical violation detected. Account suspension is recommended.
          </div>
        ) : null}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-2 block text-sm font-semibold">Restriction type</span>
            <select className={fieldClass} value={form.restrictionType} onChange={(e) => setForm({ ...form, restrictionType: e.target.value })}>
              {restrictionTypes.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-sm font-semibold">Start date</span>
            <input type="datetime-local" className={fieldClass} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </label>
          <label>
            <span className="mb-2 block text-sm font-semibold">End date</span>
            <input type="datetime-local" className={fieldClass} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-2 block text-sm font-semibold">Reason</span>
            <textarea className={`${fieldClass} min-h-28 resize-none`} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full border px-5 py-3 text-sm font-bold">Cancel</button>
          <button disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldBan className="h-4 w-4" />}
            Apply restriction
          </button>
        </div>
      </form>
    </div>
  );
};

const ViolationDetailModal = ({ detail, loading, onClose, onApply }) => (
  <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-8">
    <div className="w-full max-w-4xl rounded-[28px] bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-outline">Violation detail</p>
          <h2 className="mt-2 text-2xl font-extrabold text-primary">{detail?.violationType || 'Loading...'}</h2>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-surface-container"><X className="h-5 w-5" /></button>
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><LoaderCircle className="mr-2 animate-spin" />Loading violation...</div>
      ) : (
        <>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
            <div>
              <p className="rounded-[22px] bg-surface-container-low p-5 text-sm leading-7">{detail?.description}</p>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  ['Passenger', detail?.passenger?.fullName],
                  ['Passenger email', detail?.passenger?.email],
                  ['Reporter', detail?.reporter?.fullName],
                  ['Route', detail?.route?.name || detail?.routeId],
                  ['Trip', detail?.trip?._id || detail?.tripId],
                  ['Reported at', dateTime(detail?.reportedAt)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[18px] border border-outline-variant/30 p-4">
                    <dt className="text-xs font-bold uppercase tracking-[0.12em] text-outline">{label}</dt>
                    <dd className="mt-2 break-words text-sm font-semibold">{value || 'N/A'}</dd>
                  </div>
                ))}
              </dl>
              <h3 className="mt-6 font-bold text-primary">Evidence</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {detail?.evidence?.length ? detail.evidence.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-[18px] border p-3 text-sm font-bold text-primary hover:bg-surface-container-low">
                    <img src={url} alt="Violation evidence" className="mb-3 h-36 w-full rounded-xl object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    Open evidence
                  </a>
                )) : <p className="text-sm text-on-surface-variant">No evidence attached.</p>}
              </div>
            </div>
            <aside>
              <div className="rounded-[22px] bg-surface-container-low p-5">
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${severityClass[detail?.severity]}`}>{detail?.severity}</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold">{detail?.status}</span>
                </div>
                <button type="button" onClick={onApply} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white">
                  <ShieldBan className="h-4 w-4" />Apply restriction
                </button>
              </div>
              <h3 className="mt-5 font-bold text-primary">Restriction history</h3>
              <div className="mt-3 space-y-3">
                {detail?.history?.length ? detail.history.map((item) => (
                  <div key={item._id} className="rounded-[18px] border p-4">
                    <p className="text-sm font-bold">{item.restrictionType}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">{item.status} - {dateTime(item.createdAt)}</p>
                  </div>
                )) : <p className="text-sm text-on-surface-variant">No restrictions recorded.</p>}
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  </div>
);

const PassengerCompliancePage = () => {
  const [filters, setFilters] = useState(initialFilters);
  const [violations, setViolations] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [restrictions, setRestrictions] = useState({ activeRestrictions: [], expiredRestrictions: [], restrictionHistory: [] });
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [applyTarget, setApplyTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [violationResponse, restrictionResponse] = await Promise.all([
        passengerComplianceService.getViolations(filters),
        passengerComplianceService.getRestrictions(),
      ]);
      setViolations(violationResponse.data || []);
      setMeta(violationResponse.meta || {});
      setRestrictions(restrictionResponse.data || {});
    } catch (error) {
      toast.error(error.message || 'Unable to load passenger compliance records');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const response = await passengerComplianceService.getViolation(id);
      setDetail(response.data);
    } catch (error) {
      toast.error(error.message || 'Unable to load violation detail');
      setSelectedId('');
    } finally {
      setDetailLoading(false);
    }
  };

  const updateRestriction = async (id, status) => {
    try {
      await passengerComplianceService.updateRestriction(id, status);
      toast.success(`Restriction ${status.toLowerCase()}`);
      await load();
    } catch (error) {
      toast.error(error.message || 'Unable to update restriction');
    }
  };

  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value, page: 1 }));

  return (
    <AdminPromotionShell
      title="Passenger Compliance"
      subtitle="Review reported passenger misconduct, inspect evidence, and apply proportionate travel or account restrictions."
      action={<button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white"><RefreshCcw className="h-4 w-4" />Refresh</button>}
    >
      <section className="rounded-[28px] border border-outline-variant/35 bg-white/80 p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input className={fieldClass} value={filters.passengerId} onChange={(e) => updateFilter('passengerId', e.target.value)} placeholder="Passenger ObjectId" />
          <select className={fieldClass} value={filters.violationType} onChange={(e) => updateFilter('violationType', e.target.value)}><option value="">All violation types</option>{types.map((item) => <option key={item}>{item}</option>)}</select>
          <select className={fieldClass} value={filters.severity} onChange={(e) => updateFilter('severity', e.target.value)}><option value="">All severity</option>{severities.map((item) => <option key={item}>{item}</option>)}</select>
          <select className={fieldClass} value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}><option value="">All status</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
          <input className={fieldClass} value={filters.routeId} onChange={(e) => updateFilter('routeId', e.target.value)} placeholder="Route ObjectId" />
          <input type="date" className={fieldClass} value={filters.startDate} onChange={(e) => updateFilter('startDate', e.target.value)} />
          <input type="date" className={fieldClass} value={filters.endDate} onChange={(e) => updateFilter('endDate', e.target.value)} />
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total violations" value={meta.totalViolations} icon={FileWarning} />
        <Metric label="Active restrictions" value={meta.activeRestrictions} icon={Ban} />
        <Metric label="Critical violations" value={meta.criticalViolations} icon={AlertOctagon} critical />
        <Metric label="Suspended passengers" value={meta.suspendedPassengers} icon={UserRoundX} critical />
      </section>

      <section className="mt-6 overflow-hidden rounded-[28px] border border-outline-variant/35 bg-white/85">
        <div className="border-b px-5 py-4"><h2 className="text-lg font-bold text-primary">Violation records</h2></div>
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] divide-y divide-outline-variant/30 text-left text-sm">
            <thead className="bg-surface-container-low text-xs uppercase tracking-[0.12em] text-outline">
              <tr>{['Reported', 'Passenger', 'Type', 'Route', 'Reporter', 'Severity', 'Status', 'Evidence', 'Action'].map((heading) => <th key={heading} className="px-4 py-4">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {loading ? <tr><td colSpan="9" className="py-12 text-center">Loading violations...</td></tr> : violations.length ? violations.map((item) => (
                <tr key={item._id} className={item.severity === 'CRITICAL' ? 'bg-error-container/20' : 'hover:bg-surface-container-low/70'}>
                  <td className="px-4 py-4">{dateTime(item.reportedAt)}</td>
                  <td className="px-4 py-4"><p className="font-bold text-primary">{item.passenger?.fullName || 'Unknown'}</p><p className="text-xs text-on-surface-variant">{item.passenger?.email}</p></td>
                  <td className="px-4 py-4 font-semibold">{item.violationType}</td>
                  <td className="px-4 py-4">{item.routeId || 'N/A'}</td>
                  <td className="px-4 py-4">{item.reporter?.fullName || 'Unknown'}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${severityClass[item.severity]}`}>{item.severity}</span></td>
                  <td className="px-4 py-4">{item.status}</td>
                  <td className="px-4 py-4">{item.evidenceUrls?.length || 0}</td>
                  <td className="px-4 py-4"><button type="button" title="View violation" onClick={() => openDetail(item._id)} className="rounded-full p-2 text-primary hover:bg-surface-container"><Eye className="h-4 w-4" /></button></td>
                </tr>
              )) : <tr><td colSpan="9" className="py-12 text-center text-on-surface-variant">No passenger violations found.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t px-5 py-4 text-sm">
          <span>Page {meta.page || 1} of {meta.totalPages || 1}</span>
          <div className="flex gap-2">
            <button disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))} className="rounded-full border px-4 py-2 disabled:opacity-40">Previous</button>
            <button disabled={filters.page >= meta.totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))} className="rounded-full border px-4 py-2 disabled:opacity-40">Next</button>
          </div>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-[28px] border border-outline-variant/35 bg-white/85">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-bold text-primary">Restriction history</h2>
          <p className="mt-1 text-sm text-on-surface-variant">{restrictions.activeRestrictions?.length || 0} currently active, {restrictions.expiredRestrictions?.length || 0} expired.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1000px] divide-y divide-outline-variant/30 text-left text-sm">
            <thead><tr>{['Passenger', 'Restriction', 'Violation', 'Period', 'Applied by', 'Status', 'Action'].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-outline-variant/20">
              {restrictions.restrictionHistory?.length ? restrictions.restrictionHistory.map((item) => (
                <tr key={item._id}>
                  <td className="px-4 py-4 font-bold">{item.passengerId?.fullName || 'Unknown'}</td>
                  <td className="px-4 py-4">{item.restrictionType}</td>
                  <td className="px-4 py-4">{item.violationId?.violationType || 'N/A'}</td>
                  <td className="px-4 py-4">{dateTime(item.startDate)}<br />{dateTime(item.endDate)}</td>
                  <td className="px-4 py-4">{item.appliedBy?.fullName || 'Admin'}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${restrictionClass[item.status]}`}>{item.status}</span></td>
                  <td className="px-4 py-4">
                    {item.status === 'ACTIVE' ? <button type="button" onClick={() => updateRestriction(item._id, 'REVOKED')} className="rounded-full border px-3 py-2 text-xs font-bold">Revoke</button> : null}
                    {item.status === 'REVOKED' && new Date(item.endDate) > new Date() ? <button type="button" onClick={() => updateRestriction(item._id, 'ACTIVE')} className="rounded-full border px-3 py-2 text-xs font-bold">Activate</button> : null}
                  </td>
                </tr>
              )) : <tr><td colSpan="7" className="py-10 text-center text-on-surface-variant">No restriction history.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {selectedId ? <ViolationDetailModal detail={detail} loading={detailLoading} onClose={() => { setSelectedId(''); setDetail(null); }} onApply={() => setApplyTarget(detail)} /> : null}
      {applyTarget ? <ApplyRestrictionModal violation={applyTarget} onClose={() => setApplyTarget(null)} onSaved={() => { setApplyTarget(null); setSelectedId(''); setDetail(null); load(); }} /> : null}
    </AdminPromotionShell>
  );
};

export default PassengerCompliancePage;
