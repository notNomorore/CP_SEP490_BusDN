import mongoose from 'mongoose';
import TripSchedule from '../admin/TripSchedule.js';
import FleetBus from '../admin/FleetBus.js';
import Shift from './Shift.js';
import DriverShiftAssignment from './DriverShiftAssignment.js';
import AssistantShiftAssignment from './AssistantShiftAssignment.js';
import TripShiftAssignment from './TripShiftAssignment.js';

const ACTIVE = ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];
const id = (value) => String(value?._id || value || '');
const dateOnly = (value) => { const date = new Date(value); if (Number.isNaN(date.getTime())) return null; date.setHours(0, 0, 0, 0); return date; };
const nextDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
const minutes = (value) => { const [hour, minute] = String(value || '').split(':').map(Number); return hour * 60 + minute; };
const range = (value) => ({ start: minutes(value.departureTime || value.startTime), end: minutes(value.expectedArrivalTime || value.endTime) });
const overlaps = (left, right) => left.start < right.end && right.start < left.end;

const groupCycles = (trips) => [...trips.reduce((map, trip) => {
  const key = String(trip.operationCycleCode || id(trip));
  const current = map.get(key) || [];
  current.push(trip);
  map.set(key, current);
  return map;
}, new Map()).entries()].map(([operationCycleCode, items]) => ({
  operationCycleCode,
  trips: items.sort((a, b) => a.departureTime.localeCompare(b.departureTime)),
  startTime: items.reduce((value, trip) => !value || trip.departureTime < value ? trip.departureTime : value, ''),
  endTime: items.reduce((value, trip) => trip.expectedArrivalTime > value ? trip.expectedArrivalTime : value, ''),
})).filter((cycle) => cycle.trips.length === 2
  && cycle.trips.some((trip) => trip.direction === 'OUTBOUND')
  && cycle.trips.some((trip) => trip.direction === 'INBOUND'));

const publicPerson = (person) => person ? { _id: person._id, fullName: person.fullName, phoneNumber: person.phoneNumber } : null;
const consecutiveDays = (assignments, driverId, date) => {
  const worked = new Set(assignments.filter((item) => id(item.driverId) === id(driverId)).map((item) => dateOnly(item.workDate)?.toISOString().slice(0, 10)));
  let count = 0;
  for (let cursor = new Date(date); count < 7; cursor.setDate(cursor.getDate() - 1)) {
    if (!worked.has(cursor.toISOString().slice(0, 10))) break;
    count += 1;
  }
  return count;
};

