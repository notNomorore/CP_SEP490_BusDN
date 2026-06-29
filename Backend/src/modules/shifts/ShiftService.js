import mongoose from 'mongoose';
import User from '../auth/User.js';
import FleetBus from '../admin/FleetBus.js';
import TripSchedule from '../admin/TripSchedule.js';
import Shift from './Shift.js';
import DriverShiftAssignment from './DriverShiftAssignment.js';
import AssistantShiftAssignment from './AssistantShiftAssignment.js';
import VehicleShiftAssignment from './VehicleShiftAssignment.js';
import TripShiftAssignment from './TripShiftAssignment.js';

const SHIFT_STATUSES = new Set(['ACTIVE', 'INACTIVE', 'ARCHIVED']);
const SHIFT_TYPES = new Set(['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT', 'FULL_DAY', 'CUSTOM']);
const ASSIGNMENT_STATUSES = new Set(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
const BLOCKING_ASSIGNMENT_STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];
const ACTIVE_TRIP_ASSIGNMENT_STATUSES = ['ASSIGNED', 'IN_PROGRESS'];
const MAX_DRIVER_MINUTES_PER_DAY = 8 * 60;
const AUTO_SHIFT_TEMPLATES = [
  { key: 'MORNING', name: 'Ca sáng tự động', startTime: '05:30', endTime: '13:30', shiftType: 'MORNING' },
  { key: 'AFTERNOON', name: 'Ca chiều tự động', startTime: '13:30', endTime: '18:30', shiftType: 'AFTERNOON' },
];

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeDateOnly = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const toDateToken = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const toMinutes = (value) => {
  if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (hours > 23 || minutes > 59) return null;
  return (hours * 60) + minutes;
};

const getShiftRange = (shift) => {
  const start = toMinutes(shift?.startTime);
  const end = toMinutes(shift?.endTime);
  if (start === null || end === null) return null;
  return { start, end: end <= start ? end + 1440 : end };
};

const rangesOverlap = (first, second) => first.start < second.end && second.start < first.end;

const timesOverlap = (firstShift, secondShift) => {
  const first = getShiftRange(firstShift);
  const second = getShiftRange(secondShift);
  return Boolean(first && second && rangesOverlap(first, second));
};

const isTimeInsideShift = (time, shift) => {
  const value = toMinutes(time);
  const range = getShiftRange(shift);
  if (value === null || !range) return false;
  const normalizedValue = value < range.start ? value + 1440 : value;
  return normalizedValue >= range.start && normalizedValue <= range.end;
};

const normalizeShiftPayload = (body = {}, actorId) => {
  const startTime = String(body.startTime || '').trim();
  const endTime = String(body.endTime || '').trim();
  const generatedCode = `SHIFT-${startTime.replace(':', '') || '0000'}-${endTime.replace(':', '') || '0000'}-${Date.now().toString(36)}`;

  return {
    shiftCode: String(body.shiftCode || body.code || generatedCode).trim().toUpperCase(),
    shiftName: String(body.shiftName || body.name || '').trim(),
    routeId: isValidObjectId(body.routeId) ? body.routeId : undefined,
    workDate: normalizeDateOnly(body.workDate || body.date),
    startTime,
    endTime,
    breakMinutes: Number(body.breakMinutes || 0),
    shiftType: SHIFT_TYPES.has(String(body.shiftType || '').toUpperCase()) ? String(body.shiftType).toUpperCase() : 'CUSTOM',
    status: SHIFT_STATUSES.has(String(body.status || '').toUpperCase()) ? String(body.status).toUpperCase() : 'ACTIVE',
    description: String(body.description || '').trim(),
    updatedBy: actorId,
  };
};

const validateShiftPayload = (payload) => {
  const errors = [];
  const startMinutes = toMinutes(payload.startTime);
  const endMinutes = toMinutes(payload.endTime);

  if (!payload.shiftCode) errors.push('Ma ca la bat buoc.');
  if (!payload.workDate) errors.push('Ngay lam viec la bat buoc.');
  if (!payload.shiftName) errors.push('Tên ca là bắt buộc.');
  if (startMinutes === null) errors.push('Giờ bắt đầu là bắt buộc.');
  if (endMinutes === null) errors.push('Giờ kết thúc là bắt buộc.');
  if (!Number.isFinite(payload.breakMinutes) || payload.breakMinutes < 0) {
    errors.push('Số phút nghỉ không được âm.');
  }

  return errors;
};

const ensureShift = async (shiftId) => {
  if (!isValidObjectId(shiftId)) return null;
  return Shift.findById(shiftId).lean();
};

