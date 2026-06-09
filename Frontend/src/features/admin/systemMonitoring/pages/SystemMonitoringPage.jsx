import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  AlertOctagon,
  CheckCircle2,
  Eye,
  LoaderCircle,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShieldX,
  Siren,
  X,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import AdminPromotionShell from '../../promotions/components/AdminPromotionShell.jsx';
import systemMonitoringService from '../services/systemMonitoringService.js';

const fieldClass =
  'w-full rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm text-on-surface focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20';
const risks = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const suspiciousTypes = [
  'FAILED_LOGIN_ATTEMPTS',
  'UNUSUAL_LOCATION',
  'MULTIPLE_PAYMENT_FAILURES',
  'HIGH_VALUE_TRANSACTION',
  'ROLE_CHANGE',
  'SENSITIVE_DATA_ACCESS',
  'OTHER',
];

const dateTime = (value) => {
  try {
    return value ? format(new Date(value), 'dd/MM/yyyy HH:mm:ss') : 'N/A';
  } catch {
    return 'N/A';
  }
};

const riskClass = {
  LOW: 'bg-secondary-container text-on-secondary-container',
  MEDIUM: 'bg-primary-fixed text-on-primary-fixed',
  HIGH: 'bg-[#ffe0b2] text-[#7a3e00]',
  CRITICAL: 'bg-error-container text-on-error-container ring-1 ring-error/30',
};

const Metric = ({ label, value, icon: Icon, critical }) => (
  <div className={`rounded-[24px] border bg-white/85 p-5 shadow-sm ${critical ? 'border-error/30' : 'border-outline-variant/35'}`}>
    <div className="flex items-center justify-between">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-outline">{label}</p>
      <Icon className={`h-5 w-5 ${critical ? 'text-error' : 'text-on-tertiary-container'}`} />
    </div>
    <p className="mt-4 text-3xl font-headline font-extrabold text-primary">{value || 0}</p>
  </div>
);

const BarList = ({ items, labelKey }) => {
  const max = useMemo(() => Math.max(...items.map((item) => item.count || 0), 1), [items]);
  return (
    <div className="space-y-3">
      {items.length ? items.map((item) => (
        <div key={item[labelKey] || 'UNKNOWN'}>
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-semibold">{item[labelKey] || 'UNKNOWN'}</span>
            <span>{item.count}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-surface-container">
            <div className="h-full rounded-full bg-on-tertiary-container" style={{ width: `${Math.max((item.count / max) * 100, 5)}%` }} />
          </div>
        </div>
      )) : <p className="py-6 text-center text-sm text-on-surface-variant">No monitoring data.</p>}
    </div>
  );
};

