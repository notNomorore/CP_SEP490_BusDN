import mongoose from 'mongoose';
import User from '../auth/User.js';
import TripSchedule from '../admin/TripSchedule.js';
import Shift from './Shift.js';
import DriverShiftAssignment from './DriverShiftAssignment.js';
import TripShiftAssignment from './TripShiftAssignment.js';
import TransferTimeService from './TransferTimeService.js';
import rules from './driverScheduling.config.js';

const ACTIVE = ['ASSIGNED', 'IN_PROGRESS'];
const SHIFT_ACTIVE = ['ASSIGNED', 'IN_PROGRESS'];
const id = (value) => String(value?._id || value || '');
const clock = (value) => { const [h, m] = String(value || '').split(':').map(Number); return Number.isFinite(h + m) ? h * 60 + m : null; };
const duration = (trip) => Math.max(0, clock(trip.expectedArrivalTime) - clock(trip.departureTime));
const overlap = (a, b) => clock(a.departureTime) < clock(b.expectedArrivalTime) && clock(a.expectedArrivalTime) > clock(b.departureTime);
const dayStart = (value) => { const date = new Date(value); date.setHours(0, 0, 0, 0); return date; };
const addDays = (value, count) => new Date(value.getFullYear(), value.getMonth(), value.getDate() + count);
const approvedLeave = (driver, date) => (driver.staffAvailability?.leaveRequests || []).some((leave) => ['APPROVED', 'ACTIVE'].includes(leave.status) && dayStart(leave.startDate) <= date && dayStart(leave.endDate) >= date);
const publicDriver = (driver) => ({ id: driver._id, code: driver.driverLicense?.licenseNumber || '', name: driver.fullName });

const domainError = (code, message, details = null) => Object.assign(new Error(message), { code, statusCode: 409, details });

export default class DriverAvailabilityService {
  static async context(tripId, { session } = {}) {
    if (!mongoose.Types.ObjectId.isValid(tripId)) throw Object.assign(new Error('Không tìm thấy chuyến.'), { code: 'TRIP_NOT_FOUND', statusCode: 404 });
    const trip = await TripSchedule.findById(tripId).session(session || null).lean();
    if (!trip || trip.status === 'CANCELLED') throw Object.assign(new Error('Không tìm thấy chuyến có thể phân công.'), { code: 'TRIP_NOT_FOUND', statusCode: 404 });
    const date = dayStart(trip.serviceDate);
    const next = addDays(date, 1);
    const weekStart = new Date(date); weekStart.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const drivers = await User.find({ role: 'DRIVER' }).session(session || null).lean();
    const shiftAssignments = await DriverShiftAssignment.find({ driverId: { $in: drivers.map((item) => item._id) }, workDate: { $gte: date, $lt: next }, status: { $in: SHIFT_ACTIVE } }).session(session || null).lean();
    const shifts = await Shift.find({ _id: { $in: shiftAssignments.map((item) => item.shiftId) }, status: { $nin: ['ARCHIVED', 'CANCELLED', 'COMPLETED'] } }).session(session || null).lean();
    const tripAssignments = await TripShiftAssignment.find({ driverId: { $in: drivers.map((item) => item._id) }, workDate: { $gte: weekStart, $lt: next }, status: { $in: ACTIVE } }).populate('tripId').session(session || null).lean();
    return { trip, date, drivers, shiftAssignments, shifts, tripAssignments };
  }

