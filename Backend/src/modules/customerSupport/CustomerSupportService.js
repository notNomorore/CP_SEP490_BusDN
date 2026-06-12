import SupportCase from './SupportCase.js';
import OperationIncident from '../scheduleOperations/OperationIncident.js';

export class CustomerSupportService {
  static buildCaseQuery({ type, status, priority }) {
    const query = { type: 'COMPLAINT' };

    if (type === 'COMPLAINT') {
      query.type = type;
    }

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (priority && priority !== 'ALL') {
      query.priority = priority;
    }

    return query;
  }

  static async createCase(userId, data) {
    const supportCase = new SupportCase({
      type: 'COMPLAINT',
      passenger: userId,
      title: data.title.trim(),
      description: data.description.trim(),
      category: data.category || 'OTHER',
      priority: data.priority || 'NORMAL',
      routeName: data.routeName?.trim(),
      tripCode: data.tripCode?.trim(),
      busPlate: data.busPlate?.trim(),
      incidentAt: data.incidentAt ? new Date(data.incidentAt) : undefined,
      contactPhone: data.contactPhone?.trim(),
      contactEmail: data.contactEmail?.trim(),
    });

    await supportCase.save();
    return supportCase.populate('passenger', 'fullName email phone');
  }

  static async listCases({ type = 'ALL', status = 'OPEN', priority = 'ALL', page = 1, limit = 20 }) {
    const normalizedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
    const normalizedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
    const query = this.buildCaseQuery({ type, status, priority });

    const [items, total] = await Promise.all([
      SupportCase.find(query)
        .populate('passenger', 'fullName email phone')
        .sort({ priority: -1, createdAt: -1 })
        .skip((normalizedPage - 1) * normalizedLimit)
        .limit(normalizedLimit),
      SupportCase.countDocuments(query),
    ]);

    return {
      items,
      meta: {
        page: normalizedPage,
        limit: normalizedLimit,
        total,
        totalPages: Math.ceil(total / normalizedLimit),
      },
    };
  }

  static async getCaseById(caseId) {
    const supportCase = await SupportCase.findById(caseId)
      .populate('passenger', 'fullName email phone')
      .populate('responses.responder', 'fullName email role');

    if (!supportCase) {
      throw new Error('Support case not found');
    }

    return supportCase;
  }

  static async respondToComplaint(caseId, adminId, data) {
    const supportCase = await this.getCaseById(caseId);

    if (supportCase.type !== 'COMPLAINT') {
      throw new Error('Only complaint cases can be responded through this action');
    }

    if (supportCase.status === 'CLOSED') {
      throw new Error('Closed complaint cases cannot be responded again');
    }

    const statusBefore = supportCase.status;
    const statusAfter = data.status || 'IN_PROGRESS';

    supportCase.responses.push({
      message: data.message.trim(),
      responder: adminId,
      statusBefore,
      statusAfter,
      responseType: 'COMPLAINT_RESPONSE',
      visibleToPassenger: true,
      createdAt: new Date(),
    });
    supportCase.status = statusAfter;
    supportCase.assignedTo = supportCase.assignedTo || adminId;

    if (supportCase.status === 'RESOLVED') {
      supportCase.resolvedAt = new Date();
    }

    if (supportCase.status === 'CLOSED') {
      supportCase.closedAt = new Date();
    }

    await supportCase.save();
    return this.getCaseById(caseId);
  }

  static buildFoundItemQuery({ status, recoveryStatus }) {
    const query = { type: 'FOUND_ITEM' };

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (recoveryStatus && recoveryStatus !== 'ALL') {
      query['foundItem.recoveryStatus'] = recoveryStatus;
    }

    return query;
  }

  static async listFoundItemCases({ status = 'ALL', recoveryStatus = 'ALL', page = 1, limit = 20 }) {
    const normalizedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
    const normalizedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
    const query = this.buildFoundItemQuery({ status, recoveryStatus });

    const [items, total] = await Promise.all([
      OperationIncident.find(query)
        .populate('driver', 'fullName email phone phoneNumber role')
        .populate('route', 'routeNumber routeName name')
        .populate('vehicle', 'busCode plateNumber')
        .populate('trip', 'scheduleCode routeName serviceDate departureTime')
        .sort({ reportedAt: -1, createdAt: -1 })
        .skip((normalizedPage - 1) * normalizedLimit)
        .limit(normalizedLimit),
      OperationIncident.countDocuments(query),
    ]);

    return {
      items,
      meta: {
        page: normalizedPage,
        limit: normalizedLimit,
        total,
        totalPages: Math.ceil(total / normalizedLimit),
      },
    };
  }

  static async getFoundItemCaseById(caseId) {
    const incident = await OperationIncident.findOne({ _id: caseId, type: 'FOUND_ITEM' })
      .populate('driver', 'fullName email phone phoneNumber role')
      .populate('route', 'routeNumber routeName name')
      .populate('vehicle', 'busCode plateNumber')
      .populate('trip', 'scheduleCode routeName serviceDate departureTime');

    if (!incident) {
      throw new Error('Found item case not found');
    }

    return incident;
  }

  static mapFoundItemRecoveryStatus(recoveryStatus) {
    if (recoveryStatus === 'STORED') return 'ACKNOWLEDGED';
    if (recoveryStatus === 'RETURNED') return 'RESOLVED';
    if (recoveryStatus === 'CANCELLED') return 'CANCELLED';
    return 'OPEN';
  }

  static async updateFoundItemCase(caseId, adminId, data) {
    const incident = await this.getFoundItemCaseById(caseId);
    const recoveryStatus = data.recoveryStatus || incident.foundItem?.recoveryStatus || 'REPORTED';
    const status = this.mapFoundItemRecoveryStatus(recoveryStatus);
    const now = new Date();

    incident.foundItem = {
      ...(incident.foundItem || {}),
      recoveryStatus,
      handedTo: data.handedTo !== undefined
        ? String(data.handedTo || '').trim()
        : incident.foundItem?.handedTo || '',
    };
    incident.status = status;
    incident.adminNote = data.adminNote !== undefined
      ? String(data.adminNote || '').trim()
      : incident.adminNote || '';

    if (status === 'ACKNOWLEDGED' && !incident.acknowledgedAt) {
      incident.acknowledgedAt = now;
    }

    if (status === 'RESOLVED') {
      incident.resolvedAt = now;
    }

    if (status === 'OPEN') {
      incident.acknowledgedAt = null;
      incident.resolvedAt = null;
    }

    await incident.save();
    return this.getFoundItemCaseById(caseId);
  }
}

export default CustomerSupportService;
