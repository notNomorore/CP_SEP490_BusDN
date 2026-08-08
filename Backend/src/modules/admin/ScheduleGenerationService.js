import mongoose from 'mongoose';
import Route from '../routes/Route.js';
import FleetBus from './FleetBus.js';
import TripSchedule from './TripSchedule.js';
import User from '../auth/User.js';
import DriverShiftAssignment from '../shifts/DriverShiftAssignment.js';
import AssistantShiftAssignment from '../shifts/AssistantShiftAssignment.js';
import { isTripOutsideOperatingWindow } from './scheduleOperatingWindow.js';

const ACTIVE_TRIP_STATUSES = ['PLANNED', 'ASSIGNED', 'IN_PROGRESS'];
const ASSIGNABLE_BUS_STATUSES = ['AVAILABLE', 'ACTIVE', 'RESERVE'];
const ASSIGNABLE_SHIFT_STATUSES = ['ACTIVE', 'APPROVED', 'PUBLISHED'];
const MAX_DAILY_STAFF_WORK_MINUTES = 8 * 60;
const MIN_RESOURCE_BUFFER_MINUTES = 10;

const normalizeDate = (value) => {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      date.setHours(0, 0, 0, 0);
      return date;
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (date, amount) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  next.setHours(0, 0, 0, 0);
  return next;
};

const dateBounds = (value) => {
  const start = normalizeDate(value);
  if (!start) return null;
  const end = addDays(start, 1);
  return { start, end };
};

const dateKey = (value) => {
  const date = normalizeDate(value);
  return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '';
};

const toMinutes = (value) => {
  if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return null;
  const [hours, minutes] = String(value).split(':').map(Number);
  return hours <= 23 && minutes <= 59 ? (hours * 60) + minutes : null;
};

const toClock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const addMinutesToClock = (value, minutesToAdd) => {
  const minutes = toMinutes(value);
  return minutes === null ? value : toClock(Math.min(1439, minutes + minutesToAdd));
};
const getId = (value) => String(value?._id || value || '');
const overlaps = (first, second) => first.start < second.end && second.start < first.end;

const effectiveScheduleEnd = (schedule) => {
  const explicitEnd = toMinutes(schedule.turnaroundEndTime);
  if (explicitEnd !== null) return explicitEnd;
  const arrival = toMinutes(schedule.expectedArrivalTime || schedule.departureTime);
  return arrival === null ? null : Math.min(1439, arrival + MIN_RESOURCE_BUFFER_MINUTES);
};

const publicVehicle = (vehicle) => vehicle ? {
  busId: vehicle._id,
  busCode: vehicle.busCode,
  plateNumber: vehicle.plateNumber,
  busType: vehicle.busType,
  capacity: vehicle.capacity,
} : {};

const publicPerson = (person) => person ? {
  userId: person._id,
  fullName: person.fullName,
  role: person.role,
  phone: person.phoneNumber || '',
} : {};

const isInsideShift = (range, shift) => {
  const start = toMinutes(shift?.startTime);
  const end = toMinutes(shift?.endTime);
  return start !== null && end !== null && range.start >= start && range.end <= end;
};

const hasConflict = (resourceId, rows, field, range) => rows.some((row) => (
  getId(row[field]?.userId || row[field]?.busId) === getId(resourceId)
  && overlaps(range, {
    start: toMinutes(row.departureTime),
    end: effectiveScheduleEnd(row),
  })
));

const getWorkMinutes = (item) => {
  const start = toMinutes(item.departureTime);
  const end = toMinutes(item.expectedArrivalTime || item.departureTime);
  return start !== null && end !== null && end > start ? end - start : 0;
};

const getAssignedWorkMinutes = (resourceId, rows, field) => rows
  .filter((row) => getId(row[field]?.userId || row[field]?.busId) === getId(resourceId))
  .reduce((total, row) => total + getWorkMinutes(row), 0);

const getAssignedTripCount = (resourceId, rows, field) => rows
  .filter((row) => getId(row[field]?.userId || row[field]?.busId) === getId(resourceId))
  .length;

const getResourceLoad = (resourceId, existingSchedules, previewRows, field) => ({
  minutes: getAssignedWorkMinutes(resourceId, existingSchedules, field)
    + getAssignedWorkMinutes(resourceId, previewRows, field),
  trips: getAssignedTripCount(resourceId, existingSchedules, field)
    + getAssignedTripCount(resourceId, previewRows, field),
});

