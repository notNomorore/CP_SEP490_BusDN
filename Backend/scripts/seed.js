import mongoose from 'mongoose';

import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import User from '../src/modules/auth/User.js';
import FleetMonitoringService from '../src/modules/fleetMonitoring/fleetMonitoring.service.js';
import FleetBus from '../src/modules/admin/FleetBus.js';
import BusRoute from '../src/modules/admin/BusRoute.js';
import TripSchedule from '../src/modules/admin/TripSchedule.js';
import VehicleIssue from '../src/modules/vehicleIssues/VehicleIssue.js';
import MaintenanceTask from '../src/modules/vehicleIssues/MaintenanceTask.js';
import Notification from '../src/modules/systemNotifications/Notification.js';

const now = new Date();

const findAdmin = async () => {
  const admin = await User.findOne({ role: 'ADMIN', status: 'ACTIVE' }).lean();
  if (!admin) {
    throw new Error('No active ADMIN user found. Create or activate an admin account before seeding demo data.');
  }
  return admin;
};

const upsertStaff = async ({ email, phoneNumber, fullName, role }) => {
  const existing = await User.findOne({ email });
  if (existing) {
    existing.fullName = fullName;
    existing.phoneNumber = phoneNumber;
    existing.role = role;
    existing.status = 'ACTIVE';
    existing.isVerified = true;
    await existing.save();
    return existing;
  }

  return User.create({
    email,
    phoneNumber,
    fullName,
    role,
    password: 'Demo@123456',
    status: 'ACTIVE',
    isVerified: true,
  });
};

const upsertBusRoute = async (adminId) => BusRoute.findOneAndUpdate(
  { routeCode: 'DN-MAINT-01' },
  {
    $set: {
      routeCode: 'DN-MAINT-01',
      routeName: 'Da Nang Airport - Son Tra Demo',
      routeType: 'URBAN',
      operator: 'BusDN',
      status: 'PUBLISHED',
      routeColor: '#0f766e',
      description: 'Demo route for maintenance and replacement vehicle workflows.',
      outboundRoute: {
        startStation: {
          stopName: 'Da Nang International Airport',
          address: 'Duy Tan, Hai Chau, Da Nang',
          latitude: 16.0544,
          longitude: 108.2022,
          isMainStation: true,
        },
        endStation: {
          stopName: 'Son Tra Peninsula',
          address: 'Son Tra, Da Nang',
          latitude: 16.1066,
          longitude: 108.2639,
          isMainStation: true,
        },
        orderedStops: [
          {
            stopName: 'Da Nang International Airport',
            address: 'Duy Tan, Hai Chau, Da Nang',
            latitude: 16.0544,
            longitude: 108.2022,
            stopOrder: 1,
            arrivalOffsetMinutes: 0,
            departureOffsetMinutes: 0,
            isMainStation: true,
          },
          {
            stopName: 'Dragon Bridge',
            address: 'Hai Chau, Da Nang',
            latitude: 16.0612,
            longitude: 108.2271,
            stopOrder: 2,
            arrivalOffsetMinutes: 12,
            departureOffsetMinutes: 13,
          },
          {
            stopName: 'My Khe Beach',
            address: 'Vo Nguyen Giap, Da Nang',
            latitude: 16.0678,
            longitude: 108.2457,
            stopOrder: 3,
            arrivalOffsetMinutes: 24,
            departureOffsetMinutes: 25,
          },
          {
            stopName: 'Son Tra Peninsula',
            address: 'Son Tra, Da Nang',
            latitude: 16.1066,
            longitude: 108.2639,
            stopOrder: 4,
            arrivalOffsetMinutes: 42,
            departureOffsetMinutes: 42,
            isMainStation: true,
          },
        ],
        polylinePath: [
          { latitude: 16.0544, longitude: 108.2022 },
          { latitude: 16.0612, longitude: 108.2271 },
          { latitude: 16.0678, longitude: 108.2457 },
          { latitude: 16.1066, longitude: 108.2639 },
        ],
        estimatedDistanceKm: 14,
        estimatedDurationMinutes: 42,
      },
      scheduleConfig: {
        firstDepartureTime: '05:30',
        lastDepartureTime: '21:00',
        frequencyMinutes: 20,
        operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      },
      fareConfig: {
        baseFare: 8000,
        studentFare: 5000,
        childFare: 0,
        monthlyPassFare: 120000,
      },
      updatedBy: adminId,
    },
    $setOnInsert: {
      createdBy: adminId,
    },
  },
  { upsert: true, new: true }
);

