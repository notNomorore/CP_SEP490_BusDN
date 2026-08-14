const toMinutes = (value) => {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? (hours * 60) + minutes : null;
};

export const splitTripsIntoNonOverlappingDuties = (trips = []) => {
  const duties = [];
  [...trips]
    .sort((left, right) => toMinutes(left.departureTime) - toMinutes(right.departureTime))
    .forEach((trip) => {
      const start = toMinutes(trip.departureTime);
      const end = toMinutes(trip.expectedArrivalTime);
      if (start === null || end === null || end <= start) return;
      const availableDuty = duties
        .map((duty, index) => ({ duty, index, end: toMinutes(duty.at(-1)?.expectedArrivalTime) }))
        .filter((item) => item.end !== null && item.end <= start)
        .sort((left, right) => left.end - right.end)[0];
      if (availableDuty) duties[availableDuty.index].push(trip);
      else duties.push([trip]);
    });
  return duties;
};

export default splitTripsIntoNonOverlappingDuties;
