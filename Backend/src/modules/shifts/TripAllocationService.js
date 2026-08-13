import mongoose from 'mongoose';
import TripSchedule from '../admin/TripSchedule.js';
import FleetBus from '../admin/FleetBus.js';
import User from '../auth/User.js';
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
  map.set(key, [...(map.get(key) || []), trip]);
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
const scoreCandidate = ({ assignment, shift, person, experienceCount, completedTrips }) => {
  const duration = Math.max(0, minutes(shift.endTime) - minutes(shift.startTime));
  const score = Math.min(100, 55 + Math.min(25, experienceCount * 5) + Math.min(10, completedTrips) + (duration <= 480 ? 10 : 0));
  return {
    assignmentId: assignment._id,
    shiftId: shift._id,
    shiftCode: shift.shiftCode,
    startTime: shift.startTime,
    endTime: shift.endTime,
    person: publicPerson(person),
    routeExperienceCount: experienceCount,
    completedTrips,
    assignedMinutes: duration,
    score,
    productivityLabel: completedTrips >= 20 ? 'Tích cực' : completedTrips >= 5 ? 'Ổn định' : 'Đang tích lũy kinh nghiệm',
  };
};

const statsMap = (rows) => new Map(rows.map((item) => [id(item._id), item.count]));

export default class TripAllocationService {
  static async preview({ routeId, workDate, shiftType }) {
    const date = dateOnly(workDate);
    if (!date || !mongoose.Types.ObjectId.isValid(routeId)) throw Object.assign(new Error('Tuyến và ngày phân bổ là bắt buộc.'), { statusCode: 400 });
    const tripFilter = { routeId, serviceDate: { $gte: date, $lt: nextDay(date) }, status: { $nin: ['CANCELLED', 'ARCHIVED'] } };
    if (shiftType === 'MORNING') tripFilter.departureTime = { $lt: '12:00' };
    if (shiftType === 'AFTERNOON') tripFilter.departureTime = { $gte: '12:00' };

    const [allTrips, shifts, driverHistoryRows, assistantHistoryRows, driverCompletedRows, assistantCompletedRows, existingTripAssignments, availableVehicles] = await Promise.all([
      TripSchedule.find(tripFilter).sort({ departureTime: 1 }).lean(),
      Shift.find({ routeId: { $in: [routeId, null] }, workDate: { $gte: date, $lt: nextDay(date) }, status: { $nin: ['ARCHIVED', 'CANCELLED'] }, ...(shiftType ? { shiftType } : {}) }).lean(),
      TripSchedule.aggregate([{ $match: { routeId: new mongoose.Types.ObjectId(routeId), status: 'COMPLETED', 'driver.userId': { $ne: null } } }, { $group: { _id: '$driver.userId', count: { $sum: 1 } } }]),
      TripSchedule.aggregate([{ $match: { routeId: new mongoose.Types.ObjectId(routeId), status: 'COMPLETED', 'assistant.userId': { $ne: null } } }, { $group: { _id: '$assistant.userId', count: { $sum: 1 } } }]),
      TripSchedule.aggregate([{ $match: { status: 'COMPLETED', 'driver.userId': { $ne: null } } }, { $group: { _id: '$driver.userId', count: { $sum: 1 } } }]),
      TripSchedule.aggregate([{ $match: { status: 'COMPLETED', 'assistant.userId': { $ne: null } } }, { $group: { _id: '$assistant.userId', count: { $sum: 1 } } }]),
      TripShiftAssignment.find({ workDate: { $gte: date, $lt: nextDay(date) }, status: { $in: ACTIVE } }).populate('tripId', 'departureTime expectedArrivalTime').lean(),
      FleetBus.find({ status: { $in: ['AVAILABLE', 'ACTIVE', 'RESERVE', 'ASSIGNED'] }, busCode: { $not: /^(DN-AUTO-|DN-DEMO-)/i } }).select('busCode plateNumber status busType capacity').lean(),
    ]);
    const trips = allTrips.filter((trip) => trip.status === 'PLANNED');

    const shiftById = new Map(shifts.map((shift) => [id(shift), shift]));
    const shiftIds = shifts.map((shift) => shift._id);
    const [driverAssignments, assistantAssignments] = await Promise.all([
      DriverShiftAssignment.find({ shiftId: { $in: shiftIds }, status: { $in: ACTIVE } }).populate('driverId', 'fullName phoneNumber role').lean(),
      AssistantShiftAssignment.find({ shiftId: { $in: shiftIds }, status: { $in: ACTIVE } }).populate('assistantId', 'fullName phoneNumber role').lean(),
    ]);
    const driverHistory = statsMap(driverHistoryRows);
    const assistantHistory = statsMap(assistantHistoryRows);
    const driverCompleted = statsMap(driverCompletedRows);
    const assistantCompleted = statsMap(assistantCompletedRows);

    const drivers = driverAssignments.map((assignment) => {
      const person = assignment.driverId;
      return scoreCandidate({ assignment, shift: shiftById.get(id(assignment.shiftId)), person, experienceCount: driverHistory.get(id(person)) || 0, completedTrips: driverCompleted.get(id(person)) || 0 });
    });
    const assistants = assistantAssignments.map((assignment) => {
      const person = assignment.assistantId;
      return scoreCandidate({ assignment, shift: shiftById.get(id(assignment.shiftId)), person, experienceCount: assistantHistory.get(id(person)) || 0, completedTrips: assistantCompleted.get(id(person)) || 0 });
    });

    const driverReservations = new Map();
    const assistantReservations = new Map();
    const vehicleReservations = new Map();
    const cycles = groupCycles(trips).map((cycle) => {
      const cycleRange = { start: minutes(cycle.startTime), end: minutes(cycle.endTime) };
      const available = (candidate, role) => minutes(candidate.startTime) <= cycleRange.start
        && minutes(candidate.endTime) >= cycleRange.end
        && !existingTripAssignments.some((item) => id(item[role]) === id(candidate.person) && item.tripId && overlaps(cycleRange, range(item.tripId)));
      const candidateDrivers = drivers.filter((item) => available(item, 'driverId')).sort((a, b) => b.score - a.score);
      const candidateAssistants = assistants.filter((item) => available(item, 'assistantId')).sort((a, b) => b.score - a.score);
      const recommendedDriver = candidateDrivers.find((item) => !(driverReservations.get(id(item.person)) || []).some((reserved) => overlaps(cycleRange, reserved)));
      const recommendedAssistant = candidateAssistants.find((item) => !(assistantReservations.get(id(item.person)) || []).some((reserved) => overlaps(cycleRange, reserved)));
      if (recommendedDriver) driverReservations.set(id(recommendedDriver.person), [...(driverReservations.get(id(recommendedDriver.person)) || []), cycleRange]);
      if (recommendedAssistant) assistantReservations.set(id(recommendedAssistant.person), [...(assistantReservations.get(id(recommendedAssistant.person)) || []), cycleRange]);
      const candidateVehicles = availableVehicles.filter((vehicle) => !existingTripAssignments.some((item) => id(item.vehicleId) === id(vehicle) && item.tripId && overlaps(cycleRange, range(item.tripId))));
      const recommendedVehicle = candidateVehicles.find((vehicle) => !(vehicleReservations.get(id(vehicle)) || []).some((reserved) => overlaps(cycleRange, reserved)));
      if (recommendedVehicle) vehicleReservations.set(id(recommendedVehicle), [...(vehicleReservations.get(id(recommendedVehicle)) || []), cycleRange]);
      return { ...cycle, tripIds: cycle.trips.map((trip) => trip._id), candidateDrivers, candidateAssistants, candidateVehicles, recommendedDriverAssignmentId: recommendedDriver?._id || recommendedDriver?.assignmentId || '', recommendedAssistantAssignmentId: recommendedAssistant?._id || recommendedAssistant?.assignmentId || '', recommendedVehicleId: recommendedVehicle?._id || '' };
    });
    const tripList = allTrips.map((trip) => {
      const missing = [];
      if (!trip.driver?.userId) missing.push('Tài xế');
      if (!trip.assistant?.userId) missing.push('Phụ xe');
      if (!trip.vehicle?.busId) missing.push('Xe');
      return { _id: trip._id, scheduleCode: trip.scheduleCode, direction: trip.direction, departureTime: trip.departureTime, expectedArrivalTime: trip.expectedArrivalTime, status: trip.status, operationCycleCode: trip.operationCycleCode, driverName: trip.driver?.fullName || '', assistantName: trip.assistant?.fullName || '', vehicleLabel: trip.vehicle?.busCode || trip.vehicle?.plateNumber || '', missing, assigned: missing.length === 0 && trip.status !== 'PLANNED' };
    });
    return { trips: tripList, cycles, summary: { totalTrips: allTrips.length, unassignedTrips: tripList.filter((trip) => !trip.assigned).length, totalCycles: cycles.length, availableDrivers: drivers.length, availableAssistants: assistants.length, unstaffedCycles: cycles.filter((cycle) => !cycle.candidateDrivers.length || !cycle.candidateAssistants.length).length } };
  }

