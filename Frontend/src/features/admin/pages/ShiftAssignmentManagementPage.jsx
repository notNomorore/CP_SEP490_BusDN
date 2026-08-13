import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  RefreshCw,
  Save,
  Trash2,
  UserRoundCheck,
  Wand2,
} from 'lucide-react';
import adminService from '../services/adminService.js';
const WeeklyRosterPanel = React.lazy(() => import('./shifts/WeeklyRosterPanel.jsx'));

const OPERATING_START = '05:30';
const OPERATING_END = '18:30';
const MAX_DAYS = 31;
const MAX_WORK_MINUTES_PER_DAY = 8 * 60;
const TARGET_WORK_MINUTES_PER_DAY = 8 * 60;
const TARGET_WORK_MINUTES_PER_WEEK = 40 * 60;
const MIN_REST_MINUTES = 10 * 60;
// The weekly roster is now the primary scheduling view. Keep the legacy list
// available in code for audit/backward compatibility, but do not expose it.
const SHOW_LEGACY_SHIFT_LIST = false;
const SHOW_SEPARATE_WORKLOAD_TAB = false;

const shiftTemplates = [
  { key: 'MORNING', label: 'Ca nhân sự sáng', startTime: '05:30', endTime: '12:00', shiftType: 'MORNING' },
  { key: 'AFTERNOON', label: 'Ca nhân sự chiều', startTime: '12:00', endTime: '18:30', shiftType: 'AFTERNOON' },
];

const manualShiftTemplates = {
  MORNING: { label: 'Ca nhân sự sáng', startTime: '05:30', endTime: '12:00' },
  AFTERNOON: { label: 'Ca nhân sự chiều', startTime: '12:00', endTime: '18:30' },
};

const weekDays = [
  { key: 1, label: 'Thứ Hai' },
  { key: 2, label: 'Thứ Ba' },
  { key: 3, label: 'Thứ Tư' },
  { key: 4, label: 'Thứ Năm' },
  { key: 5, label: 'Thứ Sáu' },
  { key: 6, label: 'Thứ Bảy' },
  { key: 0, label: 'Chủ nhật' },
];

