import React, { useEffect, useMemo, useState } from 'react';
import Header from '../../../shared/components/navigation/Header.jsx';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { HOME_BUS_HERO_IMAGE } from '../../../shared/constants/images.js';
import useTheme from '../../../shared/hooks/useTheme.js';
import adminService from '../services/adminService.js';

const routeStatusOptions = ['DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'SUSPENDED'];
const operatingDayOptions = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const directionTabs = [
  { key: 'outboundRoute', label: 'Chiều đi', accent: 'emerald' },
  { key: 'inboundRoute', label: 'Chiều về', accent: 'cyan' },
];
const DA_NANG_CENTER = [16.0471, 108.2068];
const DA_NANG_BOUNDS = [
  [15.85, 107.95],
  [16.25, 108.35],
];

const routeStatusLabels = {
  ALL: 'Tất cả trạng thái',
  DRAFT: 'Bản nháp',
  PENDING_APPROVAL: 'Chờ duyệt',
  PUBLISHED: 'Đã công bố',
  SUSPENDED: 'Tạm dừng',
};

const operatingDayLabels = {
  Mon: 'T2',
  Tue: 'T3',
  Wed: 'T4',
  Thu: 'T5',
  Fri: 'T6',
  Sat: 'T7',
  Sun: 'CN',
};

const formatCurrency = (value) => new Intl.NumberFormat('en-US').format(Number(value || 0));

const createEmptyStop = (order = 1) => ({
  stationId: '',
  stopName: '',
  address: '',
  latitude: '',
  longitude: '',
  stopOrder: order,
  arrivalOffsetMinutes: Math.max(0, (order - 1) * 6),
  departureOffsetMinutes: Math.max(0, ((order - 1) * 6) + 1),
  isMainStation: false,
});

const createEmptyDirection = () => ({
  startStation: null,
  endStation: null,
  orderedStops: [createEmptyStop(1), createEmptyStop(2)],
  polylinePath: [],
  estimatedDistanceKm: 0,
  estimatedDurationMinutes: 0,
});

const createEmptyRoute = () => ({
  _id: '',
  routeCode: '',
  routeName: '',
  routeType: 'URBAN',
  operator: 'Veridian Transit',
  status: 'DRAFT',
  description: '',
  outboundRoute: createEmptyDirection(),
  inboundRoute: createEmptyDirection(),
  scheduleConfig: {
    firstDepartureTime: '05:30',
    lastDepartureTime: '22:00',
    frequencyMinutes: 12,
    operatingDays: [...operatingDayOptions],
    holidaySchedule: '',
    estimatedArrivalTimes: [],
  },
  fareConfig: {
    baseFare: 7000,
    studentFare: 5000,
    childFare: 3000,
    monthlyPassFare: 180000,
    luggageFee: 2000,
    freeRideRules: 'Trẻ em dưới 6 tuổi và cựu chiến binh được miễn phí khi có giấy tờ hợp lệ.',
  },
  vehicleAssignment: {
    busType: 'Xe buýt tiêu chuẩn đô thị',
    capacity: 60,
    assignedBuses: [],
    assignedDrivers: [],
    assistantStaff: [],
    shiftSchedule: 'Ca sớm: 05:30-13:30 | Ca muộn: 13:30-22:30',
  },
});

const defaultRouteSummary = {
  totalRoutes: 0,
  publishedRoutes: 0,
  draftRoutes: 0,
  pendingRoutes: 0,
  suspendedRoutes: 0,
};

const parseClockToMinutes = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }

  return (hours * 60) + minutes;
};

const formatDuration = (minutes) => {
  const total = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(total / 60);
  const remain = total % 60;
  if (hours === 0) {
    return `${remain} min`;
  }
  return `${hours}h ${remain}m`;
};

const normalizeSearchText = (value = '') => String(value)
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd');

const buildStationIdentityKeys = (station) => [
  station?._id || station?.stationId || '',
  Number.isFinite(Number(station?.latitude)) && Number.isFinite(Number(station?.longitude))
    ? `${Number(station.latitude).toFixed(5)}:${Number(station.longitude).toFixed(5)}`
    : '',
  normalizeSearchText(station?.stationName || station?.stopName || ''),
].filter(Boolean);

const isInsideDaNangBounds = (latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);

  return Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= DA_NANG_BOUNDS[0][0]
    && lat <= DA_NANG_BOUNDS[1][0]
    && lng >= DA_NANG_BOUNDS[0][1]
    && lng <= DA_NANG_BOUNDS[1][1];
};

const haversineDistanceKm = (pointA, pointB) => {
  if (!pointA || !pointB) {
    return 0;
  }

  const lat1 = Number(pointA.latitude);
  const lng1 = Number(pointA.longitude);
  const lat2 = Number(pointB.latitude);
  const lng2 = Number(pointB.longitude);

  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) {
    return 0;
  }

  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
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
  const distanceKm = Math.sqrt(
    ((targetPoint.x - projection.x) ** 2) + ((targetPoint.y - projection.y) ** 2)
  );

  return {
    progress,
    distanceKm,
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
    const segmentLengthKm = haversineDistanceKm(segmentStart, segmentEnd);
    const projection = projectPointToSegment(point, segmentStart, segmentEnd);

    if (projection) {
      const progressOnSegment = Math.max(0, Math.min(1, projection.progress));
      const candidate = {
        ...projection,
        pathDistanceKm: travelledKm + (segmentLengthKm * progressOnSegment),
      };

      if (!bestProjection || candidate.distanceKm < bestProjection.distanceKm) {
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

const buildSuggestedStops = ({
  direction,
  stations,
  maxDistanceKm = 0.18,
  minSpacingKm = 0.45,
  limit = 10,
}) => {
  const start = direction?.startStation;
  const end = direction?.endStation;

  if (!start?.latitude || !start?.longitude || !end?.latitude || !end?.longitude) {
    return [];
  }

  const existingStationKeys = new Set((direction.orderedStops || [])
    .flatMap((stop) => buildStationIdentityKeys(stop)));
  const terminalKeys = new Set([start, end].flatMap((station) => buildStationIdentityKeys(station)));
  const path = Array.isArray(direction?.polylinePath) && direction.polylinePath.length >= 2
    ? direction.polylinePath
    : [start, end];

  const rankedStations = stations
    .filter((station) => buildStationIdentityKeys(station).every((key) => !existingStationKeys.has(key)))
    .filter((station) => buildStationIdentityKeys(station).every((key) => !terminalKeys.has(key)))
    .filter((station) => station.isActive !== false)
    .filter((station) => station.source !== 'MANUAL' || station.sourceId || station.googlePlaceId)
    .filter((station) => isInsideDaNangBounds(station.latitude, station.longitude))
    .map((station) => {
      const projection = projectPointToPath(station, path);
      if (!projection || projection.progress <= 0.02 || projection.progress >= 0.98) {
        return null;
      }

      return {
        ...station,
        corridorDistanceKm: projection.distanceKm,
        corridorProgress: projection.progress,
        sideOffsetKm: projection.sideOffsetKm,
        sideOfTravel: projection.sideOfTravel,
        sourceRank: station.source === 'DANABUS' || station.source === 'ECOBUS' ? 0 : 1,
      };
    })
    .filter((station) => station && station.corridorDistanceKm <= maxDistanceKm)
    .sort((left, right) => (
      left.corridorProgress - right.corridorProgress
      || left.sourceRank - right.sourceRank
      || left.corridorDistanceKm - right.corridorDistanceKm
    ));

  const spacedStations = [];
  rankedStations.forEach((station) => {
    const tooClose = spacedStations.some((selected) => haversineDistanceKm(selected, station) < minSpacingKm);
    if (!tooClose) {
      spacedStations.push(station);
    }
  });

  return spacedStations.slice(0, limit);
};

const computePolylineDistance = (points = []) => {
  if (!Array.isArray(points) || points.length < 2) {
    return 0;
  }

  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += haversineDistanceKm(points[index - 1], points[index]);
  }
  return Number(total.toFixed(1));
};

const normalizeStationRef = (station) => {
  if (!station) {
    return null;
  }

  return {
    stationId: station.stationId || station._id || '',
    stopName: station.stopName || station.stationName || '',
    address: station.address || '',
    latitude: station.latitude ?? '',
    longitude: station.longitude ?? '',
    isMainStation: Boolean(station.isMainStation),
  };
};

const normalizeDirection = (direction) => {
  const orderedStops = Array.isArray(direction?.orderedStops)
    ? direction.orderedStops.map((stop, index) => ({
      ...createEmptyStop(index + 1),
      ...stop,
      stationId: stop.stationId || stop._id || '',
      stopOrder: index + 1,
      latitude: stop.latitude ?? '',
      longitude: stop.longitude ?? '',
    }))
    : [createEmptyStop(1), createEmptyStop(2)];

  const startStation = normalizeStationRef(direction?.startStation) || null;
  const endStation = normalizeStationRef(direction?.endStation) || null;

  return {
    startStation,
    endStation,
    orderedStops,
    polylinePath: Array.isArray(direction?.polylinePath) ? direction.polylinePath : [],
    estimatedDistanceKm: Number(direction?.estimatedDistanceKm || 0),
    estimatedDurationMinutes: Number(direction?.estimatedDurationMinutes || 0),
  };
};

const normalizeRouteRecord = (route) => ({
  ...createEmptyRoute(),
  ...route,
  _id: route?._id || '',
  outboundRoute: normalizeDirection(route?.outboundRoute),
  inboundRoute: normalizeDirection(route?.inboundRoute),
  scheduleConfig: {
    ...createEmptyRoute().scheduleConfig,
    ...route?.scheduleConfig,
    operatingDays: Array.isArray(route?.scheduleConfig?.operatingDays)
      ? route.scheduleConfig.operatingDays
      : [...operatingDayOptions],
    estimatedArrivalTimes: Array.isArray(route?.scheduleConfig?.estimatedArrivalTimes)
      ? route.scheduleConfig.estimatedArrivalTimes
      : [],
  },
  fareConfig: {
    ...createEmptyRoute().fareConfig,
    ...route?.fareConfig,
  },
  vehicleAssignment: {
    ...createEmptyRoute().vehicleAssignment,
    ...route?.vehicleAssignment,
    assignedBuses: Array.isArray(route?.vehicleAssignment?.assignedBuses)
      ? route.vehicleAssignment.assignedBuses
      : [],
    assignedDrivers: Array.isArray(route?.vehicleAssignment?.assignedDrivers)
      ? route.vehicleAssignment.assignedDrivers
      : [],
    assistantStaff: Array.isArray(route?.vehicleAssignment?.assistantStaff)
      ? route.vehicleAssignment.assistantStaff
      : [],
  },
});

const computeDirectionSnapshot = (direction) => {
  const basePoints = [];
  if (direction.startStation?.latitude && direction.startStation?.longitude) {
    basePoints.push({
      latitude: Number(direction.startStation.latitude),
      longitude: Number(direction.startStation.longitude),
    });
  }

  direction.orderedStops.forEach((stop) => {
    const latitude = Number(stop.latitude);
    const longitude = Number(stop.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      basePoints.push({ latitude, longitude });
    }
  });

  if (direction.endStation?.latitude && direction.endStation?.longitude) {
    basePoints.push({
      latitude: Number(direction.endStation.latitude),
      longitude: Number(direction.endStation.longitude),
    });
  }

  const polylinePath = direction.polylinePath?.length ? direction.polylinePath : basePoints;
  const estimatedDistanceKm = Number(direction.estimatedDistanceKm || computePolylineDistance(polylinePath));
  const estimatedDurationMinutes = Number(
    direction.estimatedDurationMinutes || Math.round((estimatedDistanceKm * 2.7) + (direction.orderedStops.length * 1.8))
  );

  return {
    polylinePath,
    estimatedDistanceKm: Number(estimatedDistanceKm.toFixed(1)),
    estimatedDurationMinutes,
  };
};

const deriveValidation = (route) => {
  const errors = [];
  const warnings = [];

  if (!route.routeCode.trim()) {
    errors.push('Bắt buộc nhập mã tuyến.');
  }
  if (!route.routeName.trim()) {
    errors.push('Bắt buộc nhập tên tuyến.');
  }

  const checkDirection = (directionKey, directionLabel) => {
    const direction = route[directionKey];
    const stops = direction.orderedStops.filter((stop) => stop.stopName.trim() || stop.address.trim());
    if (stops.length < 2) {
      errors.push(`${directionLabel} cần ít nhất 2 điểm dừng.`);
    }

    if (!direction.startStation?.stopName) {
      errors.push(`${directionLabel} cần trạm bắt đầu.`);
    }
    if (!direction.endStation?.stopName) {
      errors.push(`${directionLabel} cần trạm kết thúc.`);
    }

    const duplicateKeys = new Set();
    stops.forEach((stop, index) => {
      const lat = Number(stop.latitude);
      const lng = Number(stop.longitude);
      if (!stop.stopName.trim()) {
        errors.push(`${directionLabel} điểm dừng ${index + 1} cần tên điểm dừng.`);
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        errors.push(`${directionLabel} điểm dừng ${index + 1} cần vĩ độ và kinh độ.`);
      }
      if (stop.stopOrder !== index + 1) {
        errors.push(`${directionLabel} có thứ tự điểm dừng không hợp lệ.`);
      }
      const duplicateKey = `${stop.stopName.trim().toLowerCase()}|${lat}|${lng}`;
      if (duplicateKeys.has(duplicateKey)) {
        errors.push(`${directionLabel} có điểm dừng trùng "${stop.stopName}".`);
      }
      duplicateKeys.add(duplicateKey);
    });

    if (computeDirectionSnapshot(direction).polylinePath.length < 2) {
      warnings.push(`${directionLabel} vẫn đang dùng đường đi tự sinh từ tọa độ điểm dừng.`);
    }
  };

  checkDirection('outboundRoute', 'Chiều đi');
  checkDirection('inboundRoute', 'Chiều về');

  const firstDeparture = parseClockToMinutes(route.scheduleConfig.firstDepartureTime);
  const lastDeparture = parseClockToMinutes(route.scheduleConfig.lastDepartureTime);
  if (firstDeparture === null || lastDeparture === null) {
    errors.push('Lịch chạy cần giờ khởi hành đầu và cuối hợp lệ theo định dạng HH:mm.');
  } else if (firstDeparture >= lastDeparture) {
    errors.push('Giờ khởi hành đầu phải sớm hơn giờ khởi hành cuối.');
  }

  if (Number(route.scheduleConfig.frequencyMinutes) <= 0) {
    errors.push('Tần suất phải lớn hơn 0 phút.');
  }
  if (Number(route.fareConfig.baseFare) < 0) {
    errors.push('Giá vé cơ bản phải lớn hơn hoặc bằng 0.');
  }
  if (Number(route.vehicleAssignment.capacity) <= 0) {
    errors.push('Sức chứa được phân công phải lớn hơn 0.');
  }
  if (!route.vehicleAssignment.assignedDrivers.length) {
    warnings.push('Chưa phân công tài xế.');
  }
  if (!route.vehicleAssignment.assignedBuses.length) {
    warnings.push('Chưa phân công xe buýt.');
  }

  return {
    canPublish: errors.length === 0,
    errors,
    warnings,
  };
};

const buildRoutePayload = (route) => {
  const normalizeDirectionPayload = (direction) => {
    const snapshot = computeDirectionSnapshot(direction);
    return {
      startStation: direction.startStation,
      endStation: direction.endStation,
      orderedStops: direction.orderedStops.map((stop, index) => ({
        ...stop,
        stopOrder: index + 1,
        latitude: Number(stop.latitude),
        longitude: Number(stop.longitude),
        arrivalOffsetMinutes: Number(stop.arrivalOffsetMinutes),
        departureOffsetMinutes: Number(stop.departureOffsetMinutes),
      })),
      polylinePath: snapshot.polylinePath,
      estimatedDistanceKm: snapshot.estimatedDistanceKm,
      estimatedDurationMinutes: snapshot.estimatedDurationMinutes,
    };
  };

  return {
    routeCode: route.routeCode.trim().toUpperCase(),
    routeName: route.routeName.trim(),
    routeType: route.routeType || 'URBAN',
    operator: route.operator.trim(),
    status: route.status,
    description: route.description.trim(),
    outboundRoute: normalizeDirectionPayload(route.outboundRoute),
    inboundRoute: normalizeDirectionPayload(route.inboundRoute),
    scheduleConfig: {
      ...route.scheduleConfig,
      holidaySchedule: '',
      frequencyMinutes: Number(route.scheduleConfig.frequencyMinutes),
    },
    fareConfig: {
      ...route.fareConfig,
      baseFare: Number(route.fareConfig.baseFare),
      studentFare: Number(route.fareConfig.studentFare),
      childFare: Number(route.fareConfig.childFare),
      monthlyPassFare: Number(route.fareConfig.monthlyPassFare),
      luggageFee: Number(route.fareConfig.luggageFee),
    },
    vehicleAssignment: {
      ...route.vehicleAssignment,
      capacity: Number(route.vehicleAssignment.capacity),
      assignedBuses: route.vehicleAssignment.assignedBuses.map((bus) => ({
        busId: bus.busId || bus._id,
        busCode: bus.busCode,
        plateNumber: bus.plateNumber,
        busType: bus.busType,
        capacity: Number(bus.capacity || 0),
      })),
      assignedDrivers: route.vehicleAssignment.assignedDrivers.map((driver) => ({
        userId: driver.userId || driver._id,
        fullName: driver.fullName,
        role: driver.role,
        shiftLabel: driver.shiftLabel || '',
      })),
      assistantStaff: route.vehicleAssignment.assistantStaff.map((staff) => ({
        userId: staff.userId || staff._id,
        fullName: staff.fullName,
        role: staff.role,
        shiftLabel: staff.shiftLabel || '',
      })),
    },
  };
};

const pickApiMessage = (error, fallback) => {
  return error?.message
    || error?.response?.data?.message
    || fallback;
};

const Modal = ({ open, title, description, children, actions, onClose }) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#0f1d1f] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-white">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-400 hover:text-white"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
        <div className="mt-5">{children}</div>
        <div className="mt-6 flex justify-end gap-3">{actions}</div>
      </div>
    </div>
  );
};

