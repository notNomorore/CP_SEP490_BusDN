import mongoose from 'mongoose';
import User from '../auth/User.js';
import ChatGroup from './ChatGroup.js';
import ChatMessage from './ChatMessage.js';
import { emitOperationChatMessage } from './operationChat.socket.js';

const ALLOWED_ROLES = ['ADMIN', 'DRIVER', 'BUS_ASSISTANT'];
const DEFAULT_GROUP_NAME = 'Nhóm vận hành BusDN';

const normalizeId = (value) => String(value || '');
const normalizeRole = (role) => {
  const normalized = String(role || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized === 'CONDUCTOR' || normalized === 'ASSISTANT' || normalized === 'BUSASSISTANT') {
    return 'BUS_ASSISTANT';
  }
  return normalized;
};

const toObjectId = (value) => (
  value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(value)
);

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeMessageContent = (value) => {
  if (value && typeof value === 'object') {
    return String(value.content || value.message || value.text || '').trim();
  }
  return String(value || '').trim();
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const assertAllowedRole = (user) => {
  if (!ALLOWED_ROLES.includes(normalizeRole(user?.role))) {
    throw createHttpError('Only Admin, Driver, and Bus Assistant can access operation chat', 403);
  }
};

const formatUser = (user) => ({
  id: normalizeId(user?._id || user?.id),
  fullName: user?.fullName || user?.name || user?.email || 'Unknown',
  email: user?.email || '',
  role: user?.role || '',
});

const formatGroup = (group, unreadCount = 0, lastMessage = null) => ({
  id: normalizeId(group._id),
  name: group.name,
  description: group.description,
  type: group.type,
  memberCount: group.members?.length || 0,
  lastMessageAt: group.lastMessageAt,
  lastMessage,
  lastMessageContent: lastMessage?.content || '',
  unreadCount,
});

const formatMessage = (message, actorId = null) => ({
  id: normalizeId(message._id),
  groupId: normalizeId(message.group),
  sender: formatUser(message.sender),
  senderRole: message.senderRole,
  content: message.content,
  sentAt: message.sentAt,
  isRead: actorId
    ? (message.readBy || []).some((read) => normalizeId(read.user) === normalizeId(actorId))
    : Boolean(message.readBy?.length),
  readBy: (message.readBy || []).map((read) => ({
    userId: normalizeId(read.user),
    readAt: read.readAt,
  })),
});

export class OperationChatService {
  static async ensureDefaultGroup(actor = null) {
    const staff = await User.find({
      role: { $in: ALLOWED_ROLES },
      status: { $ne: 'LOCKED' },
    }).select('_id role').lean();

    const memberMap = new Map(staff.map((user) => [normalizeId(user._id), {
      user: user._id,
      role: user.role,
      joinedAt: new Date(),
    }]));

    const actorRole = normalizeRole(actor?.role);
    if (actor?.userId && ALLOWED_ROLES.includes(actorRole)) {
      memberMap.set(normalizeId(actor.userId), {
        user: toObjectId(actor.userId),
        role: actorRole,
        joinedAt: new Date(),
      });
    }

    const members = [...memberMap.values()];

    const group = await ChatGroup.findOneAndUpdate(
      { type: 'OPERATIONS', name: DEFAULT_GROUP_NAME },
      {
        $set: {
          description: 'Trao đổi nhanh giữa điều hành, tài xế và phụ xe để xử lý vận hành.',
          isActive: true,
          members,
        },
        $setOnInsert: {
          createdBy: members[0]?.user || null,
        },
      },
      { new: true, upsert: true }
    );

    return group;
  }

  static async assertGroupMembership(groupId, user) {
    assertAllowedRole(user);

    if (!isValidObjectId(groupId)) {
      throw createHttpError('Invalid chat group id', 400);
    }
    if (!isValidObjectId(user?.userId)) {
      throw createHttpError('Invalid authenticated user id', 401);
    }

    const userId = toObjectId(user.userId);

    const group = await ChatGroup.findOne({
      _id: groupId,
      isActive: true,
      members: {
        $elemMatch: {
          user: userId,
        },
      },
    });

    if (!group) {
      throw createHttpError('You are not a member of this chat group', 403);
    }

    return group;
  }

  static async listMyGroups(user) {
    assertAllowedRole(user);
    if (!isValidObjectId(user?.userId)) {
      throw createHttpError('Invalid authenticated user id', 401);
    }
    const userId = toObjectId(user.userId);

    await this.ensureDefaultGroup(user);

    const groups = await ChatGroup.find({
      isActive: true,
      members: {
        $elemMatch: {
          user: userId,
        },
      },
    }).sort({ lastMessageAt: -1, updatedAt: -1 }).lean();

    const unreadByGroup = await ChatMessage.aggregate([
      { $match: { group: { $in: groups.map((group) => group._id) }, sender: { $ne: userId } } },
      { $match: { readBy: { $not: { $elemMatch: { user: userId } } } } },
      { $group: { _id: '$group', count: { $sum: 1 } } },
    ]);
    const unreadMap = new Map(unreadByGroup.map((item) => [normalizeId(item._id), item.count]));

    const latestMessageEntries = await Promise.all(groups.map(async (group) => {
      const message = await ChatMessage.findOne({ group: group._id })
        .populate('sender', 'fullName name email role')
        .sort({ sentAt: -1 })
        .lean();
      return [normalizeId(group._id), message ? formatMessage(message, userId) : null];
    }));
    const latestMessageMap = new Map(latestMessageEntries);

    return groups.map((group) => {
      const groupId = normalizeId(group._id);
      return formatGroup(group, unreadMap.get(groupId) || 0, latestMessageMap.get(groupId) || null);
    });
  }

  static async listMessages(groupId, user, query = {}) {
    await this.assertGroupMembership(groupId, user);
    const userId = toObjectId(user.userId);

    const limit = Math.min(Math.max(Number(query.limit) || 80, 1), 150);
    await ChatMessage.updateMany(
      {
        group: groupId,
        sender: { $ne: userId },
        readBy: { $not: { $elemMatch: { user: userId } } },
      },
      { $push: { readBy: { user: userId, readAt: new Date() } } }
    );

    const messages = await ChatMessage.find({ group: groupId })
      .populate('sender', 'fullName name email role')
      .sort({ sentAt: -1 })
      .limit(limit)
      .lean();

    return messages.reverse().map((message) => formatMessage(message, userId));
  }

  static async sendMessage(groupId, user, payload = {}) {
    const content = normalizeMessageContent(payload.content);
    if (!content) {
      throw createHttpError('Message content is required', 400);
    }

    const group = await this.assertGroupMembership(groupId, user);
    const userId = toObjectId(user.userId);
    const message = await ChatMessage.create({
      group: group._id,
      sender: userId,
      senderRole: normalizeRole(user.role),
      content,
      sentAt: new Date(),
      readBy: [{ user: userId, readAt: new Date() }],
    });

    group.lastMessageAt = message.sentAt;
    await group.save();

    const populated = await ChatMessage.findById(message._id)
      .populate('sender', 'fullName name email role');
    const formatted = formatMessage(populated, userId);
    emitOperationChatMessage(formatted);

    return formatted;
  }

  static async markGroupRead(groupId, user) {
    await this.assertGroupMembership(groupId, user);
    const userId = toObjectId(user.userId);

    await ChatMessage.updateMany(
      {
        group: groupId,
        sender: { $ne: userId },
        readBy: { $not: { $elemMatch: { user: userId } } },
      },
      { $push: { readBy: { user: userId, readAt: new Date() } } }
    );

    return { groupId, readAt: new Date() };
  }
}

export default OperationChatService;
