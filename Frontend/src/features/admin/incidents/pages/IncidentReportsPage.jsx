import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
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
import incidentReportService from '../services/incidentReportService.js';

const fieldClassName =
  'w-full rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-outline/70 focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20';

const incidentTypes = [
  'ACCIDENT',
  'TRAFFIC_CONGESTION',
  'VEHICLE_BREAKDOWN',
  'PASSENGER_VIOLATION',
  'PASSENGER_CONFLICT',
  'LOST_ITEM',
  'FOUND_ITEM',
  'OTHER',
];
const severityOptions = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const statusOptions = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];

const defaultFilters = {
  page: 1,
  limit: 10,
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
  const max = useMemo(
    () => Math.max(...items.map((item) => Number(item[valueKey] || 0)), 1),
    [items, valueKey]
  );

  if (!items.length) {
    return <p className="py-8 text-center text-sm text-on-surface-variant">No statistics available.</p>;
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const value = Number(item[valueKey] || 0);
        return (
          <div key={`${item[labelKey]}-${value}`} className="space-y-2">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-semibold text-on-surface">{item[labelKey] || 'Unassigned'}</span>
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
}) => {
  const [status, setStatus] = useState(incident?.status || 'PENDING');
  const [adminNote, setAdminNote] = useState(incident?.adminNote || '');

  useEffect(() => {
    setStatus(incident?.status || 'PENDING');
    setAdminNote(incident?.adminNote || '');
  }, [incident]);

  const submitStatus = () => {
    if (['RESOLVED', 'REJECTED'].includes(status) && !adminNote.trim()) {
      toast.error('Admin note is required for resolved or rejected incidents');
      return;
    }
    onUpdateStatus({ status, adminNote: adminNote.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-8">
      <div className="w-full max-w-4xl rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-outline">
              Incident detail
            </p>
            <h2 className="mt-2 text-2xl font-headline font-extrabold text-primary">
              {incident?.title || 'Loading incident...'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-surface-container">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-primary">
            <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
            Loading incident details...
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-5">
              <div className="rounded-[22px] bg-surface-container-low p-5">
                <p className="text-sm leading-7 text-on-surface">{incident?.description}</p>
              </div>

              <dl className="grid gap-4 sm:grid-cols-2">
                {[
                  ['Reporter', incident?.reporter?.fullName || 'Unknown'],
                  ['Reporter role', incident?.reporterRole || incident?.reporter?.role || 'N/A'],
                  ['Route', incident?.route?.name || incident?.routeId || 'N/A'],
                  ['Trip', incident?.trip?._id || incident?.tripId || 'N/A'],
                  ['Vehicle', incident?.vehicle?.label || incident?.vehicleId || 'N/A'],
                  ['Location', incident?.location || 'N/A'],
                  ['Coordinates', incident?.latitude != null ? `${incident.latitude}, ${incident.longitude}` : 'N/A'],
                  ['Created', formatDateTime(incident?.createdAt)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[20px] border border-outline-variant/30 p-4">
                    <dt className="text-xs font-bold uppercase tracking-[0.14em] text-outline">{label}</dt>
                    <dd className="mt-2 break-words text-sm font-semibold text-on-surface">{value}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <h3 className="text-lg font-bold text-primary">Attachments</h3>
                <div className="mt-3 flex flex-wrap gap-3">
                  {incident?.attachments?.length ? incident.attachments.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-outline-variant/60 px-4 py-2 text-sm font-bold text-primary hover:bg-surface-container-low"
                    >
                      Open attachment
                    </a>
                  )) : <p className="text-sm text-on-surface-variant">No attachments.</p>}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-primary">Status history</h3>
                <div className="mt-3 space-y-3">
                  {incident?.statusHistory?.length ? [...incident.statusHistory].reverse().map((entry, index) => (
                    <div key={`${entry.changedAt}-${index}`} className="rounded-[20px] bg-surface-container-low p-4">
                      <p className="text-sm font-bold text-primary">
                        {entry.fromStatus || 'NEW'} to {entry.toStatus}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {entry.changedBy?.fullName || 'Admin'} - {formatDateTime(entry.changedAt)}
                      </p>
                      {entry.adminNote ? <p className="mt-2 text-sm text-on-surface">{entry.adminNote}</p> : null}
                    </div>
                  )) : <p className="text-sm text-on-surface-variant">No status changes recorded.</p>}
                </div>
              </div>
            </div>

            <aside className="h-fit rounded-[24px] border border-outline-variant/35 bg-surface-container-low p-5">
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${severityClassName[incident?.severity]}`}>
                  {incident?.severity}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClassName[incident?.status]}`}>
                  {incident?.status}
                </span>
              </div>

              <label className="mt-5 block space-y-2">
                <span className="text-sm font-semibold text-on-surface">Update status</span>
                <select value={status} onChange={(event) => setStatus(event.target.value)} className={fieldClassName}>
                  {statusOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              <label className="mt-4 block space-y-2">
                <span className="text-sm font-semibold text-on-surface">Admin note</span>
                <textarea
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                  className={`${fieldClassName} min-h-[130px] resize-none`}
                  placeholder="Investigation notes and follow-up actions"
                />
              </label>
              <button
                type="button"
                onClick={submitStatus}
                disabled={isSaving}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {isSaving ? 'Updating...' : 'Update status'}
              </button>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

const IncidentReportsPage = () => {
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
        incidentReportService.getOverviewStatistics(),
      ]);
      setIncidents(listResponse.data || []);
      setMeta((current) => ({ ...current, ...(listResponse.meta || {}) }));
      setStatistics(statisticsResponse.data);
    } catch (error) {
      toast.error(error.message || 'Unable to load incident reports');
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
      toast.error(error.message || 'Unable to load incident detail');
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
      toast.success('Incident status updated');
      await loadData();
    } catch (error) {
      toast.error(error.message || 'Unable to update incident status');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminPromotionShell
      title="Incident Reports"
      subtitle="Review operational incidents, investigation context, evidence, and follow-up status across the BusDN network."
      action={(
        <button type="button" onClick={loadData} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white">
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      )}
    >
      <section className="rounded-[28px] border border-outline-variant/35 bg-white/80 p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
            <input value={filters.keyword} onChange={(event) => updateFilter('keyword', event.target.value)} className={`${fieldClassName} pl-11`} placeholder="Search title, description, location" />
          </label>
          <select value={filters.incidentType} onChange={(event) => updateFilter('incidentType', event.target.value)} className={fieldClassName}>
            <option value="">All incident types</option>
            {incidentTypes.map((option) => <option key={option}>{option}</option>)}
          </select>
          <select value={filters.severity} onChange={(event) => updateFilter('severity', event.target.value)} className={fieldClassName}>
            <option value="">All severity</option>
            {severityOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className={fieldClassName}>
            <option value="">All status</option>
            {statusOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
          <input value={filters.routeId} onChange={(event) => updateFilter('routeId', event.target.value)} className={fieldClassName} placeholder="Route ObjectId" />
          <input value={filters.vehicleId} onChange={(event) => updateFilter('vehicleId', event.target.value)} className={fieldClassName} placeholder="Vehicle ObjectId" />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={filters.startDate} onChange={(event) => updateFilter('startDate', event.target.value)} className={fieldClassName} />
            <input type="date" value={filters.endDate} onChange={(event) => updateFilter('endDate', event.target.value)} className={fieldClassName} />
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total Incidents" value={meta.totalIncidents} detail="All recorded reports" icon={ShieldAlert} />
        <MetricCard label="Pending" value={meta.pendingCount} detail="Awaiting admin review" icon={Clock3} />
        <MetricCard label="In Progress" value={meta.inProgressCount} detail="Currently investigated" icon={TimerReset} />
        <MetricCard label="Resolved" value={meta.resolvedCount} detail="Investigation completed" icon={CheckCircle2} />
        <MetricCard label="Critical" value={meta.criticalCount} detail="Requires immediate attention" icon={AlertTriangle} critical />
      </section>

      <section className="mt-6 overflow-hidden rounded-[28px] border border-outline-variant/35 bg-white/85 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] divide-y divide-outline-variant/30 text-left text-sm">
            <thead className="bg-surface-container-low text-xs uppercase tracking-[0.12em] text-outline">
              <tr>
                {['Incident ID', 'Type', 'Title', 'Reporter', 'Route', 'Vehicle', 'Severity', 'Status', 'Created', 'Action'].map((heading) => (
                  <th key={heading} className="px-4 py-4">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {isLoading ? (
                <tr><td colSpan="10" className="px-5 py-12 text-center text-on-surface-variant">Loading incident reports...</td></tr>
              ) : incidents.length ? incidents.map((incident) => (
                <tr key={incident._id} className={incident.severity === 'CRITICAL' ? 'bg-error-container/20' : 'hover:bg-surface-container-low/70'}>
                  <td className="px-4 py-4 font-mono text-xs text-primary">{incident._id.slice(-8)}</td>
                  <td className="px-4 py-4 font-semibold">{incident.incidentType}</td>
                  <td className="max-w-[260px] px-4 py-4">
                    <p className="truncate font-bold text-primary">{incident.title}</p>
                    <p className="mt-1 truncate text-xs text-on-surface-variant">{incident.location || 'Location not provided'}</p>
                  </td>
                  <td className="px-4 py-4">{incident.reporter?.fullName || 'Unknown'}</td>
                  <td className="px-4 py-4">{incident.routeId || 'N/A'}</td>
                  <td className="px-4 py-4">{incident.vehicleId || 'N/A'}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${severityClassName[incident.severity]}`}>{incident.severity}</span></td>
                  <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClassName[incident.status]}`}>{incident.status}</span></td>
                  <td className="px-4 py-4">{formatDateTime(incident.createdAt)}</td>
                  <td className="px-4 py-4">
                    <button type="button" title="View incident detail" onClick={() => openDetail(incident._id)} className="rounded-full p-2 text-primary hover:bg-surface-container">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="10" className="px-5 py-12 text-center text-on-surface-variant">No incident reports found.</td></tr>
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

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        {[
          ['Incidents by type', statistics?.incidentsByType || [], 'incidentType'],
          ['Incidents by severity', statistics?.incidentsBySeverity || [], 'severity'],
          ['Incident trend over time', statistics?.incidentTrendByDate || [], 'date'],
        ].map(([title, items, labelKey]) => (
          <div key={title} className="rounded-[28px] border border-outline-variant/35 bg-white/85 p-5 shadow-sm">
            <h2 className="text-lg font-bold text-primary">{title}</h2>
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
        />
      ) : null}
    </AdminPromotionShell>
  );
};

export default IncidentReportsPage;
