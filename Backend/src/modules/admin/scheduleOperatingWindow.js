export const FIRST_OPERATION_MINUTES = 5 * 60 + 30;
export const LAST_OPERATION_MINUTES = 18 * 60 + 30;

/**
 * The route window is the departure window at the route origin (outbound).
 * An inbound departure is generated from its outbound arrival and turnaround,
 * so it only has to remain inside the system-wide operating window.
 */
export const isTripOutsideOperatingWindow = ({
  direction,
  departure,
  arrival,
  routeFirst,
  routeLast,
  enforceRouteDepartureWindow = true,
}) => {
  if (departure < FIRST_OPERATION_MINUTES || departure > LAST_OPERATION_MINUTES) return true;
  if (arrival > LAST_OPERATION_MINUTES) return true;
  return enforceRouteDepartureWindow
    && direction !== 'INBOUND'
    && (departure < routeFirst || departure > routeLast);
};
