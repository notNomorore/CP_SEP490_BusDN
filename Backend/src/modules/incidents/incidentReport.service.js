import mongoose from 'mongoose';
import { HTTP_STATUS, PAGINATION } from '../../constants/index.js';
import { CustomError } from '../../middleware/errorHandler.js';
import IncidentReport from './IncidentReport.js';
import OperationIncident from '../scheduleOperations/OperationIncident.js';
import OperationNotification from '../scheduleOperations/OperationNotification.js';
import TripSchedule from '../admin/TripSchedule.js';
import User from '../auth/User.js';

const toPositiveInteger = (value, fallback, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, max);
};

const endOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const buildFilter = (query) => {
  const filter = {};

  if (query.keyword) {
    const keyword = String(query.keyword).trim();
    filter.$or = [
      { title: { $regex: keyword, $options: 'i' } },
      { description: { $regex: keyword, $options: 'i' } },
      { location: { $regex: keyword, $options: 'i' } },
    ];
  }

  ['incidentType', 'severity', 'status'].forEach((field) => {
    if (query[field]) {
      filter[field] = query[field];
    }
  });

  ['routeId', 'vehicleId'].forEach((field) => {
    if (query[field]) {
      filter[field] = new mongoose.Types.ObjectId(query[field]);
    }
  });

  if (query.startDate || query.endDate) {
    filter.createdAt = {};
    if (query.startDate) {
      filter.createdAt.$gte = new Date(query.startDate);
    }
    if (query.endDate) {
      filter.createdAt.$lte = endOfDay(query.endDate);
    }
  }

  return filter;
};

const safeUser = (user) => {
  if (!user) {
    return null;
  }

  return {
    _id: user._id,
    fullName: user.fullName,
    role: user.role,
    avatar: user.avatar,
  };
};

const readRelatedDocument = async (collectionNames, id) => {
  if (!id || !mongoose.connection.db) {
    return null;
  }

  const names = Array.isArray(collectionNames) ? collectionNames : [collectionNames];
  for (const collectionName of names) {
    const collections = await mongoose.connection.db
      .listCollections({ name: collectionName })
      .toArray();
    if (!collections.length) {
      continue;
    }

    const document = await mongoose.connection.db.collection(collectionName).findOne({
      _id: new mongoose.Types.ObjectId(id),
    });
    if (document) {
      return document;
    }
  }

  return null;
};

const enrichRelatedInfo = async (incident) => {
  const [route, trip, vehicle] = await Promise.all([
    readRelatedDocument(['busroutes', 'routes'], incident.routeId),
    readRelatedDocument(['tripschedules', 'trips'], incident.tripId),
    readRelatedDocument(['fleetbuses', 'vehicles'], incident.vehicleId),
  ]);

  return {
    route: route
      ? {
          _id: route._id,
          name: route.routeName || route.name || route.routeNumber || route.code,
          routeNumber: route.routeCode || route.routeNumber || route.code || '',
        }
      : null,
    trip: trip
      ? {
          _id: trip._id,
          status: trip.status,
          scheduleCode: trip.scheduleCode || '',
          scheduledStart: trip.scheduledStart || trip.departureTime,
          actualStart: trip.actualStart || trip.startedAt,
        }
      : null,
    vehicle: vehicle
      ? {
          _id: vehicle._id,
          label: vehicle.plateNumber || vehicle.licensePlate || vehicle.busCode || vehicle.code || vehicle.name,
          status: vehicle.status,
        }
      : null,
  };
};

const logAudit = async ({ action, actorId, incidentId, metadata = {} }) => {
  try {
    const AuditLog = mongoose.models.AuditLog;
    if (!AuditLog) {
      return;
    }

    await AuditLog.create({
      action,
      actorId,
      entityType: 'IncidentReport',
      entityId: incidentId,
      metadata,
      createdAt: new Date(),
    });
  } catch {
    // Incident operations should not fail because optional audit logging failed.
  }
};

const buildSourceUpsert = (report) => ({
  updateOne: {
    filter: {
      sourceType: report.sourceType,
      sourceId: report.sourceId,
    },
    update: {
      $setOnInsert: report,
    },
    upsert: true,
  },
});