const ensureActiveShift = async (shiftId) => {
  const shift = await ensureShift(shiftId);
  if (!shift || shift.status !== 'ACTIVE') {
    throw Object.assign(new Error('Khong tim thay ca lam viec.'), { statusCode: 404 });
  }
  return shift;
};

const findOverlappingAssignment = async ({ model, resourceField, resourceId, workDate, shift }) => {
  const assignments = await model.find({
    [resourceField]: resourceId,
    workDate,
    status: { $in: BLOCKING_ASSIGNMENT_STATUSES },
  }).lean();

  if (!assignments.length) return null;
  const shiftIds = assignments.map((assignment) => assignment.shiftId);
  const shifts = await Shift.find({ _id: { $in: shiftIds }, status: { $ne: 'ARCHIVED' } }).lean();
  const shiftById = new Map(shifts.map((item) => [String(item._id), item]));

  return assignments.find((assignment) => {
    const assignedShift = shiftById.get(String(assignment.shiftId));
    return assignedShift && timesOverlap(shift, assignedShift);
  }) || null;
};

const getAssignedDriver = async (shiftId) => {
  const assignments = await DriverShiftAssignment.find({
    shiftId,
    status: { $in: ['ASSIGNED', 'IN_PROGRESS'] },
  }).populate('driverId', 'fullName email phone role status').sort({ createdAt: 1 });
  for (const assignment of assignments) {
    if (assignment.driverId?.status === 'ACTIVE') return assignment.toObject();
    await DriverShiftAssignment.deleteOne({ _id: assignment._id });
  }
  return null;
};

const getAssignedAssistant = async (shiftId) => {
  const assignments = await AssistantShiftAssignment.find({
    shiftId,
    status: { $in: ['ASSIGNED', 'IN_PROGRESS'] },
  }).populate('assistantId', 'fullName email phone role status').sort({ createdAt: 1 });
  for (const assignment of assignments) {
    if (assignment.assistantId?.status === 'ACTIVE') return assignment.toObject();
    await AssistantShiftAssignment.deleteOne({ _id: assignment._id });
  }
  return null;
};

const getAssignedVehicle = async (shiftId) => VehicleShiftAssignment.findOne({
  shiftId,
  status: { $in: ['ASSIGNED', 'IN_PROGRESS'] },
}).populate('vehicleId', 'busCode plateNumber busType status capacity').lean();

const getShiftDurationMinutes = (shift) => {
  const range = getShiftRange(shift);
  return range ? Math.max(0, range.end - range.start) : 0;
};

const getTotalAssignedMinutesForDriver = async ({ driverId, workDate, excludeShiftId }) => {
  const assignments = await DriverShiftAssignment.find({
    driverId,
    workDate,
    status: { $in: BLOCKING_ASSIGNMENT_STATUSES },
    ...(excludeShiftId ? { shiftId: { $ne: excludeShiftId } } : {}),
  }).lean();
  if (!assignments.length) return 0;
  const shiftIds = assignments.map((assignment) => assignment.shiftId);
  const shifts = await Shift.find({ _id: { $in: shiftIds }, status: { $ne: 'ARCHIVED' } }).lean();
  return shifts.reduce((total, shift) => total + getShiftDurationMinutes(shift), 0);
};

const getTotalAssignedMinutesForAssistant = async ({ assistantId, workDate, excludeShiftId }) => {
  const assignments = await AssistantShiftAssignment.find({
    assistantId,
    workDate,
    status: { $in: BLOCKING_ASSIGNMENT_STATUSES },
    ...(excludeShiftId ? { shiftId: { $ne: excludeShiftId } } : {}),
  }).lean();
  if (!assignments.length) return 0;
  const shiftIds = assignments.map((assignment) => assignment.shiftId);
  const shifts = await Shift.find({ _id: { $in: shiftIds }, status: { $ne: 'ARCHIVED' } }).lean();
  return shifts.reduce((total, assignedShift) => total + getShiftDurationMinutes(assignedShift), 0);
};

const hasLeaveConflict = (driver, workDate) => {
  const leaveRanges = [
    ...(Array.isArray(driver.staffAvailability?.leaveRequests) ? driver.staffAvailability.leaveRequests : []),
    ...(Array.isArray(driver.leaveRequests) ? driver.leaveRequests : []),
    ...(Array.isArray(driver.leaves) ? driver.leaves : []),
  ];

  return leaveRanges.some((leave) => {
    const status = String(leave.status || '').toUpperCase();
    if (status && !['APPROVED', 'ACTIVE'].includes(status)) return false;
    const start = normalizeDateOnly(leave.startDate || leave.fromDate || leave.date);
    const end = normalizeDateOnly(leave.endDate || leave.toDate || leave.date);
    return start && end && workDate >= start && workDate <= end;
  });
};

