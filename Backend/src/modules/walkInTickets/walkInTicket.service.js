import mongoose from 'mongoose';
import { HTTP_STATUS, PAGINATION } from '../../constants/index.js';
import { CustomError } from '../../middleware/errorHandler.js';
import User from '../auth/User.js';
import { createAuditLog } from '../systemMonitoring/auditLogger.js';
import WalkInTicket from './WalkInTicket.js';

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const idText = (value) => value ? String(value._id || value) : null;

const endOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const dateRange = (query, field = 'issuedAt') => {
  if (!query.startDate && !query.endDate) {
    return {};
  }
  const range = {};
  if (query.startDate) {
    range.$gte = new Date(query.startDate);
  }
  if (query.endDate) {
    range.$lte = endOfDay(query.endDate);
  }
  return { [field]: range };
};

const mongoFilter = (query) => {
  const filter = { status: 'COMPLETED', ...dateRange(query) };
  ['routeId', 'busAssistantId', 'shiftId'].forEach((field) => {
    if (query[field]) {
      filter[field] = new mongoose.Types.ObjectId(query[field]);
    }
  });
  if (query.paymentMethod) {
    filter.paymentMethod = query.paymentMethod;
  }
  return filter;
};

const collectionExists = async (name) => {
  if (!mongoose.connection.db) {
    return false;
  }
  const result = await mongoose.connection.db.listCollections({ name }).toArray();
  return result.length > 0;
};

const readGenericTickets = async (query) => {
  if (!(await collectionExists('tickets'))) {
    return [];
  }
  const documents = await mongoose.connection.db.collection('tickets').find({
    $or: [
      { ticketType: 'WALK_IN' },
      { type: 'WALK_IN' },
      { source: 'WALK_IN' },
    ],
  }).toArray();

  const start = query.startDate ? new Date(query.startDate) : null;
  const end = query.endDate ? endOfDay(query.endDate) : null;
  return documents.map((ticket) => {
    const issuedAt = new Date(ticket.issuedAt || ticket.createdAt);
    return {
      _id: ticket._id,
      ticketCode: ticket.ticketCode || ticket.code || String(ticket._id),
      busAssistantId: ticket.busAssistantId || ticket.createdBy,
      routeId: ticket.routeId,
      tripId: ticket.tripId,
      shiftId: ticket.shiftId,
      transactionId: ticket.transactionId,
      passengerCount: number(ticket.passengerCount || ticket.quantity, 1),
      farePerPassenger: number(ticket.farePerPassenger || ticket.fare),
      totalAmount: number(ticket.totalAmount || ticket.amount || ticket.fare),
      collectedAmount: number(ticket.collectedAmount || ticket.paidAmount || ticket.totalAmount || ticket.amount),
      paymentMethod: String(ticket.paymentMethod || 'CASH').toUpperCase(),
      status: String(ticket.status || 'COMPLETED').toUpperCase(),
      issuedAt,
      notes: ticket.notes || '',
      source: 'tickets',
    };
  }).filter((ticket) => {
    if (ticket.status !== 'COMPLETED') return false;
    if (start && ticket.issuedAt < start) return false;
    if (end && ticket.issuedAt > end) return false;
    if (query.routeId && idText(ticket.routeId) !== query.routeId) return false;
    if (query.busAssistantId && idText(ticket.busAssistantId) !== query.busAssistantId) return false;
    if (query.shiftId && idText(ticket.shiftId) !== query.shiftId) return false;
    if (query.paymentMethod && ticket.paymentMethod !== query.paymentMethod) return false;
    return true;
  });
};

const relatedDocument = async (collectionName, id) => {
  if (!id || !mongoose.isValidObjectId(id) || !(await collectionExists(collectionName))) {
    return null;
  }
  return mongoose.connection.db.collection(collectionName).findOne({
    _id: new mongoose.Types.ObjectId(id),
  });
};

const routeInfo = (route) => route ? {
  _id: route._id,
  name: route.name || route.routeName || route.routeNumber || route.routeCode || route.code,
  routeNumber: route.routeNumber || route.routeCode || route.code || '',
} : null;

const assistantInfo = (assistant) => assistant ? {
  _id: assistant._id,
  fullName: assistant.fullName,
  email: assistant.email,
  role: assistant.role,
  avatar: assistant.avatar,
} : null;