export default class TripAllocationService {
  static async preview({ routeId, workDate, shiftType }) {
    const date = dateOnly(workDate);
    if (!date || !mongoose.Types.ObjectId.isValid(routeId)) throw Object.assign(new Error('Tuyến và ngày phân bổ là bắt buộc.'), { statusCode: 400 });
    const tripFilter = { routeId, serviceDate: { $gte: date, $lt: nextDay(date) }, status: 'PLANNED' };
    if (shiftType === 'MORNING') tripFilter.departureTime = { $lt: '13:30' };
    if (shiftType === 'AFTERNOON') tripFilter.departureTime = { $gte: '13:30' };
    const recentStart = new Date(date); recentStart.setDate(recentStart.getDate() - 6);
    const [trips, shifts, history, completedStats, recentAssignments, existingTripAssignments, availableVehicles] = await Promise.all([
      TripSchedule.find(tripFilter).sort({ departureTime: 1 }).lean(),
      Shift.find({ routeId, workDate: { $gte: date, $lt: nextDay(date) }, status: { $nin: ['ARCHIVED', 'CANCELLED'] }, ...(shiftType ? { shiftType } : {}) }).lean(),
      TripSchedule.aggregate([{ $match: { routeId: new mongoose.Types.ObjectId(routeId), status: 'COMPLETED', 'driver.userId': { $ne: null } } }, { $group: { _id: '$driver.userId', routeTrips: { $sum: 1 } } }]),
      TripSchedule.aggregate([{ $match: { status: 'COMPLETED', 'driver.userId': { $ne: null } } }, { $group: { _id: '$driver.userId', completedTrips: { $sum: 1 } } }]),
      DriverShiftAssignment.find({ workDate: { $gte: recentStart, $lt: nextDay(date) }, status: { $in: ACTIVE } }).select('driverId workDate').lean(),
      TripShiftAssignment.find({ workDate: { $gte: date, $lt: nextDay(date) }, status: { $in: ACTIVE } }).populate('tripId', 'departureTime expectedArrivalTime').lean(),
      FleetBus.find({ status: { $in: ['AVAILABLE', 'ACTIVE', 'RESERVE', 'ASSIGNED'] }, busCode: { $not: /^(DN-AUTO-|DN-DEMO-)/i } }).select('busCode plateNumber status busType capacity').lean(),
    ]);
    const shiftIds = shifts.map((shift) => shift._id);
    const [drivers, assistants] = await Promise.all([
      DriverShiftAssignment.find({ shiftId: { $in: shiftIds }, status: { $in: ACTIVE } }).populate('driverId', 'fullName phoneNumber role').lean(),
      AssistantShiftAssignment.find({ shiftId: { $in: shiftIds }, status: { $in: ACTIVE } }).populate('assistantId', 'fullName phoneNumber role').lean(),
    ]);
    const experience = new Map(history.map((item) => [id(item._id), item.routeTrips]));
    const productivity = new Map(completedStats.map((item) => [id(item._id), item.completedTrips]));
    const teams = shifts.map((shift) => {
      const driver = drivers.find((item) => id(item.shiftId) === id(shift))?.driverId;
      const assistant = assistants.find((item) => id(item.shiftId) === id(shift))?.assistantId;
      const routeTrips = experience.get(id(driver)) || 0;
      const completedTrips = productivity.get(id(driver)) || 0;
      const consecutiveWorkingDays = consecutiveDays(recentAssignments, driver, date);
      const duration = Math.max(0, minutes(shift.endTime) - minutes(shift.startTime));
      const score = Math.max(0, Math.min(100, 55 + Math.min(25, routeTrips * 5) + Math.min(10, completedTrips) + (duration <= 480 ? 10 : 0) - Math.max(0, consecutiveWorkingDays - 5) * 8));
      const productivityLabel = completedTrips >= 20 && consecutiveWorkingDays <= 5 ? 'Tích cực' : completedTrips >= 5 ? 'Ổn định' : 'Đang tích lũy kinh nghiệm';
      return { shiftId: shift._id, shiftCode: shift.shiftCode, startTime: shift.startTime, endTime: shift.endTime, driver: publicPerson(driver), assistant: publicPerson(assistant), routeExperienceCount: routeTrips, completedTrips, consecutiveWorkingDays, productivityLabel, assignedMinutes: duration, score, eligible: Boolean(driver && assistant) };
    });
    const recommendedReservations = new Map();
    const cycles = groupCycles(trips).map((cycle) => {
      const cycleRange = { start: minutes(cycle.startTime), end: minutes(cycle.endTime) };
      const candidateTeams = teams.filter((team) => team.eligible
        && minutes(team.startTime) <= cycleRange.start && minutes(team.endTime) >= cycleRange.end
        && !existingTripAssignments.some((item) => id(item.shiftId) === id(team.shiftId) && item.tripId && overlaps(cycleRange, range(item.tripId))))
        .sort((left, right) => right.score - left.score);
      const recommended = candidateTeams.find((team) => !(recommendedReservations.get(id(team.shiftId)) || []).some((item) => overlaps(cycleRange, item)));
      if (recommended) recommendedReservations.set(id(recommended.shiftId), [...(recommendedReservations.get(id(recommended.shiftId)) || []), cycleRange]);
      const candidateVehicles = availableVehicles.filter((vehicle) => !existingTripAssignments.some((item) => id(item.vehicleId) === id(vehicle) && item.tripId && overlaps(cycleRange, range(item.tripId))));
      return { ...cycle, tripIds: cycle.trips.map((trip) => trip._id), candidateTeams, candidateVehicles, recommendedShiftId: recommended?.shiftId || '', recommendedVehicleId: candidateVehicles[0]?._id || '' };
    });
    return { cycles, summary: { totalTrips: trips.length, totalCycles: cycles.length, availableTeams: teams.filter((team) => team.eligible).length, unstaffedCycles: cycles.filter((cycle) => !cycle.candidateTeams.length).length } };
  }

