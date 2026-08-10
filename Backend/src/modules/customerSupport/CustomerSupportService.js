import crypto from 'crypto';
import SupportCase from './SupportCase.js';
import LostFoundMatch from './LostFoundMatch.js';
import LostAndFoundMatchingService from './LostAndFoundMatchingService.js';
import OperationIncident from '../scheduleOperations/OperationIncident.js';
import User from '../auth/User.js';
import notificationService from '../systemNotifications/notification.service.js';
import { notifyFeedbackResponse } from '../systemNotifications/triggers/notification.triggers.js';
import StorageService from '../../services/storage/storage.service.js';
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
const FEEDBACK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];
const SLA_HOURS_BY_PRIORITY = {
  LOW: 48,
  NORMAL: 24,
  MEDIUM: 24,
  HIGH: 8,
  CRITICAL: 2,
  URGENT: 2,
};
const IMPORTANT_FEEDBACK_STATUSES = new Set([
  FEEDBACK_STATUS.IN_REVIEW,
  FEEDBACK_STATUS.INVESTIGATING,
  FEEDBACK_STATUS.WAITING_FOR_INFORMATION,
  FEEDBACK_STATUS.ACTION_REQUIRED,
  FEEDBACK_STATUS.RESOLVED,
  FEEDBACK_STATUS.CLOSED,
  FEEDBACK_STATUS.REOPENED,
]);
const CUSTOMER_VISIBLE_LOST_ITEM_STATUSES = new Set(['FOUND', 'RETURNED', 'SEARCHING']);
const VALID_ASSIGNED_TEAMS = new Set(['UNASSIGNED', 'ADMIN', 'OPERATION_TEAM', 'SUPPORT_TEAM', 'MAINTENANCE_TEAM']);
const CORRECTIVE_ACTION_TYPES = new Set([
  'DRIVER_WARNING',
  'DRIVER_TRAINING',
  'SUPERVISOR_REVIEW',
  'SCHEDULE_ADJUSTMENT',
  'MAINTENANCE_ACTION',
  'NO_VIOLATION_FOUND',
  'OTHER',
]);
const escapeRegex = (value) => String(value).replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
const isObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));
const hasValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
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

  static determineFeedbackPriority({ category, ratingScore, title = '', description = '' }) {
    const rating = Number(ratingScore);
    const content = `${title} ${description}`.toLowerCase();
    const safetyKeywords = [
      'safety',
      'unsafe',
      'harassment',
      'accident',
      'crash',
      'injury',
      'assault',
      'threat',
      'danger',
      'serious incident',
    ];

    if (category === 'SAFETY' || safetyKeywords.some((keyword) => content.includes(keyword))) {
      return {
        priority: 'CRITICAL',
        reason: 'Safety-related complaint or serious incident keyword detected',
      };
    }

    if (rating <= 1 && ['DRIVER_BEHAVIOR', 'BUS_ASSISTANT_BEHAVIOR', 'SERVICE_QUALITY', 'OTHER'].includes(category)) {
      return {
        priority: 'HIGH',
        reason: 'One-star complaint requires high-priority review',
      };
    }

    if (rating <= 3) {
      return {
        priority: 'NORMAL',
        reason: 'Two- or three-star passenger feedback requires normal follow-up',
      };
    }

    return {
      priority: 'LOW',
      reason: 'Positive or general feedback with no safety indicators',
    };
  }

  static calculateSlaDueAt(priority, fromDate = new Date()) {
    const hours = SLA_HOURS_BY_PRIORITY[priority] || SLA_HOURS_BY_PRIORITY.NORMAL;
    return new Date(new Date(fromDate).getTime() + hours * 60 * 60 * 1000);
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

    const email = supportCase.passenger?.email || supportCase.contactEmail || '';
    const notification = await notifyFeedbackResponse({
      supportCase,
      adminId,
      channels: {
        inApp: true,
        email: hasValidEmail(email),
      },
      emailRecipients: hasValidEmail(email)
        ? [{ email, fullName: supportCase.passenger?.fullName || 'Passenger' }]
        : [],
    });

    if (!notification) {
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

  static async normalizeAttachments(files = [], metadata = {}) {
    const uploads = [];

    try {
      for (const file of files) {
        const upload = await StorageService.uploadSupportAttachment(file, metadata);
        uploads.push(upload);
      }
    } catch (error) {
      await StorageService.cleanupUploads(uploads);
      throw error;
    }

    return uploads.map((upload) => ({
      originalName: upload.originalName,
      fileName: upload.fileName,
      path: upload.url,
      url: upload.url,
      provider: upload.provider,
      publicId: upload.publicId,
      resourceType: upload.resourceType,
      mimeType: upload.mimeType,
      size: upload.size,
      uploadedAt: upload.uploadedAt,
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
    const priorityClassification = data.type === 'SERVICE_FEEDBACK'
      ? this.determineFeedbackPriority({
        category: data.category,
        ratingScore: data.ratingScore,
        title: data.title,
        description: data.description,
      })
      : {
        priority: FEEDBACK_PRIORITIES.includes(data.priority) ? data.priority : 'NORMAL',
        reason: data.priority ? 'Priority selected by submitter' : 'Default normal priority',
      };

    const attachments = await this.normalizeAttachments(files, {
      type: data.type,
      userId,
    });

    const supportCase = new SupportCase({
      type: data.type,
      referenceNumber: await this.generateUniqueReferenceNumber(data.type),
      passenger: userId,
      title: data.title.trim(),
      description: data.description.trim(),
      category: data.category || (data.type === 'LOST_ITEM' ? 'LOST_ITEM' : 'OTHER'),
      priority: priorityClassification.priority,
      priorityReason: priorityClassification.reason,
      status: data.type === 'SERVICE_FEEDBACK' ? FEEDBACK_STATUS.NEW : data.type === 'LOST_ITEM' ? 'WAITING_FOR_MATCH' : 'OPEN',
      replyStatus: data.type === 'SERVICE_FEEDBACK' ? FEEDBACK_REPLY_STATUS.UNREPLIED : undefined,
      slaDueAt: data.type === 'SERVICE_FEEDBACK' ? this.calculateSlaDueAt(priorityClassification.priority) : undefined,
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
      attachments,
      lostItem: data.type === 'LOST_ITEM'
        ? {
          itemName: data.lostItem.itemName.trim(),
          itemCategory: data.lostItem.itemCategory,
          itemDescription: data.lostItem.itemDescription.trim(),
          color: data.lostItem.color?.trim() || '',
          brand: data.lostItem.brand?.trim() || '',
          identifyingDetails: data.lostItem.identifyingDetails?.trim() || '',
          lastSeenLocation: data.lostItem.lastSeenLocation.trim(),
          lostAt: new Date(data.lostItem.lostAt),
          recoveryStatus: 'SEARCHING',
          contactPreference: data.lostItem.contactPreference || data.contactPreference || 'ANY',
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
    if (data.type === 'LOST_ITEM') {
      this.appendAudit(supportCase, {
        actorId: userId,
        actorRole: 'PASSENGER',
        action: 'LOST_REPORT_CREATED',
        previousStatus: null,
        newStatus: supportCase.status,
        message: 'Lost item report submitted',
      });
    }

    try {
      await supportCase.save();
    } catch (error) {
      await StorageService.cleanupUploads(attachments);
      throw error;
    }
    if (data.type === 'SERVICE_FEEDBACK') {
      await Promise.all([
        this.recordUserNotification(userId, `Feedback ${supportCase.referenceNumber} was submitted.`),
        this.notifyAdmins(`New passenger feedback ${supportCase.referenceNumber}: ${supportCase.title}`),
      ]);
    }
    if (data.type === 'LOST_ITEM') {
      await LostAndFoundMatchingService.notifyReportCreated({
        type: 'LOST_ITEM',
        report: supportCase,
        actorId: userId,
      });
      await LostAndFoundMatchingService.runForLostItem(supportCase._id, {
        userId,
        role: 'PASSENGER',
      });
      return SupportCase.findById(supportCase._id).populate('passenger', 'fullName email phone');
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

    if (normalizeFeedbackStatus(feedback.status) !== FEEDBACK_STATUS.WAITING_FOR_INFORMATION) {
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
    feedback.status = FEEDBACK_STATUS.INVESTIGATING;
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
    if (supportCase.status === 'RETURN_IN_PROGRESS' || recoveryStatus === 'RETURN_IN_PROGRESS') return 'RETURN_IN_PROGRESS';
    if (supportCase.status === 'MATCH_CONFIRMED' || recoveryStatus === 'MATCH_CONFIRMED') return 'MATCH_CONFIRMED';
    if (supportCase.status === 'POTENTIAL_MATCH' || recoveryStatus === 'POTENTIAL_MATCH') return 'POTENTIAL_MATCH';
    if (recoveryStatus === 'RETURNED') return 'RESOLVED';
    if (recoveryStatus === 'FOUND') return 'ITEM_FOUND';
    if (recoveryStatus === 'SEARCHING') return 'SEARCHING';
    if (supportCase.status === 'WAITING_FOR_MATCH') return 'SEARCHING';
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

    if (supportCase.status === 'POTENTIAL_MATCH' || supportCase.lostItem?.recoveryStatus === 'POTENTIAL_MATCH') {
      timeline.push({
        label: 'Potential Match',
        status: 'POTENTIAL_MATCH',
        message: 'A possible matching found item is being reviewed by an administrator.',
        timestamp: supportCase.updatedAt,
      });
    }

    if (supportCase.status === 'MATCH_CONFIRMED' || supportCase.lostItem?.recoveryStatus === 'MATCH_CONFIRMED') {
      timeline.push({
        label: 'Match Confirmed',
        status: 'MATCH_CONFIRMED',
        message: 'An administrator confirmed that a matching item was found.',
        timestamp: supportCase.lostItem?.foundAt || supportCase.updatedAt,
      });
    }

    if (supportCase.status === 'RETURN_IN_PROGRESS' || supportCase.lostItem?.recoveryStatus === 'RETURN_IN_PROGRESS') {
      timeline.push({
        label: 'Return In Progress',
        status: 'RETURN_IN_PROGRESS',
        message: 'The return handover is being arranged.',
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

  static async attachPassengerMatchSummaries(formattedCases = []) {
    if (!formattedCases.length) return formattedCases;
    const matches = await LostFoundMatch.find({
      lostItemReport: { $in: formattedCases.map((supportCase) => supportCase.id) },
      status: { $in: ['PENDING_REVIEW', 'CONFIRMED', 'RETURN_IN_PROGRESS', 'COMPLETED'] },
    }).select('lostItemReport status matchScore returnProcess createdAt updatedAt').lean();
    const matchesByLostCase = matches.reduce((map, match) => {
      const key = String(match.lostItemReport);
      map.set(key, [...(map.get(key) || []), {
        id: String(match._id),
        status: match.status,
        matchScore: match.status === 'PENDING_REVIEW' ? undefined : match.matchScore,
        returnProcess: ['RETURN_IN_PROGRESS', 'COMPLETED'].includes(match.status) ? match.returnProcess : undefined,
        createdAt: match.createdAt,
        updatedAt: match.updatedAt,
      }]);
      return map;
    }, new Map());

    return formattedCases.map((supportCase) => ({
      ...supportCase,
      potentialMatches: matchesByLostCase.get(String(supportCase.id)) || [],
    }));
  }

  static async listMyLostItemCases(userId) {
    const cases = await SupportCase.find({
      passenger: userId,
      type: 'LOST_ITEM',
    })
      .populate('responses.responder', 'fullName email role')
      .sort({ createdAt: -1 });

    return this.attachPassengerMatchSummaries(cases.map((supportCase) => this.formatLostItemCase(supportCase)));
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

    const [formattedCase] = await this.attachPassengerMatchSummaries([this.formatLostItemCase(supportCase)]);
    return formattedCase;
  }

  static async getCaseById(caseId) {
    const supportCase = await SupportCase.findById(caseId)
      .populate('passenger', 'fullName email phone')
      .populate('assignedTo', 'fullName email role')
      .populate('adminResponseBy', 'fullName email role')
      .populate('responses.responder', 'fullName email role')
      .populate('conversation.senderId', 'fullName email role')
      .populate('correctiveActions.performedBy', 'fullName email role')
      .populate('auditTrail.actorId', 'fullName email role');

    if (!supportCase) {
      throw new Error('Support case not found');
    }

    return supportCase;
  }

  static async assignFeedback(caseId, adminId, { assignedTo, assignedTeam = 'ADMIN' } = {}) {
    const targetAdminId = assignedTo || adminId;
    const nextTeam = VALID_ASSIGNED_TEAMS.has(assignedTeam) ? assignedTeam : 'ADMIN';
    const admin = await User.findOne({ _id: targetAdminId, role: 'ADMIN' }).select('_id fullName email').lean();

    if (!admin) {
      const error = new Error('Assigned administrator not found');
      error.statusCode = 404;
      throw error;
    }

    const previous = await SupportCase.findById(caseId).select('type status assignedTo assignedTeam assignedAt referenceNumber');

    if (!previous) {
      throw createBusinessError('Support case not found', 404);
    }

    if (previous.type !== 'SERVICE_FEEDBACK') {
      throw createBusinessError('Only feedback tickets can be assigned through this action', 400);
    }

    const nextStatus = previous.status;

    const assignedAt = String(previous.assignedTo || '') === String(targetAdminId) && previous.assignedAt
      ? previous.assignedAt
      : new Date();
    const updatedCase = await SupportCase.findOneAndUpdate(
      { _id: caseId, type: 'SERVICE_FEEDBACK' },
      {
        $set: {
          assignedTo: admin._id,
          assignedTeam: nextTeam,
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
            message: previous.assignedTo ? 'Feedback reassigned' : 'Feedback assigned',
            metadata: {
              previousAssignedTo: previous.assignedTo ? String(previous.assignedTo) : '',
              assignedTo: String(admin._id),
              previousAssignedTeam: previous.assignedTeam || 'UNASSIGNED',
              assignedTeam: nextTeam,
            },
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

  static formatStatusLabel(status) {
    return String(status || '')
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  static buildComplaintNotificationMessage(supportCase, status = supportCase.status) {
    const code = supportCase.referenceNumber || `#${supportCase._id}`;
    const routeText = supportCase.routeName || supportCase.tripCode || 'your reported trip';
    const normalizedStatus = normalizeFeedbackStatus(status);

    const templates = {
      [FEEDBACK_STATUS.IN_REVIEW]: `BusDN has received your complaint ${code} and our team is reviewing it. We will keep you updated when there is new information.`,
      [FEEDBACK_STATUS.INVESTIGATING]: `BusDN is currently investigating your complaint regarding ${routeText}. We will provide an update when the review is completed.`,
      [FEEDBACK_STATUS.WAITING_FOR_INFORMATION]: `BusDN needs additional information from you to continue processing complaint ${code}. Please check the app for more details.`,
      [FEEDBACK_STATUS.ACTION_REQUIRED]: 'Your complaint has been reviewed and the necessary action is being taken by our operations team.',
      [FEEDBACK_STATUS.RESOLVED]: `Your complaint ${code} has been resolved. Please check the app for the resolution details.`,
      [FEEDBACK_STATUS.CLOSED]: `Your complaint ${code} has been closed. Thank you for helping BusDN improve our service.`,
      [FEEDBACK_STATUS.REOPENED]: `Your complaint ${code} has been reopened for further review.`,
    };

    return templates[normalizedStatus] || `Your complaint ${code} has been updated. Please check the BusDN app for details.`;
  }

  static buildLostItemNotificationMessage(supportCase, recoveryStatus = supportCase.lostItem?.recoveryStatus) {
    const code = supportCase.referenceNumber || `#${supportCase._id}`;
    const templates = {
      FOUND: 'Good news! Your reported lost item has been found. Please check the BusDN app for pickup information.',
      RETURNED: `Your lost item report ${code} has been marked as returned. Thank you for using BusDN.`,
      SEARCHING: `BusDN is searching for the lost item reported in case ${code}. We will update you when there is new information.`,
      RETURN_IN_PROGRESS: `BusDN is arranging pickup or return for your lost item report ${code}. Please check the app for details.`,
    };

    return templates[recoveryStatus] || `Your lost item report ${code} has been updated. Please check the BusDN app for details.`;
  }

  static buildNotificationPreview(supportCase, eventStatus = supportCase.status) {
    const passenger = supportCase.passenger || {};
    const email = passenger.email || supportCase.contactEmail || '';
    const isLostItem = supportCase.type === 'LOST_ITEM';
    const message = isLostItem
      ? this.buildLostItemNotificationMessage(supportCase, eventStatus)
      : this.buildComplaintNotificationMessage(supportCase, eventStatus);

    return {
      shouldNotify: isLostItem
        ? CUSTOMER_VISIBLE_LOST_ITEM_STATUSES.has(eventStatus)
        : IMPORTANT_FEEDBACK_STATUSES.has(normalizeFeedbackStatus(eventStatus)),
      title: isLostItem ? 'Lost item update' : 'Complaint update',
      message,
      status: eventStatus,
      channels: {
        inApp: true,
        email: hasValidEmail(email),
      },
      emailAvailable: hasValidEmail(email),
      emailUnavailableReason: hasValidEmail(email) ? '' : 'Passenger does not have a valid email address.',
    };
  }

  static async previewFeedbackNotification(caseId, adminId, { status } = {}) {
    const supportCase = await this.getCaseById(caseId);

    if (supportCase.type !== 'SERVICE_FEEDBACK' && supportCase.type !== 'LOST_ITEM') {
      throw createBusinessError('Notification preview is only available for passenger feedback or lost item cases', 400);
    }

    if (supportCase.type === 'SERVICE_FEEDBACK') {
      this.ensureAssignedToAdmin(supportCase, adminId);
    }

    return this.buildNotificationPreview(supportCase, status || supportCase.status);
  }

  static recordDelivery(supportCase, delivery) {
    supportCase.notificationDeliveries.push({
      channel: delivery.channel,
      notificationId: delivery.notificationId,
      recipient: delivery.recipient,
      status: delivery.status,
      sentAt: delivery.sentAt,
      errorMessage: delivery.errorMessage || '',
      createdAt: new Date(),
    });
  }

  static async sendPassengerCaseNotification(supportCase, adminId, notification = {}) {
    const channels = notification.channels || {};
    const passenger = supportCase.passenger || {};
    const passengerId = passenger._id || passenger;
    const email = passenger.email || supportCase.contactEmail || '';
    const status = notification.status || supportCase.status;
    const preview = this.buildNotificationPreview(supportCase, status);
    const message = String(notification.message || preview.message || '').trim();
    const title = notification.title || preview.title;
    const results = [];

    if (!message) {
      throw createBusinessError('Notification message is required when sending passenger updates', 422);
    }

    if (channels.inApp || channels.email) {
      try {
        const notificationDoc = await notificationService.send({
          type: 'FEEDBACK_RESPONSE',
          title,
          message,
          target: {
            type: 'USER',
            userId: passengerId,
          },
          channels: {
            inApp: Boolean(channels.inApp),
            email: Boolean(channels.email),
            push: false,
          },
          emailRecipients: hasValidEmail(email)
            ? [{ email, fullName: passenger.fullName || 'Passenger' }]
            : [],
          priority: supportCase.priority === 'CRITICAL' ? 'urgent' : 'normal',
          actionUrl: supportCase.type === 'LOST_ITEM' ? `/lost-items/${supportCase._id}` : `/feedback/${supportCase._id}`,
          source: {
            module: 'SupportCase',
            entityId: supportCase._id,
          },
          data: {
            caseId: String(supportCase._id),
            referenceNumber: supportCase.referenceNumber,
            supportCaseType: supportCase.type,
            status,
            statusLabel: this.formatStatusLabel(status),
          },
          deduplicationKey: `feedback:${supportCase._id}:passenger-notification:${status}`,
          createdBy: adminId,
        }, { createdBy: adminId });

        if (channels.inApp) {
          const delivery = {
            channel: 'IN_APP',
            notificationId: notificationDoc._id,
            recipient: String(passengerId),
            status: 'SENT',
            sentAt: new Date(),
          };
          this.recordDelivery(supportCase, delivery);
          results.push(delivery);
        }

        if (channels.email) {
          const emailDelivery = notificationDoc.metadata?.emailDelivery || {};
          const delivery = {
            channel: 'EMAIL',
            recipient: hasValidEmail(email) ? email : 'NO_EMAIL',
            status: hasValidEmail(email) && emailDelivery.failedCount === 0 ? 'SENT' : 'FAILED',
            sentAt: new Date(),
            errorMessage: hasValidEmail(email) ? undefined : 'Passenger does not have a valid email address',
          };
          this.recordDelivery(supportCase, delivery);
          results.push(delivery);
        }
      } catch (error) {
        if (channels.inApp) {
          const delivery = {
            channel: 'IN_APP',
            recipient: String(passengerId),
            status: 'FAILED',
            sentAt: new Date(),
            errorMessage: error.message,
          };
          this.recordDelivery(supportCase, delivery);
          results.push(delivery);
        }

        if (channels.email) {
          const delivery = {
            channel: 'EMAIL',
            recipient: hasValidEmail(email) ? email : 'NO_EMAIL',
            status: 'FAILED',
            sentAt: new Date(),
            errorMessage: hasValidEmail(email) ? error.message : 'Passenger does not have a valid email address',
          };
          this.recordDelivery(supportCase, delivery);
          results.push(delivery);
        }
      }
    }

    if (results.length) {
      this.appendAudit(supportCase, {
        actorId: adminId,
        actorRole: 'ADMIN',
        action: FEEDBACK_ACTION.NOTIFY_PASSENGER,
        previousStatus: supportCase.status,
        newStatus: supportCase.status,
        message: 'Passenger notification processed',
        metadata: { channels: results.map((result) => result.channel), results },
      });
    }

    return results;
  }

  static async addInternalNote(caseId, adminId, data) {
    const supportCase = await this.getCaseById(caseId);

    if (supportCase.type !== 'SERVICE_FEEDBACK' && supportCase.type !== 'COMPLAINT') {
      throw createBusinessError('Internal notes are only available for feedback and complaint cases', 400);
    }

    if (!data.message?.trim()) {
      throw createBusinessError('Internal note is required', 422);
    }

    supportCase.responses.push({
      message: data.message.trim(),
      responder: adminId,
      statusBefore: supportCase.status,
      statusAfter: supportCase.status,
      responseType: 'INTERNAL_NOTE',
      visibleToPassenger: false,
      createdAt: new Date(),
    });
    this.appendAudit(supportCase, {
      actorId: adminId,
      actorRole: 'ADMIN',
      action: FEEDBACK_ACTION.INTERNAL_NOTE,
      previousStatus: supportCase.status,
      newStatus: supportCase.status,
      message: data.message.trim(),
    });

    await supportCase.save();
    return this.getCaseById(caseId);
  }

  static async addCorrectiveAction(caseId, adminId, data) {
    const supportCase = await this.getCaseById(caseId);
    const actionType = data.actionType || 'OTHER';
    const description = String(data.description || '').trim();

    if (supportCase.type !== 'SERVICE_FEEDBACK' && supportCase.type !== 'COMPLAINT') {
      throw createBusinessError('Corrective actions are only available for feedback and complaint cases', 400);
    }

    if (!CORRECTIVE_ACTION_TYPES.has(actionType)) {
      throw createBusinessError('Corrective action type is invalid', 422);
    }

    if (!description) {
      throw createBusinessError('Corrective action description is required', 422);
    }

    supportCase.correctiveActions.push({
      actionType,
      description,
      performedBy: adminId,
      performedAt: data.performedAt ? new Date(data.performedAt) : new Date(),
      createdAt: new Date(),
    });
    this.appendAudit(supportCase, {
      actorId: adminId,
      actorRole: 'ADMIN',
      action: FEEDBACK_ACTION.CORRECTIVE_ACTION,
      previousStatus: supportCase.status,
      newStatus: supportCase.status,
      message: description,
      metadata: { actionType },
    });

    await supportCase.save();
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
    const previousPriority = supportCase.priority;
    this.ensureAssignedToAdmin(supportCase, adminId);

    if (isTerminalFeedbackStatus(supportCase.status)) {
      throw createBusinessError('Closed feedback cannot be updated', 409);
    }

    const hasMessage = Boolean(data.message?.trim());
    const hasResolution = Boolean(data.resolutionSummary?.trim() || supportCase.resolutionSummary?.trim());
    const hasWaitingReason = Boolean(data.waitingForInformationReason?.trim() || supportCase.waitingForInformationReason?.trim() || hasMessage);
    const incomingCorrectiveAction = data.correctiveAction || null;
    const incomingCorrectiveDescription = String(incomingCorrectiveAction?.description || data.actionDescription || '').trim();
    const hasCorrectiveAction = Boolean(
      incomingCorrectiveDescription
      || (supportCase.correctiveActions || []).length
    );
    const nextStatus = data.status ? assertFeedbackTransition(supportCase.status, data.status) : supportCase.status;

    if (data.priority && !FEEDBACK_PRIORITIES.includes(data.priority)) {
      throw createBusinessError('Priority must be LOW, NORMAL, HIGH, or CRITICAL', 422);
    }

    if (nextStatus === FEEDBACK_STATUS.WAITING_FOR_INFORMATION && !hasWaitingReason) {
      throw createBusinessError('Waiting for information requires a reason or passenger-facing request', 422);
    }

    if (nextStatus === FEEDBACK_STATUS.ACTION_REQUIRED && !hasCorrectiveAction) {
      throw createBusinessError('Action required status requires an action description or corrective action', 422);
    }

    if (nextStatus === FEEDBACK_STATUS.RESOLVED && !hasResolution) {
      throw createBusinessError('Resolution summary is required before resolving feedback', 422);
    }

    if (nextStatus === FEEDBACK_STATUS.RESOLVED && !hasCorrectiveAction) {
      throw createBusinessError('Record a corrective action or outcome before resolving feedback', 422);
    }

    if (
      nextStatus === FEEDBACK_STATUS.CLOSED
      && ![FEEDBACK_STATUS.RESOLVED, FEEDBACK_STATUS.WAITING_FOR_INFORMATION].includes(normalizeFeedbackStatus(supportCase.status))
    ) {
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

    if (data.waitingForInformationReason?.trim()) {
      supportCase.waitingForInformationReason = data.waitingForInformationReason.trim();
    }

    if (data.priority) {
      supportCase.priority = data.priority;
      supportCase.priorityReason = data.priorityReason?.trim() || 'Priority manually updated by admin';
      supportCase.slaDueAt = this.calculateSlaDueAt(data.priority, supportCase.createdAt || new Date());
    }

    if (incomingCorrectiveDescription) {
      const actionType = incomingCorrectiveAction?.actionType || 'OTHER';
      if (!CORRECTIVE_ACTION_TYPES.has(actionType)) {
        throw createBusinessError('Corrective action type is invalid', 422);
      }
      supportCase.correctiveActions.push({
        actionType,
        description: incomingCorrectiveDescription,
        performedBy: adminId,
        performedAt: incomingCorrectiveAction?.performedAt ? new Date(incomingCorrectiveAction.performedAt) : new Date(),
        createdAt: new Date(),
      });
      this.appendAudit(supportCase, {
        actorId: adminId,
        actorRole: 'ADMIN',
        action: FEEDBACK_ACTION.CORRECTIVE_ACTION,
        previousStatus,
        newStatus: nextStatus,
        message: incomingCorrectiveDescription,
        metadata: { actionType },
      });
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

    if (nextStatus === FEEDBACK_STATUS.REOPENED) {
      supportCase.resolvedAt = null;
      supportCase.closedAt = null;
    }

    if (previousPriority !== supportCase.priority) {
      this.appendAudit(supportCase, {
        actorId: adminId,
        actorRole: 'ADMIN',
        action: FEEDBACK_ACTION.CHANGE_PRIORITY,
        previousStatus,
        newStatus: nextStatus,
        message: 'Priority changed',
        metadata: {
          previousPriority,
          newPriority: supportCase.priority,
          priorityReason: supportCase.priorityReason,
        },
      });
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
        waitingForInformationReason: supportCase.waitingForInformationReason,
      },
    });

    await supportCase.save();

    let notificationResults = [];
    if (data.notification?.confirmSend) {
      notificationResults = await this.sendPassengerCaseNotification(supportCase, adminId, {
        ...data.notification,
        status: nextStatus,
      });
      await supportCase.save();
    }

    const updatedCase = await this.getCaseById(caseId);
    updatedCase.notificationResults = notificationResults;
    return updatedCase;
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
    const validStatusTransitions = {
      WAITING_FOR_MATCH: ['POTENTIAL_MATCH', 'UNDER_REVIEW', 'IN_PROGRESS', 'CANCELLED', 'CLOSED'],
      SUBMITTED: ['WAITING_FOR_MATCH', 'UNDER_REVIEW', 'IN_PROGRESS', 'CANCELLED', 'CLOSED'],
      OPEN: ['WAITING_FOR_MATCH', 'UNDER_REVIEW', 'IN_PROGRESS', 'CANCELLED', 'CLOSED'],
      POTENTIAL_MATCH: ['WAITING_FOR_MATCH', 'UNDER_REVIEW', 'MATCH_CONFIRMED', 'CANCELLED', 'CLOSED'],
      UNDER_REVIEW: ['WAITING_FOR_MATCH', 'MATCH_CONFIRMED', 'IN_PROGRESS', 'CANCELLED', 'CLOSED'],
      IN_PROGRESS: ['WAITING_FOR_MATCH', 'MATCH_CONFIRMED', 'RETURN_IN_PROGRESS', 'CANCELLED', 'CLOSED'],
      MATCH_CONFIRMED: ['RETURN_IN_PROGRESS', 'CANCELLED', 'CLOSED'],
      RETURN_IN_PROGRESS: ['RETURNED', 'RESOLVED', 'CANCELLED', 'CLOSED'],
      RETURNED: ['RESOLVED', 'CLOSED'],
      RESOLVED: ['CLOSED'],
      CLOSED: [],
      CANCELLED: [],
      REJECTED: [],
    };
    const nextStatus = data.status || supportCase.status;

    if (data.status && data.status !== supportCase.status) {
      const allowedNextStatuses = validStatusTransitions[supportCase.status] || [];
      if (!allowedNextStatuses.includes(data.status)) {
        throw createBusinessError(`Invalid lost item status transition from ${supportCase.status} to ${data.status}`, 409);
      }
    }

    if (['RETURNED', 'RESOLVED'].includes(nextStatus) || data.recoveryStatus === 'RETURNED') {
      const confirmedMatch = await LostFoundMatch.exists({
        lostItemReport: supportCase._id,
        status: { $in: ['CONFIRMED', 'RETURN_IN_PROGRESS', 'COMPLETED'] },
      });
      if (!confirmedMatch) {
        throw createBusinessError('Cannot mark a lost item as returned without a confirmed match', 409);
      }
    }

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

    let notificationResults = [];
    if (data.notification?.confirmSend) {
      notificationResults = await this.sendPassengerCaseNotification(supportCase, adminId, {
        ...data.notification,
        status: data.recoveryStatus || supportCase.lostItem?.recoveryStatus || supportCase.status,
      });
      await supportCase.save();
    }

    const updatedCase = await this.getCaseById(caseId);
    updatedCase.notificationResults = notificationResults;
    return updatedCase;
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
    if (supportCase.status === 'RETURN_IN_PROGRESS' || supportCase.lostItem?.recoveryStatus === 'RETURN_IN_PROGRESS') return 'ACKNOWLEDGED';
    if (supportCase.status === 'MATCH_CONFIRMED' || supportCase.lostItem?.recoveryStatus === 'MATCH_CONFIRMED') return 'ACKNOWLEDGED';
    if (supportCase.status === 'POTENTIAL_MATCH' || supportCase.lostItem?.recoveryStatus === 'POTENTIAL_MATCH') return 'ACKNOWLEDGED';
    if (['UNDER_REVIEW', 'IN_PROGRESS', 'RESPONDED', 'WAITING_FOR_PASSENGER'].includes(supportCase.status)) {
      return 'ACKNOWLEDGED';
    }
    return 'OPEN';
  }

  static buildPassengerLostItemQuery({ status, recoveryStatus }) {
    const query = { type: 'LOST_ITEM' };

    if (status && status !== 'ALL') {
      const statusMap = {
        OPEN: ['SUBMITTED', 'OPEN', 'WAITING_FOR_MATCH'],
        ACKNOWLEDGED: ['UNDER_REVIEW', 'IN_PROGRESS', 'RESPONDED', 'WAITING_FOR_PASSENGER', 'POTENTIAL_MATCH', 'MATCH_CONFIRMED', 'RETURN_IN_PROGRESS'],
        RESOLVED: ['RESOLVED', 'RETURNED'],
        CANCELLED: ['CLOSED', 'REJECTED', 'CANCELLED'],
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
    if (recoveryStatus === 'POTENTIAL_MATCH') return 'ACKNOWLEDGED';
    if (recoveryStatus === 'MATCHED') return 'ACKNOWLEDGED';
    if (recoveryStatus === 'RETURN_IN_PROGRESS') return 'ACKNOWLEDGED';
    if (recoveryStatus === 'RETURNED') return 'RESOLVED';
    if (recoveryStatus === 'CANCELLED') return 'CANCELLED';
    return 'OPEN';
  }

  static async updateFoundItemCase(caseId, adminId, data) {
    const incident = await this.getFoundItemCaseById(caseId);
    const recoveryStatus = data.recoveryStatus || incident.foundItem?.recoveryStatus || 'REPORTED';
    const status = this.mapFoundItemRecoveryStatus(recoveryStatus);
    const now = new Date();

    if (recoveryStatus === 'RETURNED') {
      const confirmedMatch = await LostFoundMatch.exists({
        foundItemReport: incident._id,
        status: { $in: ['CONFIRMED', 'RETURN_IN_PROGRESS', 'COMPLETED'] },
      });
      if (!confirmedMatch) {
        throw createBusinessError('Cannot mark a found item as returned without a confirmed match', 409);
      }
    }

    incident.foundItem = {
      ...(incident.foundItem || {}),
      recoveryStatus,
      handedTo: data.handedTo !== undefined
        ? String(data.handedTo || '').trim()
        : incident.foundItem?.handedTo || '',
      storageLocation: data.storageLocation !== undefined
        ? String(data.storageLocation || '').trim()
        : incident.foundItem?.storageLocation || '',
      storageReference: data.storageReference !== undefined
        ? String(data.storageReference || '').trim()
        : incident.foundItem?.storageReference || '',
      handedOverAt: recoveryStatus === 'RETURNED'
        ? incident.foundItem?.handedOverAt || now
        : incident.foundItem?.handedOverAt || null,
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
