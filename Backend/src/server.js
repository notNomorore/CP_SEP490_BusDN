// Server entry point - initialize and start the Express app
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { config } from './config/environment.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { createApp } from './app.js';
import logger from './utils/logger.js';

let isConnectingDatabase = false;

const connectDatabaseWithRetry = async () => {
  if (isConnectingDatabase) {
    return;
  }

  isConnectingDatabase = true;
  try {
    await connectDatabase();
  } catch (error) {
    logger.warn('MongoDB unavailable during startup. Retrying in 15 seconds...');
    setTimeout(() => {
      isConnectingDatabase = false;
      connectDatabaseWithRetry();
    }, 15000);
    return;
  }

  isConnectingDatabase = false;
};

const startServer = async () => {
  try {
    logger.info('Initializing server...');
    const app = createApp();
    const server = http.createServer(app);

    const io = new SocketIOServer(server, {
      cors: config.cors,
      transports: ['websocket', 'polling'],
    });

    io.on('connection', (socket) => {
      logger.info(`Socket.IO client connected: ${socket.id}`);

      socket.on('disconnect', () => {
        logger.info(`Socket.IO client disconnected: ${socket.id}`);
      });

      socket.on('error', (error) => {
        logger.error(`Socket.IO error for ${socket.id}:`, error);
      });
    });

    app.io = io;

    const gracefulShutdown = async (signal) => {
      logger.warn(`${signal} received, starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await disconnectDatabase();
          logger.info('Database disconnected');
        } catch (error) {
          logger.error('Error disconnecting database:', error);
        }

        logger.info('Server shutdown complete');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise);
      logger.error('Unhandled Rejection reason:', reason);
    });

    server.listen(config.port, config.host, () => {
      logger.info(`Server running at http://${config.host}:${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info('Socket.IO server is ready on /socket.io');
    });

    connectDatabaseWithRetry();
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default startServer;
