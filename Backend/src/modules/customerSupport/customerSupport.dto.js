const CASE_TYPES = ['COMPLAINT', 'LOST_ITEM', 'SERVICE_FEEDBACK'];
const COMPLAINT_RESPONSE_STATUSES = ['IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED'];
const CASE_STATUSES = [
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
];
const FEEDBACK_STATUSES = ['PENDING', 'IN_PROGRESS', 'WAITING_FOR_PASSENGER', 'RESOLVED', 'REJECTED', 'CLOSED'];
const ADMIN_REPLY_MAX_LENGTH = 2000;
const RESOLUTION_SUMMARY_MAX_LENGTH = 1000;
const TITLE_MIN_LENGTH = 5;
const TITLE_MAX_LENGTH = 150;
const DESCRIPTION_MIN_LENGTH = 10;
const DESCRIPTION_MAX_LENGTH = 5000;
const PASSENGER_REPLY_MAX_LENGTH = 2000;
const CASE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'NORMAL', 'URGENT'];
const RECOVERY_STATUSES = ['REPORTED', 'SEARCHING', 'FOUND', 'RETURNED', 'UNRECOVERED'];
const LOST_ITEM_RECOVERY_STATUSES = ['REPORTED', 'STORED', 'RETURNED', 'CANCELLED'];
const FEEDBACK_CATEGORIES = [
  'SERVICE_QUALITY',
  'DRIVER_BEHAVIOR',
  'BUS_ASSISTANT_BEHAVIOR',
  'BUS_CLEANLINESS',
  'ROUTE_DELAY',
  'SAFETY',
  'APP_ISSUE',
  'PAYMENT_ISSUE',
  'OTHER',
];
const LOST_ITEM_CATEGORIES = [
  'PERSONAL_BELONGINGS',
  'ELECTRONICS',
  'WALLET_DOCUMENTS',
  'CLOTHING',
  'BAGS_LUGGAGE',
  'OTHER_ITEMS',
];

export const CreateSupportCaseDTO = {
  validate: (body) => {
    const errors = {};

    if (!CASE_TYPES.includes(body.type)) {
      errors.type = 'Support case type is invalid';
    }

    if (!body.title?.trim()) {
      errors.title = 'Title is required';
    }

    if (body.title?.trim() && body.title.trim().length < TITLE_MIN_LENGTH) {
      errors.title = `Title must be at least ${TITLE_MIN_LENGTH} characters`;
    }

    if (body.title?.trim() && body.title.trim().length > TITLE_MAX_LENGTH) {
      errors.title = `Title must not exceed ${TITLE_MAX_LENGTH} characters`;
    }

    if (!body.description?.trim()) {
      errors.description = 'Description is required';
    }

    if (body.description?.trim() && body.description.trim().length < DESCRIPTION_MIN_LENGTH) {
      errors.description = `Description must be at least ${DESCRIPTION_MIN_LENGTH} characters`;
    }

    if (body.description?.trim() && body.description.trim().length > DESCRIPTION_MAX_LENGTH) {
      errors.description = `Description must not exceed ${DESCRIPTION_MAX_LENGTH} characters`;
    }

    if (body.priority && !CASE_PRIORITIES.includes(body.priority)) {
      errors.priority = 'Priority is invalid';
    }

    if (body.type === 'SERVICE_FEEDBACK' && !FEEDBACK_CATEGORIES.includes(body.category)) {
      errors.category = 'Feedback category is invalid';
    }

    if (body.type === 'SERVICE_FEEDBACK' && !body.relatedTripId?.trim()) {
      errors.relatedTripId = 'Related trip or route is required for service feedback';
    }

    if (body.type === 'SERVICE_FEEDBACK' && (body.ratingScore === undefined || body.ratingScore === '')) {
      errors.ratingScore = 'Rating score is required';
    } else if (
      body.ratingScore !== undefined
      && body.ratingScore !== ''
      && (Number(body.ratingScore) < 1 || Number(body.ratingScore) > 5)
    ) {
      errors.ratingScore = 'Rating score must be between 1 and 5';
    }

    if (body.type === 'LOST_ITEM') {
      if (!body.lostItem?.itemName?.trim()) errors.itemName = 'Lost item name is required';
      if (!LOST_ITEM_CATEGORIES.includes(body.lostItem?.itemCategory)) {
        errors.itemCategory = 'Lost item category is invalid';
      }
      if (!body.lostItem?.itemDescription?.trim() || body.lostItem.itemDescription.trim().length < 10) {
        errors.itemDescription = 'Lost item description must contain at least 10 characters';
      }
      if (!body.lostItem?.lastSeenLocation?.trim()) errors.lastSeenLocation = 'Estimated lost location is required';
      if (!body.lostItem?.lostAt || Number.isNaN(new Date(body.lostItem.lostAt).getTime())) {
        errors.lostAt = 'Estimated lost date and time is invalid';
      } else if (new Date(body.lostItem.lostAt).getTime() > Date.now()) {
        errors.lostAt = 'Estimated lost date and time cannot be later than the report submission time';
      }
      if (!body.contactPhone?.trim() && !body.contactEmail?.trim()) {
        errors.contact = 'Contact phone or contact email is required';
      }
    }

    return Object.keys(errors).length === 0 ? null : errors;
  },
};

