import mongoose from 'mongoose';
import SupportCase from './SupportCase.js';
import LostFoundMatch from './LostFoundMatch.js';
import OperationIncident from '../scheduleOperations/OperationIncident.js';
import User from '../auth/User.js';
import AuditLog from '../systemMonitoring/AuditLog.js';
import { createBroadcastNotification } from '../systemNotifications/systemNotification.service.js';

const HIGH_MATCH_THRESHOLD = 70;
const CANDIDATE_WINDOW_DAYS = 3;
const TIME_PROXIMITY_HOURS = 6;
const CLOSED_LOST_STATUSES = ['RESOLVED', 'CLOSED', 'REJECTED', 'RETURNED', 'CANCELLED'];
const CLOSED_FOUND_RECOVERY_STATUSES = ['MATCHED', 'RETURN_IN_PROGRESS', 'RETURNED', 'CANCELLED'];
const LOST_OPEN_STATUSES = ['OPEN', 'SUBMITTED', 'WAITING_FOR_MATCH', 'POTENTIAL_MATCH', 'UNDER_REVIEW', 'IN_PROGRESS'];
const FOUND_OPEN_STATUSES = ['REPORTED', 'STORED', 'POTENTIAL_MATCH'];

const normalize = (value) => String(value || '').trim().toLowerCase();
const hasObjectId = (value) => mongoose.isValidObjectId(value);

const tokenize = (value) => normalize(value)
  .split(/[^a-z0-9]+/i)
  .filter((token) => token.length >= 3);

const includesText = (left, right) => {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
};

const sharedTokenMatch = (left, right) => {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = tokenize(right);
  if (!leftTokens.size || !rightTokens.length) return false;
  return rightTokens.some((token) => leftTokens.has(token));
};

const hoursBetween = (left, right) => {
  if (!left || !right) return null;
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) return null;
  return Math.abs(leftDate.getTime() - rightDate.getTime()) / 36e5;
};

const dayWindow = (dateValue) => {
  const date = dateValue ? new Date(dateValue) : new Date();
  const center = Number.isNaN(date.getTime()) ? new Date() : date;
  const start = new Date(center);
  start.setDate(start.getDate() - CANDIDATE_WINDOW_DAYS);
  const end = new Date(center);
  end.setDate(end.getDate() + CANDIDATE_WINDOW_DAYS);
  return { start, end };
};

const getLostTime = (lostReport) => lostReport?.lostItem?.lostAt || lostReport?.incidentAt || lostReport?.createdAt;
const getFoundTime = (foundReport) => foundReport?.reportedAt || foundReport?.createdAt;

const getTripLabels = (record = {}) => [
  record.tripId,
  record.relatedTripId,
  record.tripCode,
  record.trip?.scheduleCode,
  record.trip?._id,
].map(normalize).filter(Boolean);

const getRouteLabels = (record = {}) => [
  record.routeId,
  record.route?._id,
  record.route?.routeNumber,
  record.route?.routeCode,
  record.route?.routeName,
  record.route?.name,
  record.routeName,
].map(normalize).filter(Boolean);

const getVehicleLabels = (record = {}) => [
  record.vehicle,
  record.vehicle?._id,
  record.vehicle?.busCode,
  record.vehicle?.plateNumber,
  record.busPlate,
].map(normalize).filter(Boolean);

const intersects = (left = [], right = []) => left.some((value) => right.includes(value));

const publicAdminActionUrl = (matchId) => `/admin/lost-items?matchId=${matchId}`;

const buildAuditLog = async ({ actorId, actorRole = 'SYSTEM', action, resourceType, resourceId, metadata = {} }) => {
  await AuditLog.create({
    userId: actorId || null,
    userRole: actorRole,
    action,
    module: 'LOST_FOUND',
    resourceType,
    resourceId,
    metadata,
  });
};

const appendSupportAudit = (supportCase, action, { actorId = null, actorRole = 'SYSTEM', previousStatus, newStatus, message = '', metadata = {} } = {}) => {
  supportCase.auditTrail.push({
    actorId,
    actorRole,
    action,
    previousStatus,
    newStatus,
    message,
    metadata,
    createdAt: new Date(),
  });
};