const upsertFleetBuses = async () => {
  const buses = [
    ['DN-MAINT-01', '43B-91001', 'MAINTENANCE'],
    ['DN-MAINT-02', '43B-91002', 'RESERVE'],
    ['DN-MAINT-03', '43B-91003', 'ACTIVE'],
  ];

  return Promise.all(buses.map(([busCode, plateNumber, status], index) => FleetBus.findOneAndUpdate(
    { busCode },
    {
      $set: {
        busCode,
        plateNumber,
        busType: 'Standard City Bus',
        capacity: index === 1 ? 48 : 42,
        operator: 'BusDN',
        status,
        currentLatitude: 16.06 + (index * 0.01),
        currentLongitude: 108.22 + (index * 0.01),
        heading: 90 + (index * 20),
        lastTelemetryAt: new Date(now.getTime() - (index + 1) * 60000),
      },
    },
    { upsert: true, new: true }
  )));
};

const upsertTripSchedule = async ({ route, bus, driver, assistant, adminId }) => {
  const serviceDate = new Date();
  serviceDate.setHours(0, 0, 0, 0);

  return TripSchedule.findOneAndUpdate(
    { scheduleCode: 'DN-DEMO-MAINT-01' },
    {
      $set: {
        scheduleCode: 'DN-DEMO-MAINT-01',
        serviceDate,
        routeId: route._id,
        routeCode: route.routeCode,
        routeName: route.routeName,
        direction: 'OUTBOUND',
        departureTime: '08:20',
        expectedArrivalTime: '09:05',
        shiftLabel: 'Morning Demo',
        status: 'IN_PROGRESS',
        vehicle: {
          busId: bus._id,
          busCode: bus.busCode,
          plateNumber: bus.plateNumber,
          busType: bus.busType,
          capacity: bus.capacity,
        },
        driver: {
          userId: driver._id,
          fullName: driver.fullName,
          role: driver.role,
          phone: driver.phoneNumber,
        },
        assistant: {
          userId: assistant._id,
          fullName: assistant.fullName,
          role: assistant.role,
          phone: assistant.phoneNumber,
        },
        notes: 'Demo schedule for vehicle issue, maintenance approval, and replacement vehicle flows.',
        actualStartAt: new Date(now.getTime() - 35 * 60000),
        updatedBy: adminId,
      },
      $setOnInsert: {
        createdBy: adminId,
      },
    },
    { upsert: true, new: true }
  );
};

const upsertVehicleIssues = async ({ bus, schedule, driver, adminId }) => {
  const brakeIssue = await VehicleIssue.findOneAndUpdate(
    { inspectionId: null, vehicleId: bus._id, issueType: 'brake' },
    {
      $set: {
        vehicleId: bus._id,
        tripId: schedule._id,
        reportedBy: driver._id,
        reportedAt: new Date(now.getTime() - 50 * 60000),
        issueType: 'brake',
        severity: 'critical',
        description: 'Brake response feels weak during approach to Dragon Bridge.',
        photos: [],
        location: {
          text: 'Dragon Bridge, Da Nang',
          latitude: 16.0612,
          longitude: 108.2271,
        },
        status: 'maintenance_required',
        decision: 'create_maintenance_task',
        adminNote: 'Vehicle removed from service pending maintenance approval.',
        reviewedBy: adminId,
        reviewedAt: new Date(now.getTime() - 40 * 60000),
      },
    },
    { upsert: true, new: true }
  );

  const gpsIssue = await VehicleIssue.findOneAndUpdate(
    { vehicleId: bus._id, issueType: 'gps_device', description: 'GPS signal intermittently unavailable near Son Tra.' },
    {
      $set: {
        vehicleId: bus._id,
        tripId: schedule._id,
        reportedBy: driver._id,
        reportedAt: new Date(now.getTime() - 20 * 60000),
        issueType: 'gps_device',
        severity: 'medium',
        description: 'GPS signal intermittently unavailable near Son Tra.',
        photos: [],
        location: {
          text: 'Son Tra approach',
          latitude: 16.0901,
          longitude: 108.2505,
        },
        status: 'new',
      },
    },
    { upsert: true, new: true }
  );

  const task = await MaintenanceTask.findOneAndUpdate(
    { vehicleIssueId: brakeIssue._id },
    {
      $set: {
        vehicleIssueId: brakeIssue._id,
        vehicleId: bus._id,
        tripId: schedule._id,
        title: 'Inspect brake system on DN-MAINT-01',
        description: 'Workshop completed brake pad inspection and hydraulic pressure test.',
        priority: 'critical',
        status: 'completed',
        approvalStatus: 'pending_approval',
        createdBy: adminId,
        adminNote: 'Ready for admin safety approval.',
      },
    },
    { upsert: true, new: true }
  );

  brakeIssue.maintenanceTaskId = task._id;
  await brakeIssue.save();

  return { brakeIssue, gpsIssue, task };
};

