import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  { key: 'AFTERNOON', label: 'Ca chiều', startTime: '13:30', endTime: '18:30', shiftType: 'AFTERNOON' },
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

const minutesOf = (value) => {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return (hours * 60) + minutes;
};

const isValidWindow = (startTime, endTime) => {
  const start = minutesOf(startTime);
  const end = minutesOf(endTime);
  return start !== null
    && end !== null
    && start >= minutesOf(OPERATING_START)
    && end <= minutesOf(OPERATING_END)
    && start < end
    && end - start <= 480;
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
    EVENING: 'Ca tối',
    FULL_DAY: 'Ca cả ngày',
    CUSTOM: 'Ca làm việc',
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
  return startA < endB && startB < endA;
};

const shiftBlocksTemplate = (shift, template) => (
  shift?.status !== 'ARCHIVED'
  && rangesOverlap(shift.startTime, shift.endTime, template.startTime, template.endTime)
);

const getShiftDurationMinutes = (shift) => {
  const start = minutesOf(shift?.startTime);
  const end = minutesOf(shift?.endTime);
  return start === null || end === null || end <= start ? 0 : end - start;
};

const hasActiveAssignment = (assignment) => assignment && (!assignment.status || ACTIVE_ASSIGNMENT_STATUSES.has(String(assignment.status).toUpperCase()));

const statusLabel = {
  ACTIVE: 'Đang hiệu lực',
  INACTIVE: 'Tạm ngưng',
  ARCHIVED: 'Đã hủy',
  ASSIGNED: 'Đã phân công',
  IN_PROGRESS: 'Đang làm',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

const statusClass = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  INACTIVE: 'bg-slate-100 text-slate-700',
  ARCHIVED: 'bg-rose-100 text-rose-700',
  ASSIGNED: 'bg-cyan-100 text-cyan-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-rose-100 text-rose-700',
};

