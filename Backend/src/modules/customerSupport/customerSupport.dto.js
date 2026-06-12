const CASE_TYPES = ['COMPLAINT', 'LOST_ITEM'];
const CASE_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED'];
const CASE_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const RECOVERY_STATUSES = ['REPORTED', 'SEARCHING', 'FOUND', 'RETURNED', 'UNRECOVERED'];

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

    if (body.type === 'LOST_ITEM' && !body.lostItem?.itemName?.trim()) {
      errors.itemName = 'Lost item name is required';
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
    priority: supportCase.priority,
    status: supportCase.status,
    routeName: supportCase.routeName,
    tripCode: supportCase.tripCode,
    busPlate: supportCase.busPlate,
    incidentAt: supportCase.incidentAt,
    contactPhone: supportCase.contactPhone,
    contactEmail: supportCase.contactEmail,
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
  RECOVERY_STATUSES,
};
