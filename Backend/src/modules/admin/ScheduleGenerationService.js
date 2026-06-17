import mongoose from 'mongoose';
import BusRoute from './BusRoute.js';
import FleetBus from './FleetBus.js';
import TripSchedule from './TripSchedule.js';
import User from '../auth/User.js';
import DriverShiftAssignment from '../shifts/DriverShiftAssignment.js';
import AssistantShiftAssignment from '../shifts/AssistantShiftAssignment.js';

const ACTIVE_TRIP_STATUSES = ['PLANNED', 'ASSIGNED', 'IN_PROGRESS'];

const normalizeDate = (value) => {
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
  && overlaps(range, { start: toMinutes(row.departureTime), end: toMinutes(row.expectedArrivalTime) })
));

const chooseResource = (resources, existingSchedules, previewRows, field, range) => resources.find((resource) => {
  const id = resource._id;
  if (hasConflict(id, previewRows, field, range)) return false;
  return !existingSchedules.some((schedule) => (
    getId(schedule[field]?.userId || schedule[field]?.busId) === getId(id)
    && overlaps(range, { start: toMinutes(schedule.departureTime), end: toMinutes(schedule.expectedArrivalTime || schedule.departureTime) })
  ));
});

const weekdayToken = (date) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];

const getOperationalDurationMinutes = (direction) => {
  const configuredDuration = Math.max(0, Number(direction?.estimatedDurationMinutes || 0));
  const distanceKm = Math.max(0, Number(direction?.estimatedDistanceKm || 0));
  const stopCount = Array.isArray(direction?.orderedStops) ? direction.orderedStops.length : 0;
  const urbanBusDuration = distanceKm > 0
    ? Math.ceil((distanceKm / 22) * 60 + Math.max(0, stopCount - 2) * 0.75)
    : 0;
  return Math.min(80, Math.max(60, configuredDuration, urbanBusDuration));
};

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
    const first = toMinutes(body.firstDepartureTime || route.scheduleConfig?.firstDepartureTime);
    const last = toMinutes(body.lastDepartureTime || route.scheduleConfig?.lastDepartureTime);
    const frequency = Number(body.frequencyMinutes || route.scheduleConfig?.frequencyMinutes || route.scheduleConfig?.peakFrequencyMinutes || 0);
    const layover = Math.max(0, Number(body.layoverMinutes ?? 0));
    if (first === null || last === null || first >= last || !Number.isFinite(frequency) || frequency < 1) {
      throw Object.assign(new Error('Giờ hoạt động hoặc tần suất tuyến không hợp lệ.'), { statusCode: 400 });
    }

    const [vehicles, drivers, assistants] = await Promise.all([
      FleetBus.find({ status: { $in: ['ACTIVE', 'RESERVE', 'ASSIGNED'] } }).sort({ busCode: 1 }).lean(),
      User.find({ role: 'DRIVER', status: 'ACTIVE' }).sort({ fullName: 1 }).lean(),
      User.find({ role: { $in: ['CONDUCTOR', 'BUS_ASSISTANT'] }, status: 'ACTIVE' }).sort({ fullName: 1 }).lean(),
    ]);
    const previewRows = [];

    for (let date = new Date(startDate); date <= endDate; date = addDays(date, 1)) {
      if (route.scheduleConfig?.operatingDays?.length && !route.scheduleConfig.operatingDays.includes(weekdayToken(date))) continue;
      const dayStart = new Date(date);
      const dayEnd = addDays(date, 1);
      const existingSchedules = await TripSchedule.find({ serviceDate: { $gte: dayStart, $lt: dayEnd }, status: { $in: ACTIVE_TRIP_STATUSES } }).lean();
      const [driverAssignments, assistantAssignments] = await Promise.all([
        DriverShiftAssignment.find({ workDate: date, status: { $in: ['ASSIGNED', 'IN_PROGRESS'] } }).populate('shiftId').lean(),
        AssistantShiftAssignment.find({ workDate: date, status: { $in: ['ASSIGNED', 'IN_PROGRESS'] } }).populate('shiftId').lean(),
      ]);

      for (const direction of ['OUTBOUND', 'INBOUND']) {
        const routeDirection = direction === 'OUTBOUND' ? route.outboundRoute : route.inboundRoute;
        const duration = getOperationalDurationMinutes(routeDirection);
        for (let departure = first; departure <= last; departure += frequency) {
          const arrival = departure + duration;
          if (arrival > 1439) continue;
          const range = { start: departure, end: arrival + layover };
          const eligibleDrivers = drivers.filter((driver) => driverAssignments.some((assignment) => (
            getId(assignment.driverId) === getId(driver) && assignment.shiftId?.status === 'ACTIVE' && isInsideShift(range, assignment.shiftId)
          )));
          const eligibleAssistants = assistants.filter((assistant) => assistantAssignments.some((assignment) => (
            getId(assignment.assistantId) === getId(assistant) && assignment.shiftId?.status === 'ACTIVE' && isInsideShift(range, assignment.shiftId)
          )));
          const vehicle = body.autoAssign !== false ? chooseResource(vehicles, existingSchedules, previewRows.filter((row) => row.serviceDate === dateKey(date)), 'vehicle', range) : null;
          const driver = body.autoAssign !== false ? chooseResource(eligibleDrivers, existingSchedules, previewRows.filter((row) => row.serviceDate === dateKey(date)), 'driver', range) : null;
          const assistant = body.autoAssign !== false ? chooseResource(eligibleAssistants, existingSchedules, previewRows.filter((row) => row.serviceDate === dateKey(date)), 'assistant', range) : null;
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
            vehicle: publicVehicle(vehicle),
            driver: publicPerson(driver),
            assistant: publicPerson(assistant),
            status: vehicle && driver && assistant ? 'ASSIGNED' : 'PLANNED',
            warnings,
          });
        }
      }
    }
    return { route: { _id: route._id, routeCode: route.routeCode, routeName: route.routeName }, rows: previewRows };
  }

  static async confirm(rows, actorId, replaceScheduled = false) {
    if (!Array.isArray(rows) || !rows.length) throw Object.assign(new Error('Không có lịch để lưu.'), { statusCode: 400 });
    if (replaceScheduled) {
      const routeIds = [...new Set(rows.map((row) => getId(row.routeId)).filter(Boolean))];
      const dates = rows.map((row) => normalizeDate(row.serviceDate)).filter(Boolean);
      const start = new Date(Math.min(...dates.map((date) => date.getTime())));
      const end = addDays(new Date(Math.max(...dates.map((date) => date.getTime()))), 1);
      await TripSchedule.deleteMany({ routeId: { $in: routeIds }, serviceDate: { $gte: start, $lt: end }, status: 'PLANNED' });
    }
    const created = [];
    try {
      for (const row of rows) {
        const duplicate = await TripSchedule.findOne({ scheduleCode: row.scheduleCode }).lean();
        if (duplicate) throw Object.assign(new Error(`Mã lịch ${row.scheduleCode} đã tồn tại.`), { statusCode: 409 });
        const dayStart = normalizeDate(row.serviceDate);
        const dayEnd = addDays(dayStart, 1);
        const range = { start: toMinutes(row.departureTime), end: toMinutes(row.expectedArrivalTime || row.departureTime) };
        const resourceConditions = [
          ...(row.vehicle?.busId ? [{ 'vehicle.busId': row.vehicle.busId }] : []),
          ...(row.driver?.userId ? [{ 'driver.userId': row.driver.userId }] : []),
          ...(row.assistant?.userId ? [{ 'assistant.userId': row.assistant.userId }] : []),
        ];
        if (resourceConditions.length) {
          const conflicts = await TripSchedule.find({
            serviceDate: { $gte: dayStart, $lt: dayEnd },
            status: { $in: ACTIVE_TRIP_STATUSES },
            $or: resourceConditions,
          }).lean();
          if (conflicts.some((schedule) => overlaps(range, { start: toMinutes(schedule.departureTime), end: toMinutes(schedule.expectedArrivalTime || schedule.departureTime) }))) {
            throw Object.assign(new Error(`Lịch ${row.scheduleCode} bị trùng xe hoặc nhân sự.`), { statusCode: 409 });
          }
        }
        const schedule = await TripSchedule.create({
          scheduleCode: row.scheduleCode,
          serviceDate: normalizeDate(row.serviceDate),
          routeId: row.routeId,
          routeCode: row.routeCode,
          routeName: row.routeName,
          direction: row.direction,
          departureTime: row.departureTime,
          expectedArrivalTime: row.expectedArrivalTime,
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
      throw error;
    }
  }
}
