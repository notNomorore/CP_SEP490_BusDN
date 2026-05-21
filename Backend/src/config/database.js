// Database connection and initialization
import mongoose from 'mongoose';
import { config } from '../config/environment.js';
import logger from '../utils/logger.js';

let isConnected = false;

export const connectDatabase = async () => {
  if (isConnected) {
    logger.info('Database already connected');
    return;
  }

  if (!config.mongodb.uri) {
    throw new Error('MONGODB_URI is not configured');
  }

  try {
    logger.info('Connecting to MongoDB...');

    await mongoose.connect(config.mongodb.uri, {
      ...config.mongodb.options,
      ...(config.mongodb.dbName ? { dbName: config.mongodb.dbName } : {}),
    });

    isConnected = true;
    logger.info(`Connected to MongoDB: ${mongoose.connection.name} @ ${mongoose.connection.host}`);

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
      isConnected = true;
    });
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
};

export const disconnectDatabase = async () => {
  try {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('Disconnected from MongoDB');
  } catch (error) {
    logger.error('Failed to disconnect from MongoDB:', error);
    throw error;
  }
};

export const isDatabaseConnected = () => isConnected;

export default {
  connectDatabase,
  disconnectDatabase,
  isDatabaseConnected,
};
