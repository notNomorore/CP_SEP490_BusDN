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

export const getTripRouteLabel = (trip: AssignedTrip) => (
  trip.route?.routeNumber || trip.route?.name || trip.tripCode || 'Unassigned route'
);

export const getTripStatus = (trip: AssignedTrip) => trip.tripStatus || trip.shiftStatus || trip.acceptanceStatus || 'SCHEDULED';

export const getShiftStatus = (shift: ShiftSchedule) => shift.assignmentStatus || 'ASSIGNED';

export const isTripToday = (trip: AssignedTrip) => formatDateKey(trip.scheduledStart) === toDateInput();

export const isTripUpcoming = (trip: AssignedTrip) => {
  const start = trip.scheduledStart ? new Date(trip.scheduledStart) : null;
  return Boolean(start && start > new Date() && !['COMPLETED', 'CANCELLED'].includes(getTripStatus(trip)));
};

export const isTripCompleted = (trip: AssignedTrip) => ['COMPLETED', 'DONE'].includes(getTripStatus(trip));

export const isTripDelayed = (trip: AssignedTrip) => ['DELAYED', 'LATE'].includes(getTripStatus(trip)) || trip.gpsSync?.status === 'DELAYED';

export const getRouteStops = (trip: AssignedTrip): RoutePoint[] => {
  const stops = trip.route?.stops?.filter((stop) => stop.stopName || stop.address) || [];
  if (stops.length) {
    return [...stops].sort((first, second) => Number(first.stopOrder || 0) - Number(second.stopOrder || 0));
  }

  return (trip.route?.pathPoints || []).filter((point) => point.stopName || point.address);
};

export const formatCoordinate = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A';
  return value.toFixed(6);
};
