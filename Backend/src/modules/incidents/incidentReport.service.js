import mongoose from 'mongoose';
import { HTTP_STATUS, PAGINATION } from '../../constants/index.js';
import { CustomError } from '../../middleware/errorHandler.js';
import IncidentReport from './IncidentReport.js';
import TripSchedule from '../admin/TripSchedule.js';
import VehicleInspection from '../scheduleOperations/VehicleInspection.js';
import OperationIncident from '../scheduleOperations/OperationIncident.js';

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

const routeLabel = (trip = {}) => trip.routeName || trip.routeCode || 'Unknown route';
const vehicleLabel = (trip = {}) => {
  const vehicle = trip.vehicle || {};
  return [vehicle.plateNumber, vehicle.busCode].filter(Boolean).join(' - ') || 'Unknown vehicle';
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
    TRAFFIC_CONGESTION: 'Báo kẹt xe',
    ACCIDENT: 'Báo tai nạn',
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

export class IncidentReportService {
  static async syncOperationalSources() {
    const [rejectedTrips, vehicleIssues, operationIncidents] = await Promise.all([
      TripSchedule.find({
        'driverAcceptance.status': 'REJECTED',
        'driver.userId': { $ne: null },
      }).sort({ updatedAt: -1 }).limit(200).lean(),
      VehicleInspection.find({
        status: 'ISSUE_REPORTED',
        driver: { $ne: null },
      }).sort({ reportedAt: -1, updatedAt: -1 }).limit(200).lean(),
      OperationIncident.find({
        type: { $in: ['TRAFFIC_CONGESTION', 'ACCIDENT', 'PASSENGER_CONFLICT', 'FOUND_ITEM'] },
        driver: { $ne: null },
      }).sort({ reportedAt: -1, updatedAt: -1 }).limit(300).lean(),
    ]);

    const operations = [
      ...rejectedTrips.map((trip) => buildSourceUpsert({
        reporterId: trip.driver.userId,
        reporterRole: 'DRIVER',
        incidentType: 'OTHER',
        title: `Tài xế từ chối chuyến ${trip.scheduleCode}`,
        description: [
          'Tài xế đã từ chối chuyến được phân công.',
          `Tuyến: ${routeLabel(trip)}.`,
          `Xe: ${vehicleLabel(trip)}.`,
          `Lý do: ${trip.driverAcceptance?.rejectionReason || 'Không có lý do.'}`,
        ].join('\n'),
        routeId: trip.routeId || null,
        tripId: trip._id,
        vehicleId: trip.vehicle?.busId || null,
        location: routeLabel(trip),
        severity: 'MEDIUM',
        status: 'PENDING',
        attachments: [],
        sourceModule: 'SCHEDULE_OPERATIONS',
        sourceType: 'TRIP_REJECTION',
        sourceId: trip._id,
        createdAt: trip.driverAcceptance?.respondedAt || trip.updatedAt || new Date(),
      })),
      ...vehicleIssues.map((inspection) => buildSourceUpsert({
        reporterId: inspection.driver,
        reporterRole: 'DRIVER',
        incidentType: 'VEHICLE_BREAKDOWN',
        title: `Báo lỗi xe trước chuyến ${inspection.inspectionCode}`,
        description: [
          'Tài xế báo lỗi xe trong bước kiểm tra trước khi xuất bến.',
          `Nhóm lỗi: ${inspection.issueCategory || 'OTHER'}.`,
          `Mô tả: ${inspection.issueDescription || 'Không có mô tả.'}`,
        ].join('\n'),
        routeId: null,
        tripId: inspection.trip || null,
        vehicleId: inspection.vehicle || null,
        location: 'Kiểm tra xe trước chuyến',
        severity: ['BRAKE', 'ENGINE'].includes(inspection.issueCategory) ? 'HIGH' : 'MEDIUM',
        status: 'PENDING',
        attachments: [],
        sourceModule: 'SCHEDULE_OPERATIONS',
        sourceType: 'VEHICLE_INSPECTION_ISSUE',
        sourceId: inspection._id,
        createdAt: inspection.reportedAt || inspection.updatedAt || new Date(),
      })),
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

    return {
      incidents: incidents.map((incident) => ({
        ...incident,
        reporter: safeUser(incident.reporterId),
        reporterId: incident.reporterId?._id || incident.reporterId,
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
    incident.status = payload.status;
    incident.adminNote = adminNote || incident.adminNote;
    incident.statusHistory.push({
      fromStatus: previousStatus,
      toStatus: payload.status,
      adminNote,
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

    await logAudit({
      action: 'INCIDENT_STATUS_UPDATED',
      actorId: actor?.userId,
      incidentId: incident._id,
      metadata: {
        fromStatus: previousStatus,
        toStatus: payload.status,
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

