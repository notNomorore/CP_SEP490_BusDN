import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  Edit3,
  RefreshCw,
  Save,
  Trash2,
  UserRoundCheck,
  Wand2,
} from 'lucide-react';
import adminService from '../services/adminService.js';

const OPERATING_START = '05:30';
const OPERATING_END = '18:30';
const MAX_DAYS = 31;
const MAX_WORK_MINUTES_PER_DAY = 8 * 60;

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

const ShiftAssignmentManagementPage = () => {
  const [activeView, setActiveView] = useState('ASSIGN');
  const [fromDate, setFromDate] = useState(todayInput());
  const [toDate, setToDate] = useState(todayInput());
  const [rangeRefreshKey, setRangeRefreshKey] = useState(0);
  const [form, setForm] = useState({
    applyMode: 'DAY',
    startTime: OPERATING_START,
    endTime: '13:30',
    shiftType: 'MORNING',
    driverId: '',
    assistantId: '',
    selectedWeekdays: weekDays.map((day) => day.key),
    requiresAssistant: true,
    description: '',
  });
  const [autoSelection, setAutoSelection] = useState({ driverIds: [], assistantIds: [] });
  const [manualPreviewRows, setManualPreviewRows] = useState([]);
  const [staff, setStaff] = useState({ drivers: [], assistants: [] });
  const [shifts, setShifts] = useState([]);
  const [assignmentMap, setAssignmentMap] = useState({});
  const [selectedShift, setSelectedShift] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const loadShiftsRequestRef = useRef(0);

  const dateRange = useMemo(() => eachDate(fromDate, toDate), [fromDate, toDate]);

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
    return staff.drivers.filter((driver) => (
      canStaffTakeSlot(getId(driver), 'driver', workDate, slot, selectedShift._id)
    ));
  }, [canStaffTakeSlot, editForm, selectedShift, staff.drivers]);

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
    const response = await adminService.getDrivers();
    setStaff({
      drivers: (response.drivers || []).filter((user) => user.status === 'ACTIVE'),
      assistants: (response.assistantStaff || []).filter((user) => user.status === 'ACTIVE'),
    });
  }, []);

  const loadShifts = useCallback(async () => {
    const requestId = loadShiftsRequestRef.current + 1;
    loadShiftsRequestRef.current = requestId;
    setLoading(true);
    setShifts([]);
    setAssignmentMap({});
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

      let assignments = { driverAssignments: [], assistantAssignments: [] };
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
  }, [fromDate, rangeRefreshKey, toDate]);

  useEffect(() => {
    loadStaff().catch(() => toast.error('Không thể tải danh sách nhân sự.'));
  }, [loadStaff]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

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
    const start = todayInput();
    const length = { DAY: 0, WEEK: 6, MONTH: 30 }[preset] ?? 0;
    setFromDate(start);
    setToDate(addDays(start, length));
    setRangeRefreshKey((current) => current + 1);
  };

  const assignPeople = async ({ shift, driverId, assistantId }) => {
    if (driverId) await adminService.assignDriverToSelectedShift(shift._id, { driverId });
    if (assistantId) await adminService.assignAssistantToSelectedShift(shift._id, { assistantId });
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
    const baseDates = form.applyMode === 'DAY' ? [fromDate] : dateRange;
    const targetDates = form.applyMode === 'DAY'
      ? baseDates
      : filterDatesByWeekdays(baseDates, form.selectedWeekdays);
    if (!targetDates.length) return toast.error('Khoảng ngày không có ngày phù hợp để tạo ca.');
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
      shiftName: makeShiftName(form),
      driverId: form.driverId,
      assistantId: form.assistantId,
      requiresAssistant: form.requiresAssistant,
      description: form.description || 'Ca được tạo từ màn hình phân công ca thủ công.',
      warnings: [
        !form.driverId ? 'Chưa gán tài xế' : '',
        form.requiresAssistant && !form.assistantId ? 'Chưa gán phụ xe' : '',
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

  const handleAutoGenerate = async () => {
    if (!dateRange.length) return toast.error('Khoảng ngày không hợp lệ.');
    if (!autoSelection.driverIds.length || !autoSelection.assistantIds.length) {
      return toast.error('Vui lòng chọn đủ tài xế và phụ xe đi làm.');
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
        for (let templateIndex = 0; templateIndex < shiftTemplates.length; templateIndex += 1) {
          const template = shiftTemplates[templateIndex];
          const buildQueue = (items, role) => (
            items.filter((item, itemIndex) => (
              itemIndex % shiftTemplates.length === templateIndex
              && canUseStaff(getId(item), role, workDate, template)
            ))
          );

          const availableDriverQueue = buildQueue(selectedDrivers, 'driver');
          const availableAssistantQueue = buildQueue(selectedAssistants, 'assistant');
          const pairCount = Math.min(availableDriverQueue.length, availableAssistantQueue.length);
          totalCandidateRows += pairCount;

          if (availableDriverQueue.length !== availableAssistantQueue.length) {
            skippedRows.push({
              workDate,
              shift: template.label,
              reason: `Lech so luong nhan su ranh: ${availableDriverQueue.length} tai xe, ${availableAssistantQueue.length} phu xe.`,
            });
          }

          for (let staffIndex = 0; staffIndex < pairCount; staffIndex += 1) {
            const driver = availableDriverQueue[staffIndex];
            const assistant = availableAssistantQueue[staffIndex];
            const driverId = getId(driver);
            const assistantId = getId(assistant);

            if (!driverId || !assistantId) {
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
              status: 'PUBLISHED',
              approvalStatus: 'PUBLISHED',
            });

            let assignedPeople = 0;
            const assignmentErrors = [];

            try {
              await adminService.assignDriverToSelectedShift(shift._id, { driverId });
              assignedPeople += 1;
              markBusy('driver', workDate, driverId, template);
            } catch (error) {
              assignmentErrors.push(error?.message || 'Không thể phân công tài xế.');
            }

            try {
              await adminService.assignAssistantToSelectedShift(shift._id, { assistantId });
              assignedPeople += 1;
              markBusy('assistant', workDate, assistantId, template);
            } catch (error) {
              assignmentErrors.push(error?.message || 'Không thể phân công phụ xe.');
            }

            if (assignedPeople === 2) {
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
    });
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

  const handleCancelShift = async (shift) => {
    if (!window.confirm('Hủy ca này? Các phân công tài xế, phụ xe, xe và chuyến trong ca sẽ được hủy theo.')) return;
    setSubmitting(true);
    try {
      await adminService.archiveShift(shift._id);
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

  const handleCancelShiftsInRange = async () => {
    if (!dateRange.length) {
      toast.error('Khoảng ngày không hợp lệ.');
      return;
    }
    if (!window.confirm(`Hủy ca làm từ ${fromDate} đến ${toDate}? Các phân công tài xế, phụ xe, xe và chuyến trong các ca này sẽ được hủy theo.`)) return;
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

  return (
    <div className="min-h-full bg-[#eef9f4] text-[#05231a]">
      <section className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 lg:px-8">
        <div className="rounded-[28px] bg-[#062819] p-6 text-white shadow-2xl shadow-emerald-950/20">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-300">Shift Operations</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black">Phân ca & Ca làm</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50/80">
                Phân ca tài xế, phụ xe theo khung vận hành 05:30 - 18:30. Lịch này là nền để điều phối chuyến và để nhân viên xem UC40.
              </p>
            </div>
            <button
              type="button"
              onClick={loadShifts}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-[#062819]"
            >
              <RefreshCw size={17} /> Tải lại
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
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

        <div className="grid gap-4 lg:grid-cols-3">
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
        </div>

        <div className="rounded-3xl border border-emerald-100 bg-white p-3 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setActiveView('ASSIGN')}
              className={`rounded-2xl p-4 text-left transition ${activeView === 'ASSIGN' ? 'bg-emerald-100 text-emerald-950' : 'bg-slate-50 text-slate-600'}`}
            >
              <p className="font-black">Phân ca</p>
              <p className="mt-1 text-sm">Tạo ca theo ngày, tuần hoặc tháng và phân công tài xế/phụ xe.</p>
            </button>
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
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Đến ngày</span>
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold" />
            </label>
            <div className="flex items-end gap-2">
              <button type="button" onClick={() => setRangePreset('DAY')} className="h-12 rounded-xl border border-slate-200 px-4 text-sm font-black">Hôm nay</button>
              <button type="button" onClick={() => setRangePreset('WEEK')} className="h-12 rounded-xl border border-slate-200 px-4 text-sm font-black">Tuần</button>
              <button type="button" onClick={() => setRangePreset('MONTH')} className="h-12 rounded-xl border border-slate-200 px-4 text-sm font-black">Tháng</button>
            </div>
          </div>
        </div>

        {activeView === 'ASSIGN' ? (
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <form onSubmit={handleCreateManual} className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <UserRoundCheck className="text-emerald-700" size={24} />
                <div>
                  <h2 className="text-xl font-black">Phân công ca thủ công</h2>
                  <p className="text-sm text-slate-500">Tạo lịch làm việc theo ca cho tài xế và phụ xe trong ngày hoặc khoảng ngày đã chọn.</p>
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
                <label className="flex items-end gap-3 rounded-xl border border-slate-200 px-4 py-3">
                  <input type="checkbox" checked={form.requiresAssistant} onChange={(event) => setForm((prev) => ({ ...prev, requiresAssistant: event.target.checked }))} />
                  <span className="text-sm font-black">Yêu cầu phụ xe khi công bố</span>
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
                    {staff.drivers.map((driver) => <option key={driver._id} value={driver._id}>{getStaffName(driver)}</option>)}
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

              <button disabled={submitting} type="submit" className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white disabled:opacity-60">
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

            <div className="rounded-3xl border border-emerald-100 bg-[#062819] p-6 text-white shadow-sm">
              <div className="flex items-center gap-3">
                <Wand2 className="text-emerald-300" size={25} />
                <div>
                  <h2 className="text-xl font-black">Sinh lịch phân ca tự động</h2>
                  <p className="text-sm text-emerald-50/75">Sinh lịch theo vòng xoay nhân sự, cân bằng số giờ làm và tránh trùng ca trong ngày.</p>
                </div>
              </div>
              <div className="mt-6 grid gap-3">
                {shiftTemplates.map((template) => (
                  <div key={template.key} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                    <p className="font-black">{template.label}</p>
                    <p className="mt-1 text-sm text-emerald-50/75">{template.startTime} - {template.endTime}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black">Tài xế đủ điều kiện</p>
                      <p className="text-xs text-emerald-50/70">{autoSelection.driverIds.length}/{availableDrivers.length} người đủ điều kiện được chọn</p>
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
                      <p className="rounded-xl bg-white/10 px-3 py-2 text-sm text-emerald-50/75">Không còn tài xế rảnh trong khoảng ngày này.</p>
                    ) : null}
                    {availableDrivers.map((driver) => (
                      <label key={driver._id} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm">
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
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black">Phụ xe đủ điều kiện</p>
                      <p className="text-xs text-emerald-50/70">{autoSelection.assistantIds.length}/{availableAssistants.length} người đủ điều kiện được chọn</p>
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
                      <p className="rounded-xl bg-white/10 px-3 py-2 text-sm text-emerald-50/75">Không còn phụ xe rảnh trong khoảng ngày này.</p>
                    ) : null}
                    {availableAssistants.map((assistant) => (
                      <label key={assistant._id} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm">
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
              <button disabled={submitting || (!availableDrivers.length && !availableAssistants.length)} type="button" onClick={handleAutoGenerate} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 text-sm font-black text-[#062819] disabled:opacity-60">
                <Wand2 size={18} /> Sinh ca tự động
              </button>
              {message ? <p className="mt-4 rounded-2xl bg-white/10 p-4 text-sm text-emerald-50">{message}</p> : null}
            </div>
          </div>
        ) : null}

        {activeView === 'LIST' ? (
          <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black">Lịch ca làm toàn hệ thống</h2>
                <p className="text-sm text-slate-500">Admin có thể xem, đổi giờ, đổi tài xế/phụ xe hoặc hủy ca trong ngày/tuần đã chọn.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {loading ? <span className="text-sm font-bold text-emerald-700">Đang tải...</span> : null}
                <button type="button" disabled={submitting || !dateRange.length} onClick={handleCancelShiftsInRange} className="inline-flex h-11 items-center gap-2 rounded-xl border border-rose-200 px-4 text-sm font-black text-rose-600 disabled:cursor-not-allowed disabled:opacity-50">
                  <Trash2 size={17} /> Hủy ca trong khoảng ngày
                </button>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1fr_1.1fr_1fr_1fr_1fr_130px] bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                <span>Ngày</span>
                <span>Ca</span>
                <span>Tài xế</span>
                <span>Phụ xe</span>
                <span>Trạng thái</span>
                <span>Thao tác</span>
              </div>
              {shifts.length ? shifts.map((shift) => {
                const pair = assignmentMap[getId(shift)] || {};
                const driver = assignmentStaff(pair.driver, 'driver');
                const assistant = assignmentStaff(pair.assistant, 'assistant');
                return (
                  <div key={shift._id} className="grid grid-cols-[1fr_1.1fr_1fr_1fr_1fr_130px] items-center border-t border-slate-100 px-4 py-4 text-sm">
                    <span className="font-bold">{formatDate(shift.workDate)}</span>
                    <span>
                      <b>{shift.startTime} - {shift.endTime}</b>
                      <small className="mt-1 block text-slate-500">{shift.shiftName}</small>
                    </span>
                    <span className="font-semibold">{driver ? getStaffName(driver) : 'Chưa gán'}</span>
                    <span className="font-semibold">{assistant ? getStaffName(assistant) : 'Chưa gán'}</span>
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
                  {editAvailableDrivers.map((driver) => <option key={driver._id} value={driver._id}>{getStaffName(driver)}</option>)}
                </select>
                {!editAvailableDrivers.length ? (
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
    </div>
  );
};

export default ShiftAssignmentManagementPage;


