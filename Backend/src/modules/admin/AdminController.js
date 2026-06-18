import crypto from 'crypto';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import AdminModel from './AdminModel.js';
import { config } from '../../config/environment.js';
import logger from '../../utils/logger.js';

const ALLOWED_MANAGED_ROLES = new Set(['DRIVER', 'CONDUCTOR', 'STAFF']);
const ALLOWED_ACCOUNT_ROLES = new Set(['DRIVER', 'CONDUCTOR']);
const ALLOWED_ROUTE_STATUS = new Set(['DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'SUSPENDED']);
const ALLOWED_BUS_STATUS = new Set(['ACTIVE', 'RESERVE', 'MAINTENANCE']);
const ALLOWED_SCHEDULE_STATUS = new Set(['PLANNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
const REQUIRED_IMPORT_COLUMNS = ['fullName', 'role'];
const EMAIL_REGEX = /^[^\s@.]+(?:\.[^\s@.]+)*@[^\s@.]+(?:\.[^\s@.]+)+$/;
const normalizeEmail = (value) => value?.trim().toLowerCase().replace(/\.+$/, '');

const validateManagedUserPayload = (payload) => {
  const errors = {};
  const { fullName, email, phone, role } = payload;

  if (!fullName || fullName.trim().length === 0) errors.fullName = 'Full name is required';
  if (!email) errors.email = 'Email is required to send account credentials';
  if (email && !EMAIL_REGEX.test(email)) errors.email = 'Invalid email format';
  if (phone && !/^(\+84|0)[0-9]{9,10}$/.test(phone)) errors.phone = 'Invalid phone format';
  if (!ALLOWED_ACCOUNT_ROLES.has(role)) errors.role = 'Role must be DRIVER or CONDUCTOR';

  return Object.keys(errors).length ? errors : null;
};

const validateImportedUserPayload = (payload) => {
  const errors = {};
  const { fullName, email, phone, role } = payload;

  if (!fullName || fullName.trim().length === 0) errors.fullName = 'Full name is required';
  if (!email) errors.email = 'Email is required to send the temporary password';
  if (email && !EMAIL_REGEX.test(email)) errors.email = 'Invalid email format';
  if (phone && !/^(\+84|0)[0-9]{9,10}$/.test(phone)) errors.phone = 'Invalid phone format';
  if (!ALLOWED_MANAGED_ROLES.has(role)) errors.role = 'Role must be DRIVER, CONDUCTOR, or STAFF';

  return Object.keys(errors).length ? errors : null;
};

const normalizeBusPayload = (body = {}) => ({
  busCode: String(body.busCode || '').trim().toUpperCase(),
  plateNumber: String(body.plateNumber || '').trim().toUpperCase(),
  busType: String(body.busType || 'Standard City Bus').trim(),
  capacity: asNumber(body.capacity),
  operator: String(body.operator || 'Veridian Transit').trim(),
  status: ALLOWED_BUS_STATUS.has(body.status) ? body.status : 'ACTIVE',
  currentLatitude: body.currentLatitude === '' || body.currentLatitude === undefined ? undefined : asNumber(body.currentLatitude),
  currentLongitude: body.currentLongitude === '' || body.currentLongitude === undefined ? undefined : asNumber(body.currentLongitude),
  heading: body.heading === '' || body.heading === undefined ? undefined : asNumber(body.heading),
});

const validateBusPayload = (payload) => {
  const errors = [];
  if (!payload.busCode) errors.push('Bus code is required');
  if (!payload.plateNumber) errors.push('Plate number is required');
  if (!payload.busType) errors.push('Bus type is required');
  if (!Number.isFinite(payload.capacity) || payload.capacity < 1) errors.push('Capacity must be greater than 0');
  if (payload.currentLatitude !== undefined && (payload.currentLatitude < -90 || payload.currentLatitude > 90)) {
    errors.push('Current latitude is invalid');
  }
  if (payload.currentLongitude !== undefined && (payload.currentLongitude < -180 || payload.currentLongitude > 180)) {
    errors.push('Current longitude is invalid');
  }
  return errors;
};

const normalizeAssignedVehicle = (bus = {}) => ({
  busId: bus.busId || bus._id || undefined,
  busCode: String(bus.busCode || '').trim().toUpperCase(),
  plateNumber: String(bus.plateNumber || '').trim().toUpperCase(),
  busType: String(bus.busType || '').trim(),
  capacity: asNumber(bus.capacity),
});

const normalizeAssignedPerson = (person = {}) => ({
  userId: person.userId || person._id || undefined,
  fullName: String(person.fullName || '').trim(),
  role: String(person.role || '').trim(),
  phone: String(person.phone || person.phoneNumber || '').trim(),
});

const normalizeTripSchedulePayload = async (body = {}, userId) => {
  const route = body.routeId && isValidObjectId(body.routeId)
    ? await AdminModel.findRouteById(body.routeId)
    : null;
  const vehicle = normalizeAssignedVehicle(body.vehicle);
  const driver = normalizeAssignedPerson(body.driver);
  const assistant = normalizeAssignedPerson(body.assistant);
  const serviceDate = body.serviceDate ? new Date(body.serviceDate) : null;
  const hasAssignments = Boolean(vehicle.busId || driver.userId || assistant.userId);

  return {
    scheduleCode: String(body.scheduleCode || '').trim().toUpperCase(),
    serviceDate,
    routeId: route?._id || body.routeId,
    routeCode: route?.routeCode || String(body.routeCode || '').trim().toUpperCase(),
    routeName: route?.routeName || String(body.routeName || '').trim(),
    direction: body.direction === 'INBOUND' ? 'INBOUND' : 'OUTBOUND',
    departureTime: String(body.departureTime || '').trim(),
    expectedArrivalTime: String(body.expectedArrivalTime || '').trim(),
    shiftLabel: String(body.shiftLabel || '').trim(),
    status: ALLOWED_SCHEDULE_STATUS.has(body.status) ? body.status : hasAssignments ? 'ASSIGNED' : 'PLANNED',
    vehicle,
    driver,
    assistant,
    notes: String(body.notes || '').trim(),
    updatedBy: userId,
  };
};

const validateTripSchedulePayload = (payload) => {
  const errors = [];
  if (!payload.scheduleCode) errors.push('Schedule code is required');
  if (!payload.routeId || !isValidObjectId(payload.routeId)) errors.push('Route is required');
  if (!payload.serviceDate || Number.isNaN(payload.serviceDate.getTime())) errors.push('Service date is invalid');
  if (!/^\d{2}:\d{2}$/.test(payload.departureTime)) errors.push('Departure time is required in HH:mm format');
  if (payload.expectedArrivalTime && !/^\d{2}:\d{2}$/.test(payload.expectedArrivalTime)) errors.push('Expected arrival time must use HH:mm format');
  return errors;
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const asNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeStationRef = (station) => {
  if (!station) return undefined;
  return {
    stationId: station.stationId || undefined,
    stopName: String(station.stopName || '').trim(),
    address: String(station.address || '').trim(),
    latitude: asNumber(station.latitude),
    longitude: asNumber(station.longitude),
    isMainStation: Boolean(station.isMainStation),
  };
};

const normalizeRouteDirection = (direction = {}) => {
  const orderedStops = Array.isArray(direction.orderedStops)
    ? direction.orderedStops.map((stop, index) => ({
      stationId: stop.stationId || undefined,
      stopName: String(stop.stopName || '').trim(),
      address: String(stop.address || '').trim(),
      latitude: asNumber(stop.latitude),
      longitude: asNumber(stop.longitude),
      stopOrder: index + 1,
      arrivalOffsetMinutes: Math.max(0, asNumber(stop.arrivalOffsetMinutes, index * 6)),
      departureOffsetMinutes: Math.max(0, asNumber(stop.departureOffsetMinutes, (index * 6) + 1)),
      isMainStation: Boolean(stop.isMainStation),
    }))
    : [];

  return {
    startStation: normalizeStationRef(direction.startStation) || orderedStops[0],
    endStation: normalizeStationRef(direction.endStation) || orderedStops[orderedStops.length - 1],
    orderedStops,
    polylinePath: Array.isArray(direction.polylinePath)
      ? direction.polylinePath.map((point) => ({
        latitude: asNumber(point.latitude),
        longitude: asNumber(point.longitude),
      }))
      : [],
    estimatedDistanceKm: Math.max(0, asNumber(direction.estimatedDistanceKm)),
    estimatedDurationMinutes: Math.max(0, asNumber(direction.estimatedDurationMinutes)),
  };
};

const buildDefaultRouteName = (outboundRoute) => {
  const startName = outboundRoute?.startStation?.stopName?.trim();
  const endName = outboundRoute?.endStation?.stopName?.trim();
  return startName && endName ? `${startName} - ${endName}` : '';
};

const normalizeRoutePayload = (body = {}, userId) => {
  const outboundRoute = normalizeRouteDirection(body.outboundRoute);
  const inboundRoute = normalizeRouteDirection(body.inboundRoute);
  const status = ALLOWED_ROUTE_STATUS.has(body.status) ? body.status : 'DRAFT';

  return {
    routeCode: String(body.routeCode || '').trim().toUpperCase(),
    routeName: String(body.routeName || '').trim() || buildDefaultRouteName(outboundRoute),
    routeType: String(body.routeType || 'URBAN').trim(),
    operator: String(body.operator || 'Veridian Transit').trim(),
    status,
    routeColor: String(body.routeColor || '#10b981').trim(),
    description: String(body.description || '').trim(),
    outboundRoute,
    inboundRoute,
    scheduleConfig: body.scheduleConfig || {},
    fareConfig: body.fareConfig || {},
    vehicleAssignment: body.vehicleAssignment || {},
    updatedBy: userId,
    ...(status === 'PUBLISHED' ? { lastPublishedAt: new Date() } : {}),
  };
};

const validateRoutePayload = (payload) => {
  const errors = [];
  if (!payload.routeCode) errors.push('Route code is required');
  if (!payload.routeName) errors.push('Route name is required');

  if (payload.status === 'DRAFT' || payload.status === 'SUSPENDED') {
    return errors;
  }

  ['outboundRoute', 'inboundRoute'].forEach((directionKey) => {
    const direction = payload[directionKey];
    if (!direction.orderedStops?.length || direction.orderedStops.length < 2) {
      errors.push(`${directionKey} must have at least 2 stops`);
    }
    direction.orderedStops?.forEach((stop, index) => {
      if (!stop.stopName) errors.push(`${directionKey} stop ${index + 1} name is required`);
      if (!stop.address) errors.push(`${directionKey} stop ${index + 1} address is required`);
      if (!Number.isFinite(stop.latitude) || !Number.isFinite(stop.longitude)) {
        errors.push(`${directionKey} stop ${index + 1} coordinates are invalid`);
      }
    });
  });

  return errors;
};

const normalizeImportHeader = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/^\uFEFF/, '')
  .replace(/\s+/g, '');

const parseCsvLine = (line) => {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
};

const parseStaffImportCsv = (buffer) => {
  const content = buffer.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = content.split('\n').filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error('Import file must include a header row and at least one staff row');
  }

  const rawHeaders = parseCsvLine(lines[0]);
  const headerMap = rawHeaders.map((header) => {
    const normalized = normalizeImportHeader(header);
    if (['email', 'mail'].includes(normalized)) return 'email';
    if (['email/sdt', 'email/sđt', 'emailsdt', 'emailsốđiệnthoại', 'identifier'].includes(normalized)) return 'identity';
    if (['phone', 'sdt', 'sodienthoai', 'sốđiệnthoại'].includes(normalized)) return 'phone';
    if (['fullname', 'name', 'ten', 'hoten', 'họvàtên'].includes(normalized)) return 'fullName';
    if (normalized === 'role' || normalized === 'vaitro') return 'role';
    return normalized;
  });

  const missingColumns = REQUIRED_IMPORT_COLUMNS.filter((column) => !headerMap.includes(column));
  if (!headerMap.includes('email') && !headerMap.includes('identity')) {
    missingColumns.push('email');
  }
  if (missingColumns.length > 0) {
    throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
  }

  return lines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line);
    const row = { rowNumber: rowIndex + 2 };
    headerMap.forEach((field, index) => {
      row[field] = values[index]?.trim() || '';
    });
    if (row.identity && !row.email && !row.phone) {
      if (row.identity.includes('@')) {
        row.email = row.identity;
      } else {
        row.phone = row.identity;
      }
    }
    row.role = row.role?.toUpperCase().replace(/\s+/g, ' ');
    return row;
  });
};

const generateTemporaryPassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@$!%*?&';
  const random = crypto.randomBytes(18);
  const password = Array.from(random, (byte) => alphabet[byte % alphabet.length]).join('');
  return `${password}A1!`;
};

const isSmtpConfigured = () => Boolean(
  config.smtp.host
  && config.smtp.port
  && config.smtp.user
  && config.smtp.password
  && config.smtp.user !== 'your_email@gmail.com'
  && config.smtp.password !== 'your_app_password'
);

const createMailTransport = () => nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: config.smtp.user && config.smtp.password
    ? { user: config.smtp.user, pass: config.smtp.password }
    : undefined,
});

const sendTemporaryPasswordMail = async ({ email, fullName, temporaryPassword }) => {
  const transporter = createMailTransport();
  await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject: 'Veridian Transit - Thông tin tài khoản đăng nhập',
    text: [
      `Xin chào ${fullName},`,
      '',
      'Tài khoản Veridian Transit của bạn đã được tạo.',
      '',
      `Tài khoản đăng nhập: ${email}`,
      `Mật khẩu tạm thời: ${temporaryPassword}`,
      '',
      'Bạn bắt buộc phải đổi mật khẩu mới trong lần đăng nhập đầu tiên. Không tiếp tục sử dụng mật khẩu tạm thời này.',
    ].join('\n'),
    html: [
      `<p>Xin chào <strong>${fullName}</strong>,</p>`,
      '<p>Tài khoản Veridian Transit của bạn đã được tạo.</p>',
      '<p>',
      `Tài khoản đăng nhập: <strong>${email}</strong><br />`,
      `Mật khẩu tạm thời: <strong>${temporaryPassword}</strong>`,
      '</p>',
      '<p>Bạn bắt buộc phải đổi mật khẩu mới trong lần đăng nhập đầu tiên. Không tiếp tục sử dụng mật khẩu tạm thời này.</p>',
    ].join(''),
  });
};

