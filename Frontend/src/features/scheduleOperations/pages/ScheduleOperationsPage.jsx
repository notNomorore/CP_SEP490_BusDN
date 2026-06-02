import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BusFront,
  CalendarDays,
  Clock3,
  MapPin,
  RefreshCw,
  Route,
  UserRound,
} from 'lucide-react';
import Header from '../../../shared/components/navigation/Header.jsx';
import Footer from '../../../shared/components/common/Footer.jsx';
import useAuthStore from '../../auth/stores/authStore.js';
import scheduleOperationsService from '../services/scheduleOperationsService.js';

const STATUS_META = {
  ASSIGNED: { label: 'Đã phân công', className: 'bg-amber-100 text-amber-900' },
  CONFIRMED: { label: 'Đã xác nhận', className: 'bg-blue-100 text-blue-800' },
  COMPLETED: { label: 'Hoàn thành', className: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Đã hủy', className: 'bg-red-100 text-red-800' },
  SCHEDULED: { label: 'Đã lên lịch', className: 'bg-slate-100 text-slate-700' },
  READY: { label: 'Sẵn sàng', className: 'bg-emerald-100 text-emerald-800' },
  IN_PROGRESS: { label: 'Đang thực hiện', className: 'bg-cyan-100 text-cyan-800' },
};

const formatDate = (value) => new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}).format(new Date(value));

const formatTime = (value) => new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(value));

const getDateInputValue = (date) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
};

const getInitialFilters = () => {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 13);

  return {
    from: getDateInputValue(from),
    to: getDateInputValue(to),
  };
};