const updateLostStatusForPotentialMatch = async (lostReport, matchId) => {
  if (CLOSED_LOST_STATUSES.includes(lostReport.status)) return;
  const previousStatus = lostReport.status;
  lostReport.status = 'POTENTIAL_MATCH';
  lostReport.lostItem = lostReport.lostItem || {};
  lostReport.lostItem.recoveryStatus = 'POTENTIAL_MATCH';
  appendSupportAudit(lostReport, 'MATCH_GENERATED', {
    previousStatus,
    newStatus: lostReport.status,
    message: 'System generated a potential found-item match for admin review',
    metadata: { matchId: String(matchId) },
  });
  await lostReport.save();
};

const updateFoundStatusForPotentialMatch = async (foundReport) => {
  if (CLOSED_FOUND_RECOVERY_STATUSES.includes(foundReport.foundItem?.recoveryStatus)) return;
  await OperationIncident.updateOne(
    { _id: foundReport._id, type: 'FOUND_ITEM' },
    {
      $set: {
        status: foundReport.status === 'RESOLVED' ? foundReport.status : 'ACKNOWLEDGED',
        'foundItem.recoveryStatus': 'POTENTIAL_MATCH',
      },
    }
  );
};

const createLostFoundNotification = async (payload) => {
  try {
    let creatorId = payload.createdBy || null;
    if (!creatorId) {
      const admin = await User.findOne({ role: 'ADMIN', status: 'ACTIVE' }).select('_id').lean();
      creatorId = admin?._id || null;
    }
    if (!creatorId) return null;
    return await createBroadcastNotification(payload, creatorId);
  } catch {
    return null;
  }
};

export class LostAndFoundMatchingService {
  static calculateMatchScore(lostReport, foundReport) {
    const lostItem = lostReport?.lostItem || {};
    const foundItem = foundReport?.foundItem || {};
    const factors = {
      vehicle: intersects(getVehicleLabels(lostReport), getVehicleLabels(foundReport)),
      route: intersects(getRouteLabels(lostReport), getRouteLabels(foundReport)),
      trip: intersects(getTripLabels(lostReport), getTripLabels(foundReport)),
      timeProximity: false,
      category: Boolean(lostItem.itemCategory && foundItem.itemCategory && lostItem.itemCategory === foundItem.itemCategory),
      name: includesText(lostItem.itemName, foundItem.itemName),
      color: includesText(lostItem.color, foundItem.color),
      brand: includesText(lostItem.brand, foundItem.brand),
      description: sharedTokenMatch(
        `${lostItem.itemDescription || ''} ${lostItem.identifyingDetails || ''}`,
        `${foundItem.itemDescription || foundReport?.description || ''} ${foundItem.identifyingDetails || ''}`
      ),
    };

    const proximity = hoursBetween(getLostTime(lostReport), getFoundTime(foundReport));
    factors.timeProximity = proximity !== null && proximity <= TIME_PROXIMITY_HOURS;

    const score = [
      factors.vehicle ? 20 : 0,
      factors.route ? 20 : 0,
      factors.trip ? 15 : 0,
      factors.timeProximity ? 15 : 0,
      factors.category ? 10 : 0,
      factors.name ? 5 : 0,
      factors.color ? 5 : 0,
      factors.brand ? 5 : 0,
      factors.description ? 5 : 0,
    ].reduce((sum, value) => sum + value, 0);

    return {
      score,
      factors: {
        ...factors,
        timeDeltaHours: proximity === null ? null : Number(proximity.toFixed(2)),
      },
    };
  }

  static buildFoundCandidateQuery(lostReport) {
    const { start, end } = dayWindow(getLostTime(lostReport));
    const routeId = lostReport.routeId?._id || lostReport.routeId || null;
    const query = {
      type: 'FOUND_ITEM',
      status: { $in: ['OPEN', 'ACKNOWLEDGED'] },
      'foundItem.recoveryStatus': { $in: FOUND_OPEN_STATUSES },
      reportedAt: { $gte: start, $lte: end },
    };

    if (routeId && hasObjectId(routeId)) {
      query.$or = [{ route: routeId }];
    }

    return query;
  }

  static buildLostCandidateQuery(foundReport) {
    const { start, end } = dayWindow(getFoundTime(foundReport));
    const query = {
      type: 'LOST_ITEM',
      status: { $in: LOST_OPEN_STATUSES },
      'lostItem.recoveryStatus': { $in: ['REPORTED', 'SEARCHING', 'POTENTIAL_MATCH'] },
      $or: [
        { incidentAt: { $gte: start, $lte: end } },
        { 'lostItem.lostAt': { $gte: start, $lte: end } },
      ],
    };

    return query;
  }