const hasDailyWorkloadCapacity = (resourceId, existingSchedules, previewRows, field, workRange) => {
  if (!['driver', 'assistant'].includes(field)) return true;
  const currentMinutes = workRange.end - workRange.start;
  const assignedMinutes = getAssignedWorkMinutes(resourceId, existingSchedules, field)
    + getAssignedWorkMinutes(resourceId, previewRows, field);
  return assignedMinutes + currentMinutes <= MAX_DAILY_STAFF_WORK_MINUTES;
};

const chooseResource = (resources, existingSchedules, previewRows, field, conflictRange, workRange = conflictRange, preferredResource = null) => {
  const candidates = resources.filter((resource) => {
    const id = resource._id;
    if (hasConflict(id, previewRows, field, conflictRange)) return false;
    if (!hasDailyWorkloadCapacity(id, existingSchedules, previewRows, field, workRange)) return false;
    return !existingSchedules.some((schedule) => (
      getId(schedule[field]?.userId || schedule[field]?.busId) === getId(id)
      && overlaps(conflictRange, {
        start: toMinutes(schedule.departureTime),
        end: effectiveScheduleEnd(schedule),
      })
    ));
  });

  const preferred = preferredResource
    ? candidates.find((resource) => getId(resource._id) === getId(preferredResource._id))
    : null;
  if (preferred) return preferred;

  return candidates
    .map((resource, index) => ({
      resource,
      index,
      load: getResourceLoad(resource._id, existingSchedules, previewRows, field),
    }))
    .sort((left, right) => (
      left.load.trips - right.load.trips
      || left.load.minutes - right.load.minutes
      || left.index - right.index
    ))[0]?.resource || null;
};

const weekdayToken = (date) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
const AFTERNOON_SHIFT_START = 13 * 60 + 30;
const FIRST_BUS_DEPARTURE_MINUTES = 5 * 60 + 30;
const LAST_BUS_DEPARTURE_MINUTES = 18 * 60 + 30;
const getRouteOperatingWindow = (route) => {
  const configuredFirst = toMinutes(route?.scheduleConfig?.firstDepartureTime);
  const configuredLast = toMinutes(route?.scheduleConfig?.lastDepartureTime);
  return {
    first: configuredFirst === null ? FIRST_BUS_DEPARTURE_MINUTES : configuredFirst,
    last: configuredLast === null ? LAST_BUS_DEPARTURE_MINUTES : configuredLast,
  };
};
const PEAK_WINDOWS = [
  { start: 6 * 60 + 30, end: 8 * 60 + 30 },
  { start: 16 * 60 + 30, end: 18 * 60 + 30 },
];
const getShiftLabel = (departureMinutes) => (
  departureMinutes < AFTERNOON_SHIFT_START ? 'MORNING' : 'AFTERNOON'
);
const isPeakDeparture = (departureMinutes) => PEAK_WINDOWS.some((window) => (
  departureMinutes >= window.start && departureMinutes <= window.end
));

const hasLeaveConflict = (staff, workDate) => {
  const leaveRequests = Array.isArray(staff?.staffAvailability?.leaveRequests)
    ? staff.staffAvailability.leaveRequests
    : [];
  return leaveRequests.some((leave) => {
    const status = String(leave.status || '').toUpperCase();
    if (!['APPROVED', 'ACTIVE'].includes(status)) return false;
    const start = normalizeDate(leave.startDate || leave.date);
    const end = normalizeDate(leave.endDate || leave.date);
    return start && end && workDate >= start && workDate <= end;
  });
};

const getOperationalDurationMinutes = (direction) => {
  const configuredDuration = Math.max(0, Number(direction?.estimatedDurationMinutes || 0));
  const distanceKm = Math.max(0, Number(direction?.estimatedDistanceKm || 0));
  const stopCount = Array.isArray(direction?.orderedStops) ? direction.orderedStops.length : 0;
  const urbanBusDuration = distanceKm > 0
    ? Math.ceil((distanceKm / 20) * 60 + Math.max(0, stopCount - 2) * 0.75)
    : 0;
  return Math.min(80, Math.max(60, configuredDuration, urbanBusDuration));
};

