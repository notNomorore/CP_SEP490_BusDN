export const routeTypeOptions = ['URBAN', 'EXPRESS', 'AIRPORT', 'INTERCITY', 'CIRCULAR', 'SHUTTLE'];
export const routeStatusOptions = ['DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'SUSPENDED'];
export const operatingDayOptions = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DA_NANG_CENTER = [16.0471, 108.2068];
export const DA_NANG_BOUNDS = [
  [15.85, 107.95],
  [16.25, 108.35],
];
export const OSRM_BASE_URL = import.meta.env.VITE_OSRM_BASE_URL || 'https://router.project-osrm.org';

export const routeTypeLabels = {
  URBAN: 'N\u1ed9i \u0111\u00f4',
  EXPRESS: 'Tuy\u1ebfn nhanh',
  AIRPORT: 'S\u00e2n bay',
  INTERCITY: 'Li\u00ean t\u1ec9nh',
  CIRCULAR: 'V\u00f2ng tuy\u1ebfn',
  SHUTTLE: 'Trung chuy\u1ec3n',
};

export const routeStatusLabels = {
  DRAFT: 'B\u1ea3n nh\u00e1p',
  PENDING_APPROVAL: 'Ch\u1edd duy\u1ec7t',
  PUBLISHED: '\u0110\u00e3 c\u00f4ng b\u1ed1',
  SUSPENDED: 'T\u1ea1m d\u1eebng',
};

export const operatingDayLabels = {
  Mon: 'T2',
  Tue: 'T3',
  Wed: 'T4',
  Thu: 'T5',
  Fri: 'T6',
  Sat: 'T7',
  Sun: 'CN',
};

export const emptyDirection = () => ({
  startStation: null,
  endStation: null,
  orderedStops: [],
  polylinePath: [],
  estimatedDistanceKm: 0,
  estimatedDurationMinutes: 0,
});

export const emptyRouteDraft = () => ({
  _id: '',
  routeCode: '',
  routeName: '',
  routeType: 'URBAN',
  operator: 'Veridian Transit',
  status: 'DRAFT',
  routeColor: '#10b981',
  description: '',
  outboundRoute: emptyDirection(),
  inboundRoute: emptyDirection(),
  scheduleConfig: {
    operatingDays: [...operatingDayOptions],
    firstDepartureTime: '05:30',
    lastDepartureTime: '22:00',
    frequencyMinutes: 12,
    peakFrequencyMinutes: 8,
    offPeakFrequencyMinutes: 15,
    holidaySchedule: '',
    layoverMinutes: 8,
  },
  fareConfig: {
    baseFare: 7000,
    studentFare: 5000,
    childFare: 3000,
    monthlyPassFare: 180000,
    luggageFee: 0,
    freeRideRules: '',
  },
  vehicleAssignment: {
    busType: 'Xe bu\u00fdt \u0111\u00f4 th\u1ecb',
    capacity: 60,
    estimatedFleetSize: 4,
    assignedBuses: [],
    assignedDrivers: [],
    assistantStaff: [],
    shiftSchedule: '',
  },
});

export const buildDefaultRouteName = (startStation, endStation) => {
  const startName = startStation?.stopName?.trim();
  const endName = endStation?.stopName?.trim();

  return startName && endName ? `${startName} - ${endName}` : '';
};

export const getEffectiveRouteName = (draft, outboundRoute = draft.outboundRoute) => (
  draft.routeName?.trim()
  || buildDefaultRouteName(outboundRoute.startStation, outboundRoute.endStation)
);

export const isInsideDaNang = (latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= DA_NANG_BOUNDS[0][0]
    && lat <= DA_NANG_BOUNDS[1][0]
    && lng >= DA_NANG_BOUNDS[0][1]
    && lng <= DA_NANG_BOUNDS[1][1];
};

export const normalizeSearch = (value = '') => String(value)
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd');

export const stationToRef = (station) => station ? ({
  stationId: station._id,
  stopName: station.stationName,
  address: station.address,
  latitude: Number(station.latitude),
  longitude: Number(station.longitude),
  isMainStation: Boolean(station.isMainStation),
}) : null;

export const stationToStop = (station, order) => ({
  stationId: station._id,
  stopName: station.stationName,
  address: station.address,
  latitude: Number(station.latitude),
  longitude: Number(station.longitude),
  stopOrder: order,
  arrivalOffsetMinutes: Math.max(0, (order - 1) * 6),
  departureOffsetMinutes: Math.max(0, ((order - 1) * 6) + 1),
  isMainStation: Boolean(station.isMainStation),
});

export const createMapStop = ({ latitude, longitude }, order) => ({
  stationId: '',
  stopName: `\u0110i\u1ec3m d\u1eebng th\u1ee7 c\u00f4ng ${order}`,
  address: '\u0110i\u1ec3m ch\u1ecdn tr\u00ean b\u1ea3n \u0111\u1ed3 \u0110\u00e0 N\u1eb5ng',
  latitude: Number(latitude),
  longitude: Number(longitude),
  stopOrder: order,
  arrivalOffsetMinutes: Math.max(0, (order - 1) * 6),
  departureOffsetMinutes: Math.max(0, ((order - 1) * 6) + 1),
  isMainStation: false,
});

const toRadians = (value) => (value * Math.PI) / 180;

export const distanceKm = (pointA, pointB) => {
  const lat1 = Number(pointA?.latitude);
  const lng1 = Number(pointA?.longitude);
  const lat2 = Number(pointB?.latitude);
  const lng2 = Number(pointB?.longitude);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) {
    return 0;
  }
  const radius = 6371;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const buildStopSignature = (stops = []) => stops
  .filter((stop) => isInsideDaNang(stop.latitude, stop.longitude))
  .map((stop) => `${Number(stop.latitude).toFixed(6)},${Number(stop.longitude).toFixed(6)}`)
  .join('|');

export const routeStreetPath = async (stops = [], { signal } = {}) => {
  const waypoints = stops.filter((stop) => isInsideDaNang(stop.latitude, stop.longitude));
  if (waypoints.length < 2) {
    return {
      polylinePath: [],
      estimatedDistanceKm: 0,
      estimatedDurationMinutes: 0,
    };
  }

  const coordinates = waypoints
    .map((stop) => `${Number(stop.longitude)},${Number(stop.latitude)}`)
    .join(';');
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    steps: 'false',
    continue_straight: 'false',
  });
  const response = await fetch(`${OSRM_BASE_URL}/route/v1/driving/${coordinates}?${params.toString()}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Routing failed with ${response.status}`);
  }

  const data = await response.json();
  const route = data.routes?.[0];
  const polylinePath = (route?.geometry?.coordinates || [])
    .map(([longitude, latitude]) => ({ latitude: Number(latitude), longitude: Number(longitude) }))
    .filter((point) => isInsideDaNang(point.latitude, point.longitude));

  if (polylinePath.length < 2) {
    throw new Error('Routing returned an empty geometry');
  }

  const fallbackDistanceKm = polylinePath.reduce((total, point, index) => (
    index === 0 ? total : total + distanceKm(polylinePath[index - 1], point)
  ), 0);

  return {
    polylinePath,
    estimatedDistanceKm: Number(((route?.distance || 0) / 1000 || fallbackDistanceKm).toFixed(1)),
    estimatedDurationMinutes: Math.max(1, Math.round((route?.duration || 0) / 60)),
  };
};

