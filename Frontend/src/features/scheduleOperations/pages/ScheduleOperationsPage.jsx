import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  ZoomControl,
} from 'react-leaflet';
import {
  AlertTriangle,
  BellRing,
  BusFront,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  ListChecks,
  MapPin,
  PlayCircle,
  RefreshCw,
  Route,
  Send,
  UserRound,
  Wrench,
} from 'lucide-react';
import useAuthStore from '../../auth/stores/authStore.js';
import scheduleOperationsService from '../services/scheduleOperationsService.js';

const STATUS_META = {
  ASSIGNED: { label: 'Đã phân công', className: 'bg-amber-100 text-amber-900' },
  PENDING: { label: 'Chờ tiếp nhận', className: 'bg-amber-100 text-amber-900' },
  ACCEPTED: { label: 'Đã tiếp nhận', className: 'bg-emerald-100 text-emerald-800' },
  REJECTED: { label: 'Đã từ chối', className: 'bg-red-100 text-red-800' },
  CONFIRMED: { label: 'Đã xác nhận', className: 'bg-blue-100 text-blue-800' },
  COMPLETED: { label: 'Hoàn thành', className: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Đã hủy', className: 'bg-red-100 text-red-800' },
  SCHEDULED: { label: 'Đã lên lịch', className: 'bg-slate-100 text-slate-700' },
  READY: { label: 'Xe sẵn sàng', className: 'bg-emerald-100 text-emerald-800' },
  IN_PROGRESS: { label: 'Đang vận hành', className: 'bg-cyan-100 text-cyan-800' },
  NOT_STARTED: { label: 'Chưa kiểm tra', className: 'bg-slate-100 text-slate-700' },
  ISSUE_REPORTED: { label: 'Đã báo lỗi xe', className: 'bg-red-100 text-red-800' },
};

const CHECKLIST_ITEMS = [
  { key: 'tires', label: 'Lốp xe' },
  { key: 'brakes', label: 'Hệ thống phanh' },
  { key: 'lights', label: 'Đèn và tín hiệu' },
  { key: 'fuelOrBattery', label: 'Nhiên liệu / pin' },
  { key: 'safetyEquipment', label: 'Thiết bị an toàn' },
  { key: 'cleanliness', label: 'Vệ sinh xe' },
];

const ISSUE_CATEGORIES = [
  { value: 'ENGINE', label: 'Động cơ' },
  { value: 'BRAKE', label: 'Phanh' },
  { value: 'TIRE', label: 'Lốp xe' },
  { value: 'ELECTRICAL', label: 'Điện / đèn' },
  { value: 'CLEANLINESS', label: 'Vệ sinh' },
  { value: 'OTHER', label: 'Khác' },
];

const INCIDENT_TYPES = [
  { value: 'TRAFFIC_CONGESTION', label: 'UC46 - Báo kẹt xe' },
  { value: 'ACCIDENT', label: 'UC47 - Báo tai nạn' },
  { value: 'VEHICLE_BREAKDOWN', label: 'UC48 - Báo xe hỏng' },
  { value: 'PASSENGER_VIOLATION', label: 'UC50 - Báo hành khách vi phạm' },
  { value: 'PASSENGER_CONFLICT', label: 'UC51 - Báo xung đột hành khách' },
  { value: 'FOUND_ITEM', label: 'UC52 - Báo đồ tìm thấy' },
];

const DRIVER_INCIDENT_TYPES = INCIDENT_TYPES.filter((type) => [
  'TRAFFIC_CONGESTION',
  'ACCIDENT',
  'VEHICLE_BREAKDOWN',
  'PASSENGER_VIOLATION',
  'PASSENGER_CONFLICT',
  'FOUND_ITEM',
].includes(type.value));

const BUS_ASSISTANT_INCIDENT_TYPES = INCIDENT_TYPES.filter((type) => [
  'PASSENGER_VIOLATION',
  'PASSENGER_CONFLICT',
  'FOUND_ITEM',
].includes(type.value));

const INCIDENT_TYPE_DESCRIPTIONS = {
  TRAFFIC_CONGESTION: 'Báo ùn tắc, chậm tuyến hoặc đường bị chặn.',
  ACCIDENT: 'Báo tai nạn, va chạm hoặc tình huống cần hỗ trợ khẩn.',
  VEHICLE_BREAKDOWN: 'Báo xe hỏng trong chuyến, cần hỗ trợ kỹ thuật hoặc xe thay thế.',
  PASSENGER_VIOLATION: 'Báo hành khách vi phạm nội quy xe buýt để điều hành xử lý.',
  PASSENGER_CONFLICT: 'Báo xung đột giữa hành khách để điều hành nắm tình hình.',
  FOUND_ITEM: 'Báo đồ vật tìm thấy trên xe để xử lý thất lạc.',
};

const IN_TRIP_INCIDENT_TYPES = INCIDENT_TYPES.filter(
  (type) => type.value === 'TRAFFIC_CONGESTION'
);

const TRAFFIC_CATEGORIES = [
  { value: 'HEAVY_TRAFFIC', label: 'Ùn tắc đông phương tiện' },
  { value: 'ROADWORK', label: 'Thi công / rào chắn đường' },
  { value: 'FLOODING', label: 'Ngập nước / thời tiết xấu' },
  { value: 'EVENT_CROWD', label: 'Sự kiện đông người' },
  { value: 'STOP_OVERLOAD', label: 'Điểm dừng quá tải' },
  { value: 'TEMPORARY_BLOCK', label: 'Đường bị chặn tạm thời' },
  { value: 'OTHER', label: 'Khác' },
];

const AFFECTED_DIRECTIONS = [
  { value: 'CURRENT_DIRECTION', label: 'Chiều đang chạy' },
  { value: 'OPPOSITE_DIRECTION', label: 'Chiều ngược lại' },
  { value: 'BOTH_DIRECTIONS', label: 'Cả hai chiều' },
  { value: 'UNKNOWN', label: 'Chưa xác định' },
];

const PASSENGER_CONFLICT_CATEGORIES = [
  { value: 'ARGUMENT', label: 'Cãi vã / gây rối' },
  { value: 'FARE_DISPUTE', label: 'Tranh chấp vé / thanh toán' },
  { value: 'SEAT_DISPUTE', label: 'Tranh chấp chỗ ngồi' },
  { value: 'HARASSMENT', label: 'Quấy rối / đe dọa' },
  { value: 'SAFETY_RISK', label: 'Nguy cơ mất an toàn' },
  { value: 'OTHER', label: 'Khác' },
];


const PASSENGER_VIOLATION_CATEGORIES = [
  { value: 'NO_TICKET', label: 'Không có vé / không quét vé' },
  { value: 'WRONG_TICKET', label: 'Dùng sai loại vé' },
  { value: 'SMOKING', label: 'Hút thuốc trên xe' },
  { value: 'LITTERING', label: 'Xả rác trên xe' },
  { value: 'UNSAFE_BEHAVIOR', label: 'Hành vi mất an toàn' },
  { value: 'DISTURBANCE', label: 'Gây ồn / làm phiền hành khách' },
  { value: 'OTHER', label: 'Khác' },
];
const INCIDENT_SEVERITIES = [
  { value: 'LOW', label: 'Thấp' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'HIGH', label: 'Cao' },
  { value: 'CRITICAL', label: 'Khẩn cấp' },
];

const NOTIFICATION_CATEGORY_LABELS = {
  ROUTE_UPDATE: 'Cập nhật tuyến',
  SCHEDULE_CHANGE: 'Đổi lịch vận hành',
  EMERGENCY_INSTRUCTION: 'Chỉ đạo khẩn',
  GENERAL: 'Thông báo chung',
};

const NOTIFICATION_PRIORITY_META = {
  LOW: 'bg-slate-100 text-slate-700',
  NORMAL: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-amber-100 text-amber-900',
  CRITICAL: 'bg-red-100 text-red-800',
};

const formatDate = (value) => new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}).format(new Date(value));

const formatShortDate = (value) => new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}).format(new Date(value));

const formatTime = (value) => new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(value));

const getDateInputValue = (date) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
};

const toLatLng = ({ latitude, longitude }) => [latitude, longitude];

const isValidLocation = (location) => (
  location?.latitude !== null
  && location?.latitude !== undefined
  && location?.longitude !== null
  && location?.longitude !== undefined
  && Number.isFinite(Number(location.latitude))
  && Number.isFinite(Number(location.longitude))
  && !(Number(location.latitude) === 0 && Number(location.longitude) === 0)
);

const driverLocationIcon = L.divIcon({
  className: '',
  iconAnchor: [24, 24],
  html: `
    <div class="relative flex h-12 w-12 items-center justify-center">
      <span class="absolute h-12 w-12 rounded-full bg-emerald-400/25"></span>
      <span class="absolute h-7 w-7 rounded-full bg-emerald-500/25"></span>
      <span class="relative flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-600 shadow-lg">
        <span class="h-1.5 w-1.5 rounded-full bg-white"></span>
      </span>
    </div>
  `,
});