export const FeedbackAdminActionDTO = {
  validate: (body) => {
    const errors = {};

    if (body.status && !FEEDBACK_STATUSES.includes(body.status)) {
      errors.status = 'Feedback status is invalid';
    }

    if (body.message !== undefined && !body.message?.trim()) {
      errors.message = 'Message cannot be empty';
    }

    if (body.message?.trim() && body.message.trim().length > ADMIN_REPLY_MAX_LENGTH) {
      errors.message = `Message must not exceed ${ADMIN_REPLY_MAX_LENGTH} characters`;
    }

    if (body.resolutionSummary !== undefined && !body.resolutionSummary?.trim()) {
      errors.resolutionSummary = 'Resolution summary cannot be empty';
    }

    if (body.resolutionSummary?.trim() && body.resolutionSummary.trim().length > RESOLUTION_SUMMARY_MAX_LENGTH) {
      errors.resolutionSummary = `Resolution summary must not exceed ${RESOLUTION_SUMMARY_MAX_LENGTH} characters`;
    }

    return Object.keys(errors).length === 0 ? null : errors;
  },
};

export const PassengerFeedbackReplyDTO = {
  validate: (body) => {
    const errors = {};

    if (!body.message?.trim()) {
      errors.message = 'Reply message is required';
    }

    if (body.message?.trim() && body.message.trim().length > PASSENGER_REPLY_MAX_LENGTH) {
      errors.message = `Reply message must not exceed ${PASSENGER_REPLY_MAX_LENGTH} characters`;
    }

    return Object.keys(errors).length === 0 ? null : errors;
  },
};

export const RespondSupportCaseDTO = {
  validate: (body) => {
    const errors = {};

    if (!body.message?.trim()) {
      errors.message = 'Response message is required';
    }

    if (body.message?.trim() && body.message.trim().length < 10) {
      errors.message = 'Response message must be at least 10 characters';
    }

    if (body.status && !COMPLAINT_RESPONSE_STATUSES.includes(body.status)) {
      errors.status = 'Status is invalid';
    }

    return Object.keys(errors).length === 0 ? null : errors;
  },
};

