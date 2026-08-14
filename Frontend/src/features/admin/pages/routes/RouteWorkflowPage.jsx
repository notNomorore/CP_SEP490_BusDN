import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import toast from 'react-hot-toast';
import 'leaflet/dist/leaflet.css';
import { HOME_BUS_HERO_IMAGE } from '../../../../shared/constants/images.js';
import useTheme from '../../../../shared/hooks/useTheme.js';
import adminService from '../../services/adminService.js';
import CreateRouteStep from './CreateRouteStep.jsx';
import DefinePathStep from './DefinePathStep.jsx';
import ReviewRouteStep from './ReviewRouteStep.jsx';
import TripAllocationPanel from './TripAllocationPanel.jsx';
import { DA_NANG_BOUNDS, DA_NANG_CENTER, FIRST_BUS_DEPARTURE_TIME, LAST_BUS_DEPARTURE_TIME, computeDirection, isInsideDaNang, normalizeRouteFromApi, routeStatusLabels } from './routeWorkflowUtils.js';
import { useRouteWorkflowStore } from './routeWorkflowStore.js';

const steps = [
  { label: 'Tạo tuyến', hint: 'Thông tin cơ bản' },
  { label: 'Dựng lộ trình', hint: 'Trạm + bản đồ' },
  { label: 'Rà soát & kích hoạt', hint: 'Kiểm tra dữ liệu' },
];

const operationSections = [
  { key: 'routes', label: 'Vận hành tuyến', hint: 'Tạo, cập nhật, tạm dừng và dựng lộ trình' },
  { key: 'stops', label: 'Quản lý trạm dừng', hint: 'Tạo, cập nhật và gán trạm vào tuyến' },
  { key: 'trip-planning', label: 'Phân chuyến', hint: 'Quyết định số chuyến sáng, trưa và chiều' },
  { key: 'trip-assignment', label: 'Phân bổ chuyến', hint: 'Gán ca nhân sự và xe vào các chuyến đã lập' },
  { key: 'scheduling', label: 'Lịch chuyến', hint: 'Tạo và chỉnh sửa chuyến đã lập' },
];

const busStatusLabels = {
  AVAILABLE: 'Sẵn sàng',
  ACTIVE: 'Đang hoạt động',
  ISSUE: 'Gặp sự cố',
  MAINTENANCE: 'Đang bảo trì',
};
const BUS_CAPACITY_MIN = 15;
const BUS_CAPACITY_MAX = 25;
const ASSIGNABLE_BUS_STATUSES = new Set(['AVAILABLE', 'ACTIVE', 'RESERVE']);

const busStatusOverview = {
  AVAILABLE: {
    icon: 'check_circle',
    accentClassName: 'bg-cyan-100 text-cyan-700',
    barClassName: 'bg-cyan-400',
  },
  ACTIVE: {
    icon: 'directions_bus',
    accentClassName: 'bg-emerald-100 text-emerald-700',
    barClassName: 'bg-emerald-400',
  },
  ISSUE: {
    icon: 'warning',
    accentClassName: 'bg-rose-100 text-rose-700',
    barClassName: 'bg-rose-400',
  },
  MAINTENANCE: {
    icon: 'build',
    accentClassName: 'bg-amber-100 text-amber-700',
    barClassName: 'bg-amber-400',
  },
};

const emptyStopForm = {
  _id: '',
  stationCode: '',
  stationName: '',
  address: '',
  latitude: '',
  longitude: '',
  district: '',
  ward: '',
  isMainStation: false,
};

const emptyBusForm = {
  busCode: '',
  plateNumber: '',
  busType: 'Standard City Bus',
  capacity: BUS_CAPACITY_MIN,
  status: 'AVAILABLE',
};

