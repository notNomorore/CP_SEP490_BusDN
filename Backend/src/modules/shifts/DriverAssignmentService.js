import mongoose from 'mongoose';
import User from '../auth/User.js';
import TripSchedule from '../admin/TripSchedule.js';
import TripShiftAssignment from './TripShiftAssignment.js';
import AssignmentLock from './AssignmentLock.js';
import ShiftAuditLog from './ShiftAuditLog.js';
import DriverAvailabilityService from './DriverAvailabilityService.js';

const ACTIVE = ['ASSIGNED', 'IN_PROGRESS'];

export default class DriverAssignmentService {
  static async availableDrivers(tripId) {
    return DriverAvailabilityService.listForTrip(tripId);
  }

  static async assign({ tripId, driverId, actorId }) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await AssignmentLock.findOneAndUpdate(
        { lockKey: `DRIVER_ASSIGNMENT:${driverId}` },
        { $inc: { version: 1 } },
        { upsert: true, new: true, session }
      );
      const { driver } = await DriverAvailabilityService.assertAvailable(tripId, driverId, { session });
      const trip = await TripSchedule.findById(tripId).session(session);
      if (!trip) throw Object.assign(new Error('Không tìm thấy chuyến.'), { code: 'TRIP_NOT_FOUND', statusCode: 404 });
      const existing = await TripShiftAssignment.findOne({ tripId, status: { $in: ACTIVE } }).session(session);
      if (existing?.driverId && String(existing.driverId) !== String(driverId)) {
        throw Object.assign(new Error('Chuyến đã có tài xế được phân công.'), { code: 'TRIP_ALREADY_HAS_DRIVER', statusCode: 409 });
      }
      const user = await User.findById(driverId).session(session).lean();
      const oldDriver = trip.driver?.userId || null;
      if (existing) {
        existing.driverId = driverId;
        existing.shiftId = driver.shift.id;
        existing.updatedBy = actorId;
        await existing.save({ session });
      } else {
        await TripShiftAssignment.create([{
          tripId,
          shiftId: driver.shift.id,
          driverId,
          workDate: trip.serviceDate,
          status: 'ASSIGNED',
          createdBy: actorId,
          updatedBy: actorId,
        }], { session });
      }
      trip.driver = { userId: user._id, fullName: user.fullName, phone: user.phoneNumber || '', role: user.role };
      if (trip.status === 'PLANNED') trip.status = 'ASSIGNED';
      trip.updatedBy = actorId;
      await trip.save({ session });
      await ShiftAuditLog.create([{
        entityId: driver.shift.id,
        action: oldDriver ? 'DRIVER_REASSIGNED_TO_TRIP' : 'DRIVER_ASSIGNED_TO_TRIP',
        oldValue: { tripId, driverId: oldDriver },
        newValue: { tripId, driverId },
        changedBy: actorId,
      }], { session });
      await session.commitTransaction();
      return { tripId, driver };
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  static async remove({ tripId, actorId }) {
    const assignment = await TripShiftAssignment.findOne({ tripId, status: { $in: ACTIVE } });
    if (!assignment?.driverId) throw Object.assign(new Error('Chuyến chưa có tài xế được phân công.'), { code: 'DRIVER_ASSIGNMENT_NOT_FOUND', statusCode: 404 });
    const oldDriver = assignment.driverId;
    assignment.driverId = undefined;
    assignment.updatedBy = actorId;
    await assignment.save();
    await TripSchedule.findByIdAndUpdate(tripId, { $set: { driver: {}, updatedBy: actorId } });
    await ShiftAuditLog.create({ entityId: assignment.shiftId, action: 'DRIVER_REMOVED_FROM_TRIP', oldValue: { tripId, driverId: oldDriver }, newValue: { tripId, driverId: null }, changedBy: actorId });
    return { tripId, removedDriverId: oldDriver };
  }
}