const buildAutoShiftPayload = ({ template, workDate, actorId }) => ({
  shiftCode: `AUTO-${toDateToken(workDate)}-${template.key}`,
  shiftName: template.name,
  workDate,
  startTime: template.startTime,
  endTime: template.endTime,
  breakMinutes: 0,
  shiftType: template.shiftType,
  status: 'ACTIVE',
  description: 'Ca được sinh tự động. Mỗi tài xế tối đa 8 giờ/ngày.',
  createdBy: actorId,
  updatedBy: actorId,
});

const shouldUpdateAutoShift = (shift, payload) => (
  shift
  && (
    shift.shiftName !== payload.shiftName
    || shift.startTime !== payload.startTime
    || shift.endTime !== payload.endTime
    || shift.shiftType !== payload.shiftType
    || shift.description !== payload.description
  )
);

const isRemovedAutoShiftTemplate = (shift) => {
  if (!String(shift?.shiftCode || '').startsWith('AUTO-')) return false;
  const workDate = normalizeDateOnly(shift.workDate);
  if (!workDate) return false;
  return !AUTO_SHIFT_TEMPLATES.some((template) => (
    shift.shiftCode === `AUTO-${toDateToken(workDate)}-${template.key}`
  ));
};

export default class ShiftService {
  static normalizeShiftPayload = normalizeShiftPayload;

  static validateShiftPayload = validateShiftPayload;

  static async listShifts(query = {}) {
    const filters = {};
    const workDate = normalizeDateOnly(query.date || query.workDate);
    if (workDate) filters.workDate = workDate;
    if (query.status && query.status !== 'ALL') {
      filters.status = query.status;
    } else {
      filters.status = { $ne: 'ARCHIVED' };
    }
    if (query.search?.trim()) {
      const searchRegex = new RegExp(String(query.search).trim().replace(/[|\\{}()[\]^$+*?.]/g, '\\$&'), 'i');
      filters.$or = [{ shiftCode: searchRegex }, { shiftName: searchRegex }, { shiftType: searchRegex }];
    }
    return Shift.find(filters).sort({ workDate: 1, startTime: 1, shiftName: 1 }).lean();
  }

  static async createShift(payload) {
    const shift = new Shift(payload);
    await shift.save();
    return shift.toObject();
  }

  static async updateShift(shiftId, payload) {
    if (!isValidObjectId(shiftId)) return null;
    return Shift.findByIdAndUpdate(shiftId, { $set: payload }, { new: true, runValidators: true }).lean();
  }

  static async deactivateShift(shiftId, actorId) {
    if (!isValidObjectId(shiftId)) return null;
    return Shift.findByIdAndUpdate(
      shiftId,
      { $set: { status: 'ARCHIVED', updatedBy: actorId } },
      { new: true, runValidators: true }
    ).lean();
  }

  static async listAssignments(query = {}) {
    const workDate = normalizeDateOnly(query.workDate);
    const baseFilter = {};
    if (workDate) baseFilter.workDate = workDate;
    if (query.shiftId && isValidObjectId(query.shiftId)) baseFilter.shiftId = query.shiftId;

    const [driverAssignments, assistantAssignments, vehicleAssignments, tripAssignments] = await Promise.all([
      DriverShiftAssignment.find(baseFilter).populate('driverId', 'fullName email phone role status').populate('shiftId').lean(),
      AssistantShiftAssignment.find(baseFilter).populate('assistantId', 'fullName email phone role status').populate('shiftId').lean(),
      VehicleShiftAssignment.find(baseFilter).populate('vehicleId', 'busCode plateNumber busType status capacity').populate('shiftId').lean(),
      TripShiftAssignment.find(baseFilter)
        .populate('tripId', 'scheduleCode routeCode routeName serviceDate departureTime expectedArrivalTime status')
        .populate('driverId', 'fullName email phone role status')
        .populate('vehicleId', 'busCode plateNumber busType status capacity')
        .populate('shiftId')
        .lean(),
    ]);

    return { driverAssignments, assistantAssignments, vehicleAssignments, tripAssignments };
  }

