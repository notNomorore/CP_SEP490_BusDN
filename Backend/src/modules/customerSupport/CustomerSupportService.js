import crypto from 'crypto';
import SupportCase from './SupportCase.js';
import OperationIncident from '../scheduleOperations/OperationIncident.js';
import User from '../auth/User.js';
import { createBroadcastNotification } from '../systemNotifications/systemNotification.service.js';
import {
  FEEDBACK_ACTION,
  FEEDBACK_REPLY_STATUS,
  FEEDBACK_STATUS,
  SUPPORT_CASE_STATUS_ALIASES,
  assertFeedbackTransition,
  createBusinessError,
  getReplyStatusForAdminAction,
  isTerminalFeedbackStatus,
  normalizeFeedbackStatus,
  resolveFeedbackAction,
} from './feedbackWorkflow.js';

const FEEDBACK_STATUS_ALIASES = SUPPORT_CASE_STATUS_ALIASES;

const FEEDBACK_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'ratingScore', 'priority', 'status']);
const escapeRegex = (value) => String(value).replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
const isObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));
const DUPLICATE_SUBMIT_WINDOW_MS = 15000;
const DUPLICATE_REPLY_WINDOW_MS = 10000;

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

  static appendAudit(supportCase, {
    actorId,
    actorRole,
    action,
    previousStatus,
    newStatus,
    message = '',
    metadata = {},
  }) {
    supportCase.auditTrail.push({
      actorId,
      actorRole,
      action,
      previousStatus,
      newStatus,
      message: String(message || '').trim(),
      metadata,
      createdAt: new Date(),
    });
  }

  static ensureAssignedToAdmin(supportCase, adminId) {
    const assignedTo = supportCase.assignedTo?._id || supportCase.assignedTo;

    if (!assignedTo) {
      throw createBusinessError('Assign this feedback ticket before processing it', 409);
    }

    if (String(assignedTo) !== String(adminId)) {
      throw createBusinessError('This feedback ticket is assigned to another administrator', 403);
    }
  }

  static async assertNoRecentDuplicate(userId, data) {
    if (data.type !== 'SERVICE_FEEDBACK') return;

    const createdAfter = new Date(Date.now() - DUPLICATE_SUBMIT_WINDOW_MS);
    const duplicate = await SupportCase.exists({
      passenger: userId,
      type: data.type,
      title: data.title.trim(),
      description: data.description.trim(),
      category: data.category,
      ratingScore: Number(data.ratingScore),
      createdAt: { $gte: createdAfter },
    });

    if (duplicate) {
      throw createBusinessError('Duplicate feedback submission detected. Please wait before retrying.', 409);
    }
  }

  static async createPassengerFeedbackReplyNotification({ supportCase, adminId }) {
    const passengerId = supportCase.passenger?._id || supportCase.passenger;

    if (!passengerId) return;

    try {
      await createBroadcastNotification({
        title: 'Feedback response received',
        message: 'Your feedback has received a response from the administrator.',
        type: 'general',
        priority: 'normal',
        targetAudience: 'specific_users',
        userIds: [passengerId],
        actionUrl: '/my-feedback',
        sourceType: 'SupportCase',
        sourceId: supportCase._id,
        metadata: {
          caseId: String(supportCase._id),
          referenceNumber: supportCase.referenceNumber,
          feedbackType: supportCase.type,
        },
      }, adminId);
    } catch (error) {
      // Reply persistence must not fail just because notification delivery fails.
      await this.recordUserNotification(
        passengerId,
        `Admin replied to feedback ${supportCase.referenceNumber}.`
      );
    }
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
    if (data.type === 'SERVICE_FEEDBACK' && !data.relatedTripId?.trim()) {
      throw createBusinessError('Related trip or route is required for service feedback', 400);
    }

    const relatedTrip = await this.validateRelatedTrip(userId, data.relatedTripId);
    await this.assertNoRecentDuplicate(userId, data);

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
      status: data.type === 'SERVICE_FEEDBACK' ? FEEDBACK_STATUS.PENDING : data.type === 'LOST_ITEM' ? 'SUBMITTED' : 'OPEN',
      replyStatus: data.type === 'SERVICE_FEEDBACK' ? FEEDBACK_REPLY_STATUS.UNREPLIED : undefined,
      ratingScore: data.ratingScore ? Number(data.ratingScore) : undefined,
      routeId: isObjectId(data.routeId) ? data.routeId : undefined,
      tripId: data.tripId?.trim() || data.relatedTripId?.trim() || '',
      ticketId: isObjectId(data.ticketId) ? data.ticketId : undefined,
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

    if (data.type === 'SERVICE_FEEDBACK') {
      this.appendConversation(supportCase, {
        senderId: userId,
        senderRole: 'PASSENGER',
        message: data.description,
      });
      this.appendAudit(supportCase, {
        actorId: userId,
        actorRole: 'PASSENGER',
        action: FEEDBACK_ACTION.CREATE,
        previousStatus: null,
        newStatus: supportCase.status,
        message: 'Feedback submitted',
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
        .populate('adminResponseBy', 'fullName email role')
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
        .populate('adminResponseBy', 'fullName email role')
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
      .populate('adminResponseBy', 'fullName email role')
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

    if (normalizeFeedbackStatus(feedback.status) !== FEEDBACK_STATUS.WAITING_FOR_PASSENGER) {
      const error = new Error('Passenger follow-up is only allowed while feedback is waiting for passenger input');
      error.statusCode = 400;
      throw error;
    }

    if (isTerminalFeedbackStatus(feedback.status)) {
      throw createBusinessError('Closed or rejected feedback cannot receive passenger replies', 409);
    }

    const previousStatus = feedback.status;

    this.appendConversation(feedback, {
      senderId: userId,
      senderRole: 'PASSENGER',
      message: data.message,
    });
    feedback.status = FEEDBACK_STATUS.IN_PROGRESS;
    feedback.replyStatus = FEEDBACK_REPLY_STATUS.CUSTOMER_REPLIED;
    this.appendAudit(feedback, {
      actorId: userId,
      actorRole: 'PASSENGER',
      action: FEEDBACK_ACTION.CUSTOMER_REPLY,
      previousStatus,
      newStatus: feedback.status,
      message: 'Passenger provided follow-up information',
    });

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
      .populate('adminResponseBy', 'fullName email role')
      .populate('responses.responder', 'fullName email role')
      .populate('conversation.senderId', 'fullName email role');

    if (!supportCase) {
      throw new Error('Support case not found');
    }

    return supportCase;
  }

  static async assignFeedback(caseId, adminId, { assignedTo } = {}) {
    const targetAdminId = assignedTo || adminId;
    const admin = await User.findOne({ _id: targetAdminId, role: 'ADMIN' }).select('_id fullName email').lean();

    if (!admin) {
      const error = new Error('Assigned administrator not found');
      error.statusCode = 404;
      throw error;
    }

    const previous = await SupportCase.findById(caseId).select('type status assignedTo assignedAt referenceNumber');

    if (!previous) {
      throw createBusinessError('Support case not found', 404);
    }

    if (previous.type !== 'SERVICE_FEEDBACK') {
      throw createBusinessError('Only feedback tickets can be assigned through this action', 400);
    }

    if (previous.assignedTo && String(previous.assignedTo) !== String(targetAdminId)) {
      throw createBusinessError('Feedback ticket is already assigned to another administrator', 409);
    }

    const nextStatus = normalizeFeedbackStatus(previous.status) === FEEDBACK_STATUS.PENDING
      ? FEEDBACK_STATUS.IN_PROGRESS
      : previous.status;
    if (nextStatus !== previous.status) {
      assertFeedbackTransition(previous.status, nextStatus);
    }

    const assignedAt = previous.assignedTo ? previous.assignedAt : new Date();
    const updatedCase = await SupportCase.findOneAndUpdate(
      {
        _id: caseId,
        type: 'SERVICE_FEEDBACK',
        $or: [
          { assignedTo: { $exists: false } },
          { assignedTo: null },
          { assignedTo: targetAdminId },
        ],
      },
      {
        $set: {
          assignedTo: admin._id,
          assignedAt,
          status: nextStatus,
        },
        $push: {
          auditTrail: {
            actorId: adminId,
            actorRole: 'ADMIN',
            action: FEEDBACK_ACTION.ASSIGN,
            previousStatus: previous.status,
            newStatus: nextStatus,
            message: previous.assignedTo ? 'Assignment confirmed' : 'Feedback assigned',
            metadata: { assignedTo: String(admin._id) },
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!updatedCase) {
      throw createBusinessError('Feedback ticket assignment changed. Please refresh and try again.', 409);
    }

    await this.recordUserNotification(admin._id, `Feedback ${updatedCase.referenceNumber} was assigned to you.`);
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
    this.ensureAssignedToAdmin(supportCase, adminId);

    if (isTerminalFeedbackStatus(supportCase.status)) {
      throw createBusinessError('Closed or rejected feedback cannot be updated', 409);
    }

    const hasMessage = Boolean(data.message?.trim());
    const hasResolution = Boolean(data.resolutionSummary?.trim() || supportCase.resolutionSummary?.trim());
    const nextStatus = data.status ? assertFeedbackTransition(supportCase.status, data.status) : supportCase.status;

    if (nextStatus === FEEDBACK_STATUS.RESOLVED && !hasMessage && !hasResolution && !supportCase.adminResponse?.trim()) {
      throw createBusinessError('Resolution requires an admin response or resolution summary', 422);
    }

    if (nextStatus === FEEDBACK_STATUS.CLOSED && normalizeFeedbackStatus(supportCase.status) !== FEEDBACK_STATUS.RESOLVED) {
      throw createBusinessError('Feedback must be resolved before it can be closed', 409);
    }

    if (hasMessage) {
      const replyAt = new Date();
      const duplicateReply = [...(supportCase.conversation || [])].reverse().find((message) => (
        message.senderRole === 'ADMIN'
        && String(message.senderId?._id || message.senderId) === String(adminId)
        && message.message === data.message.trim()
        && replyAt.getTime() - new Date(message.createdAt).getTime() <= DUPLICATE_REPLY_WINDOW_MS
      ));

      if (duplicateReply) {
        throw createBusinessError('Duplicate admin reply detected. Please refresh the ticket.', 409);
      }

      this.appendConversation(supportCase, {
        senderId: adminId,
        senderRole: 'ADMIN',
        message: data.message,
      });
      supportCase.adminResponse = data.message.trim();
      supportCase.adminResponseBy = adminId;
      supportCase.adminResponseAt = replyAt;
      supportCase.firstResponseAt = supportCase.firstResponseAt || replyAt;
      supportCase.lastResponseAt = replyAt;
    }

    if (data.resolutionSummary?.trim()) {
      supportCase.resolutionSummary = data.resolutionSummary.trim();
    }

    supportCase.status = nextStatus;
    supportCase.replyStatus = getReplyStatusForAdminAction({
      nextStatus,
      hasMessage,
      currentReplyStatus: supportCase.replyStatus,
    });

    if (nextStatus === FEEDBACK_STATUS.RESOLVED && !supportCase.resolvedAt) {
      supportCase.resolvedAt = new Date();
    }

    if (nextStatus === FEEDBACK_STATUS.CLOSED && !supportCase.closedAt) {
      supportCase.closedAt = new Date();
    }

    this.appendAudit(supportCase, {
      actorId: adminId,
      actorRole: 'ADMIN',
      action: resolveFeedbackAction({ previousStatus, nextStatus, hasMessage }),
      previousStatus,
      newStatus: supportCase.status,
      message: hasMessage ? 'Admin public reply recorded' : 'Feedback status updated',
      metadata: {
        replyStatus: supportCase.replyStatus,
        hasResolutionSummary: Boolean(supportCase.resolutionSummary),
      },
    });

    await supportCase.save();

    const notifications = [];
    if (hasMessage) {
      notifications.push(this.recordUserNotification(supportCase.passenger._id || supportCase.passenger, `Admin replied to feedback ${supportCase.referenceNumber}.`));
      notifications.push(this.createPassengerFeedbackReplyNotification({ supportCase, adminId }));
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

  static async updateLostItemCase(caseId, adminId, data) {
    const supportCase = await this.getCaseById(caseId);

    if (supportCase.type !== 'LOST_ITEM') {
      throw new Error('Only lost item cases can be handled through this action');
    }

    const statusBefore = supportCase.status;

    if (data.status) {
      supportCase.status = data.status;
    }

    if (data.recoveryStatus) {
      supportCase.lostItem = supportCase.lostItem || {};
      supportCase.lostItem.recoveryStatus = data.recoveryStatus;
    }

    if (data.recoveryStatus === 'FOUND') {
      supportCase.lostItem.foundAt = supportCase.lostItem.foundAt || new Date();
      supportCase.status = data.status || 'IN_PROGRESS';
    }

    if (data.recoveryStatus === 'RETURNED') {
      supportCase.lostItem.returnedAt = supportCase.lostItem.returnedAt || new Date();
      supportCase.status = 'RESOLVED';
      supportCase.resolvedAt = supportCase.resolvedAt || new Date();
    }

    if (supportCase.status === 'CLOSED') {
      supportCase.closedAt = supportCase.closedAt || new Date();
    }

    if (data.note?.trim()) {
      supportCase.responses.push({
        message: data.note.trim(),
        responder: adminId,
        statusBefore,
        statusAfter: supportCase.status,
        responseType: 'COMPLAINT_RESPONSE',
        visibleToPassenger: true,
        createdAt: new Date(),
      });
    }

    supportCase.assignedTo = supportCase.assignedTo || adminId;

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

  static mapSupportLostItemStatusToAdminStatus(supportCase) {
    if (supportCase.status === 'RESOLVED' || supportCase.lostItem?.recoveryStatus === 'RETURNED') return 'RESOLVED';
    if (supportCase.status === 'CLOSED' || supportCase.status === 'REJECTED') return 'CANCELLED';
    if (['UNDER_REVIEW', 'IN_PROGRESS', 'RESPONDED', 'WAITING_FOR_PASSENGER'].includes(supportCase.status)) {
      return 'ACKNOWLEDGED';
    }
    return 'OPEN';
  }

  static buildPassengerLostItemQuery({ status, recoveryStatus }) {
    const query = { type: 'LOST_ITEM' };

    if (status && status !== 'ALL') {
      const statusMap = {
        OPEN: ['SUBMITTED', 'OPEN'],
        ACKNOWLEDGED: ['UNDER_REVIEW', 'IN_PROGRESS', 'RESPONDED', 'WAITING_FOR_PASSENGER'],
        RESOLVED: ['RESOLVED'],
        CANCELLED: ['CLOSED', 'REJECTED'],
      };
      query.status = { $in: statusMap[status] || [status] };
    }

    if (recoveryStatus && recoveryStatus !== 'ALL') {
      query['lostItem.recoveryStatus'] = recoveryStatus;
    }

    return query;
  }

  static async listAdminLostItemCases({ status = 'ALL', recoveryStatus = 'ALL', page = 1, limit = 20 }) {
    const normalizedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
    const normalizedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
    const fetchLimit = normalizedPage * normalizedLimit;
    const foundItemQuery = this.buildFoundItemQuery({ status, recoveryStatus });
    const passengerLostItemQuery = this.buildPassengerLostItemQuery({ status, recoveryStatus });

    const [foundItems, passengerLostItems, foundTotal, passengerTotal] = await Promise.all([
      OperationIncident.find(foundItemQuery)
        .populate('driver', 'fullName email phone phoneNumber role')
        .populate('route', 'routeNumber routeName name')
        .populate('vehicle', 'busCode plateNumber')
        .populate('trip', 'scheduleCode routeName serviceDate departureTime')
        .sort({ reportedAt: -1, createdAt: -1 })
        .limit(fetchLimit),
      SupportCase.find(passengerLostItemQuery)
        .populate('passenger', 'fullName email phone phoneNumber role')
        .populate('responses.responder', 'fullName email role')
        .sort({ createdAt: -1 })
        .limit(fetchLimit),
      OperationIncident.countDocuments(foundItemQuery),
      SupportCase.countDocuments(passengerLostItemQuery),
    ]);

    const items = [
      ...foundItems.map((record) => ({ sourceType: 'FOUND_ITEM', record })),
      ...passengerLostItems.map((record) => ({ sourceType: 'PASSENGER_LOST_ITEM', record })),
    ].sort((first, second) => {
      const firstDate = first.record.reportedAt || first.record.createdAt;
      const secondDate = second.record.reportedAt || second.record.createdAt;
      return new Date(secondDate || 0) - new Date(firstDate || 0);
    });

    const total = foundTotal + passengerTotal;
    const start = (normalizedPage - 1) * normalizedLimit;

    return {
      items: items.slice(start, start + normalizedLimit),
      meta: {
        page: normalizedPage,
        limit: normalizedLimit,
        total,
        totalPages: Math.ceil(total / normalizedLimit),
      },
    };
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

  static async getAdminLostItemCaseById(caseId) {
    if (isObjectId(caseId)) {
      const incident = await OperationIncident.findOne({ _id: caseId, type: 'FOUND_ITEM' })
        .populate('driver', 'fullName email phone phoneNumber role')
        .populate('route', 'routeNumber routeName name')
        .populate('vehicle', 'busCode plateNumber')
        .populate('trip', 'scheduleCode routeName serviceDate departureTime');

      if (incident) {
        return { sourceType: 'FOUND_ITEM', record: incident };
      }
    }

    const supportCaseQuery = {
      type: 'LOST_ITEM',
      $or: [{ referenceNumber: caseId }],
    };

    if (isObjectId(caseId)) {
      supportCaseQuery.$or.push({ _id: caseId });
    }

    const supportCase = await SupportCase.findOne(supportCaseQuery)
      .populate('passenger', 'fullName email phone phoneNumber role')
      .populate('responses.responder', 'fullName email role');

    if (supportCase) {
      return { sourceType: 'PASSENGER_LOST_ITEM', record: supportCase };
    }

    throw new Error('Lost item case not found');
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
