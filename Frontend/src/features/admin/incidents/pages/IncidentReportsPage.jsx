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

const fieldClassName =
  'w-full rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-outline/70 focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20';

const incidentTypes = [
  'ACCIDENT',
  'TRAFFIC_CONGESTION',
  'TRIP_REJECTION',
  'VEHICLE_ISSUE',
  'VEHICLE_BREAKDOWN',
  'PASSENGER_VIOLATION',
  'PASSENGER_CONFLICT',
  'LOST_ITEM',
  'FOUND_ITEM',
  'GPS_LOST_SIGNAL',
  'VEHICLE_IDLE_TOO_LONG',
  'SEVERE_DELAY',
  'OTHER',
];
const severityOptions = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const statusOptions = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];

const handlingActionOptions = [
  { value: 'TRIAGE_ONLY', label: 'Chỉ ghi nhận và theo dõi' },
  { value: 'DISPATCH_SUPPORT', label: 'Điều phối hỗ trợ hiện trường' },
  { value: 'REASSIGN_TRIP', label: 'Điều phối lại chuyến / nhân sự' },
  { value: 'SEND_MAINTENANCE', label: 'Gửi đội kỹ thuật/bảo trì' },
  { value: 'CONTACT_REPORTER', label: 'Liên hệ người báo cáo' },
  { value: 'NOTIFY_PASSENGERS', label: 'Thông báo hành khách bị ảnh hưởng' },
  { value: 'CALL_EMERGENCY_SERVICE', label: 'Liên hệ lực lượng khẩn cấp' },
  { value: 'MARK_INVALID', label: 'Đóng do báo cáo không hợp lệ' },
];

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

const incidentTypeLabel = {
  ACCIDENT: 'Tai nạn',
  TRAFFIC_CONGESTION: 'Kẹt xe',
  TRIP_REJECTION: 'Từ chối chuyến',
  VEHICLE_ISSUE: 'Lỗi xe trước chuyến',
  VEHICLE_BREAKDOWN: 'Xe hỏng trong chuyến',
  PASSENGER_VIOLATION: 'Hành khách vi phạm',
  PASSENGER_CONFLICT: 'Xung đột hành khách',
  LOST_ITEM: 'Đồ thất lạc',
  FOUND_ITEM: 'Đồ tìm thấy',
  OTHER: 'Khác',
};

const statusLabel = {
  PENDING: 'Chưa xử lý',
  IN_PROGRESS: 'Đang xử lý',
  RESOLVED: 'Đã xử lý',
  REJECTED: 'Đã đóng',
};

const incidentTableColumns = [
  { label: 'Incident ID', className: 'w-[96px]' },
  { label: 'Type', className: 'w-[150px]' },
  { label: 'Title', className: 'w-[250px]' },
  { label: 'Reporter', className: 'w-[150px]' },
  { label: 'Route', className: 'w-[220px]' },
  { label: 'Vehicle', className: 'w-[150px]' },
  { label: 'Severity', className: 'w-[112px] text-center' },
  { label: 'Status', className: 'w-[130px] text-center' },
  { label: 'Created', className: 'w-[150px]' },
  { label: 'Xử lý', className: 'w-[100px] text-center' },
];