const getMaxConcurrentRows = (rows) => {
  const rowsByDate = new Map();
  rows.forEach((row) => {
    const start = toMinutes(row.departureTime);
    const end = effectiveScheduleEnd(row);
    if (start === null || end === null || end <= start) return;
    const dayRows = rowsByDate.get(row.serviceDate) || [];
    dayRows.push({ start, end });
    rowsByDate.set(row.serviceDate, dayRows);
  });

  let maxConcurrent = 0;
  rowsByDate.forEach((dayRows) => {
    const events = dayRows
      .flatMap((row) => [
        { minute: row.start, delta: 1 },
        { minute: row.end, delta: -1 },
      ])
      .sort((left, right) => left.minute - right.minute || left.delta - right.delta);
    let running = 0;
    events.forEach((event) => {
      running += event.delta;
      maxConcurrent = Math.max(maxConcurrent, running);
    });
  });
  return maxConcurrent;
};

const buildPreviewSummary = (rows, vehicles, availableDriverIds, availableAssistantIds) => ({
  totalTrips: rows.length,
  assignedTrips: rows.filter((row) => row.vehicle?.busId && row.driver?.userId && row.assistant?.userId).length,
  missingVehicles: rows.filter((row) => !row.vehicle?.busId).length,
  missingDrivers: rows.filter((row) => !row.driver?.userId).length,
  missingAssistants: rows.filter((row) => !row.assistant?.userId).length,
  maxConcurrentTrips: getMaxConcurrentRows(rows),
  assignableVehicles: vehicles.length,
  availableDrivers: availableDriverIds.size,
  availableAssistants: availableAssistantIds.size,
});

