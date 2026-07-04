import mongoose from 'mongoose';
import BusRoute from './BusRoute.js';
import FleetBus from './FleetBus.js';
import TripSchedule from './TripSchedule.js';
import User from '../auth/User.js';
import DriverShiftAssignment from '../shifts/DriverShiftAssignment.js';
import AssistantShiftAssignment from '../shifts/AssistantShiftAssignment.js';

const ACTIVE_TRIP_STATUSES = ['PLANNED', 'ASSIGNED', 'IN_PROGRESS'];
const ASSIGNABLE_BUS_STATUSES = ['ACTIVE', 'RESERVE'];
const ASSIGNABLE_SHIFT_STATUSES = ['ACTIVE', 'APPROVED', 'PUBLISHED'];

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
const getId = (value) => String(value?._id || value || '');
const overlaps = (first, second) => first.start < second.end && second.start < first.end;

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
    end: toMinutes(row.turnaroundEndTime || row.expectedArrivalTime),
  })
));

const chooseResource = (resources, existingSchedules, previewRows, field, range) => resources.find((resource) => {
  const id = resource._id;
  if (hasConflict(id, previewRows, field, range)) return false;
  return !existingSchedules.some((schedule) => (
    getId(schedule[field]?.userId || schedule[field]?.busId) === getId(id)
    && overlaps(range, {
      start: toMinutes(schedule.departureTime),
      end: toMinutes(schedule.turnaroundEndTime || schedule.expectedArrivalTime || schedule.departureTime),
    })
  ));
});

const weekdayToken = (date) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
const AFTERNOON_SHIFT_START = 13 * 60 + 30;
const FIRST_BUS_DEPARTURE_MINUTES = 5 * 60 + 30;
const LAST_BUS_DEPARTURE_MINUTES = 18 * 60 + 30;
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

const getOperationalDurationMinutes = (direction) => {
  const configuredDuration = Math.max(0, Number(direction?.estimatedDurationMinutes || 0));
  const distanceKm = Math.max(0, Number(direction?.estimatedDistanceKm || 0));
  const stopCount = Array.isArray(direction?.orderedStops) ? direction.orderedStops.length : 0;
  const urbanBusDuration = distanceKm > 0
    ? Math.ceil((distanceKm / 22) * 60 + Math.max(0, stopCount - 2) * 0.75)
    : 0;
  return Math.min(80, Math.max(60, configuredDuration, urbanBusDuration));
};

