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
        'ROUTE_DELAY',
        'DELAY',
        'DRIVER_BEHAVIOR',
        'BUS_ASSISTANT_BEHAVIOR',
        'BUS_ASSISTANT_SERVICE',
        'BUS_CLEANLINESS',
        'ROUTE_EXPERIENCE',
        'APP_ISSUE',
        'MOBILE_APPLICATION',
        'PAYMENT_ISSUE',
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
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'NORMAL', 'URGENT'],
      default: 'LOW',
      index: true,
    },
    priorityReason: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: [
        'NEW',
        'IN_REVIEW',
        'INVESTIGATING',
        'WAITING_FOR_INFORMATION',
        'ACTION_REQUIRED',
        'REOPENED',
        'PENDING',
        'IN_PROGRESS',
        'WAITING_FOR_PASSENGER',
        'RESOLVED',
        'REJECTED',
        'CLOSED',
        'OPEN',
        'SUBMITTED',
        'UNDER_REVIEW',
        'RESPONDED',
        'WAITING_FOR_MATCH',
        'POTENTIAL_MATCH',
        'MATCH_CONFIRMED',
        'RETURN_IN_PROGRESS',
        'RETURNED',
        'CANCELLED',
      ],
      default: 'OPEN',
      index: true,
    },
    replyStatus: {
      type: String,
      enum: ['UNREPLIED', 'REPLIED', 'WAITING_FOR_PASSENGER', 'CUSTOMER_REPLIED'],
      default: 'UNREPLIED',
      index: true,
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
    },
    tripId: {
      type: String,
      trim: true,
      default: '',
    },
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
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
      color: {
        type: String,
        trim: true,
        default: '',
      },
      brand: {
        type: String,
        trim: true,
        default: '',
      },
      identifyingDetails: {
        type: String,
        trim: true,
        default: '',
      },
      lastSeenLocation: String,
      lostAt: Date,
      recoveryStatus: {
        type: String,
        enum: [
          'REPORTED',
          'SEARCHING',
          'POTENTIAL_MATCH',
          'MATCH_CONFIRMED',
          'RETURN_IN_PROGRESS',
          'FOUND',
          'RETURNED',
          'UNRECOVERED',
          'CANCELLED',
        ],
        default: 'REPORTED',
      },
      foundAt: Date,
      returnedAt: Date,
      contactPreference: {
        type: String,
        enum: ['PHONE', 'EMAIL', 'IN_APP', 'ANY', ''],
        default: 'ANY',
      },
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
          enum: [
            'NEW',
            'IN_REVIEW',
            'INVESTIGATING',
            'WAITING_FOR_INFORMATION',
            'ACTION_REQUIRED',
            'RESOLVED',
            'CLOSED',
            'REOPENED',
            'OPEN',
            'IN_PROGRESS',
            'WAITING_FOR_PASSENGER',
            'SUBMITTED',
            'UNDER_REVIEW',
            'RESPONDED',
            'REJECTED',
            'WAITING_FOR_MATCH',
            'POTENTIAL_MATCH',
            'MATCH_CONFIRMED',
            'RETURN_IN_PROGRESS',
            'RETURNED',
            'CANCELLED',
          ],
          default: 'OPEN',
        },
        statusAfter: {
          type: String,
          enum: [
            'NEW',
            'IN_REVIEW',
            'INVESTIGATING',
            'WAITING_FOR_INFORMATION',
            'ACTION_REQUIRED',
            'RESOLVED',
            'CLOSED',
            'REOPENED',
            'OPEN',
            'IN_PROGRESS',
            'WAITING_FOR_PASSENGER',
            'SUBMITTED',
            'UNDER_REVIEW',
            'RESPONDED',
            'REJECTED',
            'WAITING_FOR_MATCH',
            'POTENTIAL_MATCH',
            'MATCH_CONFIRMED',
            'RETURN_IN_PROGRESS',
            'RETURNED',
            'CANCELLED',
          ],
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
    conversation: [
      {
        senderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        senderRole: {
          type: String,
          enum: ['PASSENGER', 'ADMIN'],
          required: true,
        },
        message: {
          type: String,
          required: true,
          trim: true,
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
    assignedTeam: {
      type: String,
      enum: ['UNASSIGNED', 'ADMIN', 'OPERATION_TEAM', 'SUPPORT_TEAM', 'MAINTENANCE_TEAM'],
      default: 'UNASSIGNED',
      index: true,
    },
    assignedAt: Date,
    adminResponse: {
      type: String,
      trim: true,
      default: '',
    },
    adminResponseBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    adminResponseAt: Date,
    firstResponseAt: Date,
    lastResponseAt: Date,
    resolutionSummary: {
      type: String,
      trim: true,
      default: '',
    },
    waitingForInformationReason: {
      type: String,
      trim: true,
      default: '',
    },
    correctiveActions: [
      {
        actionType: {
          type: String,
          enum: [
            'DRIVER_WARNING',
            'DRIVER_TRAINING',
            'SUPERVISOR_REVIEW',
            'SCHEDULE_ADJUSTMENT',
            'MAINTENANCE_ACTION',
            'NO_VIOLATION_FOUND',
            'OTHER',
          ],
          required: true,
        },
        description: {
          type: String,
          required: true,
          trim: true,
        },
        performedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        performedAt: {
          type: Date,
          default: Date.now,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    slaDueAt: Date,
    resolvedAt: Date,
    closedAt: Date,
    notificationDeliveries: [
      {
        channel: {
          type: String,
          enum: ['IN_APP', 'EMAIL'],
          required: true,
        },
        notificationId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Notification',
        },
        recipient: {
          type: String,
          required: true,
          trim: true,
        },
        status: {
          type: String,
          enum: ['SENT', 'FAILED', 'SKIPPED'],
          required: true,
        },
        sentAt: Date,
        errorMessage: {
          type: String,
          trim: true,
          default: '',
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    auditTrail: [
      {
        actorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        actorRole: {
          type: String,
          enum: ['PASSENGER', 'ADMIN', 'SYSTEM', 'BUS_ASSISTANT'],
          required: true,
        },
        action: {
          type: String,
          required: true,
          trim: true,
        },
        previousStatus: String,
        newStatus: String,
        message: {
          type: String,
          trim: true,
          default: '',
        },
        metadata: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

SupportCaseSchema.index({ createdAt: -1 });
SupportCaseSchema.index({ type: 1, status: 1, createdAt: -1 });
SupportCaseSchema.index({ passenger: 1, type: 1, createdAt: -1 });
SupportCaseSchema.index({ assignedTo: 1, status: 1, createdAt: -1 });
SupportCaseSchema.index({ referenceNumber: 1, passenger: 1 });
SupportCaseSchema.index({ type: 1, replyStatus: 1, createdAt: -1 });

export default mongoose.model('SupportCase', SupportCaseSchema);
