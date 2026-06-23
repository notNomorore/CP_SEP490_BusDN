const CASE_TYPES = ['COMPLAINT', 'LOST_ITEM', 'SERVICE_FEEDBACK'];
const CASE_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'SUBMITTED', 'UNDER_REVIEW', 'RESPONDED', 'REJECTED', 'CLOSED'];
const CASE_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const RECOVERY_STATUSES = ['REPORTED', 'SEARCHING', 'FOUND', 'RETURNED', 'UNRECOVERED'];
const FEEDBACK_CATEGORIES = [
  'SERVICE_QUALITY',
  'DRIVER_BEHAVIOR',
  'BUS_ASSISTANT_SERVICE',
  'ROUTE_EXPERIENCE',
  'MOBILE_APPLICATION',
  'SUGGESTION',
  'COMPLAINT',
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
    } else if (body.type === 'SERVICE_FEEDBACK' && body.description.trim().length < 20) {
      errors.description = 'Feedback description must contain at least 20 characters';
    }

    if (body.priority && !CASE_PRIORITIES.includes(body.priority)) {
      errors.priority = 'Priority is invalid';
    }

    if (body.type === 'SERVICE_FEEDBACK' && !FEEDBACK_CATEGORIES.includes(body.category)) {
      errors.category = 'Feedback category is invalid';
    }

    if (
      body.ratingScore !== undefined
      && body.ratingScore !== ''
      && (Number(body.ratingScore) < 1 || Number(body.ratingScore) > 5)
    ) {
      errors.ratingScore = 'Rating score must be between 1 and 5';
    }

    if (body.type === 'LOST_ITEM') {
      if (!body.lostItem?.itemName?.trim()) {
        errors.itemName = 'Lost item name is required';
      }

      if (!LOST_ITEM_CATEGORIES.includes(body.lostItem?.itemCategory || '')) {
        errors.itemCategory = 'Lost item category is invalid';
      }

      if (!body.lostItem?.itemDescription?.trim() || body.lostItem.itemDescription.trim().length < 10) {
        errors.itemDescription = 'Lost item description must contain at least 10 characters';
      }

      if (!body.lostItem?.lastSeenLocation?.trim()) {
        errors.lastSeenLocation = 'Estimated lost location is required';
      }

      if (!body.lostItem?.lostAt) {
        errors.lostAt = 'Estimated lost date and time is required';
      } else if (Number.isNaN(new Date(body.lostItem.lostAt).getTime())) {
        errors.lostAt = 'Estimated lost date and time is invalid';
      }

      if (!body.contactPhone?.trim() && !body.contactEmail?.trim()) {
        errors.contact = 'Contact phone or contact email is required';
      }
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

    if (body.status && !CASE_STATUSES.includes(body.status)) {
      errors.status = 'Status is invalid';
    }

    return Object.keys(errors).length === 0 ? null : errors;
  },
};

export const UpdateLostItemCaseDTO = {
  validate: (body) => {
    const errors = {};

    if (body.status && !CASE_STATUSES.includes(body.status)) {
      errors.status = 'Status is invalid';
    }

    if (body.recoveryStatus && !RECOVERY_STATUSES.includes(body.recoveryStatus)) {
      errors.recoveryStatus = 'Recovery status is invalid';
    }

    if (body.note !== undefined && !body.note?.trim()) {
      errors.note = 'Case note cannot be empty';
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
    priority: supportCase.priority,
    status: supportCase.status,
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
    assignedTo: supportCase.assignedTo,
    resolvedAt: supportCase.resolvedAt,
    closedAt: supportCase.closedAt,
    createdAt: supportCase.createdAt,
    updatedAt: supportCase.updatedAt,
  }),
};

export {
  CASE_TYPES,
  CASE_STATUSES,
  CASE_PRIORITIES,
  FEEDBACK_CATEGORIES,
  LOST_ITEM_CATEGORIES,
  RECOVERY_STATUSES,
};
