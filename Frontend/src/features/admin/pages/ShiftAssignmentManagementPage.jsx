import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
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
import OperationalPlanningPage from './OperationalPlanningPage.jsx';

const OPERATING_START = '05:30';
const OPERATING_END = '18:30';
const MAX_DAYS = 31;
const MAX_WORK_MINUTES_PER_DAY = 8 * 60;
const TARGET_WORK_MINUTES_PER_DAY = 8 * 60;
const TARGET_WORK_MINUTES_PER_WEEK = 40 * 60;
const MIN_REST_MINUTES = 60;

const shiftTemplates = [
  { key: 'MORNING', label: 'Ca sáng', startTime: '05:30', endTime: '13:30', shiftType: 'MORNING' },
  { key: 'AFTERNOON', label: 'Ca chiều', startTime: '10:30', endTime: '18:30', shiftType: 'AFTERNOON' },
];

const manualShiftTemplates = {
  MORNING: { label: 'Ca sáng', startTime: '05:30', endTime: '13:30' },
  AFTERNOON: { label: 'Ca chiều', startTime: '10:30', endTime: '18:30' },
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

const defaultDemandSlots = [
  { startTime: '05:30', endTime: '09:00', frequencyMinutes: 15, requiredVehicles: 1, requiredDrivers: 1, requiredAssistants: 1, demandLevel: 'HIGH' },
  { startTime: '09:00', endTime: '12:30', frequencyMinutes: 20, requiredVehicles: 1, requiredDrivers: 1, requiredAssistants: 1, demandLevel: 'MEDIUM' },
  { startTime: '12:30', endTime: '16:00', frequencyMinutes: 20, requiredVehicles: 1, requiredDrivers: 1, requiredAssistants: 1, demandLevel: 'MEDIUM' },
  { startTime: '16:00', endTime: '18:30', frequencyMinutes: 10, requiredVehicles: 2, requiredDrivers: 2, requiredAssistants: 2, demandLevel: 'VERY_HIGH' },
];

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

const coverageLabel = { FULL: 'Đã phân đủ', PARTIAL: 'Còn thiếu nhân sự', NONE: 'Chưa phân lịch' };
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
  const [activeView, setActiveView] = useState('ASSIGN');
  const [fromDate, setFromDate] = useState(todayInput());
  const [toDate, setToDate] = useState(todayInput());
  const [rangeRefreshKey, setRangeRefreshKey] = useState(0);
  const [form, setForm] = useState({
    applyMode: 'DAY',
    startTime: OPERATING_START,
    endTime: '13:30',
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
  const [assignmentMap, setAssignmentMap] = useState({});
  const [selectedShift, setSelectedShift] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [coverageFilter, setCoverageFilter] = useState('ALL');
  const [shiftStatusFilter, setShiftStatusFilter] = useState('ALL');
  const [operatingOverview, setOperatingOverview] = useState(null);
  const [demandRouteId, setDemandRouteId] = useState('');
  const [demandSlots, setDemandSlots] = useState(defaultDemandSlots);
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

  const loadDemandConfig = useCallback(async (routeId) => {
    setDemandRouteId(routeId);
    if (!routeId || !fromDate) return setDemandSlots(defaultDemandSlots);
    try {
      const response = await adminService.getRouteOperatingConfigs({ routeId, date: fromDate });
      setDemandSlots(response.configs?.length ? response.configs.map((item) => ({
        startTime: item.startTime, endTime: item.endTime, frequencyMinutes: item.frequencyMinutes,
        requiredVehicles: item.requiredVehicles, requiredDrivers: item.requiredDrivers,
        requiredAssistants: item.requiredAssistants, demandLevel: item.demandLevel,
      })) : defaultDemandSlots);
    } catch (error) { toast.error(error?.message || 'Không thể tải nhu cầu tuyến.'); }
  }, [fromDate]);

  const saveDemandConfig = async () => {
    if (!demandRouteId) return toast.error('Hãy chọn tuyến cần cấu hình.');
    setSubmitting(true);
    try {
      await adminService.saveRouteOperatingConfigs({ routeId: demandRouteId, effectiveDate: fromDate, slots: demandSlots });
      toast.success('Đã lưu nhu cầu vận hành riêng của tuyến.');
      await loadOperatingOverview();
    } catch (error) { toast.error(error?.message || 'Không thể lưu nhu cầu tuyến.'); }
    finally { setSubmitting(false); }
  };

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
    const rows = targetDates.map((workDate, index) => ({
      previewId: `${workDate}-${form.shiftType}-${form.startTime}-${form.endTime}-${index}`,
      workDate,
      startTime: form.startTime,
      endTime: form.endTime,
      shiftType: form.shiftType,
      routeId: form.routeId,
      shiftName: makeShiftName(form),
      driverId: form.driverId,
      assistantId: form.assistantId,
      vehicleId: form.vehicleId,
      requiresAssistant: Boolean(form.assistantId),
      description: form.description || 'Ca được tạo từ màn hình phân công ca thủ công.',
      warnings: [
        standardTimeChanged ? 'Giờ ca chuẩn đã được điều chỉnh' : '',
      ].filter(Boolean),
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
      await loadShifts();
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
    const assignedMinutes = (person, role) => shifts.reduce((total, shift) => {
      const assignment = (assignmentMap[getId(shift)] || {})[role];
      return getId(assignmentStaff(assignment, role)) === getId(person) ? total + getShiftDurationMinutes(shift) : total;
    }, 0);
    const pick = (items, role, count) => [...items]
      .sort((left, right) => assignedMinutes(left, role) - assignedMinutes(right, role) || getStaffName(left).localeCompare(getStaffName(right), 'vi'))
      .slice(0, count)
      .map(getId);
    setAutoSelection({
      driverIds: pick(availableDrivers, 'driver', recommendedMissing.drivers),
      assistantIds: pick(availableAssistants, 'assistant', recommendedMissing.assistants),
    });
    toast.success('Đã chọn số nhân sự còn thiếu theo nhu cầu chuyến.');
  };

  const handleAutoGenerate = async () => {
    if (dateRangeError) return toast.error(dateRangeError);
    if (!dateRange.length) return toast.error('Khoảng ngày không hợp lệ.');
    if (!autoSelection.driverIds.length && !autoSelection.assistantIds.length) {
      return toast.error('Vui lòng chọn ít nhất một tài xế hoặc phụ xe.');
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
          const demand = staffingDemand.find((item) => item.shiftType === template.shiftType);
          const buildQueue = (items, role, limit) => items
            .filter((item) => canUseStaff(getId(item), role, workDate, template))
            .slice(0, Math.max(0, limit));

          const availableDriverQueue = buildQueue(selectedDrivers, 'driver', demand?.missingDrivers || 0);
          const availableAssistantQueue = buildQueue(selectedAssistants, 'assistant', demand?.missingAssistants || 0);
          const pairCount = Math.max(availableDriverQueue.length, availableAssistantQueue.length);
          totalCandidateRows += pairCount;

          for (let staffIndex = 0; staffIndex < pairCount; staffIndex += 1) {
            const driver = availableDriverQueue[staffIndex];
            const assistant = availableAssistantQueue[staffIndex];
            const driverId = getId(driver);
            const assistantId = getId(assistant);

            if (!driverId && !assistantId) {
              skippedRows.push({
                reason: 'Nhân sự đã kín ca hoặc vượt 8 giờ trong ngày.',
                workDate,
                driver: driver ? getStaffName(driver) : null,
                assistant: assistant ? getStaffName(assistant) : null,
                shift: template.label,
              });
              continue;
            }

            const { shift, created } = await createOrReuseShift({
              shiftCode: buildAutoShiftCode({ workDate, templateKey: template.key, driverId, assistantId }),
              workDate,
              startTime: template.startTime,
              endTime: template.endTime,
              shiftType: template.shiftType,
              shiftName: `${template.label} ${template.startTime}-${template.endTime} #${staffIndex + 1}`,
              description: 'Ca được hệ thống sinh tự động theo nhân sự đi làm trong ngày.',
              requiresAssistant: Boolean(assistantId),
              status: 'PUBLISHED',
              approvalStatus: 'PUBLISHED',
            });

            let assignedPeople = 0;
            const assignmentErrors = [];

            if (driverId) {
              try {
                await adminService.assignDriverToSelectedShift(shift._id, { driverId });
                assignedPeople += 1;
                markBusy('driver', workDate, driverId, template);
              } catch (error) {
                assignmentErrors.push(error?.message || 'Không thể phân công tài xế.');
              }
            }

            if (assistantId) {
              try {
                await adminService.assignAssistantToSelectedShift(shift._id, { assistantId });
                assignedPeople += 1;
                markBusy('assistant', workDate, assistantId, template);
              } catch (error) {
                assignmentErrors.push(error?.message || 'Không thể phân công phụ xe.');
              }
            }

            if (assignedPeople === Number(Boolean(driverId)) + Number(Boolean(assistantId))) {
              createdRows.push(shift);
              if (assignmentErrors.length) {
                skippedRows.push({ shift, reason: assignmentErrors.join(' ') });
              }
            } else {
              if (created) await adminService.archiveShift(shift._id).catch(() => undefined);
              skippedRows.push({ shift, reason: assignmentErrors.join(' ') || 'Không phân công được nhân sự phù hợp.' });
            }
          }
        }
      }

      if (!createdRows.length) {
        setMessage('Không sinh ca mới vì toàn bộ nhân sự đã có ca hoặc không còn ai rảnh trong khoảng ngày đã chọn.');
        toast('Không có ca mới để sinh.');
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

  const summary = useMemo(() => {
    const assigned = shifts.filter((shift) => {
      const item = assignmentMap[getId(shift)] || {};
      return item.driver || item.assistant;
    }).length;
    return {
      total: shifts.length,
      assigned,
      missing: shifts.length - assigned,
      days: dateRange.length,
    };
  }, [assignmentMap, dateRange.length, shifts]);

  const coverageSummary = useMemo(() => {
    const initial = {
      MORNING: { total: 0, staffed: 0 },
      AFTERNOON: { total: 0, staffed: 0 },
    };
    shifts.forEach((shift) => {
      if (!initial[shift.shiftType]) return;
      const item = assignmentMap[getId(shift)] || {};
      initial[shift.shiftType].total += 1;
      if (item.driver && item.assistant) initial[shift.shiftType].staffed += 1;
    });
    const extraPairs = Math.min(availableDrivers.length, availableAssistants.length);
    return {
      ...initial,
      extraPairs,
      balanced: Math.abs(initial.MORNING.staffed - initial.AFTERNOON.staffed) <= Math.max(1, dateRange.length),
    };
  }, [assignmentMap, availableAssistants.length, availableDrivers.length, dateRange.length, shifts]);

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
  const staffingDemand = useMemo(() => {
    const cycleGroups = new Map();
    pendingTrips.forEach((trip) => {
      const date = toDateInput(trip.serviceDate);
      const cycleKey = trip.operationCycleCode || getId(trip);
      const key = `${date}:${getId(trip.routeId)}:${cycleKey}`;
      const current = cycleGroups.get(key) || { date, starts: [], ends: [], tripCount: 0 };
      current.starts.push(minutesOf(trip.departureTime));
      current.ends.push(minutesOf(trip.expectedArrivalTime));
      current.tripCount += 1;
      cycleGroups.set(key, current);
    });
    const buckets = new Map();
    cycleGroups.forEach((cycle) => {
      const start = Math.min(...cycle.starts.filter(Number.isFinite));
      const end = Math.max(...cycle.ends.filter(Number.isFinite));
      if (!Number.isFinite(start) || !Number.isFinite(end)) return;
      const shiftType = start < minutesOf('12:00') ? 'MORNING' : 'AFTERNOON';
      const key = `${cycle.date}:${shiftType}`;
      const bucket = buckets.get(key) || { date: cycle.date, shiftType, cycles: [], tripCount: 0 };
      bucket.cycles.push({ start, end });
      bucket.tripCount += cycle.tripCount;
      buckets.set(key, bucket);
    });
    const demandFor = (shiftType) => {
      const relevant = [...buckets.values()].filter((bucket) => bucket.shiftType === shiftType);
      const routeGroups = new Map();
      pendingTrips.filter((trip) => {
        const start = minutesOf(trip.departureTime);
        return Number.isFinite(start) && (start < minutesOf('12:00') ? 'MORNING' : 'AFTERNOON') === shiftType;
      }).forEach((trip) => {
        const routeId = getId(trip.routeId) || trip.routeCode || 'UNASSIGNED';
        const current = routeGroups.get(routeId) || {
          routeId,
          routeCode: trip.routeCode || routeById.get(routeId)?.routeCode || 'Chưa có mã',
          routeName: trip.routeName || routeById.get(routeId)?.routeName || 'Chưa có tên tuyến',
          tripCount: 0,
          firstDeparture: trip.departureTime,
          lastArrival: trip.expectedArrivalTime,
        };
        current.tripCount += 1;
        if (String(trip.departureTime) < String(current.firstDeparture)) current.firstDeparture = trip.departureTime;
        if (String(trip.expectedArrivalTime) > String(current.lastArrival)) current.lastArrival = trip.expectedArrivalTime;
        routeGroups.set(routeId, current);
      });
      const days = relevant.map((bucket) => {
        const events = bucket.cycles.flatMap((cycle) => [{ time: cycle.start, delta: 1 }, { time: cycle.end, delta: -1 }])
          .sort((left, right) => left.time - right.time || left.delta - right.delta);
        let concurrent = 0;
        let peak = 0;
        events.forEach((event) => { concurrent += event.delta; peak = Math.max(peak, concurrent); });
        const matchingShifts = shifts.filter((shift) => toDateInput(shift.workDate) === bucket.date && shift.shiftType === shiftType && shift.status !== 'CANCELLED');
        const assignedDrivers = matchingShifts.filter((shift) => assignmentMap[getId(shift)]?.driver).length;
        const assignedAssistants = matchingShifts.filter((shift) => assignmentMap[getId(shift)]?.assistant).length;
        return { ...bucket, required: peak, assignedDrivers, assignedAssistants, missingDrivers: Math.max(0, peak - assignedDrivers), missingAssistants: Math.max(0, peak - assignedAssistants) };
      });
      return {
        shiftType,
        tripCount: days.reduce((total, day) => total + day.tripCount, 0),
        required: Math.max(0, ...days.map((day) => day.required)),
        missingDrivers: Math.max(0, ...days.map((day) => day.missingDrivers)),
        missingAssistants: Math.max(0, ...days.map((day) => day.missingAssistants)),
        routes: [...routeGroups.values()].sort((left, right) => left.routeCode.localeCompare(right.routeCode, 'vi')),
      };
    };
    return [demandFor('MORNING'), demandFor('AFTERNOON')];
  }, [assignmentMap, pendingTrips, routeById, shifts]);
  const recommendedMissing = useMemo(() => staffingDemand.reduce((result, item) => ({
    drivers: result.drivers + item.missingDrivers,
    assistants: result.assistants + item.missingAssistants,
  }), { drivers: 0, assistants: 0 }), [staffingDemand]);
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

  return (
    <div className="min-h-full bg-[#eef9f4] text-[#05231a]">
      <section className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 lg:px-8">
        <div className="rounded-[28px] bg-[#062819] p-6 text-white shadow-2xl shadow-emerald-950/20">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-300">Quản lý ca làm</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black">Phân ca nhân sự</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50/80">
                Tạo và quản lý ca làm cho toàn bộ tài xế, phụ xe trong khoảng 05:30 - 18:30.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { loadShifts(); loadPendingTrips(); loadOperatingOverview(); }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-[#062819]"
            >
              <RefreshCw size={17} /> Tải lại
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-emerald-100 bg-white p-3 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <button type="button" onClick={() => setActiveView('ASSIGN')} className={`rounded-2xl border p-5 text-left transition ${activeView === 'ASSIGN' ? 'border-emerald-300 bg-emerald-100 text-emerald-950 shadow-sm' : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-emerald-200'}`}>
              <span className="flex items-center gap-3"><UserRoundCheck size={22} /><strong className="text-lg">Phân ca nhân sự</strong></span>
              <span className="mt-2 block text-sm">Tạo ca sáng hoặc ca chiều cho tài xế và phụ xe.</span>
            </button>
            <button type="button" onClick={() => setActiveView('WORKLOAD')} className={`rounded-2xl border p-5 text-left transition ${activeView === 'WORKLOAD' ? 'border-emerald-300 bg-emerald-100 text-emerald-950 shadow-sm' : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-emerald-200'}`}>
              <span className="flex items-center gap-3"><Clock3 size={22} /><strong className="text-lg">Ca làm & hiệu suất</strong></span>
              <span className="mt-2 block text-sm">Xem tổng giờ làm theo ngày, tuần hoặc tháng.</span>
            </button>
          </div>
        </div>

        <div className="hidden grid gap-4 md:grid-cols-4">
          {[
            ['Số ngày', summary.days],
            ['Tổng ca', summary.total],
            ['Đã có nhân sự', summary.assigned],
            ['Cần kiểm tra', summary.missing],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">{label}</p>
              <p className="mt-3 text-3xl font-black">{value}</p>
            </div>
          ))}
        </div>

        {activeView === 'REMOVED' ? <div className="grid gap-4 lg:grid-cols-3">
          {[
            ['Ca sáng đủ người', `${coverageSummary.MORNING.staffed}/${coverageSummary.MORNING.total}`],
            ['Ca chiều đủ người', `${coverageSummary.AFTERNOON.staffed}/${coverageSummary.AFTERNOON.total}`],
            ['Có thể tạo thêm', `${coverageSummary.extraPairs} cặp tài xế/phụ xe`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black">{value}</p>
            </div>
          ))}
          <div className={`rounded-2xl border p-5 shadow-sm lg:col-span-3 ${coverageSummary.balanced ? 'border-emerald-100 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
            <p className="font-black">{coverageSummary.balanced ? 'Phân bổ ca đang tương đối cân bằng' : 'Phân bổ ca sáng/chiều đang lệch'}</p>
            <p className="mt-1 text-sm">Chỉ số này kiểm tra độ phủ nhân sự theo ca. Để biết đủ chạy tuyến, cần đối chiếu thêm với số chuyến phát sinh trong “Tuyến và lịch chạy”.</p>
          </div>
        </div> : null}

        <div className="hidden">
          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => setActiveView('LIST')}
              className={`rounded-2xl p-4 text-left transition ${activeView === 'LIST' ? 'bg-emerald-100 text-emerald-950' : 'bg-slate-50 text-slate-600'}`}
            >
              <p className="font-black">Ca làm</p>
              <p className="mt-1 text-sm">Xem toàn bộ ca, đổi người, sửa giờ hoặc hủy ca phát sinh.</p>
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Từ ngày</span>
              <input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Đến ngày</span>
              <input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold" />
            </label>
            <div className="flex items-end gap-2">
              <button type="button" onClick={() => setRangePreset('DAY')} className="h-12 rounded-xl border border-slate-200 px-4 text-sm font-black">Hôm nay</button>
              <button type="button" onClick={() => setRangePreset('WEEK')} className="h-12 rounded-xl border border-slate-200 px-4 text-sm font-black">Tuần này</button>
              <button type="button" onClick={() => setRangePreset('MONTH')} className="h-12 rounded-xl border border-slate-200 px-4 text-sm font-black">Tháng</button>
            </div>
          </div>
          {dateRangeError ? (
            <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {dateRangeError}
            </p>
          ) : null}
        </div>

        {activeView === 'ASSIGN' ? <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="text-xl font-black text-cyan-950">Nhu cầu nhân sự từ kế hoạch chuyến</h2><p className="mt-1 text-sm text-cyan-900/70">Tính theo số vòng D–V chạy đồng thời cao nhất; đã trừ các ca có nhân sự trong khoảng ngày đang chọn.</p></div>
            <button type="button" disabled={!recommendedMissing.drivers && !recommendedMissing.assistants} onClick={selectRecommendedStaff} className="h-11 rounded-xl bg-cyan-700 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Chọn đúng số nhân sự còn thiếu</button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">{staffingDemand.map((item) => {
            const driverShortage = Math.max(0, item.missingDrivers - availableDrivers.length);
            const assistantShortage = Math.max(0, item.missingAssistants - availableAssistants.length);
            return <article key={item.shiftType} className="rounded-2xl border border-cyan-100 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{item.shiftType === 'MORNING' ? 'Ca sáng' : 'Ca chiều'}</p><p className="mt-1 text-sm text-slate-500">{item.tripCount} lượt chạy · cao nhất {item.required} vòng đồng thời</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${item.missingDrivers || item.missingAssistants ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{item.missingDrivers || item.missingAssistants ? 'Cần bổ sung' : 'Đã đủ ca'}</span></div>{item.routes?.length ? <div className="mt-3 space-y-2">{item.routes.map((route) => <div key={route.routeId} className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-sm font-black">{route.routeCode} · {route.routeName}</p><p className="mt-0.5 text-xs text-slate-500">{route.tripCount} lượt · {route.firstDeparture}–{route.lastArrival}</p></div>)}</div> : <p className="mt-3 text-xs text-slate-500">Chưa có chuyến trong ca này.</p>}<p className="mt-3 text-sm font-bold">Còn cần {item.missingDrivers} tài xế và {item.missingAssistants} phụ xe</p>{driverShortage || assistantShortage ? <p className="mt-2 text-xs font-black text-rose-600">Nguồn lực không đủ: thiếu {driverShortage} tài xế và {assistantShortage} phụ xe khả dụng.</p> : null}</article>;
          })}</div>
          {!pendingTrips.length ? <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-500">Chưa có chuyến chờ phân bổ trong khoảng ngày này. Hãy tạo kế hoạch tại mục “Phân chuyến” trước.</p> : null}
        </section> : null}

        {activeView === 'REMOVED' ? <OperationalPlanningPage embedded /> : null}

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

        {activeView === 'WORKLOAD' ? <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><Clock3 className="text-emerald-700" size={22} /><div><h2 className="text-xl font-black">Giờ làm và hiệu suất nhân sự</h2><p className="text-sm text-slate-500">Tổng hợp tài xế và phụ xe trong khoảng ngày đã chọn. Mục tiêu được tính 8 giờ cho mỗi ngày làm việc.</p></div></div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[1.5fr_0.8fr_0.8fr_1.2fr] bg-slate-50 px-4 py-3 text-xs font-black uppercase text-slate-500"><span>Nhân viên</span><span>Vai trò</span><span>Số ca</span><span>Thời lượng / đánh giá</span></div>
            {staffWorkloads.map((item) => {
              const percent = Math.min(100, Math.round((item.totalMinutes / workloadTargetMinutes) * 100));
              const completed = item.totalMinutes >= workloadTargetMinutes;
              return <div key={`${item.role}-${getId(item.person)}`} className="grid grid-cols-[1.5fr_0.8fr_0.8fr_1.2fr] items-center border-t border-slate-100 px-4 py-4 text-sm">
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
            <section className="hidden rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-xl font-black">Nhu cầu vận hành theo tuyến</h2><p className="text-sm text-slate-500">Mỗi tuyến có tần suất và số nguồn lực riêng theo ngày; đây là đầu vào bắt buộc để đánh giá đủ/thiếu.</p></div><label className="min-w-80 space-y-2"><span className="text-xs font-black uppercase text-slate-500">Tuyến</span><select value={demandRouteId} onChange={(event) => loadDemandConfig(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold"><option value="">Chọn tuyến hoạt động</option>{routes.filter((route) => route.status === 'PUBLISHED').map((route) => <option key={route._id} value={route._id}>{route.routeCode} · {route.routeName}</option>)}</select></label></div>
              <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-[900px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs font-black uppercase text-slate-500"><tr>{['Khung giờ', 'Mức nhu cầu', 'Tần suất (phút)', 'Xe', 'Tài xế', 'Phụ xe'].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody>{demandSlots.map((slot, index) => <tr key={`${slot.startTime}-${slot.endTime}`} className="border-t border-slate-100"><td className="px-4 py-3 font-black">{slot.startTime} - {slot.endTime}</td><td className="px-4 py-3"><select value={slot.demandLevel} onChange={(event) => setDemandSlots((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, demandLevel: event.target.value } : item))} className="h-10 rounded-lg border border-slate-200 px-2"><option value="LOW">Thấp</option><option value="MEDIUM">Trung bình</option><option value="HIGH">Cao</option><option value="VERY_HIGH">Rất cao</option></select></td>{['frequencyMinutes', 'requiredVehicles', 'requiredDrivers', 'requiredAssistants'].map((field) => <td key={field} className="px-4 py-3"><input type="number" min={field === 'requiredAssistants' ? 0 : 1} value={slot[field]} onChange={(event) => setDemandSlots((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: Number(event.target.value) } : item))} className="h-10 w-24 rounded-lg border border-slate-200 px-3 font-bold" /></td>)}</tr>)}</tbody></table></div>
              <button type="button" disabled={submitting || !demandRouteId} onClick={saveDemandConfig} className="mt-4 h-11 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white disabled:opacity-50">Lưu nhu cầu tuyến cho ngày {fromDate}</button>
            </section>
            <div className="grid gap-6">
            <form onSubmit={handleCreateManual} className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
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
                        <span className={row.warnings.length ? 'font-bold text-amber-700' : 'font-bold text-emerald-700'}>{row.warnings.length ? row.warnings.join(', ') : 'Hợp lệ'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </form>

            <div className="rounded-3xl border border-emerald-100 bg-white p-6 text-[#05231a] shadow-sm">
              <div className="flex items-center gap-3">
                <Wand2 className="text-emerald-700" size={25} />
                <div>
                  <h2 className="text-xl font-black">Sinh lịch phân ca tự động</h2>
                  <p className="text-sm text-slate-500">Chọn danh sách tài xế, phụ xe; hệ thống ghép nhân sự và tạo ca sáng/chiều không trùng lịch.</p>
                </div>
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
                      <p className="rounded-xl bg-white px-3 py-2 text-sm text-slate-500">Không còn tài xế rảnh trong khoảng ngày này.</p>
                    ) : null}
                    {availableDrivers.map((driver) => (
                      <label key={driver._id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={autoSelection.driverIds.includes(getId(driver))}
                          onChange={() => toggleAutoStaff('driver', getId(driver))}
                        />
                        <span className="font-bold">{getStaffName(driver)}</span>
                      </label>
                    ))}
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
                    {availableAssistants.map((assistant) => (
                      <label key={assistant._id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={autoSelection.assistantIds.includes(getId(assistant))}
                          onChange={() => toggleAutoStaff('assistant', getId(assistant))}
                        />
                        <span className="font-bold">{getStaffName(assistant)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <button disabled={submitting || Boolean(dateRangeError)} type="button" onClick={handleAutoGenerate} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white disabled:opacity-60">
                <Wand2 size={18} /> Sinh ca tự động cho nhân sự đã chọn
              </button>
              {message ? <p className="mt-4 rounded-2xl bg-white/10 p-4 text-sm text-emerald-50">{message}</p> : null}
            </div>
            </div>
          </div>
        ) : null}

        {activeView === 'WORKLOAD' ? (
          <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black">Lịch ca làm toàn hệ thống</h2>
                <p className="text-sm text-slate-500">Admin có thể xem, đổi giờ, đổi tài xế/phụ xe hoặc hủy ca trong ngày/tuần đã chọn.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {loading ? <span className="text-sm font-bold text-emerald-700">Đang tải...</span> : null}
                <button type="button" disabled={submitting || Boolean(dateRangeError) || !dateRange.length} onClick={handleCancelShiftsInRange} className="inline-flex h-11 items-center gap-2 rounded-xl border border-rose-200 px-4 text-sm font-black text-rose-600 disabled:cursor-not-allowed disabled:opacity-50">
                  <Trash2 size={17} /> Hủy ca trong khoảng ngày
                </button>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3">{[['ALL', 'Tất cả'], ['DRAFT', 'Nháp'], ['MISSING', 'Thiếu nhân sự'], ['READY', 'Sẵn sàng'], ['CONFIRMED', 'Đã xác nhận'], ['IN_PROGRESS', 'Đang chạy'], ['COMPLETED', 'Hoàn thành'], ['CANCELLED', 'Đã hủy']].map(([value, label]) => <button key={value} type="button" onClick={() => setShiftStatusFilter(value)} className={`rounded-full px-3 py-2 text-xs font-black ${shiftStatusFilter === value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{label}</button>)}</div>
              <div className="grid grid-cols-[0.8fr_1.1fr_1fr_1fr_0.9fr_0.9fr_110px] bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                <span>Ngày</span>
                <span>Ca</span>
                <span>Tài xế</span>
                <span>Phụ xe</span>
                <span>Trạng thái</span>
                <span>Độ phủ</span>
                <span>Thao tác</span>
              </div>
              {visibleShifts.length ? visibleShifts.map((shift) => {
                const pair = assignmentMap[getId(shift)] || {};
                const driver = assignmentStaff(pair.driver, 'driver');
                const assistant = assignmentStaff(pair.assistant, 'assistant');
                return (
                  <div key={shift._id} className="grid grid-cols-[0.8fr_1.1fr_1fr_1fr_0.9fr_0.9fr_110px] items-center border-t border-slate-100 px-4 py-4 text-sm">
                    <span className="font-bold">{formatDate(shift.workDate)}</span>
                    <span>
                      <b>{shift.startTime} - {shift.endTime}</b>
                      <small className="mt-1 block text-slate-500">{shift.shiftName}</small>
                    </span>
                    <span className="font-semibold">{driver ? getStaffName(driver) : 'Chưa gán'}</span>
                    <span className="font-semibold">{assistant ? getStaffName(assistant) : 'Chưa gán'}</span>
                    <span><span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass[shift.status] || statusClass.ACTIVE}`}>{statusLabel[shift.status] || shift.status}</span></span>
                    <span><span className={`rounded-full px-3 py-1 text-xs font-black ${coverageClass[shiftCoverage(shift)]}`}>{coverageLabel[shiftCoverage(shift)]}</span></span>
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


