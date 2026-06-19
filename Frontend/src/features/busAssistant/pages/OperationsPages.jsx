import React, { useCallback, useEffect, useState } from 'react';
import {
  BellRing,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  RefreshCw,
  Route,
  XCircle,
} from 'lucide-react';
import useTheme from '../../../shared/hooks/useTheme.js';
import scheduleOperationsService from '../../scheduleOperations/services/scheduleOperationsService.js';

const toInputDate = (date) => date.toISOString().slice(0, 10);

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
  || 'Không thể tải dữ liệu. Vui lòng thử lại.'
);

const formatDate = (value) => {
  if (!value) return 'Chưa có';
  return new Date(value).toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatTime = (value) => {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusLabels = {
  PENDING: 'Chờ tiếp nhận',
  ASSIGNED: 'Đã phân công',
  ACCEPTED: 'Đã tiếp nhận',
  REJECTED: 'Đã từ chối',
  READY: 'Xe sẵn sàng',
  SCHEDULED: 'Đã lên lịch',
  IN_PROGRESS: 'Đang vận hành',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
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

const getTripTitle = (assignment) => {
  const route = assignment.route || {};
  return `${route.origin || 'Điểm đầu'} → ${route.destination || route.name || 'Điểm cuối'}`;
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
              Làm mới
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

const TripCard = ({ assignment, onAccept, onReject, isProcessing }) => {
  const { isDarkMode } = useTheme();
  const mutedText = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const status = assignment.acceptanceStatus || assignment.shiftStatus || assignment.tripStatus;
  const canDecide = ['PENDING', 'ASSIGNED'].includes(assignment.acceptanceStatus || assignment.shiftStatus);

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
          <p className={`mt-1 text-sm ${mutedText}`}>{assignment.route?.name || 'Chưa có tên tuyến'}</p>
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
        <InfoBox label="Ngày vận hành" value={formatDate(assignment.scheduledStart)} icon={CalendarDays} />
        <InfoBox label="Thời gian" value={`${formatTime(assignment.scheduledStart)} - ${formatTime(assignment.scheduledEnd)}`} icon={Clock3} />
        <InfoBox label="Phương tiện" value={assignment.vehicle?.plateNumber || assignment.vehicle?.code || 'Chưa có'} icon={Route} />
        <InfoBox label="Vai trò" value="Phụ xe" icon={CheckCircle2} />
      </div>

      <div className={isDarkMode ? 'mt-4 rounded bg-white/5 p-3 text-sm' : 'mt-4 rounded bg-slate-50 p-3 text-sm'}>
        <p><span className={mutedText}>Tài xế:</span> <strong>{assignment.driver?.fullName || 'Chưa phân công'}</strong></p>
        <p className="mt-1"><span className={mutedText}>Ghi chú:</span> {assignment.notes || 'Không có ghi chú.'}</p>
      </div>

      {canDecide ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => onReject(assignment.id)}
            disabled={isProcessing}
            className="inline-flex items-center justify-center gap-2 rounded border border-rose-300 px-4 py-2 text-sm font-black text-rose-600 disabled:opacity-50"
          >
            <XCircle size={16} />
            Từ chối chuyến
          </button>
          <button
            type="button"
            onClick={() => onAccept(assignment.id)}
            disabled={isProcessing}
            className="inline-flex items-center justify-center gap-2 rounded bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50"
          >
            <CheckCircle2 size={16} />
            Tiếp nhận chuyến
          </button>
        </div>
      ) : null}
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

export const AssignedTripsPage = () => {
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
    const reason = window.prompt('Nhập lý do từ chối chuyến được phân công:');
    if (!reason?.trim()) return;
    runDecision(
      assignmentId,
      () => scheduleOperationsService.rejectAssignedTrip(assignmentId, { reason: reason.trim() }),
      'Đã gửi từ chối chuyến về điều hành.'
    );
  };

  return (
    <PageShell
      title="Chuyến được phân công"
      subtitle="Xem các chuyến mà điều hành đã phân cho phụ xe và tiếp nhận hoặc từ chối nếu có lý do."
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
              'Đã tiếp nhận chuyến được phân công.'
            )}
            onReject={rejectTrip}
          />
        )) : <EmptyState>Không có chuyến nào được phân công trong khoảng thời gian này.</EmptyState>}
      </div>
    </PageShell>
  );
};