const DetailModal = ({ mode, detail, loading, saving, onClose, onUpdate }) => {
  const [status, setStatus] = useState(detail?.status || 'OPEN');
  const [adminNote, setAdminNote] = useState(detail?.adminNote || '');

  useEffect(() => {
    setStatus(detail?.status || 'OPEN');
    setAdminNote(detail?.adminNote || '');
  }, [detail]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-8">
      <div className="w-full max-w-4xl rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-outline">
              {mode === 'audit' ? 'Audit log detail' : 'Suspicious activity detail'}
            </p>
            <h2 className="mt-2 text-2xl font-headline font-extrabold text-primary">
              {detail?.action || detail?.activityType || 'Loading...'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-surface-container"><X className="h-5 w-5" /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16 text-primary"><LoaderCircle className="mr-3 animate-spin" />Loading detail...</div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-5">
              <div className="rounded-[22px] bg-surface-container-low p-5 text-sm leading-7">
                {detail?.description || 'No description provided.'}
              </div>
              <dl className="grid gap-4 sm:grid-cols-2">
                {[
                  ['User', detail?.user?.fullName || detail?.userEmail || 'Anonymous'],
                  ['Role', detail?.userRole || detail?.user?.role || 'N/A'],
                  ['IP address', detail?.ipAddress || 'N/A'],
                  ['Device', detail?.deviceInfo || 'N/A'],
                  ['Browser / agent', detail?.userAgent || 'N/A'],
                  ['Time', dateTime(detail?.createdAt || detail?.detectedAt)],
                  ['Module', detail?.module || 'SYSTEM_MONITORING'],
                  ['Risk level', detail?.riskLevel],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[20px] border border-outline-variant/30 p-4">
                    <dt className="text-xs font-bold uppercase tracking-[0.12em] text-outline">{label}</dt>
                    <dd className="mt-2 break-words text-sm font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <h3 className="font-bold text-primary">Metadata</h3>
                <pre className="mt-3 max-h-72 overflow-auto rounded-[20px] bg-[#102019] p-4 text-xs text-[#d8f5e6]">
                  {JSON.stringify(detail?.metadata || {}, null, 2)}
                </pre>
              </div>
              {mode === 'suspicious' ? (
                <div>
                  <h3 className="font-bold text-primary">Related audit logs</h3>
                  <div className="mt-3 space-y-2">
                    {detail?.relatedLogIds?.length ? detail.relatedLogIds.map((log) => (
                      <div key={log._id} className="rounded-[18px] bg-surface-container-low p-4 text-sm">
                        <strong>{log.action}</strong> - {log.description || log.module} ({dateTime(log.createdAt)})
                      </div>
                    )) : <p className="text-sm text-on-surface-variant">No related logs.</p>}
                  </div>
                </div>
              ) : null}
            </div>
            <aside className="h-fit rounded-[24px] bg-surface-container-low p-5">
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${riskClass[detail?.riskLevel]}`}>{detail?.riskLevel}</span>
              {mode === 'suspicious' ? (
                <>
                  <label className="mt-5 block space-y-2">
                    <span className="text-sm font-semibold">Investigation status</span>
                    <select value={status} onChange={(event) => setStatus(event.target.value)} className={fieldClass}>
                      {['OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="mt-4 block space-y-2">
                    <span className="text-sm font-semibold">Admin note</span>
                    <textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} className={`${fieldClass} min-h-[130px] resize-none`} />
                  </label>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      if (['RESOLVED', 'DISMISSED'].includes(status) && !adminNote.trim()) {
                        toast.error('Admin note is required');
                        return;
                      }
                      onUpdate({ status, adminNote: adminNote.trim() });
                    }}
                    className="mt-5 w-full rounded-full bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {saving ? 'Updating...' : 'Update case'}
                  </button>
                </>
              ) : (
                <p className="mt-5 text-sm text-on-surface-variant">Audit records are read-only and cannot be modified or deleted.</p>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

const SystemMonitoringPage = () => {
  const location = useLocation();
  const mode = location.pathname.includes('/suspicious') ? 'suspicious' : 'audit';
  const [overview, setOverview] = useState(null);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [auditFilters, setAuditFilters] = useState({
    page: 1, limit: 10, keyword: '', userRole: '', action: '', module: '', status: '', riskLevel: '', startDate: '', endDate: '',
  });
  const [suspiciousFilters, setSuspiciousFilters] = useState({
    page: 1, limit: 10, activityType: '', riskLevel: '', status: '', userId: '', startDate: '', endDate: '',
  });
  const filters = mode === 'audit' ? auditFilters : suspiciousFilters;
  const setFilters = mode === 'audit' ? setAuditFilters : setSuspiciousFilters;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listResponse, overviewResponse] = await Promise.all([
        mode === 'audit'
          ? systemMonitoringService.getAuditLogs(filters)
          : systemMonitoringService.getSuspiciousActivities(filters),
        systemMonitoringService.getOverview(),
      ]);
      setItems(listResponse.data || []);
      setMeta(listResponse.meta || { page: 1, totalPages: 1 });
      setOverview(overviewResponse.data);
    } catch (error) {
      toast.error(error.message || 'Unable to load system monitoring data');
    } finally {
      setLoading(false);
    }
  }, [filters, mode]);

  useEffect(() => {
    load();
  }, [load]);

  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value, page: 1 }));

  const openDetail = async (id) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const response = mode === 'audit'
        ? await systemMonitoringService.getAuditLog(id)
        : await systemMonitoringService.getSuspiciousActivity(id);
      setDetail(response.data);
    } catch (error) {
      toast.error(error.message || 'Unable to load detail');
      setSelectedId('');
    } finally {
      setDetailLoading(false);
    }
  };

  const updateCase = async (payload) => {
    setSaving(true);
    try {
      const response = await systemMonitoringService.updateSuspiciousStatus(selectedId, payload);
      setDetail(response.data);
      toast.success('Investigation status updated');
      await load();
    } catch (error) {
      toast.error(error.message || 'Unable to update case');
    } finally {
      setSaving(false);
    }
  };

  const auditMetrics = [
    ['Total Activities', overview?.totalActivities, ShieldCheck],
    ['Successful', overview?.successfulActivities, CheckCircle2],
    ['Failed', overview?.failedActivities, ShieldX],
    ['High Risk', meta.highRiskCount, AlertOctagon],
    ['Suspicious', overview?.suspiciousActivities, Siren],
  ];
  const suspiciousMetrics = [
    ['Open Cases', meta.openCount, Siren],
    ['Investigating', meta.investigatingCount, Search],
    ['Resolved', meta.resolvedCount, CheckCircle2],
    ['Critical', meta.criticalCount, AlertOctagon],
  ];

  return (
    <AdminPromotionShell
      title="System Monitoring"
      subtitle="Inspect immutable audit trails and investigate unusual account, payment, permission, and restricted-access activity."
      action={<button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white"><RefreshCcw className="h-4 w-4" />Refresh</button>}
    >
      <div className="mb-6 flex gap-2 rounded-[22px] bg-white/80 p-2">
        <Link to="/admin/system-monitoring" className={`rounded-[16px] px-4 py-2 text-sm font-bold ${mode === 'audit' ? 'bg-primary text-white' : 'text-primary'}`}>Audit Logs</Link>
        <Link to="/admin/system-monitoring/suspicious" className={`rounded-[16px] px-4 py-2 text-sm font-bold ${mode === 'suspicious' ? 'bg-primary text-white' : 'text-primary'}`}>Suspicious Activities</Link>
      </div>

      <section className="rounded-[28px] border border-outline-variant/35 bg-white/80 p-5">
        {mode === 'audit' ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="relative xl:col-span-2"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" /><input value={filters.keyword} onChange={(e) => updateFilter('keyword', e.target.value)} className={`${fieldClass} pl-11`} placeholder="Search user, action, module, IP" /></label>
            <input value={filters.userRole} onChange={(e) => updateFilter('userRole', e.target.value)} className={fieldClass} placeholder="User role" />
            <input value={filters.action} onChange={(e) => updateFilter('action', e.target.value)} className={fieldClass} placeholder="Action" />
            <input value={filters.module} onChange={(e) => updateFilter('module', e.target.value)} className={fieldClass} placeholder="Module" />
            <select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)} className={fieldClass}><option value="">All status</option><option>SUCCESS</option><option>FAILED</option></select>
            <select value={filters.riskLevel} onChange={(e) => updateFilter('riskLevel', e.target.value)} className={fieldClass}><option value="">All risk</option>{risks.map((risk) => <option key={risk}>{risk}</option>)}</select>
            <div className="grid grid-cols-2 gap-3"><input type="date" value={filters.startDate} onChange={(e) => updateFilter('startDate', e.target.value)} className={fieldClass} /><input type="date" value={filters.endDate} onChange={(e) => updateFilter('endDate', e.target.value)} className={fieldClass} /></div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <select value={filters.activityType} onChange={(e) => updateFilter('activityType', e.target.value)} className={fieldClass}><option value="">All activity types</option>{suspiciousTypes.map((type) => <option key={type}>{type}</option>)}</select>
            <select value={filters.riskLevel} onChange={(e) => updateFilter('riskLevel', e.target.value)} className={fieldClass}><option value="">All risk</option>{risks.map((risk) => <option key={risk}>{risk}</option>)}</select>
            <select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)} className={fieldClass}><option value="">All status</option>{['OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'].map((status) => <option key={status}>{status}</option>)}</select>
            <input value={filters.userId} onChange={(e) => updateFilter('userId', e.target.value)} className={fieldClass} placeholder="User ObjectId" />
            <div className="grid grid-cols-2 gap-3"><input type="date" value={filters.startDate} onChange={(e) => updateFilter('startDate', e.target.value)} className={fieldClass} /><input type="date" value={filters.endDate} onChange={(e) => updateFilter('endDate', e.target.value)} className={fieldClass} /></div>
          </div>
        )}
      </section>

      <section className={`mt-6 grid gap-4 md:grid-cols-2 ${mode === 'audit' ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
        {(mode === 'audit' ? auditMetrics : suspiciousMetrics).map(([label, value, Icon]) => <Metric key={label} label={label} value={value} icon={Icon} critical={label === 'Critical' || label === 'High Risk'} />)}
      </section>

      <section className="mt-6 overflow-hidden rounded-[28px] border border-outline-variant/35 bg-white/85">
        <div className="overflow-x-auto">
          <table className="min-w-[1150px] divide-y divide-outline-variant/30 text-left text-sm">
            <thead className="bg-surface-container-low text-xs uppercase tracking-[0.12em] text-outline">
              <tr>{(mode === 'audit'
                ? ['Time', 'User', 'Role', 'Action', 'Module', 'Description', 'IP', 'Status', 'Risk', 'Detail']
                : ['Detected', 'User', 'Activity Type', 'Description', 'Risk', 'Status', 'Detail']
              ).map((heading) => <th key={heading} className="px-4 py-4">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {loading ? <tr><td colSpan="10" className="py-12 text-center">Loading monitoring data...</td></tr> : items.length ? items.map((item) => (
                <tr key={item._id} className={item.riskLevel === 'CRITICAL' ? 'bg-error-container/20' : 'hover:bg-surface-container-low/70'}>
                  {mode === 'audit' ? (
                    <>
                      <td className="px-4 py-4">{dateTime(item.createdAt)}</td><td className="px-4 py-4">{item.user?.fullName || item.userEmail || 'Anonymous'}</td><td className="px-4 py-4">{item.userRole || item.user?.role || 'N/A'}</td><td className="px-4 py-4 font-bold">{item.action}</td><td className="px-4 py-4">{item.module}</td><td className="max-w-[260px] truncate px-4 py-4">{item.description}</td><td className="px-4 py-4">{item.ipAddress || 'N/A'}</td><td className="px-4 py-4">{item.status}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-4">{dateTime(item.detectedAt)}</td><td className="px-4 py-4">{item.user?.fullName || item.userEmail || 'Anonymous'}</td><td className="px-4 py-4 font-bold">{item.activityType}</td><td className="max-w-[360px] truncate px-4 py-4">{item.description}</td>
                    </>
                  )}
                  <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${riskClass[item.riskLevel]}`}>{item.riskLevel}</span></td>
                  {mode === 'suspicious' ? <td className="px-4 py-4">{item.status}</td> : null}
                  <td className="px-4 py-4"><button type="button" onClick={() => openDetail(item._id)} className="rounded-full p-2 text-primary hover:bg-surface-container"><Eye className="h-4 w-4" /></button></td>
                </tr>
              )) : <tr><td colSpan="10" className="py-12 text-center text-on-surface-variant">No records found.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between border-t px-5 py-4 text-sm">
          <span>Page {meta.page || 1} of {meta.totalPages || 1}</span>
          <div className="flex gap-2"><button disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))} className="rounded-full border px-4 py-2 disabled:opacity-40">Previous</button><button disabled={filters.page >= meta.totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))} className="rounded-full border px-4 py-2 disabled:opacity-40">Next</button></div>
        </div>
      </section>

      {mode === 'audit' ? (
        <section className="mt-6 grid gap-6 xl:grid-cols-3">
          {[['Activities by module', overview?.activitiesByModule || [], 'module'], ['Activities by role', overview?.activitiesByRole || [], 'role'], ['Activities by date', overview?.activitiesByDate || [], 'date']].map(([title, data, key]) => (
            <div key={title} className="rounded-[28px] border border-outline-variant/35 bg-white/85 p-5"><h2 className="font-bold text-primary">{title}</h2><div className="mt-5"><BarList items={data} labelKey={key} /></div></div>
          ))}
        </section>
      ) : null}

      {selectedId ? <DetailModal mode={mode} detail={detail} loading={detailLoading} saving={saving} onClose={() => { setSelectedId(''); setDetail(null); }} onUpdate={updateCase} /> : null}
    </AdminPromotionShell>
  );
};

export default SystemMonitoringPage;
