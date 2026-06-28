import crypto from 'crypto';
import SupportCase from './SupportCase.js';
import User from '../auth/User.js';

const FEEDBACK_STATUS_ALIASES = {
  SUBMITTED: 'PENDING',
  OPEN: 'PENDING',
  UNDER_REVIEW: 'IN_PROGRESS',
  RESPONDED: 'IN_PROGRESS',
};

const FEEDBACK_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'ratingScore', 'priority', 'status']);
const escapeRegex = (value) => String(value).replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
const isObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));

const normalizePagination = ({ page = 1, limit = 20 } = {}) => {
  const normalizedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
  const normalizedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
  return {
    page: normalizedPage,
    limit: normalizedLimit,
    skip: (normalizedPage - 1) * normalizedLimit,
  };
};

export class CustomerSupportService {
  static buildCaseQuery({ type, status, priority, search, category, rating, route, dateFrom, dateTo, assignedTo, assignedOnly, adminId }) {
    const query = {};

    if (type && type !== 'ALL') {
      query.type = type;
    }

    if (status && status !== 'ALL') {
      const legacyMatches = Object.entries(FEEDBACK_STATUS_ALIASES)
        .filter(([, normalized]) => normalized === status)
        .map(([legacy]) => legacy);
      query.status = legacyMatches.length ? { $in: [status, ...legacyMatches] } : status;
    }

    if (priority && priority !== 'ALL') {
      query.priority = priority;
    }

    if (category && category !== 'ALL') {
      query.category = category;
    }

    if (rating && rating !== 'ALL') {
      query.ratingScore = Number(rating);
    }

    if (route?.trim()) {
      const routeRegex = new RegExp(escapeRegex(route.trim()), 'i');
      query.$or = [
        ...(query.$or || []),
        { routeName: routeRegex },
        { tripCode: routeRegex },
      ];
      if (isObjectId(route)) {
        query.$or.push({ routeId: route });
      }
    }

    if (search?.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [
        ...(query.$or || []),
        { title: searchRegex },
        { description: searchRegex },
        { referenceNumber: searchRegex },
      ];
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (assignedTo && assignedTo !== 'ALL') {
      query.assignedTo = assignedTo;
    } else if (assignedOnly === 'true' && adminId) {
      query.assignedTo = adminId;
    }

    return query;
  }

  static determineFeedbackPriority({ category, ratingScore }) {
    const rating = Number(ratingScore);

    if (category === 'SAFETY' && rating <= 2) return rating === 1 ? 'CRITICAL' : 'HIGH';
    if (['DRIVER_BEHAVIOR', 'BUS_ASSISTANT_BEHAVIOR'].includes(category) && rating <= 2) return 'HIGH';
    if (['PAYMENT_ISSUE', 'APP_ISSUE'].includes(category) && rating <= 2) return 'MEDIUM';
    if (category === 'ROUTE_DELAY' && rating <= 2) return 'MEDIUM';
    if (rating <= 1) return 'HIGH';
    if (rating <= 3) return 'MEDIUM';
    return 'LOW';
  }

  static appendConversation(supportCase, { senderId, senderRole, message }) {
    supportCase.conversation.push({
      senderId,
      senderRole,
      message: message.trim(),
      createdAt: new Date(),
    });
  }

  static async recordUserNotification(userId, message) {
    if (!userId || !message) return;

    await User.findByIdAndUpdate(userId, {
      $push: {
        activityReports: {
          type: 'STATUS_UPDATED',
          message,
          createdAt: new Date(),
        },
      },
    });
  }

  static async notifyAdmins(message) {
    if (!message) return;

    await User.updateMany(
      { role: 'ADMIN' },
      {
        $push: {
          activityReports: {
            type: 'STATUS_UPDATED',
            message,
            createdAt: new Date(),
          },
        },
      }
    );
  }

  static buildReferenceNumber(type) {
    const prefix = type === 'SERVICE_FEEDBACK' ? 'FB' : type === 'LOST_ITEM' ? 'LI' : 'CS';
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}-${random}`;
  }

  static async generateUniqueReferenceNumber(type) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const referenceNumber = this.buildReferenceNumber(type);
      const exists = await SupportCase.exists({ referenceNumber });

      if (!exists) {
        return referenceNumber;
      }
    }

    const prefix = type === 'SERVICE_FEEDBACK' ? 'FB' : type === 'LOST_ITEM' ? 'LI' : 'CS';
    return `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
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
      referenceNumber: await this.generateUniqueReferenceNumber(data.type),
      passenger: userId,
      title: data.title.trim(),
      description: data.description.trim(),
      category: data.category || (data.type === 'LOST_ITEM' ? 'LOST_ITEM' : 'OTHER'),
      priority: data.type === 'SERVICE_FEEDBACK'
        ? this.determineFeedbackPriority({ category: data.category, ratingScore: data.ratingScore })
        : data.priority || 'NORMAL',
      status: data.type === 'SERVICE_FEEDBACK' ? 'PENDING' : data.type === 'LOST_ITEM' ? 'SUBMITTED' : 'OPEN',
      ratingScore: data.ratingScore ? Number(data.ratingScore) : undefined,
      routeId: isObjectId(data.routeId) ? data.routeId : undefined,
      tripId: data.tripId?.trim() || data.relatedTripId?.trim() || '',
      ticketId: isObjectId(data.ticketId) ? data.ticketId : undefined,
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

    if (data.type === 'SERVICE_FEEDBACK') {
      this.appendConversation(supportCase, {
        senderId: userId,
        senderRole: 'PASSENGER',
        message: data.description,
      });
    }

    await supportCase.save();
    if (data.type === 'SERVICE_FEEDBACK') {
      await Promise.all([
        this.recordUserNotification(userId, `Feedback ${supportCase.referenceNumber} was submitted.`),
        this.notifyAdmins(`New passenger feedback ${supportCase.referenceNumber}: ${supportCase.title}`),
      ]);
    }
    return supportCase.populate('passenger', 'fullName email phone');
  }

