import mongoose from 'mongoose';
import User from '../auth/User.js';
import BusRoute from '../admin/BusRoute.js';
import FleetBus from '../admin/FleetBus.js';
import TripSchedule from '../admin/TripSchedule.js';
import Shift from './Shift.js';
import DriverShiftAssignment from './DriverShiftAssignment.js';
import AssistantShiftAssignment from './AssistantShiftAssignment.js';
import VehicleShiftAssignment from './VehicleShiftAssignment.js';
import TripShiftAssignment from './TripShiftAssignment.js';

const MAX_WORK_MINUTES = 8 * 60;
const ACTIVE_ASSIGNMENT_STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];
const SHIFT_TYPES = new Set(['MORNING', 'AFTERNOON', 'EVENING', 'FULL_DAY', 'CUSTOM']);

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
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const vehicleTypeGroup = (value) => {
  const normalized = normalizeVehicleType(value);
  if (!normalized) return '';
  if (normalized.includes('standard city bus') || normalized.includes('xe buyt tieu chuan do thi')) return 'STANDARD_CITY_BUS';
  if (normalized.includes('mini') || normalized.includes('minibus')) return 'MINIBUS';
  if (normalized.includes('electric') || normalized.includes('dien')) return 'ELECTRIC_BUS';
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
  if (!['ACTIVE', 'RESERVE', 'ASSIGNED'].includes(vehicle.status)) return false;
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

const publicDriver = (driver) => ({
  _id: driver._id,
  fullName: driver.fullName,
  email: driver.email,
  phoneNumber: driver.phoneNumber,
  driverLicense: driver.driverLicense,
});

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
  if (!mongoose.Types.ObjectId.isValid(body.routeId)) errors.push('Tuyến xe là bắt buộc.');
  if (!startDate || !endDate) errors.push('Ngày hoặc khoảng ngày là bắt buộc.');
  if (startDate && endDate && startDate > endDate) errors.push('Ngày bắt đầu phải trước ngày kết thúc.');
  if (!range) errors.push('Giờ bắt đầu phải nhỏ hơn giờ kết thúc.');
  if (startDate && endDate && ((endDate - startDate) / 86400000) > 31) errors.push('Chỉ được sinh tối đa 31 ngày mỗi lần.');
  return { errors, startDate, endDate, range };
};

const buildStatus = ({ warnings, driverId, assistantId, vehicleId, tripIds }) => {
  if (warnings.some((warning) => warning.level === 'ERROR')) return 'CONFLICT';
  if (!driverId || !assistantId || !vehicleId || !tripIds.length) return 'NEED_MANUAL_ASSIGNMENT';
  return 'VALID';
};

const shiftNameFor = (shiftType) => ({
  MORNING: 'Ca sáng',
  AFTERNOON: 'Ca chiều',
  EVENING: 'Ca tối',
  FULL_DAY: 'Ca cả ngày',
  CUSTOM: 'Ca tùy chỉnh',
}[shiftType] || 'Ca tùy chỉnh');