export default class ScheduleGenerationService {
  static async generatePreview(body) {
    const routeId = body.routeId;
    const startDate = normalizeDate(body.startDate);
    const endDate = normalizeDate(body.endDate || body.startDate);
    if (!mongoose.Types.ObjectId.isValid(routeId)) throw Object.assign(new Error('Vui lòng chọn tuyến.'), { statusCode: 400 });
    if (!startDate || !endDate || startDate > endDate) throw Object.assign(new Error('Khoảng ngày không hợp lệ.'), { statusCode: 400 });
    if ((endDate - startDate) / 86400000 > 31) throw Object.assign(new Error('Chỉ được sinh tối đa 31 ngày.'), { statusCode: 400 });

    const route = await Route.findById(routeId).lean();
    if (!route) throw Object.assign(new Error('Không tìm thấy tuyến.'), { statusCode: 404 });
    if (route.status !== 'PUBLISHED') {
      throw Object.assign(new Error('Chỉ có thể sinh lịch cho tuyến đã công bố.'), { statusCode: 409 });
    }
    const { first, last } = getRouteOperatingWindow(route);
    const peakFrequency = Number(route.scheduleConfig?.peakFrequencyMinutes || route.scheduleConfig?.frequencyMinutes || 0);
    const offPeakFrequency = Number(route.scheduleConfig?.offPeakFrequencyMinutes || peakFrequency);
    const layover = Math.max(MIN_RESOURCE_BUFFER_MINUTES, Number(route.scheduleConfig?.layoverMinutes || 0));
    if (
      first === null
      || last === null
      || first >= last
      || !Number.isFinite(peakFrequency)
      || peakFrequency < 1
      || !Number.isFinite(offPeakFrequency)
      || offPeakFrequency < 1
    ) {
      throw Object.assign(new Error('Giờ hoạt động hoặc tần suất tuyến không hợp lệ.'), { statusCode: 400 });
    }

    const [vehicles, drivers, assistants] = await Promise.all([
      FleetBus.find({
        status: { $in: ASSIGNABLE_BUS_STATUSES },
        busCode: { $not: /^(DN-AUTO-|DN-DEMO-)/i },
      }).sort({ busCode: 1 }).lean(),
      User.find({ role: 'DRIVER', status: 'ACTIVE', isFirstLogin: { $ne: true }, 'accountLock.isLocked': { $ne: true } }).sort({ fullName: 1 }).lean(),
      User.find({ role: { $in: ['CONDUCTOR', 'BUS_ASSISTANT'] }, status: 'ACTIVE', isFirstLogin: { $ne: true }, 'accountLock.isLocked': { $ne: true } }).sort({ fullName: 1 }).lean(),
    ]);
    const previewRows = [];
    const availableDriverIds = new Set();
    const availableAssistantIds = new Set();

    for (let date = new Date(startDate); date <= endDate; date = addDays(date, 1)) {
      if (route.scheduleConfig?.operatingDays?.length && !route.scheduleConfig.operatingDays.includes(weekdayToken(date))) continue;
      const dayStart = new Date(date);
      const dayEnd = addDays(date, 1);
      const existingSchedulesForDay = await TripSchedule.find({ serviceDate: { $gte: dayStart, $lt: dayEnd }, status: { $ne: 'CANCELLED' } }).lean();
      const existingSchedules = body.replaceScheduled
        ? existingSchedulesForDay.filter((schedule) => !(
          getId(schedule.routeId) === getId(route._id)
          && schedule.status === 'PLANNED'
        ))
        : existingSchedulesForDay;
      const bounds = dateBounds(date);
      const workDateFilter = bounds ? { $gte: bounds.start, $lt: bounds.end } : date;
      const [driverAssignments, assistantAssignments] = await Promise.all([
        DriverShiftAssignment.find({ workDate: workDateFilter, status: { $in: ['ASSIGNED', 'IN_PROGRESS'] } }).populate('shiftId').lean(),
        AssistantShiftAssignment.find({ workDate: workDateFilter, status: { $in: ['ASSIGNED', 'IN_PROGRESS'] } }).populate('shiftId').lean(),
      ]);
      driverAssignments.forEach((assignment) => {
        if (ASSIGNABLE_SHIFT_STATUSES.includes(assignment.shiftId?.status)) availableDriverIds.add(getId(assignment.driverId));
      });
      assistantAssignments.forEach((assignment) => {
        if (ASSIGNABLE_SHIFT_STATUSES.includes(assignment.shiftId?.status)) availableAssistantIds.add(getId(assignment.assistantId));
      });

      const turnaroundResourcesByDeparture = new Map();
      for (const direction of ['OUTBOUND', 'INBOUND']) {
        const routeDirection = direction === 'OUTBOUND' ? route.outboundRoute : route.inboundRoute;
        const duration = getOperationalDurationMinutes(routeDirection);
        const inboundDepartures = direction === 'INBOUND'
          ? [...turnaroundResourcesByDeparture.keys()].sort((left, right) => left - right)
          : [];
        for (let departureIndex = 0, departure = first; direction === 'INBOUND' ? departureIndex < inboundDepartures.length : departure <= last;) {
          if (direction === 'INBOUND') departure = inboundDepartures[departureIndex];
          const frequency = direction === 'OUTBOUND' ? (isPeakDeparture(departure) ? peakFrequency : offPeakFrequency) : 0;
          const arrival = departure + duration;
          // lastDepartureTime limits departures; trips may arrive after that route-specific value.
          if (arrival > LAST_BUS_DEPARTURE_MINUTES || arrival > 1439 || arrival + layover > 1439) {
            if (direction === 'OUTBOUND') {
              departure += frequency;
            } else {
              departureIndex += 1;
            }
            continue;
          }
          const tripRange = { start: departure, end: arrival };
          const resourceRange = { start: departure, end: arrival + layover };
          const preferredResources = direction === 'INBOUND'
            ? turnaroundResourcesByDeparture.get(departure) || {}
            : {};
          const eligibleDrivers = drivers.filter((driver) => !hasLeaveConflict(driver, date) && driverAssignments.some((assignment) => (
            getId(assignment.driverId) === getId(driver) && ASSIGNABLE_SHIFT_STATUSES.includes(assignment.shiftId?.status) && isInsideShift(tripRange, assignment.shiftId)
          )));
          const eligibleAssistants = assistants.filter((assistant) => !hasLeaveConflict(assistant, date) && assistantAssignments.some((assignment) => (
            getId(assignment.assistantId) === getId(assistant) && ASSIGNABLE_SHIFT_STATUSES.includes(assignment.shiftId?.status) && isInsideShift(tripRange, assignment.shiftId)
          )));
          const vehicle = body.autoAssign !== false ? chooseResource(vehicles, existingSchedules, previewRows.filter((row) => row.serviceDate === dateKey(date)), 'vehicle', resourceRange, resourceRange, preferredResources.vehicle) : null;
          const driver = body.autoAssign !== false ? chooseResource(eligibleDrivers, existingSchedules, previewRows.filter((row) => row.serviceDate === dateKey(date)), 'driver', resourceRange, tripRange, preferredResources.driver) : null;
          const assistant = body.autoAssign !== false ? chooseResource(eligibleAssistants, existingSchedules, previewRows.filter((row) => row.serviceDate === dateKey(date)), 'assistant', resourceRange, tripRange, preferredResources.assistant) : null;
          const warnings = [];
          if (body.autoAssign !== false && !vehicle) warnings.push('Chưa tìm được xe phù hợp.');
          if (body.autoAssign !== false && !driver) warnings.push('Chưa tìm được tài xế có ca làm phù hợp.');
          if (body.autoAssign !== false && !assistant) warnings.push('Chưa tìm được phụ xe có ca làm phù hợp.');
          const code = `${route.routeCode}-${dateKey(date).replace(/-/g, '').slice(2)}-${toClock(departure).replace(':', '')}-${direction === 'OUTBOUND' ? 'D' : 'V'}`;
          previewRows.push({
            previewId: `${code}-${previewRows.length}`,
            scheduleCode: code,
            serviceDate: dateKey(date),
            routeId: route._id,
            routeCode: route.routeCode,
            routeName: route.routeName,
            direction,
            departureTime: toClock(departure),
            expectedArrivalTime: toClock(arrival),
            turnaroundEndTime: toClock(arrival + layover),
            shiftLabel: getShiftLabel(departure),
            vehicle: publicVehicle(vehicle),
            driver: publicPerson(driver),
            assistant: publicPerson(assistant),
            status: vehicle && driver && assistant ? 'ASSIGNED' : 'PLANNED',
            warnings,
          });
          if (direction === 'OUTBOUND') {
            turnaroundResourcesByDeparture.set(arrival + layover, { vehicle, driver, assistant });
            departure += frequency;
          } else {
            departureIndex += 1;
          }
        }
      }
    }
    return {
      route: {
        _id: route._id,
        routeCode: route.routeCode,
        routeName: route.routeName,
        scheduleConfig: route.scheduleConfig,
      },
      rows: previewRows.sort((left, right) => (
        String(left.serviceDate).localeCompare(String(right.serviceDate))
        || toMinutes(left.departureTime) - toMinutes(right.departureTime)
        || String(left.direction).localeCompare(String(right.direction))
      )),
      summary: buildPreviewSummary(previewRows, vehicles, availableDriverIds, availableAssistantIds),
    };
  }