const routeStopIcon = (index, isTerminal = false) => L.divIcon({
  className: '',
  iconAnchor: [14, 14],
  html: `
    <div style="
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 9999px;
      border: 2px solid white;
      background: ${isTerminal ? '#047857' : '#0f766e'};
      color: white;
      font-size: 11px;
      font-weight: 800;
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.22);
    ">${index}</div>
  `,
});

const DriverLocationAutoFocus = ({ location }) => {
  const map = useMap();

  useEffect(() => {
    if (isValidLocation(location)) {
      map.setView(toLatLng(location), 16, { animate: true });
    }
  }, [location, map]);

  return null;
};

const TripRouteAutoFocus = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    const positions = points
      .filter(isValidLocation)
      .map((point) => toLatLng({
        latitude: Number(point.latitude),
        longitude: Number(point.longitude),
      }));

    if (positions.length > 1) {
      map.fitBounds(positions, { padding: [28, 28] });
      return;
    }

    if (positions.length === 1) {
      map.setView(positions[0], 15);
    }
  }, [points, map]);

  return null;
};

const getInitialFilters = () => {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 13);
  return { from: getDateInputValue(from), to: getDateInputValue(to) };
};

const addInputDays = (value, days) => {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return getDateInputValue(date);
};

const getWeekRange = (anchor = new Date()) => {
  const date = new Date(`${getDateInputValue(new Date(anchor))}T00:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  const from = getDateInputValue(date);
  return { from, to: addInputDays(from, 6) };
};
const getErrorMessage = (error) => (
  error?.message || 'Không thể tải lịch vận hành. Vui lòng thử lại.'
);

const GPS_RETRY_LIMIT = 3;

const requestCurrentPosition = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error('Trình duyệt không hỗ trợ GPS.'));
    return;
  }

  navigator.geolocation.getCurrentPosition(resolve, reject, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 6000,
  });
});

const captureStartGpsPayload = async () => {
  let lastError = null;

  for (let attempt = 1; attempt <= GPS_RETRY_LIMIT; attempt += 1) {
    try {
      const position = await requestCurrentPosition();

      return {
        gps: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          capturedAt: new Date(position.timestamp).toISOString(),
          retryCount: attempt - 1,
        },
      };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    gps: {
      retryCount: GPS_RETRY_LIMIT,
      message: lastError?.message || 'Không thể đồng bộ GPS sau nhiều lần thử.',
    },
  };
};

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || {
    label: status,
    className: 'bg-slate-100 text-slate-700',
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${meta.className}`}>
      {meta.label}
    </span>
  );
};

const InfoItem = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
      <Icon className="h-4 w-4" />
    </span>
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-900">{value || 'Chưa có'}</p>
    </div>
  </div>
);