const WarningModal = ({ open, message, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
      <button type="button" aria-label="Close warning modal" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div className="relative w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <span className="material-symbols-outlined text-3xl">warning</span>
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-black text-slate-950">Cảnh báo</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-rose-700"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
};

const toDateInputValue = (date = new Date()) => {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const createEmptyScheduleForm = () => ({
  scheduleCode: '',
  serviceDate: toDateInputValue(),
  routeId: '',
  direction: 'OUTBOUND',
  departureTime: '05:30',
  expectedArrivalTime: '',
  shiftLabel: '',
  status: 'PLANNED',
  busId: '',
  driverId: '',
  assistantId: '',
  isScheduleException: false,
  exceptionReason: '',
});

const scheduleStatusLabels = {
  PLANNED: 'Đã lập lịch',
  ASSIGNED: 'Đã phân công',
  IN_PROGRESS: 'Đang chạy',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

const scheduleDirectionLabels = {
  OUTBOUND: 'Chiều đi',
  INBOUND: 'Chiều về',
};

const scheduleShiftLabels = {
  MORNING: 'Ca sáng',
  MIDDAY: 'Ca trưa',
  AFTERNOON: 'Ca chiều',
};
const addDateDays = (value, days) => {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
};

const parseClockToMinutes = (value = '') => {
  const match = String(value).match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return (hours * 60) + minutes;
};

const toMinutes = (value = '') => parseClockToMinutes(value);

const addMinutesToClock = (clock, minutesToAdd = 0) => {
  const base = parseClockToMinutes(clock);
  if (base === null) return '';
  const total = Math.max(0, Math.min(1439, base + Number(minutesToAdd || 0)));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const routeScheduleWeekdayTokens = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getManualScheduleMismatch = (route, serviceDate, departureTime) => {
  if (!route || !serviceDate) return '';
  const [year, month, day] = serviceDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return '';
  const operatingDays = route.scheduleConfig?.operatingDays || [];
  if (operatingDays.length && !operatingDays.includes(routeScheduleWeekdayTokens[date.getDay()])) {
    return 'Ngày phục vụ không thuộc ngày hoạt động đã cấu hình của tuyến.';
  }
  const departure = parseClockToMinutes(departureTime);
  const first = parseClockToMinutes(FIRST_BUS_DEPARTURE_TIME);
  const last = parseClockToMinutes(LAST_BUS_DEPARTURE_TIME);
  if (departure !== null && first !== null && last !== null && (departure < first || departure > last)) {
    return `Giờ xuất bến nằm ngoài khung ${FIRST_BUS_DEPARTURE_TIME}-${LAST_BUS_DEPARTURE_TIME}.`;
  }
  return '';
};

const getScheduleHardLimitError = (departureTime) => {
  const departure = parseClockToMinutes(departureTime);
  const firstAllowed = parseClockToMinutes(FIRST_BUS_DEPARTURE_TIME);
  const lastAllowed = parseClockToMinutes(LAST_BUS_DEPARTURE_TIME);
  if (departure !== null && departure < firstAllowed) {
    return 'Xe buýt bắt đầu xuất bến từ 05:30. Không thể tạo chuyến sớm hơn.';
  }
  if (departure !== null && departure > lastAllowed) {
    return 'Xe buýt chỉ xuất bến đến 18:30. Không thể tạo chuyến sau thời điểm này.';
  }
  return '';
};

const formatMinutesToClock = (minutes) => {
  if (!Number.isFinite(minutes)) return '';
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
  const mins = String(normalized % 60).padStart(2, '0');
  return `${hours}:${mins}`;
};

const getRouteDurationMinutes = (route, direction) => {
  if (!route) return 0;
  const routeDirection = direction === 'INBOUND' ? route.inboundRoute : route.outboundRoute;
  return Math.max(0, Number(computeDirection(routeDirection).estimatedDurationMinutes || 0));
};

const isSameDateInputValue = (value, dateInputValue) => (
  Boolean(value && dateInputValue) && toDateInputValue(value) === dateInputValue
);

const isTimeRangeInsideShift = ({ departureTime, expectedArrivalTime }, shift) => {
  const departure = parseClockToMinutes(departureTime);
  const arrival = parseClockToMinutes(expectedArrivalTime);
  const shiftStart = parseClockToMinutes(shift?.startTime);
  const shiftEnd = parseClockToMinutes(shift?.endTime);
  return [departure, arrival, shiftStart, shiftEnd].every((value) => value !== null)
    && departure < arrival
    && departure >= shiftStart
    && arrival <= shiftEnd;
};

const ASSIGNABLE_SHIFT_STATUSES = new Set(['ACTIVE', 'APPROVED', 'PUBLISHED']);
const MAX_DAILY_STAFF_WORK_MINUTES = 8 * 60;
const MIN_RESOURCE_BUFFER_MINUTES = 10;

const hasEligibleShiftAssignment = (resourceId, assignments, form, resourceKey) => assignments.some((assignment) => {
  const assignedResource = assignment?.[resourceKey];
  const assignedResourceId = typeof assignedResource === 'object' ? assignedResource?._id : assignedResource;
  return String(assignedResourceId || '') === String(resourceId || '')
    && ['ASSIGNED', 'IN_PROGRESS'].includes(assignment?.status)
    && isSameDateInputValue(assignment?.workDate, form.serviceDate)
    && ASSIGNABLE_SHIFT_STATUSES.has(assignment?.shiftId?.status)
    && isTimeRangeInsideShift(form, assignment.shiftId);
});

const getAssignmentId = (assignment, assignmentKey) => {
  const value = assignment?.[assignmentKey]?.[assignmentKey === 'vehicle' ? 'busId' : 'userId'];
  return typeof value === 'object' && value !== null ? value._id : value;
};

const getTripWorkMinutes = (schedule) => {
  const start = parseClockToMinutes(schedule.departureTime);
  const end = parseClockToMinutes(schedule.expectedArrivalTime || schedule.departureTime);
  return start !== null && end !== null && end > start ? end - start : 0;
};

const hasDailyStaffWorkloadCapacity = (resourceId, schedules, assignmentKey, form, excludeScheduleId = '') => {
  if (!resourceId || !form.serviceDate || !form.departureTime || !form.expectedArrivalTime) return true;
  const newTripMinutes = getTripWorkMinutes(form);
  if (!newTripMinutes) return true;
  const assignedMinutes = schedules
    .filter((schedule) => (
      String(schedule._id || '') !== String(excludeScheduleId || '')
      && schedule.status !== 'CANCELLED'
      && isSameDateInputValue(schedule.serviceDate, form.serviceDate)
      && String(getAssignmentId(schedule, assignmentKey) || '') === String(resourceId || '')
    ))
    .reduce((total, schedule) => total + getTripWorkMinutes(schedule), 0);
  return assignedMinutes + newTripMinutes <= MAX_DAILY_STAFF_WORK_MINUTES;
};

const isAssignableBus = (bus) => ASSIGNABLE_BUS_STATUSES.has(bus?.status);

const determineScheduleStatus = ({ busId, driverId, assistantId }, currentStatus = 'PLANNED') => {
  if (['IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(currentStatus)) return currentStatus;
  return busId && driverId && assistantId ? 'ASSIGNED' : 'PLANNED';
};

const isScheduleDeleteLocked = (schedule) => ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(schedule?.status);

const scheduleTimeRangesOverlap = (first, second) => {
  const firstStart = parseClockToMinutes(first.departureTime);
  const firstEnd = parseClockToMinutes(first.expectedArrivalTime || first.departureTime);
  const secondStart = parseClockToMinutes(second.departureTime);
  const secondEnd = parseClockToMinutes(second.expectedArrivalTime || second.departureTime);
  if ([firstStart, firstEnd, secondStart, secondEnd].some((value) => value === null)) return false;
  return firstStart < secondEnd && secondStart < firstEnd;
};

const buildScheduleCode = ({ departureTime, direction, route, serviceDate }) => {
  if (!route?.routeCode || !serviceDate || !departureTime) return '';
  const dateToken = serviceDate.replace(/-/g, '').slice(2);
  const timeToken = departureTime.replace(':', '');
  const directionToken = direction === 'INBOUND' ? 'V' : 'D';
  return `${route.routeCode}-${dateToken}-${timeToken}-${directionToken}`.toUpperCase();
};

const normalizeStationSearch = (value = '') => String(value)
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd');

const stopMarkerIcon = (selected = false) => L.divIcon({
  className: '',
  html: `<div class="stop-map-marker ${selected ? 'stop-map-marker-selected' : ''}"><span class="material-symbols-outlined">directions_bus</span></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 28],
  popupAnchor: [0, -24],
});

const draftStopMarkerIcon = () => L.divIcon({
  className: '',
  html: '<div class="stop-map-marker stop-map-marker-draft"><span class="material-symbols-outlined">add_location</span></div>',
  iconSize: [34, 34],
  iconAnchor: [17, 31],
  popupAnchor: [0, -28],
});

const StopMapPicker = ({
  form,
  onPickLocation,
  onPickStation,
  stations,
}) => {
  const elementRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const pickLocationRef = useRef(onPickLocation);
  const pickStationRef = useRef(onPickStation);

  useEffect(() => {
    pickLocationRef.current = onPickLocation;
    pickStationRef.current = onPickStation;
  }, [onPickLocation, onPickStation]);

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return undefined;

    const map = L.map(elementRef.current, {
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

    map.on('click', (event) => {
      if (isInsideDaNang(event.latlng.lat, event.latlng.lng)) {
        pickLocationRef.current(event.latlng);
      }
    });

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    map.fitBounds(DA_NANG_BOUNDS, { padding: [20, 20] });

    window.setTimeout(() => map.invalidateSize(), 80);
    window.setTimeout(() => map.invalidateSize(), 300);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;

    const layer = layerRef.current;
    layer.clearLayers();

    L.rectangle(DA_NANG_BOUNDS, {
      color: '#14b8a6',
      weight: 1,
      opacity: 0.45,
      fillOpacity: 0,
      dashArray: '6 8',
    }).addTo(layer);

    stations
      .filter((station) => isInsideDaNang(station.latitude, station.longitude))
      .slice(0, 160)
      .forEach((station) => {
        const isSelected = String(station._id || '') === String(form._id || '');
        const marker = L.marker([Number(station.latitude), Number(station.longitude)], {
          icon: stopMarkerIcon(isSelected),
          title: station.stationName,
        });
        marker.bindPopup(`<strong>${station.stationName || ''}</strong><br/>${station.address || ''}<br/><small>Bấm marker để lấy nhanh thông tin trạm</small>`);
        marker.on('click', () => pickStationRef.current(station));
        marker.addTo(layer);
      });

    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (isInsideDaNang(latitude, longitude)) {
      L.marker([latitude, longitude], {
        icon: draftStopMarkerIcon(),
        draggable: true,
        title: form.stationName || 'Vị trí trạm đang chỉnh',
      })
        .on('dragend', (event) => {
          const { lat, lng } = event.target.getLatLng();
          if (isInsideDaNang(lat, lng)) pickLocationRef.current({ lat, lng });
        })
        .addTo(layer);
      mapRef.current.setView([latitude, longitude], Math.max(mapRef.current.getZoom(), 18));
    }

    window.setTimeout(() => mapRef.current?.invalidateSize(), 80);
  }, [form._id, form.latitude, form.longitude, form.stationName, stations]);

  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
      <div ref={elementRef} className="h-[460px] w-full" />
      <div className="pointer-events-none absolute bottom-4 left-4 z-[500] max-w-[260px] rounded-lg border border-slate-200/70 bg-white/90 px-3 py-2 text-xs font-semibold leading-5 text-slate-700 shadow-md backdrop-blur">
        Bấm bản đồ để lấy tọa độ. Kéo marker xanh để chỉnh vị trí trạm.
      </div>
      <style>{`
        .stop-map-marker {
          align-items: center;
          background: #22d3ee;
          border: 2px solid #fff;
          border-radius: 999px;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.25);
          color: #083344;
          display: flex;
          height: 24px;
          justify-content: center;
          width: 24px;
        }
        .stop-map-marker-draft {
          background: #34d399;
          color: #052e24;
          height: 34px;
          width: 34px;
        }
        .stop-map-marker-selected {
          box-shadow: 0 0 0 8px rgba(20,184,166,0.18), 0 10px 24px rgba(15, 23, 42, 0.25);
          transform: scale(1.12);
        }
        .stop-map-marker .material-symbols-outlined {
          font-size: 18px;
          font-variation-settings: 'FILL' 1, 'wght' 800, 'GRAD' 0, 'opsz' 24;
        }
      `}</style>
    </div>
  );
};

const getScheduleRoute = (schedule, routes) => routes.find((route) => String(route._id) === String(schedule?.routeId));

const getScheduleDirection = (schedule, routes) => {
  const route = getScheduleRoute(schedule, routes);
  if (!route) return { route: null, direction: null, stops: [], path: [], duration: 0, distance: 0 };
  const direction = computeDirection(schedule?.direction === 'INBOUND' ? route.inboundRoute : route.outboundRoute);
  const stops = direction.orderedStops || [];
  const path = Array.isArray(direction.polylinePath) && direction.polylinePath.length >= 2
    ? direction.polylinePath
    : stops;

  return {
    route,
    direction,
    stops,
    path,
    duration: Number(direction.estimatedDurationMinutes || 0),
    distance: Number(direction.estimatedDistanceKm || 0),
  };
};

const ScheduleRouteMap = ({ schedule, routes }) => {
  const elementRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const routeDetail = useMemo(() => getScheduleDirection(schedule, routes), [routes, schedule]);

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return undefined;

    const map = L.map(elementRef.current, {
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

    window.setTimeout(() => map.invalidateSize(), 80);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;
    const layer = layerRef.current;
    layer.clearLayers();

    const path = routeDetail.path
      .map((point) => [Number(point.latitude), Number(point.longitude)])
      .filter(([latitude, longitude]) => isInsideDaNang(latitude, longitude));

    if (path.length >= 2) {
      L.polyline(path, {
        color: routeDetail.route?.routeColor || '#10b981',
        opacity: 0.92,
        weight: 5,
      }).addTo(layer);
    }

    routeDetail.stops
      .filter((stop) => isInsideDaNang(stop.latitude, stop.longitude))
      .forEach((stop, index) => {
        const marker = L.marker([Number(stop.latitude), Number(stop.longitude)], {
          icon: stopMarkerIcon(index === 0 || index === routeDetail.stops.length - 1),
          title: stop.stopName,
        });
        marker.bindPopup(`<strong>${index + 1}. ${stop.stopName || ''}</strong><br/>${stop.address || ''}`);
        marker.addTo(layer);
      });

    const boundsPoints = path.length >= 2
      ? path
      : routeDetail.stops
        .map((stop) => [Number(stop.latitude), Number(stop.longitude)])
        .filter(([latitude, longitude]) => isInsideDaNang(latitude, longitude));

    if (boundsPoints.length >= 2) {
      mapRef.current.fitBounds(boundsPoints, { padding: [28, 28] });
    } else {
      mapRef.current.fitBounds(DA_NANG_BOUNDS, { padding: [20, 20] });
    }

    window.setTimeout(() => mapRef.current?.invalidateSize(), 80);
  }, [routeDetail]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
      <div ref={elementRef} className="h-[360px] w-full" />
      {!schedule ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70 p-6 text-center text-sm font-semibold text-slate-500">
          Chọn một lịch chuyến để xem lộ trình.
        </div>
      ) : null}
    </div>
  );
};

const ScheduleListPanel = ({ onDeleteSchedule, onEditSchedule, onEmergencyReassign, onSelectSchedule, routes, schedules, selectedScheduleId }) => {
  const [serviceDateFilter, setServiceDateFilter] = useState('');
  const filteredSchedules = useMemo(() => (
    serviceDateFilter
      ? schedules.filter((schedule) => isSameDateInputValue(schedule.serviceDate, serviceDateFilter))
      : schedules
  ), [schedules, serviceDateFilter]);

  useEffect(() => {
    if (!serviceDateFilter || !selectedScheduleId) return;
    const selectedIsVisible = filteredSchedules.some((schedule) => (
      String(schedule._id || '') === String(selectedScheduleId)
    ));
    if (!selectedIsVisible) onSelectSchedule(filteredSchedules[0] || null);
  }, [filteredSchedules, onSelectSchedule, selectedScheduleId, serviceDateFilter]);

  return (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h2 className="text-lg font-black text-slate-950">Danh sách lịch chuyến</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">Xem, chỉnh sửa hoặc xóa từng lịch chuyến đã điều phối.</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label>
          <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Lọc theo ngày</span>
          <input
            type="date"
            value={serviceDateFilter}
            onChange={(event) => setServiceDateFilter(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <button
          type="button"
          onClick={() => setServiceDateFilter(toDateInputValue())}
          className="h-10 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 hover:bg-emerald-100"
        >
          Hôm nay
        </button>
        {serviceDateFilter ? (
          <button
            type="button"
            onClick={() => setServiceDateFilter('')}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Tất cả ngày
          </button>
        ) : null}
        <span className="h-10 rounded-full bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700">
          {filteredSchedules.length}{serviceDateFilter ? ` / ${schedules.length}` : ''} lịch
        </span>
      </div>
    </div>
    <div className="mt-4 max-h-[560px] overflow-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[1320px] border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
          <tr>
            {['Mã lịch', 'Tuyến', 'Ngày', 'Thời gian', 'Ca', 'Chiều', 'Xe', 'Tài xế', 'Phụ xe', 'Trạng thái', 'Ghi chú', 'Thao tác'].map((label) => (
              <th key={label} className="border-b border-slate-200 px-3 py-3 font-black uppercase">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredSchedules.map((schedule) => {
            const route = getScheduleRoute(schedule, routes);
            const isSelected = String(schedule._id || '') === String(selectedScheduleId || '');
            const vehicle = schedule.vehicle?.busId || {};
            const driver = schedule.driver?.userId || {};
            const assistant = schedule.assistant?.userId || {};
            return (
              <tr key={schedule._id} onClick={() => onSelectSchedule(schedule)} className={`cursor-pointer border-b border-slate-100 align-top transition ${isSelected ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                <td className="px-3 py-3 font-black text-slate-900">{schedule.scheduleCode}</td>
                <td className="px-3 py-3"><span className="block font-bold">{route?.routeCode || schedule.routeCode || '-'}</span><span className="mt-1 block max-w-56 text-slate-500">{route?.routeName || schedule.routeName || '-'}</span></td>
                <td className="px-3 py-3 whitespace-nowrap">{toDateInputValue(schedule.serviceDate)}</td>
                <td className="px-3 py-3 whitespace-nowrap font-bold">{schedule.departureTime || '--:--'} - {schedule.expectedArrivalTime || '--:--'}</td>
                <td className="px-3 py-3 whitespace-nowrap">{scheduleShiftLabels[schedule.shiftLabel] || (parseClockToMinutes(schedule.departureTime) < 720 ? 'Ca sáng' : 'Ca chiều')}</td>
                <td className="px-3 py-3 whitespace-nowrap">{scheduleDirectionLabels[schedule.direction] || schedule.direction}</td>
                <td className="px-3 py-3"><span className="block font-bold">{schedule.vehicle?.busCode || vehicle.busCode || 'Chưa gán'}</span><span className="mt-1 block text-slate-500">{schedule.vehicle?.plateNumber || vehicle.plateNumber || ''}</span></td>
                <td className="px-3 py-3"><span className="block font-bold">{schedule.driver?.fullName || driver.fullName || 'Chưa gán'}</span><span className="mt-1 block text-slate-500">{schedule.driver?.phone || driver.phoneNumber || ''}</span></td>
                <td className="px-3 py-3"><span className="block font-bold">{schedule.assistant?.fullName || assistant.fullName || 'Chưa gán'}</span><span className="mt-1 block text-slate-500">{schedule.assistant?.phone || assistant.phoneNumber || ''}</span></td>
                <td className="px-3 py-3 whitespace-nowrap"><span className="rounded-full bg-slate-100 px-2 py-1 font-bold">{scheduleStatusLabels[schedule.status] || schedule.status}</span></td>
                <td className="px-3 py-3 max-w-52 text-slate-500">{schedule.notes || '-'}</td>
                <td className="px-3 py-3">
                  <div className="flex gap-2">
                    <button type="button" onClick={(event) => { event.stopPropagation(); onEmergencyReassign(schedule); }} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-bold text-amber-700 hover:bg-amber-100">Khẩn cấp</button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); onEditSchedule(schedule); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold hover:border-emerald-300">Sửa</button>
                    <button type="button" disabled={isScheduleDeleteLocked(schedule)} onClick={(event) => { event.stopPropagation(); onDeleteSchedule(schedule); }} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 font-bold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40">Xóa</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!filteredSchedules.length ? (
        <div className="p-6 text-center text-sm text-slate-500">
          {serviceDateFilter ? `Không có lịch chuyến trong ngày ${serviceDateFilter}.` : 'Chưa có lịch chuyến.'}
        </div>
      ) : null}
    </div>
  </div>
  );
};

const ScheduleRouteDetailPanel = ({ routes, schedule }) => {
  const routeDetail = useMemo(() => getScheduleDirection(schedule, routes), [routes, schedule]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950">Lộ trình chuyến</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {schedule
              ? `${schedule.scheduleCode} - ${routeDetail.route?.routeCode || schedule.routeCode || 'Chưa rõ tuyến'} - ${scheduleDirectionLabels[schedule.direction] || schedule.direction}`
              : 'Chọn lịch chuyến trong danh sách để xem tuyến đường.'}
          </p>
        </div>
        {schedule ? (
          <div className="grid grid-cols-3 gap-2 text-right text-xs text-slate-500">
            <span><strong className="block text-slate-900">{routeDetail.stops.length}</strong>trạm</span>
            <span><strong className="block text-slate-900">{routeDetail.distance || 0} km</strong>quãng đường</span>
            <span><strong className="block text-slate-900">{routeDetail.duration || 0} phút</strong>dự kiến</span>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <ScheduleRouteMap schedule={schedule} routes={routes} />
        <div className="max-h-[360px] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
          {routeDetail.stops.length ? routeDetail.stops.map((stop, index) => (
            <div key={`${stop.stationId || stop.stopName || index}-${index}`} className="flex gap-3 border-b border-slate-200 py-3 last:border-b-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">{index + 1}</span>
              <span>
                <span className="block text-sm font-black text-slate-900">{stop.stopName}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{stop.address}</span>
                <span className="mt-1 block text-xs text-slate-400">Đến +{stop.arrivalOffsetMinutes || 0} phút | Rời +{stop.departureOffsetMinutes || 0} phút</span>
              </span>
            </div>
          )) : (
            <div className="p-4 text-sm text-slate-500">Chưa có dữ liệu trạm cho lịch chuyến này.</div>
          )}
        </div>
      </div>
    </div>
  );
};

const ScheduleRouteDetailModal = ({ onClose, routes, schedule }) => {
  const routeDetail = useMemo(() => getScheduleDirection(schedule, routes), [routes, schedule]);

  useEffect(() => {
    if (!schedule) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, schedule]);

  if (!schedule) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <button type="button" aria-label="Đóng chi tiết tuyến" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div className="relative max-h-[92vh] w-full max-w-[1500px] overflow-y-auto rounded-3xl bg-white p-4 text-slate-900 shadow-[0_28px_90px_rgba(15,23,42,0.45)] sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Chi tiết tuyến</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              {routeDetail.route?.routeCode || schedule.routeCode || 'Chưa rõ tuyến'} - {routeDetail.route?.routeName || schedule.routeName || ''}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100" aria-label="Đóng">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2 xl:grid-cols-5">
          <span><strong className="block text-xs uppercase text-slate-500">Mã ca</strong><span className="mt-1 block font-black">{schedule.scheduleCode || '-'}</span></span>
          <span><strong className="block text-xs uppercase text-slate-500">Ngày chạy</strong><span className="mt-1 block font-black">{toDateInputValue(schedule.serviceDate)}</span></span>
          <span><strong className="block text-xs uppercase text-slate-500">Thời gian</strong><span className="mt-1 block font-black">{schedule.departureTime || '--:--'} - {schedule.expectedArrivalTime || '--:--'}</span></span>
          <span><strong className="block text-xs uppercase text-slate-500">Chiều chạy</strong><span className="mt-1 block font-black">{scheduleDirectionLabels[schedule.direction] || schedule.direction}</span></span>
          <span><strong className="block text-xs uppercase text-slate-500">Trạng thái</strong><span className="mt-1 block font-black">{scheduleStatusLabels[schedule.status] || schedule.status}</span></span>
        </div>
        {schedule.isScheduleException ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Chuyến ngoại lệ:</strong> {schedule.exceptionReason || 'Không có lý do được ghi nhận.'}
          </div>
        ) : null}

        <ScheduleRouteDetailPanel routes={routes} schedule={schedule} />
      </div>
    </div>
  );
};

const toAssignedVehicle = (busId, buses) => {
  const bus = buses.find((item) => String(item._id) === String(busId));
  return bus ? {
    busId: bus._id,
    busCode: bus.busCode,
    plateNumber: bus.plateNumber,
    busType: bus.busType,
    capacity: Number(bus.capacity || 0),
  } : {};
};

const toAssignedPerson = (userId, people, fallbackPerson = null) => {
  const user = people.find((item) => String(item._id) === String(userId));
  const person = user || (String(fallbackPerson?._id || '') === String(userId || '') ? fallbackPerson : null);
  return person ? {
    userId: person._id,
    fullName: person.fullName,
    role: person.role,
    phone: person.phone || person.phoneNumber || '',
  } : {};
};

const loadAllTripSchedules = async () => {
  const firstPage = await adminService.getTripSchedules({ limit: 100, page: 1 });
  const totalPages = Number(firstPage.pagination?.totalPages || 1);
  if (totalPages <= 1) return firstPage;
  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => (
      adminService.getTripSchedules({ limit: 100, page: index + 2 })
    ))
  );
  return {
    ...firstPage,
    schedules: [
      ...(firstPage.schedules || []),
      ...remainingPages.flatMap((response) => response.schedules || []),
    ],
  };
};

const entityId = (value) => (typeof value === 'object' && value !== null ? value._id : value) || '';

const EmergencyReassignmentModal = ({
  assistantShiftAssignments,
  assistantStaff,
  buses,
  driverShiftAssignments,
  drivers,
  onClose,
  onSaved,
  schedule,
  schedules,
}) => {
  const [form, setForm] = useState({
    busId: '',
    driverId: '',
    assistantId: '',
    emergencyReason: '',
  });
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!schedule) return;
    setForm({
      busId: entityId(schedule.vehicle?.busId),
      driverId: entityId(schedule.driver?.userId),
      assistantId: entityId(schedule.assistant?.userId),
      emergencyReason: '',
    });
    setMessage('');
  }, [schedule]);

  if (!schedule) return null;

  const isBusyAtScheduleTime = (candidateId, assignmentKey) => schedules.some((item) => (
    String(item._id || '') !== String(schedule._id || '')
    && item.status !== 'CANCELLED'
    && isSameDateInputValue(item.serviceDate, toDateInputValue(schedule.serviceDate))
    && String(entityId(item[assignmentKey]?.[assignmentKey === 'vehicle' ? 'busId' : 'userId']) || '') === String(candidateId || '')
    && scheduleTimeRangesOverlap(schedule, item)
  ));

  const currentBusId = entityId(schedule.vehicle?.busId);
  const currentDriverId = entityId(schedule.driver?.userId);
  const currentAssistantId = entityId(schedule.assistant?.userId);
  const scheduleWorkloadForm = {
    serviceDate: toDateInputValue(schedule.serviceDate),
    departureTime: schedule.departureTime,
    expectedArrivalTime: schedule.expectedArrivalTime,
  };

  const availableBuses = buses.filter((bus) => (
    isAssignableBus(bus)
    && (String(bus._id) === String(currentBusId) || !isBusyAtScheduleTime(bus._id, 'vehicle'))
  ));
  const availableDrivers = drivers.filter((driver) => (
    String(driver._id) === String(currentDriverId)
    || (
      !isBusyAtScheduleTime(driver._id, 'driver')
      && hasDailyStaffWorkloadCapacity(driver._id, schedules, 'driver', scheduleWorkloadForm, schedule._id)
      && hasEligibleShiftAssignment(driver._id, driverShiftAssignments, {
        serviceDate: toDateInputValue(schedule.serviceDate),
        departureTime: schedule.departureTime,
        expectedArrivalTime: schedule.expectedArrivalTime,
      }, 'driverId')
    )
  ));
  const availableAssistants = assistantStaff.filter((staff) => (
    String(staff._id) === String(currentAssistantId)
    || (
      !isBusyAtScheduleTime(staff._id, 'assistant')
      && hasDailyStaffWorkloadCapacity(staff._id, schedules, 'assistant', scheduleWorkloadForm, schedule._id)
      && hasEligibleShiftAssignment(staff._id, assistantShiftAssignments, {
        serviceDate: toDateInputValue(schedule.serviceDate),
        departureTime: schedule.departureTime,
        expectedArrivalTime: schedule.expectedArrivalTime,
      }, 'assistantId')
    )
  ));
  const inputClassName = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-amber-300';

  const submit = async (event) => {
    event.preventDefault();
    const reason = form.emergencyReason.trim();
    if (!reason) {
      setMessage('Cần nhập lý do đổi khẩn cấp.');
      return;
    }

    const hasChange = (
      String(form.busId || '') !== String(entityId(schedule.vehicle?.busId) || '')
      || String(form.driverId || '') !== String(entityId(schedule.driver?.userId) || '')
      || String(form.assistantId || '') !== String(entityId(schedule.assistant?.userId) || '')
    );

    if (!hasChange) {
      setMessage('Cần chọn ít nhất một xe, tài xế hoặc phụ xe thay thế.');
      return;
    }
    if (form.busId && !availableBuses.some((bus) => String(bus._id) === String(form.busId))) {
      setMessage('Xe đã có lịch trùng giờ hoặc không khả dụng.');
      return;
    }
    if (form.driverId && !availableDrivers.some((driver) => String(driver._id) === String(form.driverId))) {
      setMessage('Tài xế đã có lịch trùng giờ.');
      return;
    }
    if (form.assistantId && !availableAssistants.some((staff) => String(staff._id) === String(form.assistantId))) {
      setMessage('Phụ xe đã có lịch trùng giờ.');
      return;
    }

    const payload = {
      scheduleCode: schedule.scheduleCode,
      serviceDate: toDateInputValue(schedule.serviceDate),
      routeId: entityId(schedule.routeId),
      direction: schedule.direction || 'OUTBOUND',
      departureTime: schedule.departureTime,
      expectedArrivalTime: schedule.expectedArrivalTime,
      shiftLabel: schedule.shiftLabel || '',
      status: determineScheduleStatus(form, schedule.status),
      vehicle: toAssignedVehicle(form.busId, buses),
      driver: toAssignedPerson(form.driverId, drivers),
      assistant: toAssignedPerson(form.assistantId, assistantStaff),
      emergencyReason: reason,
    };

    setIsSaving(true);
    setMessage('');
    try {
      await adminService.updateTripSchedule(schedule._id, payload);
      await onSaved?.();
      onClose();
    } catch (error) {
      setMessage(error?.message || 'Không thể xử lý đổi khẩn cấp.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
      <button type="button" aria-label="Close emergency reassignment modal" onClick={onClose} className="absolute inset-0 cursor-default" />
      <form onSubmit={submit} className="relative w-full max-w-2xl rounded-2xl border border-amber-200 bg-white p-6 text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-500">Điều phối khẩn cấp</p>
            <h2 className="mt-2 text-2xl font-black">Đổi xe hoặc nhân sự</h2>
            <p className="mt-2 text-sm text-slate-500">{schedule.scheduleCode} - {schedule.departureTime || '--:--'} đến {schedule.expectedArrivalTime || '--:--'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Xe thay thế</span>
            <select className={inputClassName} value={form.busId} onChange={(event) => setForm((current) => ({ ...current, busId: event.target.value }))}>
              <option value="">Chưa gán xe</option>
              {availableBuses.map((bus) => <option key={bus._id} value={bus._id}>{bus.busCode} - {bus.plateNumber}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Tài xế thay thế</span>
            <select className={inputClassName} value={form.driverId} onChange={(event) => setForm((current) => ({ ...current, driverId: event.target.value }))}>
              <option value="">Chưa gán tài xế</option>
              {availableDrivers.map((driver) => <option key={driver._id} value={driver._id}>{driver.fullName}{driver.phone ? ` - ${driver.phone}` : ''}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Phụ xe thay thế</span>
            <select className={inputClassName} value={form.assistantId} onChange={(event) => setForm((current) => ({ ...current, assistantId: event.target.value }))}>
              <option value="">Chưa gán phụ xe</option>
              {availableAssistants.map((staff) => <option key={staff._id} value={staff._id}>{staff.fullName}{staff.phone ? ` - ${staff.phone}` : ''}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs font-semibold text-slate-500">
          Danh sách chỉ hiển thị xe, tài xế và phụ xe không có lịch trùng khung giờ của ca này.
        </p>

        <label className="mt-4 block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Lý do khẩn cấp</span>
          <textarea
            className={`${inputClassName} min-h-28 resize-none`}
            placeholder="Ví dụ: Xe gặp sự cố kỹ thuật, cần đổi xe và thông báo cho kíp vận hành."
            value={form.emergencyReason}
            onChange={(event) => setForm((current) => ({ ...current, emergencyReason: event.target.value }))}
          />
        </label>

        {message ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">{message}</div> : null}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={isSaving} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-50">Hủy</button>
          <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60">
            <span className="material-symbols-outlined text-lg">emergency</span>
            {isSaving ? 'Đang xử lý...' : 'Xác nhận đổi khẩn cấp'}
          </button>
        </div>
      </form>
    </div>
  );
};

const FrequencyScheduleModal = ({ onClose, onSaved, routes }) => {
  const [form, setForm] = useState({
    routeId: '',
    startDate: toDateInputValue(),
    endDate: toDateInputValue(),
    autoAssign: true,
    replaceScheduled: true,
  });
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const selectedRoute = routes.find((route) => String(route._id) === String(form.routeId));
  const hasIncompleteRows = rows.some((row) => !row.vehicle?.busId || !row.driver?.userId || !row.assistant?.userId);

  const selectRoute = (routeId) => {
    setRows([]);
    setSummary(null);
    setForm((current) => ({
      ...current,
      routeId,
    }));
  };

  const generate = async () => {
    if (!form.routeId || !form.startDate || !form.endDate) return setMessage('Vui lòng chọn tuyến và khoảng ngày.');
    setIsLoading(true);
    setMessage('');
    try {
      const response = await adminService.generateTripSchedulePreview(form);
      setRows(response.rows || []);
      setSummary(response.summary || null);
      if (!response.rows?.length) setMessage('Không có ngày hoạt động trong khoảng đã chọn.');
    } catch (error) {
      setMessage(error?.message || 'Không thể sinh lịch theo tần suất tuyến.');
    } finally {
      setIsLoading(false);
    }
  };

  const confirm = async () => {
    if (hasIncompleteRows) {
      setMessage('Còn chuyến chưa đủ xe, tài xế hoặc phụ xe. Hãy xóa các dòng cảnh báo hoặc bổ sung ca làm trước khi lưu.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await adminService.confirmGeneratedTripSchedules(rows, form.replaceScheduled);
      await onSaved?.();
      setMessage(`Đã tạo ${response.schedules?.length || 0} lịch chuyến.`);
      onClose();
    } catch (error) {
      setMessage(error?.message || 'Không thể lưu lịch chuyến.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-white p-5 text-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div><h2 className="text-xl font-black">Sinh lịch từ cấu hình tuyến</h2><p className="mt-1 text-sm text-slate-500">Ngày hoạt động, giờ chạy và tần suất được lấy trực tiếp từ cấu hình tuyến.</p></div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-lg border border-slate-200 text-xl">×</button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="md:col-span-3"><span className="mb-1 block text-xs font-bold uppercase text-slate-500">Tuyến đã công bố *</span><select className="h-11 w-full rounded-lg border border-slate-200 px-3" value={form.routeId} onChange={(event) => selectRoute(event.target.value)}><option value="">Chọn tuyến</option>{routes.filter((route) => route.status === 'PUBLISHED').map((route) => <option key={route._id} value={route._id}>{route.routeCode} - {route.routeName}</option>)}</select></label>
          <label><span className="mb-1 block text-xs font-bold uppercase text-slate-500">Từ ngày *</span><input type="date" className="h-11 w-full rounded-lg border border-slate-200 px-3" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} /></label>
          <label><span className="mb-1 block text-xs font-bold uppercase text-slate-500">Đến ngày *</span><input type="date" min={form.startDate} className="h-11 w-full rounded-lg border border-slate-200 px-3" value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} /></label>
          <div className="md:col-span-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            {selectedRoute ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <span><strong className="block text-xs uppercase text-emerald-700">Khung giờ</strong>{FIRST_BUS_DEPARTURE_TIME} - {LAST_BUS_DEPARTURE_TIME}</span>
                <span><strong className="block text-xs uppercase text-emerald-700">Cao điểm</strong>{selectedRoute.scheduleConfig?.peakFrequencyMinutes || selectedRoute.scheduleConfig?.frequencyMinutes || 0} phút/chuyến</span>
                <span><strong className="block text-xs uppercase text-emerald-700">Thấp điểm</strong>{selectedRoute.scheduleConfig?.offPeakFrequencyMinutes || selectedRoute.scheduleConfig?.frequencyMinutes || selectedRoute.scheduleConfig?.peakFrequencyMinutes || 0} phút/chuyến</span>
                <span><strong className="block text-xs uppercase text-emerald-700">Nghỉ đầu cuối</strong>{Math.max(MIN_RESOURCE_BUFFER_MINUTES, Number(selectedRoute.scheduleConfig?.layoverMinutes || 0))} phút</span>
              </div>
            ) : 'Chọn tuyến để xem cấu hình.'}
            {selectedRoute ? <p className="mt-3 text-xs text-emerald-700">Cao điểm: 06:30–08:30 và 16:30–18:30. Các giờ còn lại áp dụng tần suất thấp điểm.</p> : null}
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-bold"><input type="checkbox" checked={form.autoAssign} onChange={(event) => setForm((current) => ({ ...current, autoAssign: event.target.checked }))} /> Tự gán xe, tài xế và phụ xe</label>
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-bold"><input type="checkbox" checked={form.replaceScheduled} onChange={(event) => setForm((current) => ({ ...current, replaceScheduled: event.target.checked }))} /> Xóa lịch PLANNED cũ trong khoảng ngày</label>
        </div>
        <div className="mt-4 flex gap-2"><button type="button" disabled={isLoading} onClick={generate} className="rounded-lg bg-violet-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{rows.length ? 'Sinh lại' : 'Sinh lịch'}</button><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-5 py-3 text-sm font-bold">Đóng</button></div>
        {message ? <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{message}</div> : null}
        {summary ? (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {[
              ['Chạy song song cao nhất', summary.maxConcurrentTrips || 0, `Có ${summary.assignableVehicles || 0} xe khả dụng`],
              ['Thiếu tài xế', summary.missingDrivers || 0, `Có ${summary.availableDrivers || 0} tài xế có ca`],
              ['Thiếu phụ xe', summary.missingAssistants || 0, `Có ${summary.availableAssistants || 0} phụ xe có ca`],
              ['Thiếu xe', summary.missingVehicles || 0, `${summary.assignedTrips || 0}/${summary.totalTrips || 0} chuyến đủ phân công`],
            ].map(([label, value, hint]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <span className="block text-xs font-black uppercase text-slate-500">{label}</span>
                <strong className="mt-1 block text-2xl text-slate-950">{value}</strong>
                <span className="mt-1 block text-xs font-semibold text-slate-500">{hint}</span>
              </div>
            ))}
          </div>
        ) : null}
        {rows.length ? <div className="mt-5"><div className="mb-3 flex justify-between"><h3 className="font-black">Bản xem trước</h3><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{rows.length} chuyến · {rows.filter((row) => row.shiftLabel === 'MORNING').length} sáng · {rows.filter((row) => row.shiftLabel === 'AFTERNOON').length} chiều</span></div>{hasIncompleteRows ? <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">Chỉ lưu được lịch đã đủ xe, tài xế và phụ xe. Các dòng còn cảnh báo cần xóa hoặc bổ sung ca làm trước.</div> : null}<div className="max-h-96 overflow-auto rounded-lg border border-slate-200"><table className="min-w-[1200px] w-full text-left text-xs"><thead className="sticky top-0 bg-slate-100"><tr>{['Ngày', 'Mã lịch', 'Ca', 'Chiều', 'Xuất bến', 'Đến', 'Rảnh lại', 'Xe', 'Tài xế', 'Phụ xe', 'Cảnh báo', ''].map((item) => <th key={item} className="px-3 py-3 font-black uppercase text-slate-500">{item}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.previewId} className="border-t border-slate-200"><td className="px-3 py-3">{row.serviceDate}</td><td className="px-3 py-3 font-bold">{row.scheduleCode}</td><td className="px-3 py-3 font-bold">{scheduleShiftLabels[row.shiftLabel] || '-'}</td><td className="px-3 py-3">{scheduleDirectionLabels[row.direction]}</td><td className="px-3 py-3">{row.departureTime}</td><td className="px-3 py-3">{row.expectedArrivalTime}</td><td className="px-3 py-3">{row.turnaroundEndTime || row.expectedArrivalTime}</td><td className="px-3 py-3">{row.vehicle?.busCode || 'Chưa gán'}</td><td className="px-3 py-3">{row.driver?.fullName || 'Chưa gán'}</td><td className="px-3 py-3">{row.assistant?.fullName || 'Chưa gán'}</td><td className="px-3 py-3 text-amber-700">{row.warnings?.join(' ') || 'Hợp lệ'}</td><td className="px-3 py-3"><button type="button" onClick={() => setRows((current) => current.filter((item) => item.previewId !== row.previewId))} className="text-rose-600">Xóa</button></td></tr>)}</tbody></table></div><div className="mt-4 flex justify-end"><button type="button" disabled={isLoading || hasIncompleteRows} onClick={confirm} className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-black text-emerald-950 disabled:opacity-50">Xác nhận tạo lịch</button></div></div> : null}
      </div>
    </div>
  );
};

const TRIP_DEMAND_PERIODS = [
  { key: 'MORNING', label: 'Khung chuyến sáng', start: '05:30', end: '12:00', tone: 'border-amber-200 bg-amber-50' },
  { key: 'AFTERNOON', label: 'Khung chuyến chiều', start: '12:00', end: '18:30', tone: 'border-violet-200 bg-violet-50' },
];

const formatPlanningDate = (value) => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const TripDemandPlanningPanel = ({ onSaved, routes, schedules = [] }) => {
  const [form, setForm] = useState({
    applyMode: 'WEEK',
    serviceDate: toDateInputValue(),
    selectedWeekdays: [1, 2, 3, 4, 5],
    routeId: '',
    direction: 'BOTH',
    frequencies: { MORNING: 30, AFTERNOON: 30 },
    peakWindows: {
      MORNING: { enabled: true, start: '06:30', end: '08:30', frequency: 15 },
      AFTERNOON: { enabled: true, start: '15:30', end: '16:30', frequency: 15 },
    },
    middayWindow: { enabled: true, start: '10:00', end: '12:00', frequency: 20 },
  });
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [expandedPlanKey, setExpandedPlanKey] = useState('');
  const [deletingPlanKey, setDeletingPlanKey] = useState('');
  const [deletingTripId, setDeletingTripId] = useState('');
  const selectedRoute = routes.find((route) => String(route._id || route.id) === String(form.routeId));
  const planningDates = useMemo(() => {
    if (form.applyMode === 'DAY') return [form.serviceDate];
    const selected = new Date(`${form.serviceDate}T00:00:00`);
    if (Number.isNaN(selected.getTime())) return [];
    const day = selected.getDay();
    const monday = addDateDays(form.serviceDate, -(day === 0 ? 6 : day - 1));
    return Array.from({ length: 7 }, (_, index) => addDateDays(monday, index))
      .filter((date) => form.selectedWeekdays.includes(new Date(`${date}T00:00:00`).getDay()));
  }, [form.applyMode, form.selectedWeekdays, form.serviceDate]);
  const routeDuration = (direction) => {
    if (!selectedRoute) return 60;
    const routeDirection = direction === 'INBOUND' ? selectedRoute.inboundRoute : selectedRoute.outboundRoute;
    return Math.max(10, Number(routeDirection?.estimatedDurationMinutes || selectedRoute.scheduleConfig?.estimatedTripDurationMinutes || 60));
  };
  const departuresForPeriod = (period) => {
    if (!selectedRoute) return [];
    const normalFrequency = Number(form.frequencies[period.key]);
    if (!Number.isFinite(normalFrequency) || normalFrequency < 5) return [];
    const cycleDuration = form.direction === 'BOTH'
      ? routeDuration('OUTBOUND') + MIN_RESOURCE_BUFFER_MINUTES + routeDuration('INBOUND')
      : routeDuration(form.direction);
    const start = toMinutes(period.start);
    const latest = toMinutes(period.end) - cycleDuration;
    if (latest < start) return [];
    const specialWindows = [
      { ...form.peakWindows[period.key], level: 'PEAK' },
      ...(period.key === 'MORNING' ? [{ ...form.middayWindow, level: 'MID_PEAK' }] : []),
    ].filter((window) => window.enabled)
      .map((window) => ({ ...window, from: Math.max(start, toMinutes(window.start)), to: Math.min(toMinutes(period.end), toMinutes(window.end)), frequency: Math.max(5, Number(window.frequency) || normalFrequency) }))
      .filter((window) => window.from < window.to)
      .sort((left, right) => left.from - right.from);
    const departures = [];
    for (let cursor = start; cursor <= latest;) {
      departures.push(cursor);
      const activeWindow = specialWindows.find((window) => cursor >= window.from && cursor < window.to);
      let next = cursor + (activeWindow?.frequency || normalFrequency);
      const nextBoundary = specialWindows.flatMap((window) => [window.from, window.to]).filter((boundary) => boundary > cursor).sort((left, right) => left - right)[0];
      if (Number.isFinite(nextBoundary) && next > nextBoundary) next = nextBoundary;
      if (next <= cursor) break;
      cursor = next;
    }
    return departures;
  };
  const roundCountForPeriod = (period) => departuresForPeriod(period).length;
  const confirmedPlans = useMemo(() => {
    const groups = new Map();
    schedules.filter((schedule) => schedule.status !== 'CANCELLED').forEach((schedule) => {
      const routeId = String(schedule.routeId?._id || schedule.routeId || '');
      const serviceDate = toDateInputValue(schedule.serviceDate);
      if (!routeId || !serviceDate) return;
      const key = `${routeId}-${serviceDate}`;
      if (!groups.has(key)) groups.set(key, { key, routeId, serviceDate, routeCode: schedule.routeCode, routeName: schedule.routeName, trips: [] });
      groups.get(key).trips.push(schedule);
    });
    return [...groups.values()].map((plan) => ({
      ...plan,
      trips: [...plan.trips].sort((left, right) => String(left.departureTime).localeCompare(String(right.departureTime))),
    })).sort((left, right) => right.serviceDate.localeCompare(left.serviceDate) || left.routeCode.localeCompare(right.routeCode));
  }, [schedules]);
  const confirmedPlansByDate = useMemo(() => {
    const groups = new Map();
    confirmedPlans.forEach((plan) => {
      if (!groups.has(plan.serviceDate)) groups.set(plan.serviceDate, []);
      groups.get(plan.serviceDate).push(plan);
    });
    return [...groups.entries()].map(([serviceDate, plans]) => ({
      serviceDate,
      plans,
      totalTrips: plans.reduce((sum, plan) => sum + plan.trips.length, 0),
    }));
  }, [confirmedPlans]);

  const buildPreview = () => {
    if (!selectedRoute || !form.serviceDate || !planningDates.length) {
      setMessage('Vui lòng chọn tuyến và ít nhất một ngày vận hành.');
      return;
    }
    const nextRows = [];
    const planningErrors = [];
    const routeId = selectedRoute._id || selectedRoute.id;
    const routeCode = selectedRoute.routeCode || selectedRoute.routeNumber;
    const routeName = selectedRoute.routeName || selectedRoute.name;
    const appendRow = ({ period, serviceDate, dateCode, direction, index, departure, duration, pairCode = '', demandLevelOverride, headwayOverride }) => {
      const departureTime = addMinutesToClock('00:00', departure);
      const expectedArrivalTime = addMinutesToClock(departureTime, duration);
      const directionCode = direction === 'OUTBOUND' ? 'D' : 'V';
      const peak = form.peakWindows[period.key];
      const inPeak = peak.enabled && departure >= toMinutes(peak.start) && departure < toMinutes(peak.end);
      const inMidPeak = period.key === 'MORNING' && form.middayWindow.enabled && departure >= toMinutes(form.middayWindow.start) && departure < toMinutes(form.middayWindow.end);
      const demandLevel = demandLevelOverride || (inPeak ? 'PEAK' : (inMidPeak ? 'MID_PEAK' : 'OFF_PEAK'));
      const headwayMinutes = Number(headwayOverride || (inPeak ? peak.frequency : (inMidPeak ? form.middayWindow.frequency : form.frequencies[period.key])));
      nextRows.push({
        previewId: `${serviceDate}-${period.key}-${direction}-${index}`,
        scheduleCode: `${routeCode}-${dateCode}-${departureTime.replace(':', '')}-${directionCode}`,
        serviceDate,
        routeId,
        routeCode,
        routeName,
        direction,
        departureTime,
        expectedArrivalTime,
        turnaroundEndTime: addMinutesToClock(expectedArrivalTime, MIN_RESOURCE_BUFFER_MINUTES),
        shiftLabel: period.key,
        demandLevel,
        headwayMinutes,
        vehicle: {},
        driver: {},
        assistant: {},
        status: 'PLANNED',
        operationCycleCode: pairCode,
        warnings: ['Chờ phân ca, xe và nhân sự.'],
      });
      return { departureTime, expectedArrivalTime, demandLevel, headwayMinutes };
    };
    TRIP_DEMAND_PERIODS.forEach((period) => {
      const frequency = Number(form.frequencies[period.key]);
      if (!Number.isFinite(frequency) || frequency < 5 || frequency > 180) {
        planningErrors.push(`${period.label}: tần suất phải từ 5 đến 180 phút.`);
        return;
      }
      const peak = form.peakWindows[period.key];
      if (peak?.enabled) {
        const peakFrequency = Number(peak.frequency);
        if (!Number.isFinite(peakFrequency) || peakFrequency < 5 || peakFrequency > 180) {
          planningErrors.push(`${period.label}: tần suất cao điểm phải từ 5 đến 180 phút.`);
          return;
        }
        if (toMinutes(peak.start) < toMinutes(period.start) || toMinutes(peak.end) > toMinutes(period.end) || toMinutes(peak.start) >= toMinutes(peak.end)) {
          planningErrors.push(`${period.label}: khung cao điểm phải nằm trong khung vận hành và giờ kết thúc phải sau giờ bắt đầu.`);
          return;
        }
      }
      if (period.key === 'MORNING' && form.middayWindow.enabled) {
        const midday = form.middayWindow;
        const middayFrequency = Number(midday.frequency);
        if (!Number.isFinite(middayFrequency) || middayFrequency < 5 || middayFrequency > 180) {
          planningErrors.push('Khung tăng cường giữa ngày: tần suất phải từ 5 đến 180 phút.');
          return;
        }
        if (toMinutes(midday.start) < toMinutes(period.start) || toMinutes(midday.end) > toMinutes(period.end) || toMinutes(midday.start) >= toMinutes(midday.end)) {
          planningErrors.push('Khung tăng cường giữa ngày phải nằm trong ca sáng và giờ kết thúc phải sau giờ bắt đầu.');
          return;
        }
        if (peak?.enabled && toMinutes(midday.start) < toMinutes(peak.end) && toMinutes(midday.end) > toMinutes(peak.start)) {
          planningErrors.push('Khung cao điểm sáng và khung tăng cường giữa ngày không được chồng lấn.');
          return;
        }
      }
      const start = toMinutes(period.start);
      const end = toMinutes(period.end);
      const outboundDuration = routeDuration('OUTBOUND');
      const inboundDuration = routeDuration('INBOUND');
      const cycleDuration = form.direction === 'BOTH'
        ? outboundDuration + MIN_RESOURCE_BUFFER_MINUTES + inboundDuration
        : routeDuration(form.direction);
      const latestDeparture = end - cycleDuration;
      if (latestDeparture < start) {
        planningErrors.push(`${period.label} không đủ thời gian cho một ${form.direction === 'BOTH' ? 'vòng đi-về' : 'chuyến'} hoàn chỉnh.`);
        return;
      }
      const departures = departuresForPeriod(period);
      planningDates.forEach((serviceDate) => {
        const dateCode = serviceDate.replace(/-/g, '').slice(2);
        for (let index = 0; index < departures.length; index += 1) {
          const departure = departures[index];
          if (form.direction === 'BOTH') {
            const pairCode = `${routeCode}-${dateCode}-${period.key}-${index + 1}`;
            const outbound = appendRow({ period, serviceDate, dateCode, direction: 'OUTBOUND', index, departure, duration: outboundDuration, pairCode });
            const inboundDeparture = departure + outboundDuration + MIN_RESOURCE_BUFFER_MINUTES;
            appendRow({ period, serviceDate, dateCode, direction: 'INBOUND', index, departure: inboundDeparture, duration: inboundDuration, pairCode, demandLevelOverride: outbound.demandLevel, headwayOverride: outbound.headwayMinutes });
          } else {
            appendRow({ period, serviceDate, dateCode, direction: form.direction, index, departure, duration: routeDuration(form.direction) });
          }
        }
      });
    });
    // Rows are appended as an atomic D -> V pair inside each period. Keep that
    // insertion order; sorting globally by departure time would interleave
    // another cycle's D between the current cycle's D and V.
    setRows(nextRows.sort((left, right) => left.serviceDate.localeCompare(right.serviceDate)));
    setPreviewExpanded(false);
    setMessage(planningErrors.join(' ') || (nextRows.length ? '' : 'Không tạo được chuyến cho các ngày đã chọn.'));
  };

  const confirmPlan = async () => {
    if (!rows.length) return;
    setIsSaving(true);
    setMessage('');
    try {
      const response = await adminService.confirmGeneratedTripSchedules(rows, false, true);
      await onSaved?.();
      const savedSchedules = response.schedules || [];
      setRows([]);
      toast.success(`Đã tạo ${savedSchedules.length} chuyến. Kế hoạch đã được thu gọn ở danh sách bên dưới.`);
    } catch (error) {
      setMessage(error?.message || 'Không thể lưu kế hoạch phân chuyến.');
    } finally {
      setIsSaving(false);
    }
  };

  const totalPerDirection = TRIP_DEMAND_PERIODS.reduce((sum, period) => sum + roundCountForPeriod(period), 0);
  const totalTrips = totalPerDirection * (form.direction === 'BOTH' ? 2 : 1) * planningDates.length;
  const previewRequiredTeams = useMemo(() => {
    const dates = [...new Set(rows.map((row) => row.serviceDate))];
    return Math.max(0, ...dates.map((serviceDate) => {
      const cycles = [...rows.filter((row) => row.serviceDate === serviceDate).reduce((groups, row) => {
        const key = row.operationCycleCode || row.previewId;
        const current = groups.get(key) || { start: Number.POSITIVE_INFINITY, end: 0 };
        current.start = Math.min(current.start, toMinutes(row.departureTime));
        current.end = Math.max(current.end, toMinutes(row.turnaroundEndTime || row.expectedArrivalTime));
        groups.set(key, current);
        return groups;
      }, new Map()).values()];
      const events = cycles.flatMap((cycle) => [{ at: cycle.start, delta: 1 }, { at: cycle.end, delta: -1 }])
        .sort((left, right) => left.at - right.at || left.delta - right.delta);
      let active = 0;
      return events.reduce((peak, event) => { active += event.delta; return Math.max(peak, active); }, 0);
    }));
  }, [rows]);
  const deleteConfirmedPlan = async (plan) => {
    if (!window.confirm(`Xóa toàn bộ ${plan.trips.length} chuyến của ${plan.routeCode || 'tuyến này'} ngày ${plan.serviceDate}?`)) return;
    setDeletingPlanKey(plan.key);
    try {
      const response = await adminService.deleteTripSchedules({ scheduleIds: plan.trips.map((trip) => trip._id).filter(Boolean) });
      if (expandedPlanKey === plan.key) setExpandedPlanKey('');
      await onSaved?.();
      toast.success(`Đã xóa ${response.deletedCount || 0} chuyến.`);
      if (response.protectedCount) toast(`Có ${response.protectedCount} chuyến đang chạy/đã hoàn thành nên được giữ lại.`);
    } catch (error) {
      toast.error(error?.message || 'Không thể xóa kế hoạch chuyến.');
    } finally {
      setDeletingPlanKey('');
    }
  };
  const deleteConfirmedTrip = async (trip) => {
    const tripId = String(trip._id || '');
    if (!tripId || trip.status !== 'PLANNED') return;
    if (!window.confirm(`Xóa riêng chuyến ${trip.scheduleCode}?\n\nChuyến còn lại trong cùng vòng D–V sẽ được giữ nguyên. Thao tác này không thể hoàn tác.`)) return;
    setDeletingTripId(tripId);
    try {
      await adminService.deleteTripSchedule(tripId);
      await onSaved?.();
      toast.success(`Đã xóa chuyến ${trip.scheduleCode}.`);
    } catch (error) {
      toast.error(error?.message || `Không thể xóa chuyến ${trip.scheduleCode}.`);
    } finally {
      setDeletingTripId('');
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Kế hoạch nhu cầu vận hành</p>
          <h2 className="mt-2 text-2xl font-black">Phân chuyến theo ngày và khung giờ</h2>
          <p className="mt-2 text-sm text-slate-500">Chỉ xác định chuyến cần chạy. Xe và nhân sự sẽ được phân ở bước tiếp theo.</p>
        </div>
        <div className="rounded-xl bg-emerald-50 px-5 py-3 text-right">
          <span className="block text-xs font-bold uppercase text-emerald-700">Tổng lượt chạy dự kiến</span>
          <strong className="text-2xl text-emerald-900">{totalTrips} lượt</strong>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <label><span className="mb-1 block text-xs font-bold uppercase text-slate-500">Chế độ lập kế hoạch</span><select className="h-11 w-full rounded-xl border border-slate-200 px-3 font-bold" value={form.applyMode} onChange={(event) => { setRows([]); setForm((current) => ({ ...current, applyMode: event.target.value })); }}><option value="WEEK">Theo tuần</option><option value="DAY">Một ngày ngoại lệ</option></select></label>
        <label><span className="mb-1 block text-xs font-bold uppercase text-slate-500">{form.applyMode === 'WEEK' ? 'Chọn một ngày trong tuần' : 'Ngày phục vụ'}</span><input type="date" className="h-11 w-full rounded-xl border border-slate-200 px-3" value={form.serviceDate} onChange={(event) => { setRows([]); setForm((current) => ({ ...current, serviceDate: event.target.value })); }} /></label>
        <label><span className="mb-1 block text-xs font-bold uppercase text-slate-500">Tuyến</span><select className="h-11 w-full rounded-xl border border-slate-200 px-3" value={form.routeId} onChange={(event) => { setRows([]); setMessage(''); setForm((current) => ({ ...current, routeId: event.target.value })); }}><option value="">Chọn tuyến đã công bố</option>{routes.filter((route) => route.status === 'PUBLISHED').map((route) => { const routeId = route._id || route.id; return <option key={routeId} value={routeId}>{route.routeCode || route.routeNumber} - {route.routeName || route.name}</option>; })}</select></label>
        <label><span className="mb-1 block text-xs font-bold uppercase text-slate-500">Chiều chạy bắt buộc</span><div className="flex h-11 items-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-black text-emerald-800">Đủ cặp Chiều đi (D) → Chiều về (V)</div></label>
      </div>
      {form.applyMode === 'WEEK' ? <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3"><div className="flex flex-wrap items-center gap-2"><span className="mr-2 text-xs font-black uppercase text-emerald-800">Ngày áp dụng</span>{[{ key: 1, label: 'T2' }, { key: 2, label: 'T3' }, { key: 3, label: 'T4' }, { key: 4, label: 'T5' }, { key: 5, label: 'T6' }, { key: 6, label: 'T7' }, { key: 0, label: 'CN' }].map((day) => <label key={day.key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-black ${form.selectedWeekdays.includes(day.key) ? 'border-emerald-300 bg-white text-emerald-900' : 'border-slate-200 bg-slate-50 text-slate-500'}`}><input type="checkbox" checked={form.selectedWeekdays.includes(day.key)} onChange={(event) => { setRows([]); setForm((current) => ({ ...current, selectedWeekdays: event.target.checked ? [...new Set([...current.selectedWeekdays, day.key])] : current.selectedWeekdays.filter((value) => value !== day.key) })); }} />{day.label}</label>)}</div><p className="mt-2 text-xs text-emerald-800">Sẽ sinh lịch cho {planningDates.length} ngày: {planningDates.join(', ') || 'chưa chọn ngày'}.</p></div> : null}

      <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        <b>Khung chuyến được chia theo giờ xuất bến và không chồng lấn.</b>
        <span className="ml-1">Mốc 12:00 được đồng bộ với ca làm: ca sáng 05:30–12:00 và ca chiều 12:00–18:30. Mỗi vòng D–V phải hoàn tất trong khung ca tương ứng.</span>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {TRIP_DEMAND_PERIODS.map((period) => (
          <div key={period.key} className={`rounded-xl border p-4 ${period.tone}`}>
            <span className="text-sm font-black">{period.label}</span>
            <span className="ml-2 text-xs text-slate-500">{period.start}–{period.end}</span>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-white bg-white px-3"><input type="number" min="5" max="180" step="5" className="h-11 min-w-0 flex-1 bg-transparent text-lg font-black outline-none" value={form.frequencies[period.key]} onChange={(event) => { setRows([]); setForm((current) => ({ ...current, frequencies: { ...current.frequencies, [period.key]: event.target.value } })); }} /><span className="text-sm font-bold text-slate-500">phút/vòng</span></div>
            <span className="mt-2 block text-xs font-semibold text-slate-500">Bình thường: cứ {form.frequencies[period.key] || 0} phút xuất bến một vòng D–V.</span>
            <div className="mt-3 rounded-lg border border-white/80 bg-white/70 p-3">
              <label className="flex items-center justify-between gap-3 text-sm font-black"><span>Áp dụng giờ cao điểm</span><input type="checkbox" checked={form.peakWindows[period.key].enabled} onChange={(event) => { setRows([]); setForm((current) => ({ ...current, peakWindows: { ...current.peakWindows, [period.key]: { ...current.peakWindows[period.key], enabled: event.target.checked } } })); }} /></label>
              {form.peakWindows[period.key].enabled ? <div className="mt-3 grid grid-cols-3 gap-2"><label className="text-[11px] font-bold text-slate-500">Từ<input type="time" min={period.start} max={period.end} value={form.peakWindows[period.key].start} onChange={(event) => { setRows([]); setForm((current) => ({ ...current, peakWindows: { ...current.peakWindows, [period.key]: { ...current.peakWindows[period.key], start: event.target.value } } })); }} className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900" /></label><label className="text-[11px] font-bold text-slate-500">Đến<input type="time" min={period.start} max={period.end} value={form.peakWindows[period.key].end} onChange={(event) => { setRows([]); setForm((current) => ({ ...current, peakWindows: { ...current.peakWindows, [period.key]: { ...current.peakWindows[period.key], end: event.target.value } } })); }} className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900" /></label><label className="text-[11px] font-bold text-slate-500">Phút/vòng<input type="number" min="5" max="180" step="5" value={form.peakWindows[period.key].frequency} onChange={(event) => { setRows([]); setForm((current) => ({ ...current, peakWindows: { ...current.peakWindows, [period.key]: { ...current.peakWindows[period.key], frequency: event.target.value } } })); }} className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-black text-slate-900" /></label></div> : null}
            </div>
            <span className="mt-2 block text-xs font-black text-slate-600">Dự kiến {roundCountForPeriod(period)} vòng · {roundCountForPeriod(period) * 2} lượt chạy</span>
          </div>
        ))}
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <span className="text-sm font-black">Tăng cường giữa ngày</span>
          <span className="ml-2 text-xs text-slate-500">Nhu cầu trung bình–cao</span>
          <div className="mt-3 rounded-lg border border-white/80 bg-white/70 p-3">
            <label className="flex items-center justify-between gap-3 text-sm font-black"><span>Áp dụng khung tăng cường</span><input type="checkbox" checked={form.middayWindow.enabled} onChange={(event) => { setRows([]); setForm((current) => ({ ...current, middayWindow: { ...current.middayWindow, enabled: event.target.checked } })); }} /></label>
            {form.middayWindow.enabled ? <div className="mt-3 grid grid-cols-3 gap-2"><label className="text-[11px] font-bold text-slate-500">Từ<input type="time" min="05:30" max="12:00" value={form.middayWindow.start} onChange={(event) => { setRows([]); setForm((current) => ({ ...current, middayWindow: { ...current.middayWindow, start: event.target.value } })); }} className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900" /></label><label className="text-[11px] font-bold text-slate-500">Đến<input type="time" min="05:30" max="12:00" value={form.middayWindow.end} onChange={(event) => { setRows([]); setForm((current) => ({ ...current, middayWindow: { ...current.middayWindow, end: event.target.value } })); }} className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900" /></label><label className="text-[11px] font-bold text-slate-500">Phút/vòng<input type="number" min="5" max="180" step="5" value={form.middayWindow.frequency} onChange={(event) => { setRows([]); setForm((current) => ({ ...current, middayWindow: { ...current.middayWindow, frequency: event.target.value } })); }} className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-black text-slate-900" /></label></div> : null}
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-600">Mặc định 10:00–12:00, dùng khi nhu cầu cuối ca sáng cao hơn bình thường. Vòng chạy vẫn phải hoàn tất trước 12:00.</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={buildPreview} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white">Tạo bản xem trước</button>
        {rows.length ? <button type="button" disabled={isSaving} onClick={confirmPlan} className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-emerald-950 disabled:opacity-60">{isSaving ? 'Đang lưu...' : `Xác nhận ${rows.length} chuyến`}</button> : null}
      </div>
      {message ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">{message}</div> : null}

      {rows.length ? (
        <div className="mt-5 overflow-hidden rounded-xl border border-violet-200 bg-violet-50/40">
          <button type="button" onClick={() => setPreviewExpanded((value) => !value)} className="flex w-full items-center justify-between gap-4 p-4 text-left">
            <span>
              <b className="block">Bản nháp · {selectedRoute?.routeCode || selectedRoute?.routeNumber}</b>
              <small className="text-slate-500">
                {planningDates.length === 1
                  ? planningDates[0]
                  : `${planningDates[0]} – ${planningDates.at(-1)} · ${planningDates.length} ngày`}
                {' · '}{rows.length} lượt · cần tối thiểu {previewRequiredTeams} tổ xe/tài xế/phụ xe cùng lúc
              </small>
            </span>
            <span className="font-black text-violet-700">{previewExpanded ? 'Thu gọn ▲' : 'Xem chi tiết ▼'}</span>
          </button>
          {previewExpanded ? (
            <div className="max-h-96 overflow-auto border-t border-violet-200 bg-white">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="sticky top-0 bg-slate-100">
                  <tr>{['Ngày', 'Ca', 'Mã chuyến', 'Chiều', 'Xuất bến', 'Đến dự kiến', 'Trạng thái'].map((item) => <th key={item} className="px-4 py-3 text-xs font-black uppercase text-slate-500">{item}</th>)}</tr>
                </thead>
                <tbody>{rows.map((row, index) => {
                  const isFirstInCycle = index === 0 || rows[index - 1]?.operationCycleCode !== row.operationCycleCode;
                  const isLastInCycle = index === rows.length - 1 || rows[index + 1]?.operationCycleCode !== row.operationCycleCode;
                  const isFirstOfDate = index === 0 || rows[index - 1]?.serviceDate !== row.serviceDate;
                  return (
                    <tr key={row.previewId} className={`${isFirstOfDate ? 'border-t-4 border-violet-300' : isFirstInCycle ? 'border-t-2 border-emerald-300' : 'border-t border-emerald-100'} ${isFirstInCycle ? 'bg-emerald-50/50' : 'bg-white'} ${isLastInCycle ? 'border-b-2 border-b-emerald-300' : ''}`}>
                      <td className="px-4 py-3 font-bold text-violet-700">{row.serviceDate}</td>
                      <td className="px-4 py-3 font-bold">{scheduleShiftLabels[row.shiftLabel] || 'Ca sáng'}</td>
                      <td className="px-4 py-3 font-black">{row.scheduleCode}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${row.direction === 'OUTBOUND' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>{row.direction === 'OUTBOUND' ? 'D · Chiều đi' : 'V · Chiều về'}</span></td>
                      <td className="px-4 py-3">{row.departureTime}</td>
                      <td className="px-4 py-3">{row.expectedArrivalTime}</td>
                      <td className="px-4 py-3 text-amber-700">Chờ xác nhận</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="mt-6 border-t border-slate-200 pt-5">
        <div className="mb-4">
          <h3 className="text-lg font-black">Kế hoạch chuyến đã tạo theo ngày</h3>
          <p className="text-sm text-slate-500">Mỗi ngày hiển thị các tuyến và toàn bộ chuyến D–V đã xác nhận trong ngày đó.</p>
        </div>
        {confirmedPlansByDate.length ? (
          <div className="space-y-4">
            {confirmedPlansByDate.map((dateGroup) => (
              <section key={dateGroup.serviceDate} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-100 px-4 py-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Ngày phục vụ</p>
                    <h4 className="mt-1 text-base font-black capitalize">{formatPlanningDate(dateGroup.serviceDate)}</h4>
                  </div>
                  <div className="flex gap-2 text-xs font-black">
                    <span className="rounded-full bg-white px-3 py-1.5 text-slate-700">{dateGroup.plans.length} tuyến</span>
                    <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800">{dateGroup.totalTrips} chuyến</span>
                  </div>
                </header>
                <div className="space-y-2 p-3">
                  {dateGroup.plans.map((plan) => {
                    const expanded = expandedPlanKey === plan.key;
                    const firstTrip = plan.trips[0];
                    const lastTrip = plan.trips.at(-1);
                    const route = routes.find((item) => String(item._id || item.id) === plan.routeId);
                    return (
                      <article key={plan.key} className="overflow-hidden rounded-xl border border-emerald-200 bg-white">
                        <div className="flex flex-col gap-2 bg-emerald-50 p-3 sm:flex-row sm:items-center">
                          <button type="button" onClick={() => setExpandedPlanKey(expanded ? '' : plan.key)} className="flex flex-1 items-center justify-between gap-4 text-left">
                            <span>
                              <b className="block">{plan.routeCode || route?.routeCode || 'Tuyến'} · {plan.routeName || route?.routeName || ''}</b>
                              <small className="text-slate-600">{plan.trips.length} chuyến · {firstTrip?.departureTime}–{lastTrip?.expectedArrivalTime}</small>
                            </span>
                            <span className="shrink-0 text-xs font-black text-emerald-700">{expanded ? 'Thu gọn ▲' : 'Chi tiết ▼'}</span>
                          </button>
                          <button type="button" disabled={deletingPlanKey === plan.key || Boolean(deletingTripId)} onClick={() => deleteConfirmedPlan(plan)} className="shrink-0 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-600 disabled:opacity-50">
                            {deletingPlanKey === plan.key ? 'Đang xóa...' : 'Xóa toàn bộ kế hoạch'}
                          </button>
                        </div>
                        {expanded ? (
                          <div className="max-h-80 overflow-auto border-t border-emerald-200">
                            <table className="w-full min-w-[980px] text-left text-sm">
                              <thead className="sticky top-0 bg-slate-100"><tr>{['Mã chuyến', 'Ca', 'Chiều', 'Xuất bến', 'Đến dự kiến', 'Trạng thái', 'Thao tác'].map((item) => <th key={item} className="px-4 py-3 text-xs font-black uppercase text-slate-500">{item}</th>)}</tr></thead>
                              <tbody>{plan.trips.map((trip) => { const protectedTrip = trip.status !== 'PLANNED'; const deleting = deletingTripId === String(trip._id || ''); return <tr key={trip._id || trip.scheduleCode} className="border-t border-slate-100"><td className="px-4 py-3 font-black">{trip.scheduleCode}</td><td className="px-4 py-3">{trip.shiftLabel === 'MORNING' ? 'Sáng' : 'Chiều'}</td><td className="px-4 py-3">{trip.direction === 'OUTBOUND' ? 'D · Chiều đi' : 'V · Chiều về'}</td><td className="px-4 py-3">{trip.departureTime}</td><td className="px-4 py-3">{trip.expectedArrivalTime}</td><td className="px-4 py-3">{trip.status === 'PLANNED' ? 'Chờ phân bổ' : trip.status}</td><td className="px-4 py-3"><button type="button" title={protectedTrip ? 'Chuyến đã được phân bổ hoặc đã phát sinh vận hành nên không thể xóa' : `Xóa riêng ${trip.scheduleCode}`} disabled={protectedTrip || Boolean(deletingPlanKey) || Boolean(deletingTripId)} onClick={() => deleteConfirmedTrip(trip)} className="whitespace-nowrap rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400">{deleting ? 'Đang xóa…' : protectedTrip ? 'Đã phân bổ · Không thể xóa' : 'Xóa chuyến này'}</button></td></tr>; })}</tbody>
                            </table>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Chưa có kế hoạch chuyến nào được xác nhận.</p>}
      </section>
    </div>
  );
};

const SchedulingOperationsPanel = ({ assistantShiftAssignments, assistantStaff, buses, driverShiftAssignments, drivers, editingSchedule, onSaved, routes, schedules }) => {
  const [editingScheduleId, setEditingScheduleId] = useState('');
  const [form, setForm] = useState(() => createEmptyScheduleForm());
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showFrequencyGenerator, setShowFrequencyGenerator] = useState(false);
  const inputClassName = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-300';
  const labelClassName = 'mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500';
  const isResourceBusy = useCallback((resourceId, assignmentKey) => schedules.some((schedule) => (
    String(schedule._id || '') !== String(editingScheduleId || '')
    && schedule.status !== 'CANCELLED'
    && isSameDateInputValue(schedule.serviceDate, form.serviceDate)
    && String(entityId(schedule[assignmentKey]?.[assignmentKey === 'vehicle' ? 'busId' : 'userId']) || '') === String(resourceId || '')
    && scheduleTimeRangesOverlap(form, schedule)
  )), [editingScheduleId, form, schedules]);
  const availableBuses = useMemo(() => {
    if (!form.serviceDate || !form.departureTime || !form.expectedArrivalTime) {
      return buses.filter(isAssignableBus);
    }
    return buses.filter((bus) => isAssignableBus(bus) && !isResourceBusy(bus._id, 'vehicle'));
  }, [buses, form, isResourceBusy]);
  const selectedRoute = useMemo(() => routes.find((route) => String(route._id) === String(form.routeId)), [form.routeId, routes]);
  const routeScheduleMismatch = useMemo(
    () => getManualScheduleMismatch(selectedRoute, form.serviceDate, form.departureTime),
    [form.departureTime, form.serviceDate, selectedRoute]
  );
  const scheduleHardLimitError = useMemo(
    () => getScheduleHardLimitError(form.departureTime),
    [form.departureTime]
  );
  const estimatedDurationMinutes = useMemo(() => getRouteDurationMinutes(selectedRoute, form.direction), [form.direction, selectedRoute]);
  const generatedScheduleCode = useMemo(() => buildScheduleCode({
    departureTime: form.departureTime,
    direction: form.direction,
    route: selectedRoute,
    serviceDate: form.serviceDate,
  }), [form.departureTime, form.direction, form.serviceDate, selectedRoute]);
  const assignmentConflict = useMemo(() => {
    if (!form.serviceDate || !form.departureTime || (!form.busId && !form.driverId && !form.assistantId)) return null;
    return schedules.find((schedule) => (
      String(schedule._id || '') !== String(editingScheduleId || '')
      && schedule.status !== 'CANCELLED'
      && isSameDateInputValue(schedule.serviceDate, form.serviceDate)
      && scheduleTimeRangesOverlap(form, schedule)
      && (
        (form.busId && String(entityId(schedule.vehicle?.busId) || '') === String(form.busId))
        || (form.driverId && String(entityId(schedule.driver?.userId) || '') === String(form.driverId))
        || (form.assistantId && String(entityId(schedule.assistant?.userId) || '') === String(form.assistantId))
      )
    ));
  }, [editingScheduleId, form, schedules]);
  const availableDrivers = useMemo(() => {
    if (!form.serviceDate || !form.departureTime || !form.expectedArrivalTime) return [];
    return drivers.filter((driver) => (
      !isResourceBusy(driver._id, 'driver')
      && hasDailyStaffWorkloadCapacity(driver._id, schedules, 'driver', form, editingScheduleId)
      && hasEligibleShiftAssignment(driver._id, driverShiftAssignments, form, 'driverId')
    ));
  }, [driverShiftAssignments, drivers, editingScheduleId, form, isResourceBusy, schedules]);
  const availableAssistants = useMemo(() => {
    if (!form.serviceDate || !form.departureTime || !form.expectedArrivalTime) return [];
    return assistantStaff.filter((assistant) => (
      !isResourceBusy(assistant._id, 'assistant')
      && hasDailyStaffWorkloadCapacity(assistant._id, schedules, 'assistant', form, editingScheduleId)
      && hasEligibleShiftAssignment(assistant._id, assistantShiftAssignments, form, 'assistantId')
    ));
  }, [assistantShiftAssignments, assistantStaff, editingScheduleId, form, isResourceBusy, schedules]);
  const editingScheduleRecord = useMemo(() => (
    schedules.find((schedule) => String(schedule._id || '') === String(editingScheduleId || ''))
    || (String(editingSchedule?._id || '') === String(editingScheduleId || '') ? editingSchedule : null)
  ), [editingSchedule, editingScheduleId, schedules]);
  const currentDriverOption = useMemo(() => {
    const currentDriverId = entityId(editingScheduleRecord?.driver?.userId);
    if (!currentDriverId || String(currentDriverId) !== String(form.driverId || '')) return null;
    const driver = drivers.find((item) => String(item._id || '') === String(currentDriverId));
    return driver || {
      _id: currentDriverId,
      fullName: editingScheduleRecord?.driver?.fullName || 'Tài xế đã gán',
      phone: editingScheduleRecord?.driver?.phone || '',
      role: editingScheduleRecord?.driver?.role || 'DRIVER',
    };
  }, [drivers, editingScheduleRecord, form.driverId]);
  const currentAssistantOption = useMemo(() => {
    const currentAssistantId = entityId(editingScheduleRecord?.assistant?.userId);
    if (!currentAssistantId || String(currentAssistantId) !== String(form.assistantId || '')) return null;
    const assistant = assistantStaff.find((item) => String(item._id || '') === String(currentAssistantId));
    return assistant || {
      _id: currentAssistantId,
      fullName: editingScheduleRecord?.assistant?.fullName || 'Phụ xe đã gán',
      phone: editingScheduleRecord?.assistant?.phone || '',
      role: editingScheduleRecord?.assistant?.role || 'BUS_ASSISTANT',
    };
  }, [assistantStaff, editingScheduleRecord, form.assistantId]);
  const driverOptions = useMemo(() => (
    currentDriverOption && !availableDrivers.some((driver) => String(driver._id || '') === String(currentDriverOption._id || ''))
      ? [currentDriverOption, ...availableDrivers]
      : availableDrivers
  ), [availableDrivers, currentDriverOption]);
  const assistantOptions = useMemo(() => (
    currentAssistantOption && !availableAssistants.some((assistant) => String(assistant._id || '') === String(currentAssistantOption._id || ''))
      ? [currentAssistantOption, ...availableAssistants]
      : availableAssistants
  ), [availableAssistants, currentAssistantOption]);
  const isCurrentDriverSelection = Boolean(currentDriverOption && String(currentDriverOption._id || '') === String(form.driverId || ''));
  const isCurrentAssistantSelection = Boolean(currentAssistantOption && String(currentAssistantOption._id || '') === String(form.assistantId || ''));

  useEffect(() => {
    if (!estimatedDurationMinutes || !form.departureTime) return;
    const departureMinutes = parseClockToMinutes(form.departureTime);
    if (departureMinutes === null) return;
    const expectedArrivalTime = formatMinutesToClock(departureMinutes + estimatedDurationMinutes);
    setForm((current) => (
      current.expectedArrivalTime === expectedArrivalTime
        ? current
        : { ...current, expectedArrivalTime }
    ));
  }, [estimatedDurationMinutes, form.departureTime]);

  useEffect(() => {
    if (!form.driverId) return;
    const isStillAvailable = availableDrivers.some((driver) => String(driver._id || '') === String(form.driverId));
    if (!isStillAvailable && !isCurrentDriverSelection) {
      setForm((current) => ({ ...current, driverId: '' }));
    }
  }, [availableDrivers, form.driverId, isCurrentDriverSelection]);

  useEffect(() => {
    if (!form.assistantId) return;
    const isStillAvailable = availableAssistants.some((assistant) => String(assistant._id || '') === String(form.assistantId));
    if (!isStillAvailable && !isCurrentAssistantSelection) setForm((current) => ({ ...current, assistantId: '' }));
  }, [availableAssistants, form.assistantId, isCurrentAssistantSelection]);

  const resetForm = () => {
    setEditingScheduleId('');
    setForm(createEmptyScheduleForm());
    setMessage('');
  };

  const updateForm = (patch) => {
    setMessage('');
    setForm((current) => {
      const next = { ...current, ...patch };
      const route = routes.find((item) => String(item._id) === String(next.routeId));
      if (!editingScheduleId && patch.routeId && route) {
        next.departureTime = FIRST_BUS_DEPARTURE_TIME;
        next.isScheduleException = false;
        next.exceptionReason = '';
      }
      const nextCode = buildScheduleCode({
        departureTime: next.departureTime,
        direction: next.direction,
        route,
        serviceDate: next.serviceDate,
      });
      if (!editingScheduleId && (!current.scheduleCode || current.scheduleCode === generatedScheduleCode)) {
        next.scheduleCode = nextCode;
      }
      return next;
    });
  };

  const editSchedule = (schedule) => {
    if (!schedule) return;
    setEditingScheduleId(schedule._id);
    setForm({
      scheduleCode: schedule.scheduleCode || '',
      serviceDate: schedule.serviceDate ? toDateInputValue(schedule.serviceDate) : createEmptyScheduleForm().serviceDate,
      routeId: entityId(schedule.routeId) || '',
      direction: schedule.direction || 'OUTBOUND',
      departureTime: schedule.departureTime || '05:30',
      expectedArrivalTime: schedule.expectedArrivalTime || '',
      shiftLabel: schedule.shiftLabel || '',
      status: schedule.status || 'PLANNED',
      busId: entityId(schedule.vehicle?.busId) || '',
      driverId: entityId(schedule.driver?.userId) || '',
      assistantId: entityId(schedule.assistant?.userId) || '',
      isScheduleException: Boolean(schedule.isScheduleException),
      exceptionReason: schedule.exceptionReason || '',
    });
    setMessage('');
  };

  useEffect(() => {
    if (editingSchedule) editSchedule(editingSchedule);
  }, [editingSchedule]);

  const saveSchedule = async (event) => {
    event.preventDefault();
    if (!form.scheduleCode.trim() || !form.routeId || !form.serviceDate || !form.departureTime) {
      setMessage('Cần nhập mã lịch, tuyến, ngày phục vụ và giờ xuất bến.');
      return;
    }
    const departureMinutes = parseClockToMinutes(form.departureTime);
    const arrivalMinutes = parseClockToMinutes(form.expectedArrivalTime);
    if (departureMinutes === null || arrivalMinutes === null || arrivalMinutes <= departureMinutes) {
      setMessage('Giờ đến dự kiến phải hợp lệ và sau giờ xuất bến.');
      return;
    }
    if (assignmentConflict) {
      setMessage(`Trùng phân công với lịch ${assignmentConflict.scheduleCode} lúc ${assignmentConflict.departureTime}. Vui lòng đổi xe, tài xế, phụ xe hoặc giờ xuất bến.`);
      return;
    }
    if (form.busId && !availableBuses.some((bus) => String(bus._id) === String(form.busId))) {
      setMessage('Xe đã có lịch trùng giờ hoặc không khả dụng.');
      return;
    }
    if (form.driverId && !availableDrivers.some((driver) => String(driver._id) === String(form.driverId)) && !isCurrentDriverSelection) {
      setMessage('Tài xế không có ca làm phù hợp hoặc đã bận trong thời gian chuyến.');
      return;
    }
    if (form.assistantId && !availableAssistants.some((assistant) => String(assistant._id) === String(form.assistantId)) && !isCurrentAssistantSelection) {
      setMessage('Phụ xe không có ca làm phù hợp hoặc đã bận trong thời gian chuyến.');
      return;
    }
    if (scheduleHardLimitError) {
      setMessage(scheduleHardLimitError);
      return;
    }
    if (routeScheduleMismatch && (!form.isScheduleException || !form.exceptionReason.trim())) {
      setMessage('Chuyến nằm ngoài cấu hình tuyến. Cần xác nhận đây là chuyến ngoại lệ và nhập lý do.');
      return;
    }
    const payload = {
      scheduleCode: form.scheduleCode,
      serviceDate: form.serviceDate,
      routeId: form.routeId,
      direction: form.direction,
      departureTime: form.departureTime,
      expectedArrivalTime: form.expectedArrivalTime,
      shiftLabel: form.shiftLabel,
      status: determineScheduleStatus(form, form.status),
      vehicle: toAssignedVehicle(form.busId, availableBuses),
      driver: toAssignedPerson(form.driverId, drivers, currentDriverOption),
      assistant: toAssignedPerson(form.assistantId, assistantStaff, currentAssistantOption),
      isScheduleException: Boolean(routeScheduleMismatch && form.isScheduleException),
      exceptionReason: routeScheduleMismatch ? form.exceptionReason.trim() : '',
    };
    setIsSaving(true);
    try {
      if (editingScheduleId) {
        await adminService.updateTripSchedule(editingScheduleId, payload);
      } else {
        await adminService.createTripSchedule(payload);
      }
      const successMessage = editingScheduleId ? 'Đã cập nhật lịch chuyến.' : 'Đã tạo lịch chuyến.';
      resetForm();
      setMessage(successMessage);
      await onSaved?.();
    } catch (error) {
      setMessage(error?.message || 'Không thể lưu lịch chuyến.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-black text-slate-950">Điều phối lịch chuyến</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Tạo lịch chạy thực tế theo tuyến, chiều, giờ xuất bến, xe và kíp vận hành.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{schedules.length} lịch</span>
          <button type="button" onClick={() => setShowFrequencyGenerator(true)} className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-black text-white">Sinh lịch theo tần suất</button>
        </div>
      </div>

      {showFrequencyGenerator ? <FrequencyScheduleModal onClose={() => setShowFrequencyGenerator(false)} onSaved={onSaved} routes={routes} /> : null}

      <form onSubmit={saveSchedule} className="mt-4 grid gap-3">
        <div className="grid gap-2 lg:grid-cols-4">
          <label>
            <span className={labelClassName}>Mã lịch</span>
            <input className={inputClassName} placeholder="VD: R01-260604-0530-D" value={form.scheduleCode} onChange={(event) => updateForm({ scheduleCode: event.target.value.toUpperCase() })} />
          </label>
          <label>
            <span className={labelClassName}>Ngày phục vụ</span>
            <input type="date" className={inputClassName} value={form.serviceDate} onChange={(event) => updateForm({ serviceDate: event.target.value })} />
          </label>
          <label>
            <span className={labelClassName}>Giờ xuất bến</span>
            <div className="relative">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">schedule</span>
              <input type="time" className={`${inputClassName} pl-11`} value={form.departureTime} onChange={(event) => updateForm({ departureTime: event.target.value })} />
            </div>
          </label>
          <label>
            <span className={labelClassName}>Giờ đến dự kiến</span>
            <div className="relative">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">flag</span>
              <input type="time" className={`${inputClassName} pl-11`} value={form.expectedArrivalTime} onChange={(event) => updateForm({ expectedArrivalTime: event.target.value })} />
            </div>
          </label>
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          <label>
            <span className={labelClassName}>Tuyến</span>
            <select className={inputClassName} value={form.routeId} onChange={(event) => updateForm({ routeId: event.target.value })}>
              <option value="">Chọn tuyến</option>
              {routes.map((route) => <option key={route._id} value={route._id} disabled={route.status !== 'PUBLISHED'}>{route.routeCode} - {route.routeName}{route.status !== 'PUBLISHED' ? ' (chưa công bố)' : ''}</option>)}
            </select>
          </label>
          <label>
            <span className={labelClassName}>Chiều chạy</span>
            <select className={inputClassName} value={form.direction} onChange={(event) => updateForm({ direction: event.target.value })}>
              <option value="OUTBOUND">Chiều đi</option>
              <option value="INBOUND">Chiều về</option>
            </select>
          </label>
        </div>
        <div className="grid gap-2 lg:grid-cols-3">
          <label>
            <span className={labelClassName}>Xe khai thác</span>
            <select className={inputClassName} value={form.busId} onChange={(event) => updateForm({ busId: event.target.value })}>
              <option value="">Chưa gán xe</option>
              {availableBuses.map((bus) => <option key={bus._id} value={bus._id}>{bus.busCode} - {bus.plateNumber} ({bus.capacity || 0} chỗ)</option>)}
            </select>
          </label>
          <label>
            <span className={labelClassName}>Tài xế</span>
            <select className={inputClassName} value={form.driverId} onChange={(event) => updateForm({ driverId: event.target.value })}>
              <option value="">Chưa gán tài xế</option>
              {driverOptions.map((driver) => {
                const isCurrent = currentDriverOption && String(driver._id || '') === String(currentDriverOption._id || '');
                return <option key={driver._id} value={driver._id}>{driver.fullName}{driver.phone ? ` - ${driver.phone}` : ''}{isCurrent ? ' (đang gán)' : ''}</option>;
              })}
            </select>
            {form.serviceDate && form.departureTime && form.expectedArrivalTime && !availableDrivers.length && currentDriverOption ? (
              <span className="mt-1 block text-xs font-semibold text-amber-600">Đang hiển thị tài xế đã gán hiện tại; chưa có tài xế thay thế hợp lệ trong khung giờ này.</span>
            ) : null}
            {form.serviceDate && form.departureTime && form.expectedArrivalTime && !availableDrivers.length && !currentDriverOption ? (
              <span className="mt-1 block text-xs font-semibold text-amber-600">Không có tài xế có ca đã công bố/phê duyệt bao phủ chuyến hoặc tài xế đã bận trong khung giờ này.</span>
            ) : null}
          </label>
          <label>
            <span className={labelClassName}>Phụ xe</span>
            <select className={inputClassName} value={form.assistantId} onChange={(event) => updateForm({ assistantId: event.target.value })}>
              <option value="">Chưa gán phụ xe</option>
              {assistantOptions.map((staff) => {
                const isCurrent = currentAssistantOption && String(staff._id || '') === String(currentAssistantOption._id || '');
                return <option key={staff._id} value={staff._id}>{staff.fullName}{staff.phone ? ` - ${staff.phone}` : ''}{isCurrent ? ' (đang gán)' : ''}</option>;
              })}
            </select>
            {form.serviceDate && form.departureTime && form.expectedArrivalTime && !availableAssistants.length && currentAssistantOption ? (
              <span className="mt-1 block text-xs font-semibold text-amber-600">Đang hiển thị phụ xe đã gán hiện tại; chưa có phụ xe thay thế hợp lệ trong khung giờ này.</span>
            ) : null}
            {form.serviceDate && form.departureTime && form.expectedArrivalTime && !availableAssistants.length && !currentAssistantOption ? (
              <span className="mt-1 block text-xs font-semibold text-amber-600">Không có phụ xe có ca đã công bố/phê duyệt bao phủ chuyến hoặc phụ xe đã bận trong khung giờ này.</span>
            ) : null}
          </label>
        </div>
        {selectedRoute ? (
          <div className="grid gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800 sm:grid-cols-4">
            <span><strong>Tuyến:</strong> {selectedRoute.routeCode} - {selectedRoute.routeName}</span>
            <span><strong>Chiều:</strong> {scheduleDirectionLabels[form.direction]}</span>
            <span><strong>Thời lượng ước tính:</strong> {estimatedDurationMinutes || 0} phút</span>
            <span><strong>Khung khai thác:</strong> {FIRST_BUS_DEPARTURE_TIME}-{LAST_BUS_DEPARTURE_TIME}</span>
          </div>
        ) : null}
        {routeScheduleMismatch && !scheduleHardLimitError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-bold">{routeScheduleMismatch}</p>
            <label className="mt-3 flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={form.isScheduleException} onChange={(event) => updateForm({ isScheduleException: event.target.checked })} />
              Xác nhận tạo chuyến ngoại lệ
            </label>
            {form.isScheduleException ? (
              <textarea
                className={`${inputClassName} mt-3 min-h-20`}
                placeholder="Nhập lý do tạo chuyến ngoài cấu hình..."
                value={form.exceptionReason}
                onChange={(event) => updateForm({ exceptionReason: event.target.value })}
              />
            ) : null}
          </div>
        ) : null}
        {scheduleHardLimitError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
            {scheduleHardLimitError}
          </div>
        ) : null}
        {assignmentConflict ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Trùng phân công với lịch {assignmentConflict.scheduleCode} lúc {assignmentConflict.departureTime}. Hệ thống sẽ không lưu cho đến khi đổi xe, tài xế, phụ xe hoặc giờ xuất bến.
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="submit" disabled={isSaving || Boolean(assignmentConflict) || Boolean(scheduleHardLimitError)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60">
            <span className="material-symbols-outlined text-lg">{editingScheduleId ? 'edit_calendar' : 'event_available'}</span>
            {editingScheduleId ? 'Cập nhật lịch' : 'Tạo lịch chuyến'}
          </button>
          <button type="button" onClick={resetForm} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
            <span className="material-symbols-outlined text-lg">refresh</span>
            Làm mới
          </button>
        </div>
        {message ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{message}</div> : null}
      </form>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-950">Lịch chuyến đã phân công</h3>
            <p className="mt-1 text-xs text-slate-500">Chọn một lịch để sửa nhanh ở form phía trên.</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{schedules.length} lịch</span>
        </div>
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {schedules.map((schedule) => (
            <button key={schedule._id} type="button" onClick={() => editSchedule(schedule)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm hover:border-emerald-300 hover:bg-emerald-50">
              <span className="block font-black text-slate-900">{schedule.scheduleCode} - {schedule.routeCode} - {schedule.departureTime}{schedule.expectedArrivalTime ? ` đến ${schedule.expectedArrivalTime}` : ''}</span>
              <span className="mt-1 block text-xs text-slate-500">{toDateInputValue(schedule.serviceDate)} | {scheduleDirectionLabels[schedule.direction] || schedule.direction} | {scheduleStatusLabels[schedule.status] || schedule.status}</span>
              <span className="mt-1 block text-xs text-slate-500">{schedule.vehicle?.busCode || 'Chưa gán xe'} | {schedule.driver?.fullName || 'Chưa gán tài xế'} | {schedule.assistant?.fullName || 'Chưa gán phụ xe'}</span>
            </button>
          ))}
          {!schedules.length ? <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Chưa có lịch chuyến.</div> : null}
        </div>
      </div>
    </div>
  );
};

export const FleetOperationsPanel = ({ buses, onSaved }) => {
  const [query, setQuery] = useState('');
  const [editingBusId, setEditingBusId] = useState('');
  const [form, setForm] = useState(emptyBusForm);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputClassName = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-300';
  const filteredBuses = useMemo(() => {
    const normalizedQuery = normalizeStationSearch(query);
    return buses
      .filter((bus) => !normalizedQuery || [bus.busCode, bus.plateNumber, bus.busType, bus.status].some((value) => normalizeStationSearch(value).includes(normalizedQuery)));
  }, [buses, query]);
  const resetForm = () => {
    setEditingBusId('');
    setForm(emptyBusForm);
    setMessage('');
  };
  const editBus = (bus) => {
    setEditingBusId(bus._id);
    setForm({
      busCode: bus.busCode || '',
      plateNumber: bus.plateNumber || '',
      busType: bus.busType || 'Standard City Bus',
      capacity: bus.capacity || BUS_CAPACITY_MIN,
      status: bus.status || 'ACTIVE',
    });
    setMessage('');
  };
  const saveBus = async (event) => {
    event.preventDefault();
    const capacity = Number(form.capacity);
    if (!form.busCode.trim() || !form.plateNumber.trim() || !form.busType.trim() || !Number.isFinite(capacity) || capacity < BUS_CAPACITY_MIN || capacity > BUS_CAPACITY_MAX) {
      setMessage(`Cần nhập mã xe, biển số, loại xe và sức chứa từ ${BUS_CAPACITY_MIN} đến ${BUS_CAPACITY_MAX} chỗ.`);
      return;
    }
    const payload = {
      ...form,
      capacity,
    };
    setIsSaving(true);
    try {
      if (editingBusId) {
        await adminService.updateBus(editingBusId, payload);
      } else {
        await adminService.createBus(payload);
      }
      const successMessage = editingBusId ? 'Đã cập nhật thông tin xe.' : 'Đã đăng ký xe mới.';
      resetForm();
      setMessage(successMessage);
      await onSaved?.();
    } catch (error) {
      setMessage(error?.message || 'Không thể lưu xe.');
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950">Quản lý đội xe</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Đăng ký xe và cập nhật trạng thái bảo trì.</p>
          </div>
          <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-bold text-sky-700">{buses.length}</span>
        </div>
        <form onSubmit={saveBus} className="mt-4 grid gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={inputClassName} placeholder="Mã xe" value={form.busCode} onChange={(event) => setForm((current) => ({ ...current, busCode: event.target.value }))} />
            <input className={inputClassName} placeholder="Biển số" value={form.plateNumber} onChange={(event) => setForm((current) => ({ ...current, plateNumber: event.target.value }))} />
          </div>
          <input className={inputClassName} placeholder="Loại xe" value={form.busType} onChange={(event) => setForm((current) => ({ ...current, busType: event.target.value }))} />
          <div className="grid gap-2 sm:grid-cols-2">
            <input type="number" min={BUS_CAPACITY_MIN} max={BUS_CAPACITY_MAX} className={inputClassName} placeholder={`Sức chứa ${BUS_CAPACITY_MIN}-${BUS_CAPACITY_MAX} chỗ`} value={form.capacity} onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))} />
            <select disabled className={`${inputClassName} disabled:cursor-not-allowed disabled:bg-slate-100`} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
              <option value="AVAILABLE">{busStatusLabels.AVAILABLE}</option>
              <option value="ACTIVE">{busStatusLabels.ACTIVE}</option>
              <option value="ISSUE">{busStatusLabels.ISSUE}</option>
              <option value="MAINTENANCE">{busStatusLabels.MAINTENANCE}</option>
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="submit" disabled={isSaving} className="rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60">{editingBusId ? 'Cập nhật xe' : 'Thêm xe mới'}</button>
            <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">Làm mới</button>
          </div>
          {message ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{message}</div> : null}
        </form>
      </div>

      <aside className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-slate-950">Danh sách xe</h2>
          <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-bold text-sky-700">{filteredBuses.length}</span>
        </div>
        <input className={`${inputClassName} mt-4`} placeholder="Tìm xe để cập nhật..." value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {filteredBuses.map((bus) => (
            <button key={bus._id} type="button" onClick={() => editBus(bus)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm hover:border-sky-300">
              <span className="block font-black text-slate-900">{bus.busCode} - {bus.plateNumber}</span>
              <span className="mt-1 block text-xs text-slate-500">{bus.busType} | {bus.capacity} chỗ | {busStatusLabels[bus.status] || bus.status}</span>
            </button>
          ))}
          {!filteredBuses.length ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Không tìm thấy xe phù hợp.</div>
          ) : null}
        </div>
      </aside>
    </div>
  );
};

const StopOperationsPanel = ({ isDarkMode, onSaved, routes, stations }) => {
  const [addressQuery, setAddressQuery] = useState('');
  const [stationQuery, setStationQuery] = useState('');
  const [editingStationId, setEditingStationId] = useState('');
  const [form, setForm] = useState(emptyStopForm);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingStationId, setDeletingStationId] = useState('');
  const [addressSearchResults, setAddressSearchResults] = useState([]);
  const [addressSearchLoading, setAddressSearchLoading] = useState(false);
  const [selectedAddressResult, setSelectedAddressResult] = useState(null);

  const matchingStations = useMemo(() => {
    const normalizedQuery = normalizeStationSearch(stationQuery);
    return stations
      .filter((station) => station.source === 'MANUAL')
      .filter((station) => !normalizedQuery || [
        station.stationCode,
        station.stationName,
        station.address,
        station.district,
        station.ward,
      ].some((value) => normalizeStationSearch(value).includes(normalizedQuery)));
  }, [stationQuery, stations]);
  const filteredStations = matchingStations;
  const quickSuggestions = useMemo(() => {
    return stations
      .filter((station) => isInsideDaNang(station.latitude, station.longitude))
      .slice(0, 5);
  }, [stations]);
  const requestedHouseNumber = addressQuery.trim().match(/^\s*(\d+[A-Za-z]?(?:[/-]\d+[A-Za-z]?)?)/)?.[1] || '';
  const requiresExactHouseNumber = Boolean(requestedHouseNumber);
  const getExactHouseNumberError = () => (
    `Chưa tìm thấy tọa độ chính xác cho số nhà ${requestedHouseNumber}. Cần nguồn dữ liệu có house_number, ví dụ cấu hình GOOGLE_MAPS_API_KEY, hoặc chọn thủ công trên bản đồ.`
  );
  const getAddressResultMessage = (result) => {
    if (result?.exactStreetNumber) {
      return 'Đã đặt marker xanh đúng tọa độ số nhà tìm thấy trên bản đồ.';
    }
    if (requiresExactHouseNumber) {
      return getExactHouseNumberError();
    }
    return 'Đã đặt marker xanh tại tọa độ gần nhất tìm thấy. Nếu chưa đúng cửa nhà, kéo marker xanh để chỉnh chính xác.';
  };

  const searchAddress = async (event) => {
    event?.preventDefault();
    const searchText = addressQuery.trim();
    if (searchText.length < 3) {
      setAddressSearchResults([]);
      setSelectedAddressResult(null);
      setMessage('Nhập ít nhất 3 ký tự để tìm địa điểm.');
      return;
    }

    setAddressSearchLoading(true);
    setSelectedAddressResult(null);
    setMessage('');
    try {
      const response = await adminService.searchStopAddresses(searchText);
      const results = response.results || [];
      setAddressSearchResults(results);
      const firstResult = requiresExactHouseNumber
        ? results.find((result) => result.exactStreetNumber)
        : results[0];
      if (firstResult) {
        setSelectedAddressResult(firstResult);
        setEditingStationId('');
        setForm((current) => ({
          ...current,
          _id: '',
          address: firstResult.address || firstResult.displayName || current.address,
          latitude: Number(firstResult.latitude).toFixed(6),
          longitude: Number(firstResult.longitude).toFixed(6),
          district: firstResult.district || current.district,
          ward: firstResult.ward || current.ward,
        }));
        setErrors((current) => ({ ...current, address: undefined, latitude: undefined, longitude: undefined }));
        setMessage(getAddressResultMessage(firstResult));
      } else if (results.length && requiresExactHouseNumber) {
        setMessage(getExactHouseNumberError());
      } else {
        setMessage('Không tìm thấy địa điểm phù hợp.');
      }
    } catch (error) {
      setAddressSearchResults([]);
      setMessage(error?.message || 'Không thể tìm địa điểm.');
    } finally {
      setAddressSearchLoading(false);
    }
  };

  const resetForm = () => {
    setEditingStationId('');
    setForm(emptyStopForm);
    setErrors({});
    setMessage('');
    setAddressSearchResults([]);
    setSelectedAddressResult(null);
    setAddressQuery('');
    setStationQuery('');
  };

  const handleAddressSearchChange = (value) => {
    setAddressQuery(value);
    setAddressSearchResults([]);
    setSelectedAddressResult(null);
    setEditingStationId('');
  };

  const editStation = (station) => {
    setEditingStationId(station._id);
    setForm({
      _id: station._id || '',
      stationCode: station.stationCode || '',
      stationName: station.stationName || '',
      address: station.address || '',
      latitude: station.latitude ?? '',
      longitude: station.longitude ?? '',
      district: station.district || '',
      ward: station.ward || '',
      isMainStation: Boolean(station.isMainStation),
    });
    setErrors({});
    setMessage('');
  };
  const pickMapLocation = ({ lat, lng }) => {
    setForm((current) => ({
      ...current,
      _id: current._id || '',
      latitude: Number(lat).toFixed(6),
      longitude: Number(lng).toFixed(6),
    }));
    setErrors((current) => ({ ...current, latitude: undefined, longitude: undefined }));
    setMessage('Đã lấy tọa độ từ bản đồ.');
  };
  const pickSuggestedStation = (station) => {
    editStation(station);
    setMessage('Đã điền thông tin từ trạm gợi ý.');
  };

  const deleteStation = async (station) => {
    const stationName = station.stationName || 'trạm này';
    if (!window.confirm(`Xóa trạm "${stationName}"? Thao tác này không thể hoàn tác.`)) return;

    setDeletingStationId(station._id);
    setMessage('');
    try {
      await adminService.deleteBusStop(station._id);
      if (String(editingStationId) === String(station._id)) resetForm();
      await onSaved?.();
      const successMessage = `Đã xóa trạm "${stationName}".`;
      setMessage(successMessage);
      toast.success(successMessage);
    } catch (error) {
      const errorMessage = error?.message || 'Không thể xóa trạm.';
      setMessage(errorMessage);
      toast.error(errorMessage);
    } finally {
      setDeletingStationId('');
    }
  };
  const pickAddressResult = (result) => {
    if (requiresExactHouseNumber && !result.exactStreetNumber) {
      setSelectedAddressResult(null);
      setMessage(getExactHouseNumberError());
      return;
    }
    setSelectedAddressResult(result);
    setEditingStationId('');
    setForm((current) => ({
      ...current,
      _id: '',
      address: result.address || result.displayName || '',
      latitude: Number(result.latitude).toFixed(6),
      longitude: Number(result.longitude).toFixed(6),
      district: result.district || current.district,
      ward: result.ward || current.ward,
    }));
    setErrors((current) => ({ ...current, address: undefined, latitude: undefined, longitude: undefined }));
    setMessage(getAddressResultMessage(result));
  };

  const fillStopFromSearch = () => {
    const result = selectedAddressResult
      || (requiresExactHouseNumber
        ? addressSearchResults.find((item) => item.exactStreetNumber)
        : addressSearchResults[0]);
    if (!result) {
      setMessage(requiresExactHouseNumber ? getExactHouseNumberError() : 'Hãy tìm và chọn một địa điểm trước khi thêm trạm nhanh.');
      return;
    }

    const suggestedName = String(result.displayName || result.address || addressQuery)
      .split(',')[0]
      .trim();
    setEditingStationId('');
    setSelectedAddressResult(result);
    setForm((current) => ({
      ...current,
      _id: '',
      stationName: current.stationName || suggestedName,
      address: result.address || result.displayName || current.address,
      latitude: Number(result.latitude).toFixed(6),
      longitude: Number(result.longitude).toFixed(6),
      district: result.district || current.district,
      ward: result.ward || current.ward,
    }));
    setErrors((current) => ({ ...current, stationName: undefined, address: undefined, latitude: undefined, longitude: undefined }));
    setMessage('Đã điền nhanh tên trạm, địa chỉ và tọa độ.');
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!form.stationName.trim()) nextErrors.stationName = 'Nhập tên trạm';
    if (!form.address.trim()) nextErrors.address = 'Nhập địa chỉ';
    if (!Number.isFinite(Number(form.latitude))) nextErrors.latitude = 'Tọa độ không hợp lệ';
    if (!Number.isFinite(Number(form.longitude))) nextErrors.longitude = 'Tọa độ không hợp lệ';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const saveStop = async (event) => {
    event.preventDefault();
    setMessage('');
    if (!validateForm()) return;

    const payload = {
      ...form,
      _id: undefined,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      source: 'MANUAL',
      isActive: true,
    };

    setIsSaving(true);
    try {
      const successMessage = editingStationId ? 'Đã cập nhật thông tin trạm.' : 'Đã tạo trạm mới.';
      if (editingStationId) {
        await adminService.updateBusStop(editingStationId, payload);
      } else {
        await adminService.createBusStop(payload);
      }
      resetForm();
      setMessage(successMessage);
      toast.success(successMessage);
      await onSaved?.();
    } catch (error) {
      const errorMessage = error?.message || 'Không thể lưu trạm.';
      setMessage(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const labelClassName = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const stopInputClassName = 'h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100';

  return (
    <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-white text-slate-900 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 bg-gradient-to-r from-emerald-950 to-emerald-800 px-6 py-5 text-white">
        <div>
          <h2 className="text-xl font-black">Quản lý trạm dừng</h2>
          <p className="mt-1 text-sm leading-5 text-emerald-100">
            Tìm vị trí, tạo trạm và quản lý thư viện điểm dừng trên cùng một màn hình.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/15 px-4 py-2 text-xs font-black text-white">{stations.length} trạm khả dụng · {routes.length} tuyến</span>
      </div>

      <div className="grid items-start gap-5 p-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <form onSubmit={saveStop} className="grid content-start gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
          <div>
            <h3 className="text-sm font-black text-slate-950">Thông tin trạm</h3>
            <p className="mt-1 text-xs text-slate-500">Nhập thông tin cơ bản hoặc chọn nhanh một trạm trên bản đồ.</p>
          </div>
          <label>
            <span className={`mb-1 block text-[11px] font-bold uppercase tracking-[0.18em] ${labelClassName}`}>Tên trạm</span>
            <input className={stopInputClassName} value={form.stationName} onChange={(event) => setForm((current) => ({ ...current, stationName: event.target.value }))} />
            {errors.stationName ? <span className="mt-1 block text-xs text-rose-600">{errors.stationName}</span> : null}
          </label>
          <label>
            <span className={`mb-1 block text-[11px] font-bold uppercase tracking-[0.18em] ${labelClassName}`}>Địa chỉ</span>
            <input className={stopInputClassName} value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
            {errors.address ? <span className="mt-1 block text-xs text-rose-600">{errors.address}</span> : null}
          </label>
          <div>
            <span className={`mb-1 block text-[11px] font-bold uppercase tracking-[0.18em] ${labelClassName}`}>Tìm địa điểm</span>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_44px_160px]">
              <input
                className={stopInputClassName}
                value={addressQuery}
                onChange={(event) => handleAddressSearchChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') searchAddress(event);
                }}
                placeholder="Nhập địa chỉ hoặc tên địa điểm..."
              />
              <button
                type="button"
                onClick={searchAddress}
                disabled={addressSearchLoading}
                aria-label="Tìm địa điểm"
                className="h-11 rounded-lg border border-slate-200 bg-white text-lg font-black text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700 disabled:opacity-60"
              >
                {addressSearchLoading ? '…' : '⌕'}
              </button>
              <button
                type="button"
                onClick={fillStopFromSearch}
                disabled={!selectedAddressResult && !addressSearchResults.length}
                className="h-11 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Thêm trạm nhanh
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Chỉ tìm trong khu vực Đà Nẵng. Chọn kết quả để xem vị trí, sau đó có thể kéo marker để chỉnh tọa độ.</p>
            {addressSearchResults.length ? (
              <div className="mt-2 grid max-h-40 gap-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                {addressSearchResults.map((result) => {
                  const isSelected = String(selectedAddressResult?.id || '') === String(result.id || '');
                  return (
                    <button
                      key={`address-${result.id}`}
                      type="button"
                      onClick={() => pickAddressResult(result)}
                      className={`rounded-lg border px-3 py-2 text-left text-xs transition ${isSelected ? 'border-cyan-400 bg-cyan-50' : 'border-slate-200 hover:border-cyan-300 hover:bg-slate-50'}`}
                    >
                      <span className="block text-sm font-black text-slate-900">{result.displayName}</span>
                      <span className="mt-1 block font-semibold text-slate-500">
                        {result.exactStreetNumber
                          ? 'Khớp số nhà'
                          : requiresExactHouseNumber
                            ? 'Không khớp số nhà, không đặt marker tự động'
                            : 'Chưa có tọa độ số nhà, bấm để đặt marker gần nhất'}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={form.isMainStation} onChange={(event) => setForm((current) => ({ ...current, isMainStation: event.target.checked }))} />
            Trạm chính / bến đầu cuối
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="submit" disabled={isSaving} className="h-11 rounded-lg bg-emerald-400 px-4 text-sm font-black text-slate-950 shadow-sm transition hover:bg-emerald-300 disabled:opacity-60">
              {editingStationId ? 'Cập nhật trạm' : 'Tạo trạm mới'}
            </button>
            <button type="button" onClick={resetForm} className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
              Làm mới
            </button>
          </div>
          {message ? <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</div> : null}
        </form>
        <div className="grid min-w-0 content-start gap-4">
          <StopMapPicker
            form={form}
            onPickLocation={pickMapLocation}
            onPickStation={pickSuggestedStation}
            stations={stations}
          />
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-slate-950">Gợi ý nhanh</h3>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{quickSuggestions.length}</span>
            </div>
            <div className="mt-3 grid max-h-44 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
              {quickSuggestions.map((station) => (
                <button key={station._id} type="button" onClick={() => pickSuggestedStation(station)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:border-emerald-300 hover:shadow-sm">
                  <span className="block font-black text-slate-900">{station.stationName || station.stationCode}</span>
                  <span className="mt-1 block text-xs text-slate-500">{station.address}</span>
                </button>
              ))}
              {!quickSuggestions.length ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-3 text-sm text-slate-500">Chưa có trạm phù hợp để gợi ý.</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-5 mb-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-950">Trạm được tạo mới</h3>
            <p className="mt-1 text-xs text-slate-500">Xem, sửa hoặc xóa các trạm do admin tạo thủ công.</p>
          </div>
          <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-slate-600">{filteredStations.length}</span>
        </div>
        <input className={stopInputClassName} placeholder="Tìm theo tên hoặc địa chỉ..." value={stationQuery} onChange={(event) => setStationQuery(event.target.value)} />
        <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
          {filteredStations.map((station) => (
            <div key={station._id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm transition hover:border-emerald-300 hover:shadow-sm">
              <span className="block font-black text-slate-900">{station.stationName}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{station.address}</span>
              <span className="mt-1 block text-xs text-slate-400">
                {Number(station.latitude).toFixed(6)}, {Number(station.longitude).toFixed(6)}
              </span>
              <span className="mt-1 block text-xs text-slate-400">{station.routeAssignments?.length || 0} lượt gán | {routes.length} tuyến trong thư viện</span>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => editStation(station)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100">
                  Xem / Sửa
                </button>
                <button type="button" onClick={() => deleteStation(station)} disabled={deletingStationId === station._id} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:opacity-50">
                  {deletingStationId === station._id ? 'Đang xóa...' : 'Xóa'}
                </button>
              </div>
            </div>
          ))}
          {!filteredStations.length ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500 sm:col-span-2 xl:col-span-3">
              {stationQuery ? 'Không tìm thấy trạm được tạo mới phù hợp.' : 'Chưa có trạm nào do admin tạo.'}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const RouteWorkflowPage = () => {
  const { isDarkMode } = useTheme();
  const [stations, setStations] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [scheduleForEditing, setScheduleForEditing] = useState(null);
  const [emergencySchedule, setEmergencySchedule] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [assistantStaff, setAssistantStaff] = useState([]);
  const [driverShiftAssignments, setDriverShiftAssignments] = useState([]);
  const [assistantShiftAssignments, setAssistantShiftAssignments] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedCoreData = useRef(false);
  const [error, setError] = useState('');
  const [activeOperationSection, setActiveOperationSection] = useState('routes');
  const activeStep = useRouteWorkflowStore((state) => state.activeStep);
  const setActiveStep = useRouteWorkflowStore((state) => state.setActiveStep);
  const loadRoute = useRouteWorkflowStore((state) => state.loadRoute);
  const resetDraft = useRouteWorkflowStore((state) => state.resetDraft);

  const shellClassName = isDarkMode ? 'bg-[#071516] text-slate-100' : 'bg-[#f4fbfd] text-slate-900';
  const panelClassName = isDarkMode
    ? 'border-white/10 bg-[#0f1d1f]/92 shadow-[0_20px_60px_rgba(0,0,0,0.22)]'
    : 'border-slate-200 bg-white/96 shadow-[0_20px_44px_rgba(148,163,184,0.14)]';
  const inputClassName = `w-full rounded-xl border px-4 py-3 text-sm outline-none ${
    isDarkMode ? 'border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500' : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400'
  }`;

  useEffect(() => {
    if (activeStep > steps.length - 1) setActiveStep(steps.length - 1);
  }, [activeStep, setActiveStep]);

  const loadData = useCallback(async () => {
    const isInitialRequest = !hasLoadedCoreData.current;
    if (isInitialRequest) setIsInitialLoading(true);
    else setIsRefreshing(true);
    setError('');
    try {
      const stationsRequest = adminService.getStations({ limit: 1000 });
      const routesRequest = adminService.getRoutes({ limit: 100 });
      const busesRequest = adminService.getBuses();
      const staffRequest = adminService.getDrivers();
      const schedulesRequest = loadAllTripSchedules();
      const shiftAssignmentsRequest = adminService.getShiftAssignments();
      const operationsRequest = Promise.all([
        busesRequest,
        staffRequest,
        schedulesRequest,
        shiftAssignmentsRequest,
      ]).then((value) => ({ value }), (requestError) => ({ requestError }));

      // Route and station data are enough to render the main workflow. The
      // heavier operations datasets continue loading without blocking the UI.
      const [stationsResponse, routesResponse] = await Promise.all([stationsRequest, routesRequest]);
      setStations(stationsResponse.stations || []);
      setRoutes(routesResponse.routes || []);
      hasLoadedCoreData.current = true;
      setIsInitialLoading(false);

      const operationsResult = await operationsRequest;
      if (operationsResult.requestError) throw operationsResult.requestError;
      const [busesResponse, staffResponse, schedulesResponse, shiftAssignmentsResponse] = operationsResult.value;
      setBuses(busesResponse.buses || []);
      setDrivers(staffResponse.drivers || []);
      setAssistantStaff(staffResponse.assistantStaff || []);
      setDriverShiftAssignments(shiftAssignmentsResponse.driverAssignments || []);
      setAssistantShiftAssignments(shiftAssignmentsResponse.assistantAssignments || []);
      const nextSchedules = schedulesResponse.schedules || [];
      setSchedules(nextSchedules);
      setSelectedSchedule((current) => (
        nextSchedules.find((schedule) => String(schedule._id) === String(current?._id))
        || null
      ));
    } catch (loadError) {
      setError(loadError?.message || 'Không thể tải dữ liệu quản lý tuyến.');
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const deleteSchedule = async (schedule) => {
    const confirmed = window.confirm(`Xóa ca ${schedule.scheduleCode}? Thao tác này không thể hoàn tác.`);
    if (!confirmed) return;
    try {
      await adminService.deleteTripSchedule(schedule._id);
      if (String(scheduleForEditing?._id || '') === String(schedule._id)) setScheduleForEditing(null);
      if (String(emergencySchedule?._id || '') === String(schedule._id)) setEmergencySchedule(null);
      await loadData();
    } catch (deleteError) {
      setError(deleteError?.message || 'Không thể xóa ca làm.');
    }
  };

  const deleteAllSchedules = async () => {
    const confirmed = window.confirm('Xóa toàn bộ lịch chuyến chưa chạy/chưa hoàn thành? Các lịch đang chạy, đã hoàn thành hoặc đã hủy sẽ được giữ lại.');
    if (!confirmed) return;
    try {
      const response = await adminService.deleteTripSchedules({ confirmAll: true });
      setScheduleForEditing(null);
      setEmergencySchedule(null);
      setSelectedSchedule(null);
      toast.success(`Đã xóa ${response.deletedCount || 0} lịch chuyến.`);
      if (response.protectedCount) {
        toast(`Giữ lại ${response.protectedCount} lịch đang chạy/đã hoàn thành/đã hủy.`);
      }
      await loadData();
    } catch (deleteError) {
      setError(deleteError?.message || 'Không thể xóa toàn bộ lịch chuyến.');
    }
  };

  const openScheduleEditor = useCallback((schedule) => {
    if (!schedule?._id) return;
    const freshSchedule = schedules.find((item) => String(item._id || '') === String(schedule._id));
    const targetSchedule = freshSchedule || schedule;
    setScheduleForEditing({ ...targetSchedule });
    setSelectedSchedule(targetSchedule);
    setActiveOperationSection('scheduling');
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
  }, [schedules]);

  const openRoute = async (routeId) => {
    try {
      const response = await adminService.getRouteDetail(routeId);
      loadRoute(normalizeRouteFromApi(response.route));
      setActiveStep(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (routeError) {
      setError(routeError?.message || 'Không thể mở tuyến.');
    }
  };

  const suspendRoute = async (routeId) => {
    try {
      await adminService.suspendRoute(routeId, { reason: 'Tạm dừng bởi quản trị viên' });
      await loadData();
    } catch (routeError) {
      setError(routeError?.message || 'Không thể tạm dừng tuyến.');
    }
  };

  const activeStepContent = [
    <CreateRouteStep key="create" inputClassName={inputClassName} panelClassName={panelClassName} routes={routes} stations={stations} />,
    <DefinePathStep key="path" inputClassName={inputClassName} panelClassName={panelClassName} stations={stations} isDarkMode={isDarkMode} />,
    <ReviewRouteStep key="review" panelClassName={panelClassName} isDarkMode={isDarkMode} onSaved={loadData} routes={routes} />,
  ];

  if (isInitialLoading) {
    return (
      <div className="min-h-full bg-slate-950 text-white">
        <div className="px-6 py-16 text-center">
          <p className="text-sm uppercase tracking-[0.32em] text-slate-500">Đang tải workflow quản lý tuyến</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-full overflow-hidden ${shellClassName}`}>
      <WarningModal open={Boolean(error)} message={error} onClose={() => setError('')} />
      <main className="relative min-h-full py-4">
        <style>{`
          .route-workflow-readable .bg-white,
          .route-workflow-readable .bg-slate-50 {
            color: #0f172a;
          }
          .route-workflow-readable .bg-white .text-white,
          .route-workflow-readable .bg-white .text-slate-100,
          .route-workflow-readable .bg-slate-50 .text-white,
          .route-workflow-readable .bg-slate-50 .text-slate-100 {
            color: #0f172a;
          }
        `}</style>
        <div className={`absolute inset-0 ${isDarkMode ? 'bg-[#071516]' : 'bg-[#f4fbfd]'}`} />
        <div className="pointer-events-none absolute inset-0">
          <img src={HOME_BUS_HERO_IMAGE} alt="" aria-hidden="true" className="h-full w-full object-cover object-center" style={{ opacity: isDarkMode ? 0.28 : 0.06 }} />
          <div className={`absolute inset-0 ${isDarkMode ? 'bg-[#001a0f]/75' : 'bg-white/80'}`} />
        </div>
        <div className="route-workflow-readable relative mx-auto max-w-[1500px] px-4 pb-8 lg:px-6">
          <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-[#062819] px-5 py-4 text-white shadow-lg shadow-emerald-950/15 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-300">Quản lý tuyến</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight">Quản lý tuyến xe buýt</h1>
              <p className="mt-1 max-w-3xl text-sm text-emerald-50/80">
                Hoàn tất các nghiệp vụ quản trị: tạo tuyến, cập nhật thông tin, dựng lộ trình hai chiều, quản lý trạm dừng và điều phối đội xe.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={resetDraft} className="h-10 rounded-xl bg-white px-4 text-sm font-bold text-emerald-950">
                Tạo bản nháp mới
              </button>
              <button type="button" disabled={isRefreshing} onClick={loadData} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-bold text-white disabled:opacity-60">
                <span className={`material-symbols-outlined text-base ${isRefreshing ? 'animate-spin' : ''}`}>refresh</span>
                {isRefreshing ? 'Đang đồng bộ' : 'Tải lại'}
              </button>
            </div>
          </div>

          <div className={`mb-4 rounded-2xl border p-2 ${panelClassName}`}>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              {operationSections.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveOperationSection(section.key)}
                  className={`rounded-xl border px-4 py-2.5 text-left transition ${
                    activeOperationSection === section.key
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : isDarkMode
                        ? 'border-white/10 bg-white/[0.03] text-slate-300'
                        : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <span className="block text-sm font-black">{section.label}</span>
                  <span className="mt-1 block text-xs opacity-75">{section.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {activeOperationSection === 'routes' ? (
          <div className={`mb-4 rounded-2xl border p-2 ${panelClassName}`}>
            <div className="grid gap-2 md:grid-cols-3">
              {steps.map((step, index) => (
                <button
                  key={step.label}
                  type="button"
                  onClick={() => setActiveStep(index)}
                  className={`rounded-xl border px-4 py-2.5 text-left transition ${
                    activeStep === index
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : isDarkMode
                        ? 'border-white/10 bg-white/[0.03] text-slate-300'
                        : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <span className="text-xs font-black uppercase tracking-[0.2em]">Bước {index + 1}</span>
                  <span className="mt-1 block text-sm font-black">{step.label}</span>
                  <span className="mt-1 block text-xs opacity-70">{step.hint}</span>
                </button>
              ))}
            </div>
          </div>
          ) : null}

          {activeOperationSection === 'routes' ? (
          <div className={`mb-4 grid gap-4 ${activeStep === 2 ? 'xl:grid-cols-[minmax(0,1fr)_280px]' : 'xl:grid-cols-[minmax(0,1fr)_320px]'}`}>
            <div>{activeStepContent[activeStep]}</div>
            <aside className={`rounded-2xl border p-4 ${panelClassName}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">Thư viện tuyến</h2>
                <span className="text-xs font-bold text-slate-500">{routes.length} tuyến</span>
              </div>
              <div className="mt-3 max-h-[500px] space-y-2 overflow-y-auto pr-1">
                {routes.length ? routes.map((route) => (
                  <div key={route._id} className="rounded-xl border border-slate-200 bg-white p-3 text-slate-800">
                    <div className="w-full text-left">
                      <span className="block text-sm font-black">{route.routeCode} - {route.routeName}</span>
                      <span className="mt-1 block text-xs text-slate-500">{routeStatusLabels[route.status] || route.status} - {route.analytics?.totalStops || 0} trạm</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => openRoute(route._id)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">
                        Cập nhật
                      </button>
                      <button type="button" disabled={route.status === 'SUSPENDED'} onClick={() => suspendRoute(route._id)} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 disabled:opacity-40">
                        Tạm dừng
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">Chưa có tuyến để hiển thị.</div>
                )}
              </div>

            </aside>
          </div>
          ) : null}

          {activeOperationSection === 'stops' ? (
            <section className="mb-5 grid gap-5">
              <StopOperationsPanel
                isDarkMode={isDarkMode}
                onSaved={loadData}
                routes={routes}
                stations={stations}
              />
            </section>
          ) : null}

          {activeOperationSection === 'trip-planning' ? (
            <section className="mb-5 grid gap-5">
              <TripDemandPlanningPanel onSaved={loadData} routes={routes} schedules={schedules} />
            </section>
          ) : null}

          {activeOperationSection === 'trip-assignment' ? (
            <section className="mb-5">
              <TripAllocationPanel onEditSchedule={openScheduleEditor} onSaved={loadData} routes={routes} />
            </section>
          ) : null}

          {activeOperationSection === 'fleet' ? (
            <section className="mb-5 grid gap-5">
              <div className={`rounded-2xl border p-5 ${panelClassName}`}>
                <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-[220px]">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-500">Đội xe</p>
                    <div className="mt-2 flex items-end gap-3">
                      <h2 className="text-2xl font-black">Tổng quan đội xe</h2>
                      <span className="pb-1 text-sm font-bold text-slate-500">{buses.length} xe</span>
                    </div>
                  </div>
                  <div className="grid flex-1 gap-3 md:grid-cols-3">
                    {['AVAILABLE', 'ACTIVE', 'ISSUE', 'MAINTENANCE'].map((status) => {
                      const count = buses.filter((bus) => bus.status === status).length;
                      const percent = buses.length ? Math.round((count / buses.length) * 100) : 0;
                      const tone = busStatusOverview[status];

                      return (
                        <div key={status} className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <span className="text-sm font-black">{busStatusLabels[status] || status}</span>
                              <div className="mt-2 flex items-baseline gap-2">
                                <span className="text-3xl font-black">{count}</span>
                                <span className="text-sm font-bold text-slate-500">xe</span>
                              </div>
                            </div>
                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone.accentClassName}`}>
                              <span className="material-symbols-outlined text-xl">{tone.icon}</span>
                            </div>
                          </div>
                          <div className="mt-4">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                              <span>Tỷ lệ đội xe</span>
                              <span>{percent}%</span>
                            </div>
                            <div className="mt-2 h-2 rounded-full bg-slate-100">
                              <div className={`h-full rounded-full ${tone.barClassName}`} style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <FleetOperationsPanel
                buses={buses}
                onSaved={loadData} />
            </section>
          ) : null}

          {activeOperationSection === 'scheduling' ? (
            <section className="mb-5 grid gap-5">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <SchedulingOperationsPanel
                assistantShiftAssignments={assistantShiftAssignments}
                assistantStaff={assistantStaff}
                buses={buses}
                driverShiftAssignments={driverShiftAssignments}
                drivers={drivers}
                editingSchedule={scheduleForEditing}
                onSaved={loadData}
                routes={routes}
                schedules={schedules}
              />
              <aside className={`rounded-2xl border p-5 ${panelClassName}`}>
                <h2 className="text-lg font-black">Tổng quan lịch chuyến</h2>
                <div className="mt-4 grid gap-3">
                  {Object.entries(scheduleStatusLabels).map(([status, label]) => (
                    <div key={status} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
                      <span className="font-black text-slate-900">{label}</span>
                      <span className="mt-1 block text-slate-500">{schedules.filter((schedule) => schedule.status === status).length} lịch</span>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={deleteAllSchedules} className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-rose-200 px-4 py-3 text-sm font-black text-rose-600 hover:bg-rose-50">
                  Xóa toàn bộ lịch
                </button>
              </aside>
              </div>
            </section>
          ) : null}
        </div>
      </main>
        <EmergencyReassignmentModal
          assistantShiftAssignments={assistantShiftAssignments}
          assistantStaff={assistantStaff}
          buses={buses}
          driverShiftAssignments={driverShiftAssignments}
          drivers={drivers}
        onClose={() => setEmergencySchedule(null)}
        onSaved={loadData}
        schedule={emergencySchedule}
        schedules={schedules}
      />
    </div>
  );
};

export default RouteWorkflowPage;
