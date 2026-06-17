import jwt from 'jsonwebtoken';
import { config } from '../../config/environment.js';
import logger from '../../utils/logger.js';
import User from '../auth/User.js';
import FleetMonitoringService from '../fleetMonitoring/fleetMonitoring.service.js';
import { FLEET_ROOM, SOCKET_EVENTS } from './fleetOperations.constants.js';

const extractToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  const headerToken = socket.handshake.headers?.authorization?.split(' ')[1];
  return authToken || headerToken || null;
};

const attachUser = async (socket) => {
  const token = extractToken(socket);
  if (!token) {
    return null;
  }

  const decoded = jwt.verify(token, config.jwt.secret);
  const user = await User.findById(decoded.userId).select('email role status accountLock');

  if (!user || user.status !== 'ACTIVE' || user.accountLock?.isLocked) {
    return null;
  }

  socket.data.user = {
    userId: user._id,
    email: user.email || decoded.email,
    role: user.role,
  };

  return socket.data.user;
};

const canSendDriverTelemetry = (user) => ['DRIVER', 'BUS_ASSISTANT', 'ADMIN'].includes(user?.role);
const canSubscribeFleet = (user) => user?.role === 'ADMIN';

const emitAck = (callback, payload) => {
  if (typeof callback === 'function') {
    callback(payload);
  }
};

export const registerFleetOperationSockets = (io) => {
  io.use(async (socket, next) => {
    try {
      await attachUser(socket);
      return next();
    } catch (error) {
      logger.warn(`Socket auth failed for ${socket.id}: ${error.message}`);
      return next();
    }
  });

  io.on('connection', (socket) => {
    socket.on(SOCKET_EVENTS.ADMIN_FLEET_SUBSCRIBE, (_payload, callback) => {
      if (!canSubscribeFleet(socket.data.user)) {
        return emitAck(callback, { success: false, message: 'Admin role is required' });
      }

      socket.join(FLEET_ROOM);
      return emitAck(callback, { success: true, room: FLEET_ROOM });
    });

    socket.on(SOCKET_EVENTS.ADMIN_FLEET_UNSUBSCRIBE, (_payload, callback) => {
      socket.leave(FLEET_ROOM);
      return emitAck(callback, { success: true, room: FLEET_ROOM });
    });

    socket.on(SOCKET_EVENTS.DRIVER_GPS_UPDATE, async (payload, callback) => {
      try {
        if (!canSendDriverTelemetry(socket.data.user)) {
          return emitAck(callback, { success: false, message: 'Driver, assistant, or admin role is required' });
        }

        const result = await FleetMonitoringService.updateDriverGps(payload, socket.data.user, io);
        return emitAck(callback, { success: true, data: result });
      } catch (error) {
        logger.error(`GPS update failed for socket ${socket.id}:`, error);
        return emitAck(callback, { success: false, message: error.message });
      }
    });
  });
};

export default registerFleetOperationSockets;