export const SupportCaseResponseDTO = {
  format: (supportCase, { includeInternal = false } = {}) => ({
    id: supportCase._id,
    referenceNumber: supportCase.referenceNumber,
    type: supportCase.type,
    passenger: supportCase.passenger
      ? {
        id: supportCase.passenger._id || supportCase.passenger,
        fullName: supportCase.passenger.fullName,
        email: supportCase.passenger.email,
        phone: supportCase.passenger.phone,
      }
      : null,
    title: supportCase.title,
    description: supportCase.description,
    category: supportCase.category,
    ratingScore: supportCase.ratingScore,
    rating: supportCase.ratingScore,
    priority: supportCase.priority,
    status: supportCase.status,
    replyStatus: supportCase.replyStatus || 'UNREPLIED',
    routeId: supportCase.routeId,
    tripId: supportCase.tripId,
    ticketId: supportCase.ticketId,
    relatedTripId: supportCase.relatedTripId,
    routeName: supportCase.routeName,
    tripCode: supportCase.tripCode,
    busPlate: supportCase.busPlate,
    incidentAt: supportCase.incidentAt,
    contactPhone: supportCase.contactPhone,
    contactEmail: supportCase.contactEmail,
    attachments: supportCase.attachments || [],
    lostItem: supportCase.lostItem,
    responses: includeInternal
      ? supportCase.responses || []
      : (supportCase.responses || []).filter((response) => response.visibleToPassenger !== false),
    conversation: (supportCase.conversation || []).map((message) => ({
      id: message._id,
      senderId: message.senderId?._id || message.senderId,
      senderRole: message.senderRole,
      sender: message.senderId
        ? {
          id: message.senderId._id || message.senderId,
          fullName: message.senderId.fullName,
          email: message.senderId.email,
          role: message.senderId.role || message.senderRole,
        }
        : null,
      message: message.message,
      createdAt: message.createdAt,
    })),
    assignedTo: supportCase.assignedTo,
    assignedAt: supportCase.assignedAt,
    adminResponse: supportCase.adminResponse,
    adminResponseBy: supportCase.adminResponseBy
      ? {
        id: supportCase.adminResponseBy._id || supportCase.adminResponseBy,
        fullName: supportCase.adminResponseBy.fullName,
        email: supportCase.adminResponseBy.email,
        role: supportCase.adminResponseBy.role || 'ADMIN',
      }
      : null,
    adminResponseAt: supportCase.adminResponseAt,
    firstResponseAt: supportCase.firstResponseAt,
    lastResponseAt: supportCase.lastResponseAt,
    resolutionSummary: supportCase.resolutionSummary,
    resolvedAt: supportCase.resolvedAt,
    closedAt: supportCase.closedAt,
    publicTimeline: (supportCase.auditTrail || [])
      .filter((entry) => includeInternal || !['INTERNAL_NOTE', 'REASSIGN', 'CHANGE_PRIORITY'].includes(entry.action))
      .map((entry) => ({
        action: entry.action,
        actorRole: entry.actorRole,
        previousStatus: entry.previousStatus,
        newStatus: entry.newStatus,
        message: entry.message,
        createdAt: entry.createdAt,
      })),
    createdAt: supportCase.createdAt,
    updatedAt: supportCase.updatedAt,
  }),
};

export const UpdateLostItemCaseDTO = {
  validate: (body) => {
    const errors = {};
    if (body.status && !CASE_STATUSES.includes(body.status)) errors.status = 'Status is invalid';
    if (body.recoveryStatus && !RECOVERY_STATUSES.includes(body.recoveryStatus)) {
      errors.recoveryStatus = 'Recovery status is invalid';
    }
    if (body.note !== undefined && !body.note?.trim()) errors.note = 'Case note cannot be empty';
    return Object.keys(errors).length === 0 ? null : errors;
  },
};

export const UpdatePassengerLostItemCaseDTO = UpdateLostItemCaseDTO;

export const UpdateFoundItemCaseDTO = {
  validate: (body) => {
    const errors = {};

    if (body.recoveryStatus && !LOST_ITEM_RECOVERY_STATUSES.includes(body.recoveryStatus)) {
      errors.recoveryStatus = 'Lost item recovery status is invalid';
    }

    if (body.adminNote !== undefined && !body.adminNote?.trim()) {
      errors.adminNote = 'Admin note cannot be empty';
    }

    return Object.keys(errors).length === 0 ? null : errors;
  },
};

export const FoundItemCaseResponseDTO = {
  format: (incident) => ({
    sourceType: 'FOUND_ITEM',
    id: incident._id,
    incidentCode: incident.incidentCode,
    status: incident.status,
    severity: incident.severity,
    recoveryStatus: incident.foundItem?.recoveryStatus || 'REPORTED',
    itemName: incident.foundItem?.itemName || '',
    itemDescription: incident.foundItem?.itemDescription || incident.description,
    foundLocation: incident.foundItem?.foundLocation || incident.locationText,
    handedTo: incident.foundItem?.handedTo || '',
    adminNote: incident.adminNote || '',
    reporterRole: incident.reporterRole,
    reporter: incident.driver
      ? {
        id: incident.driver._id || incident.driver,
        fullName: incident.driver.fullName,
        email: incident.driver.email,
        phone: incident.driver.phone || incident.driver.phoneNumber,
        role: incident.driver.role,
      }
      : null,
    route: incident.route
      ? {
        id: incident.route._id || incident.route,
        routeNumber: incident.route.routeNumber,
        name: incident.route.routeName || incident.route.name,
      }
      : null,
    vehicle: incident.vehicle
      ? {
        id: incident.vehicle._id || incident.vehicle,
        busCode: incident.vehicle.busCode,
        plateNumber: incident.vehicle.plateNumber,
      }
      : null,
    trip: incident.trip
      ? {
        id: incident.trip._id || incident.trip,
        scheduleCode: incident.trip.scheduleCode,
        routeName: incident.trip.routeName,
        serviceDate: incident.trip.serviceDate,
        departureTime: incident.trip.departureTime,
      }
      : null,
    evidenceFiles: incident.evidenceFiles || [],
    reportedAt: incident.reportedAt,
    acknowledgedAt: incident.acknowledgedAt,
    resolvedAt: incident.resolvedAt,
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
  }),
};