const operationIncidentSourceType = (type) => `OPERATION_${type}`;

const operationIncidentTitle = (incident) => {
  const label = {
    TRIP_REJECTION: 'Tài xế từ chối chuyến',
    VEHICLE_ISSUE: 'Báo lỗi xe trước chuyến',
    TRAFFIC_CONGESTION: 'Báo kẹt xe',
    ACCIDENT: 'Báo tai nạn',
    PASSENGER_VIOLATION: 'Báo hành khách vi phạm',
    PASSENGER_CONFLICT: 'Báo xung đột hành khách',
    FOUND_ITEM: 'Báo đồ tìm thấy',
  }[incident.type] || 'Báo cáo vận hành';
  return `${label} - ${incident.incidentCode}`;
};

const operationIncidentStatus = (status) => {
  if (status === 'RESOLVED') return 'RESOLVED';
  if (status === 'ACKNOWLEDGED') return 'IN_PROGRESS';
  if (status === 'CANCELLED') return 'REJECTED';
  return 'PENDING';
};

const incidentReportStatusToOperationStatus = (status) => {
  if (status === 'IN_PROGRESS') return 'ACKNOWLEDGED';
  if (status === 'RESOLVED') return 'RESOLVED';
  if (status === 'REJECTED') return 'CANCELLED';
  return 'OPEN';
};

const incidentStatusNotificationLabel = {
  PENDING: 'Chưa xử lý',
  IN_PROGRESS: 'Đang xử lý',
  RESOLVED: 'Đã xử lý',
  REJECTED: 'Đã đóng',
};

const incidentHandlingActionLabel = {
  TRIAGE_ONLY: 'Ghi nhận và theo dõi',
  DISPATCH_SUPPORT: 'Điều phối hỗ trợ hiện trường',
  REASSIGN_TRIP: 'Điều phối lại chuyến / nhân sự',
  SEND_MAINTENANCE: 'Gửi đội kỹ thuật/bảo trì',
  CONTACT_REPORTER: 'Liên hệ người báo cáo',
  NOTIFY_PASSENGERS: 'Thông báo hành khách bị ảnh hưởng',
  CALL_EMERGENCY_SERVICE: 'Liên hệ lực lượng khẩn cấp',
  MARK_INVALID: 'Đóng do báo cáo không hợp lệ',
};

const buildServiceDateRange = (value) => {
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) {
    return null;
  }
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const parseMinutes = (value) => {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
};

const timeRangesOverlap = (leftStart, leftEnd, rightStart, rightEnd) => {
  const aStart = parseMinutes(leftStart);
  const aEnd = parseMinutes(leftEnd);
  const bStart = parseMinutes(rightStart);
  const bEnd = parseMinutes(rightEnd);

  if ([aStart, aEnd, bStart, bEnd].some((value) => value === null)) {
    return true;
  }

  return aStart < bEnd && bStart < aEnd;
};

const buildAssignedAssistant = (assistant) => ({
  userId: assistant._id,
  fullName: assistant.fullName,
  role: assistant.role,
  phone: assistant.phoneNumber || assistant.phone || '',
});

const buildTripRouteLabel = (trip = {}) => (
  trip.routeName || trip.routeCode || trip.routeId?.routeName || trip.routeId?.name || 'Chưa có tuyến'
);

const buildTripVehicleLabel = (trip = {}) => {
  const vehicle = trip.vehicle || {};
  return [vehicle.plateNumber, vehicle.busCode].filter(Boolean).join(' - ') || 'Chưa có xe';
};

