import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import toast from '../../../../shared/utils/toast.js';
import {
  AlertOctagon,
  CheckCircle2,
  Eye,
  CalendarDays,
  Filter,
  LoaderCircle,
  Layers3,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShieldX,
  Siren,
  UsersRound,
  X,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import AdminPromotionShell from '../../promotions/components/AdminPromotionShell.jsx';
import systemMonitoringService from '../services/systemMonitoringService.js';
import { useAdminI18n } from '../../../../shared/i18n/adminI18n.js';

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

const statusClass = {
  SUCCESS: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  FAILED: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  OPEN: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  INVESTIGATING: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  DISMISSED: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
};

const humanize = (value) => String(value || 'N/A')
  .toLowerCase()
  .replaceAll('_', ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase());

const FilterField = ({ label, children, className = '' }) => (
  <label className={`block min-w-0 ${className}`}>
    <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-on-surface-variant">{label}</span>
    {children}
  </label>
);

const Metric = ({ label, value, icon: Icon, critical }) => (
  <div className={`group rounded-[22px] border bg-white p-5 shadow-[0_10px_30px_rgba(0,47,27,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(0,47,27,0.09)] ${critical ? 'border-error/30' : 'border-outline-variant/35'}`}>
    <div className="flex items-center justify-between">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-outline">{label}</p>
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${critical ? 'bg-error-container text-error' : 'bg-primary-fixed text-on-tertiary-container'}`}><Icon className="h-5 w-5" /></span>
    </div>
    <p className="mt-3 text-3xl font-headline font-extrabold text-primary">{value ?? 0}</p>
  </div>
);

const BarList = ({ items, labelKey }) => {
  const max = useMemo(() => Math.max(...items.map((item) => item.count || 0), 1), [items]);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-color:#86cbb0_transparent] [scrollbar-width:thin]">
      <div className="space-y-2.5">
      {items.length ? items.map((item, index) => (
        <div key={item[labelKey] || 'UNKNOWN'} className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/55 px-3.5 py-3 transition hover:border-on-tertiary-container/25 hover:bg-primary-fixed/35">
          <div className="mb-2.5 flex min-w-0 items-center gap-2 text-sm">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white text-[10px] font-black text-on-surface-variant shadow-sm">{index + 1}</span>
            <span className="min-w-0 flex-1 truncate font-bold text-primary" title={humanize(item[labelKey] || 'UNKNOWN')}>{humanize(item[labelKey] || 'UNKNOWN')}</span>
            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-black text-on-tertiary-container shadow-sm">{Number(item.count || 0).toLocaleString('vi-VN')}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-outline-variant/20">
            <div className="h-full rounded-full bg-gradient-to-r from-on-tertiary-container to-emerald-400 transition-[width] duration-500" style={{ width: `${Math.max((item.count / max) * 100, 3)}%` }} />
          </div>
        </div>
      )) : <p className="py-6 text-center text-sm text-on-surface-variant">No monitoring data.</p>}
      </div>
    </div>
  );
};

const DetailModal = ({ mode, detail, loading, saving, onClose, onUpdate }) => {
  const { tp } = useAdminI18n();
  const [status, setStatus] = useState(detail?.status || 'OPEN');
  const [adminNote, setAdminNote] = useState(detail?.adminNote || '');
  const [lockDuration, setLockDuration] = useState('NONE');

  useEffect(() => {
    setStatus(detail?.status || 'OPEN');
    setAdminNote(detail?.adminNote || '');
    setLockDuration('NONE');
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
              {mode === 'suspicious' ? (
                <>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold">{tp('Account action')}</span>
                    <select value={lockDuration} onChange={(event) => setLockDuration(event.target.value)} className={fieldClass} disabled={!detail?.canLockAccount}>
                      <option value="NONE">{tp('Do not lock account')}</option>
                      <option value="2_HOURS">{tp('Lock for 2 hours')}</option>
                      <option value="5_HOURS">{tp('Lock for 5 hours')}</option>
                      <option value="10_HOURS">{tp('Lock for 10 hours')}</option>
                      <option value="PERMANENT">{tp('Lock permanently')}</option>
                    </select>
                    {!detail?.canLockAccount ? <span className="text-xs text-amber-700">{tp('No user account is associated with this activity.')}</span> : null}
                    {lockDuration !== 'NONE' ? <span className="text-xs font-semibold text-rose-700">{tp('The user will be signed out and unable to sign in during the selected period.')}</span> : null}
                  </label>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      if (['RESOLVED', 'DISMISSED'].includes(status) && !adminNote.trim()) {
                        toast.error('Admin note is required');
                        return;
                      }
                      onUpdate({ status, adminNote: adminNote.trim(), lockDuration });
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
  const activeFilterCount = Object.entries(filters)
    .filter(([key, value]) => !['page', 'limit'].includes(key) && value !== '')
    .length;

  const clearFilters = () => {
    if (mode === 'audit') {
      setAuditFilters({
        page: 1, limit: 10, keyword: '', userRole: '', action: '', module: '', status: '', riskLevel: '', startDate: '', endDate: '',
      });
    } else {
      setSuspiciousFilters({
        page: 1, limit: 10, activityType: '', riskLevel: '', status: '', userId: '', startDate: '', endDate: '',
      });
    }
  };

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
      <div className="mb-6 grid gap-2 rounded-[22px] border border-outline-variant/30 bg-white p-2 shadow-sm sm:inline-grid sm:grid-cols-2">
        <Link to="/admin/system-monitoring" className={`flex items-center justify-center gap-2 rounded-[16px] px-5 py-3 text-sm font-bold transition ${mode === 'audit' ? 'bg-primary text-white shadow-md' : 'text-primary hover:bg-surface-container-low'}`}><ShieldCheck className="h-4 w-4" />Audit Logs</Link>
        <Link to="/admin/system-monitoring/suspicious" className={`flex items-center justify-center gap-2 rounded-[16px] px-5 py-3 text-sm font-bold transition ${mode === 'suspicious' ? 'bg-primary text-white shadow-md' : 'text-primary hover:bg-surface-container-low'}`}><Siren className="h-4 w-4" />Suspicious Activities</Link>
      </div>

      <section className={`grid gap-4 md:grid-cols-2 ${mode === 'audit' ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
        {(mode === 'audit' ? auditMetrics : suspiciousMetrics).map(([label, value, Icon]) => <Metric key={label} label={label} value={value} icon={Icon} critical={label === 'Critical' || label === 'High Risk'} />)}
      </section>

      <section className="mt-6 rounded-[24px] border border-outline-variant/35 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 border-b border-outline-variant/25 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-fixed text-on-tertiary-container"><Filter className="h-5 w-5" /></span>
            <div><h2 className="font-headline text-base font-extrabold text-primary">Filters</h2><p className="text-xs text-on-surface-variant">Narrow records by keyword, status, risk, and date.</p></div>
          </div>
          <button type="button" onClick={clearFilters} disabled={!activeFilterCount} className="rounded-full border border-outline-variant/50 px-4 py-2 text-xs font-bold text-primary hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-40">Clear filters{activeFilterCount ? ` (${activeFilterCount})` : ''}</button>
        </div>
        {mode === 'audit' ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12 xl:items-end">
            <FilterField label="Search" className="xl:col-span-4"><div className="relative"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" /><input value={filters.keyword} onChange={(e) => updateFilter('keyword', e.target.value)} className={`${fieldClass} pl-11`} placeholder="User, action, module, or IP" /></div></FilterField>
            <FilterField label="Status" className="xl:col-span-2"><select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)} className={fieldClass}><option value="">All statuses</option><option>SUCCESS</option><option>FAILED</option></select></FilterField>
            <FilterField label="Risk level" className="xl:col-span-2"><select value={filters.riskLevel} onChange={(e) => updateFilter('riskLevel', e.target.value)} className={fieldClass}><option value="">All risk levels</option>{risks.map((risk) => <option key={risk}>{risk}</option>)}</select></FilterField>
            <FilterField label="Start date" className="xl:col-span-2"><div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" /><input type="date" value={filters.startDate} onChange={(e) => updateFilter('startDate', e.target.value)} className={`${fieldClass} pl-9`} /></div></FilterField>
            <FilterField label="End date" className="xl:col-span-2"><div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" /><input type="date" value={filters.endDate} onChange={(e) => updateFilter('endDate', e.target.value)} className={`${fieldClass} pl-9`} /></div></FilterField>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <FilterField label="Activity type"><select value={filters.activityType} onChange={(e) => updateFilter('activityType', e.target.value)} className={fieldClass}><option value="">All activity types</option>{suspiciousTypes.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}</select></FilterField>
            <FilterField label="Risk level"><select value={filters.riskLevel} onChange={(e) => updateFilter('riskLevel', e.target.value)} className={fieldClass}><option value="">All risk levels</option>{risks.map((risk) => <option key={risk}>{risk}</option>)}</select></FilterField>
            <FilterField label="Status"><select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)} className={fieldClass}><option value="">All statuses</option>{['OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'].map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select></FilterField>
            <FilterField label="User ID"><input value={filters.userId} onChange={(e) => updateFilter('userId', e.target.value)} className={fieldClass} placeholder="MongoDB ObjectId" /></FilterField>
            <FilterField label="Date range"><div className="grid grid-cols-2 gap-2"><input aria-label="Start date" type="date" value={filters.startDate} onChange={(e) => updateFilter('startDate', e.target.value)} className={fieldClass} /><input aria-label="End date" type="date" value={filters.endDate} onChange={(e) => updateFilter('endDate', e.target.value)} className={fieldClass} /></div></FilterField>
          </div>
        )}
      </section>

      <section className="mt-6 overflow-hidden rounded-[28px] border border-outline-variant/35 bg-white/85">
        <div className="flex flex-col gap-2 border-b border-outline-variant/25 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-headline text-lg font-extrabold text-primary">{mode === 'audit' ? 'Audit activity' : 'Suspicious activity cases'}</h2><p className="mt-1 text-xs text-on-surface-variant">{meta.total ?? items.length} records found</p></div>
          <span className="w-fit rounded-full bg-surface-container-low px-3 py-1.5 text-xs font-bold text-on-surface-variant">Page {meta.page || 1} / {meta.totalPages || 1}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] table-fixed divide-y divide-outline-variant/30 text-left text-sm">
            <colgroup>
              {(mode === 'audit'
                ? ['10%', '13%', '8%', '14%', '10%', '19%', '8%', '7%', '7%', '4%']
                : ['13%', '17%', '18%', '27%', '9%', '11%', '5%']
              ).map((width, index) => <col key={`${mode}-${index}`} style={{ width }} />)}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-surface-container-low text-xs uppercase tracking-[0.12em] text-outline">
              <tr>{(mode === 'audit'
                ? ['Time', 'User', 'Role', 'Action', 'Module', 'Description', 'IP', 'Status', 'Risk', 'Detail']
                : ['Detected', 'User', 'Activity Type', 'Description', 'Risk', 'Status', 'Detail']
              ).map((heading) => <th key={heading} className="px-4 py-4">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {loading ? <tr><td colSpan="10" className="py-12 text-center">Loading monitoring data...</td></tr> : items.length ? items.map((item) => (
                <tr key={item._id} className={`transition-colors ${item.riskLevel === 'CRITICAL' ? 'bg-error-container/20' : 'odd:bg-white even:bg-surface-container-low/25 hover:bg-primary-fixed/40'}`}>
                  {mode === 'audit' ? (
                    <>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-on-surface-variant">{dateTime(item.createdAt)}</td><td className="truncate px-4 py-4 font-semibold" title={item.user?.fullName || item.userEmail}>{item.user?.fullName || item.userEmail || 'Anonymous'}</td><td className="truncate px-4 py-4" title={humanize(item.userRole || item.user?.role)}>{humanize(item.userRole || item.user?.role)}</td><td className="truncate px-4 py-4 font-bold text-primary" title={humanize(item.action)}>{humanize(item.action)}</td><td className="truncate px-4 py-4" title={humanize(item.module)}>{humanize(item.module)}</td><td title={item.description} className="truncate px-4 py-4 text-on-surface-variant">{item.description}</td><td className="truncate px-4 py-4 font-mono text-xs" title={item.ipAddress || 'N/A'}>{item.ipAddress || 'N/A'}</td><td className="px-4 py-4"><span className={`inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-xs font-bold ${statusClass[item.status] || 'bg-slate-100 text-slate-600'}`}>{humanize(item.status)}</span></td>
                    </>
                  ) : (
                    <>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-on-surface-variant">{dateTime(item.detectedAt)}</td><td className="truncate px-4 py-4 font-semibold" title={item.user?.fullName || item.userEmail}>{item.user?.fullName || item.userEmail || 'Anonymous'}</td><td className="truncate px-4 py-4 font-bold text-primary" title={humanize(item.activityType)}>{humanize(item.activityType)}</td><td title={item.description} className="truncate px-4 py-4 text-on-surface-variant">{item.description}</td>
                    </>
                  )}
                  <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${riskClass[item.riskLevel]}`}>{item.riskLevel}</span></td>
                  {mode === 'suspicious' ? <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass[item.status] || 'bg-slate-100 text-slate-600'}`}>{humanize(item.status)}</span></td> : null}
                  <td className="px-4 py-4"><button type="button" aria-label="View detail" title="View detail" onClick={() => openDetail(item._id)} className="rounded-full border border-outline-variant/40 p-2 text-primary hover:bg-primary-fixed"><Eye className="h-4 w-4" /></button></td>
                </tr>
              )) : <tr><td colSpan="10" className="py-12 text-center text-on-surface-variant">No records found.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>Page {meta.page || 1} of {meta.totalPages || 1}</span>
          <div className="flex gap-2"><button disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))} className="rounded-full border px-4 py-2 disabled:opacity-40">Previous</button><button disabled={filters.page >= meta.totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))} className="rounded-full border px-4 py-2 disabled:opacity-40">Next</button></div>
        </div>
      </section>

      {mode === 'audit' ? (
        <section className="mt-6 grid items-start gap-5 xl:grid-cols-3">
          {[
            ['Activities by module', 'Distribution across system features', overview?.activitiesByModule || [], 'module', Layers3],
            ['Activities by role', 'Users generating audit events', overview?.activitiesByRole || [], 'role', UsersRound],
            ['Activities by date', 'Daily activity volume', overview?.activitiesByDate || [], 'date', CalendarDays],
          ].map(([title, subtitle, data, key, Icon]) => (
            <div key={title} className="flex h-[470px] min-w-0 flex-col overflow-hidden rounded-[26px] border border-outline-variant/35 bg-white p-5 shadow-[0_12px_34px_rgba(0,47,27,0.05)]">
              <div className="mb-4 flex items-start gap-3 border-b border-outline-variant/25 pb-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-fixed text-on-tertiary-container"><Icon className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="truncate font-headline text-base font-extrabold text-primary">{title}</h2>
                    <span className="shrink-0 rounded-full bg-surface-container-low px-2.5 py-1 text-[11px] font-bold text-on-surface-variant">{data.length} groups</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-on-surface-variant">{subtitle}</p>
                </div>
              </div>
              <BarList items={data} labelKey={key} />
            </div>
          ))}
        </section>
      ) : null}

      {selectedId ? <DetailModal mode={mode} detail={detail} loading={detailLoading} saving={saving} onClose={() => { setSelectedId(''); setDetail(null); }} onUpdate={updateCase} /> : null}
    </AdminPromotionShell>
  );
};

export default SystemMonitoringPage;