const projectPointToSegment = (point, start, end) => {
  const lat = Number(point?.latitude);
  const lng = Number(point?.longitude);
  const startLat = Number(start?.latitude);
  const startLng = Number(start?.longitude);
  const endLat = Number(end?.latitude);
  const endLng = Number(end?.longitude);

  if (![lat, lng, startLat, startLng, endLat, endLng].every(Number.isFinite)) {
    return null;
  }

  const meanLatRad = ((startLat + endLat) / 2) * (Math.PI / 180);
  const kmPerLat = 111.32;
  const kmPerLng = Math.max(0.01, 111.32 * Math.cos(meanLatRad));
  const startPoint = { x: startLng * kmPerLng, y: startLat * kmPerLat };
  const endPoint = { x: endLng * kmPerLng, y: endLat * kmPerLat };
  const targetPoint = { x: lng * kmPerLng, y: lat * kmPerLat };
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const lengthSquared = (dx * dx) + (dy * dy);

  if (lengthSquared === 0) {
    return null;
  }

  const progress = ((targetPoint.x - startPoint.x) * dx + (targetPoint.y - startPoint.y) * dy) / lengthSquared;
  const sideOffsetKm = ((dx * (targetPoint.y - startPoint.y)) - (dy * (targetPoint.x - startPoint.x)))
    / Math.sqrt(lengthSquared);
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const projection = {
    x: startPoint.x + (clampedProgress * dx),
    y: startPoint.y + (clampedProgress * dy),
  };
  const distanceFromCorridorKm = Math.sqrt(
    ((targetPoint.x - projection.x) ** 2) + ((targetPoint.y - projection.y) ** 2)
  );

  return {
    progress,
    distanceFromCorridorKm,
    sideOffsetKm,
    sideOfTravel: sideOffsetKm <= 0 ? 'right' : 'left',
  };
};