export default class AutoGenerateShiftService {
  static async listAvailableResources({ kind, workDate, startTime, endTime, routeId }) {
    const date = normalizeDate(workDate);
    const range = rangeOf({ startTime, endTime });
    if (!date || !range) throw Object.assign(new Error('Ngày và khung giờ hợp lệ là bắt buộc.'), { statusCode: 400 });
    const route = mongoose.Types.ObjectId.isValid(routeId) ? await BusRoute.findById(routeId).lean() : null;
    const assignments = await loadAssignmentsForDate(date);
    const duration = range.end - range.start;

    if (kind === 'drivers') {
      const rows = await User.find({ role: 'DRIVER', status: 'ACTIVE' }).sort({ fullName: 1 }).lean();
      return rows.filter((row) => (
        !isOnLeave(row, date)
        && hasSuitableLicense(row, route?.vehicleAssignment?.busType, date)
        && !assignmentConflicts(assignments.drivers, 'driverId', row._id, range)
        && assignedMinutes(assignments.drivers, 'driverId', row._id) + duration <= MAX_WORK_MINUTES
      )).map(publicDriver);
    }
    if (kind === 'assistants') {
      const rows = await User.find({ role: { $in: ['CONDUCTOR', 'BUS_ASSISTANT'] }, status: 'ACTIVE' }).sort({ fullName: 1 }).lean();
      return rows.filter((row) => (
        !isOnLeave(row, date)
        && !assignmentConflicts(assignments.assistants, 'assistantId', row._id, range)
        && assignedMinutes(assignments.assistants, 'assistantId', row._id) + duration <= MAX_WORK_MINUTES
      )).map(publicAssistant);
    }
    const rows = await FleetBus.find({ status: { $in: ['ACTIVE', 'RESERVE', 'ASSIGNED'] } }).sort({ busCode: 1 }).lean();
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
      const windows = [];
      for (let cursor = range.start; cursor < range.end; cursor += MAX_WORK_MINUTES) {
        const end = Math.min(cursor + MAX_WORK_MINUTES, range.end);
        const clock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
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
      const rows = previews.flatMap((preview) => preview.rows).sort((left, right) => (
        left.workDate.localeCompare(right.workDate) || left.startTime.localeCompare(right.startTime)
      ));
      const totals = new Map();
      rows.forEach((row, index) => {
        row.previewId = `${dateToken(row.workDate)}-${index + 1}`;
        row.shiftCode = `AUTO-${row.route.routeCode}-${dateToken(row.workDate)}-${String(index + 1).padStart(2, '0')}`;
        [['driver', 'driverId', 'availableDrivers'], ['assistant', 'assistantId', 'availableAssistants']].forEach(([kind, idField, optionsField]) => {
          if (!row[idField]) return;
          const duration = rangeOf(row).end - rangeOf(row).start;
          const candidate = (row[optionsField] || []).find((option) => {
            const key = `${kind}:${row.workDate}:${getId(option)}`;
            return (totals.get(key) || 0) + duration <= MAX_WORK_MINUTES;
          });
          row[idField] = candidate?._id || '';
          row[kind] = candidate || null;
          if (candidate) {
            const key = `${kind}:${row.workDate}:${getId(candidate)}`;
            totals.set(key, (totals.get(key) || 0) + duration);
          }
          row.status = buildStatus(row);
        });
      });
      const requestedTrips = Math.max(0, Number(body.numberOfTrips || 0));
      if (requestedTrips && !(body.tripIds || []).length) {
        let remaining = requestedTrips;
        rows.forEach((row) => {
          const selected = row.trips.slice(0, remaining);
          row.trips = selected;
          row.tripIds = selected.map((trip) => trip._id);
          remaining -= selected.length;
          row.status = buildStatus(row);
        });
      }
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
    const route = await BusRoute.findById(body.routeId).lean();
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
      if (!selectedTripIds.length && numberOfTrips > 0) trips = trips.slice(0, numberOfTrips);
      if (!trips.length) warnings.push({ level: 'WARNING', message: 'Chưa có chuyến phù hợp trong khung giờ.' });

      const [drivers, assistants, vehicles] = await Promise.all([
        this.listAvailableResources({ kind: 'drivers', workDate: date, startTime: body.startTime, endTime: body.endTime, routeId: route._id }),
        this.listAvailableResources({ kind: 'assistants', workDate: date, startTime: body.startTime, endTime: body.endTime, routeId: route._id }),
        this.listAvailableResources({ kind: 'vehicles', workDate: date, startTime: body.startTime, endTime: body.endTime, routeId: route._id }),
      ]);

      const driver = modes.driver === 'AUTO' ? drivers[0] : null;
      const assistant = modes.assistant === 'AUTO' ? assistants[0] : null;
      const vehicle = modes.vehicle === 'AUTO' ? vehicles[0] : null;
      if (modes.driver === 'AUTO' && !driver) warnings.push({ level: 'WARNING', message: 'Không tìm được tài xế phù hợp.' });
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
          departureTime: trip.departureTime,
          expectedArrivalTime: trip.expectedArrivalTime,
        })),
        availableTrips: availableTrips.map((trip) => ({
          _id: trip._id,
          scheduleCode: trip.scheduleCode,
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

    return {
      previewToken: new mongoose.Types.ObjectId().toString(),
      generatedAt: new Date(),
      route: { _id: route._id, routeCode: route.routeCode, routeName: route.routeName },
      rows,
      summary: {
        total: rows.length,
        valid: rows.filter((row) => row.status === 'VALID').length,
        needManualAssignment: rows.filter((row) => row.status === 'NEED_MANUAL_ASSIGNMENT').length,
        conflicts: rows.filter((row) => row.status === 'CONFLICT').length,
      },
    };
  }

  static async validateConfirmRow(row) {
    const warnings = [];
    const workDate = normalizeDate(row.workDate);
    const range = rangeOf(row);
    if (!workDate || !range) warnings.push('Ngày hoặc khung giờ không hợp lệ.');
    if (!mongoose.Types.ObjectId.isValid(row.routeId)) warnings.push('Tuyến không hợp lệ.');
    const [route, driver, assistant, vehicle] = await Promise.all([
      mongoose.Types.ObjectId.isValid(row.routeId) ? BusRoute.findById(row.routeId).lean() : null,
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
      if (driver && assignmentConflicts(assignments.drivers, 'driverId', driver._id, range)) warnings.push('Tài xế bị trùng ca.');
      if (assistant && assignmentConflicts(assignments.assistants, 'assistantId', assistant._id, range)) warnings.push('Phụ xe bị trùng ca.');
      if (vehicle && assignmentConflicts(assignments.vehicles, 'vehicleId', vehicle._id, range)) warnings.push('Xe bị trùng lịch.');
      if (driver && assignedMinutes(assignments.drivers, 'driverId', driver._id) + range.end - range.start > MAX_WORK_MINUTES) warnings.push('Tài xế vượt quá 8 giờ làm trong ngày.');
      if (assistant && assignedMinutes(assignments.assistants, 'assistantId', assistant._id) + range.end - range.start > MAX_WORK_MINUTES) warnings.push('Phụ xe vượt quá 8 giờ làm trong ngày.');
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
    return { warnings, workDate, route, driver, assistant, vehicle, trips };
  }

  static async confirmGenerated({ rows, actorId }) {
    if (!Array.isArray(rows) || !rows.length) throw Object.assign(new Error('Danh sách ca xác nhận là bắt buộc.'), { statusCode: 400 });
    const previewConflicts = [];
    const workTotals = new Map();
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
      });
      rows.slice(0, index).forEach((other, otherIndex) => {
        if (dateKey(other.workDate) !== dateKey(row.workDate)) return;
        const otherRange = rangeOf(other);
        if (!otherRange || !overlaps(range, otherRange)) return;
        if (row.driverId && getId(row.driverId) === getId(other.driverId)) previewConflicts.push({ index, shiftCode: code, message: `Tài xế trùng giờ với dòng ${otherIndex + 1}.` });
        if (row.assistantId && getId(row.assistantId) === getId(other.assistantId)) previewConflicts.push({ index, shiftCode: code, message: `Phụ xe trùng giờ với dòng ${otherIndex + 1}.` });
        if (row.vehicleId && getId(row.vehicleId) === getId(other.vehicleId)) previewConflicts.push({ index, shiftCode: code, message: `Xe trùng giờ với dòng ${otherIndex + 1}.` });
      });
    });
    if (previewConflicts.length) throw Object.assign(new Error('Danh sách xem trước còn xung đột nội bộ.'), { statusCode: 409, conflicts: previewConflicts });
    const validationResults = [];
    for (const row of rows) validationResults.push(await this.validateConfirmRow(row));
    const conflicts = validationResults.flatMap((result, index) => result.warnings.map((message) => ({ index, shiftCode: rows[index].shiftCode, message })));
    if (conflicts.length) throw Object.assign(new Error('Không thể lưu khi danh sách còn xung đột hoặc thiếu phân công.'), { statusCode: 409, conflicts });

    const created = { shifts: [], assignments: { drivers: 0, assistants: 0, vehicles: 0, trips: 0 } };
    const rollback = { shiftIds: [], driverIds: [], assistantIds: [], vehicleIds: [], tripIds: [] };
    try {
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const result = validationResults[index];
        const shift = await Shift.create({
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
        });
        rollback.shiftIds.push(shift._id);
        created.shifts.push(shift.toObject());
        const base = { shiftId: shift._id, workDate: result.workDate, status: 'ASSIGNED', createdBy: actorId, updatedBy: actorId };
        const driverAssignment = await DriverShiftAssignment.create({ ...base, driverId: result.driver._id });
        rollback.driverIds.push(driverAssignment._id);
        const assistantAssignment = await AssistantShiftAssignment.create({ ...base, assistantId: result.assistant._id });
        rollback.assistantIds.push(assistantAssignment._id);
        const vehicleAssignment = await VehicleShiftAssignment.create({ ...base, vehicleId: result.vehicle._id });
        rollback.vehicleIds.push(vehicleAssignment._id);
        created.assignments.drivers += 1;
        created.assignments.assistants += 1;
        created.assignments.vehicles += 1;
        for (const trip of result.trips) {
          const tripAssignment = await TripShiftAssignment.create({
            ...base,
            tripId: trip._id,
            driverId: result.driver._id,
            vehicleId: result.vehicle._id,
          });
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
          });
        }
      }
      return created;
    } catch (error) {
      await Promise.all([
        TripShiftAssignment.deleteMany({ _id: { $in: rollback.tripIds } }),
        VehicleShiftAssignment.deleteMany({ _id: { $in: rollback.vehicleIds } }),
        AssistantShiftAssignment.deleteMany({ _id: { $in: rollback.assistantIds } }),
        DriverShiftAssignment.deleteMany({ _id: { $in: rollback.driverIds } }),
        Shift.deleteMany({ _id: { $in: rollback.shiftIds } }),
      ]);
      throw error;
    }
  }
}