  static async confirm(rows, actorId, replaceScheduled = false, planningOnly = false) {
    if (!Array.isArray(rows) || !rows.length) throw Object.assign(new Error('Không có lịch để lưu.'), { statusCode: 400 });
    const scheduleCodes = rows.map((row) => String(row.scheduleCode || '').trim().toUpperCase());
    if (scheduleCodes.some((code) => !code)) {
      throw Object.assign(new Error('Mỗi lịch phải có mã lịch.'), { statusCode: 400 });
    }
    if (new Set(scheduleCodes).size !== scheduleCodes.length) {
      throw Object.assign(new Error('Bản xem trước có mã lịch bị trùng.'), { statusCode: 409 });
    }

    const normalizedRows = rows.map((row) => {
      const serviceDate = normalizeDate(row.serviceDate);
      const departure = toMinutes(row.departureTime);
      const arrival = toMinutes(row.expectedArrivalTime);
      const fallbackTurnaroundEnd = addMinutesToClock(row.expectedArrivalTime, MIN_RESOURCE_BUFFER_MINUTES);
      const turnaroundEnd = toMinutes(row.turnaroundEndTime || fallbackTurnaroundEnd);
      if (!serviceDate || !mongoose.Types.ObjectId.isValid(row.routeId)) {
        throw Object.assign(new Error(`Lịch ${row.scheduleCode || ''} có ngày hoặc tuyến không hợp lệ.`), { statusCode: 400 });
      }
      if (departure === null || arrival === null || turnaroundEnd === null || arrival <= departure || turnaroundEnd < arrival + MIN_RESOURCE_BUFFER_MINUTES) {
        throw Object.assign(new Error(`Lịch ${row.scheduleCode || ''} có khung giờ không hợp lệ.`), { statusCode: 400 });
      }
      return {
        ...row,
        scheduleCode: String(row.scheduleCode).trim().toUpperCase(),
        serviceDate,
        range: { start: departure, end: turnaroundEnd },
      };
    });

    if (planningOnly) {
      const cycles = new Map();
      normalizedRows.forEach((row) => {
        const cycleCode = String(row.operationCycleCode || '').trim().toUpperCase();
        if (!cycleCode) {
          throw Object.assign(new Error(`Lịch ${row.scheduleCode} chưa có mã vòng vận hành D-V.`), { statusCode: 400 });
        }
        cycles.set(cycleCode, [...(cycles.get(cycleCode) || []), row]);
      });
      for (const [cycleCode, cycleRows] of cycles.entries()) {
        const outboundRows = cycleRows.filter((row) => row.direction === 'OUTBOUND');
        const inboundRows = cycleRows.filter((row) => row.direction === 'INBOUND');
        if (cycleRows.length !== 2 || outboundRows.length !== 1 || inboundRows.length !== 1) {
          throw Object.assign(new Error(`Vòng ${cycleCode} phải có đúng một lượt D và một lượt V.`), { statusCode: 409 });
        }
        const outbound = outboundRows[0];
        const inbound = inboundRows[0];
        if (
          getId(outbound.routeId) !== getId(inbound.routeId)
          || dateKey(outbound.serviceDate) !== dateKey(inbound.serviceDate)
        ) {
          throw Object.assign(new Error(`Hai lượt của vòng ${cycleCode} phải cùng tuyến và cùng ngày.`), { statusCode: 409 });
        }
        const earliestInbound = toMinutes(outbound.expectedArrivalTime) + MIN_RESOURCE_BUFFER_MINUTES;
        if (toMinutes(inbound.departureTime) < earliestInbound) {
          throw Object.assign(new Error(`Lượt V của vòng ${cycleCode} phải bắt đầu sau lượt D và thời gian quay đầu.`), { statusCode: 409 });
        }
      }
    }

    const routeIds = [...new Set(normalizedRows.map((row) => getId(row.routeId)).filter(Boolean))];
    const routes = await Route.find({ _id: { $in: routeIds } }).select('scheduleConfig routeCode').lean();
    const routesById = new Map(routes.map((route) => [getId(route), route]));
    for (const row of normalizedRows) {
      const route = routesById.get(getId(row.routeId));
      if (!route) {
        throw Object.assign(new Error(`Không tìm thấy tuyến của lịch ${row.scheduleCode}.`), { statusCode: 404 });
      }
      const { first, last } = getRouteOperatingWindow(route);
      const operatingDays = route.scheduleConfig?.operatingDays || [];
      if (operatingDays.length && !operatingDays.includes(weekdayToken(row.serviceDate))) {
        throw Object.assign(new Error(`Lịch ${row.scheduleCode} không thuộc ngày hoạt động của tuyến.`), { statusCode: 400 });
      }
      const isOutsideOperatingWindow = isTripOutsideOperatingWindow({
        direction: row.direction,
        departure: row.range.start,
        arrival: toMinutes(row.expectedArrivalTime),
        routeFirst: first,
        routeLast: last,
        enforceRouteDepartureWindow: !planningOnly,
      });
      if (first === null || last === null || isOutsideOperatingWindow) {
        throw Object.assign(new Error(`Lịch ${row.scheduleCode} nằm ngoài khung giờ cấu hình tuyến.`), { statusCode: 400 });
      }
    }
    const incompleteRow = normalizedRows.find((row) => !row.vehicle?.busId || !row.driver?.userId || !row.assistant?.userId);
    if (incompleteRow && !planningOnly) {
      throw Object.assign(new Error(`Lịch ${incompleteRow.scheduleCode} chưa đủ xe, tài xế hoặc phụ xe nên không thể lưu thành lịch chạy.`), { statusCode: 409 });
    }
    for (const row of normalizedRows) {
      const bounds = dateBounds(row.serviceDate);
      const workDateFilter = bounds ? { $gte: bounds.start, $lt: bounds.end } : row.serviceDate;
      if (row.vehicle?.busId) {
        const bus = await FleetBus.findOne({
          _id: row.vehicle.busId,
          status: { $in: ASSIGNABLE_BUS_STATUSES },
          busCode: { $not: /^(DN-AUTO-|DN-DEMO-)/i },
        }).lean();
        if (!bus) {
          throw Object.assign(new Error(`Xe của lịch ${row.scheduleCode} không khả dụng để khai thác.`), { statusCode: 409 });
        }
      }
      if (row.driver?.userId) {
        const driver = await User.findOne({
          _id: row.driver.userId,
          role: 'DRIVER',
          status: 'ACTIVE',
          isFirstLogin: { $ne: true },
          'accountLock.isLocked': { $ne: true },
        }).lean();
        if (!driver || hasLeaveConflict(driver, row.serviceDate)) {
          throw Object.assign(new Error(`Tài xế của lịch ${row.scheduleCode} không đủ điều kiện phân công.`), { statusCode: 409 });
        }
        const driverAssignments = await DriverShiftAssignment.find({
          driverId: row.driver.userId,
          workDate: workDateFilter,
          status: { $in: ['ASSIGNED', 'IN_PROGRESS'] },
        }).populate('shiftId').lean();
        const hasDriverShift = driverAssignments.some((assignment) => (
          ASSIGNABLE_SHIFT_STATUSES.includes(assignment.shiftId?.status)
          && isInsideShift({ start: toMinutes(row.departureTime), end: toMinutes(row.expectedArrivalTime) }, assignment.shiftId)
        ));
        if (!hasDriverShift) {
          throw Object.assign(new Error(`Tài xế của lịch ${row.scheduleCode} không có ca làm phù hợp.`), { statusCode: 409 });
        }
      }
      if (row.assistant?.userId) {
        const assistant = await User.findOne({
          _id: row.assistant.userId,
          role: { $in: ['CONDUCTOR', 'BUS_ASSISTANT'] },
          status: 'ACTIVE',
          isFirstLogin: { $ne: true },
          'accountLock.isLocked': { $ne: true },
        }).lean();
        if (!assistant || hasLeaveConflict(assistant, row.serviceDate)) {
          throw Object.assign(new Error(`Phụ xe của lịch ${row.scheduleCode} không đủ điều kiện phân công.`), { statusCode: 409 });
        }
        const assistantAssignments = await AssistantShiftAssignment.find({
          assistantId: row.assistant.userId,
          workDate: workDateFilter,
          status: { $in: ['ASSIGNED', 'IN_PROGRESS'] },
        }).populate('shiftId').lean();
        const hasAssistantShift = assistantAssignments.some((assignment) => (
          ASSIGNABLE_SHIFT_STATUSES.includes(assignment.shiftId?.status)
          && isInsideShift({ start: toMinutes(row.departureTime), end: toMinutes(row.expectedArrivalTime) }, assignment.shiftId)
        ));
        if (!hasAssistantShift) {
          throw Object.assign(new Error(`Phụ xe của lịch ${row.scheduleCode} không có ca làm phù hợp.`), { statusCode: 409 });
        }
      }
    }
    const dates = normalizedRows.map((row) => row.serviceDate);
    const start = new Date(Math.min(...dates.map((date) => date.getTime())));
    const end = addDays(new Date(Math.max(...dates.map((date) => date.getTime()))), 1);
    const replaceFilter = {
      routeId: { $in: routeIds },
      serviceDate: { $gte: start, $lt: end },
      status: 'PLANNED',
    };
    const ignoredReplacementIds = replaceScheduled
      ? (await TripSchedule.find(replaceFilter).select('_id').lean()).map((schedule) => schedule._id)
      : [];
    const existingCode = await TripSchedule.findOne({
      scheduleCode: { $in: scheduleCodes },
      ...(ignoredReplacementIds.length ? { _id: { $nin: ignoredReplacementIds } } : {}),
    }).select('scheduleCode').lean();
    if (existingCode) {
      throw Object.assign(new Error(`Mã lịch ${existingCode.scheduleCode} đã tồn tại.`), { statusCode: 409 });
    }

    for (const row of normalizedRows) {
      const internalConflict = normalizedRows.find((other) => (
        other !== row
        && dateKey(other.serviceDate) === dateKey(row.serviceDate)
        && overlaps(row.range, other.range)
        && (
          (row.vehicle?.busId && getId(row.vehicle.busId) === getId(other.vehicle?.busId))
          || (row.driver?.userId && getId(row.driver.userId) === getId(other.driver?.userId))
          || (row.assistant?.userId && getId(row.assistant.userId) === getId(other.assistant?.userId))
        )
      ));
      if (internalConflict) {
        throw Object.assign(new Error(`Lịch ${row.scheduleCode} bị trùng xe hoặc nhân sự với ${internalConflict.scheduleCode}.`), { statusCode: 409 });
      }

      const dayEnd = addDays(row.serviceDate, 1);
      const resourceConditions = [
        ...(row.vehicle?.busId ? [{ 'vehicle.busId': row.vehicle.busId }] : []),
        ...(row.driver?.userId ? [{ 'driver.userId': row.driver.userId }] : []),
        ...(row.assistant?.userId ? [{ 'assistant.userId': row.assistant.userId }] : []),
      ];
      if (!resourceConditions.length) continue;
      const conflicts = await TripSchedule.find({
        serviceDate: { $gte: row.serviceDate, $lt: dayEnd },
        status: { $in: ACTIVE_TRIP_STATUSES },
        ...(ignoredReplacementIds.length ? { _id: { $nin: ignoredReplacementIds } } : {}),
        $or: resourceConditions,
      }).lean();
      if (conflicts.some((schedule) => overlaps(row.range, {
        start: toMinutes(schedule.departureTime),
        end: effectiveScheduleEnd(schedule),
      }))) {
        throw Object.assign(new Error(`Lịch ${row.scheduleCode} bị trùng xe hoặc nhân sự.`), { statusCode: 409 });
      }
    }

    const staffWorkloadFields = [
      { field: 'driver', label: 'Tài xế' },
      { field: 'assistant', label: 'Phụ xe' },
    ];
    for (const { field, label } of staffWorkloadFields) {
      const staffIds = [...new Set(normalizedRows.map((row) => getId(row[field]?.userId)).filter(Boolean))];
      const workloadByStaffDate = new Map();
      for (const row of normalizedRows) {
        const userId = getId(row[field]?.userId);
        if (!userId) continue;
        const key = `${userId}:${dateKey(row.serviceDate)}`;
        workloadByStaffDate.set(key, (workloadByStaffDate.get(key) || 0) + getWorkMinutes(row));
      }
      const existingSchedules = staffIds.length
        ? await TripSchedule.find({
          serviceDate: { $gte: start, $lt: end },
          status: { $ne: 'CANCELLED' },
          ...(ignoredReplacementIds.length ? { _id: { $nin: ignoredReplacementIds } } : {}),
          [`${field}.userId`]: { $in: staffIds },
        }).select(`serviceDate departureTime expectedArrivalTime ${field}`).lean()
        : [];
      for (const schedule of existingSchedules) {
        const key = `${getId(schedule[field]?.userId)}:${dateKey(schedule.serviceDate)}`;
        workloadByStaffDate.set(key, (workloadByStaffDate.get(key) || 0) + getWorkMinutes(schedule));
      }
      const overload = [...workloadByStaffDate.values()].find((minutes) => minutes > MAX_DAILY_STAFF_WORK_MINUTES);
      if (overload) {
        throw Object.assign(new Error(`${label} không được phân công quá 8 giờ/ngày.`), { statusCode: 409 });
      }
    }

    const replacedSchedules = replaceScheduled
      ? await TripSchedule.find(replaceFilter).lean()
      : [];
    const created = [];
    try {
      if (replaceScheduled) await TripSchedule.deleteMany(replaceFilter);
      for (const row of normalizedRows) {
        const schedule = await TripSchedule.create({
          scheduleCode: row.scheduleCode,
          operationCycleCode: row.operationCycleCode || '',
          serviceDate: row.serviceDate,
          routeId: row.routeId,
          routeCode: row.routeCode,
          routeName: row.routeName,
          direction: row.direction,
          departureTime: row.departureTime,
          expectedArrivalTime: row.expectedArrivalTime,
          turnaroundEndTime: row.turnaroundEndTime || addMinutesToClock(row.expectedArrivalTime, MIN_RESOURCE_BUFFER_MINUTES),
          shiftLabel: row.shiftLabel || getShiftLabel(toMinutes(row.departureTime)),
          status: row.vehicle?.busId && row.driver?.userId && row.assistant?.userId ? 'ASSIGNED' : 'PLANNED',
          vehicle: row.vehicle || {},
          driver: row.driver || {},
          assistant: row.assistant || {},
          notes: planningOnly
            ? 'Kế hoạch phân chuyến theo nhu cầu ngày; chờ phân xe và nhân sự.'
            : 'Sinh tự động theo tần suất tuyến.',
          createdBy: actorId,
          updatedBy: actorId,
        });
        created.push(schedule);
      }
      return created.map((schedule) => schedule.toObject());
    } catch (error) {
      await TripSchedule.deleteMany({ _id: { $in: created.map((schedule) => schedule._id) } });
      if (replacedSchedules.length) await TripSchedule.insertMany(replacedSchedules, { ordered: false });
      throw error;
    }
  }
}
