import type { AssignedTrip, RoutePoint, ShiftSchedule } from '@/types/scheduleOperations';

const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export const parseScheduleDate = (value: Date | string = new Date()) => {
  if (value instanceof Date) return new Date(value);

  const text = String(value || '').trim();
  const match = dateOnlyPattern.exec(text);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return new Date(text);
};

export const toDateInput = (value: Date | string = new Date()) => {
  const date = parseScheduleDate(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const addDays = (value: Date | string, days: number) => {
  const date = parseScheduleDate(value);
  date.setDate(date.getDate() + days);
  return date;
};

export const getTodayRange = () => {
  const today = toDateInput();
  return { from: today, to: today };
};

export const getWeekRange = (anchor: Date | string = new Date()) => {
  const today = parseScheduleDate(anchor);
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = addDays(today, diffToMonday);
  return {
    from: toDateInput(monday),
    to: toDateInput(addDays(monday, 6)),
  };
};

export const getAssignedTripsRange = (anchor: Date | string = new Date()) => {
  const today = parseScheduleDate(anchor);
  return {
    from: toDateInput(addDays(today, -30)),
    to: toDateInput(addDays(today, 14)),
  };
};

export const formatTime = (value?: string | null) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(date);
};

export const formatDate = (value?: string | null) => {
  if (!value) return 'N/A';
  const date = parseScheduleDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: '2-digit' }).format(date);
};

export const formatDateKey = (value?: string | null) => {
  if (!value) return 'unknown';
  return toDateInput(value);
};

const parseTripCodeSchedule = (tripCode?: string | null) => {
  const match = /-(\d{6})-(\d{4})(?:-|$)/.exec(String(tripCode || ''));
  if (!match) return null;

  const [, dateToken, timeToken] = match;
  const year = 2000 + Number(dateToken.slice(0, 2));
  const month = Number(dateToken.slice(2, 4));
  const day = Number(dateToken.slice(4, 6));
  const hour = Number(timeToken.slice(0, 2));
  const minute = Number(timeToken.slice(2, 4));

  if ([year, month, day, hour, minute].some((value) => !Number.isFinite(value))) {
    return null;
  }

  return {
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
};

const formatUtcClock = (value?: string | null) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
};

export const getTripServiceDateLabel = (trip?: AssignedTrip | null) => {
  const parsed = parseTripCodeSchedule(trip?.tripCode);
  return formatDate(parsed?.date || trip?.scheduledStart);
};

export const getTripServiceDateKey = (trip?: AssignedTrip | null) => {
  const parsed = parseTripCodeSchedule(trip?.tripCode);
  return parsed?.date || formatDateKey(trip?.scheduledStart);
};

export const getTripDepartureTimeLabel = (trip?: AssignedTrip | null) => {
  const parsed = parseTripCodeSchedule(trip?.tripCode);
  return parsed?.time || formatUtcClock(trip?.scheduledStart) || formatTime(trip?.scheduledStart);
};

export const getTripArrivalTimeLabel = (trip?: AssignedTrip | null) => (
  parseTripCodeSchedule(trip?.tripCode) ? formatUtcClock(trip?.scheduledEnd) : formatTime(trip?.scheduledEnd)
);

export const getTripPlannedStartDate = (trip?: AssignedTrip | null) => {
  const serviceDate = getTripServiceDateKey(trip);
  const departureTime = getTripDepartureTimeLabel(trip);
  if (serviceDate === 'unknown' || !/^\d{2}:\d{2}$/.test(departureTime)) {
    return trip?.scheduledStart ? new Date(trip.scheduledStart) : null;
  }

  return parseScheduleDate(`${serviceDate}T${departureTime}:00`);
};

export const getTripPlannedEndDate = (trip?: AssignedTrip | null) => {
  const serviceDate = getTripServiceDateKey(trip);
  const arrivalTime = getTripArrivalTimeLabel(trip);
  if (serviceDate === 'unknown' || !/^\d{2}:\d{2}$/.test(arrivalTime)) {
    return trip?.scheduledEnd ? new Date(trip.scheduledEnd) : null;
  }

  const end = parseScheduleDate(`${serviceDate}T${arrivalTime}:00`);
  const start = getTripPlannedStartDate(trip);
  if (start && end < start) end.setDate(end.getDate() + 1);
  return end;
};

export const getTripRouteLabel = (trip: AssignedTrip) => (
  trip.route?.routeNumber || trip.route?.name || trip.tripCode || 'Unassigned route'
);

type TripVehicle = NonNullable<AssignedTrip['vehicle']>;
type ReplacementVehicle = NonNullable<NonNullable<AssignedTrip['vehicleReplacement']>['previousVehicle']>;

export const getVehicleLabel = (vehicle?: TripVehicle | ReplacementVehicle | null) => (
  vehicle?.plateNumber || vehicle?.code || 'N/A'
);

export const getTripVehicleLabel = (trip?: AssignedTrip | null) => getVehicleLabel(trip?.vehicle);

export const hasVehicleReplacement = (trip?: AssignedTrip | null) => Boolean(
  trip?.vehicleReplacement?.previousVehicle?.id
  && trip?.vehicleReplacement?.currentVehicle?.id
);

export const getTripStatus = (trip: AssignedTrip) => {
  if (trip.actualEndAt) return 'COMPLETED';
  return trip.tripStatus || trip.shiftStatus || trip.acceptanceStatus || 'SCHEDULED';
};

export const getShiftStatus = (shift: ShiftSchedule) => shift.assignmentStatus || 'ASSIGNED';

export const isTripToday = (trip: AssignedTrip) => getTripServiceDateKey(trip) === toDateInput();

export const isTripUpcoming = (trip: AssignedTrip) => {
  const start = getTripPlannedStartDate(trip);
  return Boolean(start && start > new Date() && !['COMPLETED', 'CANCELLED'].includes(getTripStatus(trip)));
};

export const isTripHistory = (trip: AssignedTrip) => {
  const start = getTripPlannedStartDate(trip);
  const todayStart = parseScheduleDate(toDateInput());
  return Boolean(start && start < todayStart);
};

export const isTripCompleted = (trip: AssignedTrip) => Boolean(trip.actualEndAt)
  || ['COMPLETED', 'DONE'].includes(getTripStatus(trip));

export const isTripDelayed = (trip: AssignedTrip) => ['DELAYED', 'LATE'].includes(getTripStatus(trip)) || trip.gpsSync?.status === 'DELAYED';

const hasValidCoordinate = (point: RoutePoint) => {
  const latitude = Number(point.latitude);
  const longitude = Number(point.longitude);
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && !(latitude === 0 && longitude === 0);
};

export const getRouteStops = (trip: AssignedTrip): RoutePoint[] => {
  const stops = trip.route?.stops?.filter((stop) => stop.stopName || stop.address) || [];
  const sortedStops = [...stops].sort((first, second) => Number(first.stopOrder || 0) - Number(second.stopOrder || 0));

  return sortedStops;
};

export const getRoutePathPoints = (trip: AssignedTrip): RoutePoint[] => {
  const pathPoints = trip.route?.pathPoints || [];
  const validPathPoints = pathPoints.filter(hasValidCoordinate);
  const stopPoints = getRouteStops(trip).filter(hasValidCoordinate);

  return validPathPoints.length ? validPathPoints : stopPoints;
};

export const formatCoordinate = (value?: number | string | null) => {
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate)) return 'N/A';
  return coordinate.toFixed(6);
};
