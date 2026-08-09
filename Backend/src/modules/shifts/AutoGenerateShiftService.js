import mongoose from 'mongoose';
import User from '../auth/User.js';
import Route from '../routes/Route.js';
import FleetBus from '../admin/FleetBus.js';
import TripSchedule from '../admin/TripSchedule.js';
import Shift from './Shift.js';
import DriverShiftAssignment from './DriverShiftAssignment.js';
import AssistantShiftAssignment from './AssistantShiftAssignment.js';
import VehicleShiftAssignment from './VehicleShiftAssignment.js';
import TripShiftAssignment from './TripShiftAssignment.js';
import AssignmentLock from './AssignmentLock.js';
import RouteOperatingConfig from './RouteOperatingConfig.js';
import { scoreDriver, validateOperatingWindow } from './schedulingEngine.js';
import { splitRowsIntoCycleDuties, validateAtomicCycleDuties } from './shiftDutyPlanning.js';

const MAX_WORK_MINUTES = 8 * 60;
const MAX_WEEKLY_WORK_MINUTES = 40 * 60;
const MIN_REST_MINUTES = 60;
const ACTIVE_ASSIGNMENT_STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];
const SHIFT_TYPES = new Set(['MORNING', 'MIDDAY', 'AFTERNOON', 'EVENING', 'FULL_DAY', 'CUSTOM']);

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const dateKey = (value) => {
  const date = normalizeDate(value);
  if (!date) return '';
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
};

const dateToken = (value) => dateKey(value).replace(/-/g, '');

const addDays = (value, days) => {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  date.setHours(0, 0, 0, 0);
  return date;
};

const toMinutes = (value) => {
  if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return null;
  const [hours, minutes] = String(value).split(':').map(Number);
  if (hours > 23 || minutes > 59) return null;
  return (hours * 60) + minutes;
};

const rangeOf = ({ startTime, endTime }) => {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  return start === null || end === null || start >= end ? null : { start, end };
};

const overlaps = (first, second) => first.start < second.end && second.start < first.end;
const insideRange = (time, range) => {
  const value = toMinutes(time);
  return value !== null && value >= range.start && value <= range.end;
};

const getId = (value) => String(value?._id || value || '');

const normalizeVehicleType = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/đ/g, 'd')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export const vehicleTypeGroup = (value) => {
  const normalized = normalizeVehicleType(value);
  if (!normalized) return '';
  if (normalized.includes('electric') || normalized.includes('dien')) return 'ELECTRIC_BUS';
  if (normalized.includes('mini') || normalized.includes('minibus')) return 'MINIBUS';
  if (
    normalized.includes('standard city bus')
    || normalized.includes('xe buyt tieu chuan do thi')
    || normalized.includes('xe buyt thanh pho tieu chuan')
    || normalized.includes('xe buyt do thi')
    || normalized === 'city bus'
  ) return 'STANDARD_CITY_BUS';
  return normalized;
};

const vehicleMatchesRoute = (vehicle, route) => {
  const assignedBusIds = new Set((route?.vehicleAssignment?.assignedBuses || []).map((bus) => getId(bus.busId || bus._id)));
  if (assignedBusIds.has(getId(vehicle))) return true;
  const requiredType = route?.vehicleAssignment?.busType;
  return !requiredType || vehicleTypeGroup(vehicle.busType) === vehicleTypeGroup(requiredType);
};

const getLeaveRequests = (staff) => [
  ...(staff?.staffAvailability?.leaveRequests || []),
  ...(staff?.leaveRequests || []),
  ...(staff?.leaves || []),
];

const isOnLeave = (staff, workDate) => getLeaveRequests(staff).some((leave) => {
  const status = String(leave.status || '').toUpperCase();
  if (!['APPROVED', 'ACTIVE'].includes(status)) return false;
  const start = normalizeDate(leave.startDate || leave.fromDate || leave.date);
  const end = normalizeDate(leave.endDate || leave.toDate || leave.date);
  return start && end && workDate >= start && workDate <= end;
});

const hasSuitableLicense = (driver, requiredBusType, workDate) => {
  const license = driver?.driverLicense;
  if (!license?.licenseNumber && !(license?.permittedVehicleTypes || []).length) return true;
  if (['EXPIRED', 'SUSPENDED'].includes(license.status)) return false;
  if (license.expiresAt && new Date(license.expiresAt) < workDate) return false;
  const permitted = license.permittedVehicleTypes || [];
  return !requiredBusType || !permitted.length || permitted.some((type) => vehicleTypeGroup(type) === vehicleTypeGroup(requiredBusType));
};

const isVehicleOperational = (vehicle, workDate) => {
  if (!['AVAILABLE', 'ACTIVE', 'RESERVE', 'ASSIGNED'].includes(vehicle.status)) return false;
  const maintenanceStart = normalizeDate(vehicle.maintenance?.startDate);
  const maintenanceEnd = normalizeDate(vehicle.maintenance?.endDate);
  return !(maintenanceStart && maintenanceEnd && workDate >= maintenanceStart && workDate <= maintenanceEnd);
};

const loadAssignmentsForDate = async (workDate) => {
  const filter = { workDate, status: { $in: ACTIVE_ASSIGNMENT_STATUSES } };
  const [drivers, assistants, vehicles] = await Promise.all([
    DriverShiftAssignment.find(filter).populate('shiftId').lean(),
    AssistantShiftAssignment.find(filter).populate('shiftId').lean(),
    VehicleShiftAssignment.find(filter).populate('shiftId').lean(),
  ]);
  return { drivers, assistants, vehicles };
};

const weekBounds = (workDate) => {
  const start = normalizeDate(workDate);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return { start, end: addDays(start, 7) };
};

const loadStaffAssignmentsForWeek = async (workDate) => {
  const { start, end } = weekBounds(workDate);
  const filter = { workDate: { $gte: start, $lt: end }, status: { $in: ACTIVE_ASSIGNMENT_STATUSES } };
  const [drivers, assistants] = await Promise.all([
    DriverShiftAssignment.find(filter).populate('shiftId').lean(),
    AssistantShiftAssignment.find(filter).populate('shiftId').lean(),
  ]);
  return { drivers, assistants };
};