const operationIncidentDescription = (incident) => [
  `${incident.reporterRole === 'BUS_ASSISTANT' ? 'Phụ xe' : 'Tài xế'} gửi báo cáo trong lúc vận hành chuyến.`,
  `Loại sự cố: ${incident.type}.`,
  `Vị trí: ${incident.locationText || 'Chưa có vị trí mô tả.'}.`,
  incident.type === 'TRAFFIC_CONGESTION'
    ? `Ước tính trễ: ${incident.estimatedDelayMinutes || 0} phút.`
    : '',
  incident.type === 'TRAFFIC_CONGESTION' && incident.trafficCategory
    ? `Loại kẹt xe: ${incident.trafficCategory}.`
    : '',
  incident.type === 'TRAFFIC_CONGESTION' && incident.affectedDirection
    ? `Chiều ảnh hưởng: ${incident.affectedDirection}.`
    : '',
  incident.type === 'ACCIDENT'
    ? `Có người bị thương: ${incident.injuriesReported ? 'Có' : 'Không'}.`
    : '',
  incident.type === 'ACCIDENT'
    ? `Đã báo cơ quan chức năng: ${incident.policeNotified ? 'Có' : 'Không'}.`
    : '',
  incident.type === 'PASSENGER_VIOLATION'
    ? `Loại vi phạm: ${incident.passengerViolation?.violationCategory || 'OTHER'}.`
    : '',
  incident.type === 'PASSENGER_VIOLATION'
    ? `Mô tả hành khách: ${incident.passengerViolation?.passengerDescription || 'Chưa ghi nhận'}.`
    : '',
  incident.type === 'PASSENGER_VIOLATION'
    ? `Hành động đã xử lý: ${incident.passengerViolation?.actionTaken || 'Chưa ghi nhận'}.`
    : '',
  incident.type === 'PASSENGER_CONFLICT'
    ? `Nhóm xung đột: ${incident.passengerConflict?.conflictCategory || 'OTHER'}.`
    : '',
  incident.type === 'PASSENGER_CONFLICT'
    ? `Các bên liên quan: ${incident.passengerConflict?.partiesInvolved || 'Chưa ghi nhận'}.`
    : '',
  incident.type === 'PASSENGER_CONFLICT'
    ? `Hành động đã xử lý: ${incident.passengerConflict?.actionTaken || 'Chưa ghi nhận'}.`
    : '',
  incident.type === 'FOUND_ITEM'
    ? `Tên đồ vật: ${incident.foundItem?.itemName || 'Chưa ghi nhận'}.`
    : '',
  incident.type === 'FOUND_ITEM'
    ? `Vị trí tìm thấy: ${incident.foundItem?.foundLocation || incident.locationText || 'Chưa ghi nhận'}.`
    : '',
  incident.type === 'FOUND_ITEM' && incident.foundItem?.handedTo
    ? `Bàn giao cho: ${incident.foundItem.handedTo}.`
    : '',
  `Mô tả: ${incident.description || 'Không có mô tả.'}`,
].filter(Boolean).join('\n');