  static async evaluate(driver, context) {
    const { trip, date, shiftAssignments, shifts, tripAssignments } = context;
    const blockingReasons = [];
    const codes = [];
    if (driver.status !== 'ACTIVE' || ['EXPIRED', 'SUSPENDED'].includes(driver.driverLicense?.status)) { codes.push('DRIVER_NOT_AVAILABLE'); blockingReasons.push('Tài xế không ở trạng thái hoạt động hợp lệ.'); }
    if (approvedLeave(driver, date)) { codes.push('DRIVER_ON_LEAVE'); blockingReasons.push('Tài xế đang nghỉ phép trong ngày này.'); }
    const ownShiftIds = new Set(shiftAssignments.filter((item) => id(item.driverId) === id(driver)).map((item) => id(item.shiftId)));
    const coveringShift = shifts.find((item) => ownShiftIds.has(id(item)) && clock(item.startTime) <= clock(trip.departureTime) && clock(item.endTime) >= clock(trip.expectedArrivalTime));
    if (!coveringShift) { codes.push('DRIVER_OUTSIDE_SHIFT'); blockingReasons.push('Chuyến nằm ngoài ca làm của tài xế.'); }
    const own = tripAssignments.filter((item) => id(item.driverId) === id(driver) && item.tripId && id(item.tripId) !== id(trip));
    const sameDay = own.filter((item) => dayStart(item.workDate).getTime() === date.getTime());
    const conflict = sameDay.find((item) => overlap(trip, item.tripId));
    if (conflict) { codes.push('DRIVER_TRIP_OVERLAP'); blockingReasons.push(`Trùng chuyến ${conflict.tripId.scheduleCode} ${conflict.tripId.departureTime} - ${conflict.tripId.expectedArrivalTime}.`); }
    const previous = sameDay.filter((item) => clock(item.tripId.expectedArrivalTime) <= clock(trip.departureTime)).sort((a, b) => clock(b.tripId.expectedArrivalTime) - clock(a.tripId.expectedArrivalTime))[0]?.tripId;
    if (previous && !conflict) {
      const gap = clock(trip.departureTime) - clock(previous.expectedArrivalTime);
      const transfer = await TransferTimeService.estimateTransferMinutes(previous, trip);
      if (gap < rules.minimumTurnaroundMinutes) { codes.push('INSUFFICIENT_TURNAROUND'); blockingReasons.push(`Khoảng nghỉ giữa hai chuyến không đủ. Yêu cầu tối thiểu ${rules.minimumTurnaroundMinutes} phút.`); }
      else if (gap < rules.minimumTurnaroundMinutes + transfer) { codes.push('LOCATION_TRANSFER_CONFLICT'); blockingReasons.push('Không đủ thời gian di chuyển đến điểm xuất phát của chuyến tiếp theo.'); }
    }
    const dailyDriving = sameDay.reduce((sum, item) => sum + duration(item.tripId), 0);
    const weeklyDriving = own.reduce((sum, item) => sum + duration(item.tripId), 0);
    if (dailyDriving + duration(trip) > rules.maxDailyWorkingMinutes) { codes.push('DAILY_WORK_LIMIT_EXCEEDED'); blockingReasons.push('Tổng giờ lái trong ngày vượt giới hạn cho phép.'); }
    if (weeklyDriving + duration(trip) > rules.maxWeeklyWorkingMinutes) { codes.push('WEEKLY_WORK_LIMIT_EXCEEDED'); blockingReasons.push('Tổng giờ lái trong tuần vượt giới hạn cho phép.'); }
    let continuous = duration(trip);
    for (const item of sameDay.filter((entry) => clock(entry.tripId.expectedArrivalTime) <= clock(trip.departureTime)).sort((a, b) => clock(b.tripId.expectedArrivalTime) - clock(a.tripId.expectedArrivalTime))) {
      const gap = clock(trip.departureTime) - clock(item.tripId.expectedArrivalTime);
      if (gap >= rules.minimumBreakMinutes) break;
      continuous += duration(item.tripId);
    }
    if (continuous > rules.maxContinuousDrivingMinutes) { codes.push('CONTINUOUS_DRIVING_LIMIT_EXCEEDED'); blockingReasons.push(`Tài xế cần nghỉ tối thiểu ${rules.minimumBreakMinutes} phút trước khi nhận chuyến tiếp theo.`); }
    const sameRoute = previous && id(previous.routeId) === id(trip.routeId);
    const transfer = previous ? await TransferTimeService.estimateTransferMinutes(previous, trip) : null;
    const score = Math.max(0, Math.min(100, (sameRoute ? 40 : 0) + (transfer === 0 ? 30 : 0) + Math.round(20 * (1 - dailyDriving / rules.maxDailyWorkingMinutes)) + Math.round(10 * (1 - weeklyDriving / rules.maxWeeklyWorkingMinutes))));
    return { ...publicDriver(driver), available: blockingReasons.length === 0, recommendationScore: score, blockingCodes: codes, blockingReasons, shift: coveringShift ? { id: coveringShift._id, start: coveringShift.startTime, end: coveringShift.endTime } : null, todayWorkingMinutes: dailyDriving, weeklyWorkingMinutes: weeklyDriving, previousTrip: previous ? { id: previous._id, routeCode: previous.routeCode, endTime: previous.expectedArrivalTime } : null };
  }

  static async listForTrip(tripId, options = {}) {
    const context = await this.context(tripId, options);
    const drivers = [];
    for (const driver of context.drivers) drivers.push(await this.evaluate(driver, context));
    drivers.sort((a, b) => Number(b.available) - Number(a.available) || b.recommendationScore - a.recommendationScore);
    return { trip: { id: context.trip._id, routeCode: context.trip.routeCode, startTime: context.trip.departureTime, endTime: context.trip.expectedArrivalTime, serviceDate: context.trip.serviceDate }, drivers };
  }

  static async assertAvailable(tripId, driverId, options = {}) {
    const result = await this.listForTrip(tripId, options);
    const driver = result.drivers.find((item) => id(item.id) === id(driverId));
    if (!driver) throw domainError('DRIVER_NOT_AVAILABLE', 'Không tìm thấy tài xế.');
    if (!driver.available) throw domainError(driver.blockingCodes[0] || 'DRIVER_NOT_AVAILABLE', driver.blockingReasons[0] || 'Tài xế không đủ điều kiện nhận chuyến.', driver);
    return { trip: result.trip, driver };
  }
}
