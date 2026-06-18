import mongoose from 'mongoose';

const PriorityProfileDocumentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['IDENTITY_FRONT', 'IDENTITY_BACK', 'PRIORITY_PROOF', 'PORTRAIT', 'OTHER'],
      required: true,
    },
    originalName: String,
    fileName: String,
    mimeType: String,
    size: Number,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const PriorityProfileRequestSchema = new mongoose.Schema(
  {
    passenger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    profileType: {
      type: String,
      enum: ['STUDENT', 'SENIOR', 'DISABLED', 'PREGNANT', 'CHILD_UNDER_6', 'OTHER'],
      required: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    identityNumber: {
      type: String,
      required: true,
      trim: true,
    },
    cardNumber: {
      type: String,
      trim: true,
    },
    issuingAuthority: {
      type: String,
      trim: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'],
      default: 'PENDING',
      index: true,
    },
    rejectionReason: String,
    expiryDate: Date,
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    reviewedAt: Date,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    documents: [PriorityProfileDocumentSchema],
  },
  {
    timestamps: true,
    collection: 'priorityprofiles',
  }
);

PriorityProfileRequestSchema.index({ passenger: 1, submittedAt: -1 });
PriorityProfileRequestSchema.index({ status: 1, submittedAt: -1 });

export default mongoose.model('PriorityProfileRequest', PriorityProfileRequestSchema);