const projectPointToPath = (point, path = []) => {
  if (!Array.isArray(path) || path.length < 2) {
    return null;
  }

  let travelledKm = 0;
  let bestProjection = null;

  for (let index = 1; index < path.length; index += 1) {
    const segmentStart = path[index - 1];
    const segmentEnd = path[index];
    const segmentLengthKm = distanceKm(segmentStart, segmentEnd);
    const projection = projectPointToSegment(point, segmentStart, segmentEnd);

    if (projection) {
      const progressOnSegment = Math.max(0, Math.min(1, projection.progress));
      const candidate = {
        ...projection,
        pathDistanceKm: travelledKm + (segmentLengthKm * progressOnSegment),
      };

      if (!bestProjection || candidate.distanceFromCorridorKm < bestProjection.distanceFromCorridorKm) {
        bestProjection = candidate;
      }
    }

    travelledKm += segmentLengthKm;
  }

  if (!bestProjection || travelledKm <= 0) {
    return null;
  }

  return {
    ...bestProjection,
    progress: Math.max(0, Math.min(1, bestProjection.pathDistanceKm / travelledKm)),
  };
};

export const buildSuggestedStops = ({
  direction,
  stations,
  corridorPath,
  maxDistanceKm = 0.18,
  minSpacingKm = 0.45,
  limit = 10,
}) => {
  const start = direction?.startStation;
  const end = direction?.endStation;

  if (!start?.latitude || !start?.longitude || !end?.latitude || !end?.longitude) {
    return [];
  }

  const buildStationKeys = (station) => [
    station?._id || station?.stationId || '',
    Number.isFinite(Number(station?.latitude)) && Number.isFinite(Number(station?.longitude))
      ? `${Number(station.latitude).toFixed(5)}:${Number(station.longitude).toFixed(5)}`
      : '',
    normalizeSearch(station?.stationName || station?.stopName || ''),
  ].filter(Boolean);
  const existingStationKeys = new Set((direction.orderedStops || [])
    .flatMap((stop) => buildStationKeys(stop)));
  const terminalKeys = new Set([start, end].flatMap((station) => buildStationKeys(station)));
  const path = Array.isArray(corridorPath) && corridorPath.length >= 2
    ? corridorPath
    : Array.isArray(direction?.polylinePath) && direction.polylinePath.length >= 2
      ? direction.polylinePath
      : [start, end];

  const rankedStations = stations
    .filter((station) => buildStationKeys(station).every((key) => !existingStationKeys.has(key)))
    .filter((station) => buildStationKeys(station).every((key) => !terminalKeys.has(key)))
    .filter((station) => station.isActive !== false)
    .filter((station) => station.source !== 'MANUAL' || station.sourceId || station.googlePlaceId)
    .filter((station) => isInsideDaNang(station.latitude, station.longitude))
    .map((station) => {
      const projection = projectPointToPath(station, path);
      if (!projection || projection.progress <= 0.02 || projection.progress >= 0.98) {
        return null;
      }

      return {
        ...station,
        isTerminalCandidate: buildStationKeys(station).some((key) => terminalKeys.has(key)),
        corridorProgress: projection.progress,
        corridorDistanceKm: projection.distanceFromCorridorKm,
        sideOffsetKm: projection.sideOffsetKm,
        sideOfTravel: projection.sideOfTravel,
        sideRank: projection.sideOfTravel === 'right' ? 0 : 1,
        sourceRank: station.source === 'DANABUS' || station.source === 'ECOBUS' ? 0 : 1,
      };
    })
    .filter((station) => station
      && station.corridorDistanceKm <= maxDistanceKm)
    .sort((left, right) => (
      left.corridorProgress - right.corridorProgress
        || left.sideRank - right.sideRank
        || left.sourceRank - right.sourceRank
        || left.corridorDistanceKm - right.corridorDistanceKm
    ));

  const spacedStations = [];
  rankedStations.forEach((station) => {
    const tooClose = spacedStations.some((selected) => distanceKm(selected, station) < minSpacingKm);
    if (!tooClose) {
      spacedStations.push(station);
    }
  });

  return spacedStations.slice(0, limit);
};

