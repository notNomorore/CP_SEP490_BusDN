import { config } from '../../config/environment.js';
import User from '../auth/User.js';
import Route from '../routes/Route.js';
import RouteService from '../routes/RouteService.js';
import ShiftAssignment from './ShiftAssignment.js';
import Trip from './Trip.js';
import Vehicle from './Vehicle.js';

const startOfDay = (date = new Date()) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const endOfDay = (date = new Date()) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const addDays = (date, days) => {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
};

const withTime = (date, hours, minutes) => {
  const value = startOfDay(date);
  value.setHours(hours, minutes, 0, 0);
  return value;
};

const getDateKey = (date) => {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDate = (value, fallback) => {
  if (!value) return fallback;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

export class ScheduleOperationsService {
  static buildActorQuery(userId) {
    return {
      $or: [
        { driver: userId },
        { busAssistant: userId },
      ],
    };
  }

  static async ensureDevelopmentAssignments(userId, role) {
    if (config.nodeEnv !== 'development') {
      return;
    }

    await RouteService.ensureSampleRoutes();

    const [primaryRoute, secondaryRoute] = await Promise.all([
      Route.findOne({ routeNumber: 'DN01' }),
      Route.findOne({ routeNumber: 'DN02' }),
    ]);

    if (!primaryRoute || !secondaryRoute) {
      return;
    }

    const today = startOfDay();
    const tomorrow = addDays(today, 1);
    const todayKey = getDateKey(today);
    const tomorrowKey = getDateKey(tomorrow);
    const roleField = role === 'BUS_ASSISTANT' ? 'busAssistant' : 'driver';
    const fallbackDriver = role === 'DRIVER'
      ? userId
      : (await User.findOne({ role: 'DRIVER', status: 'ACTIVE' }).select('_id'))?._id;

    if (!fallbackDriver) {
      return;
    }

    const vehicles = await Promise.all([
      Vehicle.findOneAndUpdate(
        { code: 'BUS-DN-01' },
        {
          $setOnInsert: {
            code: 'BUS-DN-01',
            plateNumber: '43B-012.34',
            model: 'THACO City Bus',
            capacity: 40,
            status: 'ASSIGNED',
          },
        },
        { upsert: true, new: true }
      ),
      Vehicle.findOneAndUpdate(
        { code: 'BUS-DN-02' },
        {
          $setOnInsert: {
            code: 'BUS-DN-02',
            plateNumber: '43B-056.78',
            model: 'SAMCO Bus',
            capacity: 45,
            status: 'ASSIGNED',
          },
        },
        { upsert: true, new: true }
      ),
    ]);

    const tripPayloads = [
      {
        tripCode: `TRIP-${userId}-${todayKey}-01`,
        route: primaryRoute._id,
        vehicle: vehicles[0]._id,
        scheduledStart: withTime(today, 7, 0),
        scheduledEnd: withTime(today, 8, 0),
        status: 'SCHEDULED',
      },
      {
        tripCode: `TRIP-${userId}-${tomorrowKey}-02`,
        route: secondaryRoute._id,
        vehicle: vehicles[1]._id,
        scheduledStart: withTime(tomorrow, 13, 30),
        scheduledEnd: withTime(tomorrow, 14, 45),
        status: 'SCHEDULED',
      },
    ];

    const trips = await Promise.all(tripPayloads.map((trip) => (
      Trip.findOneAndUpdate(
        { tripCode: trip.tripCode },
        { $setOnInsert: trip },
        { upsert: true, new: true }
      )
    )));

    const assignments = [
      {
        shiftCode: `SHIFT-${userId}-${todayKey}-A`,
        tripCode: trips[0].tripCode,
        trip: trips[0]._id,
        driver: fallbackDriver,
        [roleField]: userId,
        shiftStatus: 'ASSIGNED',
        notes: 'Co mat tai diem tap ket truoc gio khoi hanh 15 phut.',
      },
      {
        shiftCode: `SHIFT-${userId}-${tomorrowKey}-B`,
        tripCode: trips[1].tripCode,
        trip: trips[1]._id,
        driver: fallbackDriver,
        [roleField]: userId,
        shiftStatus: 'ASSIGNED',
        notes: 'Kiem tra thong tin tuyen va phuong tien truoc khi nhan ca.',
      },
    ];

    await Promise.all(assignments.map((assignment) => (
      ShiftAssignment.updateOne(
        { shiftCode: assignment.shiftCode },
        { $set: assignment },
        { upsert: true }
      )
    )));
  }

  static async listAssignedTrips(userId, role, query = {}) {
    await this.ensureDevelopmentAssignments(userId, role);

    const from = startOfDay(parseDate(query.from, new Date()));
    const to = endOfDay(parseDate(query.to, addDays(from, 7)));

    const trips = await Trip.find({
      scheduledStart: { $gte: from, $lte: to },
      status: { $ne: 'CANCELLED' },
    }).select('_id');

    const assignments = await ShiftAssignment.find({
      ...this.buildActorQuery(userId),
      trip: { $in: trips.map((trip) => trip._id) },
    })
      .populate({
        path: 'trip',
        populate: [
          { path: 'route' },
          { path: 'vehicle' },
        ],
      })
      .populate('driver', 'fullName phoneNumber role')
      .populate('busAssistant', 'fullName phoneNumber role');

    return assignments.sort((left, right) => (
      new Date(left.trip.scheduledStart) - new Date(right.trip.scheduledStart)
    ));
  }

  static async listShiftSchedule(userId, role, query = {}) {
    await this.ensureDevelopmentAssignments(userId, role);

    const from = startOfDay(parseDate(query.from, new Date()));
    const to = endOfDay(parseDate(query.to, addDays(from, 13)));

    const trips = await Trip.find({
      scheduledStart: { $gte: from, $lte: to },
    }).select('_id');

    const assignments = await ShiftAssignment.find({
      ...this.buildActorQuery(userId),
      trip: { $in: trips.map((trip) => trip._id) },
    })
      .populate({
        path: 'trip',
        populate: [
          { path: 'route' },
          { path: 'vehicle' },
        ],
      })
      .populate('driver', 'fullName phoneNumber role')
      .populate('busAssistant', 'fullName phoneNumber role');

    return assignments.sort((left, right) => (
      new Date(left.trip.scheduledStart) - new Date(right.trip.scheduledStart)
    ));
  }
}

export default ScheduleOperationsService;
