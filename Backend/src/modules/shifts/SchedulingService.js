import mongoose from 'mongoose';
import Route from '../routes/Route.js';
import User from '../auth/User.js';
import Shift from './Shift.js';
import DriverShiftAssignment from './DriverShiftAssignment.js';
import AssistantShiftAssignment from './AssistantShiftAssignment.js';
import VehicleShiftAssignment from './VehicleShiftAssignment.js';
import RouteOperatingConfig from './RouteOperatingConfig.js';
import SchedulingPlan from './SchedulingPlan.js';
import TripSchedule from '../admin/TripSchedule.js';
import AutoGenerateShiftService from './AutoGenerateShiftService.js';
import {
  DEFAULT_TIME_SLOTS,
  MAX_DAILY_WORK_MINUTES,
  TARGET_WEEKLY_WORK_MINUTES,
  rangesOverlap,
  scoreDriver,
  timeRange,
  validateOperatingWindow,
  workloadStatus,
} from './schedulingEngine.js';

const ACTIVE_ASSIGNMENTS = ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];
const OPEN_SHIFTS = { $nin: ['ARCHIVED', 'CANCELLED'] };
const id = (value) => String(value?._id || value || '');
const dayStart = (value) => {
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) return null;
  result.setHours(0, 0, 0, 0);
  return result;
};
const nextDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
const OPERATING_DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const configFilterForDate = (date) => ({
  isActive: true,
  $or: [
    { effectiveDate: { $gte: date, $lt: nextDay(date) } },
    { effectiveDate: null, dayOfWeek: date.getDay() },
  ],
});

const statusFrom = ({ configured, required, assigned, conflicts }) => {
  if (!configured) return 'UNSCHEDULED';
  if (conflicts) return 'CONFLICT';
  if (assigned.drivers < required.drivers) return assigned.drivers || assigned.assistants || assigned.vehicles ? 'MISSING_DRIVER' : 'UNSCHEDULED';
  if (assigned.assistants < required.assistants) return 'MISSING_ASSISTANT';
  if (assigned.vehicles < required.vehicles) return 'MISSING_VEHICLE';
  return 'FULLY_SCHEDULED';
};

const conflictIds = (assignments, field) => {
  const conflicts = new Set();
  assignments.forEach((current, index) => assignments.slice(index + 1).forEach((other) => {
    if (id(current[field]) === id(other[field]) && rangesOverlap(current.shiftId, other.shiftId)) {
      conflicts.add(id(current.shiftId));
      conflicts.add(id(other.shiftId));
    }
  }));
  return conflicts;
};

export default class SchedulingService {
  static async listConfigs({ routeId, date, includeInactive } = {}) {
    const filter = {};
    if (routeId && mongoose.Types.ObjectId.isValid(routeId)) filter.routeId = routeId;
    if (!includeInactive) filter.isActive = true;
    const workDate = dayStart(date);
    if (workDate) Object.assign(filter, configFilterForDate(workDate));
    return RouteOperatingConfig.find(filter).populate('routeId', 'routeCode routeName status').sort({ routeId: 1, startTime: 1 }).lean();
  }

  static async saveConfigs({ routeId, effectiveDate, dayOfWeek, slots, actorId }) {
    if (!mongoose.Types.ObjectId.isValid(routeId)) throw Object.assign(new Error('Tuyến xe không hợp lệ.'), { statusCode: 400 });
    const route = await Route.findOne({ _id: routeId, status: { $in: ['PUBLISHED', 'DRAFT'] } }).lean();
    if (!route) throw Object.assign(new Error('Không tìm thấy tuyến xe.'), { statusCode: 404 });
    const normalizedDate = effectiveDate ? dayStart(effectiveDate) : null;
    const normalizedDay = normalizedDate ? null : Number(dayOfWeek);
    if (!normalizedDate && (!Number.isInteger(normalizedDay) || normalizedDay < 0 || normalizedDay > 6)) {
      throw Object.assign(new Error('Cần chọn ngày hiệu lực hoặc thứ trong tuần.'), { statusCode: 400 });
    }
    if (!Array.isArray(slots) || !slots.length) throw Object.assign(new Error('Cần ít nhất một khung nhu cầu.'), { statusCode: 400 });
    const errors = [];
    slots.forEach((slot, index) => {
      validateOperatingWindow(slot).forEach((message) => errors.push(`Khung ${index + 1}: ${message}`));
      if (Number(slot.requiredDrivers) < 1 || Number(slot.requiredVehicles) < 1 || Number(slot.requiredAssistants) < 0) errors.push(`Khung ${index + 1}: số lượng nguồn lực không hợp lệ.`);
      if (Number(slot.frequencyMinutes) < 5) errors.push(`Khung ${index + 1}: tần suất tối thiểu là 5 phút.`);
      slots.slice(0, index).forEach((other) => {
        if (rangesOverlap(slot, other)) errors.push(`Khung ${index + 1} bị chồng thời gian.`);
      });
    });
    if (errors.length) throw Object.assign(new Error(errors[0]), { statusCode: 400, errors });

    const scope = { routeId, effectiveDate: normalizedDate, dayOfWeek: normalizedDay };
    await RouteOperatingConfig.updateMany(scope, { $set: { isActive: false, updatedBy: actorId } });
    const configs = await RouteOperatingConfig.insertMany(slots.map((slot) => ({
      ...scope,
      startTime: slot.startTime,
      endTime: slot.endTime,
      frequencyMinutes: Number(slot.frequencyMinutes),
      requiredVehicles: Number(slot.requiredVehicles),
      requiredDrivers: Number(slot.requiredDrivers),
      requiredAssistants: Number(slot.requiredAssistants),
      demandLevel: slot.demandLevel || 'MEDIUM',
      isActive: true,
      createdBy: actorId,
      updatedBy: actorId,
    })));
    return configs;
  }