export const computeDirection = (direction) => {
  const stops = (direction?.orderedStops || []).filter((stop) => (
    isInsideDaNang(stop.latitude, stop.longitude)
  ));
  const stopPath = stops.map((stop) => ({
    latitude: Number(stop.latitude),
    longitude: Number(stop.longitude),
  }));
  const routedPath = Array.isArray(direction?.polylinePath)
    ? direction.polylinePath
      .map((point) => ({
        latitude: Number(point.latitude),
        longitude: Number(point.longitude),
      }))
      .filter((point) => isInsideDaNang(point.latitude, point.longitude))
    : [];
  const polylinePath = routedPath.length >= 2 ? routedPath : stopPath;
  const estimatedDistanceKm = polylinePath.reduce((total, point, index) => (
    index === 0 ? total : total + distanceKm(polylinePath[index - 1], point)
  ), 0);
  const effectiveDistanceKm = Number(direction?.estimatedDistanceKm) || estimatedDistanceKm;
  const urbanBusDurationMinutes = effectiveDistanceKm > 0
    ? Math.ceil((effectiveDistanceKm / 22) * 60 + Math.max(0, stops.length - 2) * 0.75)
    : 0;

  return {
    ...direction,
    orderedStops: stops.map((stop, index) => ({ ...stop, stopOrder: index + 1 })),
    startStation: stationToRefFromStop(stops[0]) || direction.startStation || null,
    endStation: stationToRefFromStop(stops[stops.length - 1]) || direction.endStation || null,
    polylinePath,
    estimatedDistanceKm: Number(effectiveDistanceKm.toFixed(1)),
    estimatedDurationMinutes: Math.min(80, Math.max(
      60,
      Math.round(Number(direction?.estimatedDurationMinutes) || 0),
      urbanBusDurationMinutes
    )),
  };
};

export const stationToRefFromStop = (stop) => stop ? ({
  stationId: stop.stationId || undefined,
  stopName: stop.stopName,
  address: stop.address,
  latitude: Number(stop.latitude),
  longitude: Number(stop.longitude),
  isMainStation: Boolean(stop.isMainStation),
}) : null;