  static async assignDriver({ driverId, shiftId, workDate, status, actorId }) {
    const dateOnly = normalizeDateOnly(workDate);
    if (!isValidObjectId(driverId)) throw Object.assign(new Error('Không tìm thấy tài xế.'), { statusCode: 404 });
    if (!dateOnly) throw Object.assign(new Error('Ngày làm việc là bắt buộc.'), { statusCode: 400 });

    const [driver, shift] = await Promise.all([
      User.findOne({ _id: driverId, role: 'DRIVER' }).lean(),
      ensureShift(shiftId),
    ]);
    if (!driver) throw Object.assign(new Error('Không tìm thấy tài xế.'), { statusCode: 404 });
    if (!shift || shift.status !== 'ACTIVE') throw Object.assign(new Error('Không tìm thấy ca làm việc.'), { statusCode: 404 });
    if (hasLeaveConflict(driver, dateOnly)) {
      throw Object.assign(new Error('Tài xế đang nghỉ phép.'), { statusCode: 409 });
    }

    const conflict = await findOverlappingAssignment({
      model: DriverShiftAssignment,
      resourceField: 'driverId',
      resourceId: driverId,
      workDate: dateOnly,
      shift,
    });
    if (conflict) {
      throw Object.assign(new Error('Tài xế đã có ca khác trong khoảng thời gian này.'), { statusCode: 409 });
    }

    const assignedMinutes = await getTotalAssignedMinutesForDriver({ driverId, workDate: dateOnly, excludeShiftId: shiftId });
    if (assignedMinutes + getShiftDurationMinutes(shift) > MAX_DRIVER_MINUTES_PER_DAY) {
      throw Object.assign(new Error('Tai xe vuot qua so gio lam toi da trong ngay.'), { statusCode: 409 });
    }

    const assignment = new DriverShiftAssignment({
      driverId,
      shiftId,
      workDate: dateOnly,
      status: ASSIGNMENT_STATUSES.has(status) ? status : 'ASSIGNED',
      createdBy: actorId,
      updatedBy: actorId,
    });
    await assignment.save();
    return assignment.populate([{ path: 'driverId', select: 'fullName email phone role status' }, { path: 'shiftId' }]);
  }

  static async assignVehicle({ vehicleId, shiftId, workDate, status, actorId }) {
    const dateOnly = normalizeDateOnly(workDate);
    if (!isValidObjectId(vehicleId)) throw Object.assign(new Error('Không tìm thấy xe.'), { statusCode: 404 });
    if (!dateOnly) throw Object.assign(new Error('Ngày làm việc là bắt buộc.'), { statusCode: 400 });

    const [vehicle, shift] = await Promise.all([
      FleetBus.findById(vehicleId).lean(),
      ensureShift(shiftId),
    ]);
    if (!vehicle) throw Object.assign(new Error('Không tìm thấy xe.'), { statusCode: 404 });
    if (vehicle.status === 'MAINTENANCE') throw Object.assign(new Error('Xe đang bảo trì.'), { statusCode: 409 });
    if (vehicle.status === 'INACTIVE') throw Object.assign(new Error('Xe không hoạt động.'), { statusCode: 409 });
    if (!shift || shift.status !== 'ACTIVE') throw Object.assign(new Error('Không tìm thấy ca làm việc.'), { statusCode: 404 });

    const conflict = await findOverlappingAssignment({
      model: VehicleShiftAssignment,
      resourceField: 'vehicleId',
      resourceId: vehicleId,
      workDate: dateOnly,
      shift,
    });
    if (conflict) {
      throw Object.assign(new Error('Xe đã được phân công trong khoảng thời gian này.'), { statusCode: 409 });
    }

    const assignment = new VehicleShiftAssignment({
      vehicleId,
      shiftId,
      workDate: dateOnly,
      status: ASSIGNMENT_STATUSES.has(status) ? status : 'ASSIGNED',
      createdBy: actorId,
      updatedBy: actorId,
    });
    await assignment.save();
    return assignment.populate([{ path: 'vehicleId', select: 'busCode plateNumber busType status capacity' }, { path: 'shiftId' }]);
  }