const upsertFeedback = async ({ route, bus, driver }) => {
  const feedbacks = [
    {
      title: 'Route delay near My Khe',
      message: 'Bus arrived around 15 minutes late during the morning commute.',
      category: 'punctuality',
      rating: 2,
      routeId: route._id,
      routeName: route.routeName,
      driverId: driver._id,
      vehicleId: bus._id,
      busCode: bus.busCode,
      status: 'OPEN',
      createdAt: new Date(now.getTime() - 3 * 86400000),
    },
    {
      title: 'Helpful driver',
      message: 'Driver gave clear information during the service interruption.',
      category: 'driver_behavior',
      rating: 5,
      routeId: route._id,
      routeName: route.routeName,
      driverId: driver._id,
      vehicleId: bus._id,
      busCode: bus.busCode,
      status: 'RESOLVED',
      createdAt: new Date(now.getTime() - 2 * 86400000),
    },
    {
      title: 'Cleanliness complaint',
      message: 'Interior needed cleaning after the beach stop.',
      type: 'COMPLAINT',
      category: 'bus_cleanliness',
      rating: 2,
      routeId: route._id,
      routeName: route.routeName,
      driverId: driver._id,
      vehicleId: bus._id,
      busCode: bus.busCode,
      status: 'IN_PROGRESS',
      createdAt: new Date(now.getTime() - 1 * 86400000),
    },
  ];

  const collection = mongoose.connection.db.collection('feedbacks');
  for (const feedback of feedbacks) {
    await collection.updateOne(
      { title: feedback.title, routeId: feedback.routeId },
      { $set: feedback },
      { upsert: true }
    );
  }
};

const upsertNotification = async (adminId) => Notification.findOneAndUpdate(
  { title: 'Demo operations notice' },
  {
    $set: {
      title: 'Demo operations notice',
      message: 'Demo data is ready for BusDN operation center review.',
      type: 'general',
      priority: 'normal',
      targetAudience: 'admins',
      recipientUserIds: [adminId],
      status: 'sent',
      deliverySummary: {
        resolvedCount: 1,
        sentCount: 1,
        failedCount: 0,
        sentAt: now,
      },
      createdBy: adminId,
    },
  },
  { upsert: true, new: true }
);

const seed = async () => {
  await connectDatabase();

  const admin = await findAdmin();
  const driver = await upsertStaff({
    email: 'demo.ops.driver@busdn.local',
    phoneNumber: '0900000101',
    fullName: 'Demo Operations Driver',
    role: 'DRIVER',
  });
  const assistant = await upsertStaff({
    email: 'demo.assistant@busdn.local',
    phoneNumber: '0900000102',
    fullName: 'Demo Bus Assistant',
    role: 'BUS_ASSISTANT',
  });

  const fleetResult = await FleetMonitoringService.seedDemoFleet(admin);
  const route = await upsertBusRoute(admin._id);
  const [maintenanceBus, reserveBus] = await upsertFleetBuses();
  const schedule = await upsertTripSchedule({
    route,
    bus: maintenanceBus,
    driver,
    assistant,
    adminId: admin._id,
  });
  const issueResult = await upsertVehicleIssues({
    bus: maintenanceBus,
    schedule,
    driver,
    adminId: admin._id,
  });
  await upsertFeedback({ route, bus: maintenanceBus, driver });
  const notification = await upsertNotification(admin._id);

  return {
    fleetVehicles: fleetResult.vehiclesCreated,
    routeCode: route.routeCode,
    maintenanceBus: maintenanceBus.busCode,
    reserveBus: reserveBus.busCode,
    scheduleCode: schedule.scheduleCode,
    vehicleIssueIds: [issueResult.brakeIssue._id, issueResult.gpsIssue._id].map(String),
    maintenanceTaskId: String(issueResult.task._id),
    notificationId: String(notification._id),
  };
};

seed()
  .then((result) => {
    console.log(JSON.stringify({ success: true, result }, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