const stopIdentity = (stop) => {
  const stationId = stop?.stationId || stop?._id || '';
  if (stationId) return `id:${stationId}`;
  const latitude = Number(stop?.latitude);
  const longitude = Number(stop?.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? `geo:${latitude.toFixed(5)}:${longitude.toFixed(5)}`
    : '';
};

const reverseDirectionStops = (direction) => {
  const reversedStops = (direction?.orderedStops || [])
    .slice()
    .reverse()
    .map((stop, index) => ({
      ...stop,
      stopOrder: index + 1,
      arrivalOffsetMinutes: index * 6,
      departureOffsetMinutes: (index * 6) + 1,
    }));

  return computeDirection({
    ...direction,
    startStation: stationToRefFromStop(reversedStops[0]) || direction?.endStation || null,
    endStation: stationToRefFromStop(reversedStops[reversedStops.length - 1]) || direction?.startStation || null,
    orderedStops: reversedStops,
    polylinePath: [],
    estimatedDistanceKm: 0,
    estimatedDurationMinutes: 0,
  });
};

export const normalizeBidirectionalStopOrder = (draft) => {
  const outboundRoute = computeDirection(draft.outboundRoute);
  let inboundRoute = computeDirection(draft.inboundRoute);
  const outboundStops = outboundRoute.orderedStops;
  const inboundStops = inboundRoute.orderedStops;

  if (outboundStops.length >= 2 && outboundStops.length === inboundStops.length) {
    const sameForwardOrder = outboundStops.every((stop, index) => (
      stopIdentity(stop) && stopIdentity(stop) === stopIdentity(inboundStops[index])
    ));
    const alreadyReverseOrder = outboundStops.every((stop, index) => (
      stopIdentity(stop) && stopIdentity(stop) === stopIdentity(inboundStops[inboundStops.length - index - 1])
    ));

    if (sameForwardOrder && !alreadyReverseOrder) {
      inboundRoute = reverseDirectionStops(inboundRoute);
    }
  }

  return {
    ...draft,
    outboundRoute,
    inboundRoute,
  };
};

export const prepareRoutePayload = (draft, status = draft.status) => {
  const normalizedDraft = normalizeBidirectionalStopOrder(draft);
  const outboundRoute = normalizedDraft.outboundRoute;
  const inboundRoute = normalizedDraft.inboundRoute;
  return {
    ...normalizedDraft,
    routeName: getEffectiveRouteName(draft, outboundRoute),
    status,
    outboundRoute,
    inboundRoute,
    scheduleConfig: {
      ...draft.scheduleConfig,
      holidaySchedule: '',
      frequencyMinutes: Number(draft.scheduleConfig.peakFrequencyMinutes || draft.scheduleConfig.frequencyMinutes || 0),
    },
    vehicleAssignment: {
      ...draft.vehicleAssignment,
      capacity: Number(draft.vehicleAssignment.capacity || 0),
      shiftSchedule: `Ngh\u1ec9 \u0111\u1ea7u cu\u1ed1i ${draft.scheduleConfig.layoverMinutes || 0} ph\u00fat; \u0111\u1ed9i xe ${draft.vehicleAssignment.estimatedFleetSize || 0} xe`,
    },
  };
};

const parseClock = (value) => {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const sameStopLocation = (left, right) => {
  if (!left || !right) return false;
  const leftId = left.stationId || left._id || '';
  const rightId = right.stationId || right._id || '';
  if (leftId && rightId) return leftId === rightId;
  return Number(left.latitude).toFixed(5) === Number(right.latitude).toFixed(5)
    && Number(left.longitude).toFixed(5) === Number(right.longitude).toFixed(5);
};

export const validateRouteDraft = (draft) => {
  const errors = [];
  const warnings = [];
  const outbound = computeDirection(draft.outboundRoute);
  const inbound = computeDirection(draft.inboundRoute);
  const firstTrip = parseClock(draft.scheduleConfig.firstDepartureTime);
  const lastTrip = parseClock(draft.scheduleConfig.lastDepartureTime);
  const totalStops = outbound.orderedStops.length + inbound.orderedStops.length;
  const totalDistance = Number((outbound.estimatedDistanceKm + inbound.estimatedDistanceKm).toFixed(1));
  const totalDuration = outbound.estimatedDurationMinutes + inbound.estimatedDurationMinutes;
  const routeName = getEffectiveRouteName(draft, outbound);

  if (!draft.routeCode.trim()) errors.push('Thi\u1ebfu m\u00e3 tuy\u1ebfn.');
  if (!routeName) errors.push('Thi\u1ebfu t\u00ean tuy\u1ebfn ho\u1eb7c thi\u1ebfu \u0111i\u1ec3m \u0111\u1ea7u/cu\u1ed1i \u0111\u1ec3 t\u1ef1 \u0111\u1eb7t t\u00ean.');
  if (!outbound.orderedStops.length || !inbound.orderedStops.length) errors.push('Thi\u1ebfu \u0111i\u1ec3m d\u1eebng cho m\u1ed9t ho\u1eb7c hai chi\u1ec1u tuy\u1ebfn.');
  if (outbound.orderedStops.length === 1 || inbound.orderedStops.length === 1) errors.push('M\u1ed7i chi\u1ec1u c\u1ea7n \u00edt nh\u1ea5t 2 \u0111i\u1ec3m d\u1eebng \u0111\u1ec3 t\u1ea1o h\u00ecnh h\u1ecdc tuy\u1ebfn.');
  if (outbound.orderedStops.length >= 2 && inbound.orderedStops.length >= 2) {
    if (!sameStopLocation(outbound.endStation, inbound.startStation)) errors.push('Chi\u1ec1u v\u1ec1 ph\u1ea3i b\u1eaft \u0111\u1ea7u t\u1ea1i b\u1ebfn cu\u1ed1i c\u1ee7a chi\u1ec1u \u0111i.');
    if (!sameStopLocation(outbound.startStation, inbound.endStation)) errors.push('Chi\u1ec1u v\u1ec1 ph\u1ea3i k\u1ebft th\u00fac t\u1ea1i b\u1ebfn \u0111\u1ea7u c\u1ee7a chi\u1ec1u \u0111i.');
  }
  if (firstTrip === null || lastTrip === null) errors.push('L\u1ecbch ch\u1ea1y thi\u1ebfu gi\u1edd chuy\u1ebfn \u0111\u1ea7u ho\u1eb7c chuy\u1ebfn cu\u1ed1i.');
  if (firstTrip !== null && lastTrip !== null && firstTrip >= lastTrip) errors.push('Chuy\u1ebfn \u0111\u1ea7u ph\u1ea3i s\u1edbm h\u01a1n chuy\u1ebfn cu\u1ed1i.');
  if (Number(draft.scheduleConfig.peakFrequencyMinutes || 0) <= 0) errors.push('T\u1ea7n su\u1ea5t cao \u0111i\u1ec3m ph\u1ea3i l\u1edbn h\u01a1n 0.');
  if (!draft.scheduleConfig.operatingDays.length) errors.push('C\u1ea7n ch\u1ecdn \u00edt nh\u1ea5t m\u1ed9t ng\u00e0y ho\u1ea1t \u0111\u1ed9ng.');

  [outbound, inbound].forEach((direction, directionIndex) => {
    const seen = new Set();
    direction.orderedStops.forEach((stop, index) => {
      const key = stop.stationId || `${Number(stop.latitude).toFixed(5)}:${Number(stop.longitude).toFixed(5)}`;
      if (seen.has(key)) warnings.push(`${directionIndex === 0 ? 'Chi\u1ec1u \u0111i' : 'Chi\u1ec1u v\u1ec1'} c\u00f3 \u0111i\u1ec3m d\u1eebng tr\u00f9ng.`);
      const previousStop = direction.orderedStops[index - 1];
      const previousKey = previousStop
        ? previousStop.stationId || `${Number(previousStop.latitude).toFixed(5)}:${Number(previousStop.longitude).toFixed(5)}`
        : '';
      if (index > 0 && key && key === previousKey) {
        errors.push(`${directionIndex === 0 ? 'Chi\u1ec1u \u0111i' : 'Chi\u1ec1u v\u1ec1'} kh\u00f4ng \u0111\u01b0\u1ee3c c\u00f3 hai \u0111i\u1ec3m d\u1eebng li\u00ean ti\u1ebfp tr\u00f9ng nhau.`);
      }
      seen.add(key);
    });
    direction.orderedStops.forEach((stop, index) => {
      if (index > 0 && distanceKm(direction.orderedStops[index - 1], stop) < 0.08) {
        warnings.push('C\u00f3 kho\u1ea3ng c\u00e1ch gi\u1eefa hai tr\u1ea1m d\u01b0\u1edbi 80m, c\u1ea7n ki\u1ec3m tra tr\u01b0\u1edbc khi k\u00edch ho\u1ea1t.');
      }
    });
  });

  if (totalDuration > 180) warnings.push('Th\u1eddi gian to\u00e0n tuy\u1ebfn d\u00e0i, n\u00ean r\u00e0 so\u00e1t v\u1eadn h\u00e0nh.');
  if (totalStops > 80) warnings.push('S\u1ed1 \u0111i\u1ec3m d\u1eebng nhi\u1ec1u, c\u1ea7n ki\u1ec3m tra n\u0103ng l\u1ef1c \u0111i\u1ec1u ph\u1ed1i.');

  return {
    canPublish: errors.length === 0,
    errors,
    warnings,
    totalStops,
    totalDistance,
    totalDuration,
    dailyTrips: firstTrip !== null && lastTrip !== null && Number(draft.scheduleConfig.peakFrequencyMinutes) > 0
      ? Math.floor((lastTrip - firstTrip) / Number(draft.scheduleConfig.peakFrequencyMinutes)) + 1
      : 0,
  };
};

export const normalizeRouteFromApi = (route) => ({
  ...emptyRouteDraft(),
  ...route,
  routeColor: route.routeColor || '#10b981',
  scheduleConfig: {
    ...emptyRouteDraft().scheduleConfig,
    ...(route.scheduleConfig || {}),
    peakFrequencyMinutes: route.scheduleConfig?.peakFrequencyMinutes || route.scheduleConfig?.frequencyMinutes || 12,
    offPeakFrequencyMinutes: route.scheduleConfig?.offPeakFrequencyMinutes || 18,
    layoverMinutes: route.scheduleConfig?.layoverMinutes || 8,
  },
  vehicleAssignment: {
    ...emptyRouteDraft().vehicleAssignment,
    ...(route.vehicleAssignment || {}),
    estimatedFleetSize: route.vehicleAssignment?.estimatedFleetSize || Math.max(1, Math.ceil(Number(route.vehicleAssignment?.capacity || 60) / 60)),
  },
  outboundRoute: {
    ...emptyDirection(),
    ...(route.outboundRoute || {}),
    orderedStops: route.outboundRoute?.orderedStops || [],
  },
  inboundRoute: {
    ...emptyDirection(),
    ...(route.inboundRoute || {}),
    orderedStops: route.inboundRoute?.orderedStops || [],
  },
});