export class AdminController {
  static async createManagedUser(req, res, next) {
    try {
      const payload = {
        fullName: req.body.fullName?.trim(),
        email: normalizeEmail(req.body.email),
        phone: req.body.phone?.trim(),
        role: req.body.role?.trim().toUpperCase(),
      };

      const validationErrors = validateManagedUserPayload(payload);
      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      if (!isSmtpConfigured()) {
        return res.status(500).json({
          success: false,
          message: 'Chưa cấu hình SMTP. Không thể gửi tài khoản và mật khẩu về email đăng ký.',
        });
      }

      const existingUser = await AdminModel.findUserByIdentifier({
        email: payload.email,
        phone: payload.phone,
      });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Email or phone already registered',
        });
      }

      const temporaryPassword = generateTemporaryPassword();
      const isStaffRole = ALLOWED_MANAGED_ROLES.has(payload.role);
      const user = await AdminModel.createManagedUser({
        email: payload.email || undefined,
        phone: payload.phone || undefined,
        fullName: payload.fullName,
        password: temporaryPassword,
        role: payload.role,
        status: 'ACTIVE',
        isVerified: true,
        isFirstLogin: true,
        ...(isStaffRole
          ? {
            staffMetrics: {
              completedTrips: 0,
              incidents: 0,
              onTimeRate: 100,
              performanceScore: 100,
              lastActivityAt: new Date(),
            },
          }
          : {}),
        activityReports: [{
          type: 'ACCOUNT_CREATED',
          message: `Account created by administrator for ${payload.role.toLowerCase()} role.`,
          createdAt: new Date(),
        }],
      });

      try {
        await sendTemporaryPasswordMail({
          email: payload.email,
          fullName: payload.fullName,
          temporaryPassword,
        });
      } catch (mailError) {
        logger.error('Send managed user temporary password mail error:', mailError);
        if (user?._id) {
          await AdminModel.deleteUserById(user._id);
        }
        return res.status(502).json({
          success: false,
          message: 'Không thể gửi email tài khoản. Tài khoản chưa được tạo.',
          mailError: mailError.message || 'Email sending failed',
        });
      }

      return res.status(201).json({
        success: true,
        message: 'User account created successfully. Account credentials were sent by email.',
        user,
        mailSent: true,
      });
    } catch (error) {
      logger.error('Create managed user error:', error);
      next(error);
    }
  }

  static async importManagedUsers(req, res, next) {
    try {
      if (!req.file?.buffer) {
        return res.status(400).json({ success: false, message: 'Import file is required' });
      }

      if (!req.file.originalname?.toLowerCase().endsWith('.csv')) {
        return res.status(400).json({
          success: false,
          message: 'Only CSV files exported from Excel are supported for this import.',
        });
      }

      const rows = parseStaffImportCsv(req.file.buffer);
      const imported = [];
      const failed = [];

      for (const row of rows) {
        const validationErrors = validateImportedUserPayload(row);
        if (validationErrors) {
          failed.push({ rowNumber: row.rowNumber, email: row.email, reason: Object.values(validationErrors).join('; ') });
          continue;
        }

        const existingUser = await AdminModel.findUserByIdentifier({ email: row.email, phone: row.phone });
        if (existingUser) {
          failed.push({ rowNumber: row.rowNumber, email: row.email, reason: 'Email or phone already registered' });
          continue;
        }

        const temporaryPassword = generateTemporaryPassword();

        let createdUser = null;
        try {
          createdUser = await AdminModel.createManagedUser({
            email: row.email.toLowerCase(),
            phone: row.phone || undefined,
            fullName: row.fullName.trim(),
            password: temporaryPassword,
            role: row.role,
            status: 'ACTIVE',
            isVerified: true,
            isFirstLogin: true,
            staffMetrics: {
              completedTrips: 0,
              incidents: 0,
              onTimeRate: 100,
              performanceScore: 100,
              lastActivityAt: new Date(),
            },
            activityReports: [{
              type: 'ACCOUNT_CREATED',
              message: `Account imported for ${row.role.toLowerCase()} role. Temporary password sent by email.`,
              createdAt: new Date(),
            }],
          });

          await sendTemporaryPasswordMail({
            email: row.email,
            fullName: row.fullName,
            temporaryPassword,
          });

          imported.push(createdUser);
        } catch (importError) {
          if (createdUser?._id) {
            await AdminModel.deleteUserById(createdUser._id);
          }
          failed.push({ rowNumber: row.rowNumber, email: row.email, reason: importError.message || 'Import failed' });
        }
      }

      return res.status(201).json({
        success: failed.length === 0,
        message: `Imported ${imported.length} staff account(s).${failed.length ? ` ${failed.length} row(s) failed.` : ''}`,
        importedCount: imported.length,
        failedCount: failed.length,
        imported,
        failed,
      });
    } catch (error) {
      logger.error('Import managed users error:', error);
      next(error);
    }
  }

  static async getStaffPerformance(req, res, next) {
    try {
      const [summary, staffMembers] = await Promise.all([
        AdminModel.getStaffPerformanceSummary(),
        AdminModel.findStaffPerformanceUsers(),
      ]);

      return res.json({
        success: true,
        message: 'Staff performance statistics retrieved successfully',
        summary: {
          staffCount: summary.staffCount || 0,
          totalCompletedTrips: summary.totalCompletedTrips || 0,
          totalIncidents: summary.totalIncidents || 0,
          averageOnTimeRate: Math.round(summary.averageOnTimeRate || 0),
        },
        staffMembers,
      });
    } catch (error) {
      logger.error('Get staff performance error:', error);
      next(error);
    }
  }

  static async listUsers(req, res, next) {
    try {
      const options = AdminModel.buildUserQueryOptions(req.query);
      const result = await AdminModel.findUsers(options);
      return res.json({ success: true, message: 'Users retrieved successfully', ...result });
    } catch (error) {
      logger.error('List users error:', error);
      next(error);
    }
  }

  static async getUserDetail(req, res, next) {
    try {
      const user = await AdminModel.findUserById(req.params.userId);
      if (!user) return res.status(404).json({ success: false, message: 'User account not found' });
      return res.json({ success: true, message: 'User detail retrieved successfully', user });
    } catch (error) {
      logger.error('Get user detail error:', error);
      next(error);
    }
  }

  static async lockUser(req, res, next) {
    try {
      const { userId } = req.params;
      if (!isValidObjectId(userId)) return res.status(400).json({ success: false, message: 'Invalid user id' });
      const lockedUntil = req.body.lockedUntil ? new Date(req.body.lockedUntil) : null;
      const user = await AdminModel.lockUserById(userId, { reason: req.body.reason, lockedUntil });
      if (!user) return res.status(404).json({ success: false, message: 'User account not found' });
      return res.json({ success: true, message: 'User account locked successfully', user });
    } catch (error) {
      logger.error('Lock user error:', error);
      next(error);
    }
  }

  static async unlockUser(req, res, next) {
    try {
      const user = await AdminModel.unlockUserById(req.params.userId);
      if (!user) return res.status(404).json({ success: false, message: 'User account not found' });
      return res.json({ success: true, message: 'User account unlocked successfully', user });
    } catch (error) {
      logger.error('Unlock user error:', error);
      next(error);
    }
  }

  static async listRoutes(req, res, next) {
    try {
      const options = AdminModel.buildRouteQueryOptions(req.query);
      const result = await AdminModel.findRoutes(options);
      return res.json({ success: true, message: 'Routes retrieved successfully', ...result });
    } catch (error) {
      logger.error('List routes error:', error);
      next(error);
    }
  }

  static async getRouteDetail(req, res, next) {
    try {
      const { routeId } = req.params;
      if (!isValidObjectId(routeId)) return res.status(400).json({ success: false, message: 'Invalid route id' });
      const route = await AdminModel.findRouteById(routeId);
      if (!route) return res.status(404).json({ success: false, message: 'Route not found' });
      return res.json({ success: true, message: 'Route detail retrieved successfully', route });
    } catch (error) {
      logger.error('Get route detail error:', error);
      next(error);
    }
  }

  static async createRoute(req, res, next) {
    try {
      const payload = normalizeRoutePayload(req.body, req.user?.userId);
      payload.createdBy = req.user?.userId;
      const validationErrors = validateRoutePayload(payload);
      if (validationErrors.length) {
        return res.status(400).json({ success: false, message: 'Route validation failed', errors: validationErrors });
      }

      const route = await AdminModel.createRoute(payload);
      return res.status(201).json({ success: true, message: 'Route created successfully', route });
    } catch (error) {
      logger.error('Create route error:', error);
      if (error.code === 11000) {
        return res.status(409).json({ success: false, message: 'Route code already exists' });
      }
      next(error);
    }
  }

  static async updateRoute(req, res, next) {
    try {
      const { routeId } = req.params;
      if (!isValidObjectId(routeId)) return res.status(400).json({ success: false, message: 'Invalid route id' });

      const payload = normalizeRoutePayload(req.body, req.user?.userId);
      const validationErrors = validateRoutePayload(payload);
      if (validationErrors.length) {
        return res.status(400).json({ success: false, message: 'Route validation failed', errors: validationErrors });
      }

      const route = await AdminModel.updateRouteById(routeId, payload);
      if (!route) return res.status(404).json({ success: false, message: 'Route not found' });
      return res.json({ success: true, message: 'Route updated successfully', route });
    } catch (error) {
      logger.error('Update route error:', error);
      if (error.code === 11000) {
        return res.status(409).json({ success: false, message: 'Route code already exists' });
      }
      next(error);
    }
  }

  static async suspendRoute(req, res, next) {
    try {
      const { routeId } = req.params;
      if (!isValidObjectId(routeId)) return res.status(400).json({ success: false, message: 'Invalid route id' });
      const route = await AdminModel.updateRouteById(routeId, {
        status: 'SUSPENDED',
        updatedBy: req.user?.userId,
      });
      if (!route) return res.status(404).json({ success: false, message: 'Route not found' });
      return res.json({ success: true, message: 'Route suspended successfully', route });
    } catch (error) {
      logger.error('Suspend route error:', error);
      next(error);
    }
  }

  static async deleteRoute(req, res, next) {
    try {
      const { routeId } = req.params;
      if (!isValidObjectId(routeId)) return res.status(400).json({ success: false, message: 'Invalid route id' });
      const route = await AdminModel.deleteRouteById(routeId);
      if (!route) return res.status(404).json({ success: false, message: 'Route not found' });
      return res.json({ success: true, message: 'Route deleted successfully', route });
    } catch (error) {
      logger.error('Delete route error:', error);
      next(error);
    }
  }

  static async listStations(req, res, next) {
    try {
      const stations = await AdminModel.findStations(req.query);
      return res.json({ success: true, message: 'Stations retrieved successfully', stations });
    } catch (error) {
      logger.error('List stations error:', error);
      next(error);
    }
  }

  static async createStation(req, res, next) {
    try {
      const payload = {
        stationCode: String(req.body.stationCode || '').trim().toUpperCase(),
        stationName: String(req.body.stationName || '').trim(),
        address: String(req.body.address || '').trim(),
        latitude: asNumber(req.body.latitude),
        longitude: asNumber(req.body.longitude),
        city: String(req.body.city || 'Da Nang').trim(),
        zone: String(req.body.zone || '').trim(),
        isMainStation: Boolean(req.body.isMainStation),
        source: 'MANUAL',
      };

      if (!payload.stationCode || !payload.stationName || !payload.address) {
        return res.status(400).json({ success: false, message: 'Station code, name, and address are required' });
      }

      const station = await AdminModel.createStation(payload);
      return res.status(201).json({ success: true, message: 'Station created successfully', station });
    } catch (error) {
      logger.error('Create station error:', error);
      if (error.code === 11000) {
        return res.status(409).json({ success: false, message: 'Station code already exists' });
      }
      next(error);
    }
  }

  static async listBuses(req, res, next) {
    try {
      const buses = await AdminModel.findBuses();
      return res.json({ success: true, message: 'Buses retrieved successfully', buses });
    } catch (error) {
      logger.error('List buses error:', error);
      next(error);
    }
  }

  static async createBus(req, res, next) {
    try {
      const payload = normalizeBusPayload(req.body);
      const validationErrors = validateBusPayload(payload);
      if (validationErrors.length) {
        return res.status(400).json({ success: false, message: 'Bus validation failed', errors: validationErrors });
      }

      const bus = await AdminModel.createBus(payload);
      return res.status(201).json({ success: true, message: 'Bus created successfully', bus });
    } catch (error) {
      logger.error('Create bus error:', error);
      if (error.code === 11000) {
        return res.status(409).json({ success: false, message: 'Bus code or plate number already exists' });
      }
      next(error);
    }
  }

  static async updateBus(req, res, next) {
    try {
      const { busId } = req.params;
      if (!isValidObjectId(busId)) return res.status(400).json({ success: false, message: 'Invalid bus id' });

      const payload = normalizeBusPayload(req.body);
      const validationErrors = validateBusPayload(payload);
      if (validationErrors.length) {
        return res.status(400).json({ success: false, message: 'Bus validation failed', errors: validationErrors });
      }

      const bus = await AdminModel.updateBusById(busId, payload);
      if (!bus) return res.status(404).json({ success: false, message: 'Bus not found' });
      return res.json({ success: true, message: 'Bus updated successfully', bus });
    } catch (error) {
      logger.error('Update bus error:', error);
      if (error.code === 11000) {
        return res.status(409).json({ success: false, message: 'Bus code or plate number already exists' });
      }
      next(error);
    }
  }

  static async listTripSchedules(req, res, next) {
    try {
      const options = AdminModel.buildScheduleQueryOptions(req.query);
      const result = await AdminModel.findTripSchedules(options);
      return res.json({ success: true, message: 'Trip schedules retrieved successfully', ...result });
    } catch (error) {
      logger.error('List trip schedules error:', error);
      next(error);
    }
  }

  static async createTripSchedule(req, res, next) {
    try {
      const payload = await normalizeTripSchedulePayload(req.body, req.user?.userId);
      payload.createdBy = req.user?.userId;
      const validationErrors = validateTripSchedulePayload(payload);
      if (validationErrors.length) {
        return res.status(400).json({ success: false, message: 'Trip schedule validation failed', errors: validationErrors });
      }

      if (payload.vehicle?.busId) {
        const bus = (await AdminModel.findBuses()).find((item) => String(item._id) === String(payload.vehicle.busId));
        if (!bus) return res.status(400).json({ success: false, message: 'Assigned vehicle not found' });
        if (bus.status === 'MAINTENANCE') return res.status(409).json({ success: false, message: 'Vehicle is under maintenance and cannot be assigned' });
        payload.vehicle = normalizeAssignedVehicle(bus);
      }

      const conflicts = await AdminModel.findScheduleAssignmentConflicts(payload);
      if (conflicts.length) {
        return res.status(409).json({ success: false, message: 'Vehicle or staff already assigned to another trip at this time', conflicts });
      }

      const schedule = await AdminModel.createTripSchedule(payload);
      return res.status(201).json({ success: true, message: 'Trip schedule created successfully', schedule });
    } catch (error) {
      logger.error('Create trip schedule error:', error);
      if (error.code === 11000) {
        return res.status(409).json({ success: false, message: 'Schedule code already exists' });
      }
      next(error);
    }
  }

  static async updateTripSchedule(req, res, next) {
    try {
      const { scheduleId } = req.params;
      if (!isValidObjectId(scheduleId)) return res.status(400).json({ success: false, message: 'Invalid schedule id' });

      const payload = await normalizeTripSchedulePayload(req.body, req.user?.userId);
      const validationErrors = validateTripSchedulePayload(payload);
      if (validationErrors.length) {
        return res.status(400).json({ success: false, message: 'Trip schedule validation failed', errors: validationErrors });
      }

      if (payload.vehicle?.busId) {
        const bus = (await AdminModel.findBuses()).find((item) => String(item._id) === String(payload.vehicle.busId));
        if (!bus) return res.status(400).json({ success: false, message: 'Assigned vehicle not found' });
        if (bus.status === 'MAINTENANCE') return res.status(409).json({ success: false, message: 'Vehicle is under maintenance and cannot be assigned' });
        payload.vehicle = normalizeAssignedVehicle(bus);
      }

      const conflicts = await AdminModel.findScheduleAssignmentConflicts(payload, scheduleId);
      if (conflicts.length) {
        return res.status(409).json({ success: false, message: 'Vehicle or staff already assigned to another trip at this time', conflicts });
      }

      const schedule = await AdminModel.updateTripScheduleById(scheduleId, payload, {
        emergencyReason: req.body.emergencyReason,
        changedBy: req.user?.userId,
      });
      if (!schedule) return res.status(404).json({ success: false, message: 'Trip schedule not found' });
      return res.json({ success: true, message: req.body.emergencyReason ? 'Emergency reassignment saved successfully' : 'Trip schedule updated successfully', schedule });
    } catch (error) {
      logger.error('Update trip schedule error:', error);
      if (error.code === 11000) {
        return res.status(409).json({ success: false, message: 'Schedule code already exists' });
      }
      next(error);
    }
  }

  static async listRouteStaff(req, res, next) {
    try {
      const result = await AdminModel.findRouteStaff();
      return res.json({ success: true, message: 'Route staff retrieved successfully', ...result });
    } catch (error) {
      logger.error('List route staff error:', error);
      next(error);
    }
  }
}

export default AdminController;
