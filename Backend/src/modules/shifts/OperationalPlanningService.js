import mongoose from 'mongoose';
import User from '../auth/User.js';
import Route from '../routes/Route.js';
import FleetBus from '../admin/FleetBus.js';
import TripSchedule from '../admin/TripSchedule.js';
import DriverShiftAssignment from './DriverShiftAssignment.js';
import AssistantShiftAssignment from './AssistantShiftAssignment.js';
import VehicleShiftAssignment from './VehicleShiftAssignment.js';
import RouteOperatingConfig from './RouteOperatingConfig.js';
import SchedulingPlan from './SchedulingPlan.js';
import ShiftService from './ShiftService.js';
import {
  MAX_DAILY_WORK_MINUTES,
  TARGET_WEEKLY_WORK_MINUTES,
  MIN_REST_MINUTES,
  rangesOverlap,
  scoreDriver,
  timeRange,
  validateOperatingWindow,
} from './schedulingEngine.js';

const ACTIVE_ASSIGNMENTS = ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];
const STAFFING_PERIODS = [
  { shiftType: 'MORNING', startTime: '05:30', endTime: '12:00', from: 330, to: 720 },
  { shiftType: 'AFTERNOON', startTime: '12:00', endTime: '18:30', from: 720, to: 1110 },
];
const DEMAND_PRIORITY = { VERY_HIGH: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const id = (value) => String(value?._id || value || '');
const dateOnly = (value) => { const date = new Date(value); if (Number.isNaN(date.getTime())) return null; date.setHours(0, 0, 0, 0); return date; };
const nextDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dateToken = (date) => dateKey(date).replaceAll('-', '').slice(2);
const weekStart = (value) => {
  const date = dateOnly(value);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return date;
};

const leaveConflict = (staff, date) => (staff.staffAvailability?.leaveRequests || []).some((leave) => {
  if (!['APPROVED', 'ACTIVE'].includes(String(leave.status || '').toUpperCase())) return false;
  const start = dateOnly(leave.startDate || leave.date);
  const end = dateOnly(leave.endDate || leave.date);
  return start && end && date >= start && date <= end;
});

const operationalVehicle = (vehicle, date) => {
  if (!['AVAILABLE', 'ACTIVE', 'RESERVE', 'ASSIGNED'].includes(vehicle.status)) return false;
  const start = dateOnly(vehicle.maintenance?.startDate);
  const end = dateOnly(vehicle.maintenance?.endDate);
  return !(start && end && date >= start && date <= end);
};

const suitableLicense = (driver, route, date) => {
  const license = driver.driverLicense;
  if (!license?.licenseNumber && !license?.permittedVehicleTypes?.length) return true;
  if (['EXPIRED', 'SUSPENDED'].includes(license.status)) return false;
  if (license.expiresAt && new Date(license.expiresAt) < date) return false;
  const required = String(route.vehicleAssignment?.busType || '').toLowerCase();
  return !required || !license.permittedVehicleTypes?.length || license.permittedVehicleTypes.some((item) => required.includes(String(item).toLowerCase()) || String(item).toLowerCase().includes(required));
};

const suitableVehicle = (vehicle, route) => {
  const assignedIds = new Set((route.vehicleAssignment?.assignedBuses || []).map((item) => id(item.busId || item._id)));
  if (assignedIds.has(id(vehicle))) return true;
  const requiredType = String(route.vehicleAssignment?.busType || '').trim().toLowerCase();
  if (requiredType && !String(vehicle.busType || '').toLowerCase().includes(requiredType) && !requiredType.includes(String(vehicle.busType || '').toLowerCase())) return false;
  return !route.vehicleAssignment?.capacity || Number(vehicle.capacity || 0) >= Number(route.vehicleAssignment.capacity);
};

const allocationStats = (allocations, resourceId) => {
  const own = allocations.filter((item) => id(item.resourceId) === id(resourceId));
  return {
    own,
    minutes: own.reduce((sum, item) => { const range = timeRange(item); return sum + (range ? range.end - range.start : 0); }, 0),
  };
};

const resourceEligible = ({ resource, slot, allocations, onLeave = false, operational = true }) => {
  const { own, minutes } = allocationStats(allocations, resource._id);
  const range = timeRange(slot);
  const duration = range.end - range.start;
  if (onLeave || !operational || own.some((item) => rangesOverlap(item, slot)) || minutes + duration > MAX_DAILY_WORK_MINUTES) return false;
  return !own.some((item) => {
    const assigned = timeRange(item);
    const rest = assigned.end <= range.start ? range.start - assigned.end : assigned.start - range.end;
    return rest < MIN_REST_MINUTES;
  });
};

const publicStaff = (staff) => ({ _id: staff._id, fullName: staff.fullName, email: staff.email, phoneNumber: staff.phoneNumber });
const publicVehicle = (vehicle) => ({ _id: vehicle._id, busCode: vehicle.busCode, plateNumber: vehicle.plateNumber, busType: vehicle.busType, capacity: vehicle.capacity });
const clockMinutes = (value) => { const [hour, minute] = String(value || '').split(':').map(Number); return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : 0; };
const minuteClock = (value) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
const dateRange = (startDate, endDate) => {
  const start = dateOnly(startDate);
  const end = dateOnly(endDate || startDate);
  if (!start || !end || end < start) throw Object.assign(new Error('Khoảng ngày không hợp lệ.'), { statusCode: 400 });
  const result = [];
  for (let cursor = start; cursor <= end && result.length < 31; cursor = nextDay(cursor)) result.push(cursor);
  if (nextDay(result.at(-1)) <= end) throw Object.assign(new Error('Chỉ được phân tích tối đa 31 ngày.'), { statusCode: 400 });
  return result;
};

export const globalDemandFromTrips = (trips) => {
  const cycles = new Map();
  trips.forEach((trip) => {
    const key = `${id(trip.routeId)}:${String(trip.operationCycleCode || id(trip))}`;
    const current = cycles.get(key) || { routeId: trip.routeId, starts: [], ends: [], trips: [] };
    current.starts.push(clockMinutes(trip.departureTime));
    current.ends.push(clockMinutes(trip.turnaroundEndTime || trip.expectedArrivalTime));
    current.trips.push(trip);
    cycles.set(key, current);
  });
  return STAFFING_PERIODS.map((period) => {
    const ownCycles = [...cycles.values()].filter((cycle) => Math.min(...cycle.starts) >= period.from && Math.min(...cycle.starts) < period.to);
    const events = ownCycles.flatMap((cycle) => [{ at: Math.min(...cycle.starts), delta: 1 }, { at: Math.max(...cycle.ends), delta: -1 }])
      .sort((left, right) => left.at - right.at || left.delta - right.delta);
    let active = 0;
    let required = 0;
    let previous = events[0]?.at;
    const rawWindows = [];
    for (let index = 0; index < events.length;) {
      const at = events[index].at;
      if (previous !== undefined && at > previous && active > 0) rawWindows.push({ from: previous, to: at, required: active });
      while (index < events.length && events[index].at === at) {
        active += events[index].delta;
        index += 1;
      }
      required = Math.max(required, active);
      previous = at;
    }
    const windows = rawWindows.reduce((result, window) => {
      const previousWindow = result.at(-1);
      if (previousWindow?.to === window.from && previousWindow.required === window.required) previousWindow.to = window.to;
      else result.push({ ...window });
      return result;
    }, []).map((window) => ({
      startTime: minuteClock(window.from),
      endTime: minuteClock(window.to),
      required: window.required,
      demandLevel: window.required === required ? 'PEAK' : 'NORMAL',
    }));
    return { ...period, required, tripCount: ownCycles.reduce((sum, cycle) => sum + cycle.trips.length, 0), cycles: ownCycles, windows };
  });
};

export const configsFromTrips = (trips) => {
  const cycles = new Map();
  trips.forEach((trip) => {
    const key = `${id(trip.routeId)}:${String(trip.operationCycleCode || id(trip))}`;
    const current = cycles.get(key) || { routeId: trip.routeId, departures: [], arrivals: [], trips: [] };
    current.departures.push(clockMinutes(trip.departureTime));
    current.arrivals.push(clockMinutes(trip.expectedArrivalTime));
    current.trips.push(trip);
    cycles.set(key, current);
  });
  const periods = STAFFING_PERIODS.map((period) => ({ ...period, demandLevel: 'HIGH' }));
  const routeIds = [...new Set(trips.map((trip) => id(trip.routeId)))];
  return routeIds.flatMap((routeId) => periods.flatMap((period) => {
    const periodCycles = [...cycles.values()].filter((cycle) => id(cycle.routeId) === routeId
      && Math.min(...cycle.departures) >= period.from && Math.min(...cycle.departures) < period.to);
    if (!periodCycles.length) return [];
    const events = periodCycles.flatMap((cycle) => [
      { at: Math.min(...cycle.departures), delta: 1 },
      { at: Math.max(...cycle.arrivals), delta: -1 },
    ]).sort((left, right) => left.at - right.at || left.delta - right.delta);
    let active = 0;
    let peak = 0;
    events.forEach((event) => { active += event.delta; peak = Math.max(peak, active); });
    return [{ routeId: periodCycles[0].routeId, startTime: period.startTime, endTime: period.endTime, demandLevel: period.demandLevel, frequencyMinutes: 1, requiredDrivers: peak, requiredAssistants: peak, requiredVehicles: 0, actualTripCount: periodCycles.reduce((total, cycle) => total + cycle.trips.length, 0) }];
  }));
};

const validationSummary = (rows) => {
  const hardErrors = rows.flatMap((row) => row.hardErrors.map((message) => `${row.shiftCode}: ${message}`));
  const warnings = rows.flatMap((row) => row.warnings.map((message) => `${row.shiftCode}: ${message}`));
  return {
    totalSlots: rows.length,
    readySlots: rows.filter((row) => !row.hardErrors.length).length,
    missingDriverCount: rows.filter((row) => row.requiresDriver && !row.driverId).length,
    missingAssistantCount: rows.filter((row) => row.requiresAssistant && !row.assistantId).length,
    missingVehicleCount: rows.filter((row) => row.requiresVehicle && !row.vehicleId).length,
    conflictCount: rows.filter((row) => row.hardErrors.some((item) => item.toLowerCase().includes('trùng'))).length,
    hardErrors,
    warnings,
  };
};

export default class OperationalPlanningService {
  static async staffingDemand({ startDate, endDate } = {}) {
    const days = dateRange(startDate, endDate);
    const start = days[0];
    const endExclusive = nextDay(days.at(-1));
    const assignmentStart = weekStart(start);
    const assignmentEnd = weekStart(days.at(-1));
    assignmentEnd.setDate(assignmentEnd.getDate() + 7);
    const [trips, drivers, assistants, driverAssignments, assistantAssignments, history, routes] = await Promise.all([
      TripSchedule.find({ serviceDate: { $gte: start, $lt: endExclusive }, status: { $nin: ['CANCELLED'] } })
        .select('serviceDate routeId routeCode routeName operationCycleCode departureTime expectedArrivalTime turnaroundEndTime').lean(),
      User.find({ role: 'DRIVER', status: 'ACTIVE', 'accountLock.isLocked': { $ne: true } }).select('fullName email phoneNumber staffAvailability driverLicense').lean(),
      User.find({ role: { $in: ['CONDUCTOR', 'BUS_ASSISTANT'] }, status: 'ACTIVE', 'accountLock.isLocked': { $ne: true } }).select('fullName email phoneNumber staffAvailability').lean(),
      DriverShiftAssignment.find({ workDate: { $gte: assignmentStart, $lt: assignmentEnd }, status: { $in: ACTIVE_ASSIGNMENTS } }).populate('shiftId').lean(),
      AssistantShiftAssignment.find({ workDate: { $gte: assignmentStart, $lt: assignmentEnd }, status: { $in: ACTIVE_ASSIGNMENTS } }).populate('shiftId').lean(),
      TripSchedule.find({ status: 'COMPLETED', $or: [{ 'driver.userId': { $ne: null } }, { 'assistant.userId': { $ne: null } }] }).select('routeId driver.userId assistant.userId').lean(),
      Route.find({ status: 'PUBLISHED' }).select('vehicleAssignment routeCode').lean(),
    ]);
    const routesById = new Map(routes.map((route) => [id(route), route]));
    const result = days.flatMap((date) => {
      const key = dateKey(date);
      const dailyTrips = trips.filter((trip) => dateKey(new Date(trip.serviceDate)) === key);
      const ownDriverAssignments = driverAssignments.filter((item) => dateKey(new Date(item.workDate)) === key && item.shiftId);
      const ownAssistantAssignments = assistantAssignments.filter((item) => dateKey(new Date(item.workDate)) === key && item.shiftId);
      const driverAllocations = ownDriverAssignments.map((item) => ({ resourceId: item.driverId, startTime: item.shiftId.startTime, endTime: item.shiftId.endTime }));
      const assistantAllocations = ownAssistantAssignments.map((item) => ({ resourceId: item.assistantId, startTime: item.shiftId.startTime, endTime: item.shiftId.endTime }));
      return globalDemandFromTrips(dailyTrips).map((demand) => {
        const windowCoverage = demand.windows.map((window) => {
          const coversWindow = (item) => clockMinutes(item.shiftId.startTime) <= clockMinutes(window.startTime)
            && clockMinutes(item.shiftId.endTime) >= clockMinutes(window.endTime);
          const assignedDrivers = new Set(ownDriverAssignments.filter(coversWindow).map((item) => id(item.driverId))).size;
          const assignedAssistants = new Set(ownAssistantAssignments.filter(coversWindow).map((item) => id(item.assistantId))).size;
          return { ...window, assignedDrivers, assignedAssistants, missingDrivers: Math.max(0, window.required - assignedDrivers), missingAssistants: Math.max(0, window.required - assignedAssistants), surplusDrivers: Math.max(0, assignedDrivers - window.required), surplusAssistants: Math.max(0, assignedAssistants - window.required) };
        });
        const missingDrivers = Math.max(0, ...windowCoverage.map((window) => window.missingDrivers));
        const missingAssistants = Math.max(0, ...windowCoverage.map((window) => window.missingAssistants));
        const assignedDrivers = Math.max(0, demand.required - missingDrivers);
        const assignedAssistants = Math.max(0, demand.required - missingAssistants);
        const periodTrips = demand.cycles.flatMap((cycle) => cycle.trips);
        const periodRouteIds = new Set(periodTrips.map((trip) => id(trip.routeId)));
        const routeGroups = new Map();
        periodTrips.forEach((trip) => {
          const routeId = id(trip.routeId) || trip.routeCode;
          const current = routeGroups.get(routeId) || { routeId, routeCode: trip.routeCode, routeName: trip.routeName, tripCount: 0, firstDeparture: trip.departureTime, lastArrival: trip.expectedArrivalTime };
          current.tripCount += 1;
          if (trip.departureTime < current.firstDeparture) current.firstDeparture = trip.departureTime;
          if (trip.expectedArrivalTime > current.lastArrival) current.lastArrival = trip.expectedArrivalTime;
          routeGroups.set(routeId, current);
        });
        const candidate = (person, role) => {
          const allocations = role === 'DRIVER' ? driverAllocations : assistantAllocations;
          const allAssignments = role === 'DRIVER' ? driverAssignments : assistantAssignments;
          const stats = allocationStats(allocations, person._id);
          const currentWeek = dateKey(weekStart(date));
          const weeklyMinutes = allAssignments
            .filter((item) => id(role === 'DRIVER' ? item.driverId : item.assistantId) === id(person)
              && item.shiftId && dateKey(weekStart(item.workDate)) === currentWeek)
            .reduce((sum, item) => sum + Math.max(0, clockMinutes(item.shiftId.endTime) - clockMinutes(item.shiftId.startTime)), 0);
          const licenseEligible = role !== 'DRIVER' || [...periodRouteIds].every((routeId) => {
            const route = routesById.get(routeId);
            return route && suitableLicense(person, route, date);
          });
          const eligible = licenseEligible
            && weeklyMinutes + (clockMinutes(demand.endTime) - clockMinutes(demand.startTime)) <= TARGET_WEEKLY_WORK_MINUTES
            && resourceEligible({ resource: person, slot: demand, allocations, onLeave: leaveConflict(person, date) });
          const experienceCount = history.filter((trip) => periodRouteIds.has(id(trip.routeId)) && id(role === 'DRIVER' ? trip.driver?.userId : trip.assistant?.userId) === id(person)).length;
          let score = 60 + Math.min(20, experienceCount * 2) + Math.max(0, Math.round((TARGET_WEEKLY_WORK_MINUTES - weeklyMinutes) / 240));
          if (!eligible) score = 0;
          const reasons = [weeklyMinutes < TARGET_WEEKLY_WORK_MINUTES * 0.75 ? 'Đang thiếu giờ làm trong tuần' : '', experienceCount ? `Đã phục vụ các tuyến này ${experienceCount} lượt` : '', eligible ? 'Không trùng ca, đủ thời gian nghỉ và đủ điều kiện' : (licenseEligible ? 'Không đủ điều kiện nhận ca' : 'Giấy phép lái xe không phù hợp')].filter(Boolean);
          return { ...publicStaff(person), role, score: Math.min(100, score), assignedMinutes: stats.minutes, weeklyAssignedMinutes: weeklyMinutes, routeExperienceCount: experienceCount, eligible, reasons };
        };
        return {
          workDate: key,
          shiftType: demand.shiftType,
          startTime: demand.startTime,
          endTime: demand.endTime,
          tripCount: demand.tripCount,
          requiredDrivers: demand.required,
          requiredAssistants: demand.required,
          assignedDrivers,
          assignedAssistants,
          missingDrivers,
          missingAssistants,
          surplusDrivers: Math.max(0, ...windowCoverage.map((window) => window.surplusDrivers)),
          surplusAssistants: Math.max(0, ...windowCoverage.map((window) => window.surplusAssistants)),
          coverageWindows: windowCoverage,
          routes: [...routeGroups.values()],
          driverCandidates: drivers.map((person) => candidate(person, 'DRIVER')).filter((person) => person.eligible).sort((left, right) => right.score - left.score),
          assistantCandidates: assistants.map((person) => candidate(person, 'ASSISTANT')).filter((person) => person.eligible).sort((left, right) => right.score - left.score),
        };
      });
    });
    return { startDate: dateKey(start), endDate: dateKey(days.at(-1)), days: result };
  }

  static async list({ workDate, status } = {}) {
    const filter = {};
    const date = dateOnly(workDate);
    if (date) filter.workDate = { $gte: date, $lt: nextDay(date) };
    if (status) filter.status = status;
    return SchedulingPlan.find(filter).sort({ createdAt: -1 }).limit(50).lean();
  }

  static async cancel({ planId, actorId }) {
    if (!mongoose.Types.ObjectId.isValid(planId)) throw Object.assign(new Error('Kế hoạch không hợp lệ.'), { statusCode: 400 });
    const plan = await SchedulingPlan.findOneAndUpdate({ _id: planId, status: 'DRAFT' }, { $set: { status: 'CANCELLED', updatedBy: actorId } }, { new: true }).lean();
    if (!plan) throw Object.assign(new Error('Không tìm thấy kế hoạch DRAFT.'), { statusCode: 404 });
    return plan;
  }

  static async generate({ workDate, actorId }) {
    const date = dateOnly(workDate);
    if (!date) throw Object.assign(new Error('Ngày lập kế hoạch không hợp lệ.'), { statusCode: 400 });
    const configFilter = { isActive: true, $or: [{ effectiveDate: { $gte: date, $lt: nextDay(date) } }, { effectiveDate: null, dayOfWeek: date.getDay() }] };
    const [savedConfigs, routes, drivers, assistants, vehicles, driverExisting, assistantExisting, vehicleExisting, history, dailyTrips] = await Promise.all([
      RouteOperatingConfig.find(configFilter).lean(),
      Route.find({ status: 'PUBLISHED' }).lean(),
      User.find({ role: 'DRIVER', status: 'ACTIVE', 'accountLock.isLocked': { $ne: true } }).select('fullName email phoneNumber status driverLicense staffAvailability').lean(),
      User.find({ role: { $in: ['CONDUCTOR', 'BUS_ASSISTANT'] }, status: 'ACTIVE', 'accountLock.isLocked': { $ne: true } }).select('fullName email phoneNumber status staffAvailability').lean(),
      FleetBus.find({ status: { $in: ['AVAILABLE', 'ACTIVE', 'RESERVE', 'ASSIGNED'] }, busCode: { $not: /^(DN-AUTO-|DN-DEMO-)/i } }).lean(),
      DriverShiftAssignment.find({ workDate: date, status: { $in: ACTIVE_ASSIGNMENTS } }).populate('shiftId').lean(),
      AssistantShiftAssignment.find({ workDate: date, status: { $in: ACTIVE_ASSIGNMENTS } }).populate('shiftId').lean(),
      VehicleShiftAssignment.find({ workDate: date, status: { $in: ACTIVE_ASSIGNMENTS } }).populate('shiftId').lean(),
      TripSchedule.find({ status: 'COMPLETED', 'driver.userId': { $ne: null } }).select('routeId driver.userId').lean(),
      TripSchedule.find({ serviceDate: { $gte: date, $lt: nextDay(date) }, status: { $ne: 'CANCELLED' } }).select('routeId operationCycleCode direction departureTime expectedArrivalTime').lean(),
    ]);
    if (!dailyTrips.length) throw Object.assign(new Error('Chưa có chuyến nào trong ngày đã chọn. Hãy tạo chuyến trước khi phân bổ nguồn lực.'), { statusCode: 409 });
    const tripConfigs = configsFromTrips(dailyTrips);
    const configs = tripConfigs.length ? tripConfigs : savedConfigs;
    const routeMap = new Map(routes.map((route) => [id(route), route]));
    const allocations = {
      drivers: driverExisting.map((item) => ({ resourceId: item.driverId, startTime: item.shiftId?.startTime, endTime: item.shiftId?.endTime })),
      assistants: assistantExisting.map((item) => ({ resourceId: item.assistantId, startTime: item.shiftId?.startTime, endTime: item.shiftId?.endTime })),
      vehicles: vehicleExisting.map((item) => ({ resourceId: item.vehicleId, startTime: item.shiftId?.startTime, endTime: item.shiftId?.endTime })),
    };
    const ordered = [...configs].sort((left, right) => (DEMAND_PRIORITY[right.demandLevel] - DEMAND_PRIORITY[left.demandLevel]) || right.requiredDrivers - left.requiredDrivers || left.startTime.localeCompare(right.startTime));
    const rows = [];
    for (const config of ordered) {
      const route = routeMap.get(id(config.routeId));
      if (!route) continue;
      const configShiftType = config.endTime <= '12:00' ? 'MORNING' : 'AFTERNOON';
      const configRange = timeRange(config);
      const requiredTrips = Number(config.actualTripCount || (Math.ceil((configRange.end - configRange.start) / Number(config.frequencyMinutes || 1)) * 2));
      const plannedTrips = dailyTrips.filter((trip) => id(trip.routeId) === id(route) && trip.departureTime >= config.startTime && trip.departureTime < config.endTime).length;
      const positions = Math.max(config.requiredDrivers, config.requiredAssistants, config.requiredVehicles);
      for (let position = 0; position < positions; position += 1) {
        const requiresDriver = position < config.requiredDrivers;
        const requiresAssistant = position < config.requiredAssistants;
        const requiresVehicle = position < config.requiredVehicles;
        const slot = { startTime: config.startTime, endTime: config.endTime };
        const driverOptions = drivers.filter((driver) => suitableLicense(driver, route, date) && resourceEligible({ resource: driver, slot, allocations: allocations.drivers, onLeave: leaveConflict(driver, date) })).map((driver) => {
          const stats = allocationStats(allocations.drivers, driver._id);
          const routeExperience = history.some((trip) => id(trip.routeId) === id(route) && id(trip.driver?.userId) === id(driver));
          return { ...publicStaff(driver), assignedMinutes: stats.minutes, ...scoreDriver({ driverId: driver._id, assignedMinutes: stats.minutes, routeExperience, shiftType: configShiftType }) };
        }).sort((left, right) => right.score - left.score);
        const assistantOptions = assistants.filter((assistant) => resourceEligible({ resource: assistant, slot, allocations: allocations.assistants, onLeave: leaveConflict(assistant, date) })).map(publicStaff);
        const vehicleOptions = vehicles.filter((vehicle) => suitableVehicle(vehicle, route) && operationalVehicle(vehicle, date) && resourceEligible({ resource: { ...vehicle, status: 'ACTIVE' }, slot, allocations: allocations.vehicles })).map(publicVehicle);
        const driver = requiresDriver ? driverOptions[0] : null;
        const assistant = requiresAssistant ? assistantOptions[0] : null;
        const vehicle = requiresVehicle ? vehicleOptions[0] : null;
        if (driver) allocations.drivers.push({ resourceId: driver._id, ...slot });
        if (assistant) allocations.assistants.push({ resourceId: assistant._id, ...slot });
        if (vehicle) allocations.vehicles.push({ resourceId: vehicle._id, ...slot });
        const shiftCode = `PLAN-${route.routeCode}-${dateToken(date)}-${config.startTime.replace(':', '')}-${String(position + 1).padStart(2, '0')}`;
        const hardErrors = [requiresDriver && !driver ? 'Thiếu tài xế đủ điều kiện.' : '', requiresAssistant && !assistant ? 'Thiếu phụ xe đủ điều kiện.' : '', requiresVehicle && !vehicle ? 'Thiếu xe đủ điều kiện.' : '', position === 0 && plannedTrips < requiredTrips ? `Thiếu ${requiredTrips - plannedTrips} chuyến theo tần suất yêu cầu.` : ''].filter(Boolean);
        rows.push({
          previewId: new mongoose.Types.ObjectId().toString(), shiftCode, shiftName: `${route.routeCode} ${config.startTime}-${config.endTime} #${position + 1}`,
          workDate: dateKey(date), routeId: route._id, route: { _id: route._id, routeCode: route.routeCode, routeName: route.routeName }, ...slot,
          shiftType: configShiftType, demandLevel: config.demandLevel, requiredTrips: position === 0 ? requiredTrips : 0, plannedTrips: position === 0 ? plannedTrips : 0,
          requiresDriver, requiresAssistant, requiresVehicle, driverId: driver?._id || '', driver, assistantId: assistant?._id || '', assistant,
          vehicleId: vehicle?._id || '', vehicle, availableDrivers: driverOptions, availableAssistants: assistantOptions, availableVehicles: vehicleOptions,
          hardErrors, warnings: driver?.warnings || [], status: hardErrors.length ? 'BLOCKED' : 'READY',
        });
      }
    }
    rows.sort((left, right) => left.startTime.localeCompare(right.startTime) || left.route.routeCode.localeCompare(right.route.routeCode));
    const summary = validationSummary(rows);
    summary.demandByShift = configs.map((config) => ({
      routeId: config.routeId,
      shiftType: config.endTime <= '12:00' ? 'MORNING' : 'AFTERNOON',
      startTime: config.startTime,
      endTime: config.endTime,
      tripCount: Number(config.actualTripCount || 0),
      requiredDrivers: Number(config.requiredDrivers || 0),
      requiredAssistants: Number(config.requiredAssistants || 0),
      requiredVehicles: Number(config.requiredVehicles || 0),
    }));
    const plan = await SchedulingPlan.create({ planCode: `PLAN-${dateToken(date)}-${Date.now().toString(36).toUpperCase()}`, workDate: date, status: 'DRAFT', rows, summary, hardErrors: summary.hardErrors, warnings: summary.warnings, createdBy: actorId, updatedBy: actorId });
    return plan.toObject();
  }

  static async validate({ planId, rows }) {
    const plan = await SchedulingPlan.findById(planId).lean();
    if (!plan || plan.status !== 'DRAFT') throw Object.assign(new Error('Không tìm thấy kế hoạch nháp.'), { statusCode: 404 });
    const candidateRows = Array.isArray(rows) ? rows : plan.rows;
    const workDate = dateOnly(plan.workDate);
    const [driverExisting, assistantExisting, vehicleExisting, routes, existingShifts, dailyTrips] = await Promise.all([
      DriverShiftAssignment.find({ workDate, status: { $in: ACTIVE_ASSIGNMENTS } }).populate('shiftId').lean(),
      AssistantShiftAssignment.find({ workDate, status: { $in: ACTIVE_ASSIGNMENTS } }).populate('shiftId').lean(),
      VehicleShiftAssignment.find({ workDate, status: { $in: ACTIVE_ASSIGNMENTS } }).populate('shiftId').lean(),
      Route.find({ _id: { $in: candidateRows.map((row) => row.routeId).filter(Boolean) } }).lean(),
      ShiftService.listShifts({ date: dateKey(workDate) }),
      TripSchedule.find({ serviceDate: { $gte: workDate, $lt: nextDay(workDate) }, status: { $ne: 'CANCELLED' } }).select('routeId departureTime').lean(),
    ]);
    const routeMap = new Map(routes.map((route) => [id(route), route]));
    const seen = {
      drivers: driverExisting.map((item) => ({ resourceId: item.driverId, startTime: item.shiftId?.startTime, endTime: item.shiftId?.endTime })),
      assistants: assistantExisting.map((item) => ({ resourceId: item.assistantId, startTime: item.shiftId?.startTime, endTime: item.shiftId?.endTime })),
      vehicles: vehicleExisting.map((item) => ({ resourceId: item.vehicleId, startTime: item.shiftId?.startTime, endTime: item.shiftId?.endTime })),
    };
    const validated = [];
    const shiftCodes = new Set();
    for (const original of candidateRows) {
      const row = { ...original, hardErrors: [], warnings: original.warnings || [] };
      row.hardErrors.push(...validateOperatingWindow(row));
      if (!mongoose.Types.ObjectId.isValid(row.routeId)) row.hardErrors.push('Tuyến không hợp lệ.');
      const route = routeMap.get(id(row.routeId));
      if (!route) row.hardErrors.push('Không tìm thấy tuyến hoạt động.');
      if (shiftCodes.has(row.shiftCode)) row.hardErrors.push('Mã ca bị trùng trong kế hoạch.');
      shiftCodes.add(row.shiftCode);
      if (existingShifts.some((shift) => shift.status !== 'ARCHIVED' && shift.shiftCode === row.shiftCode)) row.hardErrors.push('Mã ca đã tồn tại trong lịch chính thức.');
      if (Number(row.requiredTrips || 0) > 0) {
        const plannedTrips = dailyTrips.filter((trip) => id(trip.routeId) === id(row.routeId) && trip.departureTime >= row.startTime && trip.departureTime < row.endTime).length;
        row.plannedTrips = plannedTrips;
        if (plannedTrips < Number(row.requiredTrips)) row.hardErrors.push(`Thiếu ${Number(row.requiredTrips) - plannedTrips} chuyến theo tần suất yêu cầu.`);
      }
      const [driver, assistant, vehicle] = await Promise.all([
        row.driverId ? User.findOne({ _id: row.driverId, role: 'DRIVER', status: 'ACTIVE' }).lean() : null,
        row.assistantId ? User.findOne({ _id: row.assistantId, role: { $in: ['CONDUCTOR', 'BUS_ASSISTANT'] }, status: 'ACTIVE' }).lean() : null,
        row.vehicleId ? FleetBus.findById(row.vehicleId).lean() : null,
      ]);
      if (row.requiresDriver && !driver) row.hardErrors.push('Thiếu tài xế hợp lệ.');
      if (row.requiresAssistant && !assistant) row.hardErrors.push('Thiếu phụ xe hợp lệ.');
      if (row.requiresVehicle && (!vehicle || !operationalVehicle(vehicle, dateOnly(row.workDate)))) row.hardErrors.push('Thiếu xe sẵn sàng hoặc xe đang bảo trì.');
      if (driver && (leaveConflict(driver, workDate) || !suitableLicense(driver, route || {}, workDate))) row.hardErrors.push('Tài xế nghỉ phép hoặc bằng lái không phù hợp.');
      if (assistant && leaveConflict(assistant, workDate)) row.hardErrors.push('Phụ xe đang nghỉ phép.');
      if (vehicle && route && !suitableVehicle(vehicle, route)) row.hardErrors.push('Xe không phù hợp loại hoặc sức chứa của tuyến.');
      [['drivers', row.driverId], ['assistants', row.assistantId], ['vehicles', row.vehicleId]].forEach(([kind, resourceId]) => {
        const allocations = seen[kind];
        const resource = kind === 'drivers' ? driver : kind === 'assistants' ? assistant : vehicle;
        if (resourceId && resource && !resourceEligible({ resource: { ...resource, status: 'ACTIVE' }, slot: row, allocations, onLeave: kind !== 'vehicles' && leaveConflict(resource, workDate), operational: kind !== 'vehicles' || operationalVehicle(resource, workDate) })) {
          row.hardErrors.push(`${kind === 'drivers' ? 'Tài xế' : kind === 'assistants' ? 'Phụ xe' : 'Xe'} bị trùng lịch, thiếu thời gian nghỉ hoặc vượt giờ.`);
        }
        if (resourceId) seen[kind].push({ resourceId, startTime: row.startTime, endTime: row.endTime });
      });
      row.status = row.hardErrors.length ? 'BLOCKED' : 'READY';
      validated.push(row);
    }
    const summary = { ...validationSummary(validated), demandByShift: plan.summary?.demandByShift || [] };
    await SchedulingPlan.findByIdAndUpdate(planId, { $set: { rows: validated, summary, hardErrors: summary.hardErrors, warnings: summary.warnings } });
    return { ...plan, rows: validated, summary, hardErrors: summary.hardErrors, warnings: summary.warnings };
  }

  static async confirm({ planId, rows, actorId }) {
    const validated = await this.validate({ planId, rows });
    if (validated.hardErrors.length) throw Object.assign(new Error('Không thể xác nhận lịch vận hành.'), { statusCode: 409, errors: validated.hardErrors });
    const created = [];
    try {
      for (const row of validated.rows) {
        const payload = ShiftService.normalizeShiftPayload({ ...row, status: 'PUBLISHED', approvalStatus: 'PUBLISHED' }, actorId);
        payload.createdBy = actorId;
        const shift = await ShiftService.createShift(payload);
        if (row.driverId) await ShiftService.assignDriverToShift(shift._id, { driverId: row.driverId, actorId });
        if (row.assistantId) await ShiftService.assignAssistantToShift(shift._id, { assistantId: row.assistantId, actorId });
        if (row.vehicleId) await ShiftService.assignVehicleToShift(shift._id, { vehicleId: row.vehicleId, actorId });
        created.push(shift._id);
      }
    } catch (error) {
      await Promise.all(created.map((shiftId) => ShiftService.deactivateShift(shiftId, actorId).catch(() => null)));
      throw error;
    }
    const plan = await SchedulingPlan.findByIdAndUpdate(planId, { $set: { status: 'CONFIRMED', rows: validated.rows, summary: validated.summary, confirmedShiftIds: created, confirmedBy: actorId, confirmedAt: new Date(), updatedBy: actorId } }, { new: true }).lean();
    return plan;
  }
}