  static async findFoundCandidates(lostReport) {
    return OperationIncident.find(this.buildFoundCandidateQuery(lostReport))
      .populate('route', 'routeNumber routeCode routeName name')
      .populate('vehicle', 'busCode plateNumber')
      .populate('trip', 'scheduleCode routeName serviceDate departureTime')
      .limit(50);
  }

  static async findLostCandidates(foundReport) {
    return SupportCase.find(this.buildLostCandidateQuery(foundReport))
      .populate('passenger', 'fullName email phone phoneNumber role')
      .limit(50);
  }

  static async createPotentialMatchIfStrong(lostReport, foundReport, actor = { role: 'SYSTEM' }) {
    const { score, factors } = this.calculateMatchScore(lostReport, foundReport);
    if (score < HIGH_MATCH_THRESHOLD) {
      return null;
    }

    const existingMatch = await LostFoundMatch.findOne({
      lostItemReport: lostReport._id,
      foundItemReport: foundReport._id,
    });
    if (existingMatch) {
      return existingMatch;
    }

    let match;
    try {
      match = await LostFoundMatch.findOneAndUpdate(
        {
          lostItemReport: lostReport._id,
          foundItemReport: foundReport._id,
        },
        {
          $setOnInsert: {
            lostItemReport: lostReport._id,
            foundItemReport: foundReport._id,
            matchScore: score,
            matchingFactors: factors,
            status: 'PENDING_REVIEW',
          },
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      if (error?.code === 11000) {
        match = await LostFoundMatch.findOne({
          lostItemReport: lostReport._id,
          foundItemReport: foundReport._id,
        });
      } else {
        throw error;
      }
    }

    if (match.status !== 'PENDING_REVIEW') {
      return match;
    }

    await Promise.all([
      updateLostStatusForPotentialMatch(lostReport, match._id),
      updateFoundStatusForPotentialMatch(foundReport),
      buildAuditLog({
        actorId: actor.userId,
        actorRole: actor.role || 'SYSTEM',
        action: 'MATCH_GENERATED',
        resourceType: 'LostFoundMatch',
        resourceId: match._id,
        metadata: {
          lostItemReport: String(lostReport._id),
          foundItemReport: String(foundReport._id),
          matchScore: score,
          matchingFactors: factors,
        },
      }),
      createLostFoundNotification({
        title: 'Potential lost-and-found match detected',
        message: `Match score ${score}% for lost item case ${lostReport.referenceNumber || lostReport._id}. Admin review is required.`,
        type: 'general',
        priority: score >= 85 ? 'urgent' : 'normal',
        targetAudience: 'admins',
        actionUrl: publicAdminActionUrl(match._id),
        sourceType: 'LostFoundMatch',
        sourceId: match._id,
        metadata: {
          matchId: String(match._id),
          lostItemReportId: String(lostReport._id),
          foundItemReportId: String(foundReport._id),
          matchScore: score,
        },
      }),
    ]);

    return match;
  }

  static async runForLostItem(lostReportId, actor = { role: 'SYSTEM' }) {
    const lostReport = await SupportCase.findOne({ _id: lostReportId, type: 'LOST_ITEM' });
    if (!lostReport || CLOSED_LOST_STATUSES.includes(lostReport.status)) return [];
    const candidates = await this.findFoundCandidates(lostReport);
    const matches = await Promise.all(
      candidates.map((foundReport) => this.createPotentialMatchIfStrong(lostReport, foundReport, actor))
    );
    return matches.filter(Boolean);
  }

  static async runForFoundItem(foundReportId, actor = { role: 'SYSTEM' }) {
    const foundReport = await OperationIncident.findOne({ _id: foundReportId, type: 'FOUND_ITEM' })
      .populate('route', 'routeNumber routeCode routeName name')
      .populate('vehicle', 'busCode plateNumber')
      .populate('trip', 'scheduleCode routeName serviceDate departureTime');
    if (!foundReport || CLOSED_FOUND_RECOVERY_STATUSES.includes(foundReport.foundItem?.recoveryStatus)) return [];
    const candidates = await this.findLostCandidates(foundReport);
    const matches = await Promise.all(
      candidates.map((lostReport) => this.createPotentialMatchIfStrong(lostReport, foundReport, actor))
    );
    return matches.filter(Boolean);
  }

  static async listMatches({ status = 'PENDING_REVIEW', page = 1, limit = 20 } = {}) {
    const normalizedPage = Math.max(Number(page) || 1, 1);
    const normalizedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const query = status && status !== 'ALL' ? { status } : {};

    const [items, total] = await Promise.all([
      LostFoundMatch.find(query)
        .populate({
          path: 'lostItemReport',
          populate: { path: 'passenger', select: 'fullName email phone phoneNumber role' },
        })
        .populate({
          path: 'foundItemReport',
          populate: [
            { path: 'driver', select: 'fullName email phone phoneNumber role' },
            { path: 'route', select: 'routeNumber routeCode routeName name' },
            { path: 'vehicle', select: 'busCode plateNumber' },
            { path: 'trip', select: 'scheduleCode routeName serviceDate departureTime' },
          ],
        })
        .populate('reviewedBy', 'fullName email role')
        .populate('returnProcess.responsibleStaff', 'fullName email role')
        .sort({ matchScore: -1, createdAt: -1 })
        .skip((normalizedPage - 1) * normalizedLimit)
        .limit(normalizedLimit),
      LostFoundMatch.countDocuments(query),
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

  static async getMatchById(matchId) {
    const match = await LostFoundMatch.findById(matchId)
      .populate({
        path: 'lostItemReport',
        populate: { path: 'passenger', select: 'fullName email phone phoneNumber role' },
      })
      .populate({
        path: 'foundItemReport',
        populate: [
          { path: 'driver', select: 'fullName email phone phoneNumber role' },
          { path: 'route', select: 'routeNumber routeCode routeName name' },
          { path: 'vehicle', select: 'busCode plateNumber' },
          { path: 'trip', select: 'scheduleCode routeName serviceDate departureTime' },
        ],
      })
      .populate('reviewedBy', 'fullName email role')
      .populate('returnProcess.responsibleStaff', 'fullName email role');

    if (!match) {
      const error = new Error('Potential match not found');
      error.statusCode = 404;
      throw error;
    }
    return match;
  }

  static async confirmMatch(matchId, adminId, { adminNote = '' } = {}) {
    const match = await LostFoundMatch.findById(matchId);
    if (!match) {
      const error = new Error('Potential match not found');
      error.statusCode = 404;
      throw error;
    }
    if (match.status !== 'PENDING_REVIEW') {
      const error = new Error('Only pending matches can be confirmed');
      error.statusCode = 409;
      throw error;
    }

    const conflictingMatch = await LostFoundMatch.exists({
      _id: { $ne: match._id },
      foundItemReport: match.foundItemReport,
      status: { $in: ['CONFIRMED', 'RETURN_IN_PROGRESS', 'COMPLETED'] },
    });
    if (conflictingMatch) {
      const error = new Error('Found item has already been assigned to another lost item case');
      error.statusCode = 409;
      throw error;
    }

    const now = new Date();
    const foundUpdate = await OperationIncident.findOneAndUpdate(
      {
        _id: match.foundItemReport,
        type: 'FOUND_ITEM',
        'foundItem.recoveryStatus': { $nin: CLOSED_FOUND_RECOVERY_STATUSES },
      },
      {
        $set: {
          status: 'ACKNOWLEDGED',
          'foundItem.recoveryStatus': 'MATCHED',
          acknowledgedAt: now,
        },
      },
      { new: true }
    );
    if (!foundUpdate) {
      const error = new Error('Found item is no longer available for matching');
      error.statusCode = 409;
      throw error;
    }

    const lostUpdate = await SupportCase.findOneAndUpdate(
      {
        _id: match.lostItemReport,
        type: 'LOST_ITEM',
        status: { $nin: CLOSED_LOST_STATUSES },
      },
      {
        $set: {
          status: 'MATCH_CONFIRMED',
          'lostItem.recoveryStatus': 'MATCH_CONFIRMED',
          'lostItem.foundAt': now,
          assignedTo: adminId,
        },
        $push: {
          auditTrail: {
            actorId: adminId,
            actorRole: 'ADMIN',
            action: 'MATCH_CONFIRMED',
            previousStatus: 'POTENTIAL_MATCH',
            newStatus: 'MATCH_CONFIRMED',
            message: 'Administrator confirmed the found item match',
            metadata: { matchId: String(match._id) },
            createdAt: now,
          },
        },
      },
      { new: true }
    );
    if (!lostUpdate) {
      const error = new Error('Lost item case is no longer available for matching');
      error.statusCode = 409;
      throw error;
    }

    const updatedMatch = await LostFoundMatch.findOneAndUpdate(
      { _id: match._id, status: 'PENDING_REVIEW' },
      {
        $set: {
          status: 'CONFIRMED',
          reviewedBy: adminId,
          reviewedAt: now,
          adminNote: String(adminNote || '').trim(),
        },
      },
      { new: true }
    );
    if (!updatedMatch) {
      const error = new Error('Match review changed. Please refresh and try again.');
      error.statusCode = 409;
      throw error;
    }

    await Promise.all([
      buildAuditLog({
        actorId: adminId,
        actorRole: 'ADMIN',
        action: 'MATCH_CONFIRMED',
        resourceType: 'LostFoundMatch',
        resourceId: match._id,
        metadata: {
          lostItemReport: String(match.lostItemReport),
          foundItemReport: String(match.foundItemReport),
        },
      }),
      createLostFoundNotification({
        title: 'Đã tìm thấy món đồ phù hợp',
        message: `BusDN đã xác nhận món đồ phù hợp với hồ sơ ${lostUpdate.referenceNumber}. Chúng tôi sẽ tiếp tục sắp xếp trả đồ.`,
        type: 'general',
        priority: 'normal',
        targetAudience: 'specific_users',
        userIds: [lostUpdate.passenger],
        actionUrl: `/lost-items/${lostUpdate._id}`,
        sourceType: 'SupportCase',
        sourceId: lostUpdate._id,
        metadata: {
          matchId: String(match._id),
          caseId: String(lostUpdate._id),
          supportCaseType: 'LOST_ITEM',
          referenceNumber: lostUpdate.referenceNumber,
        },
      }),
    ]);

    return this.getMatchById(match._id);
  }

  static async rejectMatch(matchId, adminId, { rejectionReason, adminNote = '' } = {}) {
    if (!String(rejectionReason || '').trim()) {
      const error = new Error('Rejection reason is required');
      error.statusCode = 422;
      throw error;
    }

    const now = new Date();
    const match = await LostFoundMatch.findOneAndUpdate(
      { _id: matchId, status: 'PENDING_REVIEW' },
      {
        $set: {
          status: 'REJECTED',
          reviewedBy: adminId,
          reviewedAt: now,
          rejectionReason: String(rejectionReason).trim(),
          adminNote: String(adminNote || '').trim(),
        },
      },
      { new: true }
    );
    if (!match) {
      const error = new Error('Only pending matches can be rejected');
      error.statusCode = 409;
      throw error;
    }

    await Promise.all([
      SupportCase.updateOne(
        { _id: match.lostItemReport, type: 'LOST_ITEM', status: 'POTENTIAL_MATCH' },
        {
          $set: { status: 'WAITING_FOR_MATCH', 'lostItem.recoveryStatus': 'SEARCHING' },
          $push: {
            auditTrail: {
              actorId: adminId,
              actorRole: 'ADMIN',
              action: 'MATCH_REJECTED',
              previousStatus: 'POTENTIAL_MATCH',
              newStatus: 'WAITING_FOR_MATCH',
              message: 'Administrator rejected a potential found-item match',
              metadata: { matchId: String(match._id), rejectionReason: match.rejectionReason },
              createdAt: now,
            },
          },
        }
      ),
      OperationIncident.updateOne(
        { _id: match.foundItemReport, type: 'FOUND_ITEM', 'foundItem.recoveryStatus': 'POTENTIAL_MATCH' },
        { $set: { status: 'ACKNOWLEDGED', 'foundItem.recoveryStatus': 'STORED' } }
      ),
      buildAuditLog({
        actorId: adminId,
        actorRole: 'ADMIN',
        action: 'MATCH_REJECTED',
        resourceType: 'LostFoundMatch',
        resourceId: match._id,
        metadata: {
          rejectionReason: match.rejectionReason,
          lostItemReport: String(match.lostItemReport),
          foundItemReport: String(match.foundItemReport),
        },
      }),
    ]);

    return this.getMatchById(match._id);
  }

  static async startReturn(matchId, adminId, data = {}) {
    const match = await LostFoundMatch.findOneAndUpdate(
      { _id: matchId, status: 'CONFIRMED' },
      {
        $set: {
          status: 'RETURN_IN_PROGRESS',
          'returnProcess.method': data.method || 'PICKUP_AT_BUS_STATION',
          'returnProcess.location': String(data.location || '').trim(),
          'returnProcess.scheduledAt': data.scheduledAt ? new Date(data.scheduledAt) : null,
          'returnProcess.responsibleStaff': data.responsibleStaff || adminId,
          'returnProcess.note': String(data.note || '').trim(),
          'returnProcess.startedAt': new Date(),
          'returnProcess.startedBy': adminId,
        },
      },
      { new: true }
    );
    if (!match) {
      const error = new Error('Return process can only start from a confirmed match');
      error.statusCode = 409;
      throw error;
    }

    const now = new Date();
    const lostCase = await SupportCase.findByIdAndUpdate(
      match.lostItemReport,
      {
        $set: { status: 'RETURN_IN_PROGRESS', 'lostItem.recoveryStatus': 'RETURN_IN_PROGRESS' },
        $push: {
          auditTrail: {
            actorId: adminId,
            actorRole: 'ADMIN',
            action: 'RETURN_STARTED',
            previousStatus: 'MATCH_CONFIRMED',
            newStatus: 'RETURN_IN_PROGRESS',
            message: 'Return process started',
            metadata: { matchId: String(match._id), method: data.method },
            createdAt: now,
          },
        },
      },
      { new: true }
    );
    await OperationIncident.updateOne(
      { _id: match.foundItemReport, type: 'FOUND_ITEM', 'foundItem.recoveryStatus': 'MATCHED' },
      { $set: { status: 'ACKNOWLEDGED', 'foundItem.recoveryStatus': 'RETURN_IN_PROGRESS' } }
    );

    await Promise.all([
      buildAuditLog({
        actorId: adminId,
        actorRole: 'ADMIN',
        action: 'RETURN_STARTED',
        resourceType: 'LostFoundMatch',
        resourceId: match._id,
        metadata: data,
      }),
      lostCase?.passenger ? createLostFoundNotification({
        title: 'Đang sắp xếp trả đồ thất lạc',
        message: `BusDN đang sắp xếp trả đồ cho hồ sơ ${lostCase.referenceNumber}. Vui lòng mở ứng dụng để xem chi tiết.`,
        type: 'general',
        priority: 'normal',
        targetAudience: 'specific_users',
        userIds: [lostCase.passenger],
        actionUrl: `/lost-items/${lostCase._id}`,
        sourceType: 'SupportCase',
        sourceId: lostCase._id,
        metadata: {
          matchId: String(match._id),
          caseId: String(lostCase._id),
          supportCaseType: 'LOST_ITEM',
          referenceNumber: lostCase.referenceNumber,
        },
      }) : null,
    ]);

    return this.getMatchById(match._id);
  }

  static async completeReturn(matchId, adminId, data = {}) {
    const match = await LostFoundMatch.findOneAndUpdate(
      { _id: matchId, status: 'RETURN_IN_PROGRESS' },
      {
        $set: {
          status: 'COMPLETED',
          'returnProcess.returnedAt': data.returnedAt ? new Date(data.returnedAt) : new Date(),
          'returnProcess.returnedBy': adminId,
          'returnProcess.receiverName': String(data.receiverName || '').trim(),
          'returnProcess.proofReference': String(data.proofReference || '').trim(),
          'returnProcess.handoverNote': String(data.handoverNote || '').trim(),
        },
      },
      { new: true }
    );
    if (!match) {
      const error = new Error('Item return requires a return process in progress');
      error.statusCode = 409;
      throw error;
    }

    const now = new Date();
    const lostCase = await SupportCase.findByIdAndUpdate(
      match.lostItemReport,
      {
        $set: {
          status: 'RESOLVED',
          'lostItem.recoveryStatus': 'RETURNED',
          'lostItem.returnedAt': now,
          resolvedAt: now,
        },
        $push: {
          auditTrail: {
            actorId: adminId,
            actorRole: 'ADMIN',
            action: 'ITEM_RETURNED',
            previousStatus: 'RETURN_IN_PROGRESS',
            newStatus: 'RESOLVED',
            message: 'Item handover completed and case resolved',
            metadata: { matchId: String(match._id), receiverName: data.receiverName || '' },
            createdAt: now,
          },
        },
      },
      { new: true }
    );
    await OperationIncident.updateOne(
      { _id: match.foundItemReport, type: 'FOUND_ITEM', 'foundItem.recoveryStatus': 'RETURN_IN_PROGRESS' },
      {
        $set: {
          status: 'RESOLVED',
          resolvedAt: now,
          'foundItem.recoveryStatus': 'RETURNED',
          'foundItem.handedOverAt': now,
          'foundItem.handedTo': String(data.receiverName || data.handedTo || '').trim(),
        },
      }
    );

    await Promise.all([
      buildAuditLog({
        actorId: adminId,
        actorRole: 'ADMIN',
        action: 'ITEM_RETURNED',
        resourceType: 'LostFoundMatch',
        resourceId: match._id,
        metadata: data,
      }),
      lostCase?.passenger ? createLostFoundNotification({
        title: 'Hồ sơ đồ thất lạc đã xử lý',
        message: `Hồ sơ đồ thất lạc ${lostCase.referenceNumber} đã được xử lý.`,
        type: 'general',
        priority: 'normal',
        targetAudience: 'specific_users',
        userIds: [lostCase.passenger],
        actionUrl: `/lost-items/${lostCase._id}`,
        sourceType: 'SupportCase',
        sourceId: lostCase._id,
        metadata: {
          matchId: String(match._id),
          caseId: String(lostCase._id),
          supportCaseType: 'LOST_ITEM',
          referenceNumber: lostCase.referenceNumber,
        },
      }) : null,
    ]);

    return this.getMatchById(match._id);
  }

  static async notifyReportCreated({ type, report, actorId = null }) {
    const isLost = type === 'LOST_ITEM';
    const passengerId = isLost ? report.passenger : null;
    const assistantId = !isLost ? report.driver : null;
    const adminMessage = isLost
      ? `New lost item report ${report.referenceNumber}: ${report.lostItem?.itemName || report.title}`
      : `New found item report ${report.incidentCode}: ${report.foundItem?.itemName || report.description}`;

    const notifications = [
      createLostFoundNotification({
        title: isLost ? 'New lost item report' : 'New found item report',
        message: adminMessage,
        type: 'general',
        priority: 'normal',
        targetAudience: 'admins',
        actionUrl: '/admin/lost-items',
        sourceType: isLost ? 'SupportCase' : 'OperationIncident',
        sourceId: report._id,
        metadata: { reportType: type, reportId: String(report._id) },
      }),
    ];

    if (passengerId) {
      notifications.push(createLostFoundNotification({
        title: 'Đã gửi báo mất đồ',
        message: `Hồ sơ báo mất đồ ${report.referenceNumber} đã được gửi và đang chờ đối chiếu.`,
        type: 'general',
        priority: 'normal',
        targetAudience: 'specific_users',
        userIds: [passengerId],
        actionUrl: `/lost-items/${report._id}`,
        sourceType: 'SupportCase',
        sourceId: report._id,
        metadata: {
          reportType: type,
          reportId: String(report._id),
          caseId: String(report._id),
          supportCaseType: type,
          referenceNumber: report.referenceNumber,
        },
      }));
    }

    if (assistantId) {
      notifications.push(createLostFoundNotification({
        title: 'Found item report submitted',
        message: `Found item report ${report.incidentCode} was submitted for admin review.`,
        type: 'general',
        priority: 'normal',
        targetAudience: 'specific_users',
        userIds: [assistantId],
        actionUrl: '/bus-assistant/incident-reports',
        sourceType: 'OperationIncident',
        sourceId: report._id,
        metadata: { reportType: type, reportId: String(report._id) },
      }));
    }

    await Promise.all([
      ...notifications,
      buildAuditLog({
        actorId,
        actorRole: isLost ? 'PASSENGER' : 'BUS_ASSISTANT',
        action: isLost ? 'LOST_REPORT_CREATED' : 'FOUND_REPORT_CREATED',
        resourceType: isLost ? 'SupportCase' : 'OperationIncident',
        resourceId: report._id,
        metadata: { reportType: type },
      }),
    ]);
  }
}

export default LostAndFoundMatchingService;