const TripRouteMap = ({ assignment }) => {
  const route = assignment.route || {};
  const stops = Array.isArray(route.stops) ? route.stops.filter(isValidLocation) : [];
  const pathPoints = Array.isArray(route.pathPoints) && route.pathPoints.length
    ? route.pathPoints.filter(isValidLocation)
    : stops;
  const mapPoints = pathPoints.map((point) => ({
    ...point,
    latitude: Number(point.latitude),
    longitude: Number(point.longitude),
  }));
  const center = mapPoints[0] || stops[0];

  if (!isValidLocation(center)) {
    return (
      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Chưa có dữ liệu bản đồ tuyến cho chuyến này. Admin cần cấu hình trạm dừng hoặc đường đi trong phần quản lý tuyến.
      </div>
    );
  }

  const routeSummary = [
    stops.length ? `${stops.length} trạm` : null,
    route.estimatedDistanceKm ? `${route.estimatedDistanceKm} km` : null,
    route.estimatedDurationMinutes ? `${route.estimatedDurationMinutes} phút` : null,
  ].filter(Boolean).join(' • ');

  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-emerald-100 bg-white">
      <div className="flex flex-col gap-2 border-b border-emerald-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Route className="h-5 w-5 text-emerald-700" />
            <h4 className="font-black text-slate-950">Bản đồ chuyến đi</h4>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {route.origin} - {route.destination}
          </p>
        </div>
        {routeSummary && (
          <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
            {routeSummary}
          </span>
        )}
      </div>

      <div className="h-72">
        <MapContainer
          center={toLatLng(center)}
          className="h-full w-full"
          scrollWheelZoom={false}
          zoom={13}
          zoomControl={false}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <TripRouteAutoFocus points={mapPoints.length ? mapPoints : stops} />
          {mapPoints.length > 1 && (
            <Polyline
              pathOptions={{ color: '#047857', opacity: 0.9, weight: 5 }}
              positions={mapPoints.map(toLatLng)}
            />
          )}
          {stops.map((stop, index) => (
            <Marker
              key={`${stop.stopOrder || index}-${stop.stopName || index}`}
              position={toLatLng({
                latitude: Number(stop.latitude),
                longitude: Number(stop.longitude),
              })}
              icon={routeStopIcon(index + 1, index === 0 || index === stops.length - 1)}
              title={stop.stopName}
            />
          ))}
          <ZoomControl position="bottomright" />
        </MapContainer>
      </div>

      {stops.length > 0 && (
        <div className="border-t border-emerald-100 px-4 py-3">
          <p className="text-xs font-black uppercase text-slate-500">Các trạm chính trên tuyến</p>
          <div className="mt-3 max-h-80 overflow-y-auto pr-1">
            <div className="grid gap-2 md:grid-cols-2">
            {stops.map((stop, index) => (
              <div
                key={`${stop.stopOrder || index}-${stop.stopName || index}-summary`}
                className="flex items-start gap-3 rounded-lg bg-slate-50 px-3 py-2"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xs font-black text-white">
                  {stop.stopOrder || index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{stop.stopName || 'Trạm dừng'}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{stop.address || 'Chưa có địa chỉ'}</p>
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DriverLocationMap = ({ assignment }) => {
  const location = assignment.startLocation;
  const gpsStatus = assignment.gpsSync?.status || 'NOT_REQUESTED';

  if (gpsStatus === 'FAILED') {
    return (
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Không thể đồng bộ GPS khi bắt đầu chuyến. Hãy kiểm tra quyền vị trí của trình duyệt hoặc thiết bị GPS rồi thử lại ở chuyến tiếp theo.
      </div>
    );
  }

  if (gpsStatus !== 'SYNCED' || !isValidLocation(location)) {
    return null;
  }

  const normalizedLocation = {
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
  };
  const hasAccuracy = location.accuracyMeters !== null
    && location.accuracyMeters !== undefined
    && Number.isFinite(Number(location.accuracyMeters));
  const accuracyText = hasAccuracy
    ? `${Math.round(Number(location.accuracyMeters))} m`
    : 'Chưa có';

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-emerald-100 bg-white">
      <div className="flex flex-col gap-2 border-b border-emerald-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-slate-950">Vị trí tài xế khi bắt đầu chuyến</p>
          <p className="mt-1 text-xs text-slate-500">
            GPS được đồng bộ tự động khi bấm UC44 - Bắt đầu chuyến.
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
          Độ chính xác: {accuracyText}
        </span>
      </div>
      <div className="h-64">
        <MapContainer
          center={toLatLng(normalizedLocation)}
          className="h-full w-full"
          scrollWheelZoom={false}
          zoom={16}
          zoomControl={false}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <DriverLocationAutoFocus location={normalizedLocation} />
          <Marker position={toLatLng(normalizedLocation)} icon={driverLocationIcon} />
          <ZoomControl position="bottomright" />
        </MapContainer>
      </div>
      <div className="grid gap-2 border-t border-emerald-100 px-4 py-3 text-xs text-slate-600 sm:grid-cols-3">
        <span><strong>Latitude:</strong> {normalizedLocation.latitude.toFixed(6)}</span>
        <span><strong>Longitude:</strong> {normalizedLocation.longitude.toFixed(6)}</span>
        <span><strong>GPS:</strong> {assignment.gpsSync?.status || 'NOT_REQUESTED'}</span>
      </div>
    </div>
  );
};

const OperationRouteMap = ({ assignment }) => {
  const location = assignment.startLocation;
  const gpsStatus = assignment.gpsSync?.status || 'NOT_REQUESTED';
  const route = assignment.route || {};
  const stops = Array.isArray(route.stops) ? route.stops.filter(isValidLocation) : [];
  const pathPoints = Array.isArray(route.pathPoints) && route.pathPoints.length
    ? route.pathPoints.filter(isValidLocation)
    : stops;

  if (gpsStatus === 'FAILED') {
    return (
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Không thể đồng bộ GPS khi bắt đầu chuyến. Hãy kiểm tra quyền vị trí của trình duyệt hoặc thiết bị GPS rồi bấm Reload GPS.
      </div>
    );
  }

  if (gpsStatus !== 'SYNCED' || !isValidLocation(location)) {
    return null;
  }

  const normalizedLocation = {
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
  };
  const hasAccuracy = location.accuracyMeters !== null
    && location.accuracyMeters !== undefined
    && Number.isFinite(Number(location.accuracyMeters));
  const accuracyText = hasAccuracy
    ? `${Math.round(Number(location.accuracyMeters))} m`
    : 'Chưa có';
  const mapPoints = pathPoints.map((point) => ({
    ...point,
    latitude: Number(point.latitude),
    longitude: Number(point.longitude),
  }));
  const focusPoints = [normalizedLocation, ...mapPoints, ...stops];

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-emerald-100 bg-white">
      <div className="flex flex-col gap-2 border-b border-emerald-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-slate-950">Bản đồ vận hành chuyến</p>
          <p className="mt-1 text-xs text-slate-500">
            Theo dõi vị trí tài xế hiện tại và các trạm cần đi trong chuyến.
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
          Độ chính xác: {accuracyText}
        </span>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-[720px] min-h-[620px]">
          <MapContainer
            center={toLatLng(normalizedLocation)}
            className="h-full w-full"
            scrollWheelZoom
            zoom={14}
            zoomControl={false}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <TripRouteAutoFocus points={focusPoints} />
            {mapPoints.length > 1 && (
              <Polyline
                pathOptions={{ color: '#1d4ed8', opacity: 0.9, weight: 6 }}
                positions={mapPoints.map(toLatLng)}
              />
            )}
            {stops.map((stop, index) => (
              <Marker
                key={`${stop.stopOrder || index}-${stop.stopName || index}-operation`}
                position={toLatLng({
                  latitude: Number(stop.latitude),
                  longitude: Number(stop.longitude),
                })}
                icon={routeStopIcon(index + 1, index === 0 || index === stops.length - 1)}
                title={stop.stopName}
              />
            ))}
            <Marker position={toLatLng(normalizedLocation)} icon={driverLocationIcon} title="Vị trí tài xế" />
            <ZoomControl position="bottomright" />
          </MapContainer>
        </div>

        <aside className="border-t border-emerald-100 bg-slate-50 xl:max-h-[720px] xl:overflow-y-auto xl:border-l xl:border-t-0">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-black uppercase text-slate-500">Trạm cần đi</p>
            <p className="mt-1 text-sm font-bold text-slate-950">
              {stops.length} trạm | {route.origin} - {route.destination}
            </p>
          </div>
          <div className="space-y-2 p-4">
            <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2">
              <p className="text-xs font-black uppercase text-emerald-700">Vị trí tài xế</p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {normalizedLocation.latitude.toFixed(6)}, {normalizedLocation.longitude.toFixed(6)}
              </p>
              <p className="mt-1 text-xs text-slate-500">GPS: {assignment.gpsSync?.status || 'NOT_REQUESTED'}</p>
            </div>
            {stops.map((stop, index) => (
              <div
                key={`${stop.stopOrder || index}-${stop.stopName || index}-operation-list`}
                className="flex items-start gap-3 rounded-lg bg-white px-3 py-2"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xs font-black text-white">
                  {stop.stopOrder || index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{stop.stopName || 'Trạm dừng'}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{stop.address || 'Chưa có địa chỉ'}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="grid gap-2 border-t border-emerald-100 px-4 py-3 text-xs text-slate-600 sm:grid-cols-3">
        <span><strong>Latitude:</strong> {normalizedLocation.latitude.toFixed(6)}</span>
        <span><strong>Longitude:</strong> {normalizedLocation.longitude.toFixed(6)}</span>
        <span><strong>GPS:</strong> {assignment.gpsSync?.status || 'NOT_REQUESTED'}</span>
      </div>
    </div>
  );
};

const buildDefaultChecklist = (inspection) => (
  CHECKLIST_ITEMS.reduce((values, item) => ({
    ...values,
    [item.key]: Boolean(inspection?.checklist?.[item.key]),
  }), {})
);

const VehicleOperationsPanel = ({
  assignment,
  canOperateVehicle,
  isProcessing,
  onStartInspection,
  onConfirmReady,
  onReportIssue,
}) => {
  const inspection = assignment.inspection || { status: 'NOT_STARTED' };
  const [checklist, setChecklist] = useState(() => buildDefaultChecklist(inspection));
  const [issueCategory, setIssueCategory] = useState('OTHER');
  const [issueDescription, setIssueDescription] = useState('');

  useEffect(() => {
    setChecklist(buildDefaultChecklist(inspection));
  }, [inspection?.status, inspection?.id]);

  const allChecked = CHECKLIST_ITEMS.every((item) => checklist[item.key]);
  const isNotStarted = inspection.status === 'NOT_STARTED';
  const isInProgress = inspection.status === 'IN_PROGRESS';
  const isReady = inspection.status === 'READY';
  const isIssueReported = inspection.status === 'ISSUE_REPORTED';
  const tripAllowsInspection = assignment.tripStatus === 'SCHEDULED';
  const canEdit = canOperateVehicle && tripAllowsInspection && !isReady && !isIssueReported;
  const canStart = canEdit && isNotStarted;
  const canInspect = canEdit && isInProgress;
  const canConfirm = canInspect && allChecked;
  const canReport = canInspect && issueDescription.trim().length >= 5;

  const toggleChecklist = (key) => {
    setChecklist((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  if (isNotStarted) {
    return (
      <div className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-emerald-800" />
              <h4 className="font-black text-slate-950">UC41 - Bắt đầu kiểm tra xe</h4>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Tài xế bắt đầu biên bản kiểm tra trước chuyến. Sau khi bắt đầu, hệ thống mới mở checklist để xác nhận xe sẵn sàng hoặc báo lỗi.
            </p>
          </div>
          <StatusBadge status={inspection.status} />
        </div>

        {!canOperateVehicle && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Chỉ tài xế được phân công cho chuyến này mới có thể bắt đầu kiểm tra xe.
          </div>
        )}

        {canOperateVehicle && !tripAllowsInspection && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Trạng thái chuyến này không còn cho phép bắt đầu kiểm tra xe trước chuyến.
          </div>
        )}

        <div className="mt-4 rounded-lg border border-emerald-100 bg-white p-4">
          <p className="text-sm text-slate-700">
            Khi bấm bắt đầu, hệ thống tạo hồ sơ kiểm tra trong collection vehicleinspections và ghi nhận thời điểm bắt đầu để admin giám sát.
          </p>
          <button
            type="button"
            onClick={() => onStartInspection(assignment.id, buildDefaultChecklist(inspection))}
            disabled={!canStart || isProcessing}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Wrench className="h-4 w-4" />
            UC41 - Bắt đầu kiểm tra
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-emerald-800" />
            <h4 className="font-black text-slate-950">Vận hành phương tiện</h4>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Luồng thực tế: bắt đầu kiểm tra, sau đó xác nhận xe sẵn sàng hoặc báo lỗi xe.
          </p>
        </div>
        <StatusBadge status={inspection.status} />
      </div>

      {!canOperateVehicle && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Chỉ tài xế được phân công cho chuyến này mới có thể cập nhật kiểm tra xe.
        </div>
      )}

      {canOperateVehicle && !tripAllowsInspection && !isReady && !isIssueReported && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Trạng thái chuyến này không còn cho phép cập nhật kiểm tra xe trước chuyến.
        </div>
      )}

      {isReady && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-800">
          Xe đã được xác nhận sẵn sàng. Biên bản kiểm tra này đã được khóa.
        </div>
      )}

      {isIssueReported && (
        <div className="mt-4 rounded-lg border border-red-200 bg-white px-4 py-3 text-sm text-red-700">
          <p className="font-bold">Đã báo lỗi xe. Phương tiện được chuyển sang trạng thái bảo trì.</p>
          <p className="mt-1">{inspection.issueDescription || 'Chưa có mô tả lỗi.'}</p>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CHECKLIST_ITEMS.map((item) => (
          <label
            key={item.key}
            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            <input
              type="checkbox"
              checked={Boolean(checklist[item.key])}
              onChange={() => toggleChecklist(item.key)}
              disabled={!canInspect || isProcessing}
              className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
            />
            {item.label}
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row">
        <button
          type="button"
          onClick={() => onConfirmReady(assignment.id, checklist)}
          disabled={!canConfirm || isProcessing}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          UC42 - Xác nhận xe sẵn sàng
        </button>
      </div>

      {!isReady && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          {!isInProgress && (
            <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Hãy bắt đầu kiểm tra xe trước khi xác nhận sẵn sàng hoặc báo lỗi.
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-[220px_1fr]">
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase text-slate-500">Nhóm lỗi</span>
              <select
                value={issueCategory}
                onChange={(event) => setIssueCategory(event.target.value)}
                disabled={!canEdit || !isInProgress || isProcessing}
                className="w-full rounded-lg border-slate-300 text-sm focus:border-emerald-600 focus:ring-emerald-600"
              >
                {ISSUE_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase text-slate-500">Mô tả lỗi</span>
              <textarea
                value={issueDescription}
                onChange={(event) => setIssueDescription(event.target.value)}
                disabled={!canEdit || !isInProgress || isProcessing}
                placeholder="Ví dụ: đèn xi nhan trái không hoạt động, cần kiểm tra trước khi xuất bến."
                rows={3}
                className="w-full rounded-lg border-slate-300 text-sm focus:border-emerald-600 focus:ring-emerald-600"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => onReportIssue(assignment.id, { issueCategory, issueDescription })}
            disabled={!canReport || isProcessing}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <AlertTriangle className="h-4 w-4" />
            UC43 - Báo lỗi xe
          </button>
        </div>
      )}
    </div>
  );
};

const TripLifecyclePanel = ({
  assignment,
  canStartTrip,
  isProcessing,
  onStartTrip,
  onCompleteTrip,
  onSyncTripGps,
}) => {
  const isTripReady = assignment.tripStatus === 'READY';
  const isTripInProgress = assignment.tripStatus === 'IN_PROGRESS';
  const isTripClosed = ['COMPLETED', 'CANCELLED'].includes(assignment.tripStatus);
  const isVehicleReady = assignment.inspection?.status === 'READY';
  const canStart = canStartTrip && isTripReady && isVehicleReady && !isTripInProgress && !isTripClosed;
  const canComplete = canStartTrip && isTripInProgress && !isTripClosed;
  const gpsStatus = assignment.gpsSync?.status || 'NOT_REQUESTED';

  let helperText = 'Chỉ tài xế được phân công mới có thể bắt đầu chuyến.';

  if (canStartTrip && !isVehicleReady) {
    helperText = 'Cần xác nhận xe sẵn sàng trước khi bắt đầu chuyến.';
  } else if (canStartTrip && !isTripReady && !isTripInProgress && !isTripClosed) {
    helperText = 'Chuyến chưa ở trạng thái sẵn sàng để bắt đầu.';
  } else if (isTripInProgress) {
    helperText = 'Chuyến đang được thực hiện và đã được ghi nhận thời điểm bắt đầu.';
  } else if (isTripClosed) {
    helperText = 'Chuyến đã đóng nên không thể bắt đầu lại.';
  } else if (canStart) {
    helperText = 'Xe đã sẵn sàng. Tài xế có thể bắt đầu chuyến để hệ thống chuyển sang theo dõi vận hành.';
  }

  return (
    <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50/70 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-blue-800" />
            <h4 className="font-black text-slate-950">Vận hành chuyến</h4>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            UC44 bắt đầu chuyến sau khi tài xế đã xác nhận phương tiện sẵn sàng.
          </p>
        </div>
        <StatusBadge status={assignment.tripStatus} />
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-blue-100 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-slate-700">{helperText}</p>
          {gpsStatus !== 'NOT_REQUESTED' && (
            <p className={`mt-2 text-xs font-bold ${
              gpsStatus === 'SYNCED' ? 'text-emerald-700' : 'text-amber-700'
            }`}
            >
              GPS: {gpsStatus === 'SYNCED'
                ? 'Đã đồng bộ khi bắt đầu chuyến'
                : `Đồng bộ thất bại sau ${assignment.gpsSync?.retryCount || 0} lần thử`}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => onStartTrip(assignment.id)}
          disabled={!canStart || isProcessing}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PlayCircle className="h-4 w-4" />
          UC44 - Bắt đầu chuyến
        </button>
          <button
            type="button"
            onClick={() => onCompleteTrip(assignment.id)}
            disabled={!canComplete || isProcessing}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
            <CheckCircle2 className="h-4 w-4" />
            UC45 - Hoàn thành chuyến
          </button>
          <button
            type="button"
            onClick={() => onSyncTripGps(assignment.id)}
            disabled={!isTripInProgress || isProcessing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-700 px-4 py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MapPin className="h-4 w-4" />
            Reload GPS
          </button>
        </div>
      </div>
      <OperationRouteMap assignment={assignment} />
    </div>
  );
};

const IncidentReportingPanel = ({
  assignment,
  canReportIncident,
  isProcessing,
  onReportIncident,
}) => {
  const [form, setForm] = useState({
    type: 'TRAFFIC_CONGESTION',
    trafficCategory: 'HEAVY_TRAFFIC',
    affectedDirection: 'CURRENT_DIRECTION',
    severity: 'MEDIUM',
    locationText: '',
    estimatedDelayMinutes: 10,
    description: '',
    injuriesReported: false,
    policeNotified: false,
    canContinue: true,
    requiresReplacementVehicle: false,
    violationCategory: 'NO_TICKET',
    passengerDescription: '',
    conflictCategory: 'ARGUMENT',
    partiesInvolved: '',
    actionTaken: '',
    itemName: '',
    itemDescription: '',
    foundLocation: '',
    handedTo: '',
  });
  const [showIncidentChoices, setShowIncidentChoices] = useState(false);
  const [selectedIncidentType, setSelectedIncidentType] = useState(null);
  const [evidenceFiles, setEvidenceFiles] = useState([]);

  const isTripRunning = assignment.tripStatus === 'IN_PROGRESS';
  const isTripCompleted = assignment.tripStatus === 'COMPLETED';
  const canReportFoundItemAfterCompletion = assignment.actorRole === 'BUS_ASSISTANT' && isTripCompleted;
  const canUseIncidentForm = isTripRunning || canReportFoundItemAfterCompletion;
  const allowedIncidentTypes = assignment.actorRole === 'BUS_ASSISTANT'
    ? BUS_ASSISTANT_INCIDENT_TYPES.filter((type) => (
      canReportFoundItemAfterCompletion ? type.value === 'FOUND_ITEM' : true
    ))
    : DRIVER_INCIDENT_TYPES;
  useEffect(() => {
    if (
      selectedIncidentType
      && !allowedIncidentTypes.some((type) => type.value === selectedIncidentType)
    ) {
      setSelectedIncidentType(null);
      setShowIncidentChoices(false);
    }
  }, [allowedIncidentTypes, selectedIncidentType]);
  const activeIncidentType = selectedIncidentType || form.type;
  const incidentTitle = {
    TRAFFIC_CONGESTION: 'UC46 - Báo kẹt xe',
    ACCIDENT: 'UC47 - Báo tai nạn',
    VEHICLE_BREAKDOWN: 'UC48 - Báo xe hỏng',
    PASSENGER_VIOLATION: 'UC50 - Báo hành khách vi phạm',
    PASSENGER_CONFLICT: 'UC51 - Báo xung đột hành khách',
    FOUND_ITEM: 'UC52 - Báo đồ tìm thấy',
  }[activeIncidentType] || 'Báo sự cố trong chuyến';
  const canSubmit = canReportIncident
    && canUseIncidentForm
    && selectedIncidentType
    && form.locationText.trim().length >= 3
    && form.description.trim().length >= 10
    && (form.type !== 'ACCIDENT' || form.severity !== 'LOW')
    && (
      form.type !== 'TRAFFIC_CONGESTION'
      || (
        form.trafficCategory
        && form.affectedDirection
        && Number(form.estimatedDelayMinutes) >= 1
      )
    );
  const hasPassengerViolationDetail = form.type !== 'PASSENGER_VIOLATION'
    || (form.violationCategory && form.actionTaken.trim().length >= 3);
  const hasPassengerConflictDetail = form.type !== 'PASSENGER_CONFLICT'
    || (form.conflictCategory && form.actionTaken.trim().length >= 3);
  const hasFoundItemDetail = form.type !== 'FOUND_ITEM'
    || (form.itemName.trim().length >= 2 && form.foundLocation.trim().length >= 3);
  const canSubmitReport = canSubmit && hasPassengerViolationDetail && hasPassengerConflictDetail && hasFoundItemDetail;

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateEvidenceFiles = (event) => {
    setEvidenceFiles(Array.from(event.target.files || []).slice(0, 5));
  };

  const submitIncidentReport = async () => {
    await onReportIncident(assignment.id, {
      ...form,
      evidenceFiles,
    });
    setSelectedIncidentType(null);
    setShowIncidentChoices(false);
    setEvidenceFiles([]);
  };

  const selectIncidentType = (type) => {
    setSelectedIncidentType(type);
    setShowIncidentChoices(false);
    setForm((current) => ({
      ...current,
      type,
      severity: type === 'ACCIDENT' && current.severity === 'LOW' ? 'MEDIUM' : current.severity,
      foundLocation: type === 'FOUND_ITEM' ? current.locationText : current.foundLocation,
    }));
  };

  return (
    <div className="mt-5 rounded-lg border border-red-100 bg-red-50/60 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-700" />
            <h4 className="font-black text-slate-950">Báo cáo sự cố</h4>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Chỉ báo sự cố khi chuyến đang vận hành. Báo cáo sẽ gửi về điều hành để xử lý.
          </p>
        </div>
        <StatusBadge status={assignment.tripStatus} />
      </div>

      {!canUseIncidentForm && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Cần bắt đầu chuyến trước khi báo sự cố.
        </div>
      )}

      {!selectedIncidentType && (
        <div className="mt-4 rounded-lg border border-red-100 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-black text-slate-950">Báo cáo sự cố</p>
              <p className="mt-1 text-sm text-slate-600">
                Chọn loại sự cố đang xảy ra để hệ thống mở đúng form báo cáo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowIncidentChoices((current) => !current)}
              disabled={!canReportIncident || !canUseIncidentForm || isProcessing}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-3 text-sm font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <AlertTriangle className="h-4 w-4" />
              Báo cáo sự cố
            </button>
          </div>

          {showIncidentChoices && (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {allowedIncidentTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => selectIncidentType(type.value)}
                  disabled={!canReportIncident || !canUseIncidentForm || isProcessing}
                  className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-left hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <p className="font-black text-slate-950">{type.label}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {INCIDENT_TYPE_DESCRIPTIONS[type.value]}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedIncidentType && (
        <>
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-red-100 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-black text-slate-950">{incidentTitle}</p>
              <p className="mt-1 text-sm text-slate-600">Nhập thông tin chi tiết để gửi về điều hành.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedIncidentType(null);
                setShowIncidentChoices(true);
              }}
              disabled={isProcessing}
              className="inline-flex items-center justify-center rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Đổi loại sự cố
            </button>
          </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="hidden">
          <span className="text-xs font-bold uppercase text-slate-500">Loại sự cố</span>
          <select
            value={form.type}
            onChange={(event) => updateForm('type', event.target.value)}
            disabled={!canReportIncident || !canUseIncidentForm || isProcessing}
            className="w-full rounded-lg border-slate-300 text-sm focus:border-red-500 focus:ring-red-500"
          >
            {allowedIncidentTypes.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-bold uppercase text-slate-500">Mức độ</span>
          <select
            value={form.severity}
            onChange={(event) => updateForm('severity', event.target.value)}
            disabled={!canReportIncident || !canUseIncidentForm || isProcessing}
            className="w-full rounded-lg border-slate-300 text-sm focus:border-red-500 focus:ring-red-500"
          >
            {INCIDENT_SEVERITIES.map((severity) => (
              <option key={severity.value} value={severity.value}>{severity.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-bold uppercase text-slate-500">Vị trí</span>
          <input
            value={form.locationText}
            onChange={(event) => updateForm('locationText', event.target.value)}
            disabled={!canReportIncident || !canUseIncidentForm || isProcessing}
            placeholder="Ví dụ: gần cầu Rồng"
            className="w-full rounded-lg border-slate-300 text-sm focus:border-red-500 focus:ring-red-500"
          />
        </label>
      </div>

      {form.type === 'TRAFFIC_CONGESTION' && (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase text-slate-500">Loại kẹt xe</span>
            <select
              value={form.trafficCategory}
              onChange={(event) => updateForm('trafficCategory', event.target.value)}
              disabled={!canReportIncident || !canUseIncidentForm || isProcessing}
              className="w-full rounded-lg border-slate-300 text-sm focus:border-red-500 focus:ring-red-500"
            >
              {TRAFFIC_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>{category.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase text-slate-500">Chiều ảnh hưởng</span>
            <select
              value={form.affectedDirection}
              onChange={(event) => updateForm('affectedDirection', event.target.value)}
              disabled={!canReportIncident || !canUseIncidentForm || isProcessing}
              className="w-full rounded-lg border-slate-300 text-sm focus:border-red-500 focus:ring-red-500"
            >
              {AFFECTED_DIRECTIONS.map((direction) => (
                <option key={direction.value} value={direction.value}>{direction.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase text-slate-500">Ước tính trễ phút</span>
            <input
              type="number"
              min="1"
              value={form.estimatedDelayMinutes}
              onChange={(event) => updateForm('estimatedDelayMinutes', event.target.value)}
              disabled={!canReportIncident || !canUseIncidentForm || isProcessing}
              className="w-full rounded-lg border-slate-300 text-sm focus:border-red-500 focus:ring-red-500"
            />
          </label>
        </div>
      )}

      {form.type === 'ACCIDENT' && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.injuriesReported}
              onChange={(event) => updateForm('injuriesReported', event.target.checked)}
              disabled={!canReportIncident || !canUseIncidentForm || isProcessing}
              className="rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            Có người bị thương
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.policeNotified}
              onChange={(event) => updateForm('policeNotified', event.target.checked)}
              disabled={!canReportIncident || !canUseIncidentForm || isProcessing}
              className="rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            Đã báo cơ quan chức năng
          </label>
        </div>
      )}

      {form.type === 'VEHICLE_BREAKDOWN' && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.canContinue}
              onChange={(event) => updateForm('canContinue', event.target.checked)}
              disabled={!canReportIncident || !canUseIncidentForm || isProcessing}
              className="rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            Xe còn có thể tiếp tục chạy
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.requiresReplacementVehicle}
              onChange={(event) => updateForm('requiresReplacementVehicle', event.target.checked)}
              disabled={!canReportIncident || !canUseIncidentForm || isProcessing}
              className="rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            Cần xe thay thế
          </label>
        </div>
      )}

      {form.type === 'PASSENGER_VIOLATION' && (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase text-slate-500">Loại vi phạm</span>
            <select
              value={form.violationCategory}
              onChange={(event) => updateForm('violationCategory', event.target.value)}
              disabled={!canReportIncident || !canUseIncidentForm || isProcessing}
              className="w-full rounded-lg border-slate-300 text-sm focus:border-red-500 focus:ring-red-500"
            >
              {PASSENGER_VIOLATION_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>{category.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase text-slate-500">Mô tả hành khách</span>
            <input
              value={form.passengerDescription}
              onChange={(event) => updateForm('passengerDescription', event.target.value)}
              disabled={!canReportIncident || !canUseIncidentForm || isProcessing}
              placeholder="Ví dụ: hành khách áo xanh tại cửa sau"
              className="w-full rounded-lg border-slate-300 text-sm focus:border-red-500 focus:ring-red-500"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase text-slate-500">Hành động đã xử lý</span>
            <input
              value={form.actionTaken}
              onChange={(event) => updateForm('actionTaken', event.target.value)}
              disabled={!canReportIncident || !canUseIncidentForm || isProcessing}
              placeholder="Ví dụ: nhắc nội quy, yêu cầu mua vé"
              className="w-full rounded-lg border-slate-300 text-sm focus:border-red-500 focus:ring-red-500"
            />
          </label>
        </div>
      )}

      {form.type === 'PASSENGER_CONFLICT' && (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase text-slate-500">Nhóm xung đột</span>
            <select
              value={form.conflictCategory}
              onChange={(event) => updateForm('conflictCategory', event.target.value)}
              disabled={!canReportIncident || !canUseIncidentForm || isProcessing}
              className="w-full rounded-lg border-slate-300 text-sm focus:border-red-500 focus:ring-red-500"
            >
              {PASSENGER_CONFLICT_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>{category.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase text-slate-500">Các bên liên quan</span>
            <input
              value={form.partiesInvolved}
              onChange={(event) => updateForm('partiesInvolved', event.target.value)}
              disabled={!canReportIncident || !canUseIncidentForm || isProcessing}
              placeholder="Ví dụ: 2 hành khách tại cửa sau"
              className="w-full rounded-lg border-slate-300 text-sm focus:border-red-500 focus:ring-red-500"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase text-slate-500">Hành động đã xử lý</span>
            <input
              value={form.actionTaken}
              onChange={(event) => updateForm('actionTaken', event.target.value)}
              disabled={!canReportIncident || !canUseIncidentForm || isProcessing}
              placeholder="Ví dụ: tách hành khách, nhắc nội quy"
              className="w-full rounded-lg border-slate-300 text-sm focus:border-red-500 focus:ring-red-500"
            />
          </label>
        </div>
      )}

      {form.type === 'FOUND_ITEM' && (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase text-slate-500">Tên đồ vật</span>
            <input
              value={form.itemName}
              onChange={(event) => updateForm('itemName', event.target.value)}
              disabled={!canReportIncident || !canUseIncidentForm || isProcessing}
              placeholder="Ví dụ: ví da màu đen"
              className="w-full rounded-lg border-slate-300 text-sm focus:border-red-500 focus:ring-red-500"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase text-slate-500">Vị trí tìm thấy</span>
            <input
              value={form.foundLocation}
              onChange={(event) => updateForm('foundLocation', event.target.value)}
              disabled={!canReportIncident || !canUseIncidentForm || isProcessing}
              placeholder="Ví dụ: ghế số 12"
              className="w-full rounded-lg border-slate-300 text-sm focus:border-red-500 focus:ring-red-500"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase text-slate-500">Bàn giao cho</span>
            <input
              value={form.handedTo}
              onChange={(event) => updateForm('handedTo', event.target.value)}
              disabled={!canReportIncident || !canUseIncidentForm || isProcessing}
              placeholder="Ví dụ: quầy điều hành bến"
              className="w-full rounded-lg border-slate-300 text-sm focus:border-red-500 focus:ring-red-500"
            />
          </label>
        </div>
      )}

      <label className="mt-3 block space-y-1">
        <span className="text-xs font-bold uppercase text-slate-500">Mô tả</span>
        <textarea
          value={form.description}
          onChange={(event) => updateForm('description', event.target.value)}
          disabled={!canReportIncident || !canUseIncidentForm || isProcessing}
          placeholder="Mô tả rõ tình huống, mức ảnh hưởng và hành động đã thực hiện."
          rows={3}
          className="w-full rounded-lg border-slate-300 text-sm focus:border-red-500 focus:ring-red-500"
        />
      </label>

      <label className="mt-3 block space-y-1">
        <span className="text-xs font-bold uppercase text-slate-500">Ảnh hiện trường</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          multiple
          onChange={updateEvidenceFiles}
          disabled={!canReportIncident || !canUseIncidentForm || isProcessing}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-red-100 file:px-3 file:py-2 file:text-sm file:font-bold file:text-red-700 hover:file:bg-red-200"
        />
        <p className="text-xs text-slate-500">Có thể chụp hoặc chọn tối đa 5 ảnh JPG, PNG, WEBP để admin xem tình hình rõ hơn.</p>
        {evidenceFiles.length > 0 && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {evidenceFiles.map((file) => (
              <div key={`${file.name}-${file.size}`} className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600">
                <p className="truncate font-bold text-slate-900">{file.name}</p>
                <p>{Math.max(1, Math.round(file.size / 1024))} KB</p>
              </div>
            ))}
          </div>
        )}
      </label>

      <button
        type="button"
        onClick={submitIncidentReport}
        disabled={!canSubmitReport || isProcessing}
        className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-3 text-sm font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
        Gửi báo cáo sự cố
      </button>
        </>
      )}
    </div>
  );
};

const AssignmentCard = ({
  assignment,
  canOperateVehicle = false,
  isProcessing = false,
  onAcceptTrip,
  onRejectTrip,
  onStartInspection,
  onConfirmReady,
  onReportIssue,
  onStartTrip,
  onCompleteTrip,
  onSyncTripGps,
  onReportIncident,
}) => {
  const isAccepted = assignment.acceptanceStatus === 'ACCEPTED';
  const isRejected = assignment.acceptanceStatus === 'REJECTED';
  const canRespond = canOperateVehicle
    && assignment.actorRole === 'DRIVER'
    && assignment.acceptanceStatus !== 'ACCEPTED'
    && assignment.acceptanceStatus !== 'REJECTED'
    && !['IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(assignment.tripStatus);
  const showVehicleStep = isAccepted && !isRejected;
  const showVehiclePanel = showVehicleStep && assignment.inspection?.status !== 'READY';
  const showLifecycleStep = showVehicleStep && (
    assignment.inspection?.status === 'READY'
    || ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(assignment.tripStatus)
  );
  const showIncidentStep = assignment.tripStatus === 'IN_PROGRESS'
    || (assignment.actorRole === 'BUS_ASSISTANT' && assignment.tripStatus === 'COMPLETED');
  const acceptedScreenTitle = assignment.tripStatus === 'IN_PROGRESS'
    ? 'Chuyến đang vận hành'
    : assignment.inspection?.status === 'READY'
      ? 'Xe đã sẵn sàng - chuẩn bị vận hành'
      : 'Đã tiếp nhận chuyến - chuyển sang kiểm tra xe';

  if (assignment.tripStatus === 'COMPLETED') {
    return (
      <article className="rounded-lg border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-black text-white">
                {assignment.route.routeNumber}
              </span>
              <span className="text-sm font-semibold text-slate-500">{assignment.tripCode}</span>
            </div>
            <h3 className="mt-3 text-lg font-black text-slate-950">
              Chuyến đã hoàn thành
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {assignment.route.origin} - {assignment.route.destination}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={assignment.acceptanceStatus || 'ACCEPTED'} />
            <StatusBadge status={assignment.tripStatus} />
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50/70 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div>
              <p className="font-black text-emerald-900">Bạn đã hoàn thành chuyến này.</p>
              <p className="mt-1 text-sm text-emerald-800">
                Hệ thống đã ghi nhận thời điểm kết thúc. Bạn không cần thao tác thêm cho chuyến này.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-lg bg-white px-3 py-2">
              <p className="text-xs font-bold uppercase text-slate-500">Thời gian kế hoạch</p>
              <p className="mt-1 font-bold text-slate-900">
                {formatTime(assignment.scheduledStart)} - {formatTime(assignment.scheduledEnd)}
              </p>
            </div>
            <div className="rounded-lg bg-white px-3 py-2">
              <p className="text-xs font-bold uppercase text-slate-500">Bắt đầu thực tế</p>
              <p className="mt-1 font-bold text-slate-900">
                {assignment.actualStartAt ? formatTime(assignment.actualStartAt) : 'Chưa có'}
              </p>
            </div>
            <div className="rounded-lg bg-white px-3 py-2">
              <p className="text-xs font-bold uppercase text-slate-500">Kết thúc thực tế</p>
              <p className="mt-1 font-bold text-slate-900">
                {assignment.actualEndAt ? formatTime(assignment.actualEndAt) : 'Chưa có'}
              </p>
            </div>
          </div>
        </div>
        {showIncidentStep && (
          <IncidentReportingPanel
            assignment={assignment}
            canReportIncident={assignment.actorRole === 'BUS_ASSISTANT'}
            isProcessing={isProcessing}
            onReportIncident={onReportIncident}
          />
        )}
      </article>
    );
  }

  if (isAccepted && !isRejected) {
    return (
      <article className="rounded-lg border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-black text-white">
                {assignment.route.routeNumber}
              </span>
              <span className="text-sm font-semibold text-slate-500">{assignment.tripCode}</span>
            </div>
            <h3 className="mt-3 text-lg font-black text-slate-950">
              {acceptedScreenTitle}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {assignment.route.origin} - {assignment.route.destination} | {formatTime(assignment.scheduledStart)} - {formatTime(assignment.scheduledEnd)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={assignment.acceptanceStatus || 'ACCEPTED'} />
            <StatusBadge status={assignment.tripStatus} />
            <StatusBadge status={assignment.inspection?.status || 'NOT_STARTED'} />
          </div>
        </div>

        {showVehiclePanel && (
          <VehicleOperationsPanel
            assignment={assignment}
            canOperateVehicle={canOperateVehicle && assignment.actorRole === 'DRIVER'}
            isProcessing={isProcessing}
            onStartInspection={onStartInspection}
            onConfirmReady={onConfirmReady}
            onReportIssue={onReportIssue}
          />
        )}
        {showLifecycleStep && (
          <TripLifecyclePanel
            assignment={assignment}
            canStartTrip={canOperateVehicle && assignment.actorRole === 'DRIVER'}
            isProcessing={isProcessing}
            onStartTrip={onStartTrip}
            onCompleteTrip={onCompleteTrip}
            onSyncTripGps={onSyncTripGps}
          />
        )}
        {showIncidentStep && (
          <IncidentReportingPanel
            assignment={assignment}
            canReportIncident={['DRIVER', 'BUS_ASSISTANT'].includes(assignment.actorRole)}
            isProcessing={isProcessing}
            onReportIncident={onReportIncident}
          />
        )}
      </article>
    );
  }

  return (
  <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-black text-white">
            {assignment.route.routeNumber}
          </span>
          <span className="text-sm font-semibold text-slate-500">{assignment.tripCode}</span>
        </div>
        <h3 className="mt-3 text-lg font-black text-slate-950">
          {assignment.route.origin} - {assignment.route.destination}
        </h3>
        <p className="mt-1 text-sm text-slate-600">{assignment.route.name}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={assignment.acceptanceStatus || 'PENDING'} />
        <StatusBadge status={assignment.shiftStatus} />
        <StatusBadge status={assignment.tripStatus} />
        {showVehicleStep ? <StatusBadge status={assignment.inspection?.status || 'NOT_STARTED'} /> : null}
      </div>
    </div>

    <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 md:grid-cols-4">
      <InfoItem icon={CalendarDays} label="Ngày vận hành" value={formatDate(assignment.scheduledStart)} />
      <InfoItem icon={Clock3} label="Thời gian chuyến" value={`${formatTime(assignment.scheduledStart)} - ${formatTime(assignment.scheduledEnd)}`} />
      <InfoItem icon={BusFront} label="Phương tiện" value={`${assignment.vehicle.plateNumber} (${assignment.vehicle.code})`} />
      <InfoItem icon={UserRound} label="Vai trò của bạn" value={assignment.actorRole === 'DRIVER' ? 'Tài xế' : 'Phụ xe'} />
    </div>

    <div className="mt-5 grid gap-3 rounded-lg bg-slate-50 p-4 text-sm md:grid-cols-2">
      <div>
        <span className="font-semibold text-slate-500">Tài xế: </span>
        <span className="font-bold text-slate-900">{assignment.driver?.fullName || 'Chưa phân công'}</span>
      </div>
      <div>
        <span className="font-semibold text-slate-500">Phụ xe: </span>
        <span className="font-bold text-slate-900">{assignment.busAssistant?.fullName || 'Chưa phân công'}</span>
      </div>
      {assignment.notes && (
        <div className="md:col-span-2">
          <span className="font-semibold text-slate-500">Ghi chú: </span>
          <span className="text-slate-700">{assignment.notes}</span>
        </div>
      )}
    </div>

    <TripRouteMap assignment={assignment} />

    {!isAccepted && !isRejected && (
      <div className="mt-5 rounded-lg border border-amber-100 bg-amber-50/70 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h4 className="font-black text-slate-950">Tiếp nhận chuyến được phân công</h4>
            <p className="mt-1 text-sm text-slate-600">
              Kiểm tra tuyến, xe, thời gian và nhân sự đi cùng trước khi tiếp nhận chuyến.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => onAcceptTrip(assignment.id)}
              disabled={!canRespond || isProcessing}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              Tiếp nhận chuyến
            </button>
            <button
              type="button"
              onClick={() => onRejectTrip(assignment.id)}
              disabled={!canRespond || isProcessing}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <AlertTriangle className="h-4 w-4" />
              Từ chối chuyến
            </button>
          </div>
        </div>
      </div>
    )}

    {isRejected && (
      <div className="mt-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
        <p className="font-bold">Bạn đã từ chối chuyến này.</p>
        <p className="mt-1">{assignment.rejectionReason || 'Chưa có lý do từ chối.'}</p>
      </div>
    )}

    {showVehicleStep && (
      <VehicleOperationsPanel
        assignment={assignment}
        canOperateVehicle={canOperateVehicle && assignment.actorRole === 'DRIVER'}
        isProcessing={isProcessing}
        onStartInspection={onStartInspection}
        onConfirmReady={onConfirmReady}
        onReportIssue={onReportIssue}
      />
    )}
    {showLifecycleStep && (
      <TripLifecyclePanel
        assignment={assignment}
        canStartTrip={canOperateVehicle && assignment.actorRole === 'DRIVER'}
        isProcessing={isProcessing}
        onStartTrip={onStartTrip}
        onCompleteTrip={onCompleteTrip}
        onSyncTripGps={onSyncTripGps}
      />
    )}
    {showIncidentStep && (
      <IncidentReportingPanel
        assignment={assignment}
        canReportIncident={['DRIVER', 'BUS_ASSISTANT'].includes(assignment.actorRole)}
        isProcessing={isProcessing}
        onReportIncident={onReportIncident}
      />
    )}
  </article>
  );
};

const ShiftScheduleCard = ({ shift }) => {
  const dutySteps = [
    { label: 'Nhận ca', value: formatTime(shift.dutyStart), detail: 'Có mặt tại điểm tập kết' },
    { label: 'Hạn check-in', value: formatTime(shift.checkInDeadline), detail: 'Trễ mốc này cần báo điều hành' },
    { label: 'Khởi hành', value: formatTime(shift.scheduledStart), detail: shift.route.origin },
    { label: 'Kết thúc chuyến', value: formatTime(shift.scheduledEnd), detail: shift.route.destination },
    { label: 'Kết thúc ca', value: formatTime(shift.dutyEnd), detail: 'Hoàn tất bàn giao sau chuyến' },
  ];

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-black text-white">
              {shift.shiftCode}
            </span>
            <span className="text-sm font-semibold text-slate-500">{shift.tripCode}</span>
          </div>
          <h3 className="mt-3 text-lg font-black text-slate-950">
            Ca {formatShortDate(shift.scheduledStart)} - {shift.actorRole === 'DRIVER' ? 'Tài xế' : 'Phụ xe'}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {shift.route.routeNumber} | {shift.route.origin} - {shift.route.destination}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={shift.shiftStatus} />
          <StatusBadge status={shift.tripStatus} />
          <StatusBadge status={shift.inspection?.status || 'NOT_STARTED'} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 md:grid-cols-3">
        <InfoItem icon={MapPin} label="Điểm tập kết" value={shift.reportLocation || shift.route.origin} />
        <InfoItem icon={BusFront} label="Xe phụ trách" value={`${shift.vehicle.plateNumber} (${shift.vehicle.code})`} />
        <InfoItem icon={UserRound} label="Nhân sự cùng ca" value={shift.actorRole === 'DRIVER' ? (shift.busAssistant?.fullName || 'Chưa phân công phụ xe') : (shift.driver?.fullName || 'Chưa phân công tài xế')} />
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-sm font-black uppercase text-slate-700">
          <Clock3 className="h-4 w-4 text-emerald-700" />
          Timeline ca làm việc
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-5">
          {dutySteps.map((step) => (
            <div key={step.label} className="rounded-lg bg-white p-3">
              <p className="text-xs font-bold uppercase text-slate-500">{step.label}</p>
              <p className="mt-1 text-lg font-black text-slate-950">{step.value}</p>
              <p className="mt-1 text-xs text-slate-500">{step.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50/70 p-4">
        <div className="flex items-center gap-2 text-sm font-black uppercase text-emerald-900">
          <ListChecks className="h-4 w-4" />
          Nhiệm vụ trong ca
        </div>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {(shift.dutyInstructions || []).map((instruction) => (
            <li key={instruction} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-700" />
              <span>{instruction}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
};

const OperationNotificationsPanel = ({ notifications = [] }) => (
    <section className="mt-6 rounded-lg border border-cyan-200 bg-cyan-50/70 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-black uppercase text-cyan-900">
            <BellRing className="h-4 w-4" />
            Thông báo vận hành
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Thông báo từ điều hành về tuyến, lịch chạy hoặc chỉ đạo khẩn.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-cyan-800">
          {notifications.length} thông báo
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {notifications.length ? notifications.map((notification) => (
          <article key={notification.id} className="rounded-lg border border-cyan-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${NOTIFICATION_PRIORITY_META[notification.priority] || NOTIFICATION_PRIORITY_META.NORMAL}`}>
                {notification.priority || 'NORMAL'}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                {NOTIFICATION_CATEGORY_LABELS[notification.category] || notification.category}
              </span>
            </div>
            <h3 className="mt-3 text-base font-black text-slate-950">{notification.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">{notification.message}</p>
            {notification.createdAt ? (
              <p className="mt-3 text-xs font-semibold text-slate-500">
                Gửi lúc {formatShortDate(notification.createdAt)} {formatTime(notification.createdAt)}
              </p>
            ) : null}
          </article>
        )) : (
          <div className="rounded-lg border border-dashed border-cyan-200/50 bg-white/70 p-8 text-center text-sm font-semibold text-slate-500 lg:col-span-2">
            Chưa có thông báo vận hành trong khoảng thời gian này.
          </div>
        )}
      </div>
    </section>
  );

const EmptyState = ({ message }) => (
  <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
    {message}
  </div>
);

const ScheduleOperationsPage = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('trips');
  const [filters, setFilters] = useState(getInitialFilters);
  const [assignedTrips, setAssignedTrips] = useState([]);
  const [shiftSchedule, setShiftSchedule] = useState([]);
  const [operationNotifications, setOperationNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingAssignmentId, setProcessingAssignmentId] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const [tripsPayload, shiftsPayload, notificationsPayload] = await Promise.all([
        scheduleOperationsService.getAssignedTrips(filters),
        scheduleOperationsService.getShiftSchedule(filters),
        scheduleOperationsService.getOperationNotifications(filters),
      ]);
      setAssignedTrips(tripsPayload.trips || []);
      setShiftSchedule(shiftsPayload.shifts || []);
      setOperationNotifications(notificationsPayload.notifications || []);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const intervalId = window.setInterval(async () => {
      try {
        const payload = await scheduleOperationsService.getOperationNotifications(filters);
        setOperationNotifications(payload.notifications || []);
      } catch {
        // Giữ dữ liệu thông báo gần nhất nếu refresh nền lỗi tạm thời.
      }
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [filters]);

  const runVehicleAction = async (assignmentId, action, successText) => {
    setProcessingAssignmentId(assignmentId);
    setError('');
    setSuccessMessage('');

    try {
      await action();
      setSuccessMessage(successText);
      await loadData();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setProcessingAssignmentId('');
    }
  };

  const handleStartInspection = (assignmentId, checklist) => runVehicleAction(
    assignmentId,
    () => scheduleOperationsService.startVehicleInspection(assignmentId, { checklist }),
    'Đã bắt đầu kiểm tra xe trước chuyến.'
  );

  const handleConfirmReady = (assignmentId, checklist) => runVehicleAction(
    assignmentId,
    () => scheduleOperationsService.confirmVehicleReady(assignmentId, { checklist }),
    'Đã xác nhận xe sẵn sàng vận hành.'
  );

  const handleReportIssue = (assignmentId, issuePayload) => runVehicleAction(
    assignmentId,
    () => scheduleOperationsService.reportVehicleIssue(assignmentId, issuePayload),
    'Đã gửi báo cáo lỗi xe.'
  );

  const handleAcceptTrip = (assignmentId) => runVehicleAction(
    assignmentId,
    () => scheduleOperationsService.acceptAssignedTrip(assignmentId),
    'Đã tiếp nhận chuyến được phân công.'
  );

  const handleRejectTrip = (assignmentId) => {
    const reason = window.prompt('Nhập lý do từ chối chuyến được phân công:');
    if (!reason) return Promise.resolve();

    return runVehicleAction(
      assignmentId,
      () => scheduleOperationsService.rejectAssignedTrip(assignmentId, { reason }),
      'Đã gửi lý do từ chối chuyến cho điều hành.'
    );
  };

  const handleStartTrip = (assignmentId) => runVehicleAction(
    assignmentId,
    async () => {
      const gpsPayload = await captureStartGpsPayload();
      return scheduleOperationsService.startTrip(assignmentId, gpsPayload);
    },
    'Đã bắt đầu chuyến. Hệ thống chuyển sang theo dõi vận hành.'
  );

  const handleCompleteTrip = (assignmentId) => runVehicleAction(
    assignmentId,
    () => scheduleOperationsService.completeTrip(assignmentId),
    'Đã hoàn thành chuyến và ghi nhận thời điểm kết thúc.'
  );

  const handleSyncTripGps = (assignmentId) => runVehicleAction(
    assignmentId,
    async () => {
      const gpsPayload = await captureStartGpsPayload();
      return scheduleOperationsService.syncTripGps(assignmentId, gpsPayload);
    },
    'Đã thử đồng bộ lại GPS cho chuyến đang vận hành.'
  );

  const handleReportIncident = (assignmentId, incidentPayload) => runVehicleAction(
    assignmentId,
    () => scheduleOperationsService.reportOperationIncident(assignmentId, incidentPayload),
    'Đã gửi báo cáo sự cố vận hành.'
  );

  const scheduleByDate = useMemo(() => (
    shiftSchedule.reduce((groups, shift) => {
      const key = getDateInputValue(new Date(shift.workDate));
      groups[key] = [...(groups[key] || []), shift];
      return groups;
    }, {})
  ), [shiftSchedule]);
  const weekDays = useMemo(() => (
    Array.from({ length: 7 }, (_, index) => addInputDays(filters.from, index))
  ), [filters.from]);

  const openShiftWeek = (anchor) => {
    setFilters(getWeekRange(anchor));
    setActiveTab('shifts');
  };

  const actorLabel = user?.role === 'DRIVER' ? 'Tài xế' : 'Phụ xe';
  const canOperateVehicle = user?.role === 'DRIVER';

  return (
    <div className="driver-dark-shell min-h-screen bg-[#020617] text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/95">
        <div className="flex w-full flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between xl:px-10">
          <button
            type="button"
            onClick={() => setActiveTab('trips')}
            className="flex items-center gap-3 text-left"
          >
            <span className="grid h-10 w-10 place-items-center rounded bg-emerald-400 text-slate-950">
              <BusFront size={22} />
            </span>
            <span>
              <span className="block text-lg font-semibold text-white">Driver BusDN</span>
              <span className="block text-xs text-slate-400">Vận hành xe buýt Đà Nẵng</span>
            </span>
          </button>

          <div className="flex items-center gap-3">
            <span className="rounded border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-slate-200">VN</span>
            <div className="flex items-center gap-2 rounded border border-white/10 bg-white/[0.04] px-2 py-1.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
                {(user?.fullName || 'D').charAt(0).toUpperCase()}
              </span>
              <div className="hidden min-w-0 sm:block">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Đã đăng nhập</p>
                <p className="max-w-[180px] truncate text-sm font-semibold text-white">{user?.fullName || 'Tài xế'}</p>
                <p className="text-xs font-semibold text-emerald-400">{actorLabel}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="grid w-full gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[215px_minmax(0,1fr)] xl:px-10">
        <nav className="flex h-fit flex-col gap-2 rounded border border-white/10 bg-white/[0.04] p-3 lg:sticky lg:top-6">
          <button
            type="button"
            onClick={() => setActiveTab('trips')}
            className={`inline-flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-medium transition ${
              activeTab === 'trips'
                ? 'bg-emerald-400 text-slate-950'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Route size={16} /> Chuyến được phân công
          </button>
          <button
            type="button"
            onClick={() => openShiftWeek(filters.from)}
            className={`inline-flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-medium transition ${
              activeTab === 'shifts'
                ? 'bg-emerald-400 text-slate-950'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <CalendarDays size={16} /> Lịch ca làm việc
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            className={`inline-flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-medium transition ${
              activeTab === 'notifications'
                ? 'bg-emerald-400 text-slate-950'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <BellRing size={16} /> Thông báo vận hành
          </button>
          <div className="mt-2 border-t border-white/10 pt-3 text-xs leading-5 text-slate-400">
            Theo dõi chuyến được phân công, kiểm tra xe và lịch ca làm việc cá nhân.
          </div>
        </nav>

        <section className="min-w-0">
          <section className="mb-5 rounded border border-white/10 bg-white/[0.04] px-4 py-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-400">Driver Operations</p>
            <h1 className="mt-1 text-2xl font-black text-white">
              {activeTab === 'trips' ? 'Chuyến được phân công' : activeTab === 'shifts' ? 'Lịch ca làm việc' : 'Thông báo vận hành'}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {activeTab === 'trips'
                ? 'Tiếp nhận chuyến, kiểm tra xe và vận hành theo phân công.'
                : activeTab === 'shifts'
                  ? 'Theo dõi ca làm việc của bạn theo tuần.'
                  : 'Theo dõi phản hồi từ điều hành và cập nhật xử lý báo cáo đã gửi.'}
            </p>
          </section>

          <section className="space-y-6">
          <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-end md:justify-between">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">Từ ngày</span>
                <input
                  type="date"
                  value={filters.from}
                  onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
                  className="rounded-lg border-slate-300 text-sm focus:border-emerald-600 focus:ring-emerald-600"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">Đến ngày</span>
                <input
                  type="date"
                  value={filters.to}
                  min={filters.from}
                  onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
                  className="rounded-lg border-slate-300 text-sm focus:border-emerald-600 focus:ring-emerald-600"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Làm mới lịch
            </button>
          </div>

          {successMessage && (
            <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {successMessage}
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="mt-6 rounded-lg border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              Đang tải lịch vận hành...
            </div>
          ) : activeTab === 'trips' ? (
            <div className="mt-6 space-y-4">
              {assignedTrips.length ? assignedTrips.map((trip) => (
                <AssignmentCard
                  key={trip.id}
                  assignment={trip}
                  canOperateVehicle={canOperateVehicle}
                  isProcessing={processingAssignmentId === trip.id}
                  onAcceptTrip={handleAcceptTrip}
                  onRejectTrip={handleRejectTrip}
                  onStartInspection={handleStartInspection}
                  onConfirmReady={handleConfirmReady}
                  onReportIssue={handleReportIssue}
                  onStartTrip={handleStartTrip}
                  onCompleteTrip={handleCompleteTrip}
                  onSyncTripGps={handleSyncTripGps}
                  onReportIncident={handleReportIncident}
                />
              )) : (
                <EmptyState message="Không có chuyến xe nào được phân công trong khoảng thời gian này." />
              )}
            </div>
          ) : activeTab === 'shifts' ? (
            <section className="mt-6 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">UC40 - Lịch ca làm việc</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">Lịch làm việc theo tuần</h2>
                  <p className="mt-1 text-sm text-slate-500">Chỉ hiển thị các ca admin đã phân công cho bạn.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => openShiftWeek(addInputDays(filters.from, -7))} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-200 text-emerald-700" title="Tuần trước"><ChevronLeft size={18} /></button>
                  <button type="button" onClick={() => openShiftWeek(new Date())} className="h-10 rounded-lg border border-emerald-200 px-3 text-sm font-bold text-emerald-700">Tuần này</button>
                  <button type="button" onClick={() => openShiftWeek(addInputDays(filters.from, 7))} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-200 text-emerald-700" title="Tuần sau"><ChevronRight size={18} /></button>
                </div>
              </div>
              <div className="overflow-x-auto p-4">
                <div className="grid min-w-[980px] grid-cols-7 gap-3">
                  {weekDays.map((date) => {
                    const dayShifts = scheduleByDate[date] || [];
                    const today = getDateInputValue(new Date()) === date;
                    return (
                      <div key={date} className={`min-h-[260px] overflow-hidden rounded-xl border ${today ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-slate-200'}`}>
                        <div className={today ? 'border-b border-emerald-200 bg-emerald-50 px-3 py-3 text-emerald-800' : 'border-b border-slate-200 bg-slate-50 px-3 py-3 text-slate-700'}>
                          <p className="text-xs font-black uppercase tracking-[0.12em]">{new Date(`${date}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'short' })}</p>
                          <p className="mt-1 text-lg font-black">{date.slice(8, 10)}/{date.slice(5, 7)}</p>
                        </div>
                        <div className="space-y-2 p-2">
                          {dayShifts.length ? dayShifts.map((shift) => (
                            <article key={shift.id} className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-black text-slate-950">{shift.startTime} - {shift.endTime}</p>
                                <StatusBadge status={shift.assignmentStatus} />
                              </div>
                              <p className="mt-2 text-sm font-bold text-slate-950">{shift.shiftName}</p>
                              <p className="mt-1 text-xs font-semibold text-slate-600">{shift.shiftCode}</p>
                              {shift.route?.routeName ? <p className="mt-2 text-xs text-emerald-800">{shift.route.routeCode} · {shift.route.routeName}</p> : null}
                              {shift.description ? <p className="mt-2 line-clamp-3 text-xs text-slate-500">{shift.description}</p> : null}
                            </article>
                          )) : <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-400">Không có ca</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : (
            <OperationNotificationsPanel notifications={operationNotifications} />
          )}
          </section>
        </section>
      </main>
    </div>
  );
};

export default ScheduleOperationsPage;
