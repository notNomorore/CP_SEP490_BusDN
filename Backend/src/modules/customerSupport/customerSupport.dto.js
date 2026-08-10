const CASE_TYPES = ['COMPLAINT', 'LOST_ITEM', 'SERVICE_FEEDBACK'];
const COMPLAINT_RESPONSE_STATUSES = ['IN_PROGRESS', 'INVESTIGATING', 'ACTION_REQUIRED', 'RESOLVED', 'CLOSED'];
const CASE_STATUSES = [
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
];
const FEEDBACK_STATUSES = [
  'NEW',
  'IN_REVIEW',
  'INVESTIGATING',
  'WAITING_FOR_INFORMATION',
  'ACTION_REQUIRED',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
  'PENDING',
  'IN_PROGRESS',
  'WAITING_FOR_PASSENGER',
];
const ADMIN_REPLY_MAX_LENGTH = 2000;
const RESOLUTION_SUMMARY_MAX_LENGTH = 1000;
const TITLE_MIN_LENGTH = 5;
const TITLE_MAX_LENGTH = 150;
const DESCRIPTION_MIN_LENGTH = 10;
const DESCRIPTION_MAX_LENGTH = 5000;
const PASSENGER_REPLY_MAX_LENGTH = 2000;
const CASE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'NORMAL', 'URGENT'];
const ENTERPRISE_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];
const ASSIGNED_TEAMS = ['UNASSIGNED', 'ADMIN', 'OPERATION_TEAM', 'SUPPORT_TEAM', 'MAINTENANCE_TEAM'];
const CORRECTIVE_ACTION_TYPES = [
  'DRIVER_WARNING',
  'DRIVER_TRAINING',
  'SUPERVISOR_REVIEW',
  'SCHEDULE_ADJUSTMENT',
  'MAINTENANCE_ACTION',
  'NO_VIOLATION_FOUND',
  'OTHER',
];
const RECOVERY_STATUSES = ['REPORTED', 'SEARCHING', 'POTENTIAL_MATCH', 'MATCH_CONFIRMED', 'RETURN_IN_PROGRESS', 'FOUND', 'RETURNED', 'UNRECOVERED', 'CANCELLED'];
const LOST_ITEM_RECOVERY_STATUSES = ['REPORTED', 'STORED', 'POTENTIAL_MATCH', 'MATCHED', 'RETURN_IN_PROGRESS', 'RETURNED', 'CANCELLED'];
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
      if (body.lostItem?.color !== undefined && String(body.lostItem.color).length > 60) {
        errors.color = 'Color must not exceed 60 characters';
      }
      if (body.lostItem?.brand !== undefined && String(body.lostItem.brand).length > 80) {
        errors.brand = 'Brand must not exceed 80 characters';
      }
      if (body.lostItem?.identifyingDetails !== undefined && String(body.lostItem.identifyingDetails).length > 1000) {
        errors.identifyingDetails = 'Identifying details must not exceed 1000 characters';
      }
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

    if (body.priority && !ENTERPRISE_PRIORITIES.includes(body.priority)) {
      errors.priority = 'Priority must be LOW, NORMAL, HIGH, or CRITICAL';
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

    if (body.waitingForInformationReason !== undefined && !body.waitingForInformationReason?.trim()) {
      errors.waitingForInformationReason = 'Waiting reason cannot be empty';
    }

    if (body.correctiveAction) {
      if (!CORRECTIVE_ACTION_TYPES.includes(body.correctiveAction.actionType || 'OTHER')) {
        errors.correctiveAction = 'Corrective action type is invalid';
      }
      if (!body.correctiveAction.description?.trim()) {
        errors.correctiveActionDescription = 'Corrective action description is required';
      }
    }

    if (body.notification) {
      if (body.notification.confirmSend && !body.notification.message?.trim()) {
        errors.notificationMessage = 'Notification message is required';
      }
      if (
        body.notification.channels
        && body.notification.channels.inApp !== true
        && body.notification.channels.email !== true
      ) {
        errors.notificationChannels = 'Select at least one notification channel or cancel notification sending';
      }
    }

    return Object.keys(errors).length === 0 ? null : errors;
  },
};