  static async listCases({ type = 'ALL', status = 'OPEN', priority = 'ALL', page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', ...filters }, adminId) {
    const { page: normalizedPage, limit: normalizedLimit, skip } = normalizePagination({ page, limit });
    const query = this.buildCaseQuery({ type, status, priority, ...filters, adminId });
    const sortField = FEEDBACK_SORT_FIELDS.has(sortBy) ? sortBy : 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      SupportCase.find(query)
        .populate('passenger', 'fullName email phone')
        .populate('assignedTo', 'fullName email role')
        .sort({ [sortField]: sortDirection, createdAt: -1 })
        .skip(skip)
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

  static buildFeedbackQuery(userId, { status, search } = {}) {
    const query = { passenger: userId, type: 'SERVICE_FEEDBACK' };

    if (status && status !== 'ALL') {
      const legacyMatches = Object.entries(FEEDBACK_STATUS_ALIASES)
        .filter(([, normalized]) => normalized === status)
        .map(([legacy]) => legacy);
      query.status = legacyMatches.length ? { $in: [status, ...legacyMatches] } : status;
    }

    if (search?.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [{ title: searchRegex }, { description: searchRegex }, { referenceNumber: searchRegex }];
    }

    return query;
  }

  static async listMyFeedback(userId, queryParams = {}) {
    const { page, limit, skip } = normalizePagination(queryParams);
    const query = this.buildFeedbackQuery(userId, queryParams);

    const [items, total] = await Promise.all([
      SupportCase.find(query)
        .populate('assignedTo', 'fullName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SupportCase.countDocuments(query),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getMyFeedback(userId, caseId) {
    const feedback = await SupportCase.findOne({
      passenger: userId,
      type: 'SERVICE_FEEDBACK',
      $or: [
        { referenceNumber: caseId },
        ...(isObjectId(caseId) ? [{ _id: caseId }] : []),
      ],
    })
      .populate('assignedTo', 'fullName email role')
      .populate('conversation.senderId', 'fullName email role');

    if (!feedback) {
      const error = new Error('Feedback not found');
      error.statusCode = 404;
      throw error;
    }

    return feedback;
  }

  static async addPassengerFeedbackReply(userId, caseId, data) {
    const feedback = await this.getMyFeedback(userId, caseId);

    if (feedback.status !== 'WAITING_FOR_PASSENGER') {
      const error = new Error('Passenger follow-up is only allowed while feedback is waiting for passenger input');
      error.statusCode = 400;
      throw error;
    }

    this.appendConversation(feedback, {
      senderId: userId,
      senderRole: 'PASSENGER',
      message: data.message,
    });
    feedback.status = 'IN_PROGRESS';

    await feedback.save();
    await this.notifyAdmins(`Passenger replied to feedback ${feedback.referenceNumber}.`);
    return this.getMyFeedback(userId, caseId);
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
      .populate('assignedTo', 'fullName email role')
      .populate('responses.responder', 'fullName email role')
      .populate('conversation.senderId', 'fullName email role');

    if (!supportCase) {
      throw new Error('Support case not found');
    }

    return supportCase;
  }

  static async assignFeedback(caseId, adminId, { assignedTo } = {}) {
    const supportCase = await this.getCaseById(caseId);

    if (supportCase.type !== 'SERVICE_FEEDBACK') {
      const error = new Error('Only feedback tickets can be assigned through this action');
      error.statusCode = 400;
      throw error;
    }

    const targetAdminId = assignedTo || adminId;
    const admin = await User.findOne({ _id: targetAdminId, role: 'ADMIN' }).select('_id fullName email').lean();

    if (!admin) {
      const error = new Error('Assigned administrator not found');
      error.statusCode = 404;
      throw error;
    }

    supportCase.assignedTo = admin._id;
    supportCase.assignedAt = new Date();
    if (supportCase.status === 'PENDING') {
      supportCase.status = 'IN_PROGRESS';
    }

    await supportCase.save();
    await this.recordUserNotification(admin._id, `Feedback ${supportCase.referenceNumber} was assigned to you.`);
    return this.getCaseById(caseId);
  }

  static async updateFeedback(caseId, adminId, data) {
    const supportCase = await this.getCaseById(caseId);

    if (supportCase.type !== 'SERVICE_FEEDBACK') {
      const error = new Error('Only feedback tickets can be handled through this action');
      error.statusCode = 400;
      throw error;
    }

    const previousStatus = supportCase.status;
    supportCase.assignedTo = supportCase.assignedTo || adminId;
    supportCase.assignedAt = supportCase.assignedAt || new Date();

    if (data.message?.trim()) {
      this.appendConversation(supportCase, {
        senderId: adminId,
        senderRole: 'ADMIN',
        message: data.message,
      });
      supportCase.adminResponse = data.message.trim();
    }

    if (data.resolutionSummary?.trim()) {
      supportCase.resolutionSummary = data.resolutionSummary.trim();
    }

    if (data.status) {
      supportCase.status = data.status;
    } else if (data.message?.trim() && supportCase.status === 'PENDING') {
      supportCase.status = 'IN_PROGRESS';
    }

    if (supportCase.status === 'RESOLVED' && !supportCase.resolvedAt) {
      supportCase.resolvedAt = new Date();
    }

    if (supportCase.status === 'CLOSED' && !supportCase.closedAt) {
      supportCase.closedAt = new Date();
    }

    await supportCase.save();

    const notifications = [];
    if (data.message?.trim()) {
      notifications.push(this.recordUserNotification(supportCase.passenger._id || supportCase.passenger, `Admin replied to feedback ${supportCase.referenceNumber}.`));
    }
    if (previousStatus !== supportCase.status) {
      notifications.push(this.recordUserNotification(supportCase.passenger._id || supportCase.passenger, `Feedback ${supportCase.referenceNumber} status changed to ${supportCase.status}.`));
    }
    await Promise.all(notifications);

    return this.getCaseById(caseId);
  }

  static async getFeedbackAnalytics() {
    const [summary] = await SupportCase.aggregate([
      { $match: { type: 'SERVICE_FEEDBACK' } },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalFeedback: { $sum: 1 },
                averageRating: { $avg: '$ratingScore' },
                resolvedCount: {
                  $sum: {
                    $cond: [{ $in: ['$status', ['RESOLVED', 'CLOSED']] }, 1, 0],
                  },
                },
                respondedCount: {
                  $sum: {
                    $cond: [{ $gt: [{ $size: { $ifNull: ['$conversation', []] } }, 1] }, 1, 0],
                  },
                },
                averageResponseMs: {
                  $avg: {
                    $let: {
                      vars: {
                        adminMessage: {
                          $first: {
                            $filter: {
                              input: { $ifNull: ['$conversation', []] },
                              as: 'message',
                              cond: { $eq: ['$$message.senderRole', 'ADMIN'] },
                            },
                          },
                        },
                      },
                      in: {
                        $cond: [
                          '$$adminMessage.createdAt',
                          { $subtract: ['$$adminMessage.createdAt', '$createdAt'] },
                          null,
                        ],
                      },
                    },
                  },
                },
                averageResolutionMs: {
                  $avg: {
                    $cond: [
                      '$resolvedAt',
                      { $subtract: ['$resolvedAt', '$createdAt'] },
                      null,
                    ],
                  },
                },
              },
            },
          ],
          byCategory: [{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }],
          byRoute: [{ $group: { _id: '$routeName', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }],
          byMonth: [
            { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]);

    const totals = summary?.totals?.[0] || {};
    const totalFeedback = totals.totalFeedback || 0;

    return {
      totalFeedback,
      averageRating: Number((totals.averageRating || 0).toFixed(2)),
      resolutionRate: totalFeedback ? Number(((totals.resolvedCount / totalFeedback) * 100).toFixed(1)) : 0,
      averageResponseHours: totals.averageResponseMs ? Number((totals.averageResponseMs / 36e5).toFixed(1)) : 0,
      averageResolutionHours: totals.averageResolutionMs ? Number((totals.averageResolutionMs / 36e5).toFixed(1)) : 0,
      byCategory: summary?.byCategory || [],
      byRoute: summary?.byRoute || [],
      byMonth: summary?.byMonth || [],
    };
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