const mapPassengerLostItemStatus = (supportCase) => {
  if (supportCase.status === 'RESOLVED' || supportCase.lostItem?.recoveryStatus === 'RETURNED') return 'RESOLVED';
  if (supportCase.status === 'CLOSED' || supportCase.status === 'REJECTED') return 'CANCELLED';
  if (['UNDER_REVIEW', 'IN_PROGRESS', 'RESPONDED', 'WAITING_FOR_PASSENGER'].includes(supportCase.status)) {
    return 'ACKNOWLEDGED';
  }
  return 'OPEN';
};

export const PassengerLostItemCaseResponseDTO = {
  format: (supportCase) => {
    const latestVisibleResponse = [...(supportCase.responses || [])]
      .reverse()
      .find((response) => response.visibleToPassenger !== false);

    return {
      sourceType: 'PASSENGER_LOST_ITEM',
      id: supportCase._id,
      incidentCode: supportCase.referenceNumber,
      referenceNumber: supportCase.referenceNumber,
      status: mapPassengerLostItemStatus(supportCase),
      caseStatus: supportCase.status,
      severity: supportCase.priority || 'NORMAL',
      recoveryStatus: supportCase.lostItem?.recoveryStatus || 'REPORTED',
      itemName: supportCase.lostItem?.itemName || supportCase.title || '',
      itemDescription: supportCase.lostItem?.itemDescription || supportCase.description,
      foundLocation: supportCase.lostItem?.lastSeenLocation || '',
      lastSeenLocation: supportCase.lostItem?.lastSeenLocation || '',
      handedTo: '',
      adminNote: latestVisibleResponse?.message || '',
      reporterRole: 'PASSENGER',
      reporter: supportCase.passenger
        ? {
          id: supportCase.passenger._id || supportCase.passenger,
          fullName: supportCase.passenger.fullName,
          email: supportCase.passenger.email,
          phone: supportCase.passenger.phone || supportCase.passenger.phoneNumber,
          role: supportCase.passenger.role || 'PASSENGER',
        }
        : null,
      route: supportCase.routeName
        ? {
          id: supportCase.routeId,
          routeNumber: supportCase.routeName,
          name: supportCase.routeName,
        }
        : null,
      vehicle: supportCase.busPlate
        ? {
          plateNumber: supportCase.busPlate,
        }
        : null,
      trip: supportCase.tripCode || supportCase.relatedTripId
        ? {
          id: supportCase.relatedTripId || supportCase.tripId,
          scheduleCode: supportCase.tripCode || supportCase.relatedTripId,
          routeName: supportCase.routeName,
        }
        : null,
      evidenceFiles: (supportCase.attachments || []).map((file) => ({
        originalName: file.originalName,
        filename: file.fileName,
        url: file.url || file.path,
        mimeType: file.mimeType,
        size: file.size,
        uploadedAt: file.uploadedAt,
      })),
      reportedAt: supportCase.createdAt,
      acknowledgedAt: ['UNDER_REVIEW', 'IN_PROGRESS', 'RESPONDED', 'WAITING_FOR_PASSENGER'].includes(supportCase.status)
        ? supportCase.updatedAt
        : null,
      resolvedAt: supportCase.resolvedAt,
      createdAt: supportCase.createdAt,
      updatedAt: supportCase.updatedAt,
    };
  },
};

export {
  CASE_TYPES,
  CASE_STATUSES,
  FEEDBACK_STATUSES,
  CASE_PRIORITIES,
  FEEDBACK_CATEGORIES,
  LOST_ITEM_CATEGORIES,
  RECOVERY_STATUSES,
  LOST_ITEM_RECOVERY_STATUSES,
};
