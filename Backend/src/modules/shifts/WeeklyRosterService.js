import mongoose from 'mongoose';
import User from '../auth/User.js';
import FleetBus from '../admin/FleetBus.js';
import Route from '../routes/Route.js';
import Shift from './Shift.js';
import Roster from './Roster.js';
import DriverShiftAssignment from './DriverShiftAssignment.js';
import AssistantShiftAssignment from './AssistantShiftAssignment.js';
import VehicleShiftAssignment from './VehicleShiftAssignment.js';
import RouteOperatingConfig from './RouteOperatingConfig.js';
import ShiftService from './ShiftService.js';
import DRIVER_SCHEDULING_RULES from './driverScheduling.config.js';
import { calculateWorkload } from './WorkloadService.js';

const ACTIVE = ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];
const id = (value) => String(value?._id || value || '');
const day = (value) => { const result = new Date(value); if (Number.isNaN(result.getTime())) return null; result.setHours(0, 0, 0, 0); return result; };
const addDays = (value, count) => new Date(value.getFullYear(), value.getMonth(), value.getDate() + count);
const dateKey = (value) => { const date = day(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const weekRange = (value) => { const input = day(value); if (!input) throw Object.assign(new Error('Ngày bắt đầu tuần không hợp lệ.'), { statusCode: 400 }); const monday = addDays(input, -((input.getDay() + 6) % 7)); return { start: monday, end: addDays(monday, 7), last: addDays(monday, 6) }; };
const timeMinutes = (value) => { const [hours, minutes] = String(value || '').split(':').map(Number); return hours * 60 + minutes; };
const overlap = (left, right) => timeMinutes(left.startTime) < timeMinutes(right.endTime) && timeMinutes(right.startTime) < timeMinutes(left.endTime);
const leaveOn = (staff, workDate) => (staff?.staffAvailability?.leaveRequests || []).some((leave) => ['APPROVED', 'ACTIVE'].includes(String(leave.status || '').toUpperCase()) && day(leave.startDate || leave.date) <= workDate && day(leave.endDate || leave.date) >= workDate);
const issue = (type, assignment, message, extra = {}) => ({ type, date: assignment?.workDate ? dateKey(assignment.workDate) : '', shift: assignment?.shiftId?.shiftType || '', message, ...extra });
const SHIFT_WINDOWS = {
  MORNING: { startTime: DRIVER_SCHEDULING_RULES.morningShiftStart, endTime: DRIVER_SCHEDULING_RULES.morningShiftEnd, field: 'morning' },
  AFTERNOON: { startTime: DRIVER_SCHEDULING_RULES.afternoonShiftStart, endTime: DRIVER_SCHEDULING_RULES.afternoonShiftEnd, field: 'afternoon' },
};

const rosterPriority = (workload, shiftType) => {
  const targetMinutes = DRIVER_SCHEDULING_RULES.maxWeeklyWorkingMinutes;
  const assignedMinutes = Number(workload.totalMinutes || Math.round(Number(workload.totalHours || 0) * 60));
  const missingMinutes = Math.max(0, targetMinutes - assignedMinutes);
  const sameShiftCount = shiftType === 'MORNING' ? Number(workload.morningShifts || 0) : Number(workload.afternoonShifts || 0);
  const otherShiftCount = shiftType === 'MORNING' ? Number(workload.afternoonShifts || 0) : Number(workload.morningShifts || 0);
  const underHoursScore = Math.round((missingMinutes / targetMinutes) * 70);
  const balanceScore = sameShiftCount < otherShiftCount ? 15 : sameShiftCount === otherShiftCount ? 10 : 0;
  const fatigueScore = Math.max(0, 15 - Number(workload.consecutiveWorkingDays || 0) * 3);
  const score = Math.max(0, Math.min(100, underHoursScore + balanceScore + fatigueScore));
  const missingHours = Number((missingMinutes / 60).toFixed(1));
  const priorityLevel = missingMinutes >= 960 ? 'HIGH' : missingMinutes >= 480 ? 'MEDIUM' : 'LOW';
  const priorityReasons = [`Còn thiếu ${missingHours} giờ so với mục tiêu ${targetMinutes / 60} giờ/tuần`];
  if (sameShiftCount < otherShiftCount) priorityReasons.push(`Ưu tiên ca ${shiftType === 'MORNING' ? 'sáng' : 'chiều'} để cân bằng lịch`);
  if (workload.consecutiveWorkingDays >= DRIVER_SCHEDULING_RULES.maxConsecutiveWorkingDays - 1) priorityReasons.push('Đang gần giới hạn ngày làm liên tiếp');
  return { score, missingMinutes, missingHours, targetHours: targetMinutes / 60, priorityLevel, priorityReasons };
};

const requirementKey = (routeId, value) => `${id(routeId)}:${dateKey(value)}`;
const normalizeRequirement = (row) => ({
  routeId: row.routeId,
  date: day(row.date),
  morning: { vehicles: Math.max(0, Number(row.morning?.vehicles ?? row.morningRequiredVehicles ?? 0)), drivers: Math.max(0, Number(row.morning?.drivers ?? row.morningRequiredDrivers ?? 0)), assistants: Math.max(0, Number(row.morning?.assistants ?? row.morningRequiredAssistants ?? 0)) },
  afternoon: { vehicles: Math.max(0, Number(row.afternoon?.vehicles ?? row.afternoonRequiredVehicles ?? 0)), drivers: Math.max(0, Number(row.afternoon?.drivers ?? row.afternoonRequiredDrivers ?? 0)), assistants: Math.max(0, Number(row.afternoon?.assistants ?? row.afternoonRequiredAssistants ?? 0)) },
});

const loadAssignments = async (start, end) => {
  const filter = { workDate: { $gte: start, $lt: end }, status: { $in: ACTIVE } };
  const [drivers, assistants, vehicles] = await Promise.all([
    DriverShiftAssignment.find(filter).populate('driverId', 'fullName status staffAvailability role').populate({ path: 'shiftId', populate: { path: 'routeId', select: 'routeCode routeName' } }).lean(),
    AssistantShiftAssignment.find(filter).populate('assistantId', 'fullName status staffAvailability role').populate({ path: 'shiftId', populate: { path: 'routeId', select: 'routeCode routeName' } }).lean(),
    VehicleShiftAssignment.find(filter).populate('vehicleId', 'busCode plateNumber status').populate({ path: 'shiftId', populate: { path: 'routeId', select: 'routeCode routeName' } }).lean(),
  ]);
  return { drivers, assistants, vehicles };
};

const validateResourceAssignments = ({ rows, field, label, rules }) => {
  const errors = [];
  const grouped = new Map();
  rows.forEach((row) => grouped.set(id(row[field]), [...(grouped.get(id(row[field])) || []), row]));
  grouped.forEach((items, staffId) => {
    items.sort((a, b) => new Date(a.workDate) - new Date(b.workDate) || a.shiftId.startTime.localeCompare(b.shiftId.startTime));
    items.forEach((assignment, index) => {
      const staff = assignment[field];
      if (staff?.status !== 'ACTIVE') errors.push(issue('INACTIVE_STAFF', assignment, `${label} ${staff?.fullName || staffId} không hoạt động.`, { staffId }));
      if (leaveOn(staff, day(assignment.workDate))) errors.push(issue('STAFF_ON_LEAVE', assignment, `${label} ${staff?.fullName || staffId} đang nghỉ phép.`, { staffId }));
      items.slice(index + 1).filter((other) => day(other.workDate).getTime() === day(assignment.workDate).getTime() && overlap(assignment.shiftId, other.shiftId)).forEach((other) => errors.push(issue('STAFF_OVERLAP', assignment, `${label} ${staff?.fullName || staffId} bị trùng ${assignment.shiftId.startTime}-${assignment.shiftId.endTime} với ${other.shiftId.startTime}-${other.shiftId.endTime}.`, { staffId })));
      const next = items[index + 1];
      if (next) {
        const endAt = new Date(`${dateKey(assignment.workDate)}T${assignment.shiftId.endTime}:00`);
        const startAt = new Date(`${dateKey(next.workDate)}T${next.shiftId.startTime}:00`);
        if ((startAt - endAt) / 60000 < rules.minimumRestMinutes) errors.push(issue('MINIMUM_REST', next, `${label} ${staff?.fullName || staffId} không đủ ${rules.minimumRestMinutes / 60} giờ nghỉ tối thiểu.`, { staffId }));
      }
    });
  });
  return errors;
};

export default class WeeklyRosterService {
  static async defaultRequirements(weekStartDate) {
    const range = weekRange(weekStartDate);
    const [configs, routes] = await Promise.all([
      RouteOperatingConfig.find({ isActive: true, $or: [{ effectiveDate: { $gte: range.start, $lt: range.end } }, { effectiveDate: null, dayOfWeek: { $ne: null } }] }).lean(),
      Route.find({ status: 'PUBLISHED' }).select('routeCode routeName').sort({ routeCode: 1 }).lean(),
    ]);
    const routeMap = new Map(routes.map((route) => [id(route), route]));
    const result = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const workDate = addDays(range.start, offset);
      const daily = configs.filter((config) => (config.effectiveDate && day(config.effectiveDate).getTime() === workDate.getTime()) || (!config.effectiveDate && config.dayOfWeek === workDate.getDay()));
      const routeIds = [...new Set(daily.map((config) => id(config.routeId)).filter(Boolean))];
      const effectiveRoutes = routeIds.length ? routeIds : routes.map((route) => id(route));
      effectiveRoutes.forEach((routeId) => {
        const own = daily.filter((config) => id(config.routeId) === routeId);
        const counts = (type) => {
          const relevant = own.filter((config) => type === 'MORNING' ? config.startTime < '12:00' : config.endTime > '12:00');
          return {
            vehicles: Math.max(0, ...relevant.map((config) => Number(config.requiredVehicles || 0)), relevant.length ? 0 : 1),
            drivers: Math.max(0, ...relevant.map((config) => Number(config.requiredDrivers || 0)), relevant.length ? 0 : 1),
            assistants: Math.max(0, ...relevant.map((config) => Number(config.requiredAssistants || 0)), relevant.length ? 0 : 1),
          };
        };
        result.push({ routeId, route: routeMap.get(routeId) || null, date: workDate, morning: counts('MORNING'), afternoon: counts('AFTERNOON'), source: own.length ? 'ROUTE_DEFAULT' : 'SYSTEM_FALLBACK' });
      });
    }
    return result;
  }

  static async resolvedRequirements(weekStartDate) {
    const range = weekRange(weekStartDate);
    const [defaults, roster] = await Promise.all([this.defaultRequirements(range.start), Roster.findOne({ weekStartDate: range.start }).populate('routeRequirements.routeId', 'routeCode routeName').lean()]);
    const overrides = new Map((roster?.routeRequirements || []).map((row) => [requirementKey(row.routeId, row.date), row]));
    const resolved = defaults.map((row) => {
      const override = overrides.get(requirementKey(row.routeId, row.date));
      return override ? { ...normalizeRequirement(override), route: override.routeId, routeId: id(override.routeId), source: 'WEEKLY_OVERRIDE' } : row;
    });
    (roster?.routeRequirements || []).forEach((row) => {
      if (!defaults.some((item) => requirementKey(item.routeId, item.date) === requirementKey(row.routeId, row.date))) resolved.push({ ...normalizeRequirement(row), route: row.routeId, routeId: id(row.routeId), source: 'WEEKLY_OVERRIDE' });
    });
    return resolved.sort((a, b) => new Date(a.date) - new Date(b.date) || String(a.route?.routeCode || '').localeCompare(String(b.route?.routeCode || '')));
  }

  static async saveRequirements({ weekStartDate, routeRequirements, actorId }) {
    const range = weekRange(weekStartDate);
    if (!Array.isArray(routeRequirements)) throw Object.assign(new Error('Danh sách nhu cầu tuần không hợp lệ.'), { statusCode: 400 });
    const currentRoster = await Roster.findOne({ weekStartDate: range.start }).lean();
    if (currentRoster?.status === 'PUBLISHED') throw Object.assign(new Error('Phải mở chỉnh sửa roster trước khi đổi nhu cầu.'), { statusCode: 409 });
    const normalized = routeRequirements.map(normalizeRequirement);
    if (normalized.some((row) => !mongoose.Types.ObjectId.isValid(row.routeId) || !row.date || row.date < range.start || row.date >= range.end)) throw Object.assign(new Error('Tuyến hoặc ngày cấu hình nằm ngoài tuần đã chọn.'), { statusCode: 400 });
    if (new Set(normalized.map((row) => requirementKey(row.routeId, row.date))).size !== normalized.length) throw Object.assign(new Error('Mỗi tuyến chỉ được có một cấu hình cho mỗi ngày.'), { statusCode: 400 });
    const roster = await Roster.findOneAndUpdate({ weekStartDate: range.start }, { $set: { weekEndDate: range.last, routeRequirements: normalized, updatedBy: actorId }, $setOnInsert: { createdBy: actorId, status: 'DRAFT' } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
    return { roster, requirements: await this.resolvedRequirements(range.start) };
  }

  static async resetRequirements({ weekStartDate, actorId }) {
    const range = weekRange(weekStartDate);
    const roster = await Roster.findOne({ weekStartDate: range.start });
    if (roster?.status === 'PUBLISHED') throw Object.assign(new Error('Phải mở chỉnh sửa roster trước khi dùng lại cấu hình mặc định.'), { statusCode: 409 });
    await Roster.findOneAndUpdate({ weekStartDate: range.start }, { $set: { weekEndDate: range.last, routeRequirements: [], updatedBy: actorId }, $setOnInsert: { createdBy: actorId, status: 'DRAFT' } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return { requirements: await this.resolvedRequirements(range.start) };
  }

  static async get({ weekStartDate }) {
    const range = weekRange(weekStartDate);
    const [roster, assignments, staff] = await Promise.all([
      Roster.findOne({ weekStartDate: range.start }).lean(),
      loadAssignments(range.start, range.end),
      User.find({ role: { $in: ['DRIVER', 'CONDUCTOR', 'BUS_ASSISTANT'] }, status: 'ACTIVE' }).select('fullName role status').sort({ role: 1, fullName: 1 }).lean(),
    ]);
    const shifts = await Shift.find({ workDate: { $gte: range.start, $lt: range.end }, status: { $nin: ['ARCHIVED', 'CANCELLED'] } }).populate('routeId', 'routeCode routeName').sort({ workDate: 1, startTime: 1 }).lean();
    const driverByShift = new Map(assignments.drivers.map((row) => [id(row.shiftId), row]));
    const assistantByShift = new Map(assignments.assistants.map((row) => [id(row.shiftId), row]));
    const vehicleByShift = new Map(assignments.vehicles.map((row) => [id(row.shiftId), row]));
    const rows = shifts.map((shift) => ({ ...shift, driverAssignment: driverByShift.get(id(shift)) || null, assistantAssignment: assistantByShift.get(id(shift)) || null, vehicleAssignment: vehicleByShift.get(id(shift)) || null }));
    return { roster: roster || { weekStartDate: range.start, weekEndDate: range.last, status: 'DRAFT' }, days: Array.from({ length: 7 }, (_, index) => addDays(range.start, index)), staff, rows, requirements: await this.resolvedRequirements(range.start), workloads: { drivers: calculateWorkload(assignments.drivers, 'driverId'), assistants: calculateWorkload(assignments.assistants, 'assistantId') } };
  }

  static async availableStaff({ date, shiftType, role = 'DRIVER', excludeShiftId }) {
    const workDate = day(date); if (!workDate || !['MORNING', 'AFTERNOON'].includes(shiftType)) throw Object.assign(new Error('Ngày và loại ca là bắt buộc.'), { statusCode: 400 });
    const range = weekRange(workDate);
    const shiftWindow = shiftType === 'MORNING' ? { startTime: DRIVER_SCHEDULING_RULES.morningShiftStart, endTime: DRIVER_SCHEDULING_RULES.morningShiftEnd } : { startTime: DRIVER_SCHEDULING_RULES.afternoonShiftStart, endTime: DRIVER_SCHEDULING_RULES.afternoonShiftEnd };
    const userRoles = role === 'DRIVER' ? ['DRIVER'] : ['CONDUCTOR', 'BUS_ASSISTANT'];
    const [people, assignments] = await Promise.all([User.find({ role: { $in: userRoles } }).select('fullName role status staffAvailability').lean(), loadAssignments(range.start, range.end)]);
    const source = role === 'DRIVER' ? assignments.drivers : assignments.assistants;
    const field = role === 'DRIVER' ? 'driverId' : 'assistantId';
    const workloads = new Map(calculateWorkload(source, field).map((item) => [item.staffId, item]));
    return people.map((person) => {
      const own = source.filter((row) => id(row[field]) === id(person) && id(row.shiftId) !== id(excludeShiftId));
      const reasons = [];
      const reasonDetails = [];
      if (person.status !== 'ACTIVE') reasons.push('INACTIVE');
      if (leaveOn(person, workDate)) reasons.push('ON_LEAVE');
      const conflict = own.find((row) => day(row.workDate).getTime() === workDate.getTime() && overlap(row.shiftId, shiftWindow));
      if (conflict) { reasons.push('ALREADY_ASSIGNED'); reasonDetails.push({ code: 'ALREADY_ASSIGNED', message: `Đã được phân cho tuyến ${conflict.shiftId?.routeId?.routeCode || 'khác'} từ ${conflict.shiftId?.startTime}-${conflict.shiftId?.endTime}.`, routeId: id(conflict.shiftId?.routeId), routeCode: conflict.shiftId?.routeId?.routeCode || '', startTime: conflict.shiftId?.startTime, endTime: conflict.shiftId?.endTime }); }
      const workload = workloads.get(id(person)) || { totalShifts: 0, totalHours: 0, morningShifts: 0, afternoonShifts: 0, consecutiveWorkingDays: 0, remainingCapacity: DRIVER_SCHEDULING_RULES.maxShiftsPerWeek };
      if (workload.totalShifts >= DRIVER_SCHEDULING_RULES.maxShiftsPerWeek) reasons.push('WEEKLY_LIMIT');
      const priority = rosterPriority(workload, shiftType);
      if (reasons.includes('INACTIVE')) reasonDetails.push({ code: 'INACTIVE', message: 'Nhân sự đang ở trạng thái không hoạt động.' });
      if (reasons.includes('ON_LEAVE')) reasonDetails.push({ code: 'ON_LEAVE', message: 'Nhân sự đang có lịch nghỉ phép được duyệt.' });
      if (reasons.includes('WEEKLY_LIMIT')) reasonDetails.push({ code: 'WEEKLY_LIMIT', message: 'Nhân sự đã đạt giới hạn workload tuần.' });
      return { id: person._id, name: person.fullName, available: !reasons.length, unavailableReasons: reasons, unavailableDetails: reasonDetails, ...workload, ...priority, recommendation: !reasons.length && priority.score >= 70 ? 'RECOMMENDED' : reasons[0] || 'AVAILABLE' };
    }).sort((a, b) => Number(b.available) - Number(a.available) || b.score - a.score);
  }

  static async validate({ weekStartDate, persist = true }) {
    const range = weekRange(weekStartDate);
    const assignments = await loadAssignments(range.start, range.end);
    const shifts = await Shift.find({ workDate: { $gte: range.start, $lt: range.end }, status: { $nin: ['ARCHIVED', 'CANCELLED'] } }).lean();
    const errors = [
      ...validateResourceAssignments({ rows: assignments.drivers, field: 'driverId', label: 'Tài xế', rules: DRIVER_SCHEDULING_RULES }),
      ...validateResourceAssignments({ rows: assignments.assistants, field: 'assistantId', label: 'Phụ xe', rules: DRIVER_SCHEDULING_RULES }),
    ];
    const driverShiftIds = new Set(assignments.drivers.map((row) => id(row.shiftId)));
    const assistantShiftIds = new Set(assignments.assistants.map((row) => id(row.shiftId)));
    const vehicleShiftIds = new Set(assignments.vehicles.map((row) => id(row.shiftId)));
    shifts.forEach((shift) => {
      if (!shift.routeId) errors.push(issue('MISSING_ROUTE', { workDate: shift.workDate, shiftId: shift }, 'Ca chưa được gán tuyến.'));
      if (!driverShiftIds.has(id(shift))) errors.push(issue('MISSING_DRIVER', { workDate: shift.workDate, shiftId: shift }, 'Ca chưa có tài xế.', { routeId: id(shift.routeId) }));
      if (shift.requiresAssistant !== false && !assistantShiftIds.has(id(shift))) errors.push(issue('MISSING_ASSISTANT', { workDate: shift.workDate, shiftId: shift }, 'Ca chưa có phụ xe.', { routeId: id(shift.routeId) }));
      if (!vehicleShiftIds.has(id(shift))) errors.push(issue('MISSING_VEHICLE', { workDate: shift.workDate, shiftId: shift }, 'Ca chưa có xe.', { routeId: id(shift.routeId) }));
    });
    assignments.vehicles.forEach((assignment, index) => {
      if (['MAINTENANCE', 'OUT_OF_SERVICE'].includes(assignment.vehicleId?.status)) errors.push(issue('VEHICLE_UNAVAILABLE', assignment, `Xe ${assignment.vehicleId?.plateNumber || ''} không sẵn sàng.`));
      assignments.vehicles.slice(index + 1).filter((other) => id(other.vehicleId) === id(assignment.vehicleId) && day(other.workDate).getTime() === day(assignment.workDate).getTime() && overlap(other.shiftId, assignment.shiftId)).forEach(() => errors.push(issue('VEHICLE_OVERLAP', assignment, `Xe ${assignment.vehicleId?.plateNumber || ''} bị trùng lịch.`)));
    });
    const warnings = [];
    [...calculateWorkload(assignments.drivers, 'driverId'), ...calculateWorkload(assignments.assistants, 'assistantId')].forEach((workload) => {
      if (workload.totalShifts > DRIVER_SCHEDULING_RULES.maxShiftsPerWeek || workload.totalMinutes > DRIVER_SCHEDULING_RULES.maxWeeklyWorkingMinutes) errors.push({ type: 'MAX_WEEKLY_WORKLOAD', staffId: workload.staffId, message: `${workload.name} vượt giới hạn tuần.` });
      if (workload.consecutiveWorkingDays > DRIVER_SCHEDULING_RULES.maxConsecutiveWorkingDays) errors.push({ type: 'MAX_CONSECUTIVE_DAYS', staffId: workload.staffId, message: `${workload.name} làm quá nhiều ngày liên tục.` });
      if (Math.abs(workload.morningShifts - workload.afternoonShifts) >= 3) warnings.push({ type: 'UNBALANCED_SHIFT_DISTRIBUTION', staffId: workload.staffId, message: `${workload.name} có phân bổ sáng/chiều chưa cân bằng.` });
    });
    const validation = { valid: errors.length === 0, errors, warnings };
    if (persist) await Roster.findOneAndUpdate({ weekStartDate: range.start }, { $set: { weekEndDate: range.last, validation } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return validation;
  }

  static async autoGenerate({ weekStartDate, actorId }) {
    const range = weekRange(weekStartDate);
    const roster = await Roster.findOneAndUpdate({ weekStartDate: range.start }, { $setOnInsert: { weekEndDate: range.last, status: 'DRAFT', createdBy: actorId }, $set: { updatedBy: actorId } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    if (roster.status === 'PUBLISHED') throw Object.assign(new Error('Lịch đã công bố; hãy dùng thao tác chỉnh sửa rõ ràng trước khi sinh lại.'), { statusCode: 409 });
    const requirements = await this.resolvedRequirements(range.start);
    const vehicles = await FleetBus.find({ status: { $in: ['AVAILABLE', 'ACTIVE', 'RESERVE', 'ASSIGNED'] } }).sort({ busCode: 1 }).lean();
    const desiredCodes = new Set();
    const generatedAssignments = [];

    for (const requirement of requirements) {
      for (const [shiftType, window] of Object.entries(SHIFT_WINDOWS)) {
        const counts = requirement[window.field];
        const protectedShifts = await Shift.find({ workDate: day(requirement.date), routeId: requirement.routeId, shiftType, status: { $nin: ['ARCHIVED', 'CANCELLED'] }, $or: [{ isLocked: true }, { assignmentSource: 'MANUAL' }] }).lean();
        const slotCount = Math.max(0, Math.max(counts.drivers, counts.assistants, counts.vehicles) - protectedShifts.length);
        for (let index = 0; index < slotCount; index += 1) {
          const shiftCode = `ROSTER-${dateKey(requirement.date).replaceAll('-', '')}-${id(requirement.routeId).slice(-6)}-${shiftType}-${String(index + 1).padStart(3, '0')}`.toUpperCase();
          desiredCodes.add(shiftCode);
          let shift = await Shift.findOne({ shiftCode, workDate: day(requirement.date) });
          if (!shift) shift = await Shift.create({ shiftCode, shiftName: `${shiftType === 'MORNING' ? 'Ca sáng' : 'Ca chiều'} · ${requirement.route?.routeCode || id(requirement.routeId).slice(-6)} · ${index + 1}`, workDate: day(requirement.date), routeId: requirement.routeId, rosterId: roster._id, startTime: window.startTime, endTime: window.endTime, shiftType, requiresAssistant: index < counts.assistants, status: 'DRAFT', approvalStatus: 'DRAFT', assignmentSource: 'AUTO', createdBy: actorId, updatedBy: actorId });
          else if (!shift.isLocked && shift.assignmentSource !== 'MANUAL') {
            Object.assign(shift, { routeId: requirement.routeId, rosterId: roster._id, startTime: window.startTime, endTime: window.endTime, shiftType, requiresAssistant: index < counts.assistants, status: shift.status === 'ARCHIVED' ? 'DRAFT' : shift.status, assignmentSource: 'AUTO', updatedBy: actorId });
            await shift.save();
          }
          if (shift.isLocked || shift.assignmentSource === 'MANUAL') { generatedAssignments.push({ shiftId: shift._id, shiftCode, preserved: true }); continue; }

          if (index < counts.drivers && !await DriverShiftAssignment.exists({ shiftId: shift._id, status: { $in: ACTIVE } })) {
            const candidates = await this.availableStaff({ date: requirement.date, shiftType, role: 'DRIVER', excludeShiftId: shift._id });
            const candidate = candidates.find((person) => person.available);
            if (candidate) await ShiftService.assignDriverToShift(shift._id, { driverId: candidate.id, actorId });
          }
          if (index < counts.assistants && !await AssistantShiftAssignment.exists({ shiftId: shift._id, status: { $in: ACTIVE } })) {
            const candidates = await this.availableStaff({ date: requirement.date, shiftType, role: 'ASSISTANT', excludeShiftId: shift._id });
            const candidate = candidates.find((person) => person.available);
            if (candidate) await ShiftService.assignAssistantToShift(shift._id, { assistantId: candidate.id, actorId });
          }
          if (index < counts.vehicles && !await VehicleShiftAssignment.exists({ shiftId: shift._id, status: { $in: ACTIVE } })) {
            for (const vehicle of vehicles) {
              try { await ShiftService.assignVehicleToShift(shift._id, { vehicleId: vehicle._id, actorId }); break; } catch { /* Try the next operational vehicle. */ }
            }
          }
          generatedAssignments.push({ shiftId: shift._id, shiftCode, preserved: false });
        }
      }
    }

    const obsolete = await Shift.find({ rosterId: roster._id, assignmentSource: 'AUTO', isLocked: { $ne: true }, workDate: { $gte: range.start, $lt: range.end }, shiftCode: { $nin: [...desiredCodes] }, status: { $ne: 'ARCHIVED' } });
    for (const shift of obsolete) {
      shift.status = 'ARCHIVED'; shift.updatedBy = actorId; await shift.save();
      await DriverShiftAssignment.updateMany({ shiftId: shift._id, status: { $in: ACTIVE } }, { $set: { status: 'CANCELLED' } });
      await AssistantShiftAssignment.updateMany({ shiftId: shift._id, status: { $in: ACTIVE } }, { $set: { status: 'CANCELLED' } });
      await VehicleShiftAssignment.updateMany({ shiftId: shift._id, status: { $in: ACTIVE } }, { $set: { status: 'CANCELLED' } });
    }

    const activeRows = await Shift.find({ workDate: { $gte: range.start, $lt: range.end }, status: { $nin: ['ARCHIVED', 'CANCELLED'] } }).lean();
    const activeIds = activeRows.map((shift) => shift._id);
    const [driverRows, assistantRows, vehicleRows] = await Promise.all([
      DriverShiftAssignment.find({ shiftId: { $in: activeIds }, status: { $in: ACTIVE } }).lean(),
      AssistantShiftAssignment.find({ shiftId: { $in: activeIds }, status: { $in: ACTIVE } }).lean(),
      VehicleShiftAssignment.find({ shiftId: { $in: activeIds }, status: { $in: ACTIVE } }).lean(),
    ]);
    const shortages = [];
    requirements.forEach((requirement) => Object.entries(SHIFT_WINDOWS).forEach(([shiftType, window]) => {
      const shifts = activeRows.filter((shift) => id(shift.routeId) === id(requirement.routeId) && dateKey(shift.workDate) === dateKey(requirement.date) && shift.shiftType === shiftType);
      const shiftIds = new Set(shifts.map(id));
      const assigned = { DRIVER: driverRows.filter((row) => shiftIds.has(id(row.shiftId))).length, ASSISTANT: assistantRows.filter((row) => shiftIds.has(id(row.shiftId))).length, VEHICLE: vehicleRows.filter((row) => shiftIds.has(id(row.shiftId))).length };
      const required = { DRIVER: requirement[window.field].drivers, ASSISTANT: requirement[window.field].assistants, VEHICLE: requirement[window.field].vehicles };
      Object.keys(required).forEach((type) => { if (assigned[type] < required[type]) shortages.push({ date: dateKey(requirement.date), routeId: id(requirement.routeId), routeCode: requirement.route?.routeCode || '', shift: shiftType, type, required: required[type], assigned: assigned[type], shortage: required[type] - assigned[type] }); });
    }));
    return { roster, requirements, generatedAssignments, shortages, validation: await this.validate({ weekStartDate: range.start }) };
  }

  static async publish({ weekStartDate, actorId, transactionHook }) {
    const range = weekRange(weekStartDate); const validation = await this.validate({ weekStartDate: range.start, persist: false });
    if (!validation.valid) throw Object.assign(new Error('Không thể công bố lịch khi còn lỗi bắt buộc.'), { statusCode: 409, errors: validation.errors });
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const roster = await Roster.findOneAndUpdate({ weekStartDate: range.start }, { $set: { status: 'PUBLISHED', publishedAt: new Date(), publishedBy: actorId, updatedBy: actorId, validation } }, { new: true, session });
      if (!roster) throw Object.assign(new Error('Không tìm thấy lịch tuần.'), { statusCode: 404 });
      await transactionHook?.('AFTER_ROSTER_UPDATE', session);
      const publishableShifts = await Shift.find({ workDate: { $gte: range.start, $lt: range.end }, status: { $nin: ['ARCHIVED', 'CANCELLED'] } }).select('_id').session(session).lean();
      const shiftIds = publishableShifts.map((shift) => shift._id);
      if (!shiftIds.length) throw Object.assign(new Error('Lịch tuần chưa có ca làm để công bố.'), { statusCode: 409 });
      const assignmentFilter = { shiftId: { $in: shiftIds }, status: { $in: ACTIVE } };
      await Shift.updateMany({ _id: { $in: shiftIds } }, { $set: { status: 'PUBLISHED', approvalStatus: 'PUBLISHED', publishedAt: new Date(), isLocked: true, rosterId: roster._id } }, { session });
      await DriverShiftAssignment.updateMany(assignmentFilter, { $set: { rosterStatus: 'PUBLISHED' } }, { session });
      await AssistantShiftAssignment.updateMany(assignmentFilter, { $set: { rosterStatus: 'PUBLISHED' } }, { session });
      await VehicleShiftAssignment.updateMany(assignmentFilter, { $set: { rosterStatus: 'PUBLISHED' } }, { session });
      await session.commitTransaction(); return roster;
    } catch (error) { await session.abortTransaction(); throw error; } finally { await session.endSession(); }
  }

  static async reopen({ weekStartDate, actorId, transactionHook }) {
    const range = weekRange(weekStartDate);
    const roster = await Roster.findOne({ weekStartDate: range.start });
    if (!roster) throw Object.assign(new Error('Không tìm thấy lịch tuần.'), { statusCode: 404 });
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const updated = await Roster.findByIdAndUpdate(roster._id, { $set: { status: 'DRAFT', publishedAt: null, publishedBy: null, updatedBy: actorId } }, { new: true, session });
      await transactionHook?.('AFTER_ROSTER_UPDATE', session);
      const rosterShifts = await Shift.find({ rosterId: roster._id, workDate: { $gte: range.start, $lt: range.end }, status: 'PUBLISHED' }).select('_id').session(session).lean();
      const shiftIds = rosterShifts.map((shift) => shift._id);
      const assignmentFilter = { shiftId: { $in: shiftIds }, rosterStatus: 'PUBLISHED' };
      await Shift.updateMany({ _id: { $in: shiftIds } }, { $set: { status: 'ACTIVE', approvalStatus: 'DRAFT', publishedAt: null, isLocked: false, updatedBy: actorId } }, { session });
      await DriverShiftAssignment.updateMany(assignmentFilter, { $set: { rosterStatus: 'DRAFT' } }, { session });
      await AssistantShiftAssignment.updateMany(assignmentFilter, { $set: { rosterStatus: 'DRAFT' } }, { session });
      await VehicleShiftAssignment.updateMany(assignmentFilter, { $set: { rosterStatus: 'DRAFT' } }, { session });
      await session.commitTransaction(); return updated.toObject();
    } catch (error) { await session.abortTransaction(); throw error; } finally { await session.endSession(); }
  }
}
