import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Header from '../../../shared/components/navigation/Header.jsx';
import useTheme from '../../../shared/hooks/useTheme.js';
import adminService from '../services/adminService.js';

const formatLocalDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const todayText = () => formatLocalDateInput(new Date());

const emptyShiftForm = {
  shiftCode: '',
  shiftName: '',
  workDate: todayText(),
  startTime: '',
  endTime: '',
  breakMinutes: 0,
  shiftType: 'MORNING',
  status: 'ACTIVE',
  description: '',
};

const MAX_DRIVER_MINUTES_PER_DAY = 8 * 60;
const autoShiftTemplates = [
  { key: 'MORNING', shiftName: 'Ca sáng tự động', startTime: '05:30', endTime: '13:30', shiftType: 'MORNING' },
  { key: 'AFTERNOON', shiftName: 'Ca chiều tự động', startTime: '13:30', endTime: '17:30', shiftType: 'AFTERNOON' },
];

const dateToken = (value) => String(value || '').replace(/-/g, '');
const addDaysToDateInput = (value, days) => {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatLocalDateInput(date);
};

const getRecordId = (value) => String(value?._id || value || '');

const isNotFoundError = (error) => (
  error?.statusCode === 404
  || error?.response?.status === 404
  || /not found/i.test(error?.message || '')
);

const shouldUpdateAutoShift = (shift, template) => (
  shift
  && (
    shift.shiftName !== template.shiftName
    || shift.startTime !== template.startTime
    || shift.endTime !== template.endTime
    || shift.shiftType !== template.shiftType
  )
);

const isKeptAutoShiftTemplate = (shift, scheduleDate) => (
  autoShiftTemplates.some((template) => (
    shift.shiftCode === `AUTO-${dateToken(scheduleDate)}-${template.key}`
  ))
);

const timeToMinutes = (value) => {
  if (!/^\d{2}:\d{2}$/.test(value || '')) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (hours > 23 || minutes > 59) return null;
  return (hours * 60) + minutes;
};

const getShiftDurationMinutes = (shift) => {
  const start = timeToMinutes(shift?.startTime);
  const end = timeToMinutes(shift?.endTime);
  if (start === null || end === null) return 0;
  return Math.max(0, (end <= start ? end + 1440 : end) - start);
};

const toDateInputValue = (value) => {
  if (!value) return todayText();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return todayText();
  return formatLocalDateInput(date);
};

const formatDate = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('vi-VN');
};

const getErrorMessage = (error, fallback) => (
  Array.isArray(error?.errors) && error.errors.length ? error.errors[0] : error?.message || fallback
);

const statusTone = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
  ASSIGNED: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
  COMPLETED: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  CANCELLED: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100',
  INACTIVE: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  ARCHIVED: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
};

const statusLabels = {
  ACTIVE: 'Đang dùng',
  ASSIGNED: 'Đã phân công',
  IN_PROGRESS: 'Đang làm',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  INACTIVE: 'Tạm ngưng',
  ARCHIVED: 'Đã lưu trữ',
};

const shiftTypeLabels = {
  MORNING: 'Ca sáng',
  AFTERNOON: 'Ca chiều',
  EVENING: 'Ca tối',
  NIGHT: 'Ca đêm',
  FULL_DAY: 'Ca cả ngày',
  CUSTOM: 'Tùy chỉnh',
};

const AssignmentList = ({ empty, mutedClassName, render, rows, softPanelClassName, title }) => (
  <div className={`rounded-xl border p-3 ${softPanelClassName}`}>
    <p className="text-sm font-bold">{title}</p>
    <div className="mt-3 space-y-2">
      {rows.length ? rows.map((row) => (
        <div key={row._id} className="rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-200">
          {render(row)}
        </div>
      )) : <p className={`text-sm ${mutedClassName}`}>{empty}</p>}
    </div>
  </div>
);

