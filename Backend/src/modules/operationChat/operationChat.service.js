import mongoose from 'mongoose';
import User from '../auth/User.js';
import ChatGroup from './ChatGroup.js';
import ChatMessage from './ChatMessage.js';
import { emitOperationChatMessage } from './operationChat.socket.js';

const ALLOWED_ROLES = ['ADMIN', 'DRIVER', 'BUS_ASSISTANT'];
const DEFAULT_GROUP_NAME = 'Nhóm vận hành BusDN';

const normalizeId = (value) => String(value || '');

const toObjectId = (value) => (
  value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(value)
);

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const assertAllowedRole = (user) => {
  if (!ALLOWED_ROLES.includes(user?.role)) {
    throw createHttpError('Only Admin, Driver, and Bus Assistant can access operation chat', 403);
  }
};

const formatUser = (user) => ({
  id: normalizeId(user?._id || user?.id),
  fullName: user?.fullName || user?.name || user?.email || 'Unknown',
  email: user?.email || '',
  role: user?.role || '',
});

const formatGroup = (group, unreadCount = 0) => ({
  id: normalizeId(group._id),
  name: group.name,
  description: group.description,
  type: group.type,
  memberCount: group.members?.length || 0,
  lastMessageAt: group.lastMessageAt,
  unreadCount,
});

const formatMessage = (message) => ({
  id: normalizeId(message._id),
  groupId: normalizeId(message.group),
  sender: formatUser(message.sender),
  senderRole: message.senderRole,
  content: message.content,
  sentAt: message.sentAt,
  isRead: Boolean(message.readBy?.length),
  readBy: (message.readBy || []).map((read) => ({
    userId: normalizeId(read.user),
    readAt: read.readAt,
  })),
});

export class OperationChatService {
  static async ensureDefaultGroup() {
    const staff = await User.find({
      role: { $in: ALLOWED_ROLES },
      status: { $ne: 'LOCKED' },
    }).select('_id role').lean();

    const members = staff.map((user) => ({
      user: user._id,
      role: user.role,
      joinedAt: new Date(),
    }));

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
          role: user.role,
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

    await this.ensureDefaultGroup();

    const groups = await ChatGroup.find({
      isActive: true,
      members: {
        $elemMatch: {
          user: userId,
          role: user.role,
        },
      },
    }).sort({ lastMessageAt: -1, updatedAt: -1 }).lean();

    const unreadByGroup = await ChatMessage.aggregate([
      { $match: { group: { $in: groups.map((group) => group._id) }, sender: { $ne: userId } } },
      { $match: { readBy: { $not: { $elemMatch: { user: userId } } } } },
      { $group: { _id: '$group', count: { $sum: 1 } } },
    ]);
    const unreadMap = new Map(unreadByGroup.map((item) => [normalizeId(item._id), item.count]));

    return groups.map((group) => formatGroup(group, unreadMap.get(normalizeId(group._id)) || 0));
  }

  static async listMessages(groupId, user, query = {}) {
    await this.assertGroupMembership(groupId, user);
    const userId = toObjectId(user.userId);

    const limit = Math.min(Math.max(Number(query.limit) || 80, 1), 150);
    const messages = await ChatMessage.find({ group: groupId })
      .populate('sender', 'fullName name email role')
      .sort({ sentAt: -1 })
      .limit(limit);

    await ChatMessage.updateMany(
      {
        group: groupId,
        sender: { $ne: userId },
        readBy: { $not: { $elemMatch: { user: userId } } },
      },
      { $push: { readBy: { user: userId, readAt: new Date() } } }
    );

    return messages.reverse().map(formatMessage);
  }

  static async sendMessage(groupId, user, payload = {}) {
    const content = String(payload.content || '').trim();
    if (!content) {
      throw createHttpError('Message content is required', 400);
    }

    const group = await this.assertGroupMembership(groupId, user);
    const userId = toObjectId(user.userId);
    const message = await ChatMessage.create({
      group: group._id,
      sender: userId,
      senderRole: user.role,
      content,
      sentAt: new Date(),
      readBy: [{ user: userId, readAt: new Date() }],
    });

    group.lastMessageAt = message.sentAt;
    await group.save();

    const populated = await ChatMessage.findById(message._id)
      .populate('sender', 'fullName name email role');
    const formatted = formatMessage(populated);
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
