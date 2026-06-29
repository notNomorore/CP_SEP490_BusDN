import mongoose from 'mongoose';

const ChatMessageReadSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const ChatMessageSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatGroup',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderRole: {
      type: String,
      enum: ['ADMIN', 'DRIVER', 'BUS_ASSISTANT'],
      required: true,
    },
    content: {
      type: String,
      trim: true,
      required: true,
      maxlength: 2000,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    readBy: {
      type: [ChatMessageReadSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'operationchatmessages',
  }
);

ChatMessageSchema.index({ group: 1, sentAt: 1 });

const ChatMessage = mongoose.models.ChatMessage || mongoose.model('ChatMessage', ChatMessageSchema);

export default ChatMessage;