const enrichList = async (tickets) => {
  const routeIds = [...new Set(
    tickets.map((item) => idText(item.routeId)).filter((id) => mongoose.isValidObjectId(id))
  )];
  const assistantIds = [...new Set(
    tickets.map((item) => idText(item.busAssistantId)).filter((id) => mongoose.isValidObjectId(id))
  )];
  const routeObjectIds = routeIds.map((id) => new mongoose.Types.ObjectId(id));
  const [routes, busRoutes, assistants] = await Promise.all([
    collectionExists('routes').then((exists) => exists
      ? mongoose.connection.db.collection('routes').find({ _id: { $in: routeObjectIds } }).toArray()
      : []),
    collectionExists('busroutes').then((exists) => exists
      ? mongoose.connection.db.collection('busroutes').find({ _id: { $in: routeObjectIds } }).toArray()
      : []),
    User.find({ _id: { $in: assistantIds } }).select('fullName email role avatar').lean(),
  ]);
  const routeMap = new Map(
    [...routes, ...busRoutes].map((route) => [String(route._id), routeInfo(route)])
  );
  const assistantMap = new Map(assistants.map((assistant) => [String(assistant._id), assistantInfo(assistant)]));

  return tickets.map((ticket) => ({
    ...ticket,
    route: routeMap.get(idText(ticket.routeId)) || null,
    busAssistant: assistantMap.get(idText(ticket.busAssistantId)) || null,
  }));
};

const reconciliationStatus = (expected, collected) => {
  const discrepancy = collected - expected;
  const absolute = Math.abs(discrepancy);
  if (absolute <= 1000) {
    return 'MATCHED';
  }
  const minorThreshold = Math.max(expected * 0.02, 50000);
  return absolute <= minorThreshold ? 'MINOR_DIFFERENCE' : 'MAJOR_DIFFERENCE';
};

const readCollectedRevenue = async (query, expected, tickets) => {
  const candidates = ['shiftrevenues', 'revenuesummaries'];
  for (const collectionName of candidates) {
    if (!(await collectionExists(collectionName))) {
      continue;
    }
    const records = await mongoose.connection.db.collection(collectionName).find({}).toArray();
    const matched = records.filter((record) => {
      if (query.shiftId && idText(record.shiftId) !== query.shiftId) return false;
      if (query.routeId && idText(record.routeId) !== query.routeId) return false;
      const date = new Date(record.date || record.shiftDate || record.createdAt);
      if (query.startDate && date < new Date(query.startDate)) return false;
      if (query.endDate && date > endOfDay(query.endDate)) return false;
      return true;
    });
    if (matched.length) {
      return matched.reduce(
        (total, item) => total + number(item.collectedRevenue || item.collectedAmount || item.cashCollected),
        0
      );
    }
  }

  const collected = tickets.reduce((total, ticket) => total + number(ticket.collectedAmount), 0);
  return collected || expected;
};

export class WalkInTicketService {
  static async getTickets(query, actor, req) {
    const page = Math.max(number(query.page, PAGINATION.DEFAULT_PAGE), 1);
    const limit = Math.min(Math.max(number(query.limit, PAGINATION.DEFAULT_LIMIT), 1), PAGINATION.MAX_LIMIT);
    const [modelTickets, genericTickets] = await Promise.all([
      WalkInTicket.find(mongoFilter(query)).sort({ issuedAt: -1 }).lean(),
      readGenericTickets(query),
    ]);
    const allTickets = [...modelTickets.map((item) => ({ ...item, source: 'walkintickets' })), ...genericTickets]
      .sort((left, right) => new Date(right.issuedAt) - new Date(left.issuedAt));
    const ticketCount = allTickets.length;
    const passengerCount = allTickets.reduce((total, ticket) => total + number(ticket.passengerCount, 1), 0);
    const totalRevenue = allTickets.reduce((total, ticket) => total + number(ticket.totalAmount), 0);
    const pageItems = allTickets.slice((page - 1) * limit, page * limit);
    const enriched = await enrichList(pageItems);

    await createAuditLog({
      req,
      user: actor,
      action: 'VIEW_WALKIN_RECORDS',
      module: 'WALKIN_TICKETS',
      description: 'Admin viewed completed walk-in ticket records.',
      riskLevel: 'LOW',
      metadata: { filters: query, resultCount: ticketCount },
    });

    return {
      tickets: enriched,
      summary: { ticketCount, passengerCount, totalRevenue },
      pagination: {
        page,
        limit,
        total: ticketCount,
        totalPages: Math.ceil(ticketCount / limit) || 1,
      },
    };
  }

