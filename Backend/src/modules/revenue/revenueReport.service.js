import mongoose from 'mongoose';
import { CustomError } from '../../middleware/errorHandler.js';
import { HTTP_STATUS } from '../../constants/index.js';
import User from '../auth/User.js';
import PromotionUsage from '../promotions/PromotionUsage.js';

const COMPLETED_STATUSES = new Set(['COMPLETED', 'SUCCESS', 'PAID', 'CONFIRMED', 'APPLIED']);
const REFUND_STATUSES = new Set(['REFUNDED', 'REVERSED']);
const EXCLUDED_STATUSES = new Set(['FAILED', 'CANCELLED', 'CANCELED', 'PENDING', 'PROCESSING']);

const normalizeTicketType = (value, fallback = 'E_TICKET') => {
  const normalized = String(value || fallback).trim().toUpperCase().replace('-', '_');

  if (['MONTHLY_PASS', 'MONTHLYPASS', 'PASS'].includes(normalized)) {
    return 'MONTHLY_PASS';
  }

  if (['WALK_IN', 'WALKIN', 'CASH'].includes(normalized)) {
    return 'WALK_IN';
  }

  return 'E_TICKET';
};

const normalizePaymentMethod = (value) => String(value || 'UNKNOWN').trim().toUpperCase();
const normalizeStatus = (value) => String(value || 'COMPLETED').trim().toUpperCase();
const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const formatDateKey = (date) => date.toISOString().slice(0, 10);

const formatMonthKey = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