  static async assignTrip({ tripId, shiftId, driverId, vehicleId, workDate, status, actorId }) {
    const dateOnly = normalizeDateOnly(workDate);
    if (!isValidObjectId(tripId)) throw Object.assign(new Error('Không tìm thấy chuyến.'), { statusCode: 404 });
    if (!dateOnly) throw Object.assign(new Error('Ngày làm việc là bắt buộc.'), { statusCode: 400 });

    const [trip, shift, driver, vehicle] = await Promise.all([
      TripSchedule.findById(tripId).lean(),
      ensureShift(shiftId),
      driverId && isValidObjectId(driverId) ? User.findOne({ _id: driverId, role: 'DRIVER' }).lean() : null,
      vehicleId && isValidObjectId(vehicleId) ? FleetBus.findById(vehicleId).lean() : null,
    ]);

    if (!trip) throw Object.assign(new Error('Không tìm thấy chuyến.'), { statusCode: 404 });
    if (!shift || shift.status !== 'ACTIVE') throw Object.assign(new Error('Không tìm thấy ca làm việc.'), { statusCode: 404 });
    if (driverId && !driver) throw Object.assign(new Error('Không tìm thấy tài xế.'), { statusCode: 404 });
    if (vehicleId && !vehicle) throw Object.assign(new Error('Không tìm thấy xe.'), { statusCode: 404 });
    if (vehicle?.status === 'MAINTENANCE') throw Object.assign(new Error('Xe đang bảo trì.'), { statusCode: 409 });
    if (vehicle?.status === 'INACTIVE') throw Object.assign(new Error('Xe không hoạt động.'), { statusCode: 409 });

    const tripDate = normalizeDateOnly(trip.serviceDate);
    if (tripDate && tripDate.getTime() !== dateOnly.getTime()) {
      throw Object.assign(new Error('Thời gian chuyến nằm ngoài ca đã chọn.'), { statusCode: 400 });
    }

    if (!isTimeInsideShift(trip.departureTime, shift) || !isTimeInsideShift(trip.expectedArrivalTime, shift)) {
      throw Object.assign(new Error('Thời gian chuyến nằm ngoài ca đã chọn.'), { statusCode: 400 });
    }

    const existingTripAssignment = await TripShiftAssignment.findOne({
      tripId,
      status: { $in: ACTIVE_TRIP_ASSIGNMENT_STATUSES },
    }).lean();
    if (existingTripAssignment) {
      throw Object.assign(new Error('Chuyến đã được phân công.'), { statusCode: 409 });
    }

    const assignment = new TripShiftAssignment({
      tripId,
      shiftId,
      driverId: driverId || trip.driver?.userId || undefined,
      vehicleId: vehicleId || trip.vehicle?.busId || undefined,
      workDate: dateOnly,
      status: ASSIGNMENT_STATUSES.has(status) ? status : 'ASSIGNED',
      createdBy: actorId,
      updatedBy: actorId,
    });
    await assignment.save();

    return assignment.populate([
      { path: 'tripId', select: 'scheduleCode routeCode routeName serviceDate departureTime expectedArrivalTime status' },
      { path: 'driverId', select: 'fullName email phone role status' },
      { path: 'vehicleId', select: 'busCode plateNumber busType status capacity' },
      { path: 'shiftId' },
    ]);
  }

  static async assignDriverToShift(shiftId, { driverId, actorId }) {
    const shift = await ensureActiveShift(shiftId);
    const workDate = normalizeDateOnly(shift.workDate);
    if (!workDate) throw Object.assign(new Error('Ngay lam viec cua ca khong hop le.'), { statusCode: 400 });
    if (!isValidObjectId(driverId)) throw Object.assign(new Error('Khong tim thay tai xe.'), { statusCode: 404 });

    const driver = await User.findOne({ _id: driverId, role: 'DRIVER' }).lean();
    if (!driver) throw Object.assign(new Error('Khong tim thay tai xe.'), { statusCode: 404 });
    if (driver.status !== 'ACTIVE') throw Object.assign(new Error('Tai xe khong hoat dong.'), { statusCode: 409 });
    if (hasLeaveConflict(driver, workDate)) throw Object.assign(new Error('Tai xe dang nghi phep.'), { statusCode: 409 });

    const existingForShift = await getAssignedDriver(shiftId);
    if (existingForShift) throw Object.assign(new Error('Ca da co tai xe.'), { statusCode: 409 });

    const conflict = await findOverlappingAssignment({
      model: DriverShiftAssignment,
      resourceField: 'driverId',
      resourceId: driverId,
      workDate,
      shift,
    });
    if (conflict) throw Object.assign(new Error('Tai xe da co ca khac trung thoi gian.'), { statusCode: 409 });

    const assignedMinutes = await getTotalAssignedMinutesForDriver({ driverId, workDate, excludeShiftId: shiftId });
    if (assignedMinutes + getShiftDurationMinutes(shift) > MAX_DRIVER_MINUTES_PER_DAY) {
      throw Object.assign(new Error('Tai xe vuot qua so gio lam toi da trong ngay.'), { statusCode: 409 });
    }

    const assignment = new DriverShiftAssignment({
      driverId,
      shiftId,
      workDate,
      status: 'ASSIGNED',
      createdBy: actorId,
      updatedBy: actorId,
    });
    await assignment.save();
    return assignment.populate([{ path: 'driverId', select: 'fullName email phone role status' }, { path: 'shiftId' }]);
  }