  static async confirm({ rows, actorId }) {
    if (!Array.isArray(rows) || !rows.length) throw Object.assign(new Error('Chưa chọn vòng D-V để phân bổ.'), { statusCode: 400 });
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      let assignedTrips = 0;
      const submittedTripIds = new Set();
      const reservations = new Map();
      const vehicleReservations = new Map();
      for (const row of rows) {
        const tripIds = (row.tripIds || []).filter((value) => mongoose.Types.ObjectId.isValid(value));
        if (tripIds.some((tripId) => submittedTripIds.has(id(tripId)))) throw Object.assign(new Error('Một chuyến không thể được phân cho nhiều tổ.'), { statusCode: 409 });
        tripIds.forEach((tripId) => submittedTripIds.add(id(tripId)));
        const [shift, trips, driverAssignment, assistantAssignment, vehicle] = await Promise.all([
          Shift.findOne({ _id: row.shiftId, status: { $nin: ['ARCHIVED', 'CANCELLED'] } }).session(session).lean(),
          TripSchedule.find({ _id: { $in: tripIds }, status: 'PLANNED' }).session(session).lean(),
          DriverShiftAssignment.findOne({ shiftId: row.shiftId, status: { $in: ACTIVE } }).populate('driverId').session(session).lean(),
          AssistantShiftAssignment.findOne({ shiftId: row.shiftId, status: { $in: ACTIVE } }).populate('assistantId').session(session).lean(),
          FleetBus.findOne({ _id: row.vehicleId, status: { $in: ['AVAILABLE', 'ACTIVE', 'RESERVE', 'ASSIGNED'] } }).session(session).lean(),
        ]);
        if (!shift || trips.length !== 2 || !driverAssignment?.driverId || !assistantAssignment?.assistantId || !vehicle) throw Object.assign(new Error('Ca nhân sự hoặc xe không còn đủ điều kiện.'), { statusCode: 409 });
        const start = Math.min(...trips.map((trip) => minutes(trip.departureTime)));
        const end = Math.max(...trips.map((trip) => minutes(trip.expectedArrivalTime)));
        if (minutes(shift.startTime) > start || minutes(shift.endTime) < end) throw Object.assign(new Error('Chuyến nằm ngoài thời gian ca đã chọn.'), { statusCode: 409 });
        const cycleRange = { start, end };
        if ((reservations.get(id(shift)) || []).some((item) => overlaps(cycleRange, item))) throw Object.assign(new Error('Một tổ vận hành đang bị xếp hai vòng trùng thời gian.'), { statusCode: 409 });
        if ((vehicleReservations.get(id(vehicle)) || []).some((item) => overlaps(cycleRange, item))) throw Object.assign(new Error('Xe đã được chọn cho một vòng khác trùng thời gian.'), { statusCode: 409 });
        const existing = await TripShiftAssignment.find({ shiftId: shift._id, status: { $in: ACTIVE } }).populate('tripId', 'departureTime expectedArrivalTime').session(session).lean();
        if (existing.some((item) => item.tripId && overlaps(cycleRange, range(item.tripId)))) throw Object.assign(new Error('Tổ vận hành đã có chuyến khác trong thời gian này.'), { statusCode: 409 });
        const vehicleExisting = await TripShiftAssignment.find({ vehicleId: vehicle._id, status: { $in: ACTIVE } }).populate('tripId', 'departureTime expectedArrivalTime').session(session).lean();
        if (vehicleExisting.some((item) => item.tripId && overlaps(cycleRange, range(item.tripId)))) throw Object.assign(new Error('Xe đã được phân cho chuyến khác trong thời gian này.'), { statusCode: 409 });
        reservations.set(id(shift), [...(reservations.get(id(shift)) || []), cycleRange]);
        vehicleReservations.set(id(vehicle), [...(vehicleReservations.get(id(vehicle)) || []), cycleRange]);
        for (const trip of trips) {
          await TripShiftAssignment.create([{ tripId: trip._id, shiftId: shift._id, driverId: driverAssignment.driverId._id, vehicleId: vehicle._id, workDate: shift.workDate, status: 'ASSIGNED', createdBy: actorId, updatedBy: actorId }], { session });
          await TripSchedule.findByIdAndUpdate(trip._id, { $set: { status: 'ASSIGNED', shiftLabel: shift.shiftName, driver: { userId: driverAssignment.driverId._id, fullName: driverAssignment.driverId.fullName, role: driverAssignment.driverId.role, phone: driverAssignment.driverId.phoneNumber || '' }, assistant: { userId: assistantAssignment.assistantId._id, fullName: assistantAssignment.assistantId.fullName, role: assistantAssignment.assistantId.role, phone: assistantAssignment.assistantId.phoneNumber || '' }, vehicle: { busId: vehicle._id, busCode: vehicle.busCode, plateNumber: vehicle.plateNumber, busType: vehicle.busType, capacity: vehicle.capacity }, updatedBy: actorId } }, { session });
          assignedTrips += 1;
        }
      }
      await session.commitTransaction();
      return { assignedTrips };
    } catch (error) { await session.abortTransaction(); throw error; }
    finally { await session.endSession(); }
  }
}
