import mongoose from 'mongoose';
import { HTTP_STATUS } from '../../constants/index.js';
import { CustomError } from '../../middleware/errorHandler.js';
import FleetBus from '../admin/FleetBus.js';
import TripSchedule from '../admin/TripSchedule.js';
import { createBroadcastNotification } from '../systemNotifications/systemNotification.service.js';
import Trip from '../fleetOperations/Trip.js';
import Vehicle from '../fleetOperations/Vehicle.js';
import { SOCKET_EVENTS } from '../fleetOperations/fleetOperations.constants.js';
import VehicleReassignmentLog from './VehicleReassignmentLog.js';

const ACTIVE_TRIP_STATUSES = ['scheduled', 'active', 'paused', 'delayed', 'incident'];
const ACTIVE_SCHEDULE_STATUSES = ['PLANNED', 'ASSIGNED', 'IN_PROGRESS'];
const OLD_VEHICLE_MAINTENANCE_REASONS = new Set([
  'breakdown',
  'maintenance_required',
  'accident',
  'gps_device_failure',
]);

const normalizeId = (value) => String(value || '').trim();
const toObjectId = (value, field = 'id') => {
  if (!mongoose.isValidObjectId(value)) {
    throw new CustomError(`Invalid ${field}`, HTTP_STATUS.BAD_REQUEST);
  }
  return new mongoose.Types.ObjectId(value);
};

const mapFleetBusStatus = (status) => {
  if (status === 'MAINTENANCE') return 'maintenance';
  if (status === 'RESERVE' || status === 'ACTIVE') return 'available';
  return String(status || '').toLowerCase();
};

const getVehicleLabel = (vehicle = {}) => (
  vehicle.vehicleCode || vehicle.busCode || vehicle.plateNumber || vehicle._id?.toString()
);