  static async assignAssistantToShift(shiftId, { assistantId, actorId }) {
    const shift = await ensureActiveShift(shiftId);
    const workDate = normalizeDateOnly(shift.workDate);
    if (!workDate) throw Object.assign(new Error('Ngay lam viec cua ca khong hop le.'), { statusCode: 400 });
    if (!isValidObjectId(assistantId)) throw Object.assign(new Error('Khong tim thay phu xe.'), { statusCode: 404 });

    const assistant = await User.findOne({ _id: assistantId, role: { $in: ['CONDUCTOR', 'BUS_ASSISTANT'] } }).lean();
    if (!assistant) throw Object.assign(new Error('Khong tim thay phu xe.'), { statusCode: 404 });
    if (assistant.status !== 'ACTIVE') throw Object.assign(new Error('Phu xe khong hoat dong.'), { statusCode: 409 });
    if (hasLeaveConflict(assistant, workDate)) throw Object.assign(new Error('Phu xe dang nghi phep.'), { statusCode: 409 });

    const existingForShift = await getAssignedAssistant(shiftId);
    if (existingForShift) throw Object.assign(new Error('Ca da co phu xe.'), { statusCode: 409 });

    const conflict = await findOverlappingAssignment({
      model: AssistantShiftAssignment,
      resourceField: 'assistantId',
      resourceId: assistantId,
      workDate,
      shift,
    });
    if (conflict) throw Object.assign(new Error('Phu xe da co ca khac trung thoi gian.'), { statusCode: 409 });

    const assignedMinutes = await getTotalAssignedMinutesForAssistant({ assistantId, workDate, excludeShiftId: shiftId });
    if (assignedMinutes + getShiftDurationMinutes(shift) > MAX_DRIVER_MINUTES_PER_DAY) {
      throw Object.assign(new Error('Phu xe vuot qua so gio lam toi da trong ngay.'), { statusCode: 409 });
    }

    const assignment = new AssistantShiftAssignment({
      assistantId,
      shiftId,
      workDate,
      status: 'ASSIGNED',
      createdBy: actorId,
      updatedBy: actorId,
    });
    await assignment.save();
    return assignment.populate([{ path: 'assistantId', select: 'fullName email phone role status' }, { path: 'shiftId' }]);
  }

  static async assignVehicleToShift(shiftId, { vehicleId, actorId }) {
    const shift = await ensureActiveShift(shiftId);
    const workDate = normalizeDateOnly(shift.workDate);
    if (!workDate) throw Object.assign(new Error('Ngay lam viec cua ca khong hop le.'), { statusCode: 400 });
    if (!isValidObjectId(vehicleId)) throw Object.assign(new Error('Khong tim thay xe.'), { statusCode: 404 });

    const vehicle = await FleetBus.findById(vehicleId).lean();
    if (!vehicle) throw Object.assign(new Error('Khong tim thay xe.'), { statusCode: 404 });
    if (vehicle.status === 'MAINTENANCE') throw Object.assign(new Error('Xe dang bao tri.'), { statusCode: 409 });
    if (vehicle.status === 'INACTIVE') throw Object.assign(new Error('Xe khong hoat dong.'), { statusCode: 409 });

    const existingForShift = await getAssignedVehicle(shiftId);
    if (existingForShift) throw Object.assign(new Error('Ca da co xe.'), { statusCode: 409 });

    const conflict = await findOverlappingAssignment({
      model: VehicleShiftAssignment,
      resourceField: 'vehicleId',
      resourceId: vehicleId,
      workDate,
      shift,
    });
    if (conflict) throw Object.assign(new Error('Xe da duoc phan cong trong khoang thoi gian nay.'), { statusCode: 409 });

    const assignment = new VehicleShiftAssignment({
      vehicleId,
      shiftId,
      workDate,
      status: 'ASSIGNED',
      createdBy: actorId,
      updatedBy: actorId,
    });
    await assignment.save();
    return assignment.populate([{ path: 'vehicleId', select: 'busCode plateNumber busType status capacity' }, { path: 'shiftId' }]);
  }