const assignmentConflicts = (assignments, resourceField, resourceId, range) => assignments.some((assignment) => {
  if (getId(assignment[resourceField]) !== String(resourceId)) return false;
  const assignedRange = rangeOf(assignment.shiftId || {});
  return assignedRange && overlaps(range, assignedRange);
});

const assignedMinutes = (assignments, resourceField, resourceId) => assignments.reduce((total, assignment) => {
  if (getId(assignment[resourceField]) !== String(resourceId)) return total;
  const range = rangeOf(assignment.shiftId || {});
  return total + (range ? range.end - range.start : 0);
}, 0);

const minimumRestMinutes = (assignments, resourceField, resourceId, range) => assignments.reduce((minimum, assignment) => {
  if (getId(assignment[resourceField]) !== String(resourceId)) return minimum;
  const assignedRange = rangeOf(assignment.shiftId || {});
  if (!assignedRange || overlaps(range, assignedRange)) return minimum;
  const rest = assignedRange.end <= range.start ? range.start - assignedRange.end : assignedRange.start - range.end;
  return Math.min(minimum, rest);
}, 24 * 60);

const publicDriver = (driver) => ({
  _id: driver._id,
  fullName: driver.fullName,
  email: driver.email,
  phoneNumber: driver.phoneNumber,
  driverLicense: driver.driverLicense,
});

const hasInsufficientRest = (assignments, resourceField, resourceId, range) => assignments.some((assignment) => {
  if (getId(assignment[resourceField]) !== String(resourceId)) return false;
  const assignedRange = rangeOf(assignment.shiftId || {});
  if (!assignedRange || overlaps(range, assignedRange)) return false;
  const rest = assignedRange.end <= range.start ? range.start - assignedRange.end : assignedRange.start - range.end;
  return rest < MIN_REST_MINUTES;
});

const clockValue = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const preservesFutureDriverCoverage = async ({ driverId, workDate, currentRange, assignments }) => {
  const configs = await RouteOperatingConfig.find({
    isActive: true,
    $or: [
      { effectiveDate: { $gte: workDate, $lt: addDays(workDate, 1) } },
      { effectiveDate: null, dayOfWeek: workDate.getDay() },
    ],
    startTime: { $gte: clockValue(currentRange.end) },
  }).lean();
  if (!configs.length) return true;
  const allDrivers = await User.find({ role: 'DRIVER', status: 'ACTIVE' }).select('staffAvailability').lean();
  return configs.every((config) => {
    const slotRange = rangeOf(config);
    const available = allDrivers.filter((driver) => (
      !isOnLeave(driver, workDate)
      && !assignmentConflicts(assignments.drivers, 'driverId', driver._id, slotRange)
      && assignedMinutes(assignments.drivers, 'driverId', driver._id)
        + (getId(driver) === getId(driverId) ? currentRange.end - currentRange.start : 0)
        + slotRange.end - slotRange.start <= MAX_WORK_MINUTES
    )).length;
    return available >= Number(config.requiredDrivers || 0);
  });
};

const publicAssistant = (assistant) => ({
  _id: assistant._id,
  fullName: assistant.fullName,
  email: assistant.email,
  phoneNumber: assistant.phoneNumber,
});

const publicVehicle = (vehicle) => ({
  _id: vehicle._id,
  busCode: vehicle.busCode,
  plateNumber: vehicle.plateNumber,
  busType: vehicle.busType,
  capacity: vehicle.capacity,
});

const validateBaseRequest = (body) => {
  const errors = [];
  const startDate = normalizeDate(body.startDate || body.date || body.workDate);
  const endDate = normalizeDate(body.endDate || body.date || body.workDate);
  const range = rangeOf(body);
  errors.push(...validateOperatingWindow(body));
  if (!mongoose.Types.ObjectId.isValid(body.routeId)) errors.push('Tuyến xe là bắt buộc.');
  if (!startDate || !endDate) errors.push('Ngày hoặc khoảng ngày là bắt buộc.');
  if (startDate && endDate && startDate > endDate) errors.push('Ngày bắt đầu phải trước ngày kết thúc.');
  if (!range) errors.push('Giờ bắt đầu phải nhỏ hơn giờ kết thúc.');
  const requestedTrips = Number(body.numberOfTrips || 0);
  if (requestedTrips > 0 && (requestedTrips < 2 || requestedTrips % 2 !== 0)) errors.push('Số lượt phải là số chẵn và ít nhất là 2 để giữ đủ cặp D-V.');
  if (startDate && endDate && ((endDate - startDate) / 86400000) > 31) errors.push('Chỉ được sinh tối đa 31 ngày mỗi lần.');
  return { errors, startDate, endDate, range };
};

const buildStatus = ({ warnings, driverId, assistantId, vehicleId, tripIds }) => {
  if (warnings.some((warning) => warning.level === 'ERROR')) return 'CONFLICT';
  if (!driverId || !assistantId || !vehicleId || !tripIds.length) return 'NEED_MANUAL_ASSIGNMENT';
  return 'VALID';
};

const allocateDutyResources = (rows, body) => {
  const totals = new Map();
  const reservations = new Map();
  rows.forEach((row) => {
    const rowRange = rangeOf(row);
    [
      ['driver', 'driverId', 'availableDrivers', body.autoAssignDriver !== false],
      ['assistant', 'assistantId', 'availableAssistants', body.autoAssignAssistant !== false],
      ['vehicle', 'vehicleId', 'availableVehicles', body.autoAssignVehicle !== false],
    ].forEach(([kind, idField, optionsField, autoAssign]) => {
      if (!autoAssign) {
        row[idField] = '';
        row[kind] = null;
        return;
      }
      const duration = rowRange.end - rowRange.start;
      const candidate = (row[optionsField] || []).find((option) => {
        const key = `${kind}:${row.workDate}:${getId(option)}`;
        const requiredGap = kind === 'vehicle' ? 10 : MIN_REST_MINUTES;
        const conflicts = (reservations.get(key) || []).some((reserved) => {
          if (overlaps(rowRange, reserved)) return true;
          const gap = rowRange.start >= reserved.end
            ? rowRange.start - reserved.end
            : reserved.start - rowRange.end;
          return gap < requiredGap;
        });
        return !conflicts
          && (kind === 'vehicle' || (totals.get(key) || 0) + duration <= MAX_WORK_MINUTES);
      });
      row[idField] = candidate?._id || '';
      row[kind] = candidate || null;
      if (candidate) {
        const key = `${kind}:${row.workDate}:${getId(candidate)}`;
        totals.set(key, (totals.get(key) || 0) + duration);
        reservations.set(key, [...(reservations.get(key) || []), rowRange]);
      }
    });
    row.status = buildStatus(row);
  });
  return rows;
};

