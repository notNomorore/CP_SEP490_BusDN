// Express app factory with middleware setup
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import path from 'path';

import { config } from './config/environment.js';
import { responseHandler } from './utils/response.js';
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandler.js';
import logger from './utils/logger.js';
import authRoutes from './modules/auth/authRoutes.js';
import priorityProfileRoutes from './modules/priorityProfile/priorityProfileRoutes.js';
import customerSupportRoutes from './modules/customerSupport/customerSupportRoutes.js';
import routeRoutes from './modules/routes/routeRoutes.js';
import adminRoutes from './modules/admin/adminRoutes.js';
import profileRoutes from './modules/profile/profileRoutes.js';
import promotionRoutes from './modules/promotions/promotionRoutes.js';
import revenueReportRoutes from './modules/revenue/revenueReport.routes.js';
import routeEfficiencyRoutes from './modules/analytics/routeEfficiency.routes.js';
import incidentReportRoutes from './modules/incidents/incidentReport.routes.js';
import systemMonitoringRoutes from './modules/systemMonitoring/systemMonitoring.routes.js';
import scheduleOperationsRoutes from './modules/scheduleOperations/scheduleOperationsRoutes.js';
import fareOperationsRoutes from './modules/fareOperations/fareOperations.routes.js';
import walkInTicketRoutes from './modules/walkInTickets/walkInTicket.routes.js';
import passengerComplianceRoutes from './modules/passengerCompliance/passengerCompliance.routes.js';
import busStopRoutes from './modules/busStops/busStopRoutes.js';

export const createApp = () => {
  const app = express();

  // Trust proxy
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cors(config.cors));

  // Compression middleware
  app.use(compression());

  // Request logging
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  }));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.use('/uploads', express.static(path.resolve(config.paths.uploads)));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.apiMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path.startsWith('/auth/'),
    handler: (req, res, _next, options) => res.status(options.statusCode).json({
      success: false,
      statusCode: options.statusCode,
      message: 'Request limit reached. Please wait briefly and try again.',
      retryAfter: res.getHeader('Retry-After') || null,
      timestamp: new Date().toISOString(),
    }),
  });

  const authLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.authMax,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, _next, options) => res.status(options.statusCode).json({
      success: false,
      statusCode: options.statusCode,
      message: 'Too many authentication attempts. Please wait before trying again.',
      retryAfter: res.getHeader('Retry-After') || null,
      timestamp: new Date().toISOString(),
    }),
  });

  app.use('/api/', limiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);

  // Session middleware
  app.use(session(config.session));

  // Response handler middleware
  app.use(responseHandler);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.success(
      { status: 'OK', timestamp: new Date().toISOString() },
      'Service is healthy'
    );
  });

  // API version endpoint
  app.get('/api/version', (req, res) => {
    res.success(
      { version: '0.1.0', environment: config.nodeEnv },
      'API version'
    );
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/priority-profile', priorityProfileRoutes);
  app.use('/api/customer-support', customerSupportRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/admin/promotions', promotionRoutes);
  app.use('/api/admin/revenue', revenueReportRoutes);
  app.use('/api/admin/analytics', routeEfficiencyRoutes);
  app.use('/api/admin/incidents', incidentReportRoutes);
  app.use('/api/admin', systemMonitoringRoutes);
  app.use('/api/admin/fares', fareOperationsRoutes);
  app.use('/api/admin', walkInTicketRoutes);
  app.use('/api/admin', passengerComplianceRoutes);
  app.use('/api/bus-stops', busStopRoutes);
  app.use('/api/routes', routeRoutes);
  app.use('/api/schedule-operations', scheduleOperationsRoutes);


  // 404 handler (must be after all routes)
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(globalErrorHandler);

  return app;
};

export default createApp;
