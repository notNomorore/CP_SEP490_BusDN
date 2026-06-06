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
import profileRoutes from './modules/profile/profileRoutes.js';
import promotionRoutes from './modules/promotions/promotionRoutes.js';
import revenueReportRoutes from './modules/revenue/revenueReport.routes.js';

export const createApp = () => {
  const app = express();

  // Trust proxy
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet());
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
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: config.nodeEnv === 'development' ? 100 : 5,
    message: 'Too many authentication attempts, please try again later.',
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

  // Routes will be mounted here
  app.use('/api/auth', authRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/admin/promotions', promotionRoutes);
  app.use('/api/admin/revenue', revenueReportRoutes);
  // app.use('/api/routes', routeRoutes);
  // etc...

  // 404 handler (must be after all routes)
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(globalErrorHandler);

  return app;
};

export default createApp;