  static async assignTripToShift(shiftId, { tripId, actorId }) {
    const shift = await ensureActiveShift(shiftId);
    const workDate = normalizeDateOnly(shift.workDate);
    if (!workDate) throw Object.assign(new Error('Ngay lam viec cua ca khong hop le.'), { statusCode: 400 });
    if (!isValidObjectId(tripId)) throw Object.assign(new Error('Khong tim thay chuyen.'), { statusCode: 404 });

    const [trip, driverAssignment, vehicleAssignment] = await Promise.all([
      TripSchedule.findById(tripId).lean(),
      getAssignedDriver(shiftId),
      getAssignedVehicle(shiftId),
    ]);

    if (!trip) throw Object.assign(new Error('Khong tim thay chuyen.'), { statusCode: 404 });
    if (!driverAssignment || !vehicleAssignment) {
      throw Object.assign(new Error('Can phan cong xe va tai xe truoc khi gan chuyen.'), { statusCode: 409 });
    }

    const tripDate = normalizeDateOnly(trip.serviceDate);
    if (tripDate && tripDate.getTime() !== workDate.getTime()) {
      throw Object.assign(new Error('Chuyen khong thuoc ngay lam viec cua ca.'), { statusCode: 400 });
    }
    if (!isTimeInsideShift(trip.departureTime, shift) || !isTimeInsideShift(trip.expectedArrivalTime, shift)) {
      throw Object.assign(new Error('Chuyen khong nam trong khoang thoi gian cua ca.'), { statusCode: 400 });
    }

    const existingTripAssignment = await TripShiftAssignment.findOne({
      tripId,
      status: { $in: ACTIVE_TRIP_ASSIGNMENT_STATUSES },
    }).lean();
    if (existingTripAssignment) throw Object.assign(new Error('Chuyen da duoc gan vao ca khac.'), { statusCode: 409 });

    const assignment = new TripShiftAssignment({
      tripId,
      shiftId,
      driverId: driverAssignment.driverId?._id || driverAssignment.driverId,
      vehicleId: vehicleAssignment.vehicleId?._id || vehicleAssignment.vehicleId,
      workDate,
      status: 'ASSIGNED',
      createdBy: actorId,
      updatedBy: actorId,
    });
    await assignment.save();
    return assignment.populate([
      { path: 'tripId', select: 'scheduleCode routeCode routeName serviceDate departureTime expectedArrivalTime status' },
      { path: 'driverId', select: 'fullName email phone role status' },
      { path: 'vehicleId', select: 'busCode plateNumber busType status capacity' },
      { path: 'shiftId' },
    ]);
  }

  static async autoGenerateDailySchedule({ workDate, actorId }) {
    const dateOnly = normalizeDateOnly(workDate);
    if (!dateOnly) {
      throw Object.assign(new Error('Ngay lam viec la bat buoc.'), { statusCode: 400 });
    }

    const [drivers, assistants] = await Promise.all([
      User.find({ role: 'DRIVER', status: 'ACTIVE' }).sort({ fullName: 1, createdAt: 1 }).lean(),
      User.find({ role: { $in: ['CONDUCTOR', 'BUS_ASSISTANT'] }, status: 'ACTIVE' })
        .sort({ fullName: 1, createdAt: 1 })
        .lean(),
    ]);
    if (!drivers.length) {
      throw Object.assign(new Error('Khong co tai xe dang hoat dong de sinh lich.'), { statusCode: 409 });
    }
    if (!assistants.length) {
      throw Object.assign(new Error('Khong co phu xe dang hoat dong de sinh lich.'), { statusCode: 409 });
    }

    const summary = {
      workDate: dateOnly,
      maxDriverMinutesPerDay: MAX_DRIVER_MINUTES_PER_DAY,
      createdShifts: 0,
      existingShifts: 0,
      updatedShifts: 0,
      archivedShifts: 0,
      assignedDrivers: 0,
      assignedAssistants: 0,
      skippedShifts: [],
      shifts: [],
    };

    const existingAutoShifts = await Shift.find({
      shiftCode: new RegExp(`^AUTO-${toDateToken(dateOnly)}-`),
      workDate: dateOnly,
      status: { $ne: 'ARCHIVED' },
    }).lean();

    for (const obsoleteShift of existingAutoShifts.filter(isRemovedAutoShiftTemplate)) {
      await Shift.findByIdAndUpdate(
        obsoleteShift._id,
        { $set: { status: 'ARCHIVED', updatedBy: actorId } },
        { new: true, runValidators: true }
      ).lean();
      summary.archivedShifts += 1;
    }

    for (const template of AUTO_SHIFT_TEMPLATES) {
      const payload = buildAutoShiftPayload({ template, workDate: dateOnly, actorId });
      let shift = await Shift.findOne({ shiftCode: payload.shiftCode, workDate: dateOnly }).lean();

      if (shift) {
        if (shouldUpdateAutoShift(shift, payload)) {
          shift = await Shift.findByIdAndUpdate(
            shift._id,
            { $set: payload },
            { new: true, runValidators: true }
          ).lean();
          summary.updatedShifts += 1;
        }
        summary.existingShifts += 1;
      } else {
        try {
          const createdShift = new Shift(payload);
          await createdShift.save();
          shift = createdShift.toObject();
          summary.createdShifts += 1;
        } catch (error) {
          if (error.code !== 11000) throw error;
          shift = await Shift.findOne({ shiftCode: payload.shiftCode, workDate: dateOnly }).lean();
          summary.existingShifts += 1;
        }
      }

      const shiftResult = {
        shiftId: shift?._id,
        shiftCode: shift?.shiftCode,
        shiftName: shift?.shiftName,
        startTime: shift?.startTime,
        endTime: shift?.endTime,
        driver: null,
        assistant: null,
        driverStatus: 'UNASSIGNED',
        assistantStatus: 'UNASSIGNED',
        reasons: [],
      };

      const existingDriver = await getAssignedDriver(shift._id);
      if (existingDriver) {
        shiftResult.driver = existingDriver.driverId;
        shiftResult.driverStatus = 'ALREADY_ASSIGNED';
      } else {
        let assignedDriver = null;
        let lastDriverError = null;
        for (const driver of drivers) {
          try {
            assignedDriver = await this.assignDriverToShift(shift._id, { driverId: driver._id, actorId });
            break;
          } catch (error) {
            lastDriverError = error;
          }
        }
        if (assignedDriver) {
          shiftResult.driver = assignedDriver.driverId;
          shiftResult.driverStatus = 'ASSIGNED';
          summary.assignedDrivers += 1;
        } else {
          shiftResult.driverStatus = 'SKIPPED';
          shiftResult.reasons.push(lastDriverError?.message || 'Khong tim duoc tai xe phu hop.');
        }
      }

      const existingAssistant = await getAssignedAssistant(shift._id);
      if (existingAssistant) {
        shiftResult.assistant = existingAssistant.assistantId;
        shiftResult.assistantStatus = 'ALREADY_ASSIGNED';
      } else {
        let assignedAssistant = null;
        let lastAssistantError = null;
        for (const assistant of assistants) {
          try {
            assignedAssistant = await this.assignAssistantToShift(shift._id, { assistantId: assistant._id, actorId });
            break;
          } catch (error) {
            lastAssistantError = error;
          }
        }
        if (assignedAssistant) {
          shiftResult.assistant = assignedAssistant.assistantId;
          shiftResult.assistantStatus = 'ASSIGNED';
          summary.assignedAssistants += 1;
        } else {
          shiftResult.assistantStatus = 'SKIPPED';
          shiftResult.reasons.push(lastAssistantError?.message || 'Khong tim duoc phu xe phu hop.');
        }
      }

      shiftResult.status = shiftResult.reasons.length ? 'PARTIAL' : 'ASSIGNED';
      shiftResult.reason = shiftResult.reasons.join(' ');
      if (shiftResult.reasons.length) summary.skippedShifts.push(shiftResult);
      summary.shifts.push(shiftResult);
    }

    return summary;
  }