export const AssignFeedbackDTO = {
  validate: (body) => {
    const errors = {};
    if (body.assignedTeam && !ASSIGNED_TEAMS.includes(body.assignedTeam)) {
      errors.assignedTeam = 'Assigned team is invalid';
    }
    return Object.keys(errors).length === 0 ? null : errors;
  },
};

export const InternalNoteDTO = {
  validate: (body) => {
    const errors = {};
    if (!body.message?.trim()) errors.message = 'Internal note is required';
    if (body.message?.trim() && body.message.trim().length > 2000) {
      errors.message = 'Internal note must not exceed 2000 characters';
    }
    return Object.keys(errors).length === 0 ? null : errors;
  },
};

export const CorrectiveActionDTO = {
  validate: (body) => {
    const errors = {};
    if (!CORRECTIVE_ACTION_TYPES.includes(body.actionType || 'OTHER')) {
      errors.actionType = 'Corrective action type is invalid';
    }
    if (!body.description?.trim()) {
      errors.description = 'Corrective action description is required';
    }
    if (body.performedAt && Number.isNaN(new Date(body.performedAt).getTime())) {
      errors.performedAt = 'Performed time is invalid';
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
    priorityReason: supportCase.priorityReason,
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
    potentialMatches: supportCase.potentialMatches || [],
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
    assignedTeam: supportCase.assignedTeam || 'UNASSIGNED',
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
    waitingForInformationReason: includeInternal ? supportCase.waitingForInformationReason : undefined,
    correctiveActions: includeInternal
      ? (supportCase.correctiveActions || []).map((action) => ({
        id: action._id,
        actionType: action.actionType,
        description: action.description,
        performedBy: action.performedBy
          ? {
            id: action.performedBy._id || action.performedBy,
            fullName: action.performedBy.fullName,
            email: action.performedBy.email,
            role: action.performedBy.role,
          }
          : null,
        performedAt: action.performedAt,
        createdAt: action.createdAt,
      }))
      : undefined,
    slaDueAt: supportCase.slaDueAt,
    resolvedAt: supportCase.resolvedAt,
    closedAt: supportCase.closedAt,
    notificationDeliveries: includeInternal ? supportCase.notificationDeliveries || [] : undefined,
    notificationResults: includeInternal ? supportCase.notificationResults || [] : undefined,
    activityTimeline: includeInternal
      ? (supportCase.auditTrail || []).map((entry) => ({
        id: entry._id,
        action: entry.action,
        actorRole: entry.actorRole,
        actor: entry.actorId
          ? {
            id: entry.actorId._id || entry.actorId,
            fullName: entry.actorId.fullName,
            email: entry.actorId.email,
            role: entry.actorId.role || entry.actorRole,
          }
          : null,
        previousStatus: entry.previousStatus,
        newStatus: entry.newStatus,
        message: entry.message,
        metadata: entry.metadata || {},
        createdAt: entry.createdAt,
      }))
      : undefined,
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
    if (body.storageLocation !== undefined && String(body.storageLocation).length > 200) {
      errors.storageLocation = 'Storage location must not exceed 200 characters';
    }
    if (body.storageReference !== undefined && String(body.storageReference).length > 120) {
      errors.storageReference = 'Storage reference must not exceed 120 characters';
    }

    return Object.keys(errors).length === 0 ? null : errors;
  },
};

export const MatchReviewDTO = {
  validateConfirm: (body) => {
    const errors = {};
    if (body.adminNote !== undefined && String(body.adminNote).length > 1000) {
      errors.adminNote = 'Admin note must not exceed 1000 characters';
    }
    return Object.keys(errors).length === 0 ? null : errors;
  },

  validateReject: (body) => {
    const errors = {};
    if (!body.rejectionReason?.trim()) errors.rejectionReason = 'Rejection reason is required';
    if (body.rejectionReason?.trim() && body.rejectionReason.trim().length > 200) {
      errors.rejectionReason = 'Rejection reason must not exceed 200 characters';
    }
    if (body.adminNote !== undefined && String(body.adminNote).length > 1000) {
      errors.adminNote = 'Admin note must not exceed 1000 characters';
    }
    return Object.keys(errors).length === 0 ? null : errors;
  },

  validateStartReturn: (body) => {
    const errors = {};
    const methods = ['PICKUP_AT_BUS_STATION', 'HANDOVER_BY_STAFF', 'OTHER'];
    if (body.method && !methods.includes(body.method)) errors.method = 'Return method is invalid';
    if (!body.location?.trim()) errors.location = 'Return location is required';
    if (body.scheduledAt && Number.isNaN(new Date(body.scheduledAt).getTime())) {
      errors.scheduledAt = 'Scheduled return time is invalid';
    }
    if (body.note !== undefined && String(body.note).length > 1000) {
      errors.note = 'Return note must not exceed 1000 characters';
    }
    return Object.keys(errors).length === 0 ? null : errors;
  },

  validateCompleteReturn: (body) => {
    const errors = {};
    if (!body.receiverName?.trim()) errors.receiverName = 'Receiver name is required';
    if (body.returnedAt && Number.isNaN(new Date(body.returnedAt).getTime())) {
      errors.returnedAt = 'Returned time is invalid';
    }
    if (body.handoverNote !== undefined && String(body.handoverNote).length > 1000) {
      errors.handoverNote = 'Handover note must not exceed 1000 characters';
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
    itemCategory: incident.foundItem?.itemCategory || '',
    itemName: incident.foundItem?.itemName || '',
    itemDescription: incident.foundItem?.itemDescription || incident.description,
    color: incident.foundItem?.color || '',
    brand: incident.foundItem?.brand || '',
    identifyingDetails: incident.foundItem?.identifyingDetails || '',
    foundLocation: incident.foundItem?.foundLocation || incident.locationText,
    storageLocation: incident.foundItem?.storageLocation || '',
    storageReference: incident.foundItem?.storageReference || '',
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
      itemCategory: supportCase.lostItem?.itemCategory || '',
      itemName: supportCase.lostItem?.itemName || supportCase.title || '',
      itemDescription: supportCase.lostItem?.itemDescription || supportCase.description,
      color: supportCase.lostItem?.color || '',
      brand: supportCase.lostItem?.brand || '',
      identifyingDetails: supportCase.lostItem?.identifyingDetails || '',
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

const formatUser = (user) => (user
  ? {
    id: user._id || user,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone || user.phoneNumber,
    role: user.role,
  }
  : null);

export const LostFoundMatchResponseDTO = {
  format: (match) => {
    const lost = match.lostItemReport || {};
    const found = match.foundItemReport || {};
    return {
      id: match._id,
      status: match.status,
      matchScore: match.matchScore,
      matchingFactors: match.matchingFactors || {},
      reviewedBy: formatUser(match.reviewedBy),
      reviewedAt: match.reviewedAt,
      rejectionReason: match.rejectionReason || '',
      adminNote: match.adminNote || '',
      returnProcess: match.returnProcess || {},
      lostReport: lost?._id
        ? {
          id: lost._id,
          referenceNumber: lost.referenceNumber,
          status: lost.status,
          recoveryStatus: lost.lostItem?.recoveryStatus || 'REPORTED',
          passenger: formatUser(lost.passenger),
          itemName: lost.lostItem?.itemName || lost.title || '',
          itemCategory: lost.lostItem?.itemCategory || '',
          itemDescription: lost.lostItem?.itemDescription || lost.description || '',
          color: lost.lostItem?.color || '',
          brand: lost.lostItem?.brand || '',
          identifyingDetails: lost.lostItem?.identifyingDetails || '',
          lastSeenLocation: lost.lostItem?.lastSeenLocation || '',
          lostAt: lost.lostItem?.lostAt || lost.incidentAt,
          routeName: lost.routeName || '',
          tripCode: lost.tripCode || lost.tripId || lost.relatedTripId || '',
          busPlate: lost.busPlate || '',
          contactPhone: lost.contactPhone || '',
          contactEmail: lost.contactEmail || '',
          attachments: lost.attachments || [],
          auditTrail: lost.auditTrail || [],
          createdAt: lost.createdAt,
          updatedAt: lost.updatedAt,
        }
        : null,
      foundReport: found?._id
        ? FoundItemCaseResponseDTO.format(found)
        : null,
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
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
