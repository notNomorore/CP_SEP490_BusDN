import mongoose from 'mongoose';
import { HTTP_STATUS, PAGINATION } from '../../constants/index.js';
import { CustomError } from '../../middleware/errorHandler.js';
import IncidentReport from './IncidentReport.js';

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

const readRelatedDocument = async (collectionName, id) => {
  if (!id || !mongoose.connection.db) {
    return null;
  }

  const collections = await mongoose.connection.db
    .listCollections({ name: collectionName })
    .toArray();
  if (!collections.length) {
    return null;
  }

  return mongoose.connection.db.collection(collectionName).findOne({
    _id: new mongoose.Types.ObjectId(id),
  });
};

const enrichRelatedInfo = async (incident) => {
  const [route, trip, vehicle] = await Promise.all([
    readRelatedDocument('routes', incident.routeId),
    readRelatedDocument('trips', incident.tripId),
    readRelatedDocument('vehicles', incident.vehicleId),
  ]);

  return {
    route: route
      ? {
          _id: route._id,
          name: route.name || route.routeName || route.routeNumber || route.code,
          routeNumber: route.routeNumber || route.code || '',
        }
      : null,
    trip: trip
      ? {
          _id: trip._id,
          status: trip.status,
          scheduledStart: trip.scheduledStart || trip.departureTime,
          actualStart: trip.actualStart || trip.startedAt,
        }
      : null,
    vehicle: vehicle
      ? {
          _id: vehicle._id,
          label: vehicle.licensePlate || vehicle.code || vehicle.name,
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

export class IncidentReportService {
  static async getIncidents(query) {
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
