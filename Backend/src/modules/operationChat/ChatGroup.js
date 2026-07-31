import mongoose from 'mongoose';

const ChatGroupMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['ADMIN', 'DRIVER', 'BUS_ASSISTANT'],
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const ChatGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    type: {
      type: String,
      enum: ['OPERATIONS', 'INCIDENT', 'TRIP', 'EMERGENCY', 'GENERAL'],
      default: 'OPERATIONS',
    },
    members: {
      type: [ChatGroupMemberSchema],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'operationchatgroups',
  }
);

ChatGroupSchema.index({ isActive: 1, type: 1 });
ChatGroupSchema.index({ 'members.user': 1, isActive: 1 });

const ChatGroup = mongoose.models.ChatGroup || mongoose.model('ChatGroup', ChatGroupSchema);

export default ChatGroup;