const shiftNameFor = (shiftType) => ({
  MORNING: 'Ca sáng',
  MIDDAY: 'Ca trưa',
  AFTERNOON: 'Ca chiều',
  EVENING: 'Ca tối',
  FULL_DAY: 'Ca cả ngày',
  CUSTOM: 'Ca tùy chỉnh',
}[shiftType] || 'Ca tùy chỉnh');

const priorityLabelFor = (score) => {
  if (score >= 80) return 'HIGH';
  if (score >= 60) return 'MEDIUM';
  return 'NORMAL';
};

export const buildExperiencePriority = ({ staff, assignments, tripCountByShift, targetRouteIds }) => {
  const routeCounts = new Map();
  let completedShiftCount = 0;
  let completedTripCount = 0;
  let lastCompletedAt = null;

  assignments.forEach((assignment) => {
    const shift = assignment.shiftId;
    if (!shift) return;
    const routeId = getId(shift.routeId);
    completedShiftCount += 1;
    completedTripCount += tripCountByShift.get(getId(shift)) || 0;
    if (routeId) routeCounts.set(routeId, (routeCounts.get(routeId) || 0) + 1);
    const completedAt = assignment.updatedAt || shift.actualEndDateTime || shift.workDate;
    if (completedAt && (!lastCompletedAt || new Date(completedAt) > new Date(lastCompletedAt))) {
      lastCompletedAt = completedAt;
    }
  });

  const relevantRouteCount = targetRouteIds.length
    ? targetRouteIds.reduce((total, routeId) => total + (routeCounts.get(routeId) || 0), 0)
    : completedShiftCount;
  const relevantTripCount = targetRouteIds.length
    ? assignments.reduce((total, assignment) => (
      targetRouteIds.includes(getId(assignment.shiftId?.routeId))
        ? total + (tripCountByShift.get(getId(assignment.shiftId)) || 0)
        : total
    ), 0)
    : completedTripCount;
  const recencyDays = lastCompletedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(lastCompletedAt).getTime()) / 86400000))
    : null;
  const experiencePoints = Math.min(30, relevantRouteCount * 3);
  const tripPoints = Math.min(20, relevantTripCount * 2);
  const generalPoints = Math.min(10, completedShiftCount);
  const recencyPoints = recencyDays !== null && recencyDays <= 90 ? Math.max(0, 10 - Math.floor(recencyDays / 10)) : 0;
  const score = Math.min(100, 30 + experiencePoints + tripPoints + generalPoints + recencyPoints);
  const reasons = [];
  if (relevantRouteCount) reasons.push(`Đã hoàn thành ${relevantRouteCount} ca trên tuyến đang cần`);
  if (relevantTripCount) reasons.push(`Có kinh nghiệm ${relevantTripCount} lượt chạy liên quan`);
  if (recencyDays !== null && recencyDays <= 30) reasons.push('Có kinh nghiệm vận hành gần đây');
  if (!reasons.length) reasons.push('Đủ điều kiện nhưng chưa có lịch sử trên tuyến đang cần');

  return {
    staffId: getId(staff),
    suitabilityScore: score,
    priorityLevel: priorityLabelFor(score),
    routeExperienceCount: relevantRouteCount,
    tripExperienceCount: relevantTripCount,
    completedShiftCount,
    lastCompletedAt,
    reasons,
  };
};