const ShiftManagementPage = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const [workDate, setWorkDate] = useState(todayText());
  const [shiftViewMode, setShiftViewMode] = useState('DAY');
  const [shifts, setShifts] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [assistantStaff, setAssistantStaff] = useState([]);
  const [assignments, setAssignments] = useState({
    driverAssignments: [],
    assistantAssignments: [],
  });
  const [shiftForm, setShiftForm] = useState(emptyShiftForm);
  const [editingShiftId, setEditingShiftId] = useState('');
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [driverForm, setDriverForm] = useState({ driverId: '' });
  const [assistantForm, setAssistantForm] = useState({ assistantId: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedShift = useMemo(
    () => shifts.find((shift) => String(shift._id) === String(selectedShiftId)) || null,
    [selectedShiftId, shifts]
  );

  const shellClassName = isDarkMode ? 'bg-[#071516] text-slate-100' : 'bg-[#f7fbfc] text-slate-900';
  const panelClassName = isDarkMode ? 'border-white/8 bg-[#111d20]/92' : 'border-slate-200 bg-white';
  const softPanelClassName = isDarkMode ? 'border-white/6 bg-white/[0.04]' : 'border-slate-200 bg-slate-50';
  const inputClassName = isDarkMode
    ? 'border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500'
    : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400';
  const nativeControlStyle = { colorScheme: isDarkMode ? 'dark' : 'light' };
  const titleClassName = isDarkMode ? 'text-white' : 'text-slate-950';
  const mutedClassName = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const dates = shiftViewMode === 'WEEK'
        ? Array.from({ length: 7 }, (_, index) => addDaysToDateInput(workDate, index))
        : [workDate];
      const [shiftResponses, staffResponse] = await Promise.all([
        Promise.all(dates.map((date) => adminService.getShifts({ date }))),
        adminService.getDrivers(),
      ]);
      const nextShifts = shiftResponses
        .flatMap((response) => response.shifts || [])
        .filter((shift) => shift.status !== 'ARCHIVED')
        .sort((left, right) => (
          toDateInputValue(left.workDate).localeCompare(toDateInputValue(right.workDate))
          || String(left.startTime || '').localeCompare(String(right.startTime || ''))
        ));
      setShifts(nextShifts);
      setDrivers((staffResponse.drivers || []).filter((driver) => driver.status === 'ACTIVE'));
      setAssistantStaff((staffResponse.assistantStaff || []).filter((staff) => staff.status === 'ACTIVE'));
    } catch (loadError) {
      const message = getErrorMessage(loadError, 'Không thể tải dữ liệu ca làm.');
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [shiftViewMode, workDate]);

  const loadSelectedAssignments = useCallback(async (shiftId = selectedShiftId) => {
    if (!shiftId) {
      setAssignments({ driverAssignments: [], assistantAssignments: [] });
      return;
    }
    setAssignmentLoading(true);
    try {
      const response = await adminService.getShiftAssignmentsByShift(shiftId);
      setAssignments({
        driverAssignments: response.driverAssignments || [],
        assistantAssignments: response.assistantAssignments || [],
      });
    } catch (loadError) {
      toast.error(getErrorMessage(loadError, 'Không thể tải phân công của ca.'));
    } finally {
      setAssignmentLoading(false);
    }
  }, [selectedShiftId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedShiftId && !shifts.some((shift) => String(shift._id) === String(selectedShiftId))) {
      setSelectedShiftId('');
    }
  }, [selectedShiftId, shifts]);

  useEffect(() => {
    loadSelectedAssignments();
  }, [loadSelectedAssignments]);

  const validateShiftForm = () => {
    const start = timeToMinutes(shiftForm.startTime);
    const end = timeToMinutes(shiftForm.endTime);
    if (!shiftForm.shiftCode.trim()) return 'Mã ca là bắt buộc.';
    if (!shiftForm.shiftName.trim()) return 'Tên ca là bắt buộc.';
    if (!shiftForm.workDate) return 'Ngày làm việc là bắt buộc.';
    if (start === null) return 'Giờ bắt đầu là bắt buộc.';
    if (end === null) return 'Giờ kết thúc là bắt buộc.';
    if (Number(shiftForm.breakMinutes) < 0) return 'Số phút nghỉ không được âm.';
    return '';
  };

  const submitWithMessage = async (action, successMessage) => {
    setError('');
    setSuccess('');
    setIsSubmitting(true);
    try {
      const result = await action();
      setSuccess(successMessage);
      toast.success(successMessage);
      await loadData();
      await loadSelectedAssignments();
      return result;
    } catch (submitError) {
      const message = getErrorMessage(submitError, 'Thao tác thất bại.');
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetShiftForm = () => {
    setEditingShiftId('');
    setShiftForm({ ...emptyShiftForm, workDate });
  };

  const handleEditShift = (shift) => {
    setEditingShiftId(shift._id);
    setSelectedShiftId(shift._id);
    setShiftForm({
      shiftCode: shift.shiftCode || '',
      shiftName: shift.shiftName || '',
      workDate: toDateInputValue(shift.workDate || workDate),
      startTime: shift.startTime || '',
      endTime: shift.endTime || '',
      breakMinutes: Number(shift.breakMinutes || 0),
      shiftType: shift.shiftType || 'CUSTOM',
      status: shift.status || 'ACTIVE',
      description: shift.description || '',
    });
    window.scrollTo({ top: 180, behavior: 'smooth' });
  };

  const handleSubmitShift = async (event) => {
    event.preventDefault();
    const validationError = validateShiftForm();
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }
    const response = await submitWithMessage(
      () => (editingShiftId
        ? adminService.updateShift(editingShiftId, { ...shiftForm, breakMinutes: Number(shiftForm.breakMinutes || 0) })
        : adminService.createShift({ ...shiftForm, breakMinutes: Number(shiftForm.breakMinutes || 0) })),
      editingShiftId ? 'Cập nhật ca làm việc thành công.' : 'Tạo ca làm việc thành công.'
    );
    if (response?.shift?._id) {
      setWorkDate(toDateInputValue(response.shift.workDate || shiftForm.workDate));
      setSelectedShiftId(response.shift._id);
      setEditingShiftId('');
      setShiftForm({ ...emptyShiftForm, workDate: toDateInputValue(response.shift.workDate || shiftForm.workDate) });
    }
  };

  const requireSelectedShift = () => {
    if (selectedShift) return true;
    const message = 'Vui lòng chọn ca làm việc trước';
    setError(message);
    toast.error(message);
    return false;
  };

  const handleAssignDriver = async (event) => {
    event.preventDefault();
    if (!requireSelectedShift()) return;
    if (!driverForm.driverId) {
      setError('Vui lòng chọn tài xế.');
      return;
    }
    await submitWithMessage(
      () => adminService.assignDriverToSelectedShift(selectedShift._id, { driverId: driverForm.driverId }),
      'Phân công tài xế vào ca thành công.'
    );
  };

  const handleAssignAssistant = async (event) => {
    event.preventDefault();
    if (!requireSelectedShift()) return;
    if (!assistantForm.assistantId) {
      setError('Vui lòng chọn phụ xe.');
      return;
    }
    await submitWithMessage(
      () => adminService.assignAssistantToSelectedShift(selectedShift._id, { assistantId: assistantForm.assistantId }),
      'Phân công phụ xe vào ca thành công.'
    );
  };

  const runClientAutoGenerateSchedule = async () => {
    const summary = {
      startDate: workDate,
      endDate: addDaysToDateInput(workDate, 6),
      days: 7,
      maxDriverMinutesPerDay: MAX_DRIVER_MINUTES_PER_DAY,
      createdShifts: 0,
      existingShifts: 0,
      updatedShifts: 0,
      archivedShifts: 0,
      assignedDrivers: 0,
      skippedShifts: [],
      shifts: [],
      dailySummaries: [],
    };

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const scheduleDate = addDaysToDateInput(workDate, dayIndex);
      const shiftResponse = await adminService.getShifts({ date: scheduleDate });
      const assignmentResponse = await adminService.getShiftAssignments({ workDate: scheduleDate });
      const currentShifts = (shiftResponse.shifts || []).filter((shift) => shift.status !== 'ARCHIVED');
      const driverAssignments = assignmentResponse.driverAssignments || [];
      const shiftsById = new Map(currentShifts.map((shift) => [getRecordId(shift), shift]));
      const assignedShiftIds = new Set(driverAssignments.map((assignment) => getRecordId(assignment.shiftId)));
      const driverMinutes = new Map();
      const dailySummary = {
        workDate: scheduleDate,
        createdShifts: 0,
        existingShifts: 0,
        updatedShifts: 0,
        archivedShifts: 0,
        assignedDrivers: 0,
        skippedShifts: [],
        shifts: [],
      };

      driverAssignments.forEach((assignment) => {
        const driverId = getRecordId(assignment.driverId);
        const shift = assignment.shiftId?.startTime ? assignment.shiftId : shiftsById.get(getRecordId(assignment.shiftId));
        const duration = getShiftDurationMinutes(shift);
        driverMinutes.set(driverId, (driverMinutes.get(driverId) || 0) + duration);
      });

      const obsoleteAutoShifts = currentShifts.filter((item) => (
        String(item.shiftCode || '').startsWith(`AUTO-${dateToken(scheduleDate)}-`)
        && !isKeptAutoShiftTemplate(item, scheduleDate)
      ));
      for (const obsoleteShift of obsoleteAutoShifts) {
        await adminService.archiveShift(obsoleteShift._id);
        summary.archivedShifts += 1;
        dailySummary.archivedShifts += 1;
      }

      for (const template of autoShiftTemplates) {
        const shiftCode = `AUTO-${dateToken(scheduleDate)}-${template.key}`;
        let shift = currentShifts.find((item) => item.shiftCode === shiftCode);

        if (shift) {
          if (shouldUpdateAutoShift(shift, template)) {
            const updated = await adminService.updateShift(shift._id, {
              ...shift,
              shiftName: template.shiftName,
              startTime: template.startTime,
              endTime: template.endTime,
              shiftType: template.shiftType,
              description: 'Ca duoc sinh tu dong. Moi tai xe toi da 8 gio/ngay.',
            });
            shift = updated.shift;
            shiftsById.set(getRecordId(shift), shift);
            summary.updatedShifts += 1;
            dailySummary.updatedShifts += 1;
          }
          summary.existingShifts += 1;
          dailySummary.existingShifts += 1;
        } else {
          const created = await adminService.createShift({
            shiftCode,
            shiftName: template.shiftName,
            workDate: scheduleDate,
            startTime: template.startTime,
            endTime: template.endTime,
            breakMinutes: 0,
            shiftType: template.shiftType,
            status: 'ACTIVE',
            description: 'Ca duoc sinh tu dong. Moi tai xe toi da 8 gio/ngay.',
          });
          shift = created.shift;
          currentShifts.push(shift);
          shiftsById.set(getRecordId(shift), shift);
          summary.createdShifts += 1;
          dailySummary.createdShifts += 1;
        }

        const shiftResult = {
          workDate: scheduleDate,
          shiftId: shift._id,
          shiftCode: shift.shiftCode,
          shiftName: shift.shiftName,
          startTime: shift.startTime,
          endTime: shift.endTime,
          driver: null,
          status: 'UNASSIGNED',
          reason: '',
        };

        if (assignedShiftIds.has(getRecordId(shift))) {
          shiftResult.status = 'ALREADY_ASSIGNED';
          summary.shifts.push(shiftResult);
          dailySummary.shifts.push(shiftResult);
          continue;
        }

        const shiftDuration = getShiftDurationMinutes(shift);
        let assigned = null;
        let lastError = null;
        for (const driver of drivers) {
          const driverId = getRecordId(driver);
          if ((driverMinutes.get(driverId) || 0) + shiftDuration > MAX_DRIVER_MINUTES_PER_DAY) {
            continue;
          }
          try {
            const response = await adminService.assignDriverToSelectedShift(shift._id, { driverId });
            assigned = response.assignment;
            driverMinutes.set(driverId, (driverMinutes.get(driverId) || 0) + shiftDuration);
            assignedShiftIds.add(getRecordId(shift));
            break;
          } catch (assignError) {
            lastError = assignError;
          }
        }

        if (assigned) {
          shiftResult.driver = assigned.driverId;
          shiftResult.status = 'ASSIGNED';
          summary.assignedDrivers += 1;
          dailySummary.assignedDrivers += 1;
        } else {
          shiftResult.reason = lastError?.message || 'Khong tim duoc tai xe phu hop.';
          summary.skippedShifts.push(shiftResult);
          dailySummary.skippedShifts.push(shiftResult);
        }

        summary.shifts.push(shiftResult);
        dailySummary.shifts.push(shiftResult);
      }

      summary.dailySummaries.push(dailySummary);
    }

    return summary;
  };

  // Kept as a compatibility fallback for deployments that still expose the legacy generator.
  // eslint-disable-next-line no-unused-vars
  const handleAutoGenerateSchedule = async () => {
    setError('');
    setSuccess('');
    setGeneratedSummary(null);
    setIsSubmitting(true);
    try {
      let response;
      try {
        response = await adminService.autoGenerateShiftSchedule({ workDate, days: 7 });
      } catch (apiError) {
        if (!isNotFoundError(apiError)) throw apiError;
        response = await runClientAutoGenerateSchedule();
      }
      setGeneratedSummary(response);
      const message = `Đã sinh lịch tuần: ${response.createdShifts || 0} ca mới, cập nhật ${response.updatedShifts || 0} ca, gán ${response.assignedDrivers || 0} tài xế.`;
      setSuccess(message);
      toast.success(message);
      await loadData();
      if (response.shifts?.[0]?.shiftId) {
        setSelectedShiftId(response.shifts[0].shiftId);
      }
    } catch (generateError) {
      const message = getErrorMessage(generateError, 'Không thể sinh lịch tự động.');
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoAssignStaff = async () => {
    if (!shifts.length) {
      toast.error('Không có ca làm việc để phân công.');
      return;
    }
    if (!drivers.length && !assistantStaff.length) {
      toast.error('Không có tài xế hoặc phụ xe đang hoạt động.');
      return;
    }

    setError('');
    setSuccess('');
    setIsAutoAssigning(true);
    let assignedDriverCount = 0;
    let assignedAssistantCount = 0;
    let skippedDriverCount = 0;
    let skippedAssistantCount = 0;
    let existingDriverCount = 0;
    let existingAssistantCount = 0;
    const failureReasons = new Map();

    try {
      const dates = [...new Set(shifts.map((shift) => toDateInputValue(shift.workDate)))].sort();

      for (const date of dates) {
        const dayShifts = shifts
          .filter((shift) => toDateInputValue(shift.workDate) === date)
          .sort((left, right) => String(left.startTime || '').localeCompare(String(right.startTime || '')));
        const assignmentResponses = await Promise.all(
          dayShifts.map((shift) => adminService.getShiftAssignmentsByShift(shift._id))
        );
        const activeDriverAssignments = assignmentResponses.flatMap((response) => (
          (response.driverAssignments || []).filter((assignment) => (
            ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(assignment.status)
          ))
        ));
        const activeAssistantAssignments = assignmentResponses.flatMap((response) => (
          (response.assistantAssignments || []).filter((assignment) => (
            ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(assignment.status)
          ))
        ));
        const driverAssignedShiftIds = new Set(activeDriverAssignments.map((assignment) => getRecordId(assignment.shiftId)));
        const assistantAssignedShiftIds = new Set(activeAssistantAssignments.map((assignment) => getRecordId(assignment.shiftId)));
        const driverMinutes = new Map();
        const assistantMinutes = new Map();
        existingDriverCount += driverAssignedShiftIds.size;
        existingAssistantCount += assistantAssignedShiftIds.size;

        activeDriverAssignments.forEach((assignment) => {
          const driverId = getRecordId(assignment.driverId);
          const assignedShift = assignment.shiftId?.startTime
            ? assignment.shiftId
            : dayShifts.find((shift) => getRecordId(shift) === getRecordId(assignment.shiftId));
          driverMinutes.set(driverId, (driverMinutes.get(driverId) || 0) + getShiftDurationMinutes(assignedShift));
        });
        activeAssistantAssignments.forEach((assignment) => {
          const assistantId = getRecordId(assignment.assistantId);
          const assignedShift = assignment.shiftId?.startTime
            ? assignment.shiftId
            : dayShifts.find((shift) => getRecordId(shift) === getRecordId(assignment.shiftId));
          assistantMinutes.set(assistantId, (assistantMinutes.get(assistantId) || 0) + getShiftDurationMinutes(assignedShift));
        });

        for (const shift of dayShifts) {
          const shiftDuration = getShiftDurationMinutes(shift);
          const shiftId = getRecordId(shift);

          if (!driverAssignedShiftIds.has(shiftId)) {
            let driverAssigned = false;
            for (const driver of drivers) {
              const driverId = getRecordId(driver);
              if ((driverMinutes.get(driverId) || 0) + shiftDuration > MAX_DRIVER_MINUTES_PER_DAY) continue;
              try {
                await adminService.assignDriverToSelectedShift(shift._id, { driverId });
                driverMinutes.set(driverId, (driverMinutes.get(driverId) || 0) + shiftDuration);
                driverAssignedShiftIds.add(shiftId);
                assignedDriverCount += 1;
                driverAssigned = true;
                break;
              } catch (assignError) {
                const reason = getErrorMessage(assignError, 'Không thể phân công tài xế.');
                failureReasons.set(`Tài xế: ${reason}`, (failureReasons.get(`Tài xế: ${reason}`) || 0) + 1);
              }
            }
            if (!driverAssigned) skippedDriverCount += 1;
          }

          if (!assistantAssignedShiftIds.has(shiftId)) {
            let assistantAssigned = false;
            for (const assistant of assistantStaff) {
              const assistantId = getRecordId(assistant);
              if ((assistantMinutes.get(assistantId) || 0) + shiftDuration > MAX_DRIVER_MINUTES_PER_DAY) continue;
              try {
                await adminService.assignAssistantToSelectedShift(shift._id, { assistantId });
                assistantMinutes.set(assistantId, (assistantMinutes.get(assistantId) || 0) + shiftDuration);
                assistantAssignedShiftIds.add(shiftId);
                assignedAssistantCount += 1;
                assistantAssigned = true;
                break;
              } catch (assignError) {
                const reason = getErrorMessage(assignError, 'Không thể phân công phụ xe.');
                failureReasons.set(`Phụ xe: ${reason}`, (failureReasons.get(`Phụ xe: ${reason}`) || 0) + 1);
              }
            }
            if (!assistantAssigned) skippedAssistantCount += 1;
          }
        }
      }

      const reasonSummary = [...failureReasons.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 2)
        .map(([reason]) => reason)
        .join(' ');
      const hasSkipped = skippedDriverCount > 0 || skippedAssistantCount > 0;
      const message = `Đã gán mới ${assignedDriverCount} tài xế và ${assignedAssistantCount} phụ xe. Đã có sẵn ${existingDriverCount} tài xế và ${existingAssistantCount} phụ xe.${hasSkipped ? ` Còn thiếu ${skippedDriverCount} tài xế, ${skippedAssistantCount} phụ xe.` : ''}`;
      setSuccess(reasonSummary && hasSkipped ? `${message} ${reasonSummary}` : message);
      if (hasSkipped) {
        toast.error(reasonSummary || message);
      } else {
        toast.success(message);
      }
      await loadData();
      await loadSelectedAssignments();
    } catch (assignError) {
      const message = getErrorMessage(assignError, 'Không thể phân công nhân sự tự động.');
      setError(message);
      toast.error(message);
    } finally {
      setIsAutoAssigning(false);
    }
  };

  return (
    <div className={`shift-management-page min-h-screen ${shellClassName}`}>
      <Header />
      <main className="mx-auto max-w-[1360px] px-4 pb-12 pt-28 sm:px-6 lg:px-8">
        <style>{`
          .shift-management-page select {
            color-scheme: ${isDarkMode ? 'dark' : 'light'};
          }
          .shift-management-page select option {
            background-color: ${isDarkMode ? '#111d20' : '#ffffff'};
            color: ${isDarkMode ? '#f8fafc' : '#0f172a'};
          }
        `}</style>

        <section className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className={`text-xs font-bold uppercase tracking-[0.24em] ${mutedClassName}`}>Chuẩn bị tính lương</p>
            <h1 className={`mt-2 text-4xl font-black ${titleClassName}`}>Quản lý ca làm việc</h1>
            <p className={`mt-2 max-w-3xl text-sm ${mutedClassName}`}>
              Tạo ca làm việc và phân công tài xế, phụ xe để phục vụ chấm công và tính lương.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              type="date"
              value={workDate}
              onChange={(event) => setWorkDate(event.target.value)}
              className={`h-11 rounded-xl border px-4 text-sm ${inputClassName}`}
            />
            <button
              type="button"
              onClick={() => navigate('/admin/shifts/auto-generate')}
              className="h-11 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-slate-950 disabled:opacity-60"
            >
              Sinh ca tự động
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/staff-performance')}
              className={`h-11 rounded-xl border px-4 text-sm font-semibold ${inputClassName}`}
            >
              Hiệu suất nhân sự
            </button>
          </div>
        </section>

        {(error || success) && (
          <div className={`mb-5 rounded-xl border px-4 py-3 text-sm font-semibold ${
            error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}>
            {error || success}
          </div>
        )}

        {generatedSummary ? (
          <section className={`mb-5 rounded-2xl border p-4 ${panelClassName}`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className={`text-lg font-black ${titleClassName}`}>Kết quả sinh lịch tuần</h2>
                <p className={`mt-1 text-xs ${mutedClassName}`}>Sinh 7 ngày từ ngày đang chọn, chỉ trong khung 05:30-17:30. Mỗi tài xế tối đa 8 giờ/ngày, ca đã có tài xế sẽ được giữ nguyên.</p>
              </div>
              <div className="grid grid-cols-6 gap-2 text-center text-xs font-bold">
                <span className={`rounded-xl border px-3 py-2 ${softPanelClassName}`}>{generatedSummary.days || 7} ngày</span>
                <span className={`rounded-xl border px-3 py-2 ${softPanelClassName}`}>{generatedSummary.createdShifts || 0} ca mới</span>
                <span className={`rounded-xl border px-3 py-2 ${softPanelClassName}`}>{generatedSummary.existingShifts || 0} ca có sẵn</span>
                <span className={`rounded-xl border px-3 py-2 ${softPanelClassName}`}>{generatedSummary.updatedShifts || 0} ca sửa giờ</span>
                <span className={`rounded-xl border px-3 py-2 ${softPanelClassName}`}>{generatedSummary.archivedShifts || 0} ca bỏ</span>
                <span className={`rounded-xl border px-3 py-2 ${softPanelClassName}`}>{generatedSummary.assignedDrivers || 0} tài xế</span>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {(generatedSummary.shifts || []).map((item) => (
                <div key={item.shiftCode} className={`rounded-xl border p-3 text-sm ${softPanelClassName}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`font-black ${titleClassName}`}>{item.shiftName}</p>
                      <p className={`mt-1 text-xs ${mutedClassName}`}>{item.startTime} - {item.endTime}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                      item.status === 'ASSIGNED'
                        ? 'bg-emerald-50 text-emerald-700'
                        : item.status === 'ALREADY_ASSIGNED'
                          ? 'bg-cyan-50 text-cyan-700'
                          : 'bg-amber-50 text-amber-700'
                    }`}>
                      {item.status === 'ASSIGNED' ? 'Đã gán' : item.status === 'ALREADY_ASSIGNED' ? 'Đã có' : 'Chưa gán'}
                    </span>
                  </div>
                  <p className={`mt-3 text-xs ${mutedClassName}`}>
                    {item.driver?.fullName || item.reason || 'Chưa có tài xế phù hợp.'}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className={`rounded-2xl border p-4 ${panelClassName}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className={`text-lg font-black ${titleClassName}`}>{editingShiftId ? 'Cập nhật ca làm việc' : 'Tạo ca làm việc'}</h2>
                <p className={`mt-1 text-xs ${mutedClassName}`}>Ca có thể kết thúc sau ngày làm việc nếu là ca qua đêm.</p>
              </div>
              <span className="material-symbols-outlined text-cyan-500">work_history</span>
            </div>

            <form className="mt-4 space-y-3" onSubmit={handleSubmitShift}>
              <input className={`h-11 w-full rounded-xl border px-4 text-sm ${inputClassName}`} placeholder="Mã ca" value={shiftForm.shiftCode} onChange={(event) => setShiftForm({ ...shiftForm, shiftCode: event.target.value })} />
              <input className={`h-11 w-full rounded-xl border px-4 text-sm ${inputClassName}`} placeholder="Tên ca" value={shiftForm.shiftName} onChange={(event) => setShiftForm({ ...shiftForm, shiftName: event.target.value })} />
              <input type="date" className={`h-11 w-full rounded-xl border px-4 text-sm ${inputClassName}`} value={shiftForm.workDate} onChange={(event) => setShiftForm({ ...shiftForm, workDate: event.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input type="time" className={`h-11 rounded-xl border px-4 text-sm ${inputClassName}`} value={shiftForm.startTime} onChange={(event) => setShiftForm({ ...shiftForm, startTime: event.target.value })} />
                <input type="time" className={`h-11 rounded-xl border px-4 text-sm ${inputClassName}`} value={shiftForm.endTime} onChange={(event) => setShiftForm({ ...shiftForm, endTime: event.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" min="0" className={`h-11 rounded-xl border px-4 text-sm ${inputClassName}`} value={shiftForm.breakMinutes} onChange={(event) => setShiftForm({ ...shiftForm, breakMinutes: event.target.value })} />
                <select style={nativeControlStyle} className={`h-11 rounded-xl border px-4 text-sm ${inputClassName}`} value={shiftForm.shiftType} onChange={(event) => setShiftForm({ ...shiftForm, shiftType: event.target.value })}>
                  <option value="MORNING">Ca sáng</option>
                  <option value="AFTERNOON">Ca chiều</option>
                  <option value="EVENING">Ca tối</option>
                  <option value="NIGHT">Ca đêm</option>
                  <option value="FULL_DAY">Ca cả ngày</option>
                  <option value="CUSTOM">Tùy chỉnh</option>
                </select>
              </div>
              <textarea className={`min-h-[88px] w-full rounded-xl border px-4 py-3 text-sm ${inputClassName}`} placeholder="Mô tả" value={shiftForm.description} onChange={(event) => setShiftForm({ ...shiftForm, description: event.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="submit" disabled={isSubmitting} className="h-11 rounded-xl bg-cyan-600 px-4 text-sm font-bold text-white disabled:opacity-60">
                  {isSubmitting ? 'Đang lưu...' : editingShiftId ? 'Cập nhật ca' : 'Tạo ca'}
                </button>
                <button type="button" onClick={resetShiftForm} disabled={isSubmitting} className={`h-11 rounded-xl border px-4 text-sm font-bold disabled:opacity-60 ${inputClassName}`}>
                  Tạo mới
                </button>
              </div>
            </form>
          </aside>

          <section className="space-y-5">
            <section className={`rounded-2xl border p-4 ${panelClassName}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className={`text-lg font-black ${titleClassName}`}>Danh sách ca làm việc</h2>
                  <p className={`mt-1 text-xs ${mutedClassName}`}>
                    {shiftViewMode === 'WEEK'
                      ? `Đang hiển thị từ ${formatDate(workDate)} đến ${formatDate(addDaysToDateInput(workDate, 6))}.`
                      : `Đang hiển thị ngày ${formatDate(workDate)}.`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isAutoAssigning || isLoading || !shifts.length}
                    onClick={handleAutoAssignStaff}
                    className="flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-base">person_add</span>
                    {isAutoAssigning ? 'Đang phân công...' : 'Xếp tài xế & phụ xe'}
                  </button>
                  <div className={`grid grid-cols-2 rounded-xl border p-1 ${softPanelClassName}`}>
                    <button
                      type="button"
                      onClick={() => setShiftViewMode('DAY')}
                      className={`h-8 rounded-lg px-3 text-xs font-bold ${shiftViewMode === 'DAY' ? 'bg-cyan-600 text-white' : mutedClassName}`}
                    >
                      Theo ngày
                    </button>
                    <button
                      type="button"
                      onClick={() => setShiftViewMode('WEEK')}
                      className={`h-8 rounded-lg px-3 text-xs font-bold ${shiftViewMode === 'WEEK' ? 'bg-cyan-600 text-white' : mutedClassName}`}
                    >
                      Theo tuần
                    </button>
                  </div>
                  {isLoading && <span className={`text-sm ${mutedClassName}`}>Đang tải...</span>}
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {shifts.map((shift) => (
                  <div
                    key={shift._id}
                    className={`rounded-xl border p-4 text-left transition ${
                      String(selectedShiftId) === String(shift._id)
                        ? isDarkMode
                          ? 'border-emerald-300 bg-emerald-400/12 ring-2 ring-emerald-300/30'
                          : 'border-emerald-300 bg-emerald-50 text-slate-950 ring-2 ring-emerald-200'
                        : softPanelClassName
                    }`}
                  >
                    {shiftViewMode === 'WEEK' ? (
                      <p className="mb-3 text-[11px] font-black uppercase text-cyan-500">
                        {formatDate(shift.workDate)}
                      </p>
                    ) : null}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-sm font-black ${titleClassName}`}>{shift.shiftName}</p>
                        <p className={`mt-1 text-xs ${mutedClassName}`}>{shift.shiftCode || 'Chưa có mã'} | {shiftTypeLabels[shift.shiftType] || shift.shiftType}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone[shift.status] || statusTone.ACTIVE}`}>{statusLabels[shift.status] || shift.status}</span>
                    </div>
                    <p className={`mt-3 text-sm font-semibold ${titleClassName}`}>{shift.startTime} - {shift.endTime}</p>
                    <p className={`mt-1 text-xs ${mutedClassName}`}>Nghỉ giữa ca: {shift.breakMinutes || 0} phút</p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedShiftId(shift._id)}
                        className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold"
                      >
                        Chọn
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditShift(shift)}
                        className="h-9 rounded-lg bg-cyan-600 px-3 text-xs font-bold text-white"
                      >
                        Sửa
                      </button>
                    </div>
                  </div>
                ))}
                {!isLoading && shifts.length === 0 && <div className={`rounded-xl border p-4 text-sm ${mutedClassName} ${softPanelClassName}`}>Chưa có ca làm việc.</div>}
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <form className={`rounded-2xl border p-4 ${panelClassName}`} onSubmit={handleAssignDriver}>
                <h3 className={`text-sm font-black ${titleClassName}`}>Phân công tài xế</h3>
                <div className="mt-4 space-y-3">
                  <select style={nativeControlStyle} className={`h-11 w-full rounded-xl border px-4 text-sm ${inputClassName}`} value={driverForm.driverId} onChange={(event) => setDriverForm({ driverId: event.target.value })}>
                    <option value="">Chọn tài xế</option>
                    {drivers.map((driver) => <option key={driver._id} value={driver._id}>{driver.fullName}</option>)}
                  </select>
                  {!selectedShift ? <p className={`text-xs font-semibold ${mutedClassName}`}>Vui lòng chọn ca làm việc trước</p> : null}
                  <button disabled={isSubmitting || !selectedShift} className="h-11 w-full rounded-xl bg-emerald-600 text-sm font-bold text-white disabled:opacity-60">Phân công tài xế</button>
                </div>
              </form>

              <form className={`rounded-2xl border p-4 ${panelClassName}`} onSubmit={handleAssignAssistant}>
                <h3 className={`text-sm font-black ${titleClassName}`}>Phân công phụ xe</h3>
                <div className="mt-4 space-y-3">
                  <select style={nativeControlStyle} className={`h-11 w-full rounded-xl border px-4 text-sm ${inputClassName}`} value={assistantForm.assistantId} onChange={(event) => setAssistantForm({ assistantId: event.target.value })}>
                    <option value="">Chọn phụ xe</option>
                    {assistantStaff.map((staff) => <option key={staff._id} value={staff._id}>{staff.fullName}</option>)}
                  </select>
                  {!selectedShift ? <p className={`text-xs font-semibold ${mutedClassName}`}>Vui lòng chọn ca làm việc trước</p> : null}
                  <button disabled={isSubmitting || !selectedShift} className="h-11 w-full rounded-xl bg-cyan-600 text-sm font-bold text-white disabled:opacity-60">Phân công phụ xe</button>
                </div>
              </form>
            </section>

            <section className={`rounded-2xl border p-4 ${panelClassName}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className={`text-lg font-black ${titleClassName}`}>Công việc đã phân công</h2>
                  <p className={`mt-1 text-xs ${mutedClassName}`}>
                    {selectedShift ? `${selectedShift.shiftName} (${selectedShift.startTime}-${selectedShift.endTime})` : 'Vui lòng chọn ca làm việc trước'}
                  </p>
                </div>
                {assignmentLoading ? <span className={`text-xs font-semibold ${mutedClassName}`}>Đang tải...</span> : null}
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <AssignmentList title="Tài xế" rows={assignments.driverAssignments} empty="Chưa phân công tài xế." render={(item) => `${item.driverId?.fullName || 'Tài xế'} | ${item.shiftId?.shiftName || 'Ca'} | ${statusLabels[item.status] || item.status}`} mutedClassName={mutedClassName} softPanelClassName={softPanelClassName} />
                <AssignmentList title="Phụ xe" rows={assignments.assistantAssignments} empty="Chưa phân công phụ xe." render={(item) => `${item.assistantId?.fullName || 'Phụ xe'} | ${item.shiftId?.shiftName || 'Ca'} | ${statusLabels[item.status] || item.status}`} mutedClassName={mutedClassName} softPanelClassName={softPanelClassName} />
              </div>
            </section>
          </section>
        </section>
      </main>
    </div>
  );
};

export default ShiftManagementPage;
