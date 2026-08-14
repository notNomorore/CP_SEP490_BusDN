const toNumberOrNull = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const isTripOutsideOperatingWindow = ({
  direction,
  departure,
  arrival,
  routeFirst,
  routeLast,
  enforceRouteDepartureWindow = true,
} = {}) => {
  const departureMinutes = toNumberOrNull(departure);
  const arrivalMinutes = toNumberOrNull(arrival);
  const firstMinutes = toNumberOrNull(routeFirst);
  const lastMinutes = toNumberOrNull(routeLast);

  if (departureMinutes === null || arrivalMinutes === null || firstMinutes === null || lastMinutes === null) {
    return true;
  }
  if (arrivalMinutes <= departureMinutes) return true;

  const normalizedDirection = direction === 'INBOUND' ? 'INBOUND' : 'OUTBOUND';
  if (normalizedDirection === 'OUTBOUND' && departureMinutes < firstMinutes) return true;
  if (enforceRouteDepartureWindow && departureMinutes > lastMinutes) return true;

  return arrivalMinutes > lastMinutes;
};
