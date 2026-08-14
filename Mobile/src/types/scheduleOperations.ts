export type StaffRole = 'DRIVER' | 'BUS_ASSISTANT' | string;

export type StaffMember = {
  id?: string;
  fullName?: string;
  role?: string;
  phoneNumber?: string;
} | null;

export type RoutePoint = {
  id?: string | null;
  stationId?: string | null;
  _id?: string | null;
  stopName?: string;
  address?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  stopOrder?: number | null;
  arrivalOffsetMinutes?: number;
  departureOffsetMinutes?: number;
  isMainStation?: boolean;
};

export type TripStartLocation = {
  latitude?: number | string | null;
  longitude?: number | string | null;
  accuracyMeters?: number | null;
  capturedAt?: string | null;
};

export type VehicleInspection = {
  id?: string;
  inspectionCode?: string;
  status?: string;
  checklist?: Record<string, unknown>;
  issueCategory?: string | null;
  issueDescription?: string;
  startedAt?: string | null;
  confirmedAt?: string | null;
  reportedAt?: string | null;
};

export type AssignedTrip = {
  id: string;
  tripId?: string | null;
  shiftCode?: string;
  tripCode?: string;
  actorRole?: StaffRole;
  route?: {
    _id?: string | null;
    id?: string | null;
    routeNumber?: string;
    name?: string;
    origin?: string;
    destination?: string;
    direction?: string;
    estimatedDistanceKm?: number;
    estimatedDurationMinutes?: number;
    fare?: number;
    fareConfig?: {
      baseFare?: number;
      studentFare?: number;
      childFare?: number;
      seniorFare?: number;
    };
    pathPoints?: RoutePoint[];
    stops?: Array<{
      id?: string | null;
      stationId?: string | null;
      stopName?: string;
      address?: string;
      latitude?: number | string | null;
      longitude?: number | string | null;
      stopOrder?: number | null;
    }>;
  };
  vehicle?: {
    id?: string | null;
    code?: string;
    plateNumber?: string;
    model?: string;
    capacity?: number;
  };
  vehicleReplacement?: {
    reason?: string;
    changedAt?: string | null;
    previousVehicle?: {
      id?: string | null;
      code?: string;
      plateNumber?: string;
      model?: string;
      capacity?: number;
    };
    currentVehicle?: {
      id?: string | null;
      code?: string;
      plateNumber?: string;
      model?: string;
      capacity?: number;
    };
  } | null;
  driver?: StaffMember;
  busAssistant?: StaffMember;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  originalScheduledStart?: string | null;
  originalScheduledEnd?: string | null;
  incidentDelayMinutes?: number;
  propagatedDelayMinutes?: number;
  delayReason?: string;
  actualStartAt?: string | null;
  actualEndAt?: string | null;
  startLocation?: TripStartLocation | null;
  gpsSync?: {
    status?: string;
    retryCount?: number;
    message?: string;
    syncedAt?: string | null;
    lastAttemptAt?: string | null;
  };
  dutyStart?: string | null;
  checkInDeadline?: string | null;
  dutyEnd?: string | null;
  reportLocation?: string;
  shiftStatus?: string;
  acceptanceStatus?: string;
  tripStatus?: string;
  capacity?: { capacity: number; soldSeats: number; remainingSeats: number; isFull: boolean } | null;
  inspection?: VehicleInspection;
  dutyInstructions?: string[];
  rejectionReason?: string;
  acceptedAt?: string | null;
  notes?: string;
};

export type ShiftSchedule = {
  id: string;
  source?: string;
  assignmentStatus?: string;
  workDate?: string;
  shiftCode?: string;
  shiftName?: string;
  shiftType?: string;
  startTime?: string;
  endTime?: string;
  incidentDelayMinutes?: number;
  propagatedDelayMinutes?: number;
  description?: string;
  notes?: string;
  route?: {
    id?: string;
    routeCode?: string;
    routeName?: string;
  } | null;
};

export type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T;
};

export type AssignedTripsPayload = {
  trips: AssignedTrip[];
  count: number;
};

export type ShiftSchedulePayload = {
  shifts: ShiftSchedule[];
  count: number;
};

export type OperationNotification = {
  id: string;
  title?: string;
  message?: string;
  category?: string;
  priority?: string;
  targetRoles?: string[];
  route?: unknown;
  trip?: unknown;
  vehicle?: unknown;
  activeFrom?: string | null;
  expiresAt?: string | null;
  sourceType?: string;
  sourceId?: string | null;
  metadata?: Record<string, unknown>;
  isRead?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type OperationNotificationsPayload = {
  notifications: OperationNotification[];
  count: number;
};

export type EvidenceFile = {
  fileName?: string;
  originalName?: string;
  url?: string;
  fileUrl?: string;
  mimeType?: string;
  size?: number;
  uploadedAt?: string;
};

export type OperationIncident = {
  id: string;
  incidentCode?: string;
  type?: string;
  severity?: string;
  status?: string;
  trip?: string | Record<string, unknown> | null;
  assignment?: string | Record<string, unknown> | null;
  route?: string | Record<string, unknown> | null;
  vehicle?: string | Record<string, unknown> | null;
  driver?: StaffMember;
  locationText?: string;
  latitude?: number | null;
  longitude?: number | null;
  estimatedDelayMinutes?: number | null;
  trafficCategory?: string | null;
  affectedDirection?: string | null;
  description?: string;
  injuriesReported?: boolean;
  policeNotified?: boolean;
  canContinue?: boolean;
  requiresReplacementVehicle?: boolean;
  passengerViolation?: Record<string, unknown> | null;
  passengerConflict?: Record<string, unknown> | null;
  foundItem?: Record<string, unknown> | null;
  evidenceFiles?: EvidenceFile[];
  reportedAt?: string | null;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  adminNote?: string;
};

export type OperationIncidentsPayload = {
  incidents: OperationIncident[];
  count: number;
};
