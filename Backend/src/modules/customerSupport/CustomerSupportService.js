import SupportCase from './SupportCase.js';
import OperationIncident from '../scheduleOperations/OperationIncident.js';
import User from '../auth/User.js';

export class CustomerSupportService {
  static buildCaseQuery({ type, status, priority }) {
    const query = {};

    if (type && type !== 'ALL') {
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

  static buildReferenceNumber(type) {
    const prefix = type === 'SERVICE_FEEDBACK' ? 'FB' : type === 'LOST_ITEM' ? 'LI' : 'CS';
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }

  static normalizeAttachments(files = []) {
    return files.map((file) => ({
      originalName: file.originalname,
      fileName: file.filename,
      path: `/uploads/feedback/${file.filename}`,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date(),
    }));
  }

  static async validateRelatedTrip(userId, relatedTripId) {
    if (!relatedTripId?.trim()) return null;

    const user = await User.findById(userId).select('travelHistory').lean();
    const relatedTrip = (user?.travelHistory || []).find((record) => (
      record.tripId === relatedTripId || record.ticketCode === relatedTripId
    ));

    if (!relatedTrip) {
      const error = new Error('Selected trip is unavailable for this passenger');
      error.statusCode = 400;
      throw error;
    }

    return relatedTrip;
  }

  static async createCase(userId, data, files = []) {
    const relatedTrip = await this.validateRelatedTrip(userId, data.relatedTripId);
    const supportCase = new SupportCase({
      type: data.type,
      referenceNumber: this.buildReferenceNumber(data.type),
      passenger: userId,
      title: data.title.trim(),
      description: data.description.trim(),
      category: data.category || (data.type === 'LOST_ITEM' ? 'LOST_ITEM' : 'OTHER'),
      priority: data.priority || 'NORMAL',
      status: ['LOST_ITEM', 'SERVICE_FEEDBACK'].includes(data.type) ? 'SUBMITTED' : 'OPEN',
      ratingScore: data.ratingScore ? Number(data.ratingScore) : undefined,
      relatedTripId: data.relatedTripId?.trim() || '',
      routeName: data.routeName?.trim(),
      tripCode: data.tripCode?.trim() || relatedTrip?.tripId || '',
      busPlate: data.busPlate?.trim(),
      incidentAt: data.incidentAt ? new Date(data.incidentAt) : undefined,
      contactPhone: data.contactPhone?.trim(),
      contactEmail: data.contactEmail?.trim(),
      attachments: this.normalizeAttachments(files),
      lostItem: data.type === 'LOST_ITEM'
        ? {
          itemName: data.lostItem.itemName.trim(),
          itemCategory: data.lostItem.itemCategory,
          itemDescription: data.lostItem.itemDescription.trim(),
          lastSeenLocation: data.lostItem.lastSeenLocation.trim(),
          lostAt: new Date(data.lostItem.lostAt),
          recoveryStatus: 'REPORTED',
        }
        : undefined,
    });

    await supportCase.save();
    return supportCase.populate('passenger', 'fullName email phone');
  }

  static getLostItemDisplayStatus(supportCase) {
    if (supportCase.status === 'CLOSED') return 'CLOSED';
    if (supportCase.status === 'RESOLVED' || supportCase.lostItem?.recoveryStatus === 'RETURNED') return 'RESOLVED';
    if (supportCase.lostItem?.recoveryStatus === 'FOUND') return 'ITEM_FOUND';
    if (supportCase.lostItem?.recoveryStatus === 'SEARCHING') return 'SEARCHING';
    if (['UNDER_REVIEW', 'IN_PROGRESS'].includes(supportCase.status)) return 'UNDER_REVIEW';
    return 'SUBMITTED';
  }

  static formatLostItemCase(supportCase) {
    const item = supportCase.toObject ? supportCase.toObject() : supportCase;
    const timeline = [{
      label: 'Submitted',
      status: 'SUBMITTED',
      message: 'Lost item report was submitted.',
      timestamp: item.createdAt,
    }];

    if (['UNDER_REVIEW', 'IN_PROGRESS'].includes(item.status)) {
      timeline.push({
        label: 'Under Review',
        status: 'UNDER_REVIEW',
        message: 'Customer support is reviewing the report.',
        timestamp: item.updatedAt,
      });
    }
    if (item.lostItem?.recoveryStatus === 'SEARCHING') {
      timeline.push({
        label: 'Searching',
        status: 'SEARCHING',
        message: 'The recovery team is searching for the reported item.',
        timestamp: item.updatedAt,
      });
    }
    if (item.lostItem?.foundAt) {
      timeline.push({
        label: 'Item Found',
        status: 'ITEM_FOUND',
        message: 'The reported item has been marked as found.',
        timestamp: item.lostItem.foundAt,
      });
    }
    if (item.lostItem?.returnedAt) {
      timeline.push({
        label: 'Resolved',
        status: 'RESOLVED',
        message: 'The reported item has been returned.',
        timestamp: item.lostItem.returnedAt,
      });
    }

    return {
      ...item,
      id: String(item._id),
      caseId: item.referenceNumber || String(item._id),
      currentCaseStatus: this.getLostItemDisplayStatus(item),
      timeline,
      administratorNotes: item.responses || [],
      collectionInstructions: item.lostItem?.recoveryStatus === 'FOUND'
        ? 'Please contact the service counter with your case number and identification.'
        : '',
      lastUpdatedAt: item.updatedAt,
    };
  }

  static async listMyLostItemCases(userId) {
    const cases = await SupportCase.find({ passenger: userId, type: 'LOST_ITEM' })
      .populate('responses.responder', 'fullName email role')
      .sort({ createdAt: -1 });
    return cases.map((supportCase) => this.formatLostItemCase(supportCase));
  }

  static async getMyLostItemCase(userId, caseId) {
    const alternatives = [{ referenceNumber: caseId }];
    if (/^[a-f\d]{24}$/i.test(caseId)) alternatives.push({ _id: caseId });

    const supportCase = await SupportCase.findOne({
      passenger: userId,
      type: 'LOST_ITEM',
      $or: alternatives,
    }).populate('responses.responder', 'fullName email role');

    if (!supportCase) {
      const error = new Error('Lost item case not found');
      error.statusCode = 404;
      throw error;
    }

    return this.formatLostItemCase(supportCase);
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
