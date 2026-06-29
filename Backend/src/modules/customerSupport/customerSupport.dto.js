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

    if (!body.description?.trim()) {
      errors.description = 'Description is required';
    }

    if (body.priority && !CASE_PRIORITIES.includes(body.priority)) {
      errors.priority = 'Priority is invalid';
    }

    if (body.type === 'SERVICE_FEEDBACK' && !FEEDBACK_CATEGORIES.includes(body.category)) {
      errors.category = 'Feedback category is invalid';
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

    if (body.resolutionSummary !== undefined && !body.resolutionSummary?.trim()) {
      errors.resolutionSummary = 'Resolution summary cannot be empty';
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
  format: (supportCase) => ({
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
    responses: supportCase.responses || [],
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
    resolutionSummary: supportCase.resolutionSummary,
    resolvedAt: supportCase.resolvedAt,
    closedAt: supportCase.closedAt,
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