const getMaxConcurrentRows = (rows) => {
  const rowsByDate = new Map();
  rows.forEach((row) => {
    const start = toMinutes(row.departureTime);
    const end = toMinutes(row.turnaroundEndTime || row.expectedArrivalTime);
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

    const route = await BusRoute.findById(routeId).lean();
    if (!route) throw Object.assign(new Error('Không tìm thấy tuyến.'), { statusCode: 404 });
    if (route.status !== 'PUBLISHED') {
      throw Object.assign(new Error('Chỉ có thể sinh lịch cho tuyến đã công bố.'), { statusCode: 409 });
    }
    const first = FIRST_BUS_DEPARTURE_MINUTES;
    const last = LAST_BUS_DEPARTURE_MINUTES;
    const peakFrequency = Number(route.scheduleConfig?.peakFrequencyMinutes || route.scheduleConfig?.frequencyMinutes || 0);
    const offPeakFrequency = Number(route.scheduleConfig?.offPeakFrequencyMinutes || peakFrequency);
    const layover = Math.max(0, Number(route.scheduleConfig?.layoverMinutes || 0));
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
      FleetBus.find({ status: { $in: ASSIGNABLE_BUS_STATUSES } }).sort({ busCode: 1 }).lean(),
      User.find({ role: 'DRIVER', status: 'ACTIVE' }).sort({ fullName: 1 }).lean(),
      User.find({ role: { $in: ['CONDUCTOR', 'BUS_ASSISTANT'] }, status: 'ACTIVE' }).sort({ fullName: 1 }).lean(),
    ]);
    const previewRows = [];
    const availableDriverIds = new Set();
    const availableAssistantIds = new Set();

    for (let date = new Date(startDate); date <= endDate; date = addDays(date, 1)) {
      if (route.scheduleConfig?.operatingDays?.length && !route.scheduleConfig.operatingDays.includes(weekdayToken(date))) continue;
      const dayStart = new Date(date);
      const dayEnd = addDays(date, 1);
      const existingSchedules = await TripSchedule.find({ serviceDate: { $gte: dayStart, $lt: dayEnd }, status: { $in: ACTIVE_TRIP_STATUSES } }).lean();
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

      for (const direction of ['OUTBOUND', 'INBOUND']) {
        const routeDirection = direction === 'OUTBOUND' ? route.outboundRoute : route.inboundRoute;
        const duration = getOperationalDurationMinutes(routeDirection);
        for (let departure = first; departure <= last;) {
          const frequency = isPeakDeparture(departure) ? peakFrequency : offPeakFrequency;
          const arrival = departure + duration;
          if (arrival > 1439 || arrival + layover > 1439) {
            departure += frequency;
            continue;
          }
          const tripRange = { start: departure, end: arrival };
          const resourceRange = { start: departure, end: arrival + layover };
          const eligibleDrivers = drivers.filter((driver) => driverAssignments.some((assignment) => (
            getId(assignment.driverId) === getId(driver) && ASSIGNABLE_SHIFT_STATUSES.includes(assignment.shiftId?.status) && isInsideShift(tripRange, assignment.shiftId)
          )));
          const eligibleAssistants = assistants.filter((assistant) => assistantAssignments.some((assignment) => (
            getId(assignment.assistantId) === getId(assistant) && ASSIGNABLE_SHIFT_STATUSES.includes(assignment.shiftId?.status) && isInsideShift(tripRange, assignment.shiftId)
          )));
          const vehicle = body.autoAssign !== false ? chooseResource(vehicles, existingSchedules, previewRows.filter((row) => row.serviceDate === dateKey(date)), 'vehicle', resourceRange) : null;
          const driver = body.autoAssign !== false ? chooseResource(eligibleDrivers, existingSchedules, previewRows.filter((row) => row.serviceDate === dateKey(date)), 'driver', resourceRange) : null;
          const assistant = body.autoAssign !== false ? chooseResource(eligibleAssistants, existingSchedules, previewRows.filter((row) => row.serviceDate === dateKey(date)), 'assistant', resourceRange) : null;
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
          departure += frequency;
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
      rows: previewRows,
      summary: buildPreviewSummary(previewRows, vehicles, availableDriverIds, availableAssistantIds),
    };
  }

  static async confirm(rows, actorId, replaceScheduled = false) {
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
      const turnaroundEnd = toMinutes(row.turnaroundEndTime || row.expectedArrivalTime);
      if (!serviceDate || !mongoose.Types.ObjectId.isValid(row.routeId)) {
        throw Object.assign(new Error(`Lịch ${row.scheduleCode || ''} có ngày hoặc tuyến không hợp lệ.`), { statusCode: 400 });
      }
      if (departure === null || arrival === null || turnaroundEnd === null || arrival <= departure || turnaroundEnd < arrival) {
        throw Object.assign(new Error(`Lịch ${row.scheduleCode || ''} có khung giờ không hợp lệ.`), { statusCode: 400 });
      }
      return {
        ...row,
        scheduleCode: String(row.scheduleCode).trim().toUpperCase(),
        serviceDate,
        range: { start: departure, end: turnaroundEnd },
      };
    });

    const routeIds = [...new Set(normalizedRows.map((row) => getId(row.routeId)).filter(Boolean))];
    const routes = await BusRoute.find({ _id: { $in: routeIds } }).select('scheduleConfig routeCode').lean();
    const routesById = new Map(routes.map((route) => [getId(route), route]));
    for (const row of normalizedRows) {
      const route = routesById.get(getId(row.routeId));
      if (!route) {
        throw Object.assign(new Error(`Không tìm thấy tuyến của lịch ${row.scheduleCode}.`), { statusCode: 404 });
      }
      const first = FIRST_BUS_DEPARTURE_MINUTES;
      const last = LAST_BUS_DEPARTURE_MINUTES;
      const operatingDays = route.scheduleConfig?.operatingDays || [];
      if (operatingDays.length && !operatingDays.includes(weekdayToken(row.serviceDate))) {
        throw Object.assign(new Error(`Lịch ${row.scheduleCode} không thuộc ngày hoạt động của tuyến.`), { statusCode: 400 });
      }
      if (first === null || last === null || row.range.start < first || row.range.start > last) {
        throw Object.assign(new Error(`Lịch ${row.scheduleCode} nằm ngoài khung giờ cấu hình tuyến.`), { statusCode: 400 });
      }
    }
    const incompleteRow = normalizedRows.find((row) => !row.vehicle?.busId || !row.driver?.userId || !row.assistant?.userId);
    if (incompleteRow) {
      throw Object.assign(new Error(`Lịch ${incompleteRow.scheduleCode} chưa đủ xe, tài xế hoặc phụ xe nên không thể lưu thành lịch chạy.`), { statusCode: 409 });
    }
    for (const row of normalizedRows) {
      const bounds = dateBounds(row.serviceDate);
      const workDateFilter = bounds ? { $gte: bounds.start, $lt: bounds.end } : row.serviceDate;
      if (row.vehicle?.busId) {
        const bus = await FleetBus.findOne({ _id: row.vehicle.busId, status: { $in: ASSIGNABLE_BUS_STATUSES } }).lean();
        if (!bus) {
          throw Object.assign(new Error(`Xe của lịch ${row.scheduleCode} không khả dụng để khai thác.`), { statusCode: 409 });
        }
      }
      if (row.driver?.userId) {
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
        end: toMinutes(schedule.turnaroundEndTime || schedule.expectedArrivalTime || schedule.departureTime),
      }))) {
        throw Object.assign(new Error(`Lịch ${row.scheduleCode} bị trùng xe hoặc nhân sự.`), { statusCode: 409 });
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
          serviceDate: row.serviceDate,
          routeId: row.routeId,
          routeCode: row.routeCode,
          routeName: row.routeName,
          direction: row.direction,
          departureTime: row.departureTime,
          expectedArrivalTime: row.expectedArrivalTime,
          turnaroundEndTime: row.turnaroundEndTime || row.expectedArrivalTime,
          shiftLabel: row.shiftLabel || getShiftLabel(toMinutes(row.departureTime)),
          status: row.vehicle?.busId && row.driver?.userId && row.assistant?.userId ? 'ASSIGNED' : 'PLANNED',
          vehicle: row.vehicle || {},
          driver: row.driver || {},
          assistant: row.assistant || {},
          notes: 'Sinh tự động theo tần suất tuyến.',
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