  static async overview(dateValue) {
    const date = dayStart(dateValue);
    if (!date) throw Object.assign(new Error('Ngày lập lịch không hợp lệ.'), { statusCode: 400 });
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);
    const [routes, configs, shifts, driverAssignments, assistantAssignments, vehicleAssignments, drivers, confirmedPlans, tripSchedules, weeklyDriverAssignments] = await Promise.all([
      Route.find({ status: 'PUBLISHED' }).select('routeCode routeName status scheduleConfig').sort({ routeCode: 1 }).lean(),
      RouteOperatingConfig.find(configFilterForDate(date)).lean(),
      Shift.find({ workDate: { $gte: date, $lt: nextDay(date) }, status: OPEN_SHIFTS }).lean(),
      DriverShiftAssignment.find({ workDate: { $gte: date, $lt: nextDay(date) }, status: { $in: ACTIVE_ASSIGNMENTS } }).populate('shiftId').lean(),
      AssistantShiftAssignment.find({ workDate: { $gte: date, $lt: nextDay(date) }, status: { $in: ACTIVE_ASSIGNMENTS } }).populate('shiftId').lean(),
      VehicleShiftAssignment.find({ workDate: { $gte: date, $lt: nextDay(date) }, status: { $in: ACTIVE_ASSIGNMENTS } }).populate('shiftId').lean(),
      User.find({ role: 'DRIVER', status: 'ACTIVE', 'accountLock.isLocked': { $ne: true } }).select('fullName staffAvailability').sort({ fullName: 1 }).lean(),
      SchedulingPlan.find({ workDate: { $gte: date, $lt: nextDay(date) }, status: 'CONFIRMED' }).select('rows.routeId').lean(),
      TripSchedule.find({ serviceDate: { $gte: date, $lt: nextDay(date) }, status: { $ne: 'CANCELLED' } }).select('routeId departureTime expectedArrivalTime').lean(),
      DriverShiftAssignment.find({ workDate: { $gte: weekStart, $lt: weekEnd }, status: { $in: ACTIVE_ASSIGNMENTS } }).populate('shiftId').lean(),
    ]);
    const confirmedRouteIds = new Set(confirmedPlans.flatMap((plan) => plan.rows || []).map((row) => id(row.routeId)));
    const allConflicts = new Set([
      ...conflictIds(driverAssignments, 'driverId'),
      ...conflictIds(assistantAssignments, 'assistantId'),
      ...conflictIds(vehicleAssignments, 'vehicleId'),
    ]);
    const assignmentsFor = (items, field, routeId, slot) => new Set(items.filter((item) => (
      id(item.shiftId?.routeId) === id(routeId) && rangesOverlap(item.shiftId, slot)
    )).map((item) => id(item[field]))).size;
    const activeRoutes = routes.filter((route) => !route.scheduleConfig?.operatingDays?.length
      || route.scheduleConfig.operatingDays.includes(OPERATING_DAY_KEYS[date.getDay()]));
    const routeRows = activeRoutes.map((route) => {
      const routeConfigs = configs.filter((config) => id(config.routeId) === id(route));
      const slots = routeConfigs.map((config) => {
        const range = timeRange(config);
        const requiredTrips = Math.ceil((range.end - range.start) / Number(config.frequencyMinutes || 1)) * 2;
        const plannedTrips = tripSchedules.filter((trip) => id(trip.routeId) === id(route) && trip.departureTime >= config.startTime && trip.departureTime < config.endTime).length;
        const assigned = {
          drivers: assignmentsFor(driverAssignments, 'driverId', route._id, config),
          assistants: assignmentsFor(assistantAssignments, 'assistantId', route._id, config),
          vehicles: assignmentsFor(vehicleAssignments, 'vehicleId', route._id, config),
        };
        const required = { drivers: config.requiredDrivers, assistants: config.requiredAssistants, vehicles: config.requiredVehicles };
        const slotShiftIds = shifts.filter((shift) => id(shift.routeId) === id(route) && rangesOverlap(shift, config)).map((shift) => id(shift));
        const conflicts = slotShiftIds.some((shiftId) => allConflicts.has(shiftId));
        let slotStatus = statusFrom({ configured: true, required, assigned, conflicts });
        if (slotStatus === 'FULLY_SCHEDULED' && plannedTrips < requiredTrips) slotStatus = 'PARTIALLY_SCHEDULED';
        return { configId: config._id, startTime: config.startTime, endTime: config.endTime, demandLevel: config.demandLevel, frequencyMinutes: config.frequencyMinutes, requiredTrips, plannedTrips, required, assigned, status: slotStatus };
      });
      const statuses = slots.map((slot) => slot.status);
      let status = !slots.length ? 'UNSCHEDULED'
        : statuses.includes('CONFLICT') ? 'CONFLICT'
          : statuses.every((item) => item === 'FULLY_SCHEDULED') ? 'FULLY_SCHEDULED'
            : statuses.find((item) => item.startsWith('MISSING_')) || 'PARTIALLY_SCHEDULED';
      if (status === 'FULLY_SCHEDULED' && confirmedRouteIds.has(id(route))) status = 'CONFIRMED';
      return { routeId: route._id, routeCode: route.routeCode, routeName: route.routeName, configurationMissing: !slots.length, status, slots };
    });
    const totals = routeRows.flatMap((route) => route.slots);
    const driverWorkloads = drivers.map((driver) => {
      const own = driverAssignments.filter((assignment) => id(assignment.driverId) === id(driver));
      const weeklyOwn = weeklyDriverAssignments.filter((assignment) => id(assignment.driverId) === id(driver));
      const assignedMinutes = own.reduce((sum, assignment) => {
        const range = timeRange(assignment.shiftId || {});
        return sum + (range ? range.end - range.start : 0);
      }, 0);
      const assignedWeeklyMinutes = weeklyOwn.reduce((sum, assignment) => { const range = timeRange(assignment.shiftId || {}); return sum + (range ? range.end - range.start : 0); }, 0);
      const workedDays = new Set(weeklyOwn.map((item) => dayStart(item.workDate)?.toISOString().slice(0, 10)).filter(Boolean));
      let consecutiveWorkingDays = 0;
      for (let cursor = new Date(date); workedDays.has(cursor.toISOString().slice(0, 10)); cursor.setDate(cursor.getDate() - 1)) consecutiveWorkingDays += 1;
      return { driverId: driver._id, name: driver.fullName, assignedMinutes, targetMinutes: MAX_DAILY_WORK_MINUTES, remainingMinutes: Math.max(0, MAX_DAILY_WORK_MINUTES - assignedMinutes), assignedWeeklyMinutes, targetWeeklyMinutes: TARGET_WEEKLY_WORK_MINUTES, remainingWeeklyMinutes: Math.max(0, TARGET_WEEKLY_WORK_MINUTES - assignedWeeklyMinutes), morningShiftCount: weeklyOwn.filter((item) => item.shiftId?.shiftType === 'MORNING').length, afternoonShiftCount: weeklyOwn.filter((item) => item.shiftId?.shiftType === 'AFTERNOON').length, peakShiftCount: weeklyOwn.filter((item) => item.shiftId?.startTime < '09:00' || item.shiftId?.endTime > '16:00').length, consecutiveWorkingDays, status: workloadStatus(assignedMinutes), assignments: own.map((item) => ({ routeId: item.shiftId?.routeId, startTime: item.shiftId?.startTime, endTime: item.shiftId?.endTime })) };
    });
    return {
      date: date.toISOString().slice(0, 10),
      totalRoutes: routeRows.length,
      fullyScheduledRoutes: routeRows.filter((route) => ['FULLY_SCHEDULED', 'CONFIRMED'].includes(route.status)).length,
      partiallyScheduledRoutes: routeRows.filter((route) => !['FULLY_SCHEDULED', 'UNSCHEDULED'].includes(route.status)).length,
      unscheduledRoutes: routeRows.filter((route) => route.status === 'UNSCHEDULED').length,
      missingDriverCount: totals.reduce((sum, slot) => sum + Math.max(0, slot.required.drivers - slot.assigned.drivers), 0),
      missingAssistantCount: totals.reduce((sum, slot) => sum + Math.max(0, slot.required.assistants - slot.assigned.assistants), 0),
      missingVehicleCount: totals.reduce((sum, slot) => sum + Math.max(0, slot.required.vehicles - slot.assigned.vehicles), 0),
      conflictCount: allConflicts.size,
      underHoursDriverCount: driverWorkloads.filter((driver) => driver.status === 'UNDER_HOURS').length,
      routes: routeRows,
      driverWorkloads,
      timeSlotCoverage: DEFAULT_TIME_SLOTS.map((slot) => {
        const matching = totals.filter((item) => rangesOverlap(item, slot));
        const requiredDrivers = matching.reduce((sum, item) => sum + item.required.drivers, 0);
        const assignedDrivers = matching.reduce((sum, item) => sum + Math.min(item.required.drivers, item.assigned.drivers), 0);
        return { ...slot, requiredDrivers, assignedDrivers, coveragePercentage: requiredDrivers ? Math.round((assignedDrivers / requiredDrivers) * 100) : 0 };
      }),
    };
  }

  static async eligibleDrivers(query) {
    const resources = await AutoGenerateShiftService.listAvailableResources({ kind: 'drivers', ...query });
    const date = dayStart(query.workDate || query.date);
    if (!date) throw Object.assign(new Error('Ngày lập lịch không hợp lệ.'), { statusCode: 400 });
    const currentRange = timeRange(query);
    const weekStart = new Date(date); weekStart.setDate(date.getDate() - date.getDay());
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);
    const assignments = await DriverShiftAssignment.find({ driverId: { $in: resources.map((item) => item._id) }, workDate: { $gte: weekStart, $lt: weekEnd }, status: { $in: ACTIVE_ASSIGNMENTS } }).populate('shiftId').lean();
    const scored = resources.map((driver) => {
      const own = assignments.filter((item) => id(item.driverId) === id(driver));
      const assignedMinutes = own.reduce((sum, item) => { const range = timeRange(item.shiftId || {}); return sum + (range ? range.end - range.start : 0); }, 0);
      return { ...driver, ...scoreDriver({ driverId: driver._id, assignedMinutes, targetMinutes: TARGET_WEEKLY_WORK_MINUTES, morningShiftCount: own.filter((item) => item.shiftId?.shiftType === 'MORNING').length, afternoonShiftCount: own.filter((item) => item.shiftId?.shiftType === 'AFTERNOON').length, shiftType: query.shiftType }) };
    }).sort((left, right) => right.score - left.score || left.fullName.localeCompare(right.fullName, 'vi'));
    const configs = await RouteOperatingConfig.find({
      ...configFilterForDate(date),
      startTime: { $gte: query.endTime },
    }).lean();
    const groups = [...configs.reduce((map, config) => {
      const key = `${config.startTime}-${config.endTime}`;
      const current = map.get(key) || { startTime: config.startTime, endTime: config.endTime, requiredDrivers: 0 };
      current.requiredDrivers += Number(config.requiredDrivers || 0);
      map.set(key, current);
      return map;
    }, new Map()).values()];
    if (!currentRange || !groups.length) return scored;
    const futurePools = await Promise.all(groups.map(async (slot) => ({
      slot,
      resources: await AutoGenerateShiftService.listAvailableResources({ kind: 'drivers', workDate: date, startTime: slot.startTime, endTime: slot.endTime }),
    })));
    return scored.filter((driver) => futurePools.every(({ slot, resources: futureDrivers }) => {
      const futureRange = timeRange(slot);
      const candidateInPool = futureDrivers.some((item) => id(item) === id(driver));
      if (!candidateInPool) return futureDrivers.length >= slot.requiredDrivers;
      const rest = futureRange.start - currentRange.end;
      const canStillWorkFuture = driver.assignedMinutes + (currentRange.end - currentRange.start) + (futureRange.end - futureRange.start) <= MAX_DAILY_WORK_MINUTES && rest >= 60;
      const availableAfter = futureDrivers.length - (canStillWorkFuture ? 0 : 1);
      return availableAfter >= slot.requiredDrivers;
    }));
  }
}