export default class AutoGenerateShiftService {
  static async rankStaffPriorities({ routeIds = '', lookbackDays = 365 } = {}) {
    const targetRouteIds = String(routeIds || '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => mongoose.Types.ObjectId.isValid(value));
    const historyStart = new Date();
    historyStart.setDate(historyStart.getDate() - Math.min(1095, Math.max(30, Number(lookbackDays) || 365)));
    historyStart.setHours(0, 0, 0, 0);

    const [drivers, assistants, completedDriverAssignments, completedAssistantAssignments] = await Promise.all([
      User.find({ role: 'DRIVER', status: 'ACTIVE', 'accountLock.isLocked': { $ne: true } }).select('fullName email phoneNumber').lean(),
      User.find({ role: { $in: ['CONDUCTOR', 'BUS_ASSISTANT'] }, status: 'ACTIVE', 'accountLock.isLocked': { $ne: true } }).select('fullName email phoneNumber').lean(),
      DriverShiftAssignment.find({ status: 'COMPLETED', workDate: { $gte: historyStart } }).populate({ path: 'shiftId', select: 'routeId workDate actualEndDateTime' }).lean(),
      AssistantShiftAssignment.find({ status: 'COMPLETED', workDate: { $gte: historyStart } }).populate({ path: 'shiftId', select: 'routeId workDate actualEndDateTime' }).lean(),
    ]);

    const completedShiftIds = [...new Set([
      ...completedDriverAssignments.map((item) => getId(item.shiftId)),
      ...completedAssistantAssignments.map((item) => getId(item.shiftId)),
    ].filter(Boolean))];
    const tripCounts = completedShiftIds.length
      ? await TripShiftAssignment.aggregate([
        { $match: { shiftId: { $in: completedShiftIds.map((id) => new mongoose.Types.ObjectId(id)) }, status: 'COMPLETED' } },
        { $group: { _id: '$shiftId', count: { $sum: 1 } } },
      ])
      : [];
    const tripCountByShift = new Map(tripCounts.map((item) => [getId(item._id), item.count]));
    const groupByStaff = (rows, field) => rows.reduce((map, item) => {
      const id = getId(item[field]);
      map.set(id, [...(map.get(id) || []), item]);
      return map;
    }, new Map());
    const driverHistory = groupByStaff(completedDriverAssignments, 'driverId');
    const assistantHistory = groupByStaff(completedAssistantAssignments, 'assistantId');
    const rank = (people, history) => people
      .map((staff) => ({
        ...publicAssistant(staff),
        ...buildExperiencePriority({
          staff,
          assignments: history.get(getId(staff)) || [],
          tripCountByShift,
          targetRouteIds,
        }),
      }))
      .sort((left, right) => right.suitabilityScore - left.suitabilityScore || left.fullName.localeCompare(right.fullName, 'vi'))
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return {
      routeIds: targetRouteIds,
      lookbackDays: Math.min(1095, Math.max(30, Number(lookbackDays) || 365)),
      drivers: rank(drivers, driverHistory),
      assistants: rank(assistants, assistantHistory),
    };
  }

  static async populateDutyResources(rows, routeId) {
    return Promise.all(rows.map(async (row) => {
      const [availableDrivers, availableAssistants, availableVehicles] = await Promise.all([
        this.listAvailableResources({ kind: 'drivers', workDate: row.workDate, startTime: row.startTime, endTime: row.endTime, routeId, shiftType: row.shiftType }),
        this.listAvailableResources({ kind: 'assistants', workDate: row.workDate, startTime: row.startTime, endTime: row.endTime, routeId, shiftType: row.shiftType }),
        this.listAvailableResources({ kind: 'vehicles', workDate: row.workDate, startTime: row.startTime, endTime: row.endTime, routeId }),
      ]);
      return { ...row, availableDrivers, availableAssistants, availableVehicles };
    }));
  }

  static async listAvailableResources({ kind, workDate, startTime, endTime, routeId, shiftType }) {
    const date = normalizeDate(workDate);
    const range = rangeOf({ startTime, endTime });
    if (!date || !range) throw Object.assign(new Error('Ngày và khung giờ hợp lệ là bắt buộc.'), { statusCode: 400 });
    const route = mongoose.Types.ObjectId.isValid(routeId) ? await Route.findById(routeId).lean() : null;
    const assignments = await loadAssignmentsForDate(date);
    const weeklyAssignments = await loadStaffAssignmentsForWeek(date);
    const duration = range.end - range.start;

    if (kind === 'drivers') {
      const rows = await User.find({ role: 'DRIVER', status: 'ACTIVE', 'accountLock.isLocked': { $ne: true } }).sort({ fullName: 1 }).lean();
      return rows.filter((row) => (
        !isOnLeave(row, date)
        && hasSuitableLicense(row, route?.vehicleAssignment?.busType, date)
        && !assignmentConflicts(assignments.drivers, 'driverId', row._id, range)
        && !hasInsufficientRest(assignments.drivers, 'driverId', row._id, range)
        && assignedMinutes(assignments.drivers, 'driverId', row._id) + duration <= MAX_WORK_MINUTES
        && assignedMinutes(weeklyAssignments.drivers, 'driverId', row._id) + duration <= MAX_WEEKLY_WORK_MINUTES
      )).map((row) => {
        const minutes = assignedMinutes(assignments.drivers, 'driverId', row._id);
        const weeklyMinutes = assignedMinutes(weeklyAssignments.drivers, 'driverId', row._id);
        const ownWeekly = weeklyAssignments.drivers.filter((item) => getId(item.driverId) === getId(row));
        return { ...publicDriver(row), assignedMinutes: minutes, assignedWeeklyMinutes: weeklyMinutes, ...scoreDriver({
          driverId: row._id,
          assignedMinutes: weeklyMinutes,
          targetMinutes: MAX_WEEKLY_WORK_MINUTES,
          morningShiftCount: ownWeekly.filter((item) => item.shiftId?.shiftType === 'MORNING').length,
          afternoonShiftCount: ownWeekly.filter((item) => item.shiftId?.shiftType === 'AFTERNOON').length,
          peakShiftCount: ownWeekly.filter((item) => item.shiftId?.startTime < '09:00' || item.shiftId?.endTime > '16:00').length,
          routeExperience: ownWeekly.some((item) => getId(item.shiftId?.routeId) === getId(route)),
          restMinutes: minimumRestMinutes(assignments.drivers, 'driverId', row._id, range),
          shiftType,
        }) };
      }).sort((left, right) => right.score - left.score || left.fullName.localeCompare(right.fullName, 'vi'));
    }
    if (kind === 'assistants') {
      const rows = await User.find({ role: { $in: ['CONDUCTOR', 'BUS_ASSISTANT'] }, status: 'ACTIVE', 'accountLock.isLocked': { $ne: true } }).sort({ fullName: 1 }).lean();
      return rows.filter((row) => (
        !isOnLeave(row, date)
        && !assignmentConflicts(assignments.assistants, 'assistantId', row._id, range)
        && !hasInsufficientRest(assignments.assistants, 'assistantId', row._id, range)
        && assignedMinutes(assignments.assistants, 'assistantId', row._id) + duration <= MAX_WORK_MINUTES
        && assignedMinutes(weeklyAssignments.assistants, 'assistantId', row._id) + duration <= MAX_WEEKLY_WORK_MINUTES
      )).map((row) => {
        const weeklyMinutes = assignedMinutes(weeklyAssignments.assistants, 'assistantId', row._id);
        const score = scoreDriver({ driverId: row._id, assignedMinutes: weeklyMinutes, targetMinutes: MAX_WEEKLY_WORK_MINUTES, restMinutes: minimumRestMinutes(assignments.assistants, 'assistantId', row._id, range), shiftType });
        return { ...publicAssistant(row), assignedWeeklyMinutes: weeklyMinutes, score: score.score, reasons: score.reasons, warnings: score.warnings };
      }).sort((left, right) => right.score - left.score || left.fullName.localeCompare(right.fullName, 'vi'));
    }
    const rows = await FleetBus.find({
      status: { $in: ['AVAILABLE', 'ACTIVE', 'RESERVE', 'ASSIGNED'] },
      busCode: { $not: /^(DN-AUTO-|DN-DEMO-)/i },
    }).sort({ busCode: 1 }).lean();
    return rows.filter((row) => (
      isVehicleOperational(row, date)
      && vehicleMatchesRoute(row, route)
      && !assignmentConflicts(assignments.vehicles, 'vehicleId', row._id, range)
    )).map(publicVehicle);
  }

  static async generatePreview(body) {
    const { errors, startDate, endDate, range } = validateBaseRequest(body);
    if (errors.length) throw Object.assign(new Error(errors[0]), { statusCode: 400, errors });
    if (!body._segmenting && range.end - range.start > MAX_WORK_MINUTES) {
      const clock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      const duration = range.end - range.start;
      const windows = duration <= MAX_WORK_MINUTES * 2
        ? [
          { startTime: clock(range.start), endTime: clock(range.start + MAX_WORK_MINUTES) },
          { startTime: clock(range.end - MAX_WORK_MINUTES), endTime: clock(range.end) },
        ]
        : [];
      for (let cursor = range.start; !windows.length && cursor < range.end; cursor += MAX_WORK_MINUTES) {
        const end = Math.min(cursor + MAX_WORK_MINUTES, range.end);
        windows.push({ startTime: clock(cursor), endTime: clock(end) });
      }
      const previews = [];
      for (let index = 0; index < windows.length; index += 1) {
        previews.push(await this.generatePreview({
          ...body,
          ...windows[index],
          _segmenting: true,
          shiftType: index === 0 ? 'MORNING' : 'AFTERNOON',
          numberOfTrips: 0,
        }));
      }
      let rows = splitRowsIntoCycleDuties(previews.flatMap((preview) => preview.rows));
      const dutyErrors = validateAtomicCycleDuties(rows, rows.flatMap((row) => row.trips || []));
      if (dutyErrors.length) throw Object.assign(new Error('Dữ liệu chuyến không tạo thành các cặp D-V hợp lệ.'), { statusCode: 409, conflicts: dutyErrors });
      rows = await this.populateDutyResources(rows, body.routeId);
      rows.forEach((row, index) => {
        row.previewId = `${dateToken(row.workDate)}-${index + 1}`;
        row.shiftCode = `AUTO-${row.route.routeCode}-${dateToken(row.workDate)}-${String(index + 1).padStart(2, '0')}`;
      });
      rows = allocateDutyResources(rows, body);
      return {
        previewToken: new mongoose.Types.ObjectId().toString(),
        generatedAt: new Date(),
        route: previews[0]?.route,
        rows,
        summary: {
          total: rows.length,
          valid: rows.filter((row) => row.status === 'VALID').length,
          needManualAssignment: rows.filter((row) => row.status === 'NEED_MANUAL_ASSIGNMENT').length,
          conflicts: rows.filter((row) => row.status === 'CONFLICT').length,
        },
      };
    }
    const route = await Route.findById(body.routeId).lean();
    if (!route) throw Object.assign(new Error('Không tìm thấy tuyến xe.'), { statusCode: 404 });

    const shiftType = SHIFT_TYPES.has(String(body.shiftType || '').toUpperCase())
      ? String(body.shiftType).toUpperCase()
      : 'CUSTOM';
    const selectedTripIds = (body.tripIds || []).filter((id) => mongoose.Types.ObjectId.isValid(id));
    const numberOfTrips = Math.max(0, Number(body.numberOfTrips || 0));
    const modes = {
      vehicle: body.vehicleAssignmentMode || (body.autoAssignVehicle ? 'AUTO' : 'MANUAL'),
      driver: body.driverAssignmentMode || (body.autoAssignDriver ? 'AUTO' : 'MANUAL'),
      assistant: body.assistantAssignmentMode || (body.autoAssignAssistant ? 'AUTO' : 'MANUAL'),
    };
    const rows = [];

    for (let date = new Date(startDate); date <= endDate; date = addDays(date, 1)) {
      const warnings = [];
      const existingShift = await Shift.findOne({
        routeId: route._id,
        workDate: date,
        status: { $ne: 'ARCHIVED' },
        startTime: { $lt: body.endTime },
        endTime: { $gt: body.startTime },
      }).lean();
      if (existingShift) warnings.push({ level: 'ERROR', message: `Trùng với ca ${existingShift.shiftCode}.` });

      const tripFilter = {
        routeId: route._id,
        serviceDate: date,
        status: { $nin: ['CANCELLED', 'COMPLETED'] },
        departureTime: { $gte: body.startTime, $lte: body.endTime },
        ...(selectedTripIds.length ? { _id: { $in: selectedTripIds } } : {}),
      };
      let trips = await TripSchedule.find(tripFilter).sort({ departureTime: 1 }).lean();
      trips = trips.filter((trip) => insideRange(trip.departureTime, range) && insideRange(trip.expectedArrivalTime, range));
      const availableTrips = trips;
      if (!selectedTripIds.length && numberOfTrips > 0) {
        const completeCycleCodes = [...new Set(trips.map((trip) => trip.operationCycleCode).filter(Boolean))]
          .filter((cycleCode) => {
            const cycleTrips = trips.filter((trip) => trip.operationCycleCode === cycleCode);
            return cycleTrips.length === 2
              && cycleTrips.some((trip) => trip.direction === 'OUTBOUND')
              && cycleTrips.some((trip) => trip.direction === 'INBOUND');
          })
          .slice(0, Math.floor(numberOfTrips / 2));
        trips = trips.filter((trip) => completeCycleCodes.includes(trip.operationCycleCode));
      }
      if (!trips.length) warnings.push({ level: 'WARNING', message: 'Chưa có chuyến phù hợp trong khung giờ.' });

      const [drivers, assistants, vehicles] = await Promise.all([
        this.listAvailableResources({ kind: 'drivers', workDate: date, startTime: body.startTime, endTime: body.endTime, routeId: route._id, shiftType }),
        this.listAvailableResources({ kind: 'assistants', workDate: date, startTime: body.startTime, endTime: body.endTime, routeId: route._id, shiftType }),
        this.listAvailableResources({ kind: 'vehicles', workDate: date, startTime: body.startTime, endTime: body.endTime, routeId: route._id }),
      ]);

      let driver = null;
      if (modes.driver === 'AUTO') {
        const dayAssignments = await loadAssignmentsForDate(date);
        for (const candidate of drivers) {
          if (await preservesFutureDriverCoverage({ driverId: candidate._id, workDate: date, currentRange: range, assignments: dayAssignments })) {
            driver = candidate;
            break;
          }
        }
      }
      const assistant = modes.assistant === 'AUTO' ? assistants[0] : null;
      const vehicle = modes.vehicle === 'AUTO' ? vehicles[0] : null;
      if (modes.driver === 'AUTO' && !driver) warnings.push({ level: 'WARNING', message: 'Không tìm được tài xế phù hợp mà vẫn bảo toàn đủ nhân lực cho các khung giờ sau.' });
      if (modes.assistant === 'AUTO' && !assistant) warnings.push({ level: 'WARNING', message: 'Không tìm được phụ xe phù hợp.' });
      if (modes.vehicle === 'AUTO' && !vehicle) warnings.push({ level: 'WARNING', message: 'Không tìm được xe phù hợp.' });

      const sequence = rows.length + 1;
      const row = {
        previewId: `${dateToken(date)}-${sequence}`,
        shiftCode: `AUTO-${route.routeCode}-${dateToken(date)}-${String(sequence).padStart(2, '0')}`,
        shiftName: `${shiftNameFor(shiftType)} - ${route.routeCode}`,
        routeId: route._id,
        route: { _id: route._id, routeCode: route.routeCode, routeName: route.routeName },
        workDate: dateKey(date),
        startTime: body.startTime,
        endTime: body.endTime,
        shiftType,
        vehicleId: vehicle?._id || '',
        vehicle,
        driverId: driver?._id || '',
        driver,
        assistantId: assistant?._id || '',
        assistant,
        tripIds: trips.map((trip) => trip._id),
        trips: trips.map((trip) => ({
          _id: trip._id,
          scheduleCode: trip.scheduleCode,
          operationCycleCode: trip.operationCycleCode,
          direction: trip.direction,
          departureTime: trip.departureTime,
          expectedArrivalTime: trip.expectedArrivalTime,
        })),
        availableTrips: availableTrips.map((trip) => ({
          _id: trip._id,
          scheduleCode: trip.scheduleCode,
          operationCycleCode: trip.operationCycleCode,
          direction: trip.direction,
          departureTime: trip.departureTime,
          expectedArrivalTime: trip.expectedArrivalTime,
        })),
        availableDrivers: drivers,
        availableAssistants: assistants,
        availableVehicles: vehicles,
        warnings,
      };
      row.status = buildStatus(row);
      row.warningMessage = warnings.map((warning) => warning.message).join(' ');
      rows.push(row);
    }

    let dutyRows = splitRowsIntoCycleDuties(rows);
    const dutyErrors = validateAtomicCycleDuties(dutyRows, dutyRows.flatMap((row) => row.trips || []));
    if (dutyErrors.length) throw Object.assign(new Error('Dữ liệu chuyến không tạo thành các cặp D-V hợp lệ.'), { statusCode: 409, conflicts: dutyErrors });
    dutyRows = await this.populateDutyResources(dutyRows, route._id);
    dutyRows = allocateDutyResources(dutyRows, body);
    return {
      previewToken: new mongoose.Types.ObjectId().toString(),
      generatedAt: new Date(),
      route: { _id: route._id, routeCode: route.routeCode, routeName: route.routeName },
      rows: dutyRows,
      summary: {
        total: dutyRows.length,
        valid: dutyRows.filter((row) => row.status === 'VALID').length,
        needManualAssignment: dutyRows.filter((row) => row.status === 'NEED_MANUAL_ASSIGNMENT').length,
        conflicts: dutyRows.filter((row) => row.status === 'CONFLICT').length,
      },
    };
  }

  static async validateConfirmRow(row) {
    const warnings = [];
    let existingWeeklyDriverMinutes = 0;
    let existingWeeklyAssistantMinutes = 0;
    const workDate = normalizeDate(row.workDate);
    const range = rangeOf(row);
    warnings.push(...validateOperatingWindow(row));
    if (!workDate || !range) warnings.push('Ngày hoặc khung giờ không hợp lệ.');
    if (!mongoose.Types.ObjectId.isValid(row.routeId)) warnings.push('Tuyến không hợp lệ.');
    const [route, driver, assistant, vehicle] = await Promise.all([
      mongoose.Types.ObjectId.isValid(row.routeId) ? Route.findById(row.routeId).lean() : null,
      mongoose.Types.ObjectId.isValid(row.driverId) ? User.findOne({ _id: row.driverId, role: 'DRIVER', status: 'ACTIVE' }).lean() : null,
      mongoose.Types.ObjectId.isValid(row.assistantId) ? User.findOne({ _id: row.assistantId, role: { $in: ['CONDUCTOR', 'BUS_ASSISTANT'] }, status: 'ACTIVE' }).lean() : null,
      mongoose.Types.ObjectId.isValid(row.vehicleId) ? FleetBus.findById(row.vehicleId).lean() : null,
    ]);
    if (!route) warnings.push('Không tìm thấy tuyến.');
    if (!driver) warnings.push('Cần gán tài xế active.');
    if (!assistant) warnings.push('Cần gán phụ xe active.');
    if (!vehicle) warnings.push('Cần gán xe.');
    if (driver && isOnLeave(driver, workDate)) warnings.push('Tài xế đang nghỉ phép.');
    if (assistant && isOnLeave(assistant, workDate)) warnings.push('Phụ xe đang nghỉ phép.');
    if (driver && route && !hasSuitableLicense(driver, route.vehicleAssignment?.busType, workDate)) warnings.push('Bằng lái không phù hợp với loại xe của tuyến.');
    if (vehicle && !isVehicleOperational(vehicle, workDate)) warnings.push('Xe đang bảo trì hoặc không hoạt động.');
    if (vehicle && route && !vehicleMatchesRoute(vehicle, route)) warnings.push('Loại xe không phù hợp với tuyến.');

    if (workDate && range) {
      const assignments = await loadAssignmentsForDate(workDate);
      const weeklyAssignments = await loadStaffAssignmentsForWeek(workDate);
      existingWeeklyDriverMinutes = driver ? assignedMinutes(weeklyAssignments.drivers, 'driverId', driver._id) : 0;
      existingWeeklyAssistantMinutes = assistant ? assignedMinutes(weeklyAssignments.assistants, 'assistantId', assistant._id) : 0;
      if (driver && assignmentConflicts(assignments.drivers, 'driverId', driver._id, range)) warnings.push('Tài xế bị trùng ca.');
      if (driver && hasInsufficientRest(assignments.drivers, 'driverId', driver._id, range)) warnings.push('Tài xế không đủ 60 phút nghỉ giữa hai ca.');
      if (assistant && assignmentConflicts(assignments.assistants, 'assistantId', assistant._id, range)) warnings.push('Phụ xe bị trùng ca.');
      if (assistant && hasInsufficientRest(assignments.assistants, 'assistantId', assistant._id, range)) warnings.push('Phụ xe không đủ 60 phút nghỉ giữa hai ca.');
      if (vehicle && assignmentConflicts(assignments.vehicles, 'vehicleId', vehicle._id, range)) warnings.push('Xe bị trùng lịch.');
      if (driver && assignedMinutes(assignments.drivers, 'driverId', driver._id) + range.end - range.start > MAX_WORK_MINUTES) warnings.push('Tài xế vượt quá 8 giờ làm trong ngày.');
      if (assistant && assignedMinutes(assignments.assistants, 'assistantId', assistant._id) + range.end - range.start > MAX_WORK_MINUTES) warnings.push('Phụ xe vượt quá 8 giờ làm trong ngày.');
      if (driver && assignedMinutes(weeklyAssignments.drivers, 'driverId', driver._id) + range.end - range.start > MAX_WEEKLY_WORK_MINUTES) warnings.push('Tài xế vượt quá 40 giờ làm trong tuần.');
      if (assistant && assignedMinutes(weeklyAssignments.assistants, 'assistantId', assistant._id) + range.end - range.start > MAX_WEEKLY_WORK_MINUTES) warnings.push('Phụ xe vượt quá 40 giờ làm trong tuần.');
    }

    const tripIds = (row.tripIds || []).filter((id) => mongoose.Types.ObjectId.isValid(id));
    const trips = await TripSchedule.find({ _id: { $in: tripIds } }).lean();
    if (!tripIds.length || trips.length !== tripIds.length) warnings.push('Cần chọn đầy đủ chuyến hợp lệ.');
    trips.forEach((trip) => {
      if (getId(trip.routeId) !== getId(row.routeId)) warnings.push(`Chuyến ${trip.scheduleCode} không thuộc tuyến đã chọn.`);
      if (dateKey(trip.serviceDate) !== dateKey(workDate)) warnings.push(`Chuyến ${trip.scheduleCode} không đúng ngày.`);
      if (range && (!insideRange(trip.departureTime, range) || !insideRange(trip.expectedArrivalTime, range))) warnings.push(`Chuyến ${trip.scheduleCode} nằm ngoài giờ ca.`);
    });
    const assignedTrips = await TripShiftAssignment.find({ tripId: { $in: tripIds }, status: { $in: ['ASSIGNED', 'IN_PROGRESS'] } }).lean();
    if (assignedTrips.length) warnings.push('Có chuyến đã được gán vào ca khác.');

    const duplicate = workDate && range ? await Shift.findOne({
      routeId: row.routeId,
      workDate,
      status: { $ne: 'ARCHIVED' },
      startTime: { $lt: row.endTime },
      endTime: { $gt: row.startTime },
    }).lean() : null;
    if (duplicate) warnings.push(`Trùng với ca ${duplicate.shiftCode}.`);
    return { warnings, workDate, route, driver, assistant, vehicle, trips, existingWeeklyDriverMinutes, existingWeeklyAssistantMinutes };
  }

  static async confirmGenerated({ rows, actorId }) {
    const submittedTripIds = Array.isArray(rows)
      ? rows.flatMap((row) => row.tripIds || []).filter((tripId) => mongoose.Types.ObjectId.isValid(tripId))
      : [];
    const submittedTrips = submittedTripIds.length
      ? await TripSchedule.find({ _id: { $in: submittedTripIds } }).lean()
      : [];
    const atomicCycleErrors = Array.isArray(rows) ? validateAtomicCycleDuties(rows, submittedTrips) : [];
    if (submittedTrips.length !== new Set(submittedTripIds.map(getId)).size) atomicCycleErrors.push('Danh sách có chuyến không tồn tại hoặc không hợp lệ.');
    if (atomicCycleErrors.length) {
      throw Object.assign(new Error('Phân ca phải giữ nguyên từng vòng D-V và không được lặp chuyến.'), { statusCode: 409, conflicts: atomicCycleErrors });
    }
    if (!Array.isArray(rows) || !rows.length) throw Object.assign(new Error('Danh sách ca xác nhận là bắt buộc.'), { statusCode: 400 });
    const previewConflicts = [];
    const workTotals = new Map();
    const weeklyWorkTotals = new Map();
    const shiftCodes = new Set();
    rows.forEach((row, index) => {
      const code = String(row.shiftCode || '').trim().toUpperCase();
      if (!code) previewConflicts.push({ index, shiftCode: code, message: 'Mã ca là bắt buộc.' });
      if (shiftCodes.has(code)) previewConflicts.push({ index, shiftCode: code, message: 'Mã ca bị trùng trong danh sách xem trước.' });
      shiftCodes.add(code);
      const range = rangeOf(row);
      if (!range) return;
      [['driver', row.driverId], ['assistant', row.assistantId]].forEach(([kind, resourceId]) => {
        if (!resourceId) return;
        const key = `${kind}:${dateKey(row.workDate)}:${resourceId}`;
        const total = (workTotals.get(key) || 0) + range.end - range.start;
        workTotals.set(key, total);
        if (total > MAX_WORK_MINUTES) previewConflicts.push({ index, shiftCode: code, message: `${kind === 'driver' ? 'Tài xế' : 'Phụ xe'} vượt quá 8 giờ trong ngày.` });
        const bounds = weekBounds(row.workDate);
        const weekKey = `${kind}:${dateKey(bounds.start)}:${resourceId}`;
        const weeklyTotal = (weeklyWorkTotals.get(weekKey) || 0) + range.end - range.start;
        weeklyWorkTotals.set(weekKey, weeklyTotal);
        if (weeklyTotal > MAX_WEEKLY_WORK_MINUTES) previewConflicts.push({ index, shiftCode: code, message: `${kind === 'driver' ? 'Tài xế' : 'Phụ xe'} vượt quá 40 giờ trong tuần.` });
      });
      rows.slice(0, index).forEach((other, otherIndex) => {
        if (dateKey(other.workDate) !== dateKey(row.workDate)) return;
        const otherRange = rangeOf(other);
        if (!otherRange) return;
        const isOverlap = overlaps(range, otherRange);
        const gap = isOverlap ? -1 : (range.start >= otherRange.end
          ? range.start - otherRange.end
          : otherRange.start - range.end);
        if (row.driverId && getId(row.driverId) === getId(other.driverId) && (isOverlap || gap < MIN_REST_MINUTES)) {
          previewConflicts.push({ index, shiftCode: code, message: `Tài xế trùng giờ hoặc nghỉ dưới 60 phút so với dòng ${otherIndex + 1}.` });
        }
        if (row.assistantId && getId(row.assistantId) === getId(other.assistantId) && (isOverlap || gap < MIN_REST_MINUTES)) {
          previewConflicts.push({ index, shiftCode: code, message: `Phụ xe trùng giờ hoặc nghỉ dưới 60 phút so với dòng ${otherIndex + 1}.` });
        }
        if (row.vehicleId && getId(row.vehicleId) === getId(other.vehicleId) && (isOverlap || gap < 10)) {
          previewConflicts.push({ index, shiftCode: code, message: `Xe trùng giờ hoặc không đủ 10 phút quay đầu so với dòng ${otherIndex + 1}.` });
        }
      });
    });
    if (previewConflicts.length) throw Object.assign(new Error('Danh sách xem trước còn xung đột nội bộ.'), { statusCode: 409, conflicts: previewConflicts });
    const validationResults = [];
    for (const row of rows) validationResults.push(await this.validateConfirmRow(row));
    const conflicts = validationResults.flatMap((result, index) => result.warnings.map((message) => ({ index, shiftCode: rows[index].shiftCode, message })));
    const previewWeeklyTotals = new Map();
    rows.forEach((row, index) => {
      const range = rangeOf(row);
      if (!range) return;
      const result = validationResults[index];
      [['driver', row.driverId, result.existingWeeklyDriverMinutes], ['assistant', row.assistantId, result.existingWeeklyAssistantMinutes]].forEach(([kind, resourceId, existingMinutes]) => {
        if (!resourceId) return;
        const key = `${kind}:${dateKey(weekBounds(row.workDate).start)}:${resourceId}`;
        const previewMinutes = (previewWeeklyTotals.get(key) || 0) + range.end - range.start;
        previewWeeklyTotals.set(key, previewMinutes);
        if (Number(existingMinutes || 0) + previewMinutes > MAX_WEEKLY_WORK_MINUTES) {
          conflicts.push({ index, shiftCode: row.shiftCode, message: `${kind === 'driver' ? 'Tài xế' : 'Phụ xe'} vượt quá 40 giờ trong tuần khi cộng các ca đang xác nhận.` });
        }
      });
    });
    if (conflicts.length) throw Object.assign(new Error('Không thể lưu khi danh sách còn xung đột hoặc thiếu phân công.'), { statusCode: 409, conflicts });

    const created = { shifts: [], assignments: { drivers: 0, assistants: 0, vehicles: 0, trips: 0 } };
    const rollback = { shiftIds: [], driverIds: [], assistantIds: [], vehicleIds: [], tripIds: [] };
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const lockKeys = [...new Set(rows.flatMap((row) => [
        `driver:${dateKey(row.workDate)}:${getId(row.driverId)}`,
        `assistant:${dateKey(row.workDate)}:${getId(row.assistantId)}`,
        `vehicle:${dateKey(row.workDate)}:${getId(row.vehicleId)}`,
        ...(row.tripIds || []).map((tripId) => `trip:${getId(tripId)}`),
      ]))];
      for (const lockKey of lockKeys) {
        await AssignmentLock.updateOne({ lockKey }, { $inc: { version: 1 } }, { upsert: true, session });
      }
      const lockedValidationResults = [];
      for (const row of rows) lockedValidationResults.push(await this.validateConfirmRow(row));
      const lockedConflicts = lockedValidationResults.flatMap((result, index) => result.warnings.map((message) => ({ index, shiftCode: rows[index].shiftCode, message })));
      if (lockedConflicts.length) throw Object.assign(new Error('Dữ liệu phân công đã thay đổi. Vui lòng tạo lại bản xem trước.'), { statusCode: 409, conflicts: lockedConflicts });
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const result = lockedValidationResults[index];
        const [shift] = await Shift.create([{
          shiftCode: String(row.shiftCode).trim().toUpperCase(),
          shiftName: String(row.shiftName || shiftNameFor(row.shiftType)).trim(),
          routeId: row.routeId,
          workDate: result.workDate,
          startTime: row.startTime,
          endTime: row.endTime,
          breakMinutes: Number(row.breakMinutes || 0),
          shiftType: SHIFT_TYPES.has(row.shiftType) ? row.shiftType : 'CUSTOM',
          status: 'ACTIVE',
          description: 'Ca được xác nhận từ chức năng sinh ca tự động.',
          createdBy: actorId,
          updatedBy: actorId,
        }], { session });
        rollback.shiftIds.push(shift._id);
        created.shifts.push(shift.toObject());
        const base = { shiftId: shift._id, workDate: result.workDate, status: 'ASSIGNED', createdBy: actorId, updatedBy: actorId };
        const [driverAssignment] = await DriverShiftAssignment.create([{ ...base, driverId: result.driver._id }], { session });
        rollback.driverIds.push(driverAssignment._id);
        const [assistantAssignment] = await AssistantShiftAssignment.create([{ ...base, assistantId: result.assistant._id }], { session });
        rollback.assistantIds.push(assistantAssignment._id);
        const [vehicleAssignment] = await VehicleShiftAssignment.create([{ ...base, vehicleId: result.vehicle._id }], { session });
        rollback.vehicleIds.push(vehicleAssignment._id);
        created.assignments.drivers += 1;
        created.assignments.assistants += 1;
        created.assignments.vehicles += 1;
        for (const trip of result.trips) {
          const [tripAssignment] = await TripShiftAssignment.create([{
            ...base,
            tripId: trip._id,
            driverId: result.driver._id,
            vehicleId: result.vehicle._id,
          }], { session });
          rollback.tripIds.push(tripAssignment._id);
          created.assignments.trips += 1;
          await TripSchedule.findByIdAndUpdate(trip._id, {
            $set: {
              status: 'ASSIGNED',
              shiftLabel: shift.shiftName,
              driver: { userId: result.driver._id, fullName: result.driver.fullName, role: result.driver.role, phone: result.driver.phoneNumber || '' },
              assistant: { userId: result.assistant._id, fullName: result.assistant.fullName, role: result.assistant.role, phone: result.assistant.phoneNumber || '' },
              vehicle: { busId: result.vehicle._id, busCode: result.vehicle.busCode, plateNumber: result.vehicle.plateNumber, busType: result.vehicle.busType, capacity: result.vehicle.capacity },
              updatedBy: actorId,
            },
          }, { session });
        }
      }
      await session.commitTransaction();
      return created;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }
}