const ShiftAssignmentManagementPage = () => {
  const [activeView, setActiveView] = useState('ASSIGN');
  const [fromDate, setFromDate] = useState(todayInput());
  const [toDate, setToDate] = useState(todayInput());
  const [form, setForm] = useState({
    startTime: OPERATING_START,
    endTime: OPERATING_END,
    shiftType: 'CUSTOM',
    driverId: '',
    assistantId: '',
    description: '',
  });
  const [autoSelection, setAutoSelection] = useState({ driverIds: [], assistantIds: [] });
  const [staff, setStaff] = useState({ drivers: [], assistants: [] });
  const [shifts, setShifts] = useState([]);
  const [assignmentMap, setAssignmentMap] = useState({});
  const [selectedShift, setSelectedShift] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const dateRange = useMemo(() => eachDate(fromDate, toDate), [fromDate, toDate]);

  const selectedAssignments = selectedShift ? assignmentMap[getId(selectedShift)] || {} : {};

  const getStaffAssignmentsForDate = useCallback((staffId, role, workDate) => {
    if (!staffId || !workDate) return [];

    return shifts.flatMap((shift) => {
      if (toDateInput(shift.workDate) !== workDate || shift.status === 'ARCHIVED') return [];
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

  const canStaffTakeSlot = useCallback((staffId, role, workDate, template) => {
    if (!staffId || !workDate || !template) return false;
    const assignments = getStaffAssignmentsForDate(staffId, role, workDate);

    // Nghiep vu phan ca BusDN: mot nhan vien chi nhan mot ca trong ngay.
    // Neu da co ca sang hoac ca chieu thi khong dua vao danh sach ranh nua.
    if (assignments.length > 0) return false;

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

  const loadStaff = useCallback(async () => {
    const response = await adminService.getDrivers();
    setStaff({
      drivers: (response.drivers || []).filter((user) => user.status === 'ACTIVE'),
      assistants: (response.assistantStaff || []).filter((user) => user.status === 'ACTIVE'),
    });
  }, []);

  const loadShifts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminService.getShifts({ from: fromDate, to: toDate });
      const rows = (response.shifts || []).filter((shift) => shift.status !== 'ARCHIVED');
      rows.sort((left, right) => (
        toDateInput(left.workDate).localeCompare(toDateInput(right.workDate))
        || String(left.startTime || '').localeCompare(String(right.startTime || ''))
      ));
      setShifts(rows);

      const pairs = await Promise.all(rows.map(async (shift) => {
        try {
          const assignments = await adminService.getShiftAssignmentsByShift(shift._id);
          const driverAssignments = (assignments.driverAssignments || []).filter(hasActiveAssignment);
          const assistantAssignments = (assignments.assistantAssignments || []).filter(hasActiveAssignment);
          return [getId(shift), {
            driver: driverAssignments[0] || null,
            assistant: assistantAssignments[0] || null,
            driverAssignments,
            assistantAssignments,
          }];
        } catch {
          return [getId(shift), { driver: null, assistant: null }];
        }
      }));
      setAssignmentMap(Object.fromEntries(pairs));
    } catch (error) {
      toast.error(error?.message || 'Không thể tải danh sách ca làm.');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

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
    if (!dateRange.length) return toast.error('Khoảng ngày không hợp lệ.');
    if (!isValidWindow(form.startTime, form.endTime)) return toast.error('Ca làm phải nằm trong 05:30 - 18:30 và tối đa 8 giờ.');

    setSubmitting(true);
    setMessage('');
    let created = 0;
    let assigned = 0;
    try {
      for (const workDate of dateRange) {
        const { shift } = await createOrReuseShift({
          workDate,
          startTime: form.startTime,
          endTime: form.endTime,
          shiftType: form.shiftType,
          shiftName: makeShiftName(form),
          description: form.description || 'Ca được tạo từ màn hình phân ca.',
        });
        created += 1;
        await assignPeople({ shift, driverId: form.driverId, assistantId: form.assistantId });
        if (form.driverId || form.assistantId) assigned += 1;
      }
      setMessage(`Đã tạo/cập nhật ${created} ca, phân công nhân sự cho ${assigned} ca.`);
      toast.success('Đã tạo ca làm việc.');
      await loadShifts();
    } catch (error) {
      toast.error(error?.message || 'Không thể tạo ca làm.');
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
    if (!autoSelection.driverIds.length && !autoSelection.assistantIds.length) {
      return toast.error('Vui lòng chọn ít nhất một tài xế hoặc phụ xe đi làm.');
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

      const markBusy = (role, workDate, staffId) => {
        if (!staffId) return;
        localBusy[role].set(`${workDate}:${staffId}`, true);
      };

      const isBusyInRun = (role, workDate, staffId) => (
        Boolean(staffId) && localBusy[role].has(`${workDate}:${staffId}`)
      );

      const canUseStaff = (staffId, role, workDate, template) => (
        Boolean(staffId)
        && !isBusyInRun(role, workDate, staffId)
        && canStaffTakeSlot(staffId, role, workDate, template)
      );

      let totalCandidateRows = 0;

      for (const [dateIndex, workDate] of dateRange.entries()) {
        const availableDriverQueue = selectedDrivers.filter((driver) => (
          shiftTemplates.some((template) => canUseStaff(getId(driver), 'driver', workDate, template))
        ));
        const availableAssistantQueue = selectedAssistants.filter((assistant) => (
          shiftTemplates.some((template) => canUseStaff(getId(assistant), 'assistant', workDate, template))
        ));

        const maxStaffCount = Math.max(availableDriverQueue.length, availableAssistantQueue.length);
        totalCandidateRows += maxStaffCount;

        for (let staffIndex = 0; staffIndex < maxStaffCount; staffIndex += 1) {
          const driver = availableDriverQueue[staffIndex] || null;
          const assistant = availableAssistantQueue[staffIndex] || null;
          if (!driver && !assistant) continue;

          const preferredTemplateIndex = (staffIndex + dateIndex) % shiftTemplates.length;
          const orderedTemplates = [
            shiftTemplates[preferredTemplateIndex],
            ...shiftTemplates.filter((_, index) => index !== preferredTemplateIndex),
          ];

          const candidate = orderedTemplates
            .map((template) => {
              const driverId = driver && canUseStaff(getId(driver), 'driver', workDate, template) ? getId(driver) : '';
              const assistantId = assistant && canUseStaff(getId(assistant), 'assistant', workDate, template) ? getId(assistant) : '';
              return { template, driverId, assistantId };
            })
            .find((item) => item.driverId || item.assistantId);

          if (!candidate) {
            skippedRows.push({
              reason: 'Nhân sự đã kín ca trong ngày.',
              workDate,
              driver: driver ? getStaffName(driver) : null,
              assistant: assistant ? getStaffName(assistant) : null,
            });
            continue;
          }

          const { template, driverId, assistantId } = candidate;
          const { shift, created } = await createOrReuseShift({
            shiftCode: buildAutoShiftCode({ workDate, templateKey: template.key, driverId, assistantId }),
            workDate,
            startTime: template.startTime,
            endTime: template.endTime,
            shiftType: template.shiftType,
            shiftName: `${template.label} ${template.startTime}-${template.endTime} #${staffIndex + 1}`,
            description: 'Ca được hệ thống sinh tự động theo nhân sự đi làm trong ngày.',
          });

          let assignedPeople = 0;
          const assignmentErrors = [];

          if (driverId) {
            try {
              await adminService.assignDriverToSelectedShift(shift._id, { driverId });
              assignedPeople += 1;
              markBusy('driver', workDate, driverId);
            } catch (error) {
              assignmentErrors.push(error?.message || 'Không thể phân công tài xế.');
            }
          }

          if (assistantId) {
            try {
              await adminService.assignAssistantToSelectedShift(shift._id, { assistantId });
              assignedPeople += 1;
              markBusy('assistant', workDate, assistantId);
            } catch (error) {
              assignmentErrors.push(error?.message || 'Không thể phân công phụ xe.');
            }
          }

          if (assignedPeople > 0) {
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
  };  const openEdit = async (shift) => {
    setSelectedShift(shift);
    setEditForm({
      startTime: shift.startTime || OPERATING_START,
      endTime: shift.endTime || OPERATING_END,
      shiftType: shift.shiftType || 'CUSTOM',
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
            ['Cần kiỒm tra', summary.missing],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">{label}</p>
              <p className="mt-3 text-3xl font-black">{value}</p>
            </div>
          ))}
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
                  <h2 className="text-xl font-black">Tạo ca làm thủ công</h2>
                  <p className="text-sm text-slate-500">Mã ca và tên ca được hệ thống tự sinh theo ngày, giờ và loại ca.</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
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
                  <select value={form.shiftType} onChange={(event) => setForm((prev) => ({ ...prev, shiftType: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold">
                    <option value="MORNING">Ca sáng</option>
                    <option value="AFTERNOON">Ca chiều</option>
                    <option value="CUSTOM">Tùy chỉnh</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Ghi chú</span>
                  <input value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Ví dụ: tăng cường giờ cao điểm" className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold" />
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
                <Save size={18} /> Tạo ca cho khoảng ngày đã chọn
              </button>
            </form>

            <div className="rounded-3xl border border-emerald-100 bg-[#062819] p-6 text-white shadow-sm">
              <div className="flex items-center gap-3">
                <Wand2 className="text-emerald-300" size={25} />
                <div>
                  <h2 className="text-xl font-black">Sinh lịch phân ca tự động</h2>
                  <p className="text-sm text-emerald-50/75">Mỗi ngày sinh ca sáng/chiều cho các tài xế và phụ xe đã chọn, giới hạn trong khung vận hành 05:30 - 18:30.</p>
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
                      <p className="font-black">Tài xế đi làm</p>
                      <p className="text-xs text-emerald-50/70">{autoSelection.driverIds.length}/{availableDrivers.length} người rảnh được chọn</p>
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
                      <p className="font-black">Phụ xe đi làm</p>
                      <p className="text-xs text-emerald-50/70">{autoSelection.assistantIds.length}/{availableAssistants.length} người rảnh được chọn</p>
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
              {loading ? <span className="text-sm font-bold text-emerald-700">Đang tải...</span> : null}
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
                  {staff.drivers.map((driver) => <option key={driver._id} value={driver._id}>{getStaffName(driver)}</option>)}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Phụ xe</span>
                <select value={editForm.assistantId} onChange={(event) => setEditForm((prev) => ({ ...prev, assistantId: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold">
                  <option value="">Chưa gán phụ xe</option>
                  {staff.assistants.map((assistant) => <option key={assistant._id} value={assistant._id}>{getStaffName(assistant)}</option>)}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Trạng thái</span>
                <select value={editForm.status} onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold">
                  <option value="ACTIVE">Đang hiệu lực</option>
                  <option value="INACTIVE">Tạm ngưng</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Loại ca</span>
                <select value={editForm.shiftType} onChange={(event) => setEditForm((prev) => ({ ...prev, shiftType: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold">
                  <option value="MORNING">Ca sáng</option>
                  <option value="AFTERNOON">Ca chiều</option>
                  <option value="CUSTOM">Tùy chỉnh</option>
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


