const formatStaff = (staff) => (
  staff
    ? {
      id: staff._id || staff.userId || staff,
      fullName: staff.fullName || '',
      role: staff.role || '',
      phoneNumber: staff.phoneNumber || staff.phone || '',
    }
    : null
);

const normalizeGeoPoint = (point = {}) => ({
  id: point.stationId || point._id || null,
  stationId: point.stationId || point._id || null,
  stopName: point.stopName || '',
  address: point.address || '',
  latitude: Number(point.latitude),
  longitude: Number(point.longitude),
  stopOrder: point.stopOrder || null,
  arrivalOffsetMinutes: point.arrivalOffsetMinutes || 0,
  departureOffsetMinutes: point.departureOffsetMinutes || 0,
  isMainStation: Boolean(point.isMainStation),
});

const hasRouteGeometry = (route) => Boolean(route?.outboundRoute || route?.inboundRoute);

const getDirectionDetail = (trip, route) => {
  if (!hasRouteGeometry(route)) return null;
  return trip?.direction === 'INBOUND'
    ? route.inboundRoute
    : route.outboundRoute;
};

const getFirstItem = (items = []) => (items.length ? items[0] : null);
const getLastItem = (items = []) => (items.length ? items[items.length - 1] : null);

const formatRoute = (trip) => {
  const routeDocument = hasRouteGeometry(trip?.routeId) ? trip.routeId : null;
  const directionDetail = getDirectionDetail(trip, routeDocument);
  const stops = (directionDetail?.orderedStops || []).map(normalizeGeoPoint);
  const polylinePath = (directionDetail?.polylinePath || []).map(normalizeGeoPoint);
  const pathPoints = polylinePath.length ? polylinePath : stops;
  const startStop = directionDetail?.startStation || getFirstItem(stops);
  const endStop = directionDetail?.endStation || getLastItem(stops);

  return {
    id: routeDocument?._id || trip?.routeId || null,
    routeNumber: trip?.routeCode || routeDocument?.routeCode || '',
    name: trip?.routeName || routeDocument?.routeName || '',
    origin: startStop?.stopName || (trip?.direction === 'INBOUND' ? 'Chieu ve' : 'Chieu di'),
    destination: endStop?.stopName || trip?.routeName || '',
    direction: trip?.direction || 'OUTBOUND',
    estimatedDistanceKm: directionDetail?.estimatedDistanceKm || 0,
    estimatedDurationMinutes: directionDetail?.estimatedDurationMinutes || 0,
    fareConfig: routeDocument?.fareConfig || {},
    fare: routeDocument?.fare || routeDocument?.baseFare || 0,
    stops,
    pathPoints,
  };
};

const formatVehicle = (vehicle = {}) => ({
  id: vehicle.busId || null,
  code: vehicle.busCode || '',
  plateNumber: vehicle.plateNumber || '',
  model: vehicle.busType || '',
  capacity: vehicle.capacity || 0,
});

const formatVehicleReplacement = (trip = {}) => {
  const history = Array.isArray(trip.emergencyHistory) ? trip.emergencyHistory : [];
  const latest = history.length ? history[history.length - 1] : null;

  if (!latest?.previousVehicle?.busId) return null;

  return {
    reason: latest.reason || '',
    changedAt: latest.changedAt || null,
    previousVehicle: formatVehicle(latest.previousVehicle),
    currentVehicle: formatVehicle(trip.vehicle),
  };
};

const addMinutes = (value, minutes) => {
  if (!value) return null;
  const date = new Date(value);
  date.setMinutes(date.getMinutes() + minutes);
  return date;
};

const VIETNAM_UTC_OFFSET_HOURS = 7;
const operatingDateToken = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const buildDateTime = (serviceDate, timeValue) => {
  if (!serviceDate || !/^\d{2}:\d{2}$/.test(String(timeValue || ''))) {
    return null;
  }
  const [hours, minutes] = String(timeValue).split(':').map(Number);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(operatingDateToken(serviceDate));
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    hours - VIETNAM_UTC_OFFSET_HOURS,
    minutes,
    0,
    0
  ));
};

