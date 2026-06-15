export interface Station {
  _id?: string;
  stationCode: string;
  stationName: string;
  address: string;
  latitude: number;
  longitude: number;
  isMainStation: boolean;
  city?: string;
  zone?: string;
  distanceKm?: number;
}

export interface RouteStop {
  stationId?: string | null;
  stopName: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  stopOrder: number;
  arrivalOffsetMinutes: number;
  departureOffsetMinutes: number;
  isMainStation: boolean;
}

export interface RouteDirection {
  startStation: RouteStop | null;
  endStation: RouteStop | null;
  orderedStops: RouteStop[];
  polylinePath: Array<{
    latitude: number;
    longitude: number;
  }>;
  estimatedDistanceKm: number;
  estimatedDurationMinutes: number;
}

export interface ScheduleConfig {
  firstDepartureTime: string;
  lastDepartureTime: string;
  frequencyMinutes: number;
  operatingDays: string[];
  holidaySchedule: string;
  estimatedArrivalTimes: Array<{
    direction: 'OUTBOUND' | 'INBOUND';
    stopOrder: number;
    stopName: string;
    arrivalOffsetMinutes: number;
    departureOffsetMinutes: number;
  }>;
}

export interface FareConfig {
  baseFare: number;
  studentFare: number;
  childFare: number;
  monthlyPassFare: number;
  luggageFee: number;
  freeRideRules: string;
}

export interface AssignedVehicle {
  busId?: string | null;
  busCode: string;
  plateNumber: string;
  busType: string;
  capacity: number;
}

export interface AssignedStaff {
  userId?: string | null;
  fullName: string;
  role: string;
  shiftLabel?: string;
}

export interface BusRoute {
  _id?: string;
  routeCode: string;
  routeName: string;
  routeType: string;
  operator: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED' | 'SUSPENDED';
  description: string;
  outboundRoute: RouteDirection;
  inboundRoute: RouteDirection;
  scheduleConfig: ScheduleConfig;
  fareConfig: FareConfig;
  vehicleAssignment: {
    busType: string;
    capacity: number;
    assignedBuses: AssignedVehicle[];
    assignedDrivers: AssignedStaff[];
    assistantStaff: AssignedStaff[];
    shiftSchedule: string;
  };
}