const getErrorMessage = (error) => (
  error?.message || 'Không thể tải lịch vận hành. Vui lòng thử lại.'
);

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || {
    label: status,
    className: 'bg-slate-100 text-slate-700',
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${meta.className}`}>
      {meta.label}
    </span>
  );
};

const InfoItem = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
      <Icon className="h-4 w-4" />
    </span>
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-900">{value || 'Chưa có'}</p>
    </div>
  </div>
);

const AssignmentCard = ({ assignment, compact = false }) => (
  <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-black text-white">
            {assignment.route.routeNumber}
          </span>
          <span className="text-sm font-semibold text-slate-500">{assignment.tripCode}</span>
        </div>
        <h3 className="mt-3 text-lg font-black text-slate-950">
          {assignment.route.origin} - {assignment.route.destination}
        </h3>
        <p className="mt-1 text-sm text-slate-600">{assignment.route.name}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={assignment.shiftStatus} />
        <StatusBadge status={assignment.tripStatus} />
      </div>
    </div>

    <div className={`mt-5 grid gap-4 border-t border-slate-100 pt-5 ${compact ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
      <InfoItem
        icon={CalendarDays}
        label="Ngày vận hành"
        value={formatDate(assignment.scheduledStart)}
      />
      <InfoItem
        icon={Clock3}
        label="Thời gian"
        value={`${formatTime(assignment.scheduledStart)} - ${formatTime(assignment.scheduledEnd)}`}
      />
      <InfoItem
        icon={BusFront}
        label="Phương tiện"
        value={`${assignment.vehicle.plateNumber} (${assignment.vehicle.code})`}
      />
      {!compact && (
        <InfoItem
          icon={UserRound}
          label="Vai trò của bạn"
          value={assignment.actorRole === 'DRIVER' ? 'Tài xế' : 'Phụ xe'}
        />
      )}
    </div>

    {!compact && (
      <div className="mt-5 grid gap-3 rounded-lg bg-slate-50 p-4 text-sm md:grid-cols-2">
        <div>
          <span className="font-semibold text-slate-500">Tài xế: </span>
          <span className="font-bold text-slate-900">{assignment.driver?.fullName || 'Chưa phân công'}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-500">Phụ xe: </span>
          <span className="font-bold text-slate-900">{assignment.busAssistant?.fullName || 'Chưa phân công'}</span>
        </div>
        {assignment.notes && (
          <div className="md:col-span-2">
            <span className="font-semibold text-slate-500">Ghi chú: </span>
            <span className="text-slate-700">{assignment.notes}</span>
          </div>
        )}
      </div>
    )}
  </article>
);

const ScheduleOperationsPage = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('trips');
  const [filters, setFilters] = useState(getInitialFilters);
  const [assignedTrips, setAssignedTrips] = useState([]);
  const [shiftSchedule, setShiftSchedule] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const [tripsPayload, schedulePayload] = await Promise.all([
        scheduleOperationsService.getAssignedTrips(filters),
        scheduleOperationsService.getShiftSchedule(filters),
      ]);

      setAssignedTrips(tripsPayload.trips || []);
      setShiftSchedule(schedulePayload.shifts || []);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const scheduleByDate = useMemo(() => (
    shiftSchedule.reduce((groups, shift) => {
      const key = new Date(shift.scheduledStart).toISOString().slice(0, 10);
      groups[key] = [...(groups[key] || []), shift];
      return groups;
    }, {})
  ), [shiftSchedule]);

  const actorLabel = user?.role === 'DRIVER' ? 'Tài xế' : 'Phụ xe';

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="pt-20">
        <section className="border-b border-emerald-900/20 bg-emerald-950 text-white">
          <div className="mx-auto max-w-7xl px-6 py-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase text-emerald-200">
                  Schedule Operations
                </span>
                <h1 className="mt-4 text-3xl font-black md:text-4xl">Lịch vận hành cá nhân</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-100/80">
                  Theo dõi chuyến xe được phân công và lịch ca làm việc theo ngày để chuẩn bị trước khi vận hành.
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-emerald-200">Đang đăng nhập</p>
                <p className="mt-1 font-bold">{user?.fullName || 'Nhân viên vận hành'} - {actorLabel}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-end md:justify-between">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">Từ ngày</span>
                <input
                  type="date"
                  value={filters.from}
                  onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
                  className="rounded-lg border-slate-300 text-sm focus:border-emerald-600 focus:ring-emerald-600"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">Đến ngày</span>
                <input
                  type="date"
                  value={filters.to}
                  min={filters.from}
                  onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
                  className="rounded-lg border-slate-300 text-sm focus:border-emerald-600 focus:ring-emerald-600"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Làm mới lịch
            </button>
          </div>

          <div className="mt-6 grid grid-cols-2 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('trips')}
              className={`flex items-center justify-center gap-2 border-b-2 px-4 py-4 text-sm font-bold ${
                activeTab === 'trips'
                  ? 'border-emerald-700 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Route className="h-4 w-4" />
              UC39 - Chuyến được phân công ({assignedTrips.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`flex items-center justify-center gap-2 border-b-2 px-4 py-4 text-sm font-bold ${
                activeTab === 'schedule'
                  ? 'border-emerald-700 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              UC40 - Lịch ca làm việc ({shiftSchedule.length})
            </button>
          </div>

          {error && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="mt-6 rounded-lg border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              Đang tải lịch vận hành...
            </div>
          ) : activeTab === 'trips' ? (
            <div className="mt-6 space-y-4">
              {assignedTrips.length ? assignedTrips.map((trip) => (
                <AssignmentCard key={trip.id} assignment={trip} />
              )) : (
                <EmptyState message="Không có chuyến xe nào được phân công trong khoảng thời gian này." />
              )}
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {Object.entries(scheduleByDate).length ? Object.entries(scheduleByDate).map(([date, shifts]) => (
                <section key={date}>
                  <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase text-slate-700">
                    <MapPin className="h-4 w-4 text-emerald-700" />
                    {formatDate(shifts[0].scheduledStart)}
                  </div>
                  <div className="space-y-3">
                    {shifts.map((shift) => (
                      <AssignmentCard key={shift.id} assignment={shift} compact />
                    ))}
                  </div>
                </section>
              )) : (
                <EmptyState message="Không có ca làm việc nào trong khoảng thời gian này." />
              )}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
};

const EmptyState = ({ message }) => (
  <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
    {message}
  </div>
);

export default ScheduleOperationsPage;
