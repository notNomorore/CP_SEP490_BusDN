import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BusFront,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ListChecks,
  MapPin,
  PlayCircle,
  RefreshCw,
  Route,
  UserRound,
  Wrench,
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
  READY: { label: 'Xe sẵn sàng', className: 'bg-emerald-100 text-emerald-800' },
  IN_PROGRESS: { label: 'Đang vận hành', className: 'bg-cyan-100 text-cyan-800' },
  NOT_STARTED: { label: 'Chưa kiểm tra', className: 'bg-slate-100 text-slate-700' },
  ISSUE_REPORTED: { label: 'Đã báo lỗi xe', className: 'bg-red-100 text-red-800' },
};

const CHECKLIST_ITEMS = [
  { key: 'tires', label: 'Lốp xe' },
  { key: 'brakes', label: 'Hệ thống phanh' },
  { key: 'lights', label: 'Đèn và tín hiệu' },
  { key: 'fuelOrBattery', label: 'Nhiên liệu / pin' },
  { key: 'safetyEquipment', label: 'Thiết bị an toàn' },
  { key: 'cleanliness', label: 'Vệ sinh xe' },
];

const ISSUE_CATEGORIES = [
  { value: 'ENGINE', label: 'Động cơ' },
  { value: 'BRAKE', label: 'Phanh' },
  { value: 'TIRE', label: 'Lốp xe' },
  { value: 'ELECTRICAL', label: 'Điện / đèn' },
  { value: 'CLEANLINESS', label: 'Vệ sinh' },
  { value: 'OTHER', label: 'Khác' },
];

const formatDate = (value) => new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}).format(new Date(value));

