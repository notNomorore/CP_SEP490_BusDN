const CASE_TYPES = ['COMPLAINT'];
const CASE_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED'];
const COMPLAINT_RESPONSE_STATUSES = ['IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED'];
const CASE_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

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
};