const Toast = ({ toast, onClose }) => {
  if (!toast.open) {
    return null;
  }

  const toneClassName = toast.tone === 'error'
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : toast.tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  return (
    <div className="fixed right-6 top-24 z-[130] w-full max-w-sm">
      <button
        type="button"
        onClick={onClose}
        className={`w-full rounded-2xl border px-4 py-3 text-left shadow-lg ${toneClassName}`}
      >
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-xl">
            {toast.tone === 'error' ? 'error' : toast.tone === 'warning' ? 'warning' : 'task_alt'}
          </span>
          <div>
            <p className="text-sm font-bold">{toast.title}</p>
            <p className="mt-1 text-sm opacity-90">{toast.message}</p>
          </div>
        </div>
      </button>
    </div>
  );
};

const DirectionTabs = ({ activeDirection, isDarkMode, onChange }) => (
  <div className="flex flex-wrap gap-3">
    {directionTabs.map((direction) => (
      <button
        key={direction.key}
        type="button"
        onClick={() => onChange(direction.key)}
        className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
          activeDirection === direction.key
            ? direction.accent === 'emerald'
              ? 'bg-[linear-gradient(135deg,#34d399,#10b981)] text-slate-950'
              : 'bg-[linear-gradient(135deg,#67e8f9,#22d3ee)] text-slate-950'
            : isDarkMode
              ? 'border border-white/8 bg-white/[0.03] text-slate-300'
              : 'border border-slate-200 bg-white text-slate-700'
        }`}
      >
        {direction.label}
      </button>
    ))}
  </div>
);

const StationCatalogPanel = ({
  elevatedClassName,
  filteredStations,
  inputClassName,
  isDarkMode,
  isSyncingStops,
  onCreateManualStation,
  onSearchChange,
  onSourceChange,
  onSyncStops,
  panelMutedClassName,
  stationSearch,
  stationSourceFilter,
  stationSources,
  stationSyncSummary,
  stations,
  subtleCopyClassName,
  titleClassName,
}) => (
  <div className={`mt-5 rounded-[24px] border p-4 ${isDarkMode ? 'border-white/8 bg-white/[0.03]' : 'border-slate-200 bg-slate-50/80'}`}>
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <h3 className={`text-lg font-bold ${titleClassName}`}>DanaBus station catalog</h3>
        <p className={`mt-1 text-sm ${subtleCopyClassName}`}>
          Chọn stop đã import từ DanaBus để gắn vào chiều tuyến hiện tại. Import/sync sẽ ghi vào kho trạm dùng chung của Route Control.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onSyncStops}
          disabled={isSyncingStops}
          className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#34d399,#22d3ee)] px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-lg">{isSyncingStops ? 'progress_activity' : 'sync'}</span>
          {isSyncingStops ? 'Syncing DanaBus' : 'Sync DanaBus stops'}
        </button>
        <button
          type="button"
          onClick={onCreateManualStation}
          className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold ${inputClassName}`}
        >
          <span className="material-symbols-outlined text-lg">add_location_alt</span>
          Manual station
        </button>
      </div>
    </div>

    {stationSyncSummary ? (
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-5">
        {[
          ['Fetched', stationSyncSummary.totalFetched],
          ['Created', stationSyncSummary.created],
          ['Updated', stationSyncSummary.updated],
          ['Skipped', stationSyncSummary.skipped],
          ['Errors', stationSyncSummary.errors?.length || 0],
        ].map(([label, value]) => (
          <div key={label} className={`rounded-2xl border p-3 ${elevatedClassName}`}>
            <p className={`text-[10px] uppercase tracking-[0.2em] ${panelMutedClassName}`}>{label}</p>
            <p className={`mt-1 text-xl font-black ${titleClassName}`}>{value || 0}</p>
          </div>
        ))}
      </div>
    ) : null}

    <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
      <label className="block">
        <span className={`mb-2 block text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>Tìm stop</span>
        <input
          value={stationSearch}
          onChange={(event) => onSearchChange(event.target.value)}
          className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${inputClassName}`}
          placeholder="Tên stop, địa chỉ, phường/quận..."
        />
      </label>
      <label className="block">
        <span className={`mb-2 block text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>Nguồn</span>
        <select
          value={stationSourceFilter}
          onChange={(event) => onSourceChange(event.target.value)}
          className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${inputClassName}`}
        >
          <option value="ALL" className="text-slate-900">Tất cả nguồn</option>
          {stationSources.map((source) => (
            <option key={source} value={source} className="text-slate-900">{source}</option>
          ))}
        </select>
      </label>
      <div className={`rounded-2xl border px-4 py-3 text-sm ${elevatedClassName}`}>
        <p className={`text-[10px] uppercase tracking-[0.2em] ${panelMutedClassName}`}>Catalog</p>
        <p className={`mt-1 font-black ${titleClassName}`}>{filteredStations.length}/{stations.length} trạm</p>
      </div>
    </div>
  </div>
);

const DirectionEndpointPicker = ({
  activeDirection,
  inputClassName,
  onStationChange,
  panelMutedClassName,
  selectedDirection,
  stationSelectOptions,
}) => (
  <div className="mt-5 grid gap-4 md:grid-cols-2">
    {[
      ['startStation', 'Trạm bắt đầu'],
      ['endStation', 'Trạm kết thúc'],
    ].map(([stationRole, label]) => (
      <label key={stationRole} className="block">
        <span className={`mb-2 block text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>{label}</span>
        <select
          value={selectedDirection[stationRole]?.stationId || ''}
          onChange={(event) => onStationChange(activeDirection, stationRole, event.target.value)}
          className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${inputClassName}`}
        >
          <option value="" className="text-slate-900">Chọn trạm</option>
          {stationSelectOptions.map((station) => (
            <option key={station._id} value={station._id} className="text-slate-900">
              {station.stationName} {station.district ? `- ${station.district}` : ''}
            </option>
          ))}
        </select>
      </label>
    ))}
  </div>
);

const DirectionStopEditor = ({
  activeDirection,
  dragState,
  inputClassName,
  isDarkMode,
  onAddManualStop,
  onAddSuggestedStops,
  onDragStart,
  onDragStop,
  onRemoveStop,
  onReorderStop,
  onStopChange,
  panelMutedClassName,
  selectedDirection,
  suggestedStops,
  subtleCopyClassName,
  titleClassName,
}) => (
  <>
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className={`text-lg font-bold ${titleClassName}`}>Điểm dừng theo chiều</h3>
        <p className={`mt-1 text-sm ${subtleCopyClassName}`}>
          Kéo thả để sắp xếp lại. Bấm mốc bản đồ hoặc trạm gần đây để thêm điểm dừng nhanh.
        </p>
      </div>
      <button
        type="button"
        onClick={() => onAddManualStop(activeDirection)}
        className="rounded-2xl bg-[linear-gradient(135deg,#34d399,#22d3ee)] px-4 py-2 text-sm font-bold text-slate-950"
      >
        Add Stop
      </button>
    </div>

    <div className={`mt-4 rounded-[24px] border p-4 ${isDarkMode ? 'border-cyan-300/15 bg-cyan-300/[0.04]' : 'border-cyan-100 bg-cyan-50/70'}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className={`text-sm font-black uppercase tracking-[0.22em] ${titleClassName}`}>Gợi ý trạm đi qua</h4>
          <p className={`mt-2 text-sm leading-6 ${subtleCopyClassName}`}>
            Dựa trên hành lang giữa trạm bắt đầu và trạm kết thúc của chiều hiện tại.
          </p>
        </div>
        <button
          type="button"
          disabled={!suggestedStops.length}
          onClick={() => onAddSuggestedStops(activeDirection, suggestedStops)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">playlist_add</span>
          Add all
        </button>
      </div>

      <div className="mt-4 grid gap-2">
        {suggestedStops.length ? suggestedStops.map((station, index) => (
          <button
            key={station._id}
            type="button"
            onClick={() => onAddSuggestedStops(activeDirection, [station])}
            className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left ${
              isDarkMode ? 'border-white/8 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]' : 'border-slate-200 bg-white text-slate-700 hover:bg-white'
            }`}
          >
            <div className="min-w-0">
              <p className={`truncate text-sm font-bold ${titleClassName}`}>{index + 1}. {station.stationName}</p>
              <p className={`mt-1 truncate text-xs ${subtleCopyClassName}`}>
                {station.address || `${station.ward || ''} ${station.district || ''}`}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-xs font-bold uppercase tracking-[0.18em] ${panelMutedClassName}`}>
                {(station.corridorDistanceKm || 0).toFixed(2)} km
              </p>
              <p className={`mt-1 text-xs ${panelMutedClassName}`}>{Math.round((station.corridorProgress || 0) * 100)}%</p>
            </div>
          </button>
        )) : (
          <div className={`rounded-2xl border border-dashed p-4 text-sm ${isDarkMode ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
            Chọn đủ trạm bắt đầu và trạm kết thúc để xem gợi ý.
          </div>
        )}
      </div>
    </div>

    <div className="mt-4 space-y-3">
      {selectedDirection.orderedStops.map((stop, index) => (
        <div
          key={`${activeDirection}-${index}-${stop.stopName || 'stop'}`}
          draggable
          onDragStart={() => onDragStart({ directionKey: activeDirection, index })}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (dragState?.directionKey === activeDirection) {
              onReorderStop(activeDirection, dragState.index, index);
              onDragStop(null);
            }
          }}
          className={`rounded-[24px] border p-4 ${isDarkMode ? 'border-white/8 bg-white/[0.03]' : 'border-slate-200 bg-slate-50/90'}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onReorderStop(activeDirection, index, Math.max(0, index - 1))}
                className={`rounded-xl border p-2 ${inputClassName}`}
              >
                <span className="material-symbols-outlined text-lg">north</span>
              </button>
              <button
                type="button"
                onClick={() => onReorderStop(activeDirection, index, Math.min(selectedDirection.orderedStops.length - 1, index + 1))}
                className={`rounded-xl border p-2 ${inputClassName}`}
              >
                <span className="material-symbols-outlined text-lg">south</span>
              </button>
              <div>
                <p className={`text-sm font-bold ${titleClassName}`}>Stop {index + 1}</p>
                <p className={`text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>Drag to reorder</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRemoveStop(activeDirection, index)}
              className="rounded-2xl bg-rose-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.24em] text-rose-500"
            >
              Remove
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              ['stopName', 'Tên điểm dừng', 'text'],
              ['address', 'Địa chỉ', 'text'],
              ['latitude', 'Vĩ độ', 'text'],
              ['longitude', 'Kinh độ', 'text'],
              ['arrivalOffsetMinutes', 'Thời gian đến sau (phút)', 'number'],
              ['departureOffsetMinutes', 'Thời gian rời sau (phút)', 'number'],
            ].map(([field, label, type]) => (
              <label key={field} className="block">
                <span className={`mb-2 block text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>{label}</span>
                <input
                  type={type}
                  min={type === 'number' ? '0' : undefined}
                  value={stop[field]}
                  onChange={(event) => onStopChange(activeDirection, index, field, event.target.value)}
                  className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${inputClassName}`}
                />
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  </>
);

const createMapMarkerIcon = ({ active = false, tone = 'station' } = {}) => {
  const toneClass = tone === 'route' ? 'route-control-map-marker-route' : 'route-control-map-marker-station';
  return L.divIcon({
    className: '',
    html: `
      <div class="route-control-map-marker ${toneClass} ${active ? 'route-control-map-marker-active' : ''}">
        <span class="material-symbols-outlined">${tone === 'route' ? 'pin_drop' : 'directions_bus'}</span>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 27],
    popupAnchor: [0, -24],
  });
};

const RouteLeafletMap = ({
  activeDirection,
  buses,
  isDarkMode,
  mapStationPoints,
  onAddStationStop,
  routeForm,
  routePreviewPoints,
}) => {
  const mapElementRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const layerRef = React.useRef(null);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return undefined;
    }

    const map = L.map(mapElementRef.current, {
      center: DA_NANG_CENTER,
      zoom: 12,
      zoomControl: false,
      scrollWheelZoom: true,
      maxBounds: DA_NANG_BOUNDS,
      maxBoundsViscosity: 1,
      minZoom: 10,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    map.fitBounds(DA_NANG_BOUNDS, { padding: [20, 20] });

    const resizeMap = () => {
      map.invalidateSize();
      if (!map.getBounds().intersects(DA_NANG_BOUNDS)) {
        map.fitBounds(DA_NANG_BOUNDS, { padding: [20, 20] });
      }
    };

    window.setTimeout(resizeMap, 80);
    window.setTimeout(resizeMap, 300);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layerRef.current) {
      return;
    }

    const layer = layerRef.current;
    const bounds = [];
    layer.clearLayers();

    L.rectangle(DA_NANG_BOUNDS, {
      color: '#14b8a6',
      weight: 1,
      opacity: 0.45,
      fillOpacity: 0,
      dashArray: '6 8',
    }).addTo(layer);

    directionTabs.forEach((direction) => {
      const points = (routePreviewPoints[direction.key] || [])
        .map((point) => [Number(point.latitude), Number(point.longitude)])
        .filter(([latitude, longitude]) => isInsideDaNangBounds(latitude, longitude));

      if (points.length >= 2) {
        L.polyline(points, {
          color: direction.key === 'outboundRoute' ? '#10b981' : '#06b6d4',
          weight: 5,
          opacity: 0.9,
        }).addTo(layer);
        bounds.push(...points);
      }
    });

    mapStationPoints.stationPoints.forEach((station) => {
      const latitude = Number(station.latitude);
      const longitude = Number(station.longitude);
      if (!isInsideDaNangBounds(latitude, longitude)) {
        return;
      }

      const isActiveMarker = routeForm[activeDirection].orderedStops.some(
        (stop) => stop.stationId && stop.stationId === station._id
      );
      const marker = L.marker([latitude, longitude], {
        icon: createMapMarkerIcon({ active: isActiveMarker, tone: 'station' }),
        title: station.stationName,
      });

      marker.bindPopup(`
        <div class="route-control-map-popup">
          <strong>${station.stationName || ''}</strong>
          <p>${station.address || ''}</p>
          <small>${station.stationCode || station.source || ''}</small>
        </div>
      `);
      marker.on('click', () => onAddStationStop(activeDirection, station));
      marker.addTo(layer);
      bounds.push([latitude, longitude]);
    });

    [...routeForm.outboundRoute.orderedStops, ...routeForm.inboundRoute.orderedStops].forEach((stop) => {
      const latitude = Number(stop.latitude);
      const longitude = Number(stop.longitude);
      if (!isInsideDaNangBounds(latitude, longitude)) {
        return;
      }

      L.marker([latitude, longitude], {
        icon: createMapMarkerIcon({ active: true, tone: 'route' }),
        title: stop.stopName,
      }).addTo(layer);
      bounds.push([latitude, longitude]);
    });

    buses
      .filter((bus) => Number.isFinite(Number(bus.currentLatitude)) && Number.isFinite(Number(bus.currentLongitude)))
      .filter((bus) => isInsideDaNangBounds(bus.currentLatitude, bus.currentLongitude))
      .slice(0, 6)
      .forEach((bus) => {
        L.circleMarker([Number(bus.currentLatitude), Number(bus.currentLongitude)], {
          radius: 7,
          color: '#f59e0b',
          fillColor: '#f59e0b',
          fillOpacity: 0.9,
          weight: 2,
        }).bindTooltip(bus.busCode || bus.plateNumber || 'Bus').addTo(layer);
      });

    if (bounds.length > 1) {
      mapRef.current.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
    } else if (bounds.length === 1) {
      mapRef.current.setView(bounds[0], 15);
    } else {
      mapRef.current.fitBounds(DA_NANG_BOUNDS, { padding: [20, 20] });
    }

    window.setTimeout(() => mapRef.current?.invalidateSize(), 50);
    window.setTimeout(() => mapRef.current?.invalidateSize(), 250);
  }, [activeDirection, buses, mapStationPoints.stationPoints, onAddStationStop, routeForm, routePreviewPoints]);

  return (
    <div className={`relative h-[540px] w-full ${isDarkMode ? 'bg-[#071416]' : 'bg-slate-100'}`}>
      <div ref={mapElementRef} className="h-full w-full" />
      <style>{`
        .route-control-map-marker {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border: 2px solid #fff;
          border-radius: 999px;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.25);
        }
        .route-control-map-marker-station {
          background: #34d399;
          color: #052e24;
        }
        .route-control-map-marker-route {
          background: #22d3ee;
          color: #083344;
        }
        .route-control-map-marker-active {
          background: #facc15;
          transform: scale(1.12);
        }
        .route-control-map-marker .material-symbols-outlined {
          font-size: 17px;
          font-variation-settings: 'FILL' 1, 'wght' 700, 'GRAD' 0, 'opsz' 24;
        }
        .route-control-map-popup strong {
          display: block;
          color: #0f172a;
          font-size: 14px;
        }
        .route-control-map-popup p {
          margin: 6px 0;
          color: #475569;
          font-size: 12px;
          line-height: 1.4;
        }
        .route-control-map-popup small {
          color: #059669;
          font-weight: 800;
        }
      `}</style>
    </div>
  );
};

const RouteControlPage = () => {
  const { isDarkMode } = useTheme();
  const [activeDirection, setActiveDirection] = useState('outboundRoute');
  const [routeForm, setRouteForm] = useState(createEmptyRoute());
  const [routeList, setRouteList] = useState([]);
  const [routeSummary, setRouteSummary] = useState(defaultRouteSummary);
  const [routeFilters, setRouteFilters] = useState({
    search: '',
    origin: '',
    destination: '',
    status: 'ALL',
  });
  const [stations, setStations] = useState([]);
  const [stationSearch, setStationSearch] = useState('');
  const [stationSourceFilter, setStationSourceFilter] = useState('ALL');
  const [stationSyncSummary, setStationSyncSummary] = useState(null);
  const [isSyncingStops, setIsSyncingStops] = useState(false);
  const [buses, setBuses] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [assistantStaff, setAssistantStaff] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState('');
  const [dragState, setDragState] = useState(null);
  const [toast, setToast] = useState({ open: false, title: '', message: '', tone: 'success' });
  const [stationModalOpen, setStationModalOpen] = useState(false);
  const [stationForm, setStationForm] = useState({
    stationCode: '',
    stationName: '',
    address: '',
    latitude: '',
    longitude: '',
    city: 'Da Nang',
    zone: '',
    isMainStation: false,
  });
  const [stationErrors, setStationErrors] = useState({});

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [routesResponse, stationsResponse, busesResponse, driversResponse] = await Promise.all([
          adminService.getRoutes(routeFilters.status === 'ALL' && !routeFilters.search && !routeFilters.origin && !routeFilters.destination
            ? {}
            : routeFilters),
          adminService.getStations({ limit: 1000 }),
          adminService.getBuses(),
          adminService.getDrivers(),
        ]);

        setRouteList(routesResponse.routes || []);
        setRouteSummary(routesResponse.summary || defaultRouteSummary);
        setStations(stationsResponse.stations || []);
        setBuses(busesResponse.buses || []);
        setDrivers(driversResponse.drivers || []);
        setAssistantStaff(driversResponse.assistantStaff || []);
      } catch (loadError) {
        setError(pickApiMessage(loadError, 'Không thể tải dữ liệu điều hành tuyến.'));
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [routeFilters]);

  useEffect(() => {
    if (!error.includes('/api/admin/routes not found')) {
      return undefined;
    }

    const retry = window.setTimeout(() => {
      setError('');
      setRouteFilters((current) => ({ ...current }));
    }, 600);

    return () => window.clearTimeout(retry);
  }, [error]);

  useEffect(() => {
    if (!toast.open) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setToast((current) => ({ ...current, open: false }));
    }, 3200);

    return () => window.clearTimeout(timeout);
  }, [toast.open]);

  const shellClassName = isDarkMode ? 'bg-[#071516] text-slate-100' : 'bg-[#f4fbfd] text-slate-900';
  const ambientBackgroundClassName = isDarkMode
    ? 'bg-[radial-gradient(circle_at_12%_14%,rgba(74,222,128,0.16),transparent_22%),radial-gradient(circle_at_82%_18%,rgba(34,211,238,0.12),transparent_20%),radial-gradient(circle_at_68%_72%,rgba(59,130,246,0.10),transparent_24%),linear-gradient(180deg,#071516_0%,#0b1b1d_38%,#102427_100%)]'
    : 'bg-[radial-gradient(circle_at_12%_14%,rgba(45,212,191,0.12),transparent_18%),radial-gradient(circle_at_84%_18%,rgba(56,189,248,0.14),transparent_18%),linear-gradient(180deg,#f8fdff_0%,#edf7fb_46%,#e8f2f7_100%)]';
  const gridOverlayClassName = isDarkMode
    ? 'opacity-35 [background-image:linear-gradient(rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.07)_1px,transparent_1px)]'
    : 'opacity-25 [background-image:linear-gradient(rgba(148,163,184,0.11)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.11)_1px,transparent_1px)]';
  const sectionClassName = isDarkMode
    ? 'border-white/8 bg-white/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.18)]'
    : 'border-slate-200/90 bg-white/95 shadow-[0_20px_44px_rgba(148,163,184,0.14)]';
  const elevatedClassName = isDarkMode
    ? 'border-white/8 bg-[#0f1d1f]/90'
    : 'border-slate-200 bg-white';
  const inputClassName = isDarkMode
    ? 'border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500'
    : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400';
  const subtleCopyClassName = isDarkMode ? 'text-slate-400' : 'text-slate-600';
  const titleClassName = isDarkMode ? 'text-white' : 'text-slate-950';
  const panelMutedClassName = isDarkMode ? 'text-slate-500' : 'text-slate-500';

  const routeValidation = useMemo(() => deriveValidation(routeForm), [routeForm]);

  const outboundSnapshot = useMemo(() => computeDirectionSnapshot(routeForm.outboundRoute), [routeForm.outboundRoute]);
  const inboundSnapshot = useMemo(() => computeDirectionSnapshot(routeForm.inboundRoute), [routeForm.inboundRoute]);

  const routeAnalytics = useMemo(() => {
    const totalStops = routeForm.outboundRoute.orderedStops.length + routeForm.inboundRoute.orderedStops.length;
    const estimatedDistanceKm = Number((outboundSnapshot.estimatedDistanceKm + inboundSnapshot.estimatedDistanceKm).toFixed(1));
    const estimatedDurationMinutes = outboundSnapshot.estimatedDurationMinutes + inboundSnapshot.estimatedDurationMinutes;
    const firstDeparture = parseClockToMinutes(routeForm.scheduleConfig.firstDepartureTime);
    const lastDeparture = parseClockToMinutes(routeForm.scheduleConfig.lastDepartureTime);
    const frequency = Number(routeForm.scheduleConfig.frequencyMinutes || 0);
    const dailyTripsEstimate = firstDeparture !== null && lastDeparture !== null && frequency > 0 && firstDeparture < lastDeparture
      ? Math.floor((lastDeparture - firstDeparture) / frequency) + 1
      : 0;
    const estimatedCapacityPerDay = dailyTripsEstimate * Number(routeForm.vehicleAssignment.capacity || 0);
    const averageStopDistance = totalStops > 2 ? estimatedDistanceKm / Math.max(totalStops - 2, 1) : 0;
    const congestionRisk = averageStopDistance === 0 ? 'Chưa đủ dữ liệu' : averageStopDistance < 1.1 ? 'Mật độ hành lang cao' : averageStopDistance < 2.4 ? 'Rủi ro giao thông trung bình' : 'Hành lang thông thoáng';
    const optimizationInsights = [];

    if (routeValidation.errors.length) {
      optimizationInsights.push('Cần xử lý các lỗi kiểm tra trước khi công bố vận hành.');
    }
    if (averageStopDistance > 0 && averageStopDistance < 0.8) {
      optimizationInsights.push('Mật độ điểm dừng cao; cân nhắc gộp các trạm gần nhau để tăng tốc độ khai thác.');
    }
    if (dailyTripsEstimate > 0 && estimatedCapacityPerDay < 1000) {
      optimizationInsights.push('Sức chứa dự kiến dưới 1.000 lượt/ngày; cần kiểm tra phân bổ đội xe so với nhu cầu.');
    }
    if (!routeForm.vehicleAssignment.assignedDrivers.length) {
      optimizationInsights.push('Phân công ít nhất một tài xế chính để có thể điều phối tuyến ngay.');
    }
    if (!optimizationInsights.length) {
      optimizationInsights.push('Hình học tuyến và lịch chạy đã cân bằng cho bước rà soát tuyến trục đô thị.');
    }

    return {
      totalStops,
      estimatedDistanceKm,
      estimatedDurationMinutes,
      dailyTripsEstimate,
      estimatedCapacityPerDay,
      congestionRisk,
      averageStopDistance: Number(averageStopDistance.toFixed(2)),
      optimizationInsights,
    };
  }, [inboundSnapshot, outboundSnapshot, routeForm, routeValidation.errors.length]);

  const filteredStations = useMemo(() => {
    const query = normalizeSearchText(stationSearch);

    return stations.filter((station) => {
      const matchesSource = stationSourceFilter === 'ALL' || station.source === stationSourceFilter;
      if (!matchesSource) {
        return false;
      }
      if (!query) {
        return true;
      }

      return [
        station.stationCode,
        station.stationName,
        station.address,
        station.district,
        station.ward,
      ].some((value) => normalizeSearchText(value).includes(query));
    });
  }, [stationSearch, stationSourceFilter, stations]);

  const stationSources = useMemo(() => (
    [...new Set(stations.map((station) => station.source).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right))
  ), [stations]);

  const stationSelectOptions = useMemo(() => {
    const selectedIds = [
      routeForm.outboundRoute.startStation?.stationId,
      routeForm.outboundRoute.endStation?.stationId,
      routeForm.inboundRoute.startStation?.stationId,
      routeForm.inboundRoute.endStation?.stationId,
    ].filter(Boolean);
    const optionMap = new Map(filteredStations.map((station) => [station._id, station]));

    selectedIds.forEach((stationId) => {
      const station = stations.find((entry) => entry._id === stationId);
      if (station) {
        optionMap.set(station._id, station);
      }
    });

    return [...optionMap.values()].sort((left, right) => (
      (left.stationName || '').localeCompare(right.stationName || '')
    ));
  }, [filteredStations, routeForm, stations]);

  const nearbyStations = useMemo(() => {
    const anchor = routeForm[activeDirection].startStation
      || routeForm[activeDirection].orderedStops.find((stop) => stop.latitude && stop.longitude);

    if (!anchor?.latitude || !anchor?.longitude) {
      return filteredStations.slice(0, 5);
    }

    return filteredStations
      .map((station) => ({
        ...station,
        distanceKm: haversineDistanceKm(anchor, station),
      }))
      .sort((left, right) => left.distanceKm - right.distanceKm)
      .slice(0, 5);
  }, [activeDirection, filteredStations, routeForm]);

  const selectedDirection = routeForm[activeDirection];
  const mapStationPoints = useMemo(() => {
    const routePoints = [];
    [routeForm.outboundRoute, routeForm.inboundRoute].forEach((direction) => {
      computeDirectionSnapshot(direction).polylinePath.forEach((point) => {
        if (Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude))) {
          routePoints.push({
            latitude: Number(point.latitude),
            longitude: Number(point.longitude),
          });
        }
      });
    });

    const activeSnapshot = computeDirectionSnapshot(routeForm[activeDirection]);
    const activePath = activeSnapshot.polylinePath?.length >= 2
      ? activeSnapshot.polylinePath
      : [
        routeForm[activeDirection].startStation,
        routeForm[activeDirection].endStation,
      ].filter(Boolean);
    const hasActiveCorridor = activePath.length >= 2;
    const selectedStationIds = new Set(
      routeForm[activeDirection].orderedStops.map((stop) => stop.stationId).filter(Boolean)
    );

    const stationPoints = filteredStations
      .filter((station) => Number.isFinite(Number(station.latitude)) && Number.isFinite(Number(station.longitude)))
      .map((station) => {
        const projection = hasActiveCorridor ? projectPointToPath(station, activePath) : null;
        return {
          ...station,
          corridorDistanceKm: projection?.distanceKm,
          corridorProgress: projection?.progress,
        };
      })
      .filter((station) => {
        if (stationSearch.trim()) {
          return true;
        }

        return !hasActiveCorridor
          || selectedStationIds.has(station._id)
          || (
            station.corridorDistanceKm !== undefined
            && station.corridorDistanceKm <= 0.35
            && station.corridorProgress > 0.01
            && station.corridorProgress < 0.99
          );
      })
      .sort((left, right) => (
        Number(left.corridorDistanceKm ?? Number.MAX_SAFE_INTEGER)
        - Number(right.corridorDistanceKm ?? Number.MAX_SAFE_INTEGER)
      ))
      .slice(0, stationSearch.trim() ? 500 : 300)
      .map((station) => ({
        ...station,
        latitude: Number(station.latitude),
        longitude: Number(station.longitude),
      }));

    return { routePoints, stationPoints };
  }, [activeDirection, filteredStations, routeForm, stationSearch]);

  const routePreviewPoints = useMemo(() => ({
    outboundRoute: outboundSnapshot.polylinePath,
    inboundRoute: inboundSnapshot.polylinePath,
  }), [inboundSnapshot.polylinePath, outboundSnapshot.polylinePath]);

  const suggestedStops = useMemo(() => buildSuggestedStops({
    direction: selectedDirection,
    stations: filteredStations,
  }), [filteredStations, selectedDirection]);

  const showToast = (title, message, tone = 'success') => {
    setToast({ open: true, title, message, tone });
  };

  const reloadStations = async () => {
    const stationsResponse = await adminService.getStations({ limit: 1000 });
    setStations(stationsResponse.stations || []);
  };

  const handleSyncDanaBusStops = async () => {
    setIsSyncingStops(true);
    setStationSyncSummary(null);

    try {
      const response = await adminService.syncDanaBusStops();
      setStationSyncSummary(response);
      await reloadStations();
      showToast(
        'Đã đồng bộ DanaBus',
        `Tải ${response.totalFetched || 0} stop, tạo ${response.created || 0}, cập nhật ${response.updated || 0}, bỏ qua ${response.skipped || 0}.`
      );
    } catch (syncError) {
      showToast('Đồng bộ DanaBus thất bại', pickApiMessage(syncError, 'Không thể lấy dữ liệu DanaBus/EcoBus.'), 'error');
    } finally {
      setIsSyncingStops(false);
    }
  };

  const refreshRoutes = async (nextRouteId = selectedRouteId) => {
    const routesResponse = await adminService.getRoutes(routeFilters.status === 'ALL' && !routeFilters.search && !routeFilters.origin && !routeFilters.destination
      ? {}
      : routeFilters);
    setRouteList(routesResponse.routes || []);
    setRouteSummary(routesResponse.summary || defaultRouteSummary);

    if (nextRouteId) {
      const routeDetail = await adminService.getRouteDetail(nextRouteId);
      setRouteForm(normalizeRouteRecord(routeDetail.route));
      setSelectedRouteId(nextRouteId);
    }
  };

  const handleBasicFieldChange = (field, value) => {
    setRouteForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateDirection = (directionKey, updater) => {
    setRouteForm((current) => {
      const nextDirection = typeof updater === 'function'
        ? updater(current[directionKey])
        : updater;
      return {
        ...current,
        [directionKey]: nextDirection,
      };
    });
  };

  const handleDirectionStationChange = (directionKey, stationRole, stationId) => {
    const station = stations.find((entry) => entry._id === stationId);
    updateDirection(directionKey, (currentDirection) => ({
      ...currentDirection,
      [stationRole]: station ? normalizeStationRef(station) : null,
    }));
  };

  const handleStopChange = (directionKey, index, field, value) => {
    updateDirection(directionKey, (currentDirection) => {
      const nextStops = currentDirection.orderedStops.map((stop, stopIndex) => (
        stopIndex === index
          ? { ...stop, [field]: value }
          : stop
      ));

      return {
        ...currentDirection,
        orderedStops: nextStops.map((stop, stopIndex) => ({ ...stop, stopOrder: stopIndex + 1 })),
      };
    });
  };

  const addManualStop = (directionKey) => {
    updateDirection(directionKey, (currentDirection) => ({
      ...currentDirection,
      orderedStops: [
        ...currentDirection.orderedStops,
        createEmptyStop(currentDirection.orderedStops.length + 1),
      ],
    }));
  };

  const addStationStop = (directionKey, station) => {
    if (!station) {
      return;
    }

    updateDirection(directionKey, (currentDirection) => {
      const stationKeys = buildStationIdentityKeys(station);
      const duplicateStop = currentDirection.orderedStops.some((stop) => (
        buildStationIdentityKeys(stop).some((key) => stationKeys.includes(key))
      ));
      if (duplicateStop) {
        showToast('Điểm dừng trùng', `${station.stationName} đã có trong chiều này.`, 'warning');
        return currentDirection;
      }

      const nextStop = {
        stationId: station._id,
        stopName: station.stationName,
        address: station.address,
        latitude: station.latitude,
        longitude: station.longitude,
        stopOrder: currentDirection.orderedStops.length + 1,
        arrivalOffsetMinutes: currentDirection.orderedStops.length * 6,
        departureOffsetMinutes: (currentDirection.orderedStops.length * 6) + 1,
        isMainStation: Boolean(station.isMainStation),
      };

      return {
        ...currentDirection,
        orderedStops: [...currentDirection.orderedStops, nextStop],
        startStation: currentDirection.startStation || normalizeStationRef(station),
        endStation: normalizeStationRef(station),
      };
    });
  };

  const addSuggestedStops = (directionKey, suggestedStations = []) => {
    const candidates = Array.isArray(suggestedStations) ? suggestedStations : [];

    if (!candidates.length) {
      return;
    }

    setRouteForm((current) => {
      const currentDirection = current[directionKey];
      const existingStationIds = new Set(
        currentDirection.orderedStops.map((stop) => stop.stationId).filter(Boolean)
      );
      const existingStationKeys = new Set(
        currentDirection.orderedStops.flatMap((stop) => buildStationIdentityKeys(stop))
      );
      const nextStops = [...currentDirection.orderedStops];

      candidates.forEach((station) => {
        const stationKeys = buildStationIdentityKeys(station);
        if (!station?._id || existingStationIds.has(station._id) || stationKeys.some((key) => existingStationKeys.has(key))) {
          return;
        }

        existingStationIds.add(station._id);
        stationKeys.forEach((key) => existingStationKeys.add(key));
        nextStops.push({
          stationId: station._id,
          stopName: station.stationName,
          address: station.address,
          latitude: station.latitude,
          longitude: station.longitude,
          stopOrder: nextStops.length + 1,
          arrivalOffsetMinutes: nextStops.length * 6,
          departureOffsetMinutes: (nextStops.length * 6) + 1,
          isMainStation: Boolean(station.isMainStation),
        });
      });

      return {
        ...current,
        [directionKey]: {
          ...currentDirection,
          orderedStops: nextStops.map((stop, index) => ({ ...stop, stopOrder: index + 1 })),
          startStation: currentDirection.startStation || normalizeStationRef(candidates[0]),
          endStation: currentDirection.endStation || normalizeStationRef(candidates[candidates.length - 1]),
        },
      };
    });

    showToast(
      'Đã thêm gợi ý',
      `Đã thêm ${candidates.length} trạm gợi ý vào ${directionTabs.find((direction) => direction.key === directionKey)?.label}.`
    );
  };

  const removeStop = (directionKey, index) => {
    updateDirection(directionKey, (currentDirection) => ({
      ...currentDirection,
      orderedStops: currentDirection.orderedStops
        .filter((_, stopIndex) => stopIndex !== index)
        .map((stop, stopIndex) => ({ ...stop, stopOrder: stopIndex + 1 })),
    }));
  };

  const reorderStops = (directionKey, fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
      return;
    }

    updateDirection(directionKey, (currentDirection) => {
      const nextStops = [...currentDirection.orderedStops];
      const [movedStop] = nextStops.splice(fromIndex, 1);
      nextStops.splice(toIndex, 0, movedStop);

      return {
        ...currentDirection,
        orderedStops: nextStops.map((stop, index) => ({ ...stop, stopOrder: index + 1 })),
      };
    });
  };

  const toggleOperatingDay = (day) => {
    setRouteForm((current) => {
      const exists = current.scheduleConfig.operatingDays.includes(day);
      return {
        ...current,
        scheduleConfig: {
          ...current.scheduleConfig,
          operatingDays: exists
            ? current.scheduleConfig.operatingDays.filter((item) => item !== day)
            : [...current.scheduleConfig.operatingDays, day],
        },
      };
    });
  };

  const toggleAssignedBus = (bus) => {
    setRouteForm((current) => {
      const exists = current.vehicleAssignment.assignedBuses.some((item) => (item.busId || item._id) === bus._id);
      const nextBuses = exists
        ? current.vehicleAssignment.assignedBuses.filter((item) => (item.busId || item._id) !== bus._id)
        : [
          ...current.vehicleAssignment.assignedBuses,
          {
            busId: bus._id,
            busCode: bus.busCode,
            plateNumber: bus.plateNumber,
            busType: bus.busType,
            capacity: bus.capacity,
          },
        ];

      const derivedCapacity = nextBuses.length
        ? Math.max(...nextBuses.map((item) => Number(item.capacity || 0)))
        : current.vehicleAssignment.capacity;

      return {
        ...current,
        vehicleAssignment: {
          ...current.vehicleAssignment,
          assignedBuses: nextBuses,
          capacity: derivedCapacity > 0 ? derivedCapacity : current.vehicleAssignment.capacity,
          busType: nextBuses[0]?.busType || current.vehicleAssignment.busType,
        },
      };
    });
  };

  const toggleAssignedDriver = (driver) => {
    setRouteForm((current) => {
      const exists = current.vehicleAssignment.assignedDrivers.some((item) => (item.userId || item._id) === driver._id);
      return {
        ...current,
        vehicleAssignment: {
          ...current.vehicleAssignment,
          assignedDrivers: exists
            ? current.vehicleAssignment.assignedDrivers.filter((item) => (item.userId || item._id) !== driver._id)
            : [
              ...current.vehicleAssignment.assignedDrivers,
              {
                userId: driver._id,
                fullName: driver.fullName,
                role: driver.role,
                shiftLabel: 'Primary dispatch',
              },
            ],
        },
      };
    });
  };

  const toggleAssistantStaff = (staff) => {
    setRouteForm((current) => {
      const exists = current.vehicleAssignment.assistantStaff.some((item) => (item.userId || item._id) === staff._id);
      return {
        ...current,
        vehicleAssignment: {
          ...current.vehicleAssignment,
          assistantStaff: exists
            ? current.vehicleAssignment.assistantStaff.filter((item) => (item.userId || item._id) !== staff._id)
            : [
              ...current.vehicleAssignment.assistantStaff,
              {
                userId: staff._id,
                fullName: staff.fullName,
                role: staff.role,
                shiftLabel: 'Customer support',
              },
            ],
        },
      };
    });
  };

  const handleSave = async (status) => {
    const payload = buildRoutePayload({
      ...routeForm,
      status,
    });

    setIsSaving(true);
    if (status === 'PUBLISHED') {
      setIsPublishing(true);
    }

    try {
      const response = selectedRouteId
        ? await adminService.updateRoute(selectedRouteId, payload)
        : await adminService.createRoute(payload);

      const savedRoute = normalizeRouteRecord(response.route);
      setRouteForm(savedRoute);
      setSelectedRouteId(savedRoute._id);
      await refreshRoutes(savedRoute._id);
      showToast(
        status === 'PUBLISHED' ? 'Đã công bố tuyến' : 'Đã lưu nháp',
        status === 'PUBLISHED'
          ? `${savedRoute.routeCode} is now live for operations.`
          : `${savedRoute.routeCode || 'Bản nháp tuyến'} đã được ${selectedRouteId ? 'cập nhật' : 'tạo'} thành công.`
      );
    } catch (saveError) {
      const validationErrors = saveError?.validation?.errors || saveError?.errors;
      showToast(
        status === 'PUBLISHED' ? 'Chưa thể công bố' : 'Lưu thất bại',
        Array.isArray(validationErrors) && validationErrors.length
          ? validationErrors[0]
          : pickApiMessage(saveError, 'Không thể lưu tuyến.'),
        'error'
      );
    } finally {
      setIsSaving(false);
      setIsPublishing(false);
    }
  };

  const handleDeleteRoute = async () => {
    if (!selectedRouteId) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await adminService.suspendRoute(selectedRouteId);
      const suspendedRoute = normalizeRouteRecord(response.route);
      setRouteForm(suspendedRoute);
      setSelectedRouteId(suspendedRoute._id);
      await refreshRoutes(suspendedRoute._id);
      showToast('Đã tạm dừng tuyến', 'Tuyến đã bị ẩn khỏi kết quả tìm kiếm hành khách.');
    } catch (deleteError) {
      showToast('Tạm dừng thất bại', pickApiMessage(deleteError, 'Không thể tạm dừng tuyến.'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const loadRouteForEditing = async (routeId) => {
    setIsSaving(true);
    try {
      const response = await adminService.getRouteDetail(routeId);
      setRouteForm(normalizeRouteRecord(response.route));
      setSelectedRouteId(routeId);
      setActiveDirection('outboundRoute');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (detailError) {
      showToast('Không thể tải tuyến', pickApiMessage(detailError, 'Không thể mở chi tiết tuyến.'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateStation = async () => {
    const errors = {};
    if (!stationForm.stationCode.trim()) {
      errors.stationCode = 'Bắt buộc nhập mã trạm';
    }
    if (!stationForm.stationName.trim()) {
      errors.stationName = 'Bắt buộc nhập tên trạm';
    }
    if (!stationForm.address.trim()) {
      errors.address = 'Bắt buộc nhập địa chỉ';
    }
    if (!Number.isFinite(Number(stationForm.latitude))) {
      errors.latitude = 'Bắt buộc nhập vĩ độ';
    }
    if (!Number.isFinite(Number(stationForm.longitude))) {
      errors.longitude = 'Bắt buộc nhập kinh độ';
    }

    if (Object.keys(errors).length) {
      setStationErrors(errors);
      return;
    }

    try {
      const response = await adminService.createStation({
        ...stationForm,
        latitude: Number(stationForm.latitude),
        longitude: Number(stationForm.longitude),
      });
      const createdStation = response.station;
      setStations((current) => [...current, createdStation].sort((left, right) => left.stationName.localeCompare(right.stationName)));
      setStationModalOpen(false);
      setStationErrors({});
      setStationForm({
        stationCode: '',
        stationName: '',
        address: '',
        latitude: '',
        longitude: '',
        city: 'Da Nang',
        zone: '',
        isMainStation: false,
      });
      showToast('Đã thêm trạm', `${createdStation?.stationName || stationForm.stationName} đã sẵn sàng để lập tuyến.`);
    } catch (stationError) {
      showToast('Lưu trạm thất bại', pickApiMessage(stationError, 'Không thể tạo trạm.'), 'error');
    }
  };

  const routeStatusTone = (status) => {
    if (status === 'PUBLISHED') {
      return isDarkMode ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700';
    }
    if (status === 'PENDING_APPROVAL') {
      return isDarkMode ? 'bg-amber-400/15 text-amber-200' : 'bg-amber-50 text-amber-700';
    }
    if (status === 'SUSPENDED') {
      return isDarkMode ? 'bg-rose-400/15 text-rose-300' : 'bg-rose-50 text-rose-700';
    }
    return isDarkMode ? 'bg-cyan-400/15 text-cyan-300' : 'bg-cyan-50 text-cyan-700';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Header forceDarkMode={isDarkMode} />
        <div className="px-6 pt-40 text-center">
          <p className="text-sm uppercase tracking-[0.32em] text-slate-500">Đang tải trung tâm điều hành tuyến</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen overflow-hidden ${shellClassName}`}>
      <Header forceDarkMode={isDarkMode} />
      <Toast toast={toast} onClose={() => setToast((current) => ({ ...current, open: false }))} />
      <Modal
        open={stationModalOpen}
        title="Tạo trạm"
        description="Register a new station so dispatch teams can use it in both outbound and inbound route builders."
        onClose={() => setStationModalOpen(false)}
        actions={(
          <>
            <button
              type="button"
              onClick={() => setStationModalOpen(false)}
              className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleCreateStation}
              className="rounded-2xl bg-[linear-gradient(135deg,#34d399,#22d3ee)] px-4 py-2 text-sm font-bold text-slate-950"
            >
              Lưu trạm
            </button>
          </>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ['stationCode', 'Mã trạm'],
            ['stationName', 'Tên trạm'],
            ['city', 'City'],
            ['zone', 'Zone'],
            ['latitude', 'Vĩ độ'],
            ['longitude', 'Kinh độ'],
          ].map(([key, label]) => (
            <label key={key} className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-500">{label}</span>
              <input
                value={stationForm[key]}
                onChange={(event) => setStationForm((current) => ({ ...current, [key]: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none"
              />
              {stationErrors[key] ? <span className="mt-1 block text-xs text-rose-300">{stationErrors[key]}</span> : null}
            </label>
          ))}
          <label className="md:col-span-2">
            <span className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-500">Địa chỉ</span>
            <input
              value={stationForm.address}
              onChange={(event) => setStationForm((current) => ({ ...current, address: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none"
            />
            {stationErrors.address ? <span className="mt-1 block text-xs text-rose-300">{stationErrors.address}</span> : null}
          </label>
          <label className="md:col-span-2 flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={stationForm.isMainStation}
              onChange={(event) => setStationForm((current) => ({ ...current, isMainStation: event.target.checked }))}
              className="rounded border-white/20 bg-white/[0.05]"
            />
            Mark as main station / terminal
          </label>
        </div>
      </Modal>

      <main className="relative min-h-screen pt-28">
        <style>{`
          .route-control-readable .bg-white,
          .route-control-readable .bg-slate-50 {
            color: #0f172a;
          }
          .route-control-readable .bg-white .text-white,
          .route-control-readable .bg-white .text-slate-100,
          .route-control-readable .bg-slate-50 .text-white,
          .route-control-readable .bg-slate-50 .text-slate-100 {
            color: #0f172a;
          }
        `}</style>
        <div className={`absolute inset-0 ${ambientBackgroundClassName}`} />
        <div className="pointer-events-none absolute inset-0">
          <img
            src={HOME_BUS_HERO_IMAGE}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover object-center"
            style={{ opacity: isDarkMode ? 0.55 : 0.22 }}
          />
          <div className={`absolute inset-0 ${isDarkMode ? 'bg-[#001a0f]/55' : 'bg-white/50'}`} />
        </div>
        <div className={`absolute inset-0 bg-[length:72px_72px] ${gridOverlayClassName}`} />
        <div className="route-control-readable relative mx-auto max-w-[1800px] px-4 pb-16 lg:px-6">
          <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className={`text-xs uppercase tracking-[0.34em] ${panelMutedClassName}`}>Operations Command</p>
              <h1 className={`mt-3 text-4xl font-black tracking-tight ${titleClassName}`}>Quản lý tuyến xe buýt</h1>
              <p className={`mt-3 max-w-3xl text-base leading-7 ${subtleCopyClassName}`}>
                Tạo và cập nhật tuyến xe buýt với điều khiển điểm dừng hai chiều, phân công điều phối, xem trước bản đồ,
                lịch chạy, giá vé và trạng thái vận hành.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setRouteForm(createEmptyRoute());
                setSelectedRouteId('');
                setActiveDirection('outboundRoute');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="rounded-2xl bg-[linear-gradient(135deg,#34d399,#22d3ee)] px-5 py-3 text-sm font-black text-slate-950"
            >
              Tạo tuyến mới
            </button>
          </div>

          {error ? (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,1.08fr)_380px]">
            <section className={`rounded-[30px] border p-5 ${sectionClassName}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className={`text-2xl font-black ${titleClassName}`}>Chỉnh sửa tuyến</h2>
                  <p className={`mt-2 text-sm leading-6 ${subtleCopyClassName}`}>
                    Tạo tuyến mới hoặc chọn một tuyến trong thư viện để cập nhật thông tin vận hành, hình học tuyến, lịch chạy, giá vé và nguồn lực.
                  </p>
                </div>
                <div className={`rounded-2xl px-3 py-2 text-xs font-bold uppercase tracking-[0.24em] ${routeStatusTone(routeForm.status)}`}>
                  {routeStatusLabels[routeForm.status] || routeForm.status}
                </div>
              </div>

              <div className="mt-6 space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className={`mb-2 block text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>Mã tuyến</span>
                    <input
                      value={routeForm.routeCode}
                      onChange={(event) => handleBasicFieldChange('routeCode', event.target.value)}
                      className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${inputClassName}`}
                      placeholder="e.g. VT-05"
                    />
                  </label>
                  <label className="block">
                    <span className={`mb-2 block text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>Tên tuyến</span>
                    <input
                      value={routeForm.routeName}
                      onChange={(event) => handleBasicFieldChange('routeName', event.target.value)}
                      className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${inputClassName}`}
                      placeholder="East River - Airport Connector"
                    />
                  </label>
                  <label className="block">
                    <span className={`mb-2 block text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>Đơn vị vận hành</span>
                    <input
                      value={routeForm.operator}
                      onChange={(event) => handleBasicFieldChange('operator', event.target.value)}
                      className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${inputClassName}`}
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <span className={`mb-2 block text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>Mô tả</span>
                    <textarea
                      value={routeForm.description}
                      onChange={(event) => handleBasicFieldChange('description', event.target.value)}
                      rows={3}
                      className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${inputClassName}`}
                      placeholder="Summarize corridor coverage, key demand centers, and deployment notes..."
                    />
                  </label>
                </div>

                <div className={`rounded-[28px] border p-4 ${elevatedClassName}`}>
                  <DirectionTabs
                    activeDirection={activeDirection}
                    isDarkMode={isDarkMode}
                    onChange={setActiveDirection}
                  />

                  <StationCatalogPanel
                    elevatedClassName={elevatedClassName}
                    filteredStations={filteredStations}
                    inputClassName={inputClassName}
                    isDarkMode={isDarkMode}
                    isSyncingStops={isSyncingStops}
                    onCreateManualStation={() => setStationModalOpen(true)}
                    onSearchChange={setStationSearch}
                    onSourceChange={setStationSourceFilter}
                    onSyncStops={handleSyncDanaBusStops}
                    panelMutedClassName={panelMutedClassName}
                    stationSearch={stationSearch}
                    stationSourceFilter={stationSourceFilter}
                    stationSources={stationSources}
                    stationSyncSummary={stationSyncSummary}
                    stations={stations}
                    subtleCopyClassName={subtleCopyClassName}
                    titleClassName={titleClassName}
                  />

                  <DirectionEndpointPicker
                    activeDirection={activeDirection}
                    inputClassName={inputClassName}
                    onStationChange={handleDirectionStationChange}
                    panelMutedClassName={panelMutedClassName}
                    selectedDirection={selectedDirection}
                    stationSelectOptions={stationSelectOptions}
                  />

                  <DirectionStopEditor
                    activeDirection={activeDirection}
                    dragState={dragState}
                    inputClassName={inputClassName}
                    isDarkMode={isDarkMode}
                    onAddManualStop={addManualStop}
                    onAddSuggestedStops={addSuggestedStops}
                    onDragStart={setDragState}
                    onDragStop={setDragState}
                    onRemoveStop={removeStop}
                    onReorderStop={reorderStops}
                    onStopChange={handleStopChange}
                    panelMutedClassName={panelMutedClassName}
                    selectedDirection={selectedDirection}
                    suggestedStops={suggestedStops}
                    subtleCopyClassName={subtleCopyClassName}
                    titleClassName={titleClassName}
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className={`rounded-[28px] border p-4 ${elevatedClassName}`}>
                    <h3 className={`text-lg font-bold ${titleClassName}`}>Quản lý lịch chạy</h3>
                    <div className="mt-4 grid gap-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="block">
                          <span className={`mb-2 block text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>Chuyến đầu</span>
                          <input
                            type="time"
                            value={routeForm.scheduleConfig.firstDepartureTime}
                            onChange={(event) => setRouteForm((current) => ({
                              ...current,
                              scheduleConfig: { ...current.scheduleConfig, firstDepartureTime: event.target.value },
                            }))}
                            className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${inputClassName}`}
                          />
                        </label>
                        <label className="block">
                          <span className={`mb-2 block text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>Chuyến cuối</span>
                          <input
                            type="time"
                            value={routeForm.scheduleConfig.lastDepartureTime}
                            onChange={(event) => setRouteForm((current) => ({
                              ...current,
                              scheduleConfig: { ...current.scheduleConfig, lastDepartureTime: event.target.value },
                            }))}
                            className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${inputClassName}`}
                          />
                        </label>
                      </div>
                      <label className="block">
                        <span className={`mb-2 block text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>Tần suất (phút)</span>
                        <input
                          type="number"
                          min="1"
                          value={routeForm.scheduleConfig.frequencyMinutes}
                          onChange={(event) => setRouteForm((current) => ({
                            ...current,
                            scheduleConfig: { ...current.scheduleConfig, frequencyMinutes: event.target.value },
                          }))}
                          className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${inputClassName}`}
                        />
                      </label>
                      <div>
                        <span className={`mb-2 block text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>Ngày hoạt động</span>
                        <div className="flex flex-wrap gap-2">
                          {operatingDayOptions.map((day) => {
                            const selected = routeForm.scheduleConfig.operatingDays.includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => toggleOperatingDay(day)}
                                className={`rounded-2xl px-3 py-2 text-xs font-bold uppercase tracking-[0.22em] ${
                                  selected
                                    ? 'bg-[linear-gradient(135deg,#34d399,#22d3ee)] text-slate-950'
                                    : isDarkMode
                                      ? 'border border-white/10 bg-white/[0.03] text-slate-400'
                                      : 'border border-slate-200 bg-white text-slate-600'
                                }`}
                              >
                                {operatingDayLabels[day] || day}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`rounded-[28px] border p-4 ${elevatedClassName}`}>
                    <h3 className={`text-lg font-bold ${titleClassName}`}>Quản lý giá vé</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {[
                        ['baseFare', 'Vé cơ bản'],
                        ['studentFare', 'Vé học sinh/sinh viên'],
                        ['childFare', 'Vé trẻ em'],
                        ['monthlyPassFare', 'Vé tháng'],
                        ['luggageFee', 'Phí hành lý'],
                      ].map(([field, label]) => (
                        <label key={field} className="block">
                          <span className={`mb-2 block text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>{label}</span>
                          <input
                            type="number"
                            min="0"
                            value={routeForm.fareConfig[field]}
                            onChange={(event) => setRouteForm((current) => ({
                              ...current,
                              fareConfig: { ...current.fareConfig, [field]: event.target.value },
                            }))}
                            className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${inputClassName}`}
                          />
                        </label>
                      ))}
                      <label className="block md:col-span-2">
                        <span className={`mb-2 block text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>Quy định miễn phí</span>
                        <textarea
                          rows={3}
                          value={routeForm.fareConfig.freeRideRules}
                          onChange={(event) => setRouteForm((current) => ({
                            ...current,
                            fareConfig: { ...current.fareConfig, freeRideRules: event.target.value },
                          }))}
                          className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${inputClassName}`}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className={`rounded-[28px] border p-4 ${elevatedClassName}`}>
                  <h3 className={`text-lg font-bold ${titleClassName}`}>Phân công xe & nhân sự</h3>
                  <div className="mt-4 grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className={`mb-2 block text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>Loại xe</span>
                        <input
                          value={routeForm.vehicleAssignment.busType}
                          onChange={(event) => setRouteForm((current) => ({
                            ...current,
                            vehicleAssignment: { ...current.vehicleAssignment, busType: event.target.value },
                          }))}
                          className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${inputClassName}`}
                        />
                      </label>
                      <label className="block">
                        <span className={`mb-2 block text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>Sức chứa</span>
                        <input
                          type="number"
                          min="1"
                          value={routeForm.vehicleAssignment.capacity}
                          onChange={(event) => setRouteForm((current) => ({
                            ...current,
                            vehicleAssignment: { ...current.vehicleAssignment, capacity: event.target.value },
                          }))}
                          className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${inputClassName}`}
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className={`mb-2 block text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>Lịch ca</span>
                      <textarea
                        rows={3}
                        value={routeForm.vehicleAssignment.shiftSchedule}
                        onChange={(event) => setRouteForm((current) => ({
                          ...current,
                          vehicleAssignment: { ...current.vehicleAssignment, shiftSchedule: event.target.value },
                        }))}
                        className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${inputClassName}`}
                      />
                    </label>

                    <div className="grid gap-4 xl:grid-cols-3">
                      <div className={`rounded-[24px] border p-4 ${isDarkMode ? 'border-white/8 bg-white/[0.03]' : 'border-slate-200 bg-slate-50/90'}`}>
                        <div className="flex items-center justify-between">
                          <h4 className={`text-sm font-bold uppercase tracking-[0.24em] ${titleClassName}`}>Xe đã phân công</h4>
                          <span className={`text-xs ${panelMutedClassName}`}>{routeForm.vehicleAssignment.assignedBuses.length} selected</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {buses.length ? buses.map((bus) => {
                            const selected = routeForm.vehicleAssignment.assignedBuses.some((item) => (item.busId || item._id) === bus._id);
                            return (
                              <button
                                key={bus._id}
                                type="button"
                                onClick={() => toggleAssignedBus(bus)}
                                className={`flex w-full items-start justify-between rounded-2xl border px-3 py-3 text-left ${
                                  selected
                                    ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                                    : isDarkMode
                                      ? 'border-white/8 bg-white/[0.03] text-slate-300'
                                      : 'border-slate-200 bg-white text-slate-700'
                                }`}
                              >
                                <div>
                                  <p className="text-sm font-semibold">{bus.busCode}</p>
                                  <p className="mt-1 text-xs opacity-80">{bus.busType} - {bus.capacity} ghế</p>
                                </div>
                                <span className="text-xs font-bold uppercase tracking-[0.2em]">{bus.status}</span>
                              </button>
                            );
                          }) : (
                            <p className={`text-sm ${subtleCopyClassName}`}>Chưa có xe buýt khả dụng. Hãy tạo dữ liệu đội xe ở backend để phân công phương tiện.</p>
                          )}
                        </div>
                      </div>

                      <div className={`rounded-[24px] border p-4 ${isDarkMode ? 'border-white/8 bg-white/[0.03]' : 'border-slate-200 bg-slate-50/90'}`}>
                        <div className="flex items-center justify-between">
                          <h4 className={`text-sm font-bold uppercase tracking-[0.24em] ${titleClassName}`}>Tài xế đã phân công</h4>
                          <span className={`text-xs ${panelMutedClassName}`}>{routeForm.vehicleAssignment.assignedDrivers.length} selected</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {drivers.length ? drivers.map((driver) => {
                            const selected = routeForm.vehicleAssignment.assignedDrivers.some((item) => (item.userId || item._id) === driver._id);
                            return (
                              <button
                                key={driver._id}
                                type="button"
                                onClick={() => toggleAssignedDriver(driver)}
                                className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left ${
                                  selected
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : isDarkMode
                                      ? 'border-white/8 bg-white/[0.03] text-slate-300'
                                      : 'border-slate-200 bg-white text-slate-700'
                                }`}
                              >
                                <div>
                                  <p className="text-sm font-semibold">{driver.fullName}</p>
                                  <p className="mt-1 text-xs opacity-80">{driver.email || driver.phone || 'Driver profile'}</p>
                                </div>
                                <span className="text-xs font-bold uppercase tracking-[0.2em]">{driver.role}</span>
                              </button>
                            );
                          }) : (
                            <p className={`text-sm ${subtleCopyClassName}`}>No active drivers available.</p>
                          )}
                        </div>
                      </div>

                      <div className={`rounded-[24px] border p-4 ${isDarkMode ? 'border-white/8 bg-white/[0.03]' : 'border-slate-200 bg-slate-50/90'}`}>
                        <div className="flex items-center justify-between">
                          <h4 className={`text-sm font-bold uppercase tracking-[0.24em] ${titleClassName}`}>Phụ xe hỗ trợ</h4>
                          <span className={`text-xs ${panelMutedClassName}`}>{routeForm.vehicleAssignment.assistantStaff.length} selected</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {assistantStaff.length ? assistantStaff.map((staff) => {
                            const selected = routeForm.vehicleAssignment.assistantStaff.some((item) => (item.userId || item._id) === staff._id);
                            return (
                              <button
                                key={staff._id}
                                type="button"
                                onClick={() => toggleAssistantStaff(staff)}
                                className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left ${
                                  selected
                                    ? 'border-violet-200 bg-violet-50 text-violet-700'
                                    : isDarkMode
                                      ? 'border-white/8 bg-white/[0.03] text-slate-300'
                                      : 'border-slate-200 bg-white text-slate-700'
                                }`}
                              >
                                <div>
                                  <p className="text-sm font-semibold">{staff.fullName}</p>
                                  <p className="mt-1 text-xs opacity-80">{staff.email || staff.phone || 'Support profile'}</p>
                                </div>
                                <span className="text-xs font-bold uppercase tracking-[0.2em]">{staff.role}</span>
                              </button>
                            );
                          }) : (
                            <p className={`text-sm ${subtleCopyClassName}`}>No assistant staff available.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSave('DRAFT')}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
                  >
                    Lưu nháp
                  </button>
                  <button
                    type="button"
                    disabled={isPublishing}
                    onClick={() => handleSave('PUBLISHED')}
                    className="rounded-2xl bg-[linear-gradient(135deg,#34d399,#22d3ee)] px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-60"
                  >
                    Công bố tuyến
                  </button>
                  {selectedRouteId ? (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleDeleteRoute}
                      className="rounded-2xl bg-[linear-gradient(135deg,#fb7185,#f97316)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                    >
                      Tạm dừng tuyến
                    </button>
                  ) : null}
                  {!selectedRouteId ? (
                    <p className={`flex items-center text-sm ${subtleCopyClassName}`}>
                      Nhập thông tin tuyến mới rồi lưu nháp hoặc công bố.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className={`mt-6 rounded-[28px] border p-4 ${elevatedClassName}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`text-lg font-bold ${titleClassName}`}>Thư viện tuyến đã công bố</h3>
                    <p className={`mt-1 text-sm ${subtleCopyClassName}`}>Lookup routes by code, corridor, or Danabus-style origin/destination pairing.</p>
                  </div>
                  <span className={`text-sm ${panelMutedClassName}`}>{routeSummary.totalRoutes} total</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <input
                    value={routeFilters.search}
                    onChange={(event) => setRouteFilters((current) => ({ ...current, search: event.target.value }))}
                    placeholder="Tìm mã hoặc tên tuyến"
                    className={`rounded-2xl border px-4 py-3 text-sm outline-none ${inputClassName}`}
                  />
                  <input
                    value={routeFilters.origin}
                    onChange={(event) => setRouteFilters((current) => ({ ...current, origin: event.target.value }))}
                    placeholder="Trạm điểm đi"
                    className={`rounded-2xl border px-4 py-3 text-sm outline-none ${inputClassName}`}
                  />
                  <input
                    value={routeFilters.destination}
                    onChange={(event) => setRouteFilters((current) => ({ ...current, destination: event.target.value }))}
                    placeholder="Trạm điểm đến"
                    className={`rounded-2xl border px-4 py-3 text-sm outline-none ${inputClassName}`}
                  />
                  <select
                    value={routeFilters.status}
                    onChange={(event) => setRouteFilters((current) => ({ ...current, status: event.target.value }))}
                    className={`rounded-2xl border px-4 py-3 text-sm outline-none ${inputClassName}`}
                  >
                    <option value="ALL" className="text-slate-900">{routeStatusLabels.ALL}</option>
                    {routeStatusOptions.map((status) => (
                      <option key={status} value={status} className="text-slate-900">
                        {routeStatusLabels[status] || status}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 space-y-3">
                  {routeList.length ? routeList.map((route) => (
                    <button
                      key={route._id}
                      type="button"
                      onClick={() => loadRouteForEditing(route._id)}
                      className={`flex w-full flex-col gap-3 rounded-[24px] border p-4 text-left transition ${
                        selectedRouteId === route._id
                          ? 'border-cyan-200 bg-cyan-50 shadow-sm'
                          : isDarkMode
                            ? 'border-white/8 bg-white/[0.03] hover:bg-white/[0.05]'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className={`text-sm font-black ${titleClassName}`}>{route.routeCode} - {route.routeName}</p>
                          <p className={`mt-1 text-sm ${subtleCopyClassName}`}>
                            {route.outboundRoute?.startStation?.stopName || 'Chờ điểm đi'} {'->'} {route.outboundRoute?.endStation?.stopName || 'Chờ điểm đến'}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] ${routeStatusTone(route.status)}`}>
                          {routeStatusLabels[route.status] || route.status}
                        </span>
                      </div>
                      <div className="grid gap-2 text-xs sm:grid-cols-4">
                        <div>
                          <p className={panelMutedClassName}>Total stops</p>
                          <p className={`mt-1 font-bold ${titleClassName}`}>{route.analytics?.totalStops || 0}</p>
                        </div>
                        <div>
                          <p className={panelMutedClassName}>Quãng đường</p>
                          <p className={`mt-1 font-bold ${titleClassName}`}>{route.analytics?.estimatedDistanceKm || 0} km</p>
                        </div>
                        <div>
                          <p className={panelMutedClassName}>Thời lượng</p>
                          <p className={`mt-1 font-bold ${titleClassName}`}>{formatDuration(route.analytics?.estimatedDurationMinutes || 0)}</p>
                        </div>
                        <div>
                          <p className={panelMutedClassName}>Warnings</p>
                          <p className={`mt-1 font-bold ${titleClassName}`}>{route.validation?.warnings?.length || 0}</p>
                        </div>
                      </div>
                    </button>
                  )) : (
                    <div className={`rounded-[24px] border border-dashed p-6 text-center ${isDarkMode ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                      No routes matched the current lookup filters.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className={`rounded-[30px] border p-5 ${sectionClassName}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className={`text-2xl font-black ${titleClassName}`}>Xem trước bản đồ tương tác</h2>
                  <p className={`mt-2 text-sm leading-6 ${subtleCopyClassName}`}>
                    Bấm vào mốc trạm để thêm vào chiều tuyến hiện tại. Chiều đi dùng màu xanh lá, chiều về dùng màu cyan, xe đang hoạt động hiển thị màu vàng.
                  </p>
                </div>
                <div className={`rounded-2xl border px-4 py-3 text-sm ${elevatedClassName}`}>
                  <p className={`text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>Active Direction</p>
                  <p className={`mt-1 font-bold ${titleClassName}`}>{directionTabs.find((direction) => direction.key === activeDirection)?.label}</p>
                </div>
              </div>

              <div className={`mt-5 overflow-hidden rounded-[30px] border ${elevatedClassName}`}>
                <div className={`flex items-center justify-between border-b px-5 py-4 ${isDarkMode ? 'border-white/6 bg-white/[0.02]' : 'border-slate-200 bg-slate-50/80'}`}>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-emerald-500">Đường chiều đi</span>
                    <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-cyan-500">Đường chiều về</span>
                    <span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-amber-500">Xe buýt thời gian thực</span>
                  </div>
                  <span className={`text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>
                    {mapStationPoints.stationPoints.length} mốc hiển thị
                  </span>
                </div>

                <RouteLeafletMap
                  activeDirection={activeDirection}
                  buses={buses}
                  isDarkMode={isDarkMode}
                  mapStationPoints={mapStationPoints}
                  onAddStationStop={addStationStop}
                  routeForm={routeForm}
                  routePreviewPoints={routePreviewPoints}
                />
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className={`rounded-[28px] border p-4 ${elevatedClassName}`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`text-lg font-bold ${titleClassName}`}>Trạm gần đây</h3>
                    <span className={`text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>Bấm để thêm</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {nearbyStations.map((station) => (
                      <button
                        key={station._id}
                        type="button"
                        onClick={() => addStationStop(activeDirection, station)}
                        className={`flex w-full items-center justify-between rounded-[22px] border px-4 py-3 text-left ${isDarkMode ? 'border-white/8 bg-white/[0.03]' : 'border-slate-200 bg-slate-50/80'}`}
                      >
                        <div>
                          <p className={`text-sm font-semibold ${titleClassName}`}>{station.stationName}</p>
                          <p className={`mt-1 text-xs ${subtleCopyClassName}`}>{station.address}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-xs font-bold uppercase tracking-[0.2em] ${panelMutedClassName}`}>{station.stationCode}</p>
                          <p className={`mt-1 text-sm font-semibold ${titleClassName}`}>
                            {station.distanceKm !== undefined ? `${station.distanceKm.toFixed(2)} km` : 'Nút tuyến'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`rounded-[28px] border p-4 ${elevatedClassName}`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`text-lg font-bold ${titleClassName}`}>Xem trước tuyến trực tiếp</h3>
                    <span className={`text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>Tổng hợp bản đồ</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className={`rounded-[24px] border p-4 ${isDarkMode ? 'border-white/8 bg-white/[0.03]' : 'border-slate-200 bg-slate-50/80'}`}>
                      <p className={`text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>Chiều đi</p>
                      <p className={`mt-2 text-2xl font-black ${titleClassName}`}>{outboundSnapshot.estimatedDistanceKm} km</p>
                      <p className={`mt-1 text-sm ${subtleCopyClassName}`}>{formatDuration(outboundSnapshot.estimatedDurationMinutes)}</p>
                    </div>
                    <div className={`rounded-[24px] border p-4 ${isDarkMode ? 'border-white/8 bg-white/[0.03]' : 'border-slate-200 bg-slate-50/80'}`}>
                      <p className={`text-xs uppercase tracking-[0.24em] ${panelMutedClassName}`}>Chiều về</p>
                      <p className={`mt-2 text-2xl font-black ${titleClassName}`}>{inboundSnapshot.estimatedDistanceKm} km</p>
                      <p className={`mt-1 text-sm ${subtleCopyClassName}`}>{formatDuration(inboundSnapshot.estimatedDurationMinutes)}</p>
                    </div>
                  </div>
                  <div className={`mt-4 rounded-[24px] border p-4 ${isDarkMode ? 'border-amber-400/20 bg-amber-400/8' : 'border-amber-100 bg-amber-50/90'}`}>
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-xl text-amber-500">traffic</span>
                      <div>
                        <p className={`text-sm font-bold ${titleClassName}`}>Giám sát giao thông</p>
                        <p className={`mt-2 text-sm leading-6 ${subtleCopyClassName}`}>
                          Mật độ hành lang cho thấy <span className="font-bold text-amber-500">{routeAnalytics.congestionRisk}</span>.
                          {routeAnalytics.averageStopDistance > 0
                            ? ` Khoảng cách trung bình giữa các nút tuyến là ${routeAnalytics.averageStopDistance} km.`
                            : ' Thêm hình học tuyến để tính khoảng cách theo điều kiện giao thông.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <aside className="space-y-6">
              <section className={`rounded-[30px] border p-5 ${sectionClassName}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className={`text-2xl font-black ${titleClassName}`}>Phân tích vận hành</h2>
                    <p className={`mt-2 text-sm ${subtleCopyClassName}`}>Mức sẵn sàng tuyến, năng lực điều phối và các lỗi chặn công bố.</p>
                  </div>
                  <span className="material-symbols-outlined text-2xl text-cyan-500">analytics</span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {[
                    ['Tổng điểm dừng', routeAnalytics.totalStops],
                    ['Quãng đường', `${routeAnalytics.estimatedDistanceKm} km`],
                    ['Thời lượng', formatDuration(routeAnalytics.estimatedDurationMinutes)],
                    ['Chuyến/ngày', routeAnalytics.dailyTripsEstimate],
                    ['Sức chứa/ngày', routeAnalytics.estimatedCapacityPerDay],
                  ].map(([label, value]) => (
                    <div key={label} className={`rounded-[24px] border p-4 ${elevatedClassName}`}>
                      <p className={`text-[11px] uppercase tracking-[0.24em] ${panelMutedClassName}`}>{label}</p>
                      <p className={`mt-2 text-3xl font-black ${titleClassName}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className={`rounded-[30px] border p-5 ${sectionClassName}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className={`text-xl font-black ${titleClassName}`}>Tổng hợp kiểm tra</h2>
                    <p className={`mt-2 text-sm ${subtleCopyClassName}`}>Chỉ có thể công bố sau khi các kiểm tra vận hành bắt buộc đạt yêu cầu.</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] ${
                    routeValidation.canPublish ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {routeValidation.canPublish ? 'Sẵn sàng' : 'Bị chặn'}
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  <div className={`rounded-[24px] border p-4 ${routeValidation.errors.length ? 'border-rose-100 bg-rose-50/90' : 'border-emerald-100 bg-emerald-50/90'}`}>
                    <div className="flex items-center gap-3">
                      <span className={`material-symbols-outlined text-xl ${routeValidation.errors.length ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {routeValidation.errors.length ? 'warning' : 'task_alt'}
                      </span>
                      <div>
                        <p className={`text-sm font-bold ${titleClassName}`}>Lỗi nghiêm trọng chặn công bố</p>
                        <p className={`text-sm ${subtleCopyClassName}`}>{routeValidation.errors.length} vấn đề được phát hiện</p>
                      </div>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {routeValidation.errors.length ? routeValidation.errors.map((item) => (
                        <li key={item} className="text-sm text-rose-700">{item}</li>
                      )) : (
                        <li className="text-sm text-emerald-700">Không có lỗi chặn. Tuyến có thể công bố ngay.</li>
                      )}
                    </ul>
                  </div>

                  <div className={`rounded-[24px] border p-4 ${routeValidation.warnings.length ? 'border-amber-100 bg-amber-50/90' : 'border-slate-200 bg-white'}`}>
                    <p className={`text-sm font-bold ${titleClassName}`}>Cảnh báo & nhắc nhở thông minh</p>
                    <ul className="mt-3 space-y-2">
                      {routeValidation.warnings.length ? routeValidation.warnings.map((item) => (
                        <li key={item} className="text-sm text-amber-700">{item}</li>
                      )) : (
                        <li className={`text-sm ${subtleCopyClassName}`}>Không có cảnh báo vận hành.</li>
                      )}
                    </ul>
                  </div>
                </div>
              </section>

              <section className={`rounded-[30px] border p-5 ${sectionClassName}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className={`text-xl font-black ${titleClassName}`}>Gợi ý tối ưu</h2>
                    <p className={`mt-2 text-sm ${subtleCopyClassName}`}>Gợi ý dựa trên khoảng cách, mật độ lịch chạy và nguồn lực đã phân công.</p>
                  </div>
                  <span className="material-symbols-outlined text-2xl text-emerald-500">auto_awesome</span>
                </div>
                <div className="mt-4 space-y-3">
                  {routeAnalytics.optimizationInsights.map((insight) => (
                    <div key={insight} className={`rounded-[24px] border p-4 ${elevatedClassName}`}>
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-xl text-emerald-500">tips_and_updates</span>
                        <p className={`text-sm leading-6 ${subtleCopyClassName}`}>{insight}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className={`rounded-[30px] border p-5 ${sectionClassName}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className={`text-xl font-black ${titleClassName}`}>Tổng quan giá vé & điều phối</h2>
                    <p className={`mt-2 text-sm ${subtleCopyClassName}`}>Kiểm tra nhanh trước khi đưa vào vận hành.</p>
                  </div>
                  <span className="material-symbols-outlined text-2xl text-cyan-500">account_balance_wallet</span>
                </div>
                <div className="mt-4 grid gap-3">
                  <div className={`rounded-[24px] border p-4 ${elevatedClassName}`}>
                    <p className={`text-[11px] uppercase tracking-[0.24em] ${panelMutedClassName}`}>Vé cơ bản</p>
                    <p className={`mt-2 text-3xl font-black ${titleClassName}`}>{formatCurrency(routeForm.fareConfig.baseFare)} VND</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div className={`rounded-[24px] border p-4 ${elevatedClassName}`}>
                      <p className={`text-[11px] uppercase tracking-[0.24em] ${panelMutedClassName}`}>Xe đã phân công</p>
                      <p className={`mt-2 text-2xl font-black ${titleClassName}`}>{routeForm.vehicleAssignment.assignedBuses.length}</p>
                    </div>
                    <div className={`rounded-[24px] border p-4 ${elevatedClassName}`}>
                      <p className={`text-[11px] uppercase tracking-[0.24em] ${panelMutedClassName}`}>Tài xế đã phân công</p>
                      <p className={`mt-2 text-2xl font-black ${titleClassName}`}>{routeForm.vehicleAssignment.assignedDrivers.length}</p>
                    </div>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RouteControlPage;