const formatShortDate = (value) => new Intl.DateTimeFormat('vi-VN', {
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

const buildDefaultChecklist = (inspection) => (
  CHECKLIST_ITEMS.reduce((values, item) => ({
    ...values,
    [item.key]: Boolean(inspection?.checklist?.[item.key]),
  }), {})
);

const VehicleOperationsPanel = ({
  assignment,
  canOperateVehicle,
  isProcessing,
  onStartInspection,
  onConfirmReady,
  onReportIssue,
}) => {
  const inspection = assignment.inspection || { status: 'NOT_STARTED' };
  const [checklist, setChecklist] = useState(() => buildDefaultChecklist(inspection));
  const [issueCategory, setIssueCategory] = useState('OTHER');
  const [issueDescription, setIssueDescription] = useState('');

  useEffect(() => {
    setChecklist(buildDefaultChecklist(inspection));
  }, [inspection?.status, inspection?.id]);

  const allChecked = CHECKLIST_ITEMS.every((item) => checklist[item.key]);
  const isNotStarted = inspection.status === 'NOT_STARTED';
  const isInProgress = inspection.status === 'IN_PROGRESS';
  const isReady = inspection.status === 'READY';
  const isIssueReported = inspection.status === 'ISSUE_REPORTED';
  const tripAllowsInspection = assignment.tripStatus === 'SCHEDULED';
  const canEdit = canOperateVehicle && tripAllowsInspection && !isReady && !isIssueReported;
  const canStart = canEdit && (isNotStarted || isInProgress);
  const canConfirm = canEdit && isInProgress && allChecked;
  const canReport = canEdit && isInProgress && issueDescription.trim().length >= 5;

  const toggleChecklist = (key) => {
    setChecklist((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  return (
    <div className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-emerald-800" />
            <h4 className="font-black text-slate-950">Vận hành phương tiện</h4>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Luồng thực tế: bắt đầu kiểm tra, sau đó xác nhận xe sẵn sàng hoặc báo lỗi xe.
          </p>
        </div>
        <StatusBadge status={inspection.status} />
      </div>

      {!canOperateVehicle && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Chỉ tài xế được phân công cho chuyến này mới có thể cập nhật kiểm tra xe.
        </div>
      )}

      {canOperateVehicle && !tripAllowsInspection && !isReady && !isIssueReported && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Trạng thái chuyến này không còn cho phép cập nhật kiểm tra xe trước chuyến.
        </div>
      )}

      {isReady && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-800">
          Xe đã được xác nhận sẵn sàng. Biên bản kiểm tra này đã được khóa.
        </div>
      )}

      {isIssueReported && (
        <div className="mt-4 rounded-lg border border-red-200 bg-white px-4 py-3 text-sm text-red-700">
          <p className="font-bold">Đã báo lỗi xe. Phương tiện được chuyển sang trạng thái bảo trì.</p>
          <p className="mt-1">{inspection.issueDescription || 'Chưa có mô tả lỗi.'}</p>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CHECKLIST_ITEMS.map((item) => (
          <label
            key={item.key}
            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            <input
              type="checkbox"
              checked={Boolean(checklist[item.key])}
              onChange={() => toggleChecklist(item.key)}
              disabled={!canStart || isProcessing}
              className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
            />
            {item.label}
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row">
        <button
          type="button"
          onClick={() => onStartInspection(assignment.id, checklist)}
          disabled={!canStart || isProcessing}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-700 px-4 py-3 text-sm font-bold text-emerald-800 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Wrench className="h-4 w-4" />
          UC41 - Bắt đầu kiểm tra
        </button>
        <button
          type="button"
          onClick={() => onConfirmReady(assignment.id, checklist)}
          disabled={!canConfirm || isProcessing}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          UC42 - Xác nhận xe sẵn sàng
        </button>
      </div>

      {!isReady && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          {!isInProgress && (
            <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Hãy bắt đầu kiểm tra xe trước khi xác nhận sẵn sàng hoặc báo lỗi.
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-[220px_1fr]">
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase text-slate-500">Nhóm lỗi</span>
              <select
                value={issueCategory}
                onChange={(event) => setIssueCategory(event.target.value)}
                disabled={!canEdit || !isInProgress || isProcessing}
                className="w-full rounded-lg border-slate-300 text-sm focus:border-emerald-600 focus:ring-emerald-600"
              >
                {ISSUE_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase text-slate-500">Mô tả lỗi</span>
              <textarea
                value={issueDescription}
                onChange={(event) => setIssueDescription(event.target.value)}
                disabled={!canEdit || !isInProgress || isProcessing}
                placeholder="Ví dụ: đèn xi nhan trái không hoạt động, cần kiểm tra trước khi xuất bến."
                rows={3}
                className="w-full rounded-lg border-slate-300 text-sm focus:border-emerald-600 focus:ring-emerald-600"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => onReportIssue(assignment.id, { issueCategory, issueDescription })}
            disabled={!canReport || isProcessing}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <AlertTriangle className="h-4 w-4" />
            UC43 - Báo lỗi xe
          </button>
        </div>
      )}
    </div>
  );
};

const TripLifecyclePanel = ({
  assignment,
  canStartTrip,
  isProcessing,
  onStartTrip,
}) => {
  const isTripReady = assignment.tripStatus === 'READY';
  const isTripInProgress = assignment.tripStatus === 'IN_PROGRESS';
  const isTripClosed = ['COMPLETED', 'CANCELLED'].includes(assignment.tripStatus);
  const isVehicleReady = assignment.inspection?.status === 'READY';
  const canStart = canStartTrip && isTripReady && isVehicleReady && !isTripInProgress && !isTripClosed;

  let helperText = 'Chỉ tài xế được phân công mới có thể bắt đầu chuyến.';

  if (canStartTrip && !isVehicleReady) {
    helperText = 'Cần xác nhận xe sẵn sàng trước khi bắt đầu chuyến.';
  } else if (canStartTrip && !isTripReady && !isTripInProgress && !isTripClosed) {
    helperText = 'Chuyến chưa ở trạng thái sẵn sàng để bắt đầu.';
  } else if (isTripInProgress) {
    helperText = 'Chuyến đang được thực hiện và đã được ghi nhận thời điểm bắt đầu.';
  } else if (isTripClosed) {
    helperText = 'Chuyến đã đóng nên không thể bắt đầu lại.';
  } else if (canStart) {
    helperText = 'Xe đã sẵn sàng. Tài xế có thể bắt đầu chuyến để hệ thống chuyển sang theo dõi vận hành.';
  }

  return (
    <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50/70 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-blue-800" />
            <h4 className="font-black text-slate-950">Vòng đời chuyến</h4>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            UC44 bắt đầu chuyến sau khi tài xế đã xác nhận phương tiện sẵn sàng.
          </p>
        </div>
        <StatusBadge status={assignment.tripStatus} />
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-blue-100 bg-white p-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-slate-700">{helperText}</p>
        <button
          type="button"
          onClick={() => onStartTrip(assignment.id)}
          disabled={!canStart || isProcessing}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PlayCircle className="h-4 w-4" />
          UC44 - Bắt đầu chuyến
        </button>
      </div>
    </div>
  );
};

const AssignmentCard = ({
  assignment,
  canOperateVehicle = false,
  isProcessing = false,
  onStartInspection,
  onConfirmReady,
  onReportIssue,
  onStartTrip,
}) => (
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
        <StatusBadge status={assignment.inspection?.status || 'NOT_STARTED'} />
      </div>
    </div>

    <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 md:grid-cols-4">
      <InfoItem icon={CalendarDays} label="Ngày vận hành" value={formatDate(assignment.scheduledStart)} />
      <InfoItem icon={Clock3} label="Thời gian chuyến" value={`${formatTime(assignment.scheduledStart)} - ${formatTime(assignment.scheduledEnd)}`} />
      <InfoItem icon={BusFront} label="Phương tiện" value={`${assignment.vehicle.plateNumber} (${assignment.vehicle.code})`} />
      <InfoItem icon={UserRound} label="Vai trò của bạn" value={assignment.actorRole === 'DRIVER' ? 'Tài xế' : 'Phụ xe'} />
    </div>

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

    <VehicleOperationsPanel
      assignment={assignment}
      canOperateVehicle={canOperateVehicle && assignment.actorRole === 'DRIVER'}
      isProcessing={isProcessing}
      onStartInspection={onStartInspection}
      onConfirmReady={onConfirmReady}
      onReportIssue={onReportIssue}
    />
    <TripLifecyclePanel
      assignment={assignment}
      canStartTrip={canOperateVehicle && assignment.actorRole === 'DRIVER'}
      isProcessing={isProcessing}
      onStartTrip={onStartTrip}
    />
  </article>
);

const ShiftScheduleCard = ({ shift }) => {
  const dutySteps = [
    { label: 'Nhận ca', value: formatTime(shift.dutyStart), detail: 'Có mặt tại điểm tập kết' },
    { label: 'Hạn check-in', value: formatTime(shift.checkInDeadline), detail: 'Trễ mốc này cần báo điều hành' },
    { label: 'Khởi hành', value: formatTime(shift.scheduledStart), detail: shift.route.origin },
    { label: 'Kết thúc chuyến', value: formatTime(shift.scheduledEnd), detail: shift.route.destination },
    { label: 'Kết thúc ca', value: formatTime(shift.dutyEnd), detail: 'Hoàn tất bàn giao sau chuyến' },
  ];

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-black text-white">
              {shift.shiftCode}
            </span>
            <span className="text-sm font-semibold text-slate-500">{shift.tripCode}</span>
          </div>
          <h3 className="mt-3 text-lg font-black text-slate-950">
            Ca {formatShortDate(shift.scheduledStart)} - {shift.actorRole === 'DRIVER' ? 'Tài xế' : 'Phụ xe'}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {shift.route.routeNumber} | {shift.route.origin} - {shift.route.destination}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={shift.shiftStatus} />
          <StatusBadge status={shift.tripStatus} />
          <StatusBadge status={shift.inspection?.status || 'NOT_STARTED'} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 md:grid-cols-3">
        <InfoItem icon={MapPin} label="Điểm tập kết" value={shift.reportLocation || shift.route.origin} />
        <InfoItem icon={BusFront} label="Xe phụ trách" value={`${shift.vehicle.plateNumber} (${shift.vehicle.code})`} />
        <InfoItem icon={UserRound} label="Nhân sự cùng ca" value={shift.actorRole === 'DRIVER' ? (shift.busAssistant?.fullName || 'Chưa phân công phụ xe') : (shift.driver?.fullName || 'Chưa phân công tài xế')} />
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-sm font-black uppercase text-slate-700">
          <Clock3 className="h-4 w-4 text-emerald-700" />
          Timeline ca làm việc
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-5">
          {dutySteps.map((step) => (
            <div key={step.label} className="rounded-lg bg-white p-3">
              <p className="text-xs font-bold uppercase text-slate-500">{step.label}</p>
              <p className="mt-1 text-lg font-black text-slate-950">{step.value}</p>
              <p className="mt-1 text-xs text-slate-500">{step.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50/70 p-4">
        <div className="flex items-center gap-2 text-sm font-black uppercase text-emerald-900">
          <ListChecks className="h-4 w-4" />
          Nhiệm vụ trong ca
        </div>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {(shift.dutyInstructions || []).map((instruction) => (
            <li key={instruction} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-700" />
              <span>{instruction}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
};

const EmptyState = ({ message }) => (
  <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
    {message}
  </div>
);

const ScheduleOperationsPage = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('trips');
  const [filters, setFilters] = useState(getInitialFilters);
  const [assignedTrips, setAssignedTrips] = useState([]);
  const [shiftSchedule, setShiftSchedule] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingAssignmentId, setProcessingAssignmentId] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

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

  const runVehicleAction = async (assignmentId, action, successText) => {
    setProcessingAssignmentId(assignmentId);
    setError('');
    setSuccessMessage('');

    try {
      await action();
      setSuccessMessage(successText);
      await loadData();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setProcessingAssignmentId('');
    }
  };

  const handleStartInspection = (assignmentId, checklist) => runVehicleAction(
    assignmentId,
    () => scheduleOperationsService.startVehicleInspection(assignmentId, { checklist }),
    'Đã bắt đầu kiểm tra xe trước chuyến.'
  );

  const handleConfirmReady = (assignmentId, checklist) => runVehicleAction(
    assignmentId,
    () => scheduleOperationsService.confirmVehicleReady(assignmentId, { checklist }),
    'Đã xác nhận xe sẵn sàng vận hành.'
  );

  const handleReportIssue = (assignmentId, issuePayload) => runVehicleAction(
    assignmentId,
    () => scheduleOperationsService.reportVehicleIssue(assignmentId, issuePayload),
    'Đã gửi báo cáo lỗi xe.'
  );

  const handleStartTrip = (assignmentId) => runVehicleAction(
    assignmentId,
    () => scheduleOperationsService.startTrip(assignmentId),
    'Đã bắt đầu chuyến. Hệ thống chuyển sang theo dõi vận hành.'
  );

  const scheduleByDate = useMemo(() => (
    shiftSchedule.reduce((groups, shift) => {
      const key = new Date(shift.scheduledStart).toISOString().slice(0, 10);
      groups[key] = [...(groups[key] || []), shift];
      return groups;
    }, {})
  ), [shiftSchedule]);

  const actorLabel = user?.role === 'DRIVER' ? 'Tài xế' : 'Phụ xe';
  const canOperateVehicle = user?.role === 'DRIVER';

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="pt-20">
        <section className="border-b border-emerald-900/20 bg-emerald-950 text-white">
          <div className="mx-auto max-w-7xl px-6 py-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase text-emerald-200">
                  Vận hành lịch trình
                </span>
                <h1 className="mt-4 text-3xl font-black md:text-4xl">Lịch vận hành cá nhân</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-100/80">
                  Theo dõi chuyến được phân công, lịch ca làm việc và tình trạng kiểm tra xe trước khi xuất bến.
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

          {successMessage && (
            <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {successMessage}
            </div>
          )}

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
                <AssignmentCard
                  key={trip.id}
                  assignment={trip}
                  canOperateVehicle={canOperateVehicle}
                  isProcessing={processingAssignmentId === trip.id}
                  onStartInspection={handleStartInspection}
                  onConfirmReady={handleConfirmReady}
                  onReportIssue={handleReportIssue}
                  onStartTrip={handleStartTrip}
                />
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
                  <div className="space-y-4">
                    {shifts.map((shift) => (
                      <ShiftScheduleCard key={shift.id} shift={shift} />
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

export default ScheduleOperationsPage;
