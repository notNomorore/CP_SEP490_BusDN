const id = (value) => String(value?._id || value || '');
const minutes = (value) => {
  const [hour, minute] = String(value || '').split(':').map(Number);
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
};

export const splitRowsIntoCycleDuties = (sourceRows = []) => {
  const duties = new Map();
  sourceRows.forEach((row) => {
    (row.trips || []).forEach((trip) => {
      const cycle = String(trip.operationCycleCode || '').trim().toUpperCase();
      const key = `${row.workDate}:${id(row.routeId)}:${cycle || id(trip)}`;
      const current = duties.get(key) || { row, trips: new Map() };
      current.trips.set(id(trip), trip);
      duties.set(key, current);
    });
  });
  return [...duties.values()].map(({ row, trips: tripMap }, index) => {
    const trips = [...tripMap.values()].sort((a, b) => String(a.departureTime).localeCompare(String(b.departureTime)));
    const startTime = trips[0]?.departureTime || row.startTime;
    const endTime = trips.reduce((latest, trip) => String(trip.expectedArrivalTime) > latest ? trip.expectedArrivalTime : latest, startTime);
    return {
      ...row,
      previewId: `${row.workDate}-${String(index + 1).padStart(3, '0')}`,
      shiftCode: `DUTY-${row.route?.routeCode || 'ROUTE'}-${String(row.workDate).replaceAll('-', '')}-${String(index + 1).padStart(3, '0')}`,
      shiftName: `Vòng D-V ${trips[0]?.operationCycleCode || index + 1}`,
      startTime,
      endTime,
      shiftType: minutes(startTime) < 12 * 60 ? 'MORNING' : 'AFTERNOON',
      trips,
      availableTrips: trips,
      tripIds: trips.map((trip) => trip._id),
    };
  }).sort((left, right) => left.workDate.localeCompare(right.workDate) || left.startTime.localeCompare(right.startTime));
};

export const validateAtomicCycleDuties = (rows = [], trips = []) => {
  const errors = [];
  const selected = new Map();
  rows.forEach((row, rowIndex) => {
    (row.tripIds || []).forEach((tripId) => {
      const key = id(tripId);
      if (selected.has(key)) errors.push(`Chuyến ${key} xuất hiện ở cả dòng ${selected.get(key) + 1} và dòng ${rowIndex + 1}.`);
      selected.set(key, rowIndex);
    });
  });
  const tripById = new Map(trips.map((trip) => [id(trip), trip]));
  rows.forEach((row, rowIndex) => {
    const rowTrips = (row.tripIds || []).map((tripId) => tripById.get(id(tripId))).filter(Boolean);
    const cycles = new Set(rowTrips.map((trip) => String(trip.operationCycleCode || '').trim()).filter(Boolean));
    if (cycles.size !== 1 || rowTrips.length !== 2) {
      errors.push(`Dòng ${rowIndex + 1} phải chứa đúng một vòng gồm hai lượt D-V.`);
      return;
    }
    const outbound = rowTrips.filter((trip) => trip.direction === 'OUTBOUND');
    const inbound = rowTrips.filter((trip) => trip.direction === 'INBOUND');
    if (outbound.length !== 1 || inbound.length !== 1) errors.push(`Dòng ${rowIndex + 1} phải có đúng một lượt D và một lượt V.`);
    if (outbound[0] && inbound[0]
      && minutes(inbound[0].departureTime) - minutes(outbound[0].expectedArrivalTime) < 10) {
      errors.push(`Lượt V ở dòng ${rowIndex + 1} phải xuất phát ít nhất 10 phút sau khi lượt D kết thúc.`);
    }
    const drivingMinutes = rowTrips.reduce((total, trip) => total + Math.max(0, minutes(trip.expectedArrivalTime) - minutes(trip.departureTime)), 0);
    if (drivingMinutes > 4 * 60) errors.push(`Dòng ${rowIndex + 1} vượt quá 4 giờ lái xe liên tục.`);
  });
  return errors;
};
