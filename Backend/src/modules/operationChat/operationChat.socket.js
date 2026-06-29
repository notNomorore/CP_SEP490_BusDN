import jwt from 'jsonwebtoken';
import { config } from '../../config/environment.js';
import logger from '../../utils/logger.js';
import User from '../auth/User.js';
import ChatGroup from './ChatGroup.js';

const CHAT_EVENTS = {
  JOIN: 'operation-chat:join',
  LEAVE: 'operation-chat:leave',
  MESSAGE: 'server:operation-chat:message',
};

let socketServer = null;

const roomName = (groupId) => `operation-chat:${groupId}`;

const extractToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  const headerToken = socket.handshake.headers?.authorization?.split(' ')[1];
  return authToken || headerToken || null;
};

const attachUser = async (socket) => {
  const token = extractToken(socket);
  if (!token) return null;

  const decoded = jwt.verify(token, config.jwt.secret);
  const user = await User.findById(decoded.userId).select('email role status accountLock').lean();

  if (!user || user.status !== 'ACTIVE' || user.accountLock?.isLocked) return null;

  socket.data.user = {
    userId: user._id,
    email: user.email || decoded.email,
    role: user.role,
  };

  return socket.data.user;
};

const emitAck = (callback, payload) => {
  if (typeof callback === 'function') {
    callback(payload);
  }
};

const assertSocketMembership = async (groupId, user) => {
  if (!['ADMIN', 'DRIVER', 'BUS_ASSISTANT'].includes(user?.role)) {
    throw new Error('Operation chat role is required');
  }

  const group = await ChatGroup.findOne({
    _id: groupId,
    isActive: true,
    members: {
      $elemMatch: {
        user: user.userId,
        role: user.role,
      },
    },
  }).select('_id').lean();

  if (!group) {
    throw new Error('You are not a member of this chat group');
  }

  return group;
};

export const emitOperationChatMessage = (message) => {
  if (!socketServer || !message?.groupId) return;
  socketServer.to(roomName(message.groupId)).emit(CHAT_EVENTS.MESSAGE, message);
};

export const registerOperationChatSockets = (io) => {
  socketServer = io;

  io.use(async (socket, next) => {
    try {
      if (!socket.data.user) {
        await attachUser(socket);
      }
      return next();
    } catch (error) {
      logger.warn(`Operation chat socket auth failed for ${socket.id}: ${error.message}`);
      return next();
    }
  });

  io.on('connection', (socket) => {
    socket.on(CHAT_EVENTS.JOIN, async (payload = {}, callback) => {
      try {
        if (!socket.data.user) {
          return emitAck(callback, { success: false, message: 'Authentication is required' });
        }

        const groupId = payload.groupId;
        await assertSocketMembership(groupId, socket.data.user);
        socket.join(roomName(groupId));
        return emitAck(callback, { success: true, groupId });
      } catch (error) {
        return emitAck(callback, { success: false, message: error.message });
      }
    });

    socket.on(CHAT_EVENTS.LEAVE, (payload = {}, callback) => {
      if (payload.groupId) {
        socket.leave(roomName(payload.groupId));
      }
      return emitAck(callback, { success: true, groupId: payload.groupId });
    });
  });
};

export default registerOperationChatSockets;