const getStatusActionHint = (status) => ({
  PENDING: 'Báo cáo mới cần được tiếp nhận, phân loại mức ảnh hưởng và giao cho bộ phận phù hợp.',
  IN_PROGRESS: 'Báo cáo đang được xử lý. Admin cập nhật hành động điều phối và kết quả theo dõi.',
  RESOLVED: 'Báo cáo đã có kết quả xử lý cuối cùng, dùng để đối soát sau vận hành.',
  REJECTED: 'Báo cáo được đóng vì không hợp lệ hoặc không đủ căn cứ xử lý.',
}[status] || 'Cập nhật trạng thái xử lý báo cáo.');

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
  onReassignAssistant,
}) => {
  const [status, setStatus] = useState(incident?.status || 'PENDING');
  const [adminNote, setAdminNote] = useState(incident?.adminNote || '');
  const [handlingAction, setHandlingAction] = useState(incident?.handlingAction || 'TRIAGE_ONLY');
  const [resolutionSummary, setResolutionSummary] = useState(incident?.resolutionSummary || '');
  const [viewerFile, setViewerFile] = useState(null);
  const [assistantOptions, setAssistantOptions] = useState([]);
  const [replacementAssistantId, setReplacementAssistantId] = useState('');
  const [isLoadingAssistants, setIsLoadingAssistants] = useState(false);
  const isPendingIncident = incident?.status === 'PENDING';
  const isClosedIncident = ['RESOLVED', 'REJECTED'].includes(incident?.status);
  const isAssistantTripRejection = (
    incident?.incidentType === 'TRIP_REJECTION'
    && incident?.reporterRole === 'BUS_ASSISTANT'
  );
  const isWaitingReplacementAssistant = (
    isAssistantTripRejection
    && incident?.status === 'IN_PROGRESS'
    && incident?.handlingAction === 'REASSIGN_TRIP'
    && !incident?.resolutionSummary
  );

  useEffect(() => {
    setStatus(incident?.status || 'PENDING');
    setAdminNote(incident?.adminNote || '');
    setHandlingAction(incident?.handlingAction || 'TRIAGE_ONLY');
    setResolutionSummary(incident?.resolutionSummary || '');
    setReplacementAssistantId('');
  }, [incident]);

  useEffect(() => {
    if (!isAssistantTripRejection || isClosedIncident) {
      return;
    }

    let isMounted = true;
    setIsLoadingAssistants(true);
    adminService.getDrivers()
      .then((response) => {
        if (!isMounted) return;
        const assistants = (
          response?.assistantStaff
          || response?.data?.assistantStaff
          || response?.data?.data?.assistantStaff
          || []
        );
        const reporterId = String(incident?.reporterId || incident?.reporter?._id || '');
        setAssistantOptions(
          assistants.filter((assistant) => String(assistant._id || assistant.id) !== reporterId)
        );
      })
      .catch((error) => {
        if (isMounted) {
          toast.error(error.message || 'Không tải được danh sách phụ xe');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingAssistants(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [incident, isAssistantTripRejection, isClosedIncident]);

  const submitStatus = (nextStatus = status, overrides = {}) => {
    if (isWaitingReplacementAssistant && nextStatus === 'RESOLVED') {
      toast.error('Chỉ hoàn tất khi phụ xe thay thế tiếp nhận chuyến');
      return;
    }

    if (['RESOLVED', 'REJECTED'].includes(nextStatus) && !resolutionSummary.trim()) {
      toast.error('Cần nhập kết quả xử lý khi hoàn tất hoặc đóng báo cáo');
      return;
    }
    onUpdateStatus({
      status: nextStatus,
      adminNote: adminNote.trim(),
      handlingAction: overrides.handlingAction || handlingAction,
      resolutionSummary: resolutionSummary.trim(),
    });
  };

  const submitReassignAssistant = () => {
    if (!replacementAssistantId) {
      toast.error('Vui lòng chọn phụ xe thay thế');
      return;
    }

    onReassignAssistant({
      assistantId: replacementAssistantId,
      adminNote: adminNote.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-8">
      <div className="w-full max-w-4xl rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-outline">
              UC104 - Handle Incident Report
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
                  ['Handling action', handlingActionOptions.find((item) => item.value === incident?.handlingAction)?.label || 'Chưa chọn'],
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
                            Incident evidence
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setViewerFile(file)}
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-container"
                        >
                          <span className="material-symbols-outlined text-base">visibility</span>
                          Xem file
                        </button>
                      </div>
                    );
                  }) : <p className="text-sm text-on-surface-variant">No attachments.</p>}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-primary">Status history</h3>
                <div className="mt-3 space-y-3">
                  {incident?.statusHistory?.length ? [...incident.statusHistory].reverse().map((entry, index) => (
                    <div key={`${entry.changedAt}-${index}`} className="rounded-[20px] bg-surface-container-low p-4">
                      <p className="text-sm font-bold text-primary">
                        {statusLabel[entry.fromStatus] || entry.fromStatus || 'Mới'} → {statusLabel[entry.toStatus] || entry.toStatus}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {entry.changedBy?.fullName || 'Admin'} - {formatDateTime(entry.changedAt)}
                      </p>
                      {entry.adminNote ? <p className="mt-2 text-sm text-on-surface">{entry.adminNote}</p> : null}
                      {entry.handlingAction ? (
                        <p className="mt-2 text-xs text-on-surface-variant">
                          {handlingActionOptions.find((item) => item.value === entry.handlingAction)?.label || entry.handlingAction || 'Chưa chọn hành động'}
                        </p>
                      ) : null}
                      {entry.resolutionSummary ? (
                        <p className="mt-2 rounded-2xl bg-white px-3 py-2 text-sm text-on-surface">
                          {entry.resolutionSummary}
                        </p>
                      ) : null}
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
                  {statusLabel[incident?.status] || incident?.status}
                </span>
              </div>

              <div className="mt-5 rounded-[20px] border border-outline-variant/35 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-outline">
                  Quy trình xử lý
                </p>
                <h3 className="mt-2 text-lg font-headline font-extrabold text-primary">
                  Xử lý báo cáo sự cố
                </h3>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                  {getStatusActionHint(incident?.status)}
                </p>
                {isClosedIncident && (
                  <p className="mt-3 rounded-2xl bg-surface-container-low px-3 py-2 text-xs font-semibold text-on-surface-variant">
                    Báo cáo đã đóng, admin chỉ xem lại lịch sử và kết quả xử lý.
                  </p>
                )}
              </div>

              {isPendingIncident ? (
                <div className="mt-5 grid gap-2">
                  <button
                    type="button"
                    onClick={() => submitStatus('IN_PROGRESS')}
                    disabled={isSaving}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    Tiếp nhận xử lý
                  </button>
                </div>
              ) : (
                <>
                  <label className="mt-5 block space-y-2">
                    <span className="text-sm font-semibold text-on-surface">Hành động xử lý</span>
                    <select value={handlingAction} onChange={(event) => setHandlingAction(event.target.value)} disabled={isClosedIncident} className={fieldClassName}>
                      {handlingActionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>

                  {isAssistantTripRejection && !isClosedIncident ? (
                    <div className="mt-4 rounded-[20px] border border-outline-variant/40 bg-white p-4">
                      <p className="text-sm font-bold text-primary">Phân công phụ xe thay thế</p>
                      <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                        Sau khi phân công, báo cáo giữ trạng thái Đang xử lý. Khi phụ xe mới tiếp nhận chuyến, hệ thống tự chuyển báo cáo sang Đã xử lý.
                      </p>
                      <label className="mt-3 block space-y-2">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-outline">Phụ xe mới</span>
                        <select
                          value={replacementAssistantId}
                          onChange={(event) => {
                            setReplacementAssistantId(event.target.value);
                            setHandlingAction('REASSIGN_TRIP');
                          }}
                          disabled={isSaving || isLoadingAssistants}
                          className={fieldClassName}
                        >
                          <option value="">
                            {isLoadingAssistants ? 'Đang tải phụ xe...' : 'Chọn phụ xe thay thế'}
                          </option>
                          {assistantOptions.map((assistant) => (
                            <option key={assistant._id || assistant.id} value={assistant._id || assistant.id}>
                              {assistant.fullName || assistant.email || 'Phụ xe'}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={submitReassignAssistant}
                        disabled={isSaving || isLoadingAssistants || !replacementAssistantId}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                      >
                        {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                        Phân công phụ xe mới
                      </button>
                    </div>
                  ) : null}

                  <label className="mt-4 block space-y-2">
                    <span className="text-sm font-semibold text-on-surface">Ghi chú tiếp nhận / điều phối</span>
                    <textarea
                      value={adminNote}
                      onChange={(event) => setAdminNote(event.target.value)}
                      disabled={isClosedIncident}
                      className={`${fieldClassName} min-h-[96px] resize-none`}
                      placeholder="Ví dụ: đã gọi tài xế xác minh, yêu cầu phụ xe hỗ trợ hành khách, điều phối kỹ thuật kiểm tra..."
                    />
                  </label>

                  <label className="mt-4 block space-y-2">
                    <span className="text-sm font-semibold text-on-surface">Kết quả xử lý</span>
                    <textarea
                      value={resolutionSummary}
                      onChange={(event) => setResolutionSummary(event.target.value)}
                      disabled={isClosedIncident || isWaitingReplacementAssistant}
                      className={`${fieldClassName} min-h-[110px] resize-none`}
                      placeholder="Bắt buộc khi hoàn tất báo cáo. Ghi rõ kết quả, hành động đã thực hiện và tình trạng cuối."
                    />
                    {isWaitingReplacementAssistant ? (
                      <span className="block text-xs leading-5 text-on-surface-variant">
                        Kết quả xử lý sẽ được hệ thống tự ghi khi phụ xe thay thế tiếp nhận chuyến.
                      </span>
                    ) : null}
                  </label>

                  <div className="mt-5 grid gap-2">
                    {incident?.status === 'IN_PROGRESS' && (
                      <button
                        type="button"
                        onClick={() => submitStatus('IN_PROGRESS')}
                        disabled={isSaving || isClosedIncident}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-outline-variant/50 px-5 py-3 text-sm font-bold text-primary hover:bg-white disabled:opacity-60"
                      >
                        Cập nhật tiến độ xử lý
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() => submitStatus(handlingAction === 'MARK_INVALID' ? 'REJECTED' : 'RESOLVED')}
                    disabled={isSaving || isClosedIncident || isWaitingReplacementAssistant}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-green-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    Hoàn tất xử lý
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHandlingAction('MARK_INVALID');
                      submitStatus('REJECTED', { handlingAction: 'MARK_INVALID' });
                    }}
                    disabled={isSaving || isClosedIncident}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-error/40 px-5 py-3 text-sm font-bold text-error hover:bg-error-container disabled:opacity-60"
                  >
                    Từ chối báo cáo
                  </button>
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
          title="Xem trước minh chứng sự cố"
          onClose={() => setViewerFile(null)}
        />
      )}
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

  const reassignAssistant = async (payload) => {
    setIsSaving(true);
    try {
      const response = await incidentReportService.reassignAssistant(selectedId, payload);
      setDetail(response.data);
      toast.success('Đã phân công phụ xe thay thế. Chờ phụ xe mới tiếp nhận chuyến.');
      await loadData();
    } catch (error) {
      toast.error(error.message || 'Không thể phân công phụ xe thay thế');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminPromotionShell
      title="Handle Incident Reports"
      subtitle="UC104 - Tiếp nhận, điều phối hỗ trợ, cập nhật kết quả xử lý và lưu lịch sử xử lý các báo cáo sự cố vận hành."
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
            {incidentTypes.map((option) => <option key={option} value={option}>{incidentTypeLabel[option] || option}</option>)}
          </select>
          <select value={filters.severity} onChange={(event) => updateFilter('severity', event.target.value)} className={fieldClassName}>
            <option value="">All severity</option>
            {severityOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className={fieldClassName}>
            <option value="">All status</option>
            {statusOptions.map((option) => <option key={option} value={option}>{statusLabel[option] || option}</option>)}
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
          <table className="min-w-[1508px] table-fixed divide-y divide-outline-variant/30 text-left text-sm">
            <thead className="bg-surface-container-low text-xs uppercase tracking-[0.12em] text-outline">
              <tr>
                {incidentTableColumns.map((column) => (
                  <th key={column.label} className={`px-4 py-4 ${column.className}`}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {isLoading ? (
                <tr><td colSpan="10" className="px-5 py-12 text-center text-on-surface-variant">Loading incident reports...</td></tr>
              ) : incidents.length ? incidents.map((incident) => (
                <tr key={incident._id} className={incident.severity === 'CRITICAL' ? 'bg-error-container/20' : 'hover:bg-surface-container-low/70'}>
                  <td className="w-[96px] px-4 py-4 font-mono text-xs text-primary">{incident._id.slice(-8)}</td>
                  <td className="w-[150px] px-4 py-4 font-semibold">
                    <span className="line-clamp-2">{incidentTypeLabel[incident.incidentType] || incident.incidentType}</span>
                  </td>
                  <td className="w-[250px] px-4 py-4">
                    <p className="truncate font-bold text-primary">{incident.title}</p>
                    <p className="mt-1 truncate text-xs text-on-surface-variant">{incident.location || 'Location not provided'}</p>
                  </td>
                  <td className="w-[150px] px-4 py-4">
                    <p className="truncate">{incident.reporter?.fullName || 'Unknown'}</p>
                  </td>
                  <td className="w-[220px] px-4 py-4">
                    <p className="truncate font-semibold text-on-surface">
                      {incident.route?.name || incident.routeId || 'N/A'}
                    </p>
                    {incident.route?.routeNumber ? (
                      <p className="mt-1 text-xs text-on-surface-variant">{incident.route.routeNumber}</p>
                    ) : null}
                  </td>
                  <td className="w-[150px] px-4 py-4">
                    <p className="truncate font-semibold text-on-surface">
                      {incident.vehicle?.label || incident.vehicleId || 'N/A'}
                    </p>
                    {incident.vehicle?.status ? (
                      <p className="mt-1 text-xs text-on-surface-variant">{incident.vehicle.status}</p>
                    ) : null}
                  </td>
                  <td className="w-[112px] px-4 py-4 text-center"><span className={`inline-flex justify-center rounded-full px-3 py-1 text-xs font-bold ${severityClassName[incident.severity]}`}>{incident.severity}</span></td>
                  <td className="w-[130px] px-4 py-4 text-center"><span className={`inline-flex justify-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${statusClassName[incident.status]}`}>{statusLabel[incident.status] || incident.status}</span></td>
                  <td className="w-[150px] px-4 py-4">{formatDateTime(incident.createdAt)}</td>
                  <td className="w-[100px] px-4 py-4 text-center">
                    <button type="button" title="Xem và xử lý báo cáo" onClick={() => openDetail(incident._id)} className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary-container">
                      <Eye className="h-4 w-4" />
                      Xử lý
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
          onReassignAssistant={reassignAssistant}
        />
      ) : null}
    </AdminPromotionShell>
  );
};

export default IncidentReportsPage;