const formatWeekKey = (date) => {
  const current = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = current.getUTCDay() || 7;
  current.setUTCDate(current.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(current.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((current - yearStart) / 86400000) + 1) / 7);
  return `${current.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
};

const routeLabel = (event) => event.routeName || event.routeNumber || event.routeId || 'Unassigned route';

const matchesFilters = (event, filters) => {
  if (event.date < filters.startDate || event.date > filters.endDate) {
    return false;
  }

  if (filters.routeId && String(event.routeId || '') !== String(filters.routeId)) {
    return false;
  }

  if (filters.paymentMethod && event.paymentMethod !== normalizePaymentMethod(filters.paymentMethod)) {
    return false;
  }

  if (filters.ticketType && event.ticketType !== normalizeTicketType(filters.ticketType)) {
    return false;
  }

  return true;
};

const groupEvents = (events, keyBuilder, mapper = {}) => {
  const groups = new Map();

  events.forEach((event) => {
    const key = keyBuilder(event);
    const current = groups.get(key) || {
      key,
      revenue: 0,
      ticketsSold: 0,
      transactions: 0,
      refunds: 0,
      passengers: 0,
      ...mapper.base?.(event),
    };

    current.revenue += event.netRevenue;
    current.ticketsSold += event.ticketCount;
    current.transactions += event.transactionCount;
    current.refunds += event.refundAmount;
    current.passengers += event.passengerCount;
    groups.set(key, current);
  });

  return [...groups.values()].sort((left, right) => right.revenue - left.revenue);
};

const getRouteNameById = async () => {
  if (!mongoose.connection.db) {
    return new Map();
  }

  const collections = await mongoose.connection.db.listCollections().toArray();
  const hasRoutes = collections.some((collection) => collection.name === 'routes');
  if (!hasRoutes) {
    return new Map();
  }

  const routes = await mongoose.connection.db.collection('routes').find({}).toArray();
  return new Map(routes.map((route) => [
    String(route._id),
    route.name || route.routeName || route.routeNumber || route.code || String(route._id),
  ]));
};

const readPromotionUsageEvents = async (routeNameById) => {
  const usages = await PromotionUsage.find({
    status: { $in: ['APPLIED', 'REVERSED'] },
  }).lean();

  return usages.map((usage) => {
    const status = normalizeStatus(usage.status);
    const isRefund = REFUND_STATUSES.has(status);
    const routeId = usage.routeId ? String(usage.routeId) : null;

    return {
      source: 'promotionUsage',
      date: new Date(usage.usedAt || usage.createdAt),
      routeId,
      routeName: routeNameById.get(routeId) || null,
      paymentMethod: normalizePaymentMethod(usage.paymentMethod),
      ticketType: normalizeTicketType(usage.ticketType, 'E_TICKET'),
      status,
      netRevenue: isRefund ? 0 : toNumber(usage.finalAmount),
      grossRevenue: toNumber(usage.originalAmount),
      discountAmount: toNumber(usage.discountAmount),
      refundAmount: isRefund ? toNumber(usage.finalAmount || usage.originalAmount) : 0,
      ticketCount: isRefund ? 0 : 1,
      transactionCount: isRefund ? 0 : 1,
      passengerCount: isRefund ? 0 : 1,
    };
  });
};

const readTravelHistoryEvents = async () => {
  const users = await User.find({ 'travelHistory.0': { $exists: true } }, { travelHistory: 1 }).lean();

  return users.flatMap((user) => (user.travelHistory || []).map((trip) => {
    const status = normalizeStatus(trip.status);
    const isRefund = REFUND_STATUSES.has(status);

    return {
      source: 'travelHistory',
      date: new Date(trip.boardedAt || trip.createdAt || Date.now()),
      routeId: trip.routeId ? String(trip.routeId) : null,
      routeNumber: trip.routeNumber,
      routeName: trip.routeName || trip.routeNumber,
      paymentMethod: normalizePaymentMethod(trip.paymentMethod),
      ticketType: normalizeTicketType(trip.ticketType, trip.monthlyPassUsed ? 'MONTHLY_PASS' : 'WALK_IN'),
      status,
      netRevenue: isRefund ? 0 : toNumber(trip.fare),
      grossRevenue: toNumber(trip.fare),
      discountAmount: 0,
      refundAmount: isRefund ? toNumber(trip.fare) : 0,
      ticketCount: isRefund ? 0 : 1,
      transactionCount: isRefund ? 0 : 1,
      passengerCount: isRefund ? 0 : 1,
    };
  }));
};

const readCollectionEvents = async (routeNameById) => {
  if (!mongoose.connection.db) {
    return [];
  }

  const collections = await mongoose.connection.db.listCollections().toArray();
  const collectionNames = new Set(collections.map((collection) => collection.name));

  if (!collectionNames.has('transactions')) {
    return [];
  }

  const transactions = await mongoose.connection.db.collection('transactions').find({}).toArray();

  return transactions.map((transaction) => {
    const status = normalizeStatus(transaction.status || transaction.paymentStatus);
    const routeId = transaction.routeId || transaction.route?._id || transaction.ticket?.routeId;
    const routeIdText = routeId ? String(routeId) : null;
    const originalAmount = toNumber(transaction.originalAmount || transaction.amount || transaction.totalAmount);
    const discountAmount = toNumber(transaction.discountAmount || transaction.promotionDiscount);
    const finalAmount = toNumber(transaction.finalAmount || transaction.netAmount || (originalAmount - discountAmount));
    const isRefund = REFUND_STATUSES.has(status);
    const isExcluded = EXCLUDED_STATUSES.has(status);

    return {
      source: 'transactions',
      date: new Date(transaction.completedAt || transaction.paidAt || transaction.createdAt || Date.now()),
      routeId: routeIdText,
      routeName: routeNameById.get(routeIdText) || transaction.routeName || transaction.route?.name || null,
      paymentMethod: normalizePaymentMethod(transaction.paymentMethod || transaction.method),
      ticketType: normalizeTicketType(transaction.ticketType || transaction.ticket?.type),
      status,
      netRevenue: isRefund || isExcluded ? 0 : finalAmount,
      grossRevenue: originalAmount,
      discountAmount,
      refundAmount: isRefund ? finalAmount || originalAmount : 0,
      ticketCount: isRefund || isExcluded ? 0 : toNumber(transaction.ticketCount || 1),
      transactionCount: isRefund || isExcluded ? 0 : 1,
      passengerCount: isRefund || isExcluded ? 0 : toNumber(transaction.passengerCount || transaction.ticketCount || 1),
    };
  });
};

const getReportEvents = async (query) => {
  const filters = {
    ...query,
    startDate: startOfDay(query.startDate),
    endDate: endOfDay(query.endDate),
  };
  const routeNameById = await getRouteNameById();
  const [promotionEvents, travelEvents, transactionEvents] = await Promise.all([
    readPromotionUsageEvents(routeNameById),
    readTravelHistoryEvents(),
    readCollectionEvents(routeNameById),
  ]);

  return [...promotionEvents, ...travelEvents, ...transactionEvents]
    .filter((event) => event.date instanceof Date && !Number.isNaN(event.date.getTime()))
    .filter((event) => {
      const status = normalizeStatus(event.status);
      return COMPLETED_STATUSES.has(status) || REFUND_STATUSES.has(status);
    })
    .filter((event) => matchesFilters(event, filters))
    .sort((left, right) => right.date - left.date);
};

const calculateGrowthRate = (events, query) => {
  const startDate = startOfDay(query.startDate);
  const endDate = endOfDay(query.endDate);
  const duration = endDate.getTime() - startDate.getTime() + 1;
  const midpoint = new Date(startDate.getTime() + Math.floor(duration / 2));
  const previousRevenue = events
    .filter((event) => event.date < midpoint)
    .reduce((total, event) => total + event.netRevenue, 0);
  const currentRevenue = events
    .filter((event) => event.date >= midpoint)
    .reduce((total, event) => total + event.netRevenue, 0);

  if (!previousRevenue) {
    return currentRevenue ? 100 : 0;
  }

  return Number((((currentRevenue - previousRevenue) / previousRevenue) * 100).toFixed(2));
};

const buildRevenueReport = (events, query) => {
  const totalRevenue = events.reduce((total, event) => total + event.netRevenue, 0);
  const totalTicketsSold = events.reduce((total, event) => total + event.ticketCount, 0);
  const totalTransactions = events.reduce((total, event) => total + event.transactionCount, 0);
  const totalRefunds = events.reduce((total, event) => total + event.refundAmount, 0);
  const averageTicketPrice = totalTicketsSold ? Number((totalRevenue / totalTicketsSold).toFixed(2)) : 0;

  const revenueByDate = groupEvents(events, (event) => {
    if (query.groupBy === 'week') {
      return formatWeekKey(event.date);
    }

    if (query.groupBy === 'month') {
      return formatMonthKey(event.date);
    }

    return formatDateKey(event.date);
  }).sort((left, right) => right.key.localeCompare(left.key)).map((item) => ({
    date: item.key,
    revenue: item.revenue,
    ticketsSold: item.ticketsSold,
    transactions: item.transactions,
  }));

  const revenueByRoute = groupEvents(events, routeLabel).map((item) => ({
    route: item.key,
    revenue: item.revenue,
    ticketsSold: item.ticketsSold,
    transactions: item.transactions,
  }));

  const revenueByPaymentMethod = groupEvents(events, (event) => event.paymentMethod).map((item) => ({
    paymentMethod: item.key,
    revenue: item.revenue,
    transactions: item.transactions,
  }));

  const revenueSummaryTable = events.slice(0, 100).map((event) => ({
    date: formatDateKey(event.date),
    route: routeLabel(event),
    paymentMethod: event.paymentMethod,
    ticketType: event.ticketType,
    ticketsSold: event.ticketCount,
    netRevenue: event.netRevenue,
    refundAmount: event.refundAmount,
  }));

  return {
    totalRevenue,
    totalTicketsSold,
    totalTransactions,
    averageTicketPrice,
    totalRefunds,
    revenueGrowthRate: calculateGrowthRate(events, query),
    revenueByDate,
    revenueByRoute,
    revenueByPaymentMethod,
    revenueSummaryTable,
  };
};

const buildTicketSalesStatistics = (events) => {
  const totalTicketsSold = events.reduce((total, event) => total + event.ticketCount, 0);
  const typeCount = (type) => events
    .filter((event) => event.ticketType === type)
    .reduce((total, event) => total + event.ticketCount, 0);

  const ticketSalesByRoute = groupEvents(events, routeLabel).map((item) => ({
    route: item.key,
    ticketsSold: item.ticketsSold,
    revenue: item.revenue,
  }));

  const ticketSalesByDate = groupEvents(events, (event) => formatDateKey(event.date))
    .sort((left, right) => right.key.localeCompare(left.key))
    .map((item) => ({
      date: item.key,
      ticketsSold: item.ticketsSold,
      revenue: item.revenue,
    }));

  const ticketSalesByType = groupEvents(events, (event) => event.ticketType).map((item) => ({
    ticketType: item.key,
    ticketsSold: item.ticketsSold,
    revenue: item.revenue,
  }));

  return {
    totalTicketsSold,
    eTicketCount: typeCount('E_TICKET'),
    walkInTicketCount: typeCount('WALK_IN'),
    monthlyPassCount: typeCount('MONTHLY_PASS'),
    ticketSalesByRoute,
    ticketSalesByDate,
    ticketSalesByType,
    topSellingRoutes: ticketSalesByRoute.slice(0, 5),
  };
};

const buildPeakHourDemand = (events) => {
  const byHour = groupEvents(events, (event) => String(event.date.getHours()).padStart(2, '0'))
    .sort((left, right) => Number(left.key) - Number(right.key));

  const passengerCountByHour = byHour.map((item) => ({
    hour: `${item.key}:00`,
    passengerCount: item.passengers,
  }));

  const revenueByHour = byHour.map((item) => ({
    hour: `${item.key}:00`,
    revenue: item.revenue,
  }));

  const peakHours = [...byHour]
    .sort((left, right) => right.passengers - left.passengers)
    .slice(0, 5)
    .map((item) => ({
      hour: `${item.key}:00`,
      passengerCount: item.passengers,
      revenue: item.revenue,
    }));

  const crowdedRoutes = groupEvents(events, routeLabel)
    .slice(0, 5)
    .map((item) => ({
      route: item.key,
      passengerCount: item.passengers,
      revenue: item.revenue,
    }));

  return {
    peakHours,
    passengerCountByHour,
    revenueByHour,
    crowdedRoutes,
    highDemandTimeSlots: peakHours.map((item) => `${item.hour} - ${Number(item.hour.slice(0, 2)) + 1}:00`),
    averagePassengerPerTrip: events.length
      ? Number((events.reduce((total, event) => total + event.passengerCount, 0) / events.length).toFixed(2))
      : 0,
  };
};

const logAudit = async ({ action, actorId, metadata = {} }) => {
  try {
    const AuditLog = mongoose.models.AuditLog;
    if (!AuditLog) {
      return;
    }

    await AuditLog.create({
      action,
      actorId,
      entityType: 'RevenueReport',
      metadata,
      createdAt: new Date(),
    });
  } catch {
    // Audit logging should never block reporting.
  }
};

const escapeCell = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const buildExcel = ({ report, ticketSales, peakHour, filters }) => {
  const rows = [
    ['Filters', JSON.stringify(filters)],
    ['Total Revenue', report.totalRevenue],
    ['Total Tickets Sold', report.totalTicketsSold],
    ['Average Ticket Price', report.averageTicketPrice],
    ['Total Refunds', report.totalRefunds],
    ['Revenue Growth Rate', `${report.revenueGrowthRate}%`],
  ];

  const table = (title, headers, dataRows) => `
    <h2>${escapeCell(title)}</h2>
    <table border="1">
      <thead><tr>${headers.map((header) => `<th>${escapeCell(header)}</th>`).join('')}</tr></thead>
      <tbody>${dataRows.map((row) => `<tr>${row.map((cell) => `<td>${escapeCell(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  `;

  return Buffer.from(`
    <html>
      <head><meta charset="utf-8" /></head>
      <body>
        ${table('Revenue Summary', ['Metric', 'Value'], rows)}
        ${table('Payment Method Breakdown', ['Payment Method', 'Revenue', 'Transactions'], report.revenueByPaymentMethod.map((item) => [item.paymentMethod, item.revenue, item.transactions]))}
        ${table('Route Revenue Ranking', ['Route', 'Revenue', 'Tickets'], report.revenueByRoute.map((item) => [item.route, item.revenue, item.ticketsSold]))}
        ${table('Ticket Sales Statistics', ['Ticket Type', 'Tickets', 'Revenue'], ticketSales.ticketSalesByType.map((item) => [item.ticketType, item.ticketsSold, item.revenue]))}
        ${table('Peak Hour Demand', ['Hour', 'Passengers', 'Revenue'], peakHour.peakHours.map((item) => [item.hour, item.passengerCount, item.revenue]))}
      </body>
    </html>
  `, 'utf8');
};

const buildPdf = ({ report, ticketSales, peakHour, filters }) => {
  const lines = [
    'BusDN Financial Report',
    `Filters: ${JSON.stringify(filters)}`,
    '',
    `Total Revenue: ${report.totalRevenue}`,
    `Total Tickets Sold: ${report.totalTicketsSold}`,
    `Average Ticket Price: ${report.averageTicketPrice}`,
    `Total Refunds: ${report.totalRefunds}`,
    `Revenue Growth Rate: ${report.revenueGrowthRate}%`,
    '',
    'Payment Method Breakdown:',
    ...report.revenueByPaymentMethod.map((item) => `- ${item.paymentMethod}: ${item.revenue} (${item.transactions} transactions)`),
    '',
    'Route Revenue Ranking:',
    ...report.revenueByRoute.slice(0, 20).map((item) => `- ${item.route}: ${item.revenue} (${item.ticketsSold} tickets)`),
    '',
    'Ticket Sales:',
    ...ticketSales.ticketSalesByType.map((item) => `- ${item.ticketType}: ${item.ticketsSold} (${item.revenue})`),
    '',
    'Peak Hours:',
    ...peakHour.peakHours.map((item) => `- ${item.hour}: ${item.passengerCount} passengers, ${item.revenue} revenue`),
  ];

  const content = lines
    .map((line, index) => `BT /F1 10 Tf 50 ${780 - (index * 14)} Td (${line.replace(/[()\\]/g, '')}) Tj ET`)
    .join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${object}\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
};

export class RevenueReportService {
  static async getRevenueReports(query, actor) {
    const events = await getReportEvents(query);
    const report = buildRevenueReport(events, query);

    await logAudit({
      action: 'REVENUE_REPORT_VIEWED',
      actorId: actor?.userId,
      metadata: { filters: query },
    });

    return report;
  }

  static async getTicketSalesStatistics(query, actor) {
    const events = await getReportEvents(query);
    const statistics = buildTicketSalesStatistics(events);

    await logAudit({
      action: 'TICKET_SALES_STATISTICS_VIEWED',
      actorId: actor?.userId,
      metadata: { filters: query },
    });

    return statistics;
  }

  static async getPeakHourDemand(query, actor) {
    const events = await getReportEvents(query);
    const demand = buildPeakHourDemand(events);

    await logAudit({
      action: 'PEAK_HOUR_DEMAND_VIEWED',
      actorId: actor?.userId,
      metadata: { filters: query },
    });

    return demand;
  }

  static async exportFinancialReport(query, actor) {
    const format = String(query.format || '').toLowerCase();
    if (!['pdf', 'excel'].includes(format)) {
      throw new CustomError('Export format must be pdf or excel', HTTP_STATUS.BAD_REQUEST);
    }

    const events = await getReportEvents(query);
    const report = buildRevenueReport(events, query);
    const ticketSales = buildTicketSalesStatistics(events);
    const peakHour = buildPeakHourDemand(events);
    const payload = { report, ticketSales, peakHour, filters: query };

    await logAudit({
      action: 'FINANCIAL_REPORT_EXPORTED',
      actorId: actor?.userId,
      metadata: { filters: query, format },
    });

    if (format === 'pdf') {
      return {
        buffer: buildPdf(payload),
        contentType: 'application/pdf',
        fileName: 'busdn-financial-report.pdf',
      };
    }

    return {
      buffer: buildExcel(payload),
      contentType: 'application/vnd.ms-excel',
      fileName: 'busdn-financial-report.xls',
    };
  }
}

export default RevenueReportService;