const serviceDateBounds = (serviceDate) => {
  const start = new Date(serviceDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const clockToDate = (serviceDate, clockValue, fallbackHour = 0, fallbackMinute = 0) => {
  const date = new Date(serviceDate);
  const [hour = fallbackHour, minute = fallbackMinute] = String(clockValue || '').split(':').map(Number);
  date.setHours(Number.isFinite(hour) ? hour : fallbackHour, Number.isFinite(minute) ? minute : fallbackMinute, 0, 0);
  return date;
};

const getScheduleWindow = (schedule) => {
  if (!schedule) return null;
  const start = schedule.actualStartAt || clockToDate(schedule.serviceDate, schedule.departureTime);
  const end = schedule.actualEndAt || clockToDate(schedule.serviceDate, schedule.expectedArrivalTime, 23, 59);
  return { start: new Date(start), end: new Date(end) };
};

const windowsOverlap = (leftStart, leftEnd, rightStart, rightEnd) => (
  new Date(leftStart).getTime() < new Date(rightEnd).getTime()
  && new Date(leftEnd).getTime() > new Date(rightStart).getTime()
);

const formatOperationalVehicle = ({ vehicle, currentAssignment = null, suitabilityReason = '' }) => ({
  id: vehicle._id?.toString(),
  source: 'Vehicle',
  plateNumber: vehicle.plateNumber,
  vehicleCode: vehicle.vehicleCode,
  busCode: vehicle.vehicleCode,
  capacity: vehicle.capacity,
  status: vehicle.status,
  currentAssignment,
  suitabilityReason: suitabilityReason || 'Available, capacity fits, and no overlapping operational trip.',
});

const formatFleetBus = ({ bus, currentAssignment = null, suitabilityReason = '' }) => ({
  id: bus._id?.toString(),
  source: 'FleetBus',
  plateNumber: bus.plateNumber,
  vehicleCode: bus.busCode,
  busCode: bus.busCode,
  busType: bus.busType,
  capacity: bus.capacity,
  status: mapFleetBusStatus(bus.status),
  currentAssignment,
  suitabilityReason: suitabilityReason || 'Available reserve bus with no overlapping schedule assignment.',
});

export class VehicleReassignmentService {
  static async resolveTargetTrip(tripId) {
    const objectId = toObjectId(tripId, 'tripId');
    const trip = await Trip.findById(objectId).lean();

    if (trip) {
      const schedule = trip.scheduleId ? await TripSchedule.findById(trip.scheduleId).lean() : null;
      return {
        kind: 'trip',
        trip,
        schedule,
        routeId: trip.routeId,
        oldVehicleId: trip.vehicleId,
        requiredCapacity: null,
        window: {
          start: trip.actualStartTime || trip.plannedStartTime,
          end: trip.actualEndTime || trip.plannedEndTime,
        },
      };
    }

    const schedule = await TripSchedule.findById(objectId).lean();
    if (schedule) {
      return {
        kind: 'schedule',
        trip: null,
        schedule,
        routeId: schedule.routeId,
        oldVehicleId: schedule.vehicle?.busId,
        requiredCapacity: schedule.vehicle?.capacity || null,
        window: getScheduleWindow(schedule),
      };
    }

    throw new CustomError('Trip not found', HTTP_STATUS.NOT_FOUND);
  }

  static assertReplaceable(target) {
    if (target.kind === 'trip' && !ACTIVE_TRIP_STATUSES.includes(target.trip.status)) {
      throw new CustomError('Replacement can only be assigned to active or upcoming trips', HTTP_STATUS.CONFLICT);
    }
    if (target.kind === 'schedule' && !ACTIVE_SCHEDULE_STATUSES.includes(target.schedule.status)) {
      throw new CustomError('Replacement can only be assigned to active or upcoming trips', HTTP_STATUS.CONFLICT);
    }
  }

  static async getTripVehicle(target) {
    if (!target.oldVehicleId) return null;
    const [vehicle, bus] = await Promise.all([
      Vehicle.findById(target.oldVehicleId).lean(),
      FleetBus.findById(target.oldVehicleId).lean(),
    ]);
    return vehicle || bus || null;
  }

  static async hasOperationalOverlap(vehicleId, target) {
    if (!vehicleId || !target.window?.start || !target.window?.end) return false;
    const overlapping = await Trip.findOne({
      _id: { $ne: target.trip?._id },
      vehicleId,
      status: { $in: ACTIVE_TRIP_STATUSES },
      plannedStartTime: { $lt: new Date(target.window.end) },
      plannedEndTime: { $gt: new Date(target.window.start) },
    }).select('_id plannedStartTime plannedEndTime status').lean();

    return overlapping ? {
      tripId: overlapping._id?.toString(),
      status: overlapping.status,
      start: overlapping.plannedStartTime,
      end: overlapping.plannedEndTime,
    } : false;
  }

  static async hasScheduleOverlap(busId, target) {
    if (!busId || !target.schedule?.serviceDate) return false;
    const { start, end } = serviceDateBounds(target.schedule.serviceDate);
    const schedules = await TripSchedule.find({
      _id: { $ne: target.schedule._id },
      'vehicle.busId': busId,
      status: { $nin: ['CANCELLED', 'COMPLETED'] },
      serviceDate: { $gte: start, $lt: end },
    }).select('scheduleCode status serviceDate departureTime expectedArrivalTime').lean();

    const targetWindow = target.window || getScheduleWindow(target.schedule);
    const overlapping = schedules.find((schedule) => {
      const window = getScheduleWindow(schedule);
      return window && targetWindow && windowsOverlap(targetWindow.start, targetWindow.end, window.start, window.end);
    });

    return overlapping ? {
      scheduleId: overlapping._id?.toString(),
      scheduleCode: overlapping.scheduleCode,
      status: overlapping.status,
      start: getScheduleWindow(overlapping)?.start,
      end: getScheduleWindow(overlapping)?.end,
    } : false;
  }

  static async findReplacementVehicleCandidates(query = {}) {
    const target = query.tripId ? await this.resolveTargetTrip(query.tripId) : {
      kind: 'route',
      routeId: toObjectId(query.routeId, 'routeId'),
      oldVehicleId: null,
      requiredCapacity: Number(query.requiredCapacity) || null,
      window: null,
      trip: null,
      schedule: null,
    };
    if (target.kind !== 'route') this.assertReplaceable(target);

    const oldVehicle = await this.getTripVehicle(target);
    const requiredCapacity = Number(query.requiredCapacity || target.requiredCapacity || oldVehicle?.capacity || 0);
    const oldVehicleId = normalizeId(target.oldVehicleId);

    const [vehicles, buses] = await Promise.all([
      Vehicle.find({
        status: 'available',
        ...(requiredCapacity ? { capacity: { $gte: requiredCapacity } } : {}),
        ...(oldVehicleId ? { _id: { $ne: target.oldVehicleId } } : {}),
      }).sort({ capacity: 1, vehicleCode: 1 }).lean(),
      FleetBus.find({
        status: { $in: ['ACTIVE', 'RESERVE'] },
        ...(requiredCapacity ? { capacity: { $gte: requiredCapacity } } : {}),
        ...(oldVehicleId ? { _id: { $ne: target.oldVehicleId } } : {}),
      }).sort({ capacity: 1, busCode: 1 }).lean(),
    ]);

    const vehicleCandidates = [];
    for (const vehicle of vehicles) {
      const overlap = await this.hasOperationalOverlap(vehicle._id, target);
      if (!overlap) vehicleCandidates.push(formatOperationalVehicle({ vehicle }));
    }

    const busCandidates = [];
    for (const bus of buses) {
      const overlap = await this.hasScheduleOverlap(bus._id, target);
      const duplicateOperational = vehicleCandidates.some((item) => item.plateNumber === bus.plateNumber);
      if (!overlap && !duplicateOperational) busCandidates.push(formatFleetBus({ bus }));
    }

    const candidates = [...vehicleCandidates, ...busCandidates];

    return {
      tripId: query.tripId || null,
      routeId: target.routeId?.toString() || query.routeId || null,
      requiredCapacity: requiredCapacity || null,
      oldVehicle: oldVehicle ? {
        id: oldVehicle._id?.toString(),
        plateNumber: oldVehicle.plateNumber,
        vehicleCode: getVehicleLabel(oldVehicle),
        capacity: oldVehicle.capacity || null,
        status: oldVehicle.status || null,
      } : null,
      candidates,
      message: candidates.length
        ? ''
        : 'No eligible replacement vehicles are available for this trip. Check vehicle status, maintenance, capacity, and schedule conflicts.',
    };
  }

  static async resolveReplacementVehicle(replacementVehicleId, target) {
    const objectId = toObjectId(replacementVehicleId, 'replacementVehicleId');
    let [vehicle, bus] = await Promise.all([
      Vehicle.findById(objectId).lean(),
      FleetBus.findById(objectId).lean(),
    ]);
    let replacement = vehicle || bus;

    if (!replacement) {
      throw new CustomError('Replacement vehicle not found', HTTP_STATUS.NOT_FOUND);
    }
    if (normalizeId(target.oldVehicleId) === normalizeId(replacement._id)) {
      throw new CustomError('Replacement vehicle cannot be the same as the broken vehicle', HTTP_STATUS.CONFLICT);
    }

    const isOperationalVehicle = Boolean(vehicle);
    const status = isOperationalVehicle ? vehicle.status : mapFleetBusStatus(bus.status);
    if (status !== 'available') {
      throw new CustomError('Replacement vehicle is not available', HTTP_STATUS.CONFLICT);
    }

    const oldVehicle = await this.getTripVehicle(target);
    const requiredCapacity = Number(target.requiredCapacity || oldVehicle?.capacity || 0);
    if (requiredCapacity && Number(replacement.capacity || 0) < requiredCapacity) {
      throw new CustomError('Replacement vehicle capacity is below required capacity', HTTP_STATUS.CONFLICT);
    }

    const [operationalOverlap, scheduleOverlap] = await Promise.all([
      this.hasOperationalOverlap(replacement._id, target),
      this.hasScheduleOverlap(replacement._id, target),
    ]);
    if (operationalOverlap || scheduleOverlap) {
      throw new CustomError('Replacement vehicle has an overlapping trip or schedule', HTTP_STATUS.CONFLICT);
    }

    if (target.kind === 'trip' && !vehicle && bus) {
      vehicle = await Vehicle.findOneAndUpdate(
        {
          $or: [
            { plateNumber: bus.plateNumber },
            { vehicleCode: bus.busCode },
          ],
        },
        {
          $set: {
            plateNumber: bus.plateNumber,
            vehicleCode: bus.busCode,
            capacity: bus.capacity,
            status: 'available',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).lean();
      replacement = vehicle;
    }

    return { replacement, isOperationalVehicle, oldVehicle };
  }

  static async syncScheduleVehicle(scheduleId, replacement, adminId, reason) {
    if (!scheduleId) return null;
    const schedule = await TripSchedule.findById(scheduleId);
    if (!schedule) return null;

    const previousVehicle = schedule.vehicle?.toObject ? schedule.vehicle.toObject() : schedule.vehicle;
    schedule.vehicle = {
      busId: replacement._id,
      busCode: replacement.busCode || replacement.vehicleCode || '',
      plateNumber: replacement.plateNumber || '',
      busType: replacement.busType || '',
      capacity: replacement.capacity || 0,
    };
    schedule.updatedBy = adminId;
    schedule.emergencyHistory.push({
      reason,
      changedAt: new Date(),
      changedBy: adminId,
      previousVehicle,
      previousDriver: schedule.driver,
      previousAssistant: schedule.assistant,
    });
    await schedule.save();
    return schedule.toObject();
  }

  static async updateVehicleStatuses({ target, replacement, payload }) {
    const oldVehicleId = target.oldVehicleId;
    const newStatus = target.kind === 'trip' && ['active', 'delayed', 'incident', 'paused'].includes(target.trip.status)
      ? 'active'
      : 'assigned';
    const oldStatus = OLD_VEHICLE_MAINTENANCE_REASONS.has(payload.reason) ? 'maintenance' : 'inactive';

    await Promise.all([
      oldVehicleId ? Vehicle.updateOne({ _id: oldVehicleId }, { $set: { status: oldStatus } }) : null,
      oldVehicleId ? FleetBus.updateOne({ _id: oldVehicleId }, { $set: { status: 'MAINTENANCE' } }) : null,
      Vehicle.updateOne({ _id: replacement._id }, { $set: { status: newStatus } }),
      FleetBus.updateOne({ _id: replacement._id }, { $set: { status: 'ACTIVE' } }),
    ].filter(Boolean));
  }

  static async notify({ target, payload, adminId, oldVehicle, replacement, io }) {
    const title = 'Trip vehicle reassigned';
    const message = `${getVehicleLabel(oldVehicle)} was replaced by ${getVehicleLabel(replacement)}. Reason: ${payload.reason}.`;
    const tripId = target.trip?._id || target.schedule?._id;

    const notifications = [];
    if (payload.notifyStaff !== false) {
      notifications.push(await createBroadcastNotification({
        title,
        message,
        type: 'maintenance',
        priority: 'urgent',
        targetAudience: 'trip_staff',
        tripId,
      }, adminId, io));
    }

    if (payload.notifyPassengers && target.routeId) {
      notifications.push(await createBroadcastNotification({
        title: 'Vehicle changed for your trip',
        message: 'A replacement bus has been assigned to keep the trip operating. Please follow staff instructions at stops and onboard.',
        type: 'service_interruption',
        priority: target.kind === 'trip' && target.trip.status !== 'scheduled' ? 'high' : 'normal',
        targetAudience: 'route_passengers',
        routeId: target.routeId,
        tripId,
      }, adminId, io));
    }

    return notifications;
  }

  static async assignReplacementVehicle(tripId, replacementVehicleId, payload, adminId, io = null) {
    const target = await this.resolveTargetTrip(tripId);
    this.assertReplaceable(target);

    const { replacement, oldVehicle } = await this.resolveReplacementVehicle(replacementVehicleId, target);
    const oldVehicleId = target.oldVehicleId;
    if (!oldVehicleId) {
      throw new CustomError('Trip does not have an assigned vehicle to replace', HTTP_STATUS.CONFLICT);
    }

    let updatedTrip = null;
    let updatedSchedule = null;

    if (target.kind === 'trip') {
      updatedTrip = await Trip.findByIdAndUpdate(
        target.trip._id,
        {
          $set: { vehicleId: replacement._id },
          $push: {
            operationNotes: {
              note: payload.note,
              reason: payload.reason,
              createdBy: adminId,
              createdAt: new Date(),
            },
          },
        },
        { new: true }
      ).lean();

      const shouldUpdateSchedule = !target.trip.actualStartTime
        || target.trip.status === 'scheduled'
        || Boolean(payload.updateSchedule);
      if (shouldUpdateSchedule && target.trip.scheduleId) {
        updatedSchedule = await this.syncScheduleVehicle(target.trip.scheduleId, replacement, adminId, payload.reason);
      }
    } else {
      updatedSchedule = await this.syncScheduleVehicle(target.schedule._id, replacement, adminId, payload.reason);
    }

    await this.updateVehicleStatuses({ target, replacement, payload });

    const log = await VehicleReassignmentLog.create({
      tripId: target.trip?._id || target.schedule?._id,
      oldVehicleId,
      newVehicleId: replacement._id,
      reason: payload.reason,
      note: payload.note,
      changedBy: adminId,
      changedAt: new Date(),
    });

    const notifications = await this.notify({
      target,
      payload,
      adminId,
      oldVehicle,
      replacement,
      io,
    });

    const socketPayload = {
      tripId: target.trip?._id?.toString() || null,
      scheduleId: target.schedule?._id?.toString() || target.trip?.scheduleId?.toString() || null,
      oldVehicle: oldVehicle ? {
        id: oldVehicle._id?.toString(),
        vehicleCode: getVehicleLabel(oldVehicle),
        plateNumber: oldVehicle.plateNumber,
      } : null,
      newVehicle: {
        id: replacement._id?.toString(),
        vehicleCode: getVehicleLabel(replacement),
        plateNumber: replacement.plateNumber,
        capacity: replacement.capacity,
      },
      reason: payload.reason,
      note: payload.note,
      changedBy: adminId?.toString(),
      changedAt: log.changedAt,
    };

    io?.to('fleet:operations').emit(SOCKET_EVENTS.TRIP_VEHICLE_REASSIGNED, socketPayload);
    io?.emit(SOCKET_EVENTS.TRIP_VEHICLE_REASSIGNED, socketPayload);

    return {
      trip: updatedTrip,
      schedule: updatedSchedule,
      reassignmentLog: {
        ...log.toObject(),
        id: log._id?.toString(),
      },
      notifications: notifications.map((notification) => ({
        id: notification._id?.toString(),
        targetAudience: notification.targetAudience,
        resolvedCount: notification.deliverySummary?.resolvedCount || 0,
      })),
      event: socketPayload,
    };
  }
}

export default VehicleReassignmentService;
