import SupportCase from './SupportCase.js';
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
    const random = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `${prefix}-${Date.now()}-${random}`;
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
    if (!relatedTripId?.trim()) {
      return null;
    }

    const user = await User.findById(userId).select('travelHistory').lean();
    const relatedTrip = (user?.travelHistory || []).find((record) => (
      record.tripId === relatedTripId
      || record.ticketCode === relatedTripId
    ));

    if (!relatedTrip) {
      const error = new Error('Selected trip is unavailable for this passenger');
      error.statusCode = 400;
      throw error;
    }

    return relatedTrip;
  }

  static async preventDuplicateFeedback(userId, data) {
    if (data.type !== 'SERVICE_FEEDBACK') {
      return;
    }

    const duplicateSince = new Date(Date.now() - 10 * 60 * 1000);
    const duplicate = await SupportCase.findOne({
      passenger: userId,
      type: 'SERVICE_FEEDBACK',
      category: data.category,
      title: data.title.trim(),
      description: data.description.trim(),
      createdAt: { $gte: duplicateSince },
    }).lean();

    if (duplicate) {
      const error = new Error('Duplicate feedback submission detected. Please wait before submitting again.');
      error.statusCode = 409;
      throw error;
    }
  }

  static async preventDuplicateLostItem(userId, data) {
    if (data.type !== 'LOST_ITEM') {
      return;
    }

    const duplicateSince = new Date(Date.now() - 30 * 60 * 1000);
    const duplicate = await SupportCase.findOne({
      passenger: userId,
      type: 'LOST_ITEM',
      'lostItem.itemName': data.lostItem.itemName.trim(),
      'lostItem.lastSeenLocation': data.lostItem.lastSeenLocation.trim(),
      createdAt: { $gte: duplicateSince },
    }).lean();

    if (duplicate) {
      const error = new Error('Duplicate lost item report detected. Please wait before submitting again.');
      error.statusCode = 409;
      throw error;
    }
  }

  static async createCase(userId, data, files = []) {
    const relatedTrip = await this.validateRelatedTrip(userId, data.relatedTripId);
    await this.preventDuplicateFeedback(userId, data);
    await this.preventDuplicateLostItem(userId, data);

    const supportCase = new SupportCase({
      type: data.type,
      referenceNumber: this.buildReferenceNumber(data.type),
      passenger: userId,
      title: data.title.trim(),
      description: data.description.trim(),
      category: data.category || (data.type === 'LOST_ITEM' ? 'LOST_ITEM' : 'OTHER'),
      priority: data.priority || 'NORMAL',
      status: ['SERVICE_FEEDBACK', 'LOST_ITEM'].includes(data.type) ? 'SUBMITTED' : 'OPEN',
      ratingScore: data.ratingScore ? Number(data.ratingScore) : undefined,
      relatedTripId: data.relatedTripId?.trim() || '',
      routeName: data.routeName?.trim(),
      tripCode: data.tripCode?.trim() || data.relatedTripId?.trim() || relatedTrip?.tripId || '',
      busPlate: data.busPlate?.trim(),
      incidentAt: data.incidentAt ? new Date(data.incidentAt) : undefined,
      contactPhone: data.contactPhone?.trim(),
      contactEmail: data.contactEmail?.trim(),
      attachments: this.normalizeAttachments(files),
      lostItem: data.type === 'LOST_ITEM'
        ? {
          itemName: data.lostItem.itemName.trim(),
          itemCategory: data.lostItem.itemCategory || 'OTHER_ITEMS',
          itemDescription: data.lostItem.itemDescription?.trim(),
          lastSeenLocation: data.lostItem.lastSeenLocation?.trim(),
          lostAt: data.lostItem.lostAt ? new Date(data.lostItem.lostAt) : undefined,
          recoveryStatus: 'REPORTED',
        }
        : undefined,
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

  static getLostItemDisplayStatus(supportCase) {
    const recoveryStatus = supportCase.lostItem?.recoveryStatus;

    if (supportCase.status === 'CLOSED') return 'CLOSED';
    if (supportCase.status === 'RESOLVED') return 'RESOLVED';
    if (recoveryStatus === 'RETURNED') return 'RESOLVED';
    if (recoveryStatus === 'FOUND') return 'ITEM_FOUND';
    if (recoveryStatus === 'SEARCHING') return 'SEARCHING';
    if (supportCase.status === 'UNDER_REVIEW' || supportCase.status === 'IN_PROGRESS') return 'UNDER_REVIEW';
    return 'SUBMITTED';
  }

  static buildLostItemTimeline(supportCase) {
    const timeline = [
      {
        label: 'Submitted',
        status: 'SUBMITTED',
        message: 'Lost item report was submitted.',
        timestamp: supportCase.createdAt,
      },
    ];

    if (supportCase.status === 'UNDER_REVIEW' || supportCase.status === 'IN_PROGRESS') {
      timeline.push({
        label: 'Under Review',
        status: 'UNDER_REVIEW',
        message: 'Customer support is reviewing the report.',
        timestamp: supportCase.updatedAt,
      });
    }

    if (supportCase.lostItem?.recoveryStatus === 'SEARCHING') {
      timeline.push({
        label: 'Searching',
        status: 'SEARCHING',
        message: 'The recovery team is searching for the reported item.',
        timestamp: supportCase.updatedAt,
      });
    }

    if (supportCase.lostItem?.foundAt) {
      timeline.push({
        label: 'Item Found',
        status: 'ITEM_FOUND',
        message: 'The reported item has been marked as found.',
        timestamp: supportCase.lostItem.foundAt,
      });
    }

    if (supportCase.lostItem?.returnedAt) {
      timeline.push({
        label: 'Resolved',
        status: 'RESOLVED',
        message: 'The reported item has been returned or resolved.',
        timestamp: supportCase.lostItem.returnedAt,
      });
    }

    if (supportCase.closedAt) {
      timeline.push({
        label: 'Closed',
        status: 'CLOSED',
        message: 'The lost item case has been closed.',
        timestamp: supportCase.closedAt,
      });
    }

    return timeline.sort((first, second) => new Date(first.timestamp || 0) - new Date(second.timestamp || 0));
  }

  static buildCollectionInstructions(supportCase) {
    if (supportCase.lostItem?.recoveryStatus !== 'FOUND') {
      return '';
    }

    return 'Your item has been found. Please wait for a support agent response or visit the service counter with your case number and identification.';
  }

  static formatLostItemCase(supportCase) {
    const plainCase = supportCase.toObject ? supportCase.toObject() : supportCase;

    return {
      ...plainCase,
      id: String(plainCase._id),
      caseId: plainCase.referenceNumber || String(plainCase._id),
      currentCaseStatus: this.getLostItemDisplayStatus(plainCase),
      timeline: this.buildLostItemTimeline(plainCase),
      administratorNotes: plainCase.responses || [],
      collectionInstructions: this.buildCollectionInstructions(plainCase),
      lastUpdatedAt: plainCase.updatedAt,
    };
  }

  static async listMyLostItemCases(userId) {
    const cases = await SupportCase.find({
      passenger: userId,
      type: 'LOST_ITEM',
    })
      .populate('responses.responder', 'fullName email role')
      .sort({ createdAt: -1 });

    return cases.map((supportCase) => this.formatLostItemCase(supportCase));
  }

  static async getMyLostItemCase(userId, caseId) {
    const caseQuery = {
      passenger: userId,
      type: 'LOST_ITEM',
      $or: [{ referenceNumber: caseId }],
    };

    if (/^[a-f\d]{24}$/i.test(caseId)) {
      caseQuery.$or.push({ _id: caseId });
    }

    const supportCase = await SupportCase.findOne({
      ...caseQuery,
    }).populate('responses.responder', 'fullName email role');

    if (!supportCase) {
      const error = new Error('Lost item case not found');
      error.statusCode = 404;
      throw error;
    }

    return this.formatLostItemCase(supportCase);
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

    supportCase.responses.push({
      message: data.message.trim(),
      responder: adminId,
      createdAt: new Date(),
    });
    supportCase.status = data.status || 'IN_PROGRESS';
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

  static async updateLostItemCase(caseId, adminId, data) {
    const supportCase = await this.getCaseById(caseId);

    if (supportCase.type !== 'LOST_ITEM') {
      throw new Error('Only lost item cases can be handled through this action');
    }

    if (data.note?.trim()) {
      supportCase.responses.push({
        message: data.note.trim(),
        responder: adminId,
        createdAt: new Date(),
      });
    }

    if (data.status) {
      supportCase.status = data.status;
    }

    if (data.recoveryStatus) {
      supportCase.lostItem.recoveryStatus = data.recoveryStatus;
    }

    if (data.recoveryStatus === 'FOUND') {
      supportCase.lostItem.foundAt = new Date();
      supportCase.status = data.status || 'IN_PROGRESS';
    }

    if (data.recoveryStatus === 'RETURNED') {
      supportCase.lostItem.returnedAt = new Date();
      supportCase.status = 'RESOLVED';
      supportCase.resolvedAt = new Date();
    }

    if (supportCase.status === 'CLOSED') {
      supportCase.closedAt = new Date();
    }

    supportCase.assignedTo = supportCase.assignedTo || adminId;

    await supportCase.save();
    return this.getCaseById(caseId);
  }
}

export default CustomerSupportService;
