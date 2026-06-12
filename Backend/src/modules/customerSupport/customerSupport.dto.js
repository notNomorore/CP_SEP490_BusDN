const CASE_TYPES = ['COMPLAINT'];
const CASE_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED'];
const COMPLAINT_RESPONSE_STATUSES = ['IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED'];
const CASE_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const LOST_ITEM_RECOVERY_STATUSES = ['REPORTED', 'STORED', 'RETURNED', 'CANCELLED'];

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
  CASE_PRIORITIES,
  LOST_ITEM_RECOVERY_STATUSES,
};