const todayInput = () => {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

const toDateInput = (value) => {
  if (!value) return todayInput();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return todayInput();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

const addDays = (value, days) => {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInput(date);
};

const eachDate = (start, end) => {
  const from = new Date(`${start}T00:00:00`);
  const to = new Date(`${end}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return [];
  const dates = [];
  for (let cursor = from; cursor <= to && dates.length < MAX_DAYS; cursor.setDate(cursor.getDate() + 1)) {
    dates.push(toDateInput(cursor));
  }
  return dates;
};

const filterDatesByWeekdays = (dates, selectedWeekdays) => {
  if (!selectedWeekdays?.length) return dates;
  const allowed = new Set(selectedWeekdays.map(Number));
  return dates.filter((value) => allowed.has(new Date(`${value}T00:00:00`).getDay()));
};

const minutesOf = (value) => {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return (hours * 60) + minutes;
};

const durationMinutes = (startTime, endTime) => {
  const start = minutesOf(startTime);
  const end = minutesOf(endTime);
  if (start === null || end === null) return 0;
  return end > start ? end - start : (end + 1440) - start;
};

const isValidWindow = (startTime, endTime) => {
  const start = minutesOf(startTime);
  const end = minutesOf(endTime);
  const duration = durationMinutes(startTime, endTime);
  return start !== null
    && end !== null
    && start >= minutesOf(OPERATING_START)
    && end <= minutesOf(OPERATING_END)
    && start < end
    && duration > 0
    && duration <= MAX_WORK_MINUTES_PER_DAY;
};

const formatDate = (value) => {
  if (!value) return 'Chưa có';
  return new Date(value).toLocaleDateString('vi-VN');
};

const getId = (value) => String(value?._id || value || '');

const getStaffName = (staff) => staff?.fullName || staff?.email || staff?.phoneNumber || 'Chưa gán';

const assignmentStaff = (assignment, type) => {
  if (!assignment) return null;
  if (type === 'driver') {
    return assignment.driverId || assignment.driver || assignment.userId || assignment.staffId || assignment.user || null;
  }
  return assignment.assistantId || assignment.assistant || assignment.userId || assignment.staffId || assignment.user || null;
};

const makeShiftName = ({ shiftType, startTime, endTime }) => {
  const label = {
    MORNING: 'Ca sáng',
    AFTERNOON: 'Ca chiều',
  }[shiftType] || 'Ca làm việc';
  return `${label} ${startTime}-${endTime}`;
};

const buildAutoShiftCode = ({ workDate, templateKey, driverId, assistantId }) => {
  const staffKey = [driverId, assistantId]
    .filter(Boolean)
    .map((value) => String(value).slice(-8).toUpperCase())
    .join('-') || 'STAFF';
  return `AUTO-${String(workDate || '').replaceAll('-', '')}-${templateKey}-${staffKey}`;
};

const ACTIVE_ASSIGNMENT_STATUSES = new Set(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED']);

const rangesOverlap = (leftStart, leftEnd, rightStart, rightEnd) => {
  const startA = minutesOf(leftStart);
  const endA = minutesOf(leftEnd);
  const startB = minutesOf(rightStart);
  const endB = minutesOf(rightEnd);
  if ([startA, endA, startB, endB].some((value) => value === null)) return false;
  const normalizedEndA = endA > startA ? endA : endA + 1440;
  const normalizedEndB = endB > startB ? endB : endB + 1440;
  return startA < normalizedEndB && startB < normalizedEndA;
};

const shiftBlocksTemplate = (shift, template) => (
  shift?.status !== 'ARCHIVED'
  && rangesOverlap(shift.startTime, shift.endTime, template.startTime, template.endTime)
);

const restMinutesBetween = (first, second) => {
  const firstStart = minutesOf(first?.startTime);
  const firstEnd = minutesOf(first?.endTime);
  const secondStart = minutesOf(second?.startTime);
  const secondEnd = minutesOf(second?.endTime);
  if ([firstStart, firstEnd, secondStart, secondEnd].some((value) => value === null)) return Infinity;
  if (rangesOverlap(first.startTime, first.endTime, second.startTime, second.endTime)) return -1;
  return firstEnd <= secondStart ? secondStart - firstEnd : firstStart - secondEnd;
};

const formatMinutes = (minutes) => `${Math.floor(Math.max(0, minutes) / 60)}h${String(Math.max(0, minutes) % 60).padStart(2, '0')}`;

const getShiftDurationMinutes = (shift) => {
  return durationMinutes(shift?.startTime, shift?.endTime);
};

const hasActiveAssignment = (assignment) => assignment && (!assignment.status || ACTIVE_ASSIGNMENT_STATUSES.has(String(assignment.status).toUpperCase()));

const statusLabel = {
  DRAFT: 'Bản nháp',
  PENDING_APPROVAL: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  PUBLISHED: 'Đã công bố',
  ACTIVE: 'Đang hiệu lực',
  INACTIVE: 'Tạm ngưng',
  ARCHIVED: 'Đã hủy',
  ASSIGNED: 'Đã phân công',
  IN_PROGRESS: 'Đang làm',
  COMPLETED: 'Hoàn thành',
  ABSENT: 'Vắng mặt',
  CANCELLED: 'Đã hủy',
};

const statusClass = {
  DRAFT: 'bg-slate-100 text-slate-700',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-cyan-100 text-cyan-800',
  PUBLISHED: 'bg-emerald-100 text-emerald-800',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  INACTIVE: 'bg-slate-100 text-slate-700',
  ARCHIVED: 'bg-rose-100 text-rose-700',
  ASSIGNED: 'bg-cyan-100 text-cyan-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  ABSENT: 'bg-orange-100 text-orange-800',
  CANCELLED: 'bg-rose-100 text-rose-700',
};

const coverageLabel = { FULL: 'Đủ nhân sự ca', PARTIAL: 'Còn thiếu nhân sự', NONE: 'Chưa phân lịch' };
const coverageClass = {
  FULL: 'bg-emerald-100 text-emerald-800',
  PARTIAL: 'bg-amber-100 text-amber-800',
  NONE: 'bg-rose-100 text-rose-700',
};

const routeSchedulingLabels = {
  UNSCHEDULED: 'Chưa phân lịch',
  PARTIALLY_SCHEDULED: 'Chưa phân đủ',
  FULLY_SCHEDULED: 'Đã phân đủ',
  CONFIRMED: 'Đã xác nhận',
  CONFLICT: 'Xung đột lịch',
  MISSING_DRIVER: 'Thiếu tài xế',
  MISSING_ASSISTANT: 'Thiếu phụ xe',
  MISSING_VEHICLE: 'Thiếu xe',
};

const workloadLabels = {
  UNDER_HOURS: 'Chưa đủ giờ làm',
  BALANCED: 'Thời lượng phù hợp',
  NEAR_LIMIT: 'Sắp đủ giờ làm',
  OVER_LIMIT: 'Vượt thời lượng cho phép',
};

const ShiftAssignmentManagementPage = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('ROSTER');
  const [assignmentMode, setAssignmentMode] = useState('AUTO');
  const [fromDate, setFromDate] = useState(todayInput());
  const [toDate, setToDate] = useState(todayInput());
  const [rangeRefreshKey, setRangeRefreshKey] = useState(0);
  const [form, setForm] = useState({
    applyMode: 'DAY',
    startTime: OPERATING_START,
    endTime: '12:00',
    shiftType: 'MORNING',
    routeId: '',
    driverId: '',
    assistantId: '',
    vehicleId: '',
    selectedWeekdays: weekDays.map((day) => day.key),
    requiresAssistant: true,
    description: '',
  });
  const [autoSelection, setAutoSelection] = useState({ driverIds: [], assistantIds: [] });
  const [manualPreviewRows, setManualPreviewRows] = useState([]);
  const [staff, setStaff] = useState({ drivers: [], assistants: [] });
  const [routes, setRoutes] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [pendingTrips, setPendingTrips] = useState([]);
  const [staffingDemand, setStaffingDemand] = useState([]);
  const [assignmentMap, setAssignmentMap] = useState({});
  const [selectedShift, setSelectedShift] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [coverageFilter, setCoverageFilter] = useState('ALL');
  const [shiftStatusFilter, setShiftStatusFilter] = useState('ALL');
  const [operatingOverview, setOperatingOverview] = useState(null);
  const [eligibleManualDrivers, setEligibleManualDrivers] = useState([]);
  const [eligibleEditDrivers, setEligibleEditDrivers] = useState([]);
  const [cancelRequest, setCancelRequest] = useState(null);
  const loadShiftsRequestRef = useRef(0);

  const dateRange = useMemo(() => eachDate(fromDate, toDate), [fromDate, toDate]);
  const dateRangeError = useMemo(() => (
    fromDate && toDate && fromDate > toDate
      ? 'Từ ngày không được lớn hơn đến ngày.'
      : ''
  ), [fromDate, toDate]);

  const selectedAssignments = selectedShift ? assignmentMap[getId(selectedShift)] || {} : {};

  const getStaffAssignmentsForDate = useCallback((staffId, role, workDate, excludeShiftId = '') => {
    if (!staffId || !workDate) return [];

    return shifts.flatMap((shift) => {
      if (toDateInput(shift.workDate) !== workDate || shift.status === 'ARCHIVED') return [];
      if (excludeShiftId && getId(shift) === getId(excludeShiftId)) return [];
      const pair = assignmentMap[getId(shift)] || {};
      const assignments = role === 'driver'
        ? (pair.driverAssignments || (pair.driver ? [pair.driver] : []))
        : (pair.assistantAssignments || (pair.assistant ? [pair.assistant] : []));

      return assignments
        .filter((assignment) => (
          hasActiveAssignment(assignment) && getId(assignmentStaff(assignment, role)) === staffId
        ))
        .map((assignment) => ({ assignment, shift }));
    });
  }, [assignmentMap, shifts]);

  const canStaffTakeSlot = useCallback((staffId, role, workDate, template, excludeShiftId = '') => {
    if (!staffId || !workDate || !template) return false;
    const assignments = getStaffAssignmentsForDate(staffId, role, workDate, excludeShiftId);

    const hasTimeConflict = assignments.some(({ shift }) => shiftBlocksTemplate(shift, template));
    if (hasTimeConflict) return false;

    if (role === 'driver' && assignments.some(({ shift }) => restMinutesBetween(shift, template) < MIN_REST_MINUTES)) {
      return false;
    }

    const assignedMinutes = assignments.reduce(
      (total, { shift }) => total + getShiftDurationMinutes(shift),
      0,
    );
    return assignedMinutes + getShiftDurationMinutes(template) <= MAX_WORK_MINUTES_PER_DAY;
  }, [getStaffAssignmentsForDate]);

  const hasAnyFreeSlot = useCallback((staffId, role) => (
    dateRange.some((workDate) => shiftTemplates.some((template) => canStaffTakeSlot(staffId, role, workDate, template)))
  ), [canStaffTakeSlot, dateRange]);

  const availableDrivers = useMemo(() => (
    staff.drivers.filter((driver) => hasAnyFreeSlot(getId(driver), 'driver'))
  ), [hasAnyFreeSlot, staff.drivers]);

  const availableAssistants = useMemo(() => (
    staff.assistants.filter((assistant) => hasAnyFreeSlot(getId(assistant), 'assistant'))
  ), [hasAnyFreeSlot, staff.assistants]);

  const editAvailableDrivers = useMemo(() => {
    if (!selectedShift || !editForm) return [];
    const workDate = toDateInput(selectedShift.workDate);
    const slot = {
      startTime: editForm.startTime,
      endTime: editForm.endTime,
    };
    return staff.drivers
      .filter((driver) => canStaffTakeSlot(getId(driver), 'driver', workDate, slot, selectedShift._id))
      .sort((left, right) => {
        const assigned = (driver) => getStaffAssignmentsForDate(getId(driver), 'driver', workDate, selectedShift._id)
          .reduce((total, item) => total + getShiftDurationMinutes(item.shift), 0);
        return assigned(left) - assigned(right) || getStaffName(left).localeCompare(getStaffName(right), 'vi');
      });
  }, [canStaffTakeSlot, editForm, getStaffAssignmentsForDate, selectedShift, staff.drivers]);

  const editAvailableAssistants = useMemo(() => {
    if (!selectedShift || !editForm) return [];
    const workDate = toDateInput(selectedShift.workDate);
    const slot = {
      startTime: editForm.startTime,
      endTime: editForm.endTime,
    };
    return staff.assistants.filter((assistant) => (
      canStaffTakeSlot(getId(assistant), 'assistant', workDate, slot, selectedShift._id)
    ));
  }, [canStaffTakeSlot, editForm, selectedShift, staff.assistants]);

  useEffect(() => {
    if (!editForm?.driverId) return;
    const isStillAvailable = editAvailableDrivers.some((driver) => getId(driver) === getId(editForm.driverId));
    if (!isStillAvailable) {
      setEditForm((prev) => (prev ? { ...prev, driverId: '' } : prev));
    }
  }, [editAvailableDrivers, editForm?.driverId]);

  useEffect(() => {
    if (!editForm?.assistantId) return;
    const isStillAvailable = editAvailableAssistants.some((assistant) => getId(assistant) === getId(editForm.assistantId));
    if (!isStillAvailable) {
      setEditForm((prev) => (prev ? { ...prev, assistantId: '' } : prev));
    }
  }, [editAvailableAssistants, editForm?.assistantId]);

  const loadStaff = useCallback(async () => {
    const [response, routeResponse] = await Promise.all([
      adminService.getDrivers(),
      adminService.getRoutes(),
    ]);
    setStaff({
      drivers: (response.drivers || []).filter((user) => user.status === 'ACTIVE'),
      assistants: (response.assistantStaff || []).filter((user) => user.status === 'ACTIVE'),
    });
    setRoutes(routeResponse.routes || routeResponse.data || []);
  }, []);

  const loadShifts = useCallback(async () => {
    // rangeRefreshKey intentionally invalidates this request when a preset is selected again.
    void rangeRefreshKey;
    const requestId = loadShiftsRequestRef.current + 1;
    loadShiftsRequestRef.current = requestId;
    if (dateRangeError) {
      setLoading(false);
      setShifts([]);
      setAssignmentMap({});
      setMessage(dateRangeError);
      return;
    }
    setLoading(true);
    setShifts([]);
    setAssignmentMap({});
    setMessage('');
    try {
      const response = await adminService.getShifts({ from: fromDate, to: toDate });
      if (loadShiftsRequestRef.current !== requestId) return;
      const rows = (response.shifts || []).filter((shift) => shift.status !== 'ARCHIVED');
      rows.sort((left, right) => (
        toDateInput(left.workDate).localeCompare(toDateInput(right.workDate))
        || String(left.startTime || '').localeCompare(String(right.startTime || ''))
      ));
      setShifts(rows);
      setLoading(false);

      if (!rows.length) {
        setAssignmentMap({});
        return;
      }

      let assignments = { driverAssignments: [], assistantAssignments: [], vehicleAssignments: [] };
      try {
        assignments = await adminService.getShiftAssignments({ from: fromDate, to: toDate });
      } catch {
        if (loadShiftsRequestRef.current === requestId) {
          toast.error('Không thể tải phân công ca làm.');
        }
      }
      if (loadShiftsRequestRef.current !== requestId) return;
      const nextAssignmentMap = Object.fromEntries(rows.map((shift) => [getId(shift), {
        driver: null,
        assistant: null,
        driverAssignments: [],
        assistantAssignments: [],
        vehicleAssignments: [],
        vehicle: null,
      }]));

      (assignments.driverAssignments || []).filter(hasActiveAssignment).forEach((assignment) => {
        const shiftId = getId(assignment.shiftId);
        if (!nextAssignmentMap[shiftId]) return;
        nextAssignmentMap[shiftId].driverAssignments.push(assignment);
        if (!nextAssignmentMap[shiftId].driver) nextAssignmentMap[shiftId].driver = assignment;
      });
      (assignments.assistantAssignments || []).filter(hasActiveAssignment).forEach((assignment) => {
        const shiftId = getId(assignment.shiftId);
        if (!nextAssignmentMap[shiftId]) return;
        nextAssignmentMap[shiftId].assistantAssignments.push(assignment);
        if (!nextAssignmentMap[shiftId].assistant) nextAssignmentMap[shiftId].assistant = assignment;
      });
      (assignments.vehicleAssignments || []).filter(hasActiveAssignment).forEach((assignment) => {
        const shiftId = getId(assignment.shiftId);
        if (!nextAssignmentMap[shiftId]) return;
        nextAssignmentMap[shiftId].vehicleAssignments.push(assignment);
        if (!nextAssignmentMap[shiftId].vehicle) nextAssignmentMap[shiftId].vehicle = assignment;
      });
      setAssignmentMap(nextAssignmentMap);
    } catch (error) {
      if (loadShiftsRequestRef.current === requestId) {
        toast.error(error?.message || 'Không thể tải danh sách ca làm.');
      }
    } finally {
      if (loadShiftsRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [dateRangeError, fromDate, rangeRefreshKey, toDate]);

  const loadPendingTrips = useCallback(async () => {
    if (dateRangeError || !fromDate || !toDate) {
      setPendingTrips([]);
      return;
    }
    try {
      const response = await adminService.getTripSchedules({
        startDate: fromDate,
        endDate: toDate,
        status: 'PLANNED',
        limit: 500,
      });
      setPendingTrips((response.schedules || []).filter((trip) => (
        !trip.vehicle?.busId || !trip.driver?.userId || !trip.assistant?.userId
      )));
    } catch (error) {
      setPendingTrips([]);
      toast.error(error?.message || 'Không thể tải các chuyến đang chờ phân ca.');
    }
  }, [dateRangeError, fromDate, toDate]);

  const loadStaffingDemand = useCallback(async () => {
    if (dateRangeError || !fromDate || !toDate) return setStaffingDemand([]);
    try {
      const response = await adminService.getStaffingDemand({ startDate: fromDate, endDate: toDate });
      setStaffingDemand(response.demand?.days || []);
    } catch (error) {
      setStaffingDemand([]);
      toast.error(error?.message || 'Không thể tính nhu cầu nhân sự từ kế hoạch chuyến.');
    }
  }, [dateRangeError, fromDate, toDate]);

  const loadOperatingOverview = useCallback(async () => {
    if (!fromDate || dateRangeError) return setOperatingOverview(null);
    try {
      const response = await adminService.getSchedulingOverview(fromDate);
      setOperatingOverview(response.overview || null);
    } catch (error) {
      setOperatingOverview(null);
      toast.error(error?.message || 'Không thể tải kế hoạch vận hành theo tuyến.');
    }
  }, [dateRangeError, fromDate]);

  useEffect(() => {
    loadStaff().catch(() => toast.error('Không thể tải danh sách nhân sự.'));
  }, [loadStaff]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  useEffect(() => {
    loadPendingTrips();
  }, [loadPendingTrips, rangeRefreshKey]);

  useEffect(() => {
    loadStaffingDemand();
  }, [loadStaffingDemand, rangeRefreshKey]);

  useEffect(() => {
    loadOperatingOverview();
  }, [loadOperatingOverview, rangeRefreshKey]);

  useEffect(() => {
    if (!fromDate || !form.startTime || !form.endTime) return setEligibleManualDrivers([]);
    let active = true;
    adminService.getEligibleSchedulingDrivers({ routeId: form.routeId, workDate: fromDate, startTime: form.startTime, endTime: form.endTime, shiftType: form.shiftType })
      .then((response) => { if (active) setEligibleManualDrivers(response.drivers || []); })
      .catch(() => { if (active) setEligibleManualDrivers([]); });
    return () => { active = false; };
  }, [form.endTime, form.routeId, form.shiftType, form.startTime, fromDate]);

  useEffect(() => {
    const availableDriverIds = new Set(availableDrivers.map((driver) => getId(driver)));
    const availableAssistantIds = new Set(availableAssistants.map((assistant) => getId(assistant)));
    setAutoSelection((prev) => {
      const driverIds = prev.driverIds.filter((id) => availableDriverIds.has(id));
      const assistantIds = prev.assistantIds.filter((id) => availableAssistantIds.has(id));
      if (driverIds.length === prev.driverIds.length && assistantIds.length === prev.assistantIds.length) return prev;
      return { driverIds, assistantIds };
    });
  }, [availableDrivers, availableAssistants]);

  const setRangePreset = (preset) => {
    const today = todayInput();
    const current = new Date(`${today}T00:00:00`);
    const mondayOffset = (current.getDay() + 6) % 7;
    const start = preset === 'WEEK' ? addDays(today, -mondayOffset) : today;
    const length = { DAY: 0, WEEK: 6, MONTH: 30 }[preset] ?? 0;
    setFromDate(start);
    setToDate(addDays(start, length));
    setRangeRefreshKey((current) => current + 1);
  };

  const assignPeople = async ({ shift, driverId, assistantId, vehicleId }) => {
    if (driverId) await adminService.assignDriverToSelectedShift(shift._id, { driverId });
    if (assistantId) await adminService.assignAssistantToSelectedShift(shift._id, { assistantId });
    if (vehicleId) await adminService.assignVehicleToSelectedShift(shift._id, { vehicleId });
  };

  const createOrReuseShift = async (payload) => {
    try {
      const response = await adminService.createShift(payload);
      return { shift: response.shift, created: true };
    } catch (error) {
      if (error?.response?.status !== 409 && error?.statusCode !== 409) throw error;
      const existing = await adminService.getShifts({ date: payload.workDate });
      const reused = (existing.shifts || []).find((shift) => (
        payload.shiftCode ? shift.shiftCode === payload.shiftCode : (shift.startTime === payload.startTime
        && shift.endTime === payload.endTime
        && shift.shiftType === payload.shiftType
        && shift.status !== 'ARCHIVED')
      ));
      if (!reused) throw error;
      return { shift: reused, created: false };
    }
  };

  const handleCreateManual = async (event) => {
    event.preventDefault();
    if (dateRangeError) return toast.error(dateRangeError);
    const baseDates = form.applyMode === 'DAY' ? [fromDate] : dateRange;
    const targetDates = form.applyMode === 'DAY'
      ? baseDates
      : filterDatesByWeekdays(baseDates, form.selectedWeekdays);
    if (!targetDates.length) return toast.error('Khoảng ngày không có ngày phù hợp để tạo ca.');
    if (!form.driverId && !form.assistantId) return toast.error('Hãy chọn ít nhất một tài xế hoặc phụ xe.');
    if (!isValidWindow(form.startTime, form.endTime)) return toast.error('Ca làm phải có thời lượng hợp lệ và tối đa 8 giờ.');

    const template = manualShiftTemplates[form.shiftType];
    const standardTimeChanged = template
      && template.startTime
      && template.endTime
      && (template.startTime !== form.startTime || template.endTime !== form.endTime);
    const selectedPeople = [
      form.driverId ? { role: 'DRIVER', driverId: form.driverId, assistantId: '' } : null,
      form.assistantId ? { role: 'ASSISTANT', driverId: '', assistantId: form.assistantId } : null,
    ].filter(Boolean);
    const rows = targetDates.flatMap((workDate, index) => selectedPeople.map((person) => {
      const demand = staffingDemand.find((item) => item.workDate === workDate && item.shiftType === form.shiftType);
      const affectedWindows = (demand?.coverageWindows || []).filter((window) => (
        rangesOverlap(form.startTime, form.endTime, window.startTime, window.endTime)
      ));
      const shortageWindows = affectedWindows.filter((window) => window.missingDrivers > 0 || window.missingAssistants > 0);
      return {
        previewId: `${workDate}-${form.shiftType}-${form.startTime}-${form.endTime}-${person.role}-${index}`,
        workDate,
        startTime: form.startTime,
        endTime: form.endTime,
        shiftType: form.shiftType,
        routeId: form.routeId,
        shiftName: makeShiftName(form),
        driverId: person.driverId,
        assistantId: person.assistantId,
        vehicleId: form.vehicleId,
        requiresAssistant: false,
        description: form.description || 'Ca được tạo từ màn hình phân công ca thủ công.',
        coverageImpact: shortageWindows.length
          ? `Bổ sung ${shortageWindows.map((window) => `${window.startTime}–${window.endTime}`).join(', ')}`
          : (affectedWindows.length ? 'Khung giờ này hiện đã đủ nhân sự' : 'Không có chuyến cần vận hành trong khung giờ này'),
        warnings: [
          standardTimeChanged ? 'Ca tăng cường theo giờ thực tế' : '',
          shortageWindows.length ? '' : 'Có nguy cơ bố trí dư nhân sự',
        ].filter(Boolean),
      };
    }));
    setMessage('');
    setManualPreviewRows(rows);
    toast.success(`Đã tạo lịch nháp ${rows.length} ca để kiểm tra.`);
  };

  const handleSaveManualDrafts = async () => {
    if (!manualPreviewRows.length) return toast.error('Chưa có lịch nháp để lưu.');
    setSubmitting(true);
    setMessage('');
    let saved = 0;
    let assigned = 0;
    try {
      for (const row of manualPreviewRows) {
        const { shift } = await createOrReuseShift({
          shiftCode: buildAutoShiftCode({ workDate: row.workDate, templateKey: `MANUAL-${row.shiftType}`, driverId: row.driverId, assistantId: row.assistantId }),
          workDate: row.workDate,
          startTime: row.startTime,
          endTime: row.endTime,
          shiftType: row.shiftType,
          routeId: row.routeId,
          shiftName: row.shiftName,
          description: row.description,
          requiresAssistant: row.requiresAssistant,
          status: 'DRAFT',
          approvalStatus: 'DRAFT',
        });
        saved += 1;
        await assignPeople({ shift, driverId: row.driverId, assistantId: row.assistantId });
        if (row.driverId || row.assistantId) assigned += 1;
      }
      setManualPreviewRows([]);
      setMessage(`Đã lưu ${saved} ca nháp, gán nhân sự cho ${assigned} ca.`);
      toast.success('Đã lưu lịch nháp.');
      await Promise.all([loadShifts(), loadStaffingDemand()]);
    } catch (error) {
      toast.error(error?.message || 'Không thể lưu lịch nháp.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAutoStaff = (kind, staffId) => {
    const field = kind === 'driver' ? 'driverIds' : 'assistantIds';
    setAutoSelection((prev) => {
      const current = new Set(prev[field]);
      if (current.has(staffId)) current.delete(staffId);
      else current.add(staffId);
      return { ...prev, [field]: Array.from(current) };
    });
  };

  const setAllAutoStaff = (kind, checked) => {
    const field = kind === 'driver' ? 'driverIds' : 'assistantIds';
    const source = kind === 'driver' ? availableDrivers : availableAssistants;
    setAutoSelection((prev) => ({
      ...prev,
      [field]: checked ? source.map((item) => getId(item)) : [],
    }));
  };

  const selectRecommendedStaff = () => {
    const pickForEveryDay = (field, missingField) => [...new Set(staffingDemand.flatMap((demand) => (
      [...(demand[field] || [])]
        .filter((candidate) => candidate.eligible)
        .sort((left, right) => (right.score || 0) - (left.score || 0))
        .slice(0, Math.max(0, demand[missingField] || 0))
        .map(getId)
    )))];
    setAutoSelection({
      driverIds: pickForEveryDay('driverCandidates', 'missingDrivers'),
      assistantIds: pickForEveryDay('assistantCandidates', 'missingAssistants'),
    });
    toast.success('Đã chọn nhân sự phù hợp riêng cho từng ngày và từng ca.');
  };

  const handleAutoGenerate = async () => {
    if (dateRangeError) return toast.error(dateRangeError);
    if (!dateRange.length) return toast.error('Khoảng ngày không hợp lệ.');
    if (!autoSelection.driverIds.length && !autoSelection.assistantIds.length) {
      return toast.error('Vui lòng chọn ít nhất một tài xế hoặc phụ xe.');
    }
    const plannedTripCount = staffingDemand.reduce((total, item) => total + Number(item.tripCount || 0), 0);
    const missingDriverCount = staffingDemand.reduce((total, item) => total + Number(item.missingDrivers || 0), 0);
    const missingAssistantCount = staffingDemand.reduce((total, item) => total + Number(item.missingAssistants || 0), 0);
    if (!plannedTripCount) {
      setMessage('Khoảng ngày đã chọn chưa có kế hoạch chuyến. Hãy tạo chuyến trước, hoặc dùng “Tạo ca thủ công” nếu cần bố trí ca ngoại lệ.');
      return toast('Chưa có kế hoạch chuyến để tính nhu cầu ca.');
    }
    if (!missingDriverCount && !missingAssistantCount) {
      setMessage('Các ca hiện có đã bao phủ đủ nhu cầu chuyến trong khoảng ngày đã chọn. Hệ thống không sinh thêm để tránh thừa nhân sự.');
      return toast('Nhu cầu nhân sự đã đủ, không cần sinh thêm ca.');
    }

    setSubmitting(true);
    setMessage('');
    const createdRows = [];
    const skippedRows = [];

    try {
      const selectedDrivers = autoSelection.driverIds
        .map((id) => availableDrivers.find((driver) => getId(driver) === id))
        .filter(Boolean);
      const selectedAssistants = autoSelection.assistantIds
        .map((id) => availableAssistants.find((assistant) => getId(assistant) === id))
        .filter(Boolean);

      const localBusy = {
        driver: new Map(),
        assistant: new Map(),
      };

      const markBusy = (role, workDate, staffId, template) => {
        if (!staffId) return;
        const key = `${workDate}:${staffId}`;
        const current = localBusy[role].get(key) || [];
        localBusy[role].set(key, [...current, template]);
      };

      const getLocalTemplates = (role, workDate, staffId) => (
        staffId ? localBusy[role].get(`${workDate}:${staffId}`) || [] : []
      );

      const canUseStaff = (staffId, role, workDate, template) => (
        Boolean(staffId)
        && !getLocalTemplates(role, workDate, staffId).some((assignedTemplate) => (
          rangesOverlap(assignedTemplate.startTime, assignedTemplate.endTime, template.startTime, template.endTime)
        ))
        && getLocalTemplates(role, workDate, staffId).reduce(
          (total, assignedTemplate) => total + getShiftDurationMinutes(assignedTemplate),
          0,
        ) + getShiftDurationMinutes(template) <= MAX_WORK_MINUTES_PER_DAY
        && canStaffTakeSlot(staffId, role, workDate, template)
      );

      let totalCandidateRows = 0;

      for (const workDate of dateRange) {
        for (const template of shiftTemplates) {
          const demand = staffingDemand.find((item) => item.workDate === workDate && item.shiftType === template.shiftType);
          const buildQueue = (items, role, limit) => {
            const candidateField = role === 'driver' ? 'driverCandidates' : 'assistantCandidates';
            const scores = new Map((demand?.[candidateField] || []).map((candidate) => [getId(candidate), candidate.score || 0]));
            return [...items]
            .filter((item) => scores.has(getId(item)) && canUseStaff(getId(item), role, workDate, template))
            .sort((left, right) => (scores.get(getId(right)) || 0) - (scores.get(getId(left)) || 0))
            .slice(0, Math.max(0, limit));
          };

          const availableDriverQueue = buildQueue(selectedDrivers, 'driver', demand?.missingDrivers || 0);
          const availableAssistantQueue = buildQueue(selectedAssistants, 'assistant', demand?.missingAssistants || 0);
          const independentPeople = [
            ...availableDriverQueue.map((person) => ({ role: 'driver', person })),
            ...availableAssistantQueue.map((person) => ({ role: 'assistant', person })),
          ];
          totalCandidateRows += independentPeople.length;

          for (let staffIndex = 0; staffIndex < independentPeople.length; staffIndex += 1) {
            const { role, person } = independentPeople[staffIndex];
            const staffId = getId(person);
            const driverId = role === 'driver' ? staffId : '';
            const assistantId = role === 'assistant' ? staffId : '';
            const { shift, created } = await createOrReuseShift({
              shiftCode: buildAutoShiftCode({ workDate, templateKey: `${template.key}-${role}`, driverId, assistantId }),
              workDate,
              startTime: template.startTime,
              endTime: template.endTime,
              shiftType: template.shiftType,
              shiftName: `${template.label} · ${role === 'driver' ? 'Tài xế' : 'Phụ xe'} · ${getStaffName(person)}`,
              description: 'Ca cá nhân được hệ thống sinh tự động theo nhu cầu vận hành.',
              requiresAssistant: false,
              status: 'PUBLISHED',
              approvalStatus: 'PUBLISHED',
            });
            try {
              if (role === 'driver') await adminService.assignDriverToSelectedShift(shift._id, { driverId });
              else await adminService.assignAssistantToSelectedShift(shift._id, { assistantId });
              markBusy(role, workDate, staffId, template);
              createdRows.push(shift);
            } catch (error) {
              if (created) await adminService.archiveShift(shift._id).catch(() => undefined);
              skippedRows.push({ shift, reason: error?.message || 'Không phân công được nhân sự phù hợp.' });
            }
          }
        }
      }

      if (!createdRows.length) {
        setMessage('Không sinh ca mới vì toàn bộ nhân sự đã có ca hoặc không còn ai rảnh trong khoảng ngày đã chọn.');
        toast('Không còn nhân sự phù hợp để bổ sung vào các khung giờ đang thiếu.');
      } else {
        setMessage(`Đã sinh/phân công ${createdRows.length} ca cho ${dateRange.length} ngày. ${skippedRows.length ? `${skippedRows.length} trường hợp đã kín ca hoặc cần admin kiểm tra lại.` : 'Không có ca lỗi.'}`);
        toast.success('Đã sinh lịch phân ca.');
      }

      if (!totalCandidateRows) {
        setMessage('Không còn nhân sự rảnh trong khoảng ngày đã chọn, hệ thống không tạo ca trống.');
      }

      await loadShifts();
    } catch (error) {
      toast.error(error?.message || 'Không thể sinh ca tự động.');
    } finally {
      setSubmitting(false);
    }
  };
  const openEdit = async (shift) => {
    setSelectedShift(shift);
    setEditForm({
      startTime: shift.startTime || OPERATING_START,
      endTime: shift.endTime || OPERATING_END,
      shiftType: ['MORNING', 'AFTERNOON'].includes(shift.shiftType) ? shift.shiftType : 'MORNING',
      status: shift.status || 'ACTIVE',
      description: shift.description || '',
      driverId: getId(assignmentMap[getId(shift)]?.driver?.driverId),
      assistantId: getId(assignmentMap[getId(shift)]?.assistant?.assistantId),
      vehicleId: getId(assignmentMap[getId(shift)]?.vehicle?.vehicleId),
    });
    try {
      const response = await adminService.getEligibleSchedulingDrivers({ routeId: getId(shift.routeId), workDate: toDateInput(shift.workDate), startTime: shift.startTime, endTime: shift.endTime, shiftType: shift.shiftType });
      const current = assignmentStaff(assignmentMap[getId(shift)]?.driver, 'driver');
      setEligibleEditDrivers(current ? [current, ...(response.drivers || []).filter((item) => getId(item) !== getId(current))] : (response.drivers || []));
    } catch { setEligibleEditDrivers([]); }
  };

  const handleUpdateShift = async (event) => {
    event.preventDefault();
    if (!selectedShift || !editForm) return;
    if (!isValidWindow(editForm.startTime, editForm.endTime)) return toast.error('Ca làm phải nằm trong 05:30 - 18:30 và tối đa 8 giờ.');
    setSubmitting(true);
    try {
      await adminService.updateShift(selectedShift._id, {
        ...selectedShift,
        ...editForm,
        workDate: toDateInput(selectedShift.workDate),
        shiftName: makeShiftName(editForm),
      });
      await assignPeople({ shift: selectedShift, driverId: editForm.driverId, assistantId: editForm.assistantId });
      toast.success('Đã cập nhật ca làm.');
      setSelectedShift(null);
      setEditForm(null);
      await loadShifts();
    } catch (error) {
      toast.error(error?.message || 'Không thể cập nhật ca làm.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelShift = async (shift, confirmed = false) => {
    if (!confirmed) return setCancelRequest({ type: 'SHIFT', shift, message: 'Hủy ca này? Các phân công tài xế, phụ xe, xe và chuyến trong ca sẽ được hủy theo.' });
    setSubmitting(true);
    try {
      await adminService.archiveShift(shift._id);
      setCancelRequest(null);
      toast.success('Đã hủy ca làm.');
      if (selectedShift?._id === shift._id) {
        setSelectedShift(null);
        setEditForm(null);
      }
      await loadShifts();
    } catch (error) {
      toast.error(error?.message || 'Không thể hủy ca làm.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelShiftsInRange = async (confirmed = false) => {
    if (dateRangeError) {
      toast.error(dateRangeError);
      return;
    }
    if (!dateRange.length) {
      toast.error('Khoảng ngày không hợp lệ.');
      return;
    }
    if (!confirmed) return setCancelRequest({ type: 'RANGE', message: `Hủy ca làm từ ${fromDate} đến ${toDate}? Các phân công trong những ca này sẽ được hủy theo.` });
    setSubmitting(true);
    try {
      let archivedCount = 0;
      try {
        const response = await adminService.archiveShifts({ from: fromDate, to: toDate });
        archivedCount = response.archivedShifts || 0;
      } catch (error) {
        const isBulkRouteMissing = error?.statusCode === 404 || error?.status === 404 || String(error?.message || '').includes('/api/admin/shifts not found');
        if (!isBulkRouteMissing) throw error;

        const response = await adminService.getShifts({ from: fromDate, to: toDate });
        const activeShifts = (response.shifts || []).filter((shift) => shift.status !== 'ARCHIVED');
        for (const shift of activeShifts) {
          await adminService.archiveShift(shift._id);
          archivedCount += 1;
        }
      }
      toast.success(`Đã hủy ${archivedCount} ca làm từ ${fromDate} đến ${toDate}.`);
      setCancelRequest(null);
      setSelectedShift(null);
      setEditForm(null);
      await loadShifts();
    } catch (error) {
      toast.error(error?.message || 'Không thể hủy ca làm trong khoảng ngày.');
    } finally {
      setSubmitting(false);
    }
  };

  const shiftCoverage = useCallback((shift) => {
    const pair = assignmentMap[getId(shift)] || {};
    const hasDriver = Boolean(pair.driver);
    const hasAssistant = shift.requiresAssistant === false || Boolean(pair.assistant);
    if (hasDriver && hasAssistant) return 'FULL';
    if (hasDriver || (shift.requiresAssistant !== false && pair.assistant)) return 'PARTIAL';
    return 'NONE';
  }, [assignmentMap]);

  const visibleShifts = useMemo(() => shifts.filter((shift) => {
    if (coverageFilter !== 'ALL' && shiftCoverage(shift) !== coverageFilter) return false;
    if (shiftStatusFilter === 'ALL') return true;
    if (shiftStatusFilter === 'MISSING') return shiftCoverage(shift) !== 'FULL';
    if (shiftStatusFilter === 'READY') return shiftCoverage(shift) === 'FULL' && ['DRAFT', 'ACTIVE', 'APPROVED', 'PUBLISHED'].includes(shift.status);
    if (shiftStatusFilter === 'CONFIRMED') return ['APPROVED', 'PUBLISHED', 'ACTIVE'].includes(shift.status);
    return shift.status === shiftStatusFilter;
  }), [coverageFilter, shiftCoverage, shiftStatusFilter, shifts]);
  const individualShiftRows = useMemo(() => visibleShifts.flatMap((shift) => {
    const assignments = assignmentMap[getId(shift)] || {};
    const driver = assignmentStaff(assignments.driver, 'driver');
    const assistant = assignmentStaff(assignments.assistant, 'assistant');
    return [
      driver ? { key: `${getId(shift)}-driver`, shift, person: driver, role: 'Tài xế' } : null,
      assistant ? { key: `${getId(shift)}-assistant`, shift, person: assistant, role: 'Phụ xe' } : null,
    ].filter(Boolean);
  }), [assignmentMap, visibleShifts]);

  const routeById = useMemo(() => new Map(routes.map((route) => [getId(route), route])), [routes]);
  const pendingTripsByRoute = useMemo(() => {
    const groups = new Map();
    pendingTrips.forEach((trip) => {
      const routeId = getId(trip.routeId);
      if (!routeId) return;
      groups.set(routeId, [...(groups.get(routeId) || []), trip]);
    });
    return [...groups.entries()].map(([routeId, trips]) => ({
      routeId,
      route: routeById.get(routeId),
      trips: [...trips].sort((left, right) => (
        toDateInput(left.serviceDate).localeCompare(toDateInput(right.serviceDate))
        || String(left.departureTime || '').localeCompare(String(right.departureTime || ''))
      )),
    }));
  }, [pendingTrips, routeById]);
  const recommendedMissing = useMemo(() => {
    const byDate = new Map();
    staffingDemand.forEach((item) => {
      const current = byDate.get(item.workDate) || { drivers: 0, assistants: 0 };
      current.drivers += item.missingDrivers;
      current.assistants += item.missingAssistants;
      byDate.set(item.workDate, current);
    });
    return [...byDate.values()].reduce((result, item) => ({
      drivers: Math.max(result.drivers, item.drivers),
      assistants: Math.max(result.assistants, item.assistants),
    }), { drivers: 0, assistants: 0 });
  }, [staffingDemand]);
  const staffPriority = useMemo(() => {
    const result = { driver: new Map(), assistant: new Map() };
    [['driver', 'driverCandidates'], ['assistant', 'assistantCandidates']].forEach(([role, field]) => {
      const grouped = new Map();
      staffingDemand.flatMap((item) => item[field] || []).forEach((candidate) => {
        const current = grouped.get(getId(candidate)) || { ...candidate, scores: [], reasons: new Set() };
        current.scores.push(candidate.score || 0);
        (candidate.reasons || []).forEach((reason) => current.reasons.add(reason));
        grouped.set(getId(candidate), current);
      });
      grouped.forEach((candidate, staffId) => result[role].set(staffId, { ...candidate, score: Math.round(candidate.scores.reduce((sum, score) => sum + score, 0) / candidate.scores.length), reasons: [...candidate.reasons] }));
    });
    return result;
  }, [staffingDemand]);
  const routeCoverage = useMemo(() => {
    const groups = new Map();
    shifts.forEach((shift) => {
      const routeId = getId(shift.routeId) || 'UNASSIGNED';
      if (!groups.has(routeId)) groups.set(routeId, []);
      groups.get(routeId).push(shift);
    });
    return [...groups.entries()].map(([routeId, routeShifts]) => {
      const statuses = routeShifts.map(shiftCoverage);
      const driverCount = routeShifts.filter((shift) => assignmentMap[getId(shift)]?.driver).length;
      const assistantCount = routeShifts.filter((shift) => shift.requiresAssistant === false || assignmentMap[getId(shift)]?.assistant).length;
      return { routeId, route: routeById.get(routeId), total: statuses.length, full: statuses.filter((status) => status === 'FULL').length, driverCount, assistantCount, status: statuses.every((status) => status === 'FULL') ? 'FULL' : statuses.some((status) => status !== 'NONE') ? 'PARTIAL' : 'NONE' };
    });
  }, [assignmentMap, routeById, shiftCoverage, shifts]);
  const visibleRouteCoverage = useMemo(() => (
    coverageFilter === 'ALL' ? routeCoverage : routeCoverage.filter((item) => item.status === coverageFilter)
  ), [coverageFilter, routeCoverage]);

  const driverWorkloads = useMemo(() => staff.drivers.map((driver) => {
    const driverId = getId(driver);
    const items = shifts.flatMap((shift) => {
      const pair = assignmentMap[getId(shift)] || {};
      const matches = (pair.driverAssignments || (pair.driver ? [pair.driver] : []))
        .some((assignment) => hasActiveAssignment(assignment) && getId(assignmentStaff(assignment, 'driver')) === driverId);
      return matches ? [shift] : [];
    });
    const totalMinutes = items.reduce((total, shift) => total + getShiftDurationMinutes(shift), 0);
    const byDate = Object.groupBy
      ? Object.groupBy(items, (shift) => toDateInput(shift.workDate))
      : items.reduce((result, shift) => ({ ...result, [toDateInput(shift.workDate)]: [...(result[toDateInput(shift.workDate)] || []), shift] }), {});
    const freeSlots = dateRange.flatMap((workDate) => shiftTemplates
      .filter((template) => canStaffTakeSlot(driverId, 'driver', workDate, template))
      .map((template) => `${formatDate(workDate)} ${template.startTime}-${template.endTime}`));
    const warnings = [];
    Object.values(byDate).forEach((dayShifts) => {
      const ordered = [...dayShifts].sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
      const dayMinutes = ordered.reduce((total, shift) => total + getShiftDurationMinutes(shift), 0);
      if (dayMinutes > MAX_WORK_MINUTES_PER_DAY) warnings.push('Vượt 8 giờ/ngày');
      ordered.forEach((shift, index) => {
        if (ordered.slice(index + 1).some((next) => shiftBlocksTemplate(shift, next))) warnings.push('Trùng lịch');
        if (ordered[index + 1] && restMinutesBetween(shift, ordered[index + 1]) < MIN_REST_MINUTES) warnings.push('Thiếu thời gian nghỉ');
      });
    });
    return { driver, items, totalMinutes, freeSlots, warnings: [...new Set(warnings)] };
  }).sort((left, right) => left.totalMinutes - right.totalMinutes), [assignmentMap, canStaffTakeSlot, dateRange, shifts, staff.drivers]);

  const staffWorkloads = useMemo(() => {
    const buildItems = (person, role) => {
      const personId = getId(person);
      const items = shifts.filter((shift) => {
        const pair = assignmentMap[getId(shift)] || {};
        const assignments = role === 'driver'
          ? (pair.driverAssignments || (pair.driver ? [pair.driver] : []))
          : (pair.assistantAssignments || (pair.assistant ? [pair.assistant] : []));
        return assignments.some((assignment) => hasActiveAssignment(assignment)
          && getId(assignmentStaff(assignment, role)) === personId);
      });
      return {
        person,
        role,
        items,
        totalMinutes: items.reduce((total, shift) => total + getShiftDurationMinutes(shift), 0),
      };
    };
    return [
      ...staff.drivers.map((person) => buildItems(person, 'driver')),
      ...staff.assistants.map((person) => buildItems(person, 'assistant')),
    ].sort((left, right) => left.role.localeCompare(right.role) || getStaffName(left.person).localeCompare(getStaffName(right.person), 'vi'));
  }, [assignmentMap, shifts, staff.assistants, staff.drivers]);

  const workloadTargetMinutes = useMemo(() => {
    const workingDays = dateRange.filter((date) => {
      const day = new Date(`${date}T00:00:00`).getDay();
      return day !== 0 && day !== 6;
    }).length;
    return Math.max(1, workingDays) * TARGET_WORK_MINUTES_PER_DAY;
  }, [dateRange]);

  const staffingWarnings = useMemo(() => [
    ...shifts.filter((shift) => shiftCoverage(shift) !== 'FULL').map((shift) => ({
      key: `shift-${getId(shift)}`,
      text: `${formatDate(shift.workDate)} ${shift.startTime}-${shift.endTime}: ${coverageLabel[shiftCoverage(shift)]}`,
    })),
    ...driverWorkloads.filter((item) => item.items.length && item.totalMinutes < (dateRange.length > 1 ? TARGET_WORK_MINUTES_PER_WEEK : TARGET_WORK_MINUTES_PER_DAY)).map((item) => ({
      key: `driver-${getId(item.driver)}`,
      text: `${getStaffName(item.driver)} mới được phân ${formatMinutes(item.totalMinutes)} trong kỳ đã chọn.`,
    })),
    ...driverWorkloads.flatMap((item) => item.warnings.map((warning) => ({ key: `${getId(item.driver)}-${warning}`, text: `${getStaffName(item.driver)}: ${warning}.` }))),
  ], [dateRange.length, driverWorkloads, shiftCoverage, shifts]);

  const demandDashboard = useMemo(() => {
    const dayItems = staffingDemand.filter((item) => item.workDate === fromDate);
    const totalTrips = dayItems.reduce((sum, item) => sum + Number(item.tripCount || 0), 0);
    const requiredDrivers = dayItems.reduce((sum, item) => sum + Number(item.requiredDrivers || 0), 0);
    const requiredAssistants = dayItems.reduce((sum, item) => sum + Number(item.requiredAssistants || 0), 0);
    const assignedDrivers = dayItems.reduce((sum, item) => sum + Number(item.assignedDrivers || 0), 0);
    const assignedAssistants = dayItems.reduce((sum, item) => sum + Number(item.assignedAssistants || 0), 0);
    const sourceWindows = dayItems.flatMap((item) => item.coverageWindows || []);
    const bands = [
      ['05:30', '06:30', 'Bình thường'],
      ['06:30', '08:30', 'Cao điểm sáng'],
      ['08:30', '11:00', 'Bình thường'],
      ['11:00', '13:00', 'Nhu cầu trung bình'],
      ['13:00', '16:30', 'Bình thường'],
      ['16:30', '18:30', 'Cao điểm chiều'],
    ].map(([startTime, endTime, label]) => {
      const matching = sourceWindows.filter((window) => rangesOverlap(startTime, endTime, window.startTime, window.endTime));
      const peak = matching.sort((left, right) => Number(right.required || 0) - Number(left.required || 0))[0];
      const required = Number(peak?.required || 0);
      const assignedDriversInBand = Number(peak?.assignedDrivers || 0);
      const assignedAssistantsInBand = Number(peak?.assignedAssistants || 0);
      return { startTime, endTime, label, required, assignedDrivers: assignedDriversInBand, assignedAssistants: assignedAssistantsInBand, missingDrivers: Math.max(0, required - assignedDriversInBand), missingAssistants: Math.max(0, required - assignedAssistantsInBand) };
    });
    return { totalTrips, requiredDrivers, requiredAssistants, assignedDrivers, assignedAssistants, bands };
  }, [fromDate, staffingDemand]);

  return (
    <div className="min-h-full bg-[#eef9f4] text-[#05231a]">
      <section className="mx-auto max-w-[1500px] space-y-4 px-4 py-4 lg:px-6">
        <div className="rounded-2xl bg-[#062819] px-5 py-4 text-white shadow-lg shadow-emerald-950/15">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-300">Quản lý ca làm</p>
          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-black">Phân ca & quản lý giờ làm</h1>
              <p className="mt-1 max-w-3xl text-sm text-emerald-50/80">
                Lập ca theo nhu cầu chuyến, sau đó theo dõi lịch và thời lượng làm việc của tài xế, phụ xe.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { loadShifts(); loadPendingTrips(); loadOperatingOverview(); }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-[#062819]"
            >
              <RefreshCw size={17} /> Tải lại
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-2 shadow-sm">
          <div className="grid gap-2 md:grid-cols-2">
            <button type="button" onClick={() => setActiveView('ROSTER')} className={`rounded-xl border px-4 py-3 text-left transition ${activeView === 'ROSTER' ? 'border-emerald-300 bg-emerald-100 text-emerald-950' : 'border-transparent bg-slate-50 text-slate-600 hover:border-emerald-200'}`}>
              <span className="flex items-center gap-2"><CalendarDays size={19} /><strong>Lịch tuần</strong></span>
              <span className="mt-1 block text-xs">Lịch sáng/chiều và ngày nghỉ.</span>
            </button>
            <button type="button" onClick={() => setActiveView('ASSIGN')} className={`rounded-xl border px-4 py-3 text-left transition ${activeView === 'ASSIGN' ? 'border-emerald-300 bg-emerald-100 text-emerald-950' : 'border-transparent bg-slate-50 text-slate-600 hover:border-emerald-200'}`}>
              <span className="flex items-center gap-2"><UserRoundCheck size={19} /><strong>Phân ca nhân sự</strong></span>
              <span className="mt-1 block text-xs">Nhu cầu và tạo ca làm.</span>
            </button>
            {SHOW_SEPARATE_WORKLOAD_TAB ? <button type="button" onClick={() => setActiveView('WORKLOAD')} className={`rounded-xl border px-4 py-3 text-left transition ${activeView === 'WORKLOAD' ? 'border-emerald-300 bg-emerald-100 text-emerald-950' : 'border-transparent bg-slate-50 text-slate-600 hover:border-emerald-200'}`}>
              <span className="flex items-center gap-2"><Clock3 size={19} /><strong>Ca làm & hiệu suất</strong></span>
              <span className="mt-1 block text-xs">Lịch, tổng giờ và trạng thái.</span>
            </button> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          {activeView === 'ROSTER' ? <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <label className="space-y-2"><span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Chọn một ngày trong tuần</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold" /><span className="block text-xs text-slate-500">Hệ thống tự động hiển thị trọn tuần từ Thứ Hai đến Chủ Nhật.</span></label>
            <div className="flex items-start gap-2 lg:pt-6"><button type="button" onClick={() => setRangePreset('DAY')} className="h-12 rounded-xl border border-slate-200 px-4 text-sm font-black">Tuần hiện tại</button><button type="button" onClick={() => setFromDate(addDays(fromDate, -7))} className="h-12 rounded-xl border border-slate-200 px-4 text-sm font-black">← Tuần trước</button><button type="button" onClick={() => setFromDate(addDays(fromDate, 7))} className="h-12 rounded-xl border border-slate-200 px-4 text-sm font-black">Tuần sau →</button></div>
          </div> : <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Từ ngày</span>
              <input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 px-3 font-bold" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Đến ngày</span>
              <input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 px-3 font-bold" />
            </label>
            <div className="flex items-end gap-2">
              <button type="button" onClick={() => setRangePreset('DAY')} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-black">Hôm nay</button>
              <button type="button" onClick={() => setRangePreset('WEEK')} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-black">Tuần</button>
              <button type="button" onClick={() => setRangePreset('MONTH')} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-black">Tháng</button>
            </div>
          </div>}
          {dateRangeError ? (
            <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {dateRangeError}
            </p>
          ) : null}
        </div>

        {activeView === 'ROSTER' ? <React.Suspense fallback={<div className="rounded-2xl border border-emerald-100 bg-white p-8 text-center font-bold text-slate-500">Đang tải lịch tuần…</div>}><WeeklyRosterPanel weekStartDate={fromDate} /></React.Suspense> : null}

        {activeView === 'ASSIGN' ? <section className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <aside className="rounded-3xl bg-[#063c2f] p-5 text-white shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Nhu cầu nhân sự</p>
            <h2 className="mt-2 text-xl font-black">Theo kế hoạch chuyến</h2>
            <p className="mt-2 text-xs leading-5 text-emerald-50/75">Hệ thống tính số nhân viên tối thiểu cần có mặt trong ngày {formatDate(fromDate)}.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {[['Tổng lượt', demandDashboard.totalTrips], ['Tài xế cần', demandDashboard.requiredDrivers], ['Phụ xe cần', demandDashboard.requiredAssistants], ['Còn thiếu', Math.max(0, demandDashboard.requiredDrivers - demandDashboard.assignedDrivers) + Math.max(0, demandDashboard.requiredAssistants - demandDashboard.assignedAssistants)]].map(([label, value]) => <div key={label} className="rounded-xl bg-white/10 p-3"><p className="text-xs text-emerald-100/75">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>)}
            </div>
            <div className="mt-5"><div className="flex justify-between text-xs font-bold"><span>Đã bố trí ca</span><span>{demandDashboard.assignedDrivers + demandDashboard.assignedAssistants}/{demandDashboard.requiredDrivers + demandDashboard.requiredAssistants}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-emerald-300" style={{ width: `${Math.min(100, Math.round(((demandDashboard.assignedDrivers + demandDashboard.assignedAssistants) / Math.max(1, demandDashboard.requiredDrivers + demandDashboard.requiredAssistants)) * 100))}%` }} /></div></div>
            <button type="button" disabled={!recommendedMissing.drivers && !recommendedMissing.assistants} onClick={selectRecommendedStaff} className="mt-5 h-11 w-full rounded-xl bg-white font-black text-emerald-900 disabled:opacity-40">Chọn nhân sự còn thiếu</button>
          </aside>
          <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Timeline nhu cầu 05:30–18:30</h2><p className="text-sm text-slate-500">Đủ/thiếu được tính từ ca cá nhân hiện có, chưa ghép tài xế với phụ xe.</p></div><div className="flex gap-3 text-xs font-bold"><span className="text-emerald-700">● Đủ</span><span className="text-amber-700">● Thiếu nhẹ</span><span className="text-rose-700">● Thiếu nghiêm trọng</span></div></div>
            <div className="mt-5 space-y-3">{demandDashboard.bands.map((band) => {
              const missing = band.missingDrivers + band.missingAssistants;
              const severe = missing >= 2;
              return <div key={band.startTime} className={`grid gap-3 rounded-2xl border p-4 sm:grid-cols-[110px_1fr_auto] ${severe ? 'border-rose-200 bg-rose-50' : missing ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}><b>{band.startTime}–{band.endTime}</b><div><p className="font-black">{band.label}</p><p className="mt-1 text-xs text-slate-600">Cần {band.required} tài xế và {band.required} phụ xe · Đã có {band.assignedDrivers} tài xế và {band.assignedAssistants} phụ xe</p></div><span className={`h-fit rounded-full px-3 py-1 text-xs font-black ${severe ? 'bg-rose-100 text-rose-700' : missing ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{severe ? `Thiếu ${band.missingDrivers} TX, ${band.missingAssistants} PX` : missing ? `Thiếu ${missing} người` : 'Đủ nhân sự'}</span></div>;
            })}</div>
          </div>
        </section> : null}

        {activeView === 'REMOVED' ? <section className={`rounded-3xl border p-5 shadow-sm ${pendingTrips.length ? 'border-amber-200 bg-amber-50' : 'border-emerald-100 bg-white'}`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black">Chuyến đang chờ phân ca</h2>
              <p className="mt-1 text-sm text-slate-600">
                Đây là các chuyến đã tạo ở “Phân chuyến” nhưng chưa được gán đủ xe, tài xế và phụ xe.
              </p>
            </div>
            <span className={`w-fit rounded-full px-4 py-2 text-sm font-black ${pendingTrips.length ? 'bg-amber-200 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}>
              {pendingTrips.length} chuyến chờ xử lý
            </span>
          </div>
          {pendingTripsByRoute.length ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {pendingTripsByRoute.map(({ routeId, route, trips }) => (
                <div key={routeId} className="rounded-2xl border border-amber-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{route?.routeCode || trips[0]?.routeCode} · {route?.routeName || trips[0]?.routeName}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {trips.length} lượt · {toDateInput(trips[0]?.serviceDate)}{toDateInput(trips.at(-1)?.serviceDate) !== toDateInput(trips[0]?.serviceDate) ? ` đến ${toDateInput(trips.at(-1)?.serviceDate)}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const params = new URLSearchParams({
                          routeId,
                          startDate: toDateInput(trips[0]?.serviceDate),
                          endDate: toDateInput(trips.at(-1)?.serviceDate),
                          tripIds: trips.map((trip) => getId(trip)).join(','),
                        });
                        navigate(`/admin/shifts/auto-generate?${params.toString()}`);
                      }}
                      className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white"
                    >
                      Phân ca ngay
                    </button>
                  </div>
                  <div className="mt-3 max-h-32 overflow-y-auto rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    {trips.map((trip) => (
                      <div key={getId(trip)} className="flex justify-between gap-3 border-b border-slate-200 py-1.5 last:border-0">
                        <strong>{trip.scheduleCode}</strong>
                        <span>{trip.departureTime}–{trip.expectedArrivalTime}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">Không có chuyến nào đang chờ phân ca trong khoảng ngày đã chọn.</p>
          )}
        </section> : null}

        {activeView === 'REMOVED' && operatingOverview ? (
          <section className="space-y-4 rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-xl font-black">Độ phủ vận hành theo tuyến · {operatingOverview.date}</h2>
              <p className="mt-1 text-sm text-slate-500">Số liệu được tính từ cấu hình nhu cầu, ca và phân công thật trong hệ thống.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              {[
                ['Tuyến hoạt động', operatingOverview.totalRoutes],
                ['Tuyến đủ lịch', operatingOverview.fullyScheduledRoutes],
                ['Tuyến chưa đủ', operatingOverview.partiallyScheduledRoutes + operatingOverview.unscheduledRoutes],
                ['Thiếu tài xế', operatingOverview.missingDriverCount],
                ['Thiếu phụ xe', operatingOverview.missingAssistantCount],
                ['Thiếu xe', operatingOverview.missingVehicleCount],
                ['Tài xế thiếu giờ', operatingOverview.underHoursDriverCount],
                ['Xung đột', operatingOverview.conflictCount],
              ].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>)}
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500"><tr><th className="px-4 py-3">Tuyến</th>{['05:30-09:00', '09:00-12:30', '12:30-16:00', '16:00-18:30'].map((slot) => <th key={slot} className="px-4 py-3">{slot}</th>)}<th className="px-4 py-3">Trạng thái</th></tr></thead>
                <tbody>{operatingOverview.routes.map((route) => {
                  const windows = [['05:30', '09:00'], ['09:00', '12:30'], ['12:30', '16:00'], ['16:00', '18:30']];
                  const labelFor = (slot) => !slot ? 'Chưa lập kế hoạch chuyến' : slot.status === 'FULLY_SCHEDULED' ? 'Đã đủ nguồn lực' : slot.status === 'CONFLICT' ? 'Xung đột lịch' : slot.assigned.drivers < slot.required.drivers ? `Thiếu ${slot.required.drivers - slot.assigned.drivers} tài xế` : slot.plannedTrips < slot.requiredTrips ? `Thiếu ${slot.requiredTrips - slot.plannedTrips} chuyến` : 'Chưa đủ nguồn lực';
                  return <tr key={route.routeId} className="border-t border-slate-100"><td className="px-4 py-4 font-black">{route.routeCode}<small className="block font-normal text-slate-500">{route.routeName}</small></td>{windows.map(([startTime, endTime]) => { const slot = route.slots.find((item) => item.startTime < endTime && item.endTime > startTime); return <td key={startTime} className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${slot?.status === 'FULLY_SCHEDULED' ? 'bg-emerald-100 text-emerald-800' : slot?.status === 'CONFLICT' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>{labelFor(slot)}</span></td>; })}<td className="px-4 py-4 font-black">{routeSchedulingLabels[route.status] || 'Cần kiểm tra'}</td></tr>;
                })}</tbody>
              </table>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <div className="border-b border-slate-200 p-4"><h3 className="font-black">Timeline tài xế trong ngày</h3><p className="text-xs text-slate-500">Thời lượng, tuyến đang làm và các khoảng còn trống.</p></div>
              <table className="min-w-[980px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs font-black uppercase text-slate-500"><tr>{['Tài xế', 'Ngày / tuần', '05:30-09:00', '09:00-12:30', '12:30-16:00', '16:00-18:30', 'Trạng thái'].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody>{operatingOverview.driverWorkloads.map((driver) => { const windows = [['05:30', '09:00'], ['09:00', '12:30'], ['12:30', '16:00'], ['16:00', '18:30']]; return <tr key={driver.driverId} className="border-t border-slate-100"><td className="px-4 py-3 font-black">{driver.name}<small className="block font-normal text-slate-500">{driver.consecutiveWorkingDays} ngày liên tiếp</small></td><td className="px-4 py-3">{formatMinutes(driver.assignedMinutes)}/8h<small className="block text-slate-500">{formatMinutes(driver.assignedWeeklyMinutes)}/40h</small></td>{windows.map(([start, end]) => { const assignment = driver.assignments.find((item) => item.startTime < end && item.endTime > start); const route = assignment ? routeById.get(getId(assignment.routeId)) : null; return <td key={start} className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${assignment ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>{assignment ? route?.routeCode || 'Đã phân ca' : 'Đang rảnh'}</span></td>; })}<td className="px-4 py-3 font-black">{workloadLabels[driver.status] || 'Cần kiểm tra'}</td></tr>; })}</tbody></table>
            </div>
          </section>
        ) : null}

        {activeView === 'REMOVED' ? <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black">Tình trạng phân lịch tuyến và ca</h2>
                <p className="text-sm text-slate-500">Theo dõi độ phủ nhân sự trong khoảng ngày đang chọn.</p>
              </div>
              <select value={coverageFilter} onChange={(event) => setCoverageFilter(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold">
                <option value="ALL">Tất cả trạng thái</option>
                <option value="FULL">Đã phân đủ</option>
                <option value="PARTIAL">Còn thiếu nhân sự</option>
                <option value="NONE">Chưa phân lịch</option>
              </select>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {visibleRouteCoverage.length ? visibleRouteCoverage.map((item) => (
                <div key={item.routeId} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{item.route?.routeName || item.route?.name || item.route?.routeCode || (item.routeId === 'UNASSIGNED' ? 'Ca chưa gắn tuyến' : `Tuyến ${item.routeId.slice(-6)}`)}</p>
                      <p className="mt-1 text-xs text-slate-500">Cần {item.total} tài xế và {item.total} phụ xe</p>
                      <p className="mt-1 text-xs font-bold text-slate-600">Đã phân: {item.driverCount} tài xế · {item.assistantCount} phụ xe</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${coverageClass[item.status]}`}>{coverageLabel[item.status]}</span>
                  </div>
                </div>
              )) : <p className="text-sm text-slate-500">Chưa có ca để đánh giá.</p>}
            </div>
          </section>

          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <div className="flex items-center gap-3 text-amber-900"><AlertTriangle size={22} /><h2 className="text-xl font-black">Cảnh báo điều phối</h2></div>
            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
              {staffingWarnings.length ? staffingWarnings.map((warning) => (
                <p key={warning.key} className="rounded-xl border border-amber-100 bg-white px-4 py-3 text-sm font-semibold text-amber-900">{warning.text}</p>
              )) : <p className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-emerald-700">Không phát hiện thiếu người hoặc xung đột lịch.</p>}
            </div>
          </section>
        </div> : null}

        {SHOW_SEPARATE_WORKLOAD_TAB && activeView === 'WORKLOAD' ? <section className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50"><Clock3 className="text-emerald-700" size={19} /></span><div><h2 className="text-lg font-black">Giờ làm và hiệu suất nhân sự</h2><p className="text-xs text-slate-500">Theo dõi tổng giờ trong kỳ đã chọn; mục tiêu 8 giờ cho mỗi ngày làm việc.</p></div></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-[11px] font-black uppercase text-slate-500">Tổng nhân sự</p><p className="mt-0.5 text-xl font-black">{staffWorkloads.length}</p></div>
            <div className="rounded-xl bg-emerald-50 px-4 py-3"><p className="text-[11px] font-black uppercase text-emerald-700">Đã đạt mục tiêu</p><p className="mt-0.5 text-xl font-black text-emerald-900">{staffWorkloads.filter((item) => item.totalMinutes >= workloadTargetMinutes).length}</p></div>
            <div className="rounded-xl bg-amber-50 px-4 py-3"><p className="text-[11px] font-black uppercase text-amber-700">Cần bổ sung giờ</p><p className="mt-0.5 text-xl font-black text-amber-900">{staffWorkloads.filter((item) => item.totalMinutes < workloadTargetMinutes).length}</p></div>
          </div>
          <div className="mt-4 max-h-[430px] overflow-auto rounded-xl border border-slate-200">
            <div className="sticky top-0 z-10 grid min-w-[760px] grid-cols-[1.5fr_0.8fr_0.8fr_1.2fr] bg-slate-50 px-4 py-2.5 text-[11px] font-black uppercase text-slate-500"><span>Nhân viên</span><span>Vai trò</span><span>Số ca</span><span>Thời lượng / đánh giá</span></div>
            {staffWorkloads.map((item) => {
              const percent = Math.min(100, Math.round((item.totalMinutes / workloadTargetMinutes) * 100));
              const completed = item.totalMinutes >= workloadTargetMinutes;
              return <div key={`${item.role}-${getId(item.person)}`} className="grid min-w-[760px] grid-cols-[1.5fr_0.8fr_0.8fr_1.2fr] items-center border-t border-slate-100 px-4 py-3 text-sm hover:bg-emerald-50/40">
                <span className="font-black">{getStaffName(item.person)}</span>
                <span>{item.role === 'driver' ? 'Tài xế' : 'Phụ xe'}</span>
                <span>{item.items.length} ca</span>
                <span><b className={completed ? 'text-emerald-700' : 'text-amber-700'}>{formatMinutes(item.totalMinutes)} / {formatMinutes(workloadTargetMinutes)}</b><span className="mt-2 block h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} /></span><small className={`mt-1 block font-bold ${completed ? 'text-emerald-700' : 'text-amber-700'}`}>{completed ? 'Đã đủ giờ' : `Chưa đủ giờ · ${percent}%`}</small></span>
              </div>;
            })}
          </div>
        </section> : null}

        {activeView === 'ASSIGN' ? (
          <div className="space-y-6">
            <section className="rounded-3xl border border-emerald-100 bg-white p-3 shadow-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <button type="button" onClick={() => setAssignmentMode('AUTO')} className={`rounded-2xl border p-4 text-left transition ${assignmentMode === 'AUTO' ? 'border-emerald-400 bg-emerald-50 text-emerald-950' : 'border-slate-200 bg-white text-slate-600'}`}>
                  <span className="flex items-center gap-2 font-black"><Wand2 size={20} /> Gợi ý và sinh ca tự động</span>
                  <span className="mt-1 block text-sm">Phù hợp khi cần bố trí đủ tổ vận hành và cân bằng giờ làm.</span>
                </button>
                <button type="button" onClick={() => setAssignmentMode('MANUAL')} className={`rounded-2xl border p-4 text-left transition ${assignmentMode === 'MANUAL' ? 'border-emerald-400 bg-emerald-50 text-emerald-950' : 'border-slate-200 bg-white text-slate-600'}`}>
                  <span className="flex items-center gap-2 font-black"><UserRoundCheck size={20} /> Tạo ca thủ công</span>
                  <span className="mt-1 block text-sm">Dùng khi điều chỉnh ngoại lệ hoặc chọn trực tiếp một nhân viên.</span>
                </button>
              </div>
            </section>
            <div className="grid gap-6">
            {assignmentMode === 'MANUAL' ? <form onSubmit={handleCreateManual} className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <UserRoundCheck className="text-emerald-700" size={24} />
                <div>
                  <h2 className="text-xl font-black">Tạo ca cho nhân sự</h2>
                  <p className="text-sm text-slate-500">Chọn tài xế hoặc phụ xe và tạo ca làm trong ngày hay khoảng ngày đã chọn.</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Chế độ áp dụng</span>
                  <select value={form.applyMode} onChange={(event) => setForm((prev) => ({ ...prev, applyMode: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold">
                    <option value="DAY">Một ngày</option>
                    <option value="RANGE">Khoảng ngày</option>
                    <option value="WEEKLY">Lặp theo thứ</option>
                  </select>
                </label>
                {form.applyMode !== 'DAY' ? (
                  <div className="space-y-2 md:col-span-2">
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Ngày trong tuần</span>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {weekDays.map((day) => (
                        <label key={day.key} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">
                          <input
                            type="checkbox"
                            checked={form.selectedWeekdays.includes(day.key)}
                            onChange={(event) => setForm((prev) => ({
                              ...prev,
                              selectedWeekdays: event.target.checked
                                ? Array.from(new Set([...prev.selectedWeekdays, day.key]))
                                : prev.selectedWeekdays.filter((value) => value !== day.key),
                            }))}
                          />
                          {day.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Giờ bắt đầu</span>
                  <input type="time" min={OPERATING_START} max={OPERATING_END} value={form.startTime} onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Giờ kết thúc</span>
                  <input type="time" min={OPERATING_START} max={OPERATING_END} value={form.endTime} onChange={(event) => setForm((prev) => ({ ...prev, endTime: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Loại ca</span>
                  <select value={form.shiftType} onChange={(event) => {
                    const shiftType = event.target.value;
                    const template = manualShiftTemplates[shiftType];
                    setForm((prev) => ({
                      ...prev,
                      shiftType,
                      startTime: template?.startTime || prev.startTime,
                      endTime: template?.endTime || prev.endTime,
                    }));
                  }} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold">
                    <option value="MORNING">Ca sáng</option>
                    <option value="AFTERNOON">Ca chiều</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Ghi chú</span>
                  <input value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Ví dụ: đổi tài xế theo kế hoạch ngày" className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Tài xế</span>
                  <select value={form.driverId} onChange={(event) => setForm((prev) => ({ ...prev, driverId: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold">
                    <option value="">Chưa gán tài xế</option>
                    {eligibleManualDrivers.map((driver) => <option key={driver._id} value={driver._id}>{getStaffName(driver)} · {driver.score}% phù hợp · {formatMinutes(driver.assignedMinutes || 0)}/8h</option>)}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Phụ xe</span>
                  <select value={form.assistantId} onChange={(event) => setForm((prev) => ({ ...prev, assistantId: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold">
                    <option value="">Chưa gán phụ xe</option>
                    {staff.assistants.map((assistant) => <option key={assistant._id} value={assistant._id}>{getStaffName(assistant)}</option>)}
                  </select>
                </label>
              </div>

              <button disabled={submitting || Boolean(dateRangeError)} type="submit" className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white disabled:opacity-60">
                <Save size={18} /> Kiểm tra và tạo lịch nháp
              </button>
              {manualPreviewRows.length ? (
                <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-black">Lịch nháp cần kiểm tra</p>
                      <p className="text-sm text-slate-600">{manualPreviewRows.length} ca sẽ được lưu ở trạng thái DRAFT.</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" disabled={submitting} onClick={() => setManualPreviewRows([])} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black">Hủy nháp</button>
                      <button type="button" disabled={submitting} onClick={handleSaveManualDrafts} className="h-10 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white">Lưu lịch nháp</button>
                    </div>
                  </div>
                  <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-amber-100 bg-white">
                    {manualPreviewRows.map((row) => (
                      <div key={row.previewId} className="grid gap-2 border-t border-amber-100 p-3 text-sm md:grid-cols-[0.8fr_1fr_1fr_1fr_1.2fr]">
                        <span className="font-black">{formatDate(row.workDate)}</span>
                        <span>{row.startTime} - {row.endTime}</span>
                        <span>{row.driverId ? getStaffName(staff.drivers.find((driver) => getId(driver) === row.driverId)) : 'Chưa gán tài xế'}</span>
                        <span>{row.assistantId ? getStaffName(staff.assistants.find((assistant) => getId(assistant) === row.assistantId)) : 'Chưa gán phụ xe'}</span>
                        <span className={row.warnings.length ? 'font-bold text-amber-700' : 'font-bold text-emerald-700'}><b className="block">{row.coverageImpact}</b><small>{row.warnings.length ? row.warnings.join(', ') : 'Hợp lệ'}</small></span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </form> : null}

            {assignmentMode === 'AUTO' ? <div className="rounded-3xl border border-emerald-100 bg-white p-6 text-[#05231a] shadow-sm">
              <div className="flex items-center gap-3">
                <Wand2 className="text-emerald-700" size={25} />
                <div>
                  <h2 className="text-xl font-black">Sinh lịch phân ca tự động</h2>
                  <p className="text-sm text-slate-500">Chọn danh sách tài xế, phụ xe; hệ thống ghép nhân sự và tạo ca sáng/chiều không trùng lịch.</p>
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
                <b>Mỗi ca hiện kéo dài 6,5 giờ.</b>
                <span className="ml-1">Ca sáng từ 05:30–12:00 và ca chiều từ 12:00–18:30. Một người không thể nhận cả hai ca cùng ngày vì sẽ thành 13 giờ, vượt giới hạn 8 giờ/ngày và không đủ 10 giờ nghỉ tối thiểu.</span>
              </div>
              <div className="mt-6 grid gap-3">
                {shiftTemplates.map((template) => (
                  <div key={template.key} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="font-black">{template.label}</p>
                    <p className="mt-1 text-sm text-slate-600">{template.startTime} - {template.endTime}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black">Tài xế đủ điều kiện</p>
                      <p className="text-xs text-slate-500">{autoSelection.driverIds.length}/{availableDrivers.length} người được chọn</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-black">
                      <input
                        type="checkbox"
                        checked={availableDrivers.length > 0 && autoSelection.driverIds.length === availableDrivers.length}
                        onChange={(event) => setAllAutoStaff('driver', event.target.checked)}
                      />
                      Tất cả
                    </label>
                  </div>
                  <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
                    {!availableDrivers.length ? (
                      <p className="rounded-xl bg-white px-3 py-2 text-sm text-slate-600"><b className="block text-slate-800">Không có tài xế đủ điều kiện nhận thêm ca.</b>Tài xế đã có ca sáng sẽ không thể nhận tiếp ca chiều cùng ngày. Hãy chuyển ca trong “Lịch tuần”, chọn ngày khác hoặc bổ sung tài xế đang nghỉ cả ngày.</p>
                    ) : null}
                    {availableDrivers.map((driver) => {
                      const priority = staffPriority.driver.get(getId(driver));
                      return <label key={driver._id} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={autoSelection.driverIds.includes(getId(driver))}
                          onChange={() => toggleAutoStaff('driver', getId(driver))}
                        />
                        <span><b className="block">{getStaffName(driver)}{priority ? ` · ${priority.score || 0}% phù hợp ca` : ''}</b><small className="text-slate-500">{priority?.reasons?.join(' · ') || 'Hiện chưa có nhu cầu ca cần bổ sung'}</small></span>
                      </label>;
                    })}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black">Phụ xe đủ điều kiện</p>
                      <p className="text-xs text-slate-500">{autoSelection.assistantIds.length}/{availableAssistants.length} người được chọn</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-black">
                      <input
                        type="checkbox"
                        checked={availableAssistants.length > 0 && autoSelection.assistantIds.length === availableAssistants.length}
                        onChange={(event) => setAllAutoStaff('assistant', event.target.checked)}
                      />
                      Tất cả
                    </label>
                  </div>
                  <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
                    {!availableAssistants.length ? (
                      <p className="rounded-xl bg-white px-3 py-2 text-sm text-slate-500">Không còn phụ xe rảnh trong khoảng ngày này.</p>
                    ) : null}
                    {availableAssistants.map((assistant) => {
                      const priority = staffPriority.assistant.get(getId(assistant));
                      return <label key={assistant._id} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={autoSelection.assistantIds.includes(getId(assistant))}
                          onChange={() => toggleAutoStaff('assistant', getId(assistant))}
                        />
                        <span><b className="block">{getStaffName(assistant)}{priority ? ` · ${priority.score || 0}% phù hợp ca` : ''}</b><small className="text-slate-500">{priority?.reasons?.join(' · ') || 'Hiện chưa có nhu cầu ca cần bổ sung'}</small></span>
                      </label>;
                    })}
                  </div>
                </div>
              </div>
              <button disabled={submitting || Boolean(dateRangeError)} type="button" onClick={handleAutoGenerate} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white disabled:opacity-60">
                <Wand2 size={18} /> Sinh ca tự động cho nhân sự đã chọn
              </button>
              {message ? <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">{message}</p> : null}
            </div> : null}
          </div>
          </div>
        ) : null}

        {SHOW_LEGACY_SHIFT_LIST && activeView === 'WORKLOAD' ? (
          <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-black">Lịch ca làm</h2>
                <p className="text-xs text-slate-500">Xem và điều chỉnh ca trong khoảng ngày đã chọn.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {loading ? <span className="text-sm font-bold text-emerald-700">Đang tải...</span> : null}
                <button type="button" disabled={submitting || Boolean(dateRangeError) || !dateRange.length} onClick={handleCancelShiftsInRange} className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-200 px-3 text-xs font-black text-rose-600 disabled:cursor-not-allowed disabled:opacity-50">
                  <Trash2 size={17} /> Hủy ca trong khoảng ngày
                </button>
              </div>
            </div>

            <div className="mt-4 max-h-[520px] overflow-auto rounded-xl border border-slate-200">
              <div className="sticky top-0 z-20 flex flex-wrap gap-1.5 border-b border-slate-200 bg-white p-2.5">{[['ALL', 'Tất cả'], ['DRAFT', 'Nháp'], ['MISSING', 'Thiếu nhân sự'], ['READY', 'Sẵn sàng'], ['CONFIRMED', 'Đã xác nhận'], ['IN_PROGRESS', 'Đang chạy'], ['COMPLETED', 'Hoàn thành'], ['CANCELLED', 'Đã hủy']].map(([value, label]) => <button key={value} type="button" onClick={() => setShiftStatusFilter(value)} className={`rounded-full px-3 py-1.5 text-[11px] font-black ${shiftStatusFilter === value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{label}</button>)}</div>
              <div className="grid min-w-[880px] grid-cols-[0.8fr_1.2fr_1.4fr_0.8fr_0.9fr_110px] bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                <span>Ngày</span>
                <span>Ca</span>
                <span>Nhân viên</span>
                <span>Vai trò</span>
                <span>Trạng thái</span>
                <span>Thao tác</span>
              </div>
              {individualShiftRows.length ? individualShiftRows.map(({ key, shift, person, role }) => {
                return (
                  <div key={key} className="grid min-w-[880px] grid-cols-[0.8fr_1.2fr_1.4fr_0.8fr_0.9fr_110px] items-center border-t border-slate-100 px-4 py-3 text-sm hover:bg-emerald-50/40">
                    <span className="font-bold">{formatDate(shift.workDate)}</span>
                    <span>
                      <b>{shift.startTime} - {shift.endTime}</b>
                      <small className="mt-1 block text-slate-500">{shift.shiftName}</small>
                    </span>
                    <span className="font-semibold">{getStaffName(person)}</span>
                    <span className="font-semibold">{role}</span>
                    <span><span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass[shift.status] || statusClass.ACTIVE}`}>{statusLabel[shift.status] || shift.status}</span></span>
                    <span className="flex gap-2">
                      <button type="button" onClick={() => openEdit(shift)} className="rounded-xl border border-slate-200 p-2 text-emerald-700"><Edit3 size={17} /></button>
                      <button type="button" onClick={() => handleCancelShift(shift)} className="rounded-xl border border-rose-200 p-2 text-rose-600"><Trash2 size={17} /></button>
                    </span>
                  </div>
                );
              }) : (
                <div className="px-4 py-14 text-center text-sm text-slate-500">Chưa có ca làm trong khoảng ngày này.</div>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {selectedShift && editForm ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4">
          <form onSubmit={handleUpdateShift} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 text-[#05231a] shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-700">Điều chỉnh ca</p>
                <h3 className="mt-2 text-2xl font-black">{formatDate(selectedShift.workDate)} · {selectedShift.startTime}-{selectedShift.endTime}</h3>
                <p className="mt-1 text-sm text-slate-500">Đổi nhân sự sẽ tự hủy phân công cũ và ghi phân công mới nếu người được chọn còn rảnh.</p>
              </div>
              <button type="button" onClick={() => { setSelectedShift(null); setEditForm(null); }} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black">Đóng</button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Giờ bắt đầu</span>
                <input type="time" min={OPERATING_START} max={OPERATING_END} value={editForm.startTime} onChange={(event) => setEditForm((prev) => ({ ...prev, startTime: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold" />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Giờ kết thúc</span>
                <input type="time" min={OPERATING_START} max={OPERATING_END} value={editForm.endTime} onChange={(event) => setEditForm((prev) => ({ ...prev, endTime: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold" />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Tài xế</span>
                <select value={editForm.driverId} onChange={(event) => setEditForm((prev) => ({ ...prev, driverId: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold">
                  <option value="">Chưa gán tài xế</option>
                  {(eligibleEditDrivers.length ? eligibleEditDrivers : editAvailableDrivers).map((driver) => {
                    const workload = driverWorkloads.find((item) => getId(item.driver) === getId(driver));
                    return <option key={driver._id} value={driver._id}>{getStaffName(driver)} · {formatMinutes(workload?.totalMinutes || 0)} đã phân · đủ nghỉ</option>;
                  })}
                </select>
                {!eligibleEditDrivers.length && !editAvailableDrivers.length ? (
                  <span className="block text-xs font-semibold text-amber-600">Không có tài xế rảnh có thể áp vào ca này.</span>
                ) : null}
              </label>
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Phụ xe</span>
                <select value={editForm.assistantId} onChange={(event) => setEditForm((prev) => ({ ...prev, assistantId: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold">
                  <option value="">Chưa gán phụ xe</option>
                  {editAvailableAssistants.map((assistant) => <option key={assistant._id} value={assistant._id}>{getStaffName(assistant)}</option>)}
                </select>
                {!editAvailableAssistants.length ? (
                  <span className="block text-xs font-semibold text-amber-600">Không có phụ xe rảnh có thể áp vào ca này.</span>
                ) : null}
              </label>
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Trạng thái</span>
                <select value={editForm.status} onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold">
                  <option value="DRAFT">Bản nháp</option>
                  <option value="PENDING_APPROVAL">Chờ duyệt</option>
                  <option value="APPROVED">Đã duyệt</option>
                  <option value="PUBLISHED">Đã công bố</option>
                  <option value="ACTIVE">Đang hiệu lực</option>
                  <option value="INACTIVE">Tạm ngưng</option>
                  <option value="ABSENT">Vắng mặt</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Loại ca</span>
                <select value={editForm.shiftType} onChange={(event) => setEditForm((prev) => ({ ...prev, shiftType: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold">
                  <option value="MORNING">Ca sáng</option>
                  <option value="AFTERNOON">Ca chiều</option>
                </select>
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Ghi chú</span>
                <textarea value={editForm.description} onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))} rows={3} className="w-full rounded-xl border border-slate-200 px-4 py-3 font-bold" />
              </label>
            </div>

            <div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm">
              <p className="font-black">Phân công hiện tại</p>
              <p className="mt-1">Tài xế: {getStaffName(assignmentStaff(selectedAssignments.driver, 'driver'))}</p>
              <p>Phụ xe: {getStaffName(assignmentStaff(selectedAssignments.assistant, 'assistant'))}</p>
            </div>

            <div className="mt-6 flex flex-col gap-3 md:flex-row">
              <button disabled={submitting} type="submit" className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white disabled:opacity-60">
                <CheckCircle2 size={18} /> Lưu điều chỉnh
              </button>
              <button disabled={submitting} type="button" onClick={() => handleCancelShift(selectedShift)} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 px-5 text-sm font-black text-rose-600 disabled:opacity-60">
                <Trash2 size={18} /> Hủy ca này
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {cancelRequest ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-[#05231a] shadow-2xl">
            <div className="flex items-center gap-3 text-rose-700"><AlertTriangle size={24} /><h3 className="text-xl font-black">Xác nhận hủy ca</h3></div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{cancelRequest.message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setCancelRequest(null)} className="h-11 rounded-xl border border-slate-200 px-5 font-black">Giữ lại</button>
              <button type="button" disabled={submitting} onClick={() => cancelRequest.type === 'SHIFT' ? handleCancelShift(cancelRequest.shift, true) : handleCancelShiftsInRange(true)} className="h-11 rounded-xl bg-rose-600 px-5 font-black text-white disabled:opacity-50">Xác nhận hủy</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ShiftAssignmentManagementPage;