export const ShiftSchedulePage = () => {
  const [filters, setFilters] = useState(getDefaultRange);
  const [shifts, setShifts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <PageShell
      title="Lịch ca làm việc"
      subtitle="Theo dõi giờ nhận ca, hạn có mặt, giờ kết thúc và hướng dẫn làm việc của phụ xe."
      icon={CalendarDays}
      filters={filters}
      setFilters={setFilters}
      onRefresh={load}
      isLoading={isLoading}
      error={error}
    >
      <div className="grid gap-4 xl:grid-cols-2">
        {shifts.length ? shifts.map((shift) => (
          <article key={shift.id} className="rounded border border-emerald-100 bg-white p-4 text-slate-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-emerald-700">{shift.shiftCode}</p>
                <h2 className="mt-1 text-lg font-black">{getTripTitle(shift)}</h2>
                <p className="mt-1 text-sm text-slate-500">{shift.route?.name || 'Chưa có tên tuyến'}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass[shift.shiftStatus] || statusClass.SCHEDULED}`}>
                {statusLabels[shift.shiftStatus] || shift.shiftStatus}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoBox label="Nhận ca" value={formatTime(shift.dutyStart)} icon={Clock3} />
              <InfoBox label="Hạn có mặt" value={formatTime(shift.checkInDeadline)} icon={Clock3} />
              <InfoBox label="Chuyến chạy" value={`${formatTime(shift.scheduledStart)} - ${formatTime(shift.scheduledEnd)}`} icon={CalendarDays} />
              <InfoBox label="Kết thúc ca" value={formatTime(shift.dutyEnd)} icon={Clock3} />
            </div>
            <div className="mt-4 rounded bg-slate-50 p-3">
              <p className="text-xs font-black uppercase text-slate-500">Hướng dẫn ca</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {(shift.dutyInstructions || []).map((instruction) => (
                  <li key={instruction}>- {instruction}</li>
                ))}
              </ul>
            </div>
          </article>
        )) : <EmptyState>Không có lịch ca trong khoảng thời gian này.</EmptyState>}
      </div>
    </PageShell>
  );
};

export const OperationNotificationsPage = () => {
  const [filters, setFilters] = useState(getDefaultRange);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const payload = await scheduleOperationsService.getOperationNotifications(filters);
      setNotifications(payload.notifications || []);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageShell
      title="Thông báo vận hành"
      subtitle="Nhận chỉ đạo từ trung tâm điều hành: cập nhật tuyến, đổi lịch, thông báo khẩn hoặc hướng dẫn phục vụ."
      icon={BellRing}
      filters={filters}
      setFilters={setFilters}
      onRefresh={load}
      isLoading={isLoading}
      error={error}
    >
      <div className="space-y-3">
        {notifications.length ? notifications.map((notification) => (
          <article key={notification.id} className="rounded border border-emerald-100 bg-white p-4 text-slate-950">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase text-emerald-700">{notification.category || 'GENERAL'}</p>
                <h2 className="mt-1 text-lg font-black">{notification.title}</h2>
                <p className="mt-2 text-sm text-slate-600">{notification.message}</p>
              </div>
              <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-black text-cyan-800">
                {notification.priority || 'NORMAL'}
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <InfoBox label="Hiệu lực từ" value={formatDate(notification.activeFrom)} icon={CalendarDays} />
              <InfoBox label="Hết hạn" value={formatDate(notification.expiresAt)} icon={CalendarDays} />
              <InfoBox label="Phạm vi" value={notification.route ? 'Theo tuyến/chuyến' : 'Thông báo chung'} icon={MapPin} />
            </div>
          </article>
        )) : <EmptyState>Chưa có thông báo vận hành trong khoảng thời gian này.</EmptyState>}
      </div>
    </PageShell>
  );
};

export default AssignedTripsPage;