  static async confirm({ rows, actorId }) {
    if (!Array.isArray(rows) || !rows.length) throw Object.assign(new Error('Chưa chọn vòng D–V để phân bổ.'), { statusCode: 400 });
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      let assignedTrips = 0;
      const submittedTripIds = new Set();
      const driverReservations = new Map();
      const assistantReservations = new Map();
      const vehicleReservations = new Map();
      for (const row of rows) {
        const tripIds = (row.tripIds || []).filter((value) => mongoose.Types.ObjectId.isValid(value));
        if (tripIds.some((tripId) => submittedTripIds.has(id(tripId)))) throw Object.assign(new Error('Một chuyến không thể được phân nhiều lần.'), { statusCode: 409 });
        tripIds.forEach((tripId) => submittedTripIds.add(id(tripId)));
        // MongoDB sessions do not support parallel operations inside one transaction.
        // Keep these reads sequential so the transaction counter cannot become out of sync.
        const driverAssignmentRecord = await DriverShiftAssignment.findOne({ _id: row.driverAssignmentId, status: { $in: ACTIVE } }).session(session).lean();
        const driver = driverAssignmentRecord ? await User.findById(driverAssignmentRecord.driverId).session(session).lean() : null;
        const driverShift = driverAssignmentRecord ? await Shift.findById(driverAssignmentRecord.shiftId).session(session).lean() : null;
        const driverAssignment = driverAssignmentRecord ? { ...driverAssignmentRecord, driverId: driver, shiftId: driverShift } : null;
        const assistantAssignmentRecord = await AssistantShiftAssignment.findOne({ _id: row.assistantAssignmentId, status: { $in: ACTIVE } }).session(session).lean();
        const assistant = assistantAssignmentRecord ? await User.findById(assistantAssignmentRecord.assistantId).session(session).lean() : null;
        const assistantShift = assistantAssignmentRecord ? await Shift.findById(assistantAssignmentRecord.shiftId).session(session).lean() : null;
        const assistantAssignment = assistantAssignmentRecord ? { ...assistantAssignmentRecord, assistantId: assistant, shiftId: assistantShift } : null;
        const trips = await TripSchedule.find({ _id: { $in: tripIds }, status: 'PLANNED' }).session(session).lean();
        const vehicle = await FleetBus.findOne({ _id: row.vehicleId, status: { $in: ['AVAILABLE', 'ACTIVE', 'RESERVE', 'ASSIGNED'] } }).session(session).lean();
        if (!driverAssignment?.driverId || !driverAssignment?.shiftId || !assistantAssignment?.assistantId || !assistantAssignment?.shiftId || trips.length !== 2 || !vehicle) throw Object.assign(new Error('Tài xế, phụ xe hoặc xe không còn đủ điều kiện.'), { statusCode: 409 });
        const start = Math.min(...trips.map((trip) => minutes(trip.departureTime)));
        const end = Math.max(...trips.map((trip) => minutes(trip.expectedArrivalTime)));
        const cycleRange = { start, end };
        for (const shift of [driverAssignment.shiftId, assistantAssignment.shiftId]) {
          if (minutes(shift.startTime) > start || minutes(shift.endTime) < end) throw Object.assign(new Error('Ca nhân sự không bao phủ toàn bộ vòng D–V.'), { statusCode: 409 });
        }
        const allocationDate = dateOnly(driverAssignment.workDate || trips[0]?.serviceDate);
        const conflicts = async (field, value) => (await TripShiftAssignment.find({
          [field]: value,
          workDate: { $gte: allocationDate, $lt: nextDay(allocationDate) },
          status: { $in: ACTIVE },
        }).populate('tripId', 'departureTime expectedArrivalTime').session(session).lean()).some((item) => item.tripId && overlaps(cycleRange, range(item.tripId)));
        if ((driverReservations.get(id(driverAssignment.driverId)) || []).some((item) => overlaps(cycleRange, item)) || await conflicts('driverId', driverAssignment.driverId)) throw Object.assign(new Error('Tài xế bị trùng chuyến.'), { statusCode: 409 });
        if ((assistantReservations.get(id(assistantAssignment.assistantId)) || []).some((item) => overlaps(cycleRange, item)) || await conflicts('assistantId', assistantAssignment.assistantId)) throw Object.assign(new Error('Phụ xe bị trùng chuyến.'), { statusCode: 409 });
        if ((vehicleReservations.get(id(vehicle)) || []).some((item) => overlaps(cycleRange, item)) || await conflicts('vehicleId', vehicle)) throw Object.assign(new Error('Xe bị trùng chuyến.'), { statusCode: 409 });
        driverReservations.set(id(driverAssignment.driverId), [...(driverReservations.get(id(driverAssignment.driverId)) || []), cycleRange]);
        assistantReservations.set(id(assistantAssignment.assistantId), [...(assistantReservations.get(id(assistantAssignment.assistantId)) || []), cycleRange]);
        vehicleReservations.set(id(vehicle), [...(vehicleReservations.get(id(vehicle)) || []), cycleRange]);
        for (const trip of trips) {
          await TripShiftAssignment.create([{ tripId: trip._id, shiftId: driverAssignment.shiftId._id, assistantShiftId: assistantAssignment.shiftId._id, driverId: driverAssignment.driverId._id, assistantId: assistantAssignment.assistantId._id, vehicleId: vehicle._id, workDate: driverAssignment.workDate, status: 'ASSIGNED', createdBy: actorId, updatedBy: actorId }], { session });
          await TripSchedule.findByIdAndUpdate(trip._id, { $set: { status: 'ASSIGNED', shiftLabel: driverAssignment.shiftId.shiftName, driver: { userId: driverAssignment.driverId._id, fullName: driverAssignment.driverId.fullName, role: driverAssignment.driverId.role, phone: driverAssignment.driverId.phoneNumber || '' }, assistant: { userId: assistantAssignment.assistantId._id, fullName: assistantAssignment.assistantId.fullName, role: assistantAssignment.assistantId.role, phone: assistantAssignment.assistantId.phoneNumber || '' }, vehicle: { busId: vehicle._id, busCode: vehicle.busCode, plateNumber: vehicle.plateNumber, busType: vehicle.busType, capacity: vehicle.capacity }, updatedBy: actorId } }, { session });
          assignedTrips += 1;
        }
      }
      await session.commitTransaction();
      return { assignedTrips };
    } catch (error) { if (session.inTransaction()) await session.abortTransaction(); throw error; }
    finally { await session.endSession(); }
  }
}
