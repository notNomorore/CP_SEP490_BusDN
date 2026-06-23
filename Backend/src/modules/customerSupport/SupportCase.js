import mongoose from 'mongoose';

const SupportCaseSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['COMPLAINT', 'LOST_ITEM', 'SERVICE_FEEDBACK'],
      required: true,
      index: true,
    },
    referenceNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
    },
    passenger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: [
        'SERVICE_QUALITY',
        'DELAY',
        'DRIVER_BEHAVIOR',
        'BUS_ASSISTANT_SERVICE',
        'ROUTE_EXPERIENCE',
        'MOBILE_APPLICATION',
        'SUGGESTION',
        'COMPLAINT',
        'SAFETY',
        'PAYMENT',
        'LOST_ITEM',
        'OTHER',
      ],
      default: 'OTHER',
    },
    ratingScore: {
      type: Number,
      min: 1,
      max: 5,
    },
    priority: {
      type: String,
      enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
      default: 'NORMAL',
      index: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'SUBMITTED', 'UNDER_REVIEW', 'RESPONDED', 'REJECTED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    relatedTripId: {
      type: String,
      trim: true,
      default: '',
    },
    routeName: String,
    tripCode: String,
    busPlate: String,
    incidentAt: Date,
    contactPhone: String,
    contactEmail: String,
    attachments: [
      {
        originalName: String,
        fileName: String,
        path: String,
        mimeType: String,
        size: Number,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    lostItem: {
      itemName: String,
      itemCategory: {
        type: String,
        enum: ['PERSONAL_BELONGINGS', 'ELECTRONICS', 'WALLET_DOCUMENTS', 'CLOTHING', 'BAGS_LUGGAGE', 'OTHER_ITEMS'],
        default: 'OTHER_ITEMS',
      },
      itemDescription: String,
      lastSeenLocation: String,
      lostAt: Date,
      recoveryStatus: {
        type: String,
        enum: ['REPORTED', 'SEARCHING', 'FOUND', 'RETURNED', 'UNRECOVERED'],
        default: 'REPORTED',
      },
      foundAt: Date,
      returnedAt: Date,
    },
    responses: [
      {
        message: {
          type: String,
          required: true,
          trim: true,
        },
        responder: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        statusBefore: {
          type: String,
          enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'SUBMITTED', 'UNDER_REVIEW', 'RESPONDED', 'REJECTED', 'CLOSED'],
          default: 'OPEN',
        },
        statusAfter: {
          type: String,
          enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'SUBMITTED', 'UNDER_REVIEW', 'RESPONDED', 'REJECTED', 'CLOSED'],
          default: 'IN_PROGRESS',
        },
        responseType: {
          type: String,
          enum: ['COMPLAINT_RESPONSE', 'INTERNAL_NOTE'],
          default: 'COMPLAINT_RESPONSE',
        },
        visibleToPassenger: {
          type: Boolean,
          default: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: Date,
    closedAt: Date,
  },
  {
    timestamps: true,
  }
);

SupportCaseSchema.index({ createdAt: -1 });
SupportCaseSchema.index({ type: 1, status: 1, createdAt: -1 });

export default mongoose.model('SupportCase', SupportCaseSchema);
