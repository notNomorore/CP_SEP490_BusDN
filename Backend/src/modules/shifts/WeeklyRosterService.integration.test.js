import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoDBContainer } from '@testcontainers/mongodb';
import User from '../auth/User.js';
import Route from '../routes/Route.js';
import FleetBus from '../admin/FleetBus.js';
import Roster from './Roster.js';
import Shift from './Shift.js';
import DriverShiftAssignment from './DriverShiftAssignment.js';
import AssistantShiftAssignment from './AssistantShiftAssignment.js';
import VehicleShiftAssignment from './VehicleShiftAssignment.js';
import WeeklyRosterService from './WeeklyRosterService.js';

const WEEK_START = '2026-08-10';
let container;

const seedValidRoster = async ({ published = false, invalid = false } = {}) => {
  const [driver, assistant, route, vehicle] = await Promise.all([
    User.create({ fullName: 'Driver Integration', email: 'driver.integration@danabus.test', password: 'Password123!', role: 'DRIVER', status: 'ACTIVE' }),
    User.create({ fullName: 'Assistant Integration', email: 'assistant.integration@danabus.test', password: 'Password123!', role: 'BUS_ASSISTANT', status: 'ACTIVE' }),
    Route.create({ routeCode: 'R-INT', routeName: 'Integration Route', status: 'PUBLISHED' }),
    FleetBus.create({ busCode: 'BUS-INT', plateNumber: '43B-12345', busType: 'Standard City Bus', capacity: 20, status: 'AVAILABLE' }),
  ]);
  const roster = await Roster.create({ weekStartDate: new Date(`${WEEK_START}T00:00:00`), weekEndDate: new Date('2026-08-16T00:00:00'), status: published ? 'PUBLISHED' : 'DRAFT' });
  const shift = await Shift.create({ shiftCode: 'INT-20260810-M-001', shiftName: 'Integration Morning', workDate: new Date(`${WEEK_START}T00:00:00`), routeId: route._id, rosterId: roster._id, startTime: '05:30', endTime: '12:00', shiftType: 'MORNING', requiresAssistant: true, status: published ? 'PUBLISHED' : 'DRAFT', approvalStatus: published ? 'PUBLISHED' : 'DRAFT', isLocked: published });
  const rosterStatus = published ? 'PUBLISHED' : 'DRAFT';
  await DriverShiftAssignment.create({ driverId: driver._id, shiftId: shift._id, workDate: shift.workDate, status: 'ASSIGNED', rosterStatus });
  if (!invalid) await AssistantShiftAssignment.create({ assistantId: assistant._id, shiftId: shift._id, workDate: shift.workDate, status: 'ASSIGNED', rosterStatus });
  await VehicleShiftAssignment.create({ vehicleId: vehicle._id, shiftId: shift._id, workDate: shift.workDate, status: 'ASSIGNED', rosterStatus });
  return { roster, shift };
};

describe.skipIf(process.env.RUN_TESTCONTAINERS !== 'true').sequential('WeeklyRosterService MongoDB transactions', () => {
  beforeAll(async () => {
    container = await new MongoDBContainer('mongo:7.0').start();
    await mongoose.connect(`${container.getConnectionString()}/danabus_roster_test?replicaSet=rs0`);
  }, 180000);

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await container?.stop();
  }, 60000);

  it('publishes roster, shifts and assignment roster states atomically', async () => {
    const { roster, shift } = await seedValidRoster();
    await WeeklyRosterService.publish({ weekStartDate: WEEK_START });
    expect((await Roster.findById(roster._id)).status).toBe('PUBLISHED');
    expect((await Shift.findById(shift._id)).status).toBe('PUBLISHED');
    expect((await DriverShiftAssignment.findOne({ shiftId: shift._id })).rosterStatus).toBe('PUBLISHED');
    expect((await AssistantShiftAssignment.findOne({ shiftId: shift._id })).rosterStatus).toBe('PUBLISHED');
    expect((await VehicleShiftAssignment.findOne({ shiftId: shift._id })).rosterStatus).toBe('PUBLISHED');
  });

  it('rolls publish back when assignment update phase fails', async () => {
    const { roster, shift } = await seedValidRoster();
    await expect(WeeklyRosterService.publish({ weekStartDate: WEEK_START, transactionHook: async () => { throw new Error('Injected publish failure'); } })).rejects.toThrow('Injected publish failure');
    expect((await Roster.findById(roster._id)).status).toBe('DRAFT');
    expect((await Shift.findById(shift._id)).status).toBe('DRAFT');
    expect((await DriverShiftAssignment.findOne({ shiftId: shift._id })).rosterStatus).toBe('DRAFT');
  });

  it('does not mutate any document when validation has an error', async () => {
    const { roster, shift } = await seedValidRoster({ invalid: true });
    const beforeRoster = (await Roster.findById(roster._id)).toObject();
    await expect(WeeklyRosterService.publish({ weekStartDate: WEEK_START })).rejects.toMatchObject({ statusCode: 409 });
    const afterRoster = (await Roster.findById(roster._id)).toObject();
    expect(afterRoster.status).toBe(beforeRoster.status);
    expect(afterRoster.updatedAt.getTime()).toBe(beforeRoster.updatedAt.getTime());
    expect((await Shift.findById(shift._id)).status).toBe('DRAFT');
  });

  it('reopens roster, shifts and assignment roster states atomically', async () => {
    const { roster, shift } = await seedValidRoster({ published: true });
    await WeeklyRosterService.reopen({ weekStartDate: WEEK_START });
    expect((await Roster.findById(roster._id)).status).toBe('DRAFT');
    expect((await Shift.findById(shift._id)).status).toBe('ACTIVE');
    expect((await DriverShiftAssignment.findOne({ shiftId: shift._id })).rosterStatus).toBe('DRAFT');
    expect((await AssistantShiftAssignment.findOne({ shiftId: shift._id })).rosterStatus).toBe('DRAFT');
    expect((await VehicleShiftAssignment.findOne({ shiftId: shift._id })).rosterStatus).toBe('DRAFT');
  });

  it('rolls reopen back when assignment update phase fails', async () => {
    const { roster, shift } = await seedValidRoster({ published: true });
    await expect(WeeklyRosterService.reopen({ weekStartDate: WEEK_START, transactionHook: async () => { throw new Error('Injected reopen failure'); } })).rejects.toThrow('Injected reopen failure');
    expect((await Roster.findById(roster._id)).status).toBe('PUBLISHED');
    expect((await Shift.findById(shift._id)).status).toBe('PUBLISHED');
    expect((await DriverShiftAssignment.findOne({ shiftId: shift._id })).rosterStatus).toBe('PUBLISHED');
  });
});