  static async getTicketDetail(id, actor, req) {
    let ticket = await WalkInTicket.findById(id).lean();
    if (ticket) {
      ticket.source = 'walkintickets';
    } else if (await collectionExists('tickets')) {
      const generic = await mongoose.connection.db.collection('tickets').findOne({ _id: new mongoose.Types.ObjectId(id) });
      const genericType = String(generic?.ticketType || generic?.type || generic?.source || '').toUpperCase();
      if (generic && genericType === 'WALK_IN') {
        ticket = {
          ...generic,
          ticketCode: generic.ticketCode || generic.code || String(generic._id),
          passengerCount: number(generic.passengerCount || generic.quantity, 1),
          totalAmount: number(generic.totalAmount || generic.amount || generic.fare),
          collectedAmount: number(generic.collectedAmount || generic.paidAmount || generic.totalAmount),
          paymentMethod: generic.paymentMethod || 'CASH',
          issuedAt: generic.issuedAt || generic.createdAt,
          source: 'tickets',
        };
      }
    }
    if (!ticket) {
      throw new CustomError('Walk-in ticket not found', HTTP_STATUS.NOT_FOUND);
    }

    const [standardRoute, adminRoute, trip, tripSchedule, shift, assistant, payment] = await Promise.all([
      relatedDocument('routes', ticket.routeId),
      relatedDocument('busroutes', ticket.routeId),
      relatedDocument('trips', ticket.tripId),
      relatedDocument('tripschedules', ticket.tripId),
      relatedDocument('shiftassignments', ticket.shiftId),
      User.findById(ticket.busAssistantId).select('fullName email role avatar').lean(),
      ticket.transactionId
        ? relatedDocument('transactions', ticket.transactionId)
        : collectionExists('transactions').then(async (exists) => exists
          ? mongoose.connection.db.collection('transactions').findOne({ ticketId: ticket._id })
          : null),
    ]);

    await createAuditLog({
      req,
      user: actor,
      action: 'VIEW_WALKIN_RECORDS',
      module: 'WALKIN_TICKETS',
      description: 'Admin viewed a walk-in ticket detail.',
      resourceType: 'WalkInTicket',
      resourceId: ticket._id,
      riskLevel: 'LOW',
    });

    return {
      ...ticket,
      route: routeInfo(standardRoute || adminRoute),
      trip: (trip || tripSchedule) ? {
        _id: (trip || tripSchedule)._id,
        status: (trip || tripSchedule).status,
        departureTime: (trip || tripSchedule).actualStart
          || (trip || tripSchedule).scheduledStart
          || (trip || tripSchedule).departureTime,
      } : null,
      shift: shift ? {
        _id: shift._id,
        shiftCode: shift.shiftCode,
        status: shift.shiftStatus,
      } : null,
      busAssistant: assistantInfo(assistant),
      payment: payment ? {
        _id: payment._id,
        status: payment.status || payment.paymentStatus,
        amount: number(payment.finalAmount || payment.amount || payment.totalAmount),
        paymentMethod: payment.paymentMethod || payment.method,
        completedAt: payment.completedAt || payment.paidAt,
      } : null,
    };
  }

  static async reconcileRevenue(query, actor, req) {
    const [modelTickets, genericTickets] = await Promise.all([
      WalkInTicket.find(mongoFilter(query)).sort({ issuedAt: -1 }).lean(),
      readGenericTickets(query),
    ]);
    const tickets = [...modelTickets, ...genericTickets];
    const expectedRevenue = tickets.reduce((total, ticket) => total + number(ticket.totalAmount), 0);
    const collectedRevenue = await readCollectedRevenue(query, expectedRevenue, tickets);
    const discrepancyAmount = collectedRevenue - expectedRevenue;
    const status = reconciliationStatus(expectedRevenue, collectedRevenue);

    const grouped = new Map();
    tickets.forEach((ticket) => {
      const key = idText(ticket.shiftId) || 'UNASSIGNED_SHIFT';
      const current = grouped.get(key) || {
        shiftId: key,
        ticketCount: 0,
        passengerCount: 0,
        expectedRevenue: 0,
        collectedRevenue: 0,
      };
      current.ticketCount += 1;
      current.passengerCount += number(ticket.passengerCount, 1);
      current.expectedRevenue += number(ticket.totalAmount);
      current.collectedRevenue += number(ticket.collectedAmount || ticket.totalAmount);
      grouped.set(key, current);
    });
    const revenueSummary = [...grouped.values()].map((item) => ({
      ...item,
      discrepancyAmount: item.collectedRevenue - item.expectedRevenue,
      reconciliationStatus: reconciliationStatus(item.expectedRevenue, item.collectedRevenue),
    }));

    await createAuditLog({
      req,
      user: actor,
      action: 'RECONCILE_WALKIN_REVENUE',
      module: 'WALKIN_TICKETS',
      description: 'Admin reconciled walk-in ticket revenue.',
      riskLevel: status === 'MAJOR_DIFFERENCE' ? 'HIGH' : 'MEDIUM',
      metadata: { filters: query, expectedRevenue, collectedRevenue, discrepancyAmount, status },
    });

    return {
      expectedRevenue,
      collectedRevenue,
      discrepancyAmount,
      reconciliationStatus: status,
      revenueSummary,
    };
  }
}

export default WalkInTicketService;
