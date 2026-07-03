export type StaffRole = 'DRIVER' | 'BUS_ASSISTANT' | string;

export type StaffMember = {
  id?: string;
  fullName?: string;
  role?: string;
  phoneNumber?: string;
} | null;

export type AssignedTrip = {
  id: string;
  shiftCode?: string;
  tripCode?: string;
  actorRole?: StaffRole;
  route?: {
    id?: string | null;
    routeNumber?: string;
    name?: string;
    origin?: string;
    destination?: string;
    direction?: string;
    estimatedDistanceKm?: number;
    estimatedDurationMinutes?: number;
    stops?: unknown[];
  };
  vehicle?: {
    id?: string | null;
    code?: string;
    plateNumber?: string;
    model?: string;
    capacity?: number;
  };
  driver?: StaffMember;
  busAssistant?: StaffMember;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  actualStartAt?: string | null;
  actualEndAt?: string | null;
  gpsSync?: {
    status?: string;
    retryCount?: number;
    message?: string;
  };
  dutyStart?: string | null;
  checkInDeadline?: string | null;
  dutyEnd?: string | null;
  reportLocation?: string;
  shiftStatus?: string;
  acceptanceStatus?: string;
  tripStatus?: string;
  inspection?: {
    status?: string;
  };
  notes?: string;
};

export type ShiftSchedule = {
  id: string;
  assignmentStatus?: string;
  workDate?: string;
  shiftCode?: string;
  shiftName?: string;
  shiftType?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
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