const createReporterStatusNotification = async ({
  incident,
  previousStatus,
  nextStatus,
  adminNote,
  handlingAction,
  resolutionSummary,
  actorId,
}) => {
  if (!incident?.reporterId || !['DRIVER', 'BUS_ASSISTANT'].includes(incident.reporterRole)) {
    return;
  }

  const nextStatusLabel = incidentStatusNotificationLabel[nextStatus] || nextStatus;
  const initialStatus = incident.statusHistory?.[0]?.fromStatus || previousStatus;
  const initialStatusLabel = incidentStatusNotificationLabel[initialStatus] || initialStatus || 'Mới';
  const actionLabel = incidentHandlingActionLabel[handlingAction] || handlingAction || 'Chưa ghi nhận';
  const details = [
    `Trạng thái: ${initialStatusLabel} → ${nextStatusLabel}.`,
    `Hành động xử lý: ${actionLabel}.`,
    adminNote ? `Ghi chú điều hành: ${adminNote}.` : '',
    resolutionSummary ? `Kết quả xử lý: ${resolutionSummary}.` : '',
  ].filter(Boolean);
  const notificationTitle = `Cập nhật báo cáo: ${incident.title}`;

  await OperationNotification.updateMany(
    {
      sourceType: { $in: ['', null] },
      title: notificationTitle,
      targetUsers: incident.reporterId,
      status: 'ACTIVE',
    },
    { $set: { status: 'ARCHIVED' } }
  );

  await OperationNotification.findOneAndUpdate(
    {
      sourceType: 'INCIDENT_REPORT_STATUS',
      sourceId: incident._id,
    },
    {
      $set: {
        title: notificationTitle,
        message: details.join('\n'),
        category: 'GENERAL',
        priority: 'NORMAL',
        targetRoles: [incident.reporterRole],
        targetUsers: [incident.reporterId],
        route: incident.routeId || null,
        trip: incident.tripId || null,
        vehicle: incident.vehicleId || null,
        activeFrom: new Date(),
        expiresAt: null,
        status: 'ACTIVE',
        createdBy: actorId || null,
        sourceType: 'INCIDENT_REPORT_STATUS',
        sourceId: incident._id,
        metadata: {
          notificationKind: 'INCIDENT_RESPONSE',
          incidentId: incident._id,
          incidentType: incident.incidentType,
          initialStatus,
          currentStatus: nextStatus,
          currentStatusLabel: nextStatusLabel,
          initialStatusLabel,
          handlingAction,
          handlingActionLabel: actionLabel,
          adminNote,
          resolutionSummary,
        },
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
};

export class IncidentReportService {
  static async syncOperationalSources() {
    const [operationIncidents] = await Promise.all([
      OperationIncident.find({
        type: { $in: ['TRIP_REJECTION', 'VEHICLE_ISSUE', 'TRAFFIC_CONGESTION', 'ACCIDENT', 'PASSENGER_VIOLATION', 'PASSENGER_CONFLICT', 'FOUND_ITEM'] },
        driver: { $ne: null },
      }).sort({ reportedAt: -1, updatedAt: -1 }).limit(300).lean(),
    ]);

    const operations = [
      ...operationIncidents.map((incident) => buildSourceUpsert({
        reporterId: incident.driver,
        reporterRole: incident.reporterRole || 'DRIVER',
        incidentType: incident.type,
        title: operationIncidentTitle(incident),
        description: operationIncidentDescription(incident),
        routeId: incident.route || null,
        tripId: incident.trip || null,
        vehicleId: incident.vehicle || null,
        location: incident.locationText || '',
        latitude: Number.isFinite(Number(incident.latitude)) ? Number(incident.latitude) : null,
        longitude: Number.isFinite(Number(incident.longitude)) ? Number(incident.longitude) : null,
        severity: incident.severity || 'MEDIUM',
        status: operationIncidentStatus(incident.status),
        attachments: (incident.evidenceFiles || []).map((file) => file.url).filter(Boolean),
        sourceModule: 'SCHEDULE_OPERATIONS',
        sourceType: operationIncidentSourceType(incident.type),
        sourceId: incident._id,
        createdAt: incident.reportedAt || incident.createdAt || new Date(),
      })),
    ];

    if (!operations.length) {
      return;
    }

    await IncidentReport.bulkWrite(operations, { ordered: false });
  }

  static async getIncidents(query) {
    await this.syncOperationalSources();

    const page = toPositiveInteger(query.page, PAGINATION.DEFAULT_PAGE);
    const limit = toPositiveInteger(query.limit, PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const filter = buildFilter(query);

    const [incidents, total, counts] = await Promise.all([
      IncidentReport.find(filter)
        .populate('reporterId', 'fullName role avatar')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      IncidentReport.countDocuments(filter),
      IncidentReport.aggregate([
        {
          $group: {
            _id: null,
            totalIncidents: { $sum: 1 },
            pendingCount: {
              $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] },
            },
            inProgressCount: {
              $sum: { $cond: [{ $eq: ['$status', 'IN_PROGRESS'] }, 1, 0] },
            },
            resolvedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] },
            },
            criticalCount: {
              $sum: { $cond: [{ $eq: ['$severity', 'CRITICAL'] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const relatedInfo = await Promise.all(incidents.map((incident) => enrichRelatedInfo(incident)));

    return {
      incidents: incidents.map((incident, index) => ({
        ...incident,
        reporter: safeUser(incident.reporterId),
        reporterId: incident.reporterId?._id || incident.reporterId,
        ...relatedInfo[index],
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      counts: counts[0] || {
        totalIncidents: 0,
        pendingCount: 0,
        inProgressCount: 0,
        resolvedCount: 0,
        criticalCount: 0,
      },
    };
  }

  static async getIncidentById(id, actor) {
    await this.syncOperationalSources();

    const incident = await IncidentReport.findById(id)
      .populate('reporterId', 'fullName role avatar')
      .populate('resolvedBy', 'fullName role avatar')
      .populate('statusHistory.changedBy', 'fullName role avatar')
      .lean();

    if (!incident) {
      throw new CustomError('Incident report not found', HTTP_STATUS.NOT_FOUND);
    }

    const related = await enrichRelatedInfo(incident);

    await logAudit({
      action: 'INCIDENT_DETAIL_VIEWED',
      actorId: actor?.userId,
      incidentId: incident._id,
    });

    return {
      ...incident,
      reporter: safeUser(incident.reporterId),
      reporterId: incident.reporterId?._id || incident.reporterId,
      resolvedBy: safeUser(incident.resolvedBy),
      statusHistory: (incident.statusHistory || []).map((entry) => ({
        ...entry,
        changedBy: safeUser(entry.changedBy),
      })),
      ...related,
    };
  }

  static async updateIncidentStatus(id, payload, actor) {
    const incident = await IncidentReport.findById(id);

    if (!incident) {
      throw new CustomError('Incident report not found', HTTP_STATUS.NOT_FOUND);
    }

    const previousStatus = incident.status;
    const adminNote = String(payload.adminNote || '').trim();
    const resolutionSummary = String(payload.resolutionSummary || '').trim();
    const handlingAction = payload.handlingAction || incident.handlingAction || 'TRIAGE_ONLY';
    const responsibleUnit = payload.responsibleUnit || incident.responsibleUnit || 'OPERATION_CENTER';

    incident.status = payload.status;
    incident.adminNote = adminNote || incident.adminNote;
    incident.resolutionSummary = resolutionSummary || incident.resolutionSummary;
    incident.handlingAction = handlingAction;
    incident.responsibleUnit = responsibleUnit;
    incident.statusHistory.push({
      fromStatus: previousStatus,
      toStatus: payload.status,
      adminNote,
      resolutionSummary,
      handlingAction,
      responsibleUnit,
      changedBy: actor.userId,
      changedAt: new Date(),
    });

    if (payload.status === 'RESOLVED') {
      incident.resolvedBy = actor.userId;
      incident.resolvedAt = new Date();
    } else {
      incident.resolvedBy = null;
      incident.resolvedAt = null;
    }

    await incident.save();

    if (incident.sourceModule === 'SCHEDULE_OPERATIONS' && incident.sourceId) {
      const operationStatus = incidentReportStatusToOperationStatus(payload.status);
      await OperationIncident.findByIdAndUpdate(incident.sourceId, {
        status: operationStatus,
        adminNote: incident.resolutionSummary || incident.adminNote,
        acknowledgedAt: ['ACKNOWLEDGED', 'RESOLVED', 'CANCELLED'].includes(operationStatus)
          ? new Date()
          : null,
        resolvedAt: ['RESOLVED', 'CANCELLED'].includes(operationStatus)
          ? new Date()
          : null,
      });
    }

    await createReporterStatusNotification({
      incident,
      previousStatus,
      nextStatus: payload.status,
      adminNote,
      handlingAction,
      resolutionSummary,
      actorId: actor?.userId,
    });

    await logAudit({
      action: 'INCIDENT_STATUS_UPDATED',
      actorId: actor?.userId,
      incidentId: incident._id,
      metadata: {
        fromStatus: previousStatus,
        toStatus: payload.status,
        handlingAction,
        responsibleUnit,
      },
    });

    return this.getIncidentById(id, actor);
  }

  static async reassignTripAssistant(id, payload, actor) {
    const assistantId = payload?.assistantId;
    const adminNote = String(payload?.adminNote || '').trim();

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(assistantId)) {
      throw new CustomError('Invalid incident or assistant id', HTTP_STATUS.BAD_REQUEST);
    }

    const incident = await IncidentReport.findById(id);
    if (!incident) {
      throw new CustomError('Incident report not found', HTTP_STATUS.NOT_FOUND);
    }

    if (incident.incidentType !== 'TRIP_REJECTION' || incident.reporterRole !== 'BUS_ASSISTANT') {
      throw new CustomError('Only bus assistant trip rejection reports can be reassigned here', HTTP_STATUS.BAD_REQUEST);
    }

    if (['RESOLVED', 'REJECTED'].includes(incident.status)) {
      throw new CustomError('Closed incident reports cannot be reassigned', HTTP_STATUS.CONFLICT);
    }

    if (!incident.tripId) {
      throw new CustomError('This incident is not linked to a trip schedule', HTTP_STATUS.BAD_REQUEST);
    }

    const [trip, assistant] = await Promise.all([
      TripSchedule.findById(incident.tripId),
      User.findOne({
        _id: assistantId,
        role: { $in: ['BUS_ASSISTANT', 'CONDUCTOR'] },
        status: 'ACTIVE',
      }).lean(),
    ]);

    if (!trip) {
      throw new CustomError('Linked trip schedule not found', HTTP_STATUS.NOT_FOUND);
    }

    if (!assistant) {
      throw new CustomError('Replacement bus assistant is not available', HTTP_STATUS.NOT_FOUND);
    }

    const currentAssistantId = trip.assistant?.userId;
    if (currentAssistantId && String(currentAssistantId) === String(assistant._id)) {
      throw new CustomError('Replacement assistant must be different from the rejected assistant', HTTP_STATUS.CONFLICT);
    }

    const dateRange = buildServiceDateRange(trip.serviceDate);
    const sameDayAssignments = await TripSchedule.find({
      _id: { $ne: trip._id },
      ...(dateRange ? { serviceDate: { $gte: dateRange.start, $lt: dateRange.end } } : { serviceDate: trip.serviceDate }),
      status: { $ne: 'CANCELLED' },
      'assistant.userId': assistant._id,
    }).select('scheduleCode routeName departureTime expectedArrivalTime').lean();

    const conflict = sameDayAssignments.find((schedule) => timeRangesOverlap(
      trip.departureTime,
      trip.expectedArrivalTime,
      schedule.departureTime,
      schedule.expectedArrivalTime
    ));

    if (conflict) {
      throw new CustomError(
        `Replacement assistant is already assigned to ${conflict.scheduleCode}`,
        HTTP_STATUS.CONFLICT
      );
    }

    const previousStatus = incident.status;
    const previousAssistant = trip.assistant;
    const nextAssistant = buildAssignedAssistant(assistant);
    const note = adminNote || `Đã phân công phụ xe thay thế: ${assistant.fullName}. Chờ phụ xe mới xác nhận chuyến.`;

    trip.assistant = nextAssistant;
    trip.assistantAcceptance = {
      status: 'PENDING',
      respondedAt: null,
      rejectionReason: '',
    };
    trip.status = trip.status === 'PLANNED' ? 'ASSIGNED' : trip.status;
    trip.updatedBy = actor?.userId || trip.updatedBy;
    trip.emergencyHistory.push({
      reason: note,
      changedBy: actor?.userId,
      previousVehicle: trip.vehicle,
      previousDriver: trip.driver,
      previousAssistant,
    });
    await trip.save();

    incident.status = 'IN_PROGRESS';
    incident.handlingAction = 'REASSIGN_TRIP';
    incident.responsibleUnit = 'OPERATION_CENTER';
    incident.adminNote = note;
    incident.resolutionSummary = '';
    incident.resolvedBy = null;
    incident.resolvedAt = null;
    incident.statusHistory.push({
      fromStatus: previousStatus,
      toStatus: 'IN_PROGRESS',
      adminNote: note,
      resolutionSummary: '',
      handlingAction: 'REASSIGN_TRIP',
      responsibleUnit: 'OPERATION_CENTER',
      changedBy: actor.userId,
      changedAt: new Date(),
    });
    await incident.save();

    if (incident.sourceModule === 'SCHEDULE_OPERATIONS' && incident.sourceId) {
      await OperationIncident.findByIdAndUpdate(incident.sourceId, {
        status: 'ACKNOWLEDGED',
        adminNote: note,
        acknowledgedAt: new Date(),
        resolvedAt: null,
      });
    }

    await createReporterStatusNotification({
      incident,
      previousStatus,
      nextStatus: 'IN_PROGRESS',
      adminNote: note,
      handlingAction: 'REASSIGN_TRIP',
      resolutionSummary: '',
      actorId: actor?.userId,
    });

    await OperationNotification.findOneAndUpdate(
      {
        sourceType: 'ASSISTANT_REASSIGNMENT',
        sourceId: incident._id,
      },
      {
        $set: {
          title: `Bạn được phân công chuyến ${trip.scheduleCode}`,
          message: [
            `Admin đã phân công bạn thay thế phụ xe cho chuyến ${trip.scheduleCode}.`,
            `Tuyến: ${buildTripRouteLabel(trip)}.`,
            `Xe: ${buildTripVehicleLabel(trip)}.`,
            'Vui lòng vào lịch vận hành để tiếp nhận hoặc từ chối chuyến.',
          ].join('\n'),
          category: 'SCHEDULE_CHANGE',
          priority: 'HIGH',
          targetRoles: ['BUS_ASSISTANT'],
          targetUsers: [assistant._id],
          route: trip.routeId || null,
          trip: trip._id,
          vehicle: trip.vehicle?.busId || null,
          activeFrom: new Date(),
          expiresAt: null,
          status: 'ACTIVE',
          createdBy: actor?.userId || null,
          sourceType: 'ASSISTANT_REASSIGNMENT',
          sourceId: incident._id,
          metadata: {
            notificationKind: 'ASSISTANT_REASSIGNMENT',
            incidentId: incident._id,
            tripId: trip._id,
            scheduleCode: trip.scheduleCode,
            previousAssistantId: previousAssistant?.userId || null,
            replacementAssistantId: assistant._id,
          },
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    await logAudit({
      action: 'INCIDENT_TRIP_ASSISTANT_REASSIGNED',
      actorId: actor?.userId,
      incidentId: incident._id,
      metadata: {
        tripId: trip._id,
        previousAssistantId: previousAssistant?.userId || null,
        replacementAssistantId: assistant._id,
      },
    });

    return this.getIncidentById(id, actor);
  }

  static async getOverviewStatistics() {
    await this.syncOperationalSources();

    const [
      totalIncidents,
      incidentsByType,
      incidentsBySeverity,
      incidentsByStatus,
      incidentsByRoute,
      incidentTrendByDate,
      resolutionSummary,
    ] = await Promise.all([
      IncidentReport.countDocuments(),
      IncidentReport.aggregate([
        { $group: { _id: '$incidentType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, incidentType: '$_id', count: 1 } },
      ]),
      IncidentReport.aggregate([
        { $group: { _id: '$severity', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, severity: '$_id', count: 1 } },
      ]),
      IncidentReport.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, status: '$_id', count: 1 } },
      ]),
      IncidentReport.aggregate([
        { $group: { _id: '$routeId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, routeId: '$_id', count: 1 } },
      ]),
      IncidentReport.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', count: 1 } },
      ]),
      IncidentReport.aggregate([
        {
          $match: {
            status: 'RESOLVED',
            resolvedAt: { $ne: null },
          },
        },
        {
          $group: {
            _id: null,
            averageMilliseconds: {
              $avg: { $subtract: ['$resolvedAt', '$createdAt'] },
            },
          },
        },
      ]),
    ]);

    return {
      totalIncidents,
      incidentsByType,
      incidentsBySeverity,
      incidentsByStatus,
      incidentsByRoute,
      incidentTrendByDate,
      averageResolutionTime: resolutionSummary[0]?.averageMilliseconds
        ? Number((resolutionSummary[0].averageMilliseconds / 3600000).toFixed(2))
        : 0,
    };
  }
}

export default IncidentReportService;

