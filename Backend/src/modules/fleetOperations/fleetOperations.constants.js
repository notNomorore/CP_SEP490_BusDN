export const VEHICLE_STATUSES = [
  'available',
  'assigned',
  'active',
  'idle',
  'maintenance',
  'inactive',
];

export const TRIP_STATUSES = [
  'scheduled',
  'active',
  'paused',
  'delayed',
  'completed',
  'cancelled',
  'incident',
];

export const INCIDENT_TYPES = [
  'traffic_congestion',
  'accident',
  'vehicle_breakdown',
  'passenger_conflict',
  'passenger_violation',
  'found_item',
  'gps_lost_signal',
  'vehicle_idle_too_long',
  'severe_delay',
  'other',
];

export const INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'critical'];
export const INCIDENT_STATUSES = [
  'new',
  'acknowledged',
  'in_progress',
  'resolved',
  'dismissed',
];

export const REPORTER_ROLES = ['driver', 'assistant', 'admin', 'system'];

export const SOCKET_EVENTS = {
  DRIVER_GPS_UPDATE: 'driver:gps:update',
  FLEET_LOCATION_UPDATED: 'server:fleet:locationUpdated',
  TRIP_STATUS_UPDATED: 'server:trip:statusUpdated',
  TRIP_DELAYED: 'server:trip:delayed',
  TRIP_VEHICLE_REASSIGNED: 'server:trip:vehicleReassigned',
  INCIDENT_NEW: 'server:incident:new',
  INCIDENT_UPDATED: 'server:incident:updated',
  ADMIN_FLEET_SUBSCRIBE: 'admin:fleet:subscribe',
  ADMIN_FLEET_UNSUBSCRIBE: 'admin:fleet:unsubscribe',
};

export const FLEET_ROOM = 'fleet:operations';

export const LEGACY_INCIDENT_TYPE_MAP = {
  traffic_congestion: 'TRAFFIC_CONGESTION',
  accident: 'ACCIDENT',
  vehicle_breakdown: 'VEHICLE_BREAKDOWN',
  passenger_conflict: 'PASSENGER_CONFLICT',
  passenger_violation: 'PASSENGER_VIOLATION',
  found_item: 'FOUND_ITEM',
  gps_lost_signal: 'GPS_LOST_SIGNAL',
  vehicle_idle_too_long: 'VEHICLE_IDLE_TOO_LONG',
  severe_delay: 'SEVERE_DELAY',
  other: 'OTHER',
};

export const LEGACY_INCIDENT_SEVERITY_MAP = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  critical: 'CRITICAL',
};

export const LEGACY_INCIDENT_STATUS_MAP = {
  new: 'PENDING',
  acknowledged: 'IN_PROGRESS',
  in_progress: 'IN_PROGRESS',
  resolved: 'RESOLVED',
  dismissed: 'REJECTED',
};

export const LEGACY_REPORTER_ROLE_MAP = {
  driver: 'DRIVER',
  assistant: 'BUS_ASSISTANT',
  admin: 'ADMIN',
  system: 'SYSTEM',
};