  static async autoGenerateWeeklySchedule({ workDate, actorId }) {
    const startDate = normalizeDateOnly(workDate);
    if (!startDate) {
      throw Object.assign(new Error('Ngay bat dau la bat buoc.'), { statusCode: 400 });
    }

    const summary = {
      startDate,
      endDate: addDays(startDate, 6),
      days: 7,
      maxDriverMinutesPerDay: MAX_DRIVER_MINUTES_PER_DAY,
      createdShifts: 0,
      existingShifts: 0,
      updatedShifts: 0,
      archivedShifts: 0,
      assignedDrivers: 0,
      assignedAssistants: 0,
      skippedShifts: [],
      shifts: [],
      dailySummaries: [],
    };

    for (let index = 0; index < 7; index += 1) {
      const daySummary = await this.autoGenerateDailySchedule({
        workDate: addDays(startDate, index),
        actorId,
      });
      summary.createdShifts += daySummary.createdShifts || 0;
      summary.existingShifts += daySummary.existingShifts || 0;
      summary.updatedShifts += daySummary.updatedShifts || 0;
      summary.archivedShifts += daySummary.archivedShifts || 0;
      summary.assignedDrivers += daySummary.assignedDrivers || 0;
      summary.assignedAssistants += daySummary.assignedAssistants || 0;
      summary.skippedShifts.push(...(daySummary.skippedShifts || []));
      summary.shifts.push(...(daySummary.shifts || []));
      summary.dailySummaries.push(daySummary);
    }

    return summary;
  }

  static async listAssignmentsForShift(shiftId) {
    if (!isValidObjectId(shiftId)) throw Object.assign(new Error('Khong tim thay ca lam viec.'), { statusCode: 404 });
    return this.listAssignments({ shiftId });
  }

  static assertPayrollReady(assignment) {
    if (assignment?.status !== 'COMPLETED') {
      throw Object.assign(new Error('Chỉ ca đã hoàn thành mới được dùng để tính lương.'), { statusCode: 400 });
    }
  }
}