const buildScheduleEndTime = (serviceDate, departureTime, expectedArrivalTime) => {
  const explicitEnd = buildDateTime(serviceDate, expectedArrivalTime);
  if (explicitEnd) return explicitEnd;

  const fallbackStart = buildDateTime(serviceDate, departureTime);
  if (!fallbackStart) return null;

  const fallbackEnd = new Date(fallbackStart);
  fallbackEnd.setMinutes(fallbackEnd.getMinutes() + 60);
  return fallbackEnd;
};

const formatInspection = (inspection) => {
  if (!inspection) {
    return {
      status: 'NOT_STARTED',
      checklist: {},
      issueCategory: null,
      issueDescription: '',
      startedAt: null,
      confirmedAt: null,
      reportedAt: null,
    };
  }

  return {
    id: inspection._id,
    inspectionCode: inspection.inspectionCode,
    status: inspection.status,
    checklist: inspection.checklist || {},
    issueCategory: inspection.issueCategory || null,
    issueDescription: inspection.issueDescription || '',
    startedAt: inspection.startedAt,
    confirmedAt: inspection.confirmedAt,
    reportedAt: inspection.reportedAt,
  };
};

const formatTripStatus = (tripStatus, shiftStatus, inspectionStatus) => {
  if (tripStatus === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (tripStatus === 'COMPLETED') return 'COMPLETED';
  if (tripStatus === 'CANCELLED') return 'CANCELLED';
  if (inspectionStatus === 'READY') return 'READY';
  if (shiftStatus === 'CONFIRMED' && !['IN_PROGRESS', 'ISSUE_REPORTED'].includes(inspectionStatus)) return 'READY';
  return 'SCHEDULED';
};

export const OperationIncidentResponseDTO = {
  format: (incident) => ({
    id: incident._id,
    incidentCode: incident.incidentCode,
    type: incident.type,
    severity: incident.severity,
    status: incident.status,
    trip: incident.trip,
    assignment: incident.assignment,
    route: incident.route,
    vehicle: incident.vehicle,
    driver: formatStaff(incident.driver),
    locationText: incident.locationText,
    latitude: incident.latitude,
    longitude: incident.longitude,
    estimatedDelayMinutes: incident.estimatedDelayMinutes,
    trafficCategory: incident.trafficCategory,
    affectedDirection: incident.affectedDirection,
    description: incident.description,
    injuriesReported: incident.injuriesReported,
    policeNotified: incident.policeNotified,
    canContinue: incident.canContinue,
    requiresReplacementVehicle: incident.requiresReplacementVehicle,
    passengerViolation: incident.passengerViolation || null,
    passengerConflict: incident.passengerConflict || null,
    foundItem: incident.foundItem || null,
    evidenceFiles: incident.evidenceFiles || [],
    reportedAt: incident.reportedAt,
    acknowledgedAt: incident.acknowledgedAt,
    resolvedAt: incident.resolvedAt,
    adminNote: incident.adminNote,
  }),
};

export const OperationNotificationResponseDTO = {
  format: (notification, actorId) => ({
    id: notification._id,
    title: notification.title,
    message: notification.message,
    category: notification.category,
    priority: notification.priority,
    targetRoles: notification.targetRoles || [],
    route: notification.route || null,
    trip: notification.trip || null,
    vehicle: notification.vehicle || null,
    activeFrom: notification.activeFrom,
    expiresAt: notification.expiresAt,
    sourceType: notification.sourceType || '',
    sourceId: notification.sourceId || null,
    metadata: notification.metadata || {},
    isRead: (notification.readBy || []).some((item) => (
      String(item.user || item) === String(actorId)
    )),
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  }),
};

export const ShiftAssignmentResponseDTO = {
  format: (assignment, actorId, actorRole) => {
    const trip = assignment.trip || {};
    const originalScheduledStart = buildDateTime(trip.serviceDate, trip.departureTime);
    const originalScheduledEnd = buildScheduleEndTime(
      trip.serviceDate,
      trip.departureTime,
      trip.expectedArrivalTime
    );
    const scheduledStart = trip.adjustedStartAt || originalScheduledStart;
    const scheduledEnd = trip.adjustedEndAt || originalScheduledEnd;
    const inspection = formatInspection(assignment.inspectionRecord);
    const resolvedActorRole = actorRole || (
      String(assignment.driver?._id || assignment.driver) === String(actorId)
        ? 'DRIVER'
        : 'BUS_ASSISTANT'
    );

    return ({
    id: assignment._id,
    tripId: trip._id || assignment.trip || null,
    shiftCode: assignment.shiftCode,
    tripCode: trip.scheduleCode || assignment.tripCode,
    actorRole: resolvedActorRole,
    route: formatRoute(trip),
    vehicle: formatVehicle(trip.vehicle),
    vehicleReplacement: formatVehicleReplacement(trip),
    driver: formatStaff(assignment.driver),
    busAssistant: formatStaff(assignment.busAssistant),
    scheduledStart,
    scheduledEnd,
    originalScheduledStart,
    originalScheduledEnd,
    incidentDelayMinutes: Number(trip.incidentDelayMinutes) || 0,
    propagatedDelayMinutes: Number(trip.propagatedDelayMinutes) || 0,
    delayReason: trip.delayReason || '',
    actualStartAt: trip.actualStartAt,
    actualEndAt: trip.actualEndAt,
    startLocation: trip.startLocation || null,
    gpsSync: trip.gpsSync || { status: 'NOT_REQUESTED', retryCount: 0, message: '' },
    dutyStart: addMinutes(scheduledStart, -30),
    checkInDeadline: addMinutes(scheduledStart, -15),
    dutyEnd: addMinutes(scheduledEnd, 15),
    capacity: assignment.capacity || null,
    reportLocation: trip.routeName || '',
    dutyInstructions: resolvedActorRole === 'DRIVER'
      ? [
        'Co mat tai diem tap ket truoc gio khoi hanh.',
        'Kiem tra tinh trang phuong tien truoc chuyen.',
        'Chi khoi hanh khi xe da duoc xac nhan san sang.',
      ]
      : [
        'Co mat tai diem tap ket truoc gio khoi hanh.',
        'Ho tro hanh khach len xe va kiem tra thong tin chuyen.',
        'Phoi hop voi tai xe trong suot ca lam viec.',
      ],
    shiftStatus: assignment.shiftStatus,
    acceptanceStatus: assignment.acceptanceStatus || 'PENDING',
    rejectionReason: assignment.rejectionReason || '',
    acceptedAt: assignment.acceptedAt || null,
    tripStatus: formatTripStatus(trip.status, assignment.shiftStatus, inspection.status),
    inspection,
    notes: assignment.notes,
    });
  },
};

const formatWorkDateOnly = (value) => {
  if (!value) return null;

  const text = typeof value === 'string' ? value.trim() : '';
  const match = /^(\d{4}-\d{2}-\d{2})$/.exec(text);
  if (match) return match[1];

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export const StaffShiftScheduleResponseDTO = {
  format: (assignment) => {
    const shift = assignment.shift || assignment.shiftId || {};
    const route = shift.routeId || {};

    return {
      id: assignment._id,
      ...(assignment.source ? { source: assignment.source } : {}),
      assignmentStatus: assignment.status || 'ASSIGNED',
      workDate: formatWorkDateOnly(assignment.workDate || shift.workDate),
      shiftCode: shift.shiftCode || '',
      shiftName: shift.shiftName || 'Ca làm việc',
      shiftType: shift.shiftType || 'CUSTOM',
      startTime: shift.startTime || '',
      endTime: shift.endTime || '',
      description: shift.description || '',
      route: route && route._id
        ? {
          id: route._id,
          routeCode: route.routeCode || '',
          routeName: route.routeName || '',
        }
        : null,
    };
  },
};

export const VehicleInspectionResponseDTO = {
  format: formatInspection,
};

export default ShiftAssignmentResponseDTO;
