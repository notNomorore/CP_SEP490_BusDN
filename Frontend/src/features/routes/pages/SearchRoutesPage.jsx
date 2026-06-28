import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  CircleMarker,
  Tooltip,
  TileLayer,
  useMap,
  ZoomControl,
} from 'react-leaflet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import routeService from '../services/routeService';
import useAuthStore from '../../auth/stores/authStore';
import Header from '../../../shared/components/navigation/Header';
import customerSupportService, { FEEDBACK_CATEGORIES } from '../../customerSupport/services/customerSupportService';

const INITIAL_MAP_ZOOM = 13;
const MIN_MAP_ZOOM = 11;
const MAX_MAP_ZOOM = 19;
const DEFAULT_CENTER = { latitude: 16.0614, longitude: 108.2272 };
const DA_NANG_CENTRAL = { name: 'Da Nang Central', latitude: 16.0667, longitude: 108.1690 };
const ROUTE_PREFERENCES = [
  { id: 'fastest', label: 'Nhanh nhất', icon: 'bolt' },
  { id: 'shortest', label: 'Ngắn nhất', icon: 'straighten' },
  { id: 'lowest-cost', label: 'Tiết kiệm nhất', icon: 'payments' },
  { id: 'least-traffic', label: 'Ít kẹt xe nhất', icon: 'traffic' },
];

const STATUS_LABELS = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Tạm ngưng',
  Delayed: 'Trễ chuyến',
  OnTime: 'Đúng giờ',
  'On Time': 'Đúng giờ',
  Completed: 'Hoàn thành',
  InProgress: 'Đang chạy',
  'In Progress': 'Đang chạy',
  Scheduled: 'Theo lịch',
  Unavailable: 'Không khả dụng',
  Live: 'Trực tiếp',
  Off: 'Tắt',
};

const translateStatus = (status) => STATUS_LABELS[status] || status;

const formatDuration = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (!hours) {
    return `${remainder} phút`;
  }

  return `${hours} giờ ${remainder} phút`;
};

const formatFare = (fare) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(fare);

const toRadians = (degrees) => degrees * (Math.PI / 180);

const calculateDistanceKm = (start, end) => {
  if (!isValidLocation(start) || !isValidLocation(end)) {
    return null;
  }

  const earthRadiusKm = 6371;
  const deltaLat = toRadians(end.latitude - start.latitude);
  const deltaLng = toRadians(end.longitude - start.longitude);
  const startLat = toRadians(start.latitude);
  const endLat = toRadians(end.latitude);
  const haversine =
    Math.sin(deltaLat / 2) ** 2
    + Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const addMinutesToTime = (time, minutesToAdd) => {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + minutesToAdd;
  const nextHours = Math.floor(totalMinutes / 60) % 24;
  const nextMinutes = totalMinutes % 60;

  return `${String(nextHours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}`;
};

const getRouteCenter = (route) => {
  const stops = route?.stops?.length ? route.stops : [];
  const validStops = stops.filter((stop) => (
    typeof stop.latitude === 'number' && typeof stop.longitude === 'number'
  ));

  if (!validStops.length) {
    return DEFAULT_CENTER;
  }

  return {
    latitude: validStops.reduce((total, stop) => total + stop.latitude, 0) / validStops.length,
    longitude: validStops.reduce((total, stop) => total + stop.longitude, 0) / validStops.length,
  };
};

const toLatLng = ({ latitude, longitude }) => [latitude, longitude];

const isValidLocation = (location) => (
  typeof location?.latitude === 'number' && typeof location?.longitude === 'number'
);

const normalizeStopLocation = (stop) => {
  if (stop.name === DA_NANG_CENTRAL.name) {
    return {
      ...stop,
      latitude: DA_NANG_CENTRAL.latitude,
      longitude: DA_NANG_CENTRAL.longitude,
    };
  }

  return stop;
};

const createBusIcon = (isSelected) => L.divIcon({
  className: '',
  iconAnchor: [18, 46],
  popupAnchor: [0, -44],
  html: `
    <div class="relative flex flex-col items-center">
      <div class="flex h-9 w-9 items-center justify-center rounded-full border-[3px] bg-white shadow-lg ${
        isSelected
          ? 'border-emerald-700 text-emerald-700 ring-[6px] ring-emerald-300/55'
          : 'border-emerald-500 text-emerald-600 ring-2 ring-white/80'
      }">
        <span class="material-symbols-outlined text-[20px]">directions_bus</span>
      </div>
      <div class="h-0 w-0 border-x-[7px] border-x-transparent ${
        isSelected ? 'border-t-emerald-700' : 'border-t-emerald-500'
      } border-t-[10px]"></div>
    </div>
  `,
});

const currentLocationIcon = L.divIcon({
  className: '',
  iconAnchor: [24, 24],
  html: `
    <div class="relative flex h-12 w-12 items-center justify-center">
      <span class="absolute h-12 w-12 rounded-full bg-sky-400/25"></span>
      <span class="absolute h-7 w-7 rounded-full bg-sky-500/25"></span>
      <span class="relative h-4 w-4 rounded-full border-2 border-white bg-sky-500 shadow-lg"></span>
    </div>
  `,
});

const liveBusIcon = (status) => {
  const isDelayed = status === 'Delayed';

  return L.divIcon({
    className: '',
    iconAnchor: [22, 45],
    popupAnchor: [0, -44],
    html: `
      <div class="relative flex flex-col items-center">
        <span class="absolute h-12 w-12 rounded-full ${
          isDelayed ? 'bg-amber-300/35' : 'bg-emerald-300/35'
        } animate-ping"></span>
        <div class="relative flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white ${
          isDelayed ? 'bg-amber-500' : 'bg-emerald-600'
        } text-white shadow-xl">
          <span class="material-symbols-outlined text-[23px]">directions_bus</span>
        </div>
        <div class="h-0 w-0 border-x-[7px] border-x-transparent ${
          isDelayed ? 'border-t-amber-500' : 'border-t-emerald-600'
        } border-t-[10px]"></div>
      </div>
    `,
  });
};

const RouteLabelIcon = (routeNumber) => L.divIcon({
  className: '',
  iconAnchor: [18, -2],
  html: `<span class="rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-bold text-white shadow">${routeNumber}</span>`,
});

const MapAutoFocus = ({ selectedRoute, currentLocation }) => {
  const map = useMap();

  useEffect(() => {
    const routePath = selectedRoute?.pathPoints?.length
      ? selectedRoute.pathPoints
      : selectedRoute?.stops || [];
    const validPath = routePath.filter(isValidLocation);

    if (validPath.length > 1) {
      map.fitBounds(validPath.map(toLatLng), {
        animate: true,
        maxZoom: 15,
        padding: [80, 80],
      });
      return;
    }

    if (validPath.length === 1) {
      map.setView(toLatLng(validPath[0]), 15, { animate: true });
      return;
    }

    if (isValidLocation(currentLocation)) {
      map.setView(toLatLng(currentLocation), 15, { animate: true });
      return;
    }

    map.setView(toLatLng(DEFAULT_CENTER), INITIAL_MAP_ZOOM, { animate: true });
  }, [currentLocation, map, selectedRoute]);

  return null;
};

const MapCanvas = ({
  stops,
  selectedRoute,
  currentLocation,
  liveBusData,
  liveError,
  arrivalAlerts,
  onDismissArrivalAlert,
  onUseCurrentLocation,
}) => {
  const routePath = selectedRoute?.pathPoints?.length
    ? selectedRoute.pathPoints
    : selectedRoute?.stops || [];
  const routePositions = routePath.filter(isValidLocation).map(toLatLng);
  const selectedRouteStop = selectedRoute?.stops
    ?.map(normalizeStopLocation)
    .find(isValidLocation);

  return (
    <section className="relative min-w-0 flex-1 overflow-hidden bg-slate-200">
      <MapContainer
        center={toLatLng(getRouteCenter(selectedRoute))}
        zoom={INITIAL_MAP_ZOOM}
        minZoom={MIN_MAP_ZOOM}
        maxZoom={MAX_MAP_ZOOM}
        zoomControl={false}
        zoomDelta={0.5}
        zoomSnap={0.25}
        wheelPxPerZoomLevel={160}
        preferCanvas
        className="h-full w-full"
      >
        <TileLayer
          attribution="Map data © OpenStreetMap"
          detectRetina
          keepBuffer={4}
          maxNativeZoom={19}
          maxZoom={MAX_MAP_ZOOM}
          updateWhenIdle
          updateWhenZooming={false}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapAutoFocus selectedRoute={selectedRoute} currentLocation={currentLocation} />
        <ZoomControl position="bottomright" />

        {routePositions.length > 1 && (
          <>
            <Polyline
              positions={routePositions}
              pathOptions={{ color: '#ffffff', weight: 12, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
            />
            <Polyline
              positions={routePositions}
              pathOptions={{ color: '#10b981', weight: 7, opacity: 0.98, lineCap: 'round', lineJoin: 'round' }}
            />
            <Polyline
              positions={routePositions}
              pathOptions={{ color: '#047857', weight: 2, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
            />
            {routePositions.map((position) => (
              <CircleMarker
                key={`${position[0]}-${position[1]}`}
                center={position}
                radius={3}
                pathOptions={{
                  color: '#ffffff',
                  fillColor: '#ffffff',
                  fillOpacity: 1,
                  weight: 1,
                }}
                interactive={false}
              />
            ))}
          </>
        )}

        {stops.filter(isValidLocation).map((stop) => {
          const isSelectedRouteStop = stop.routeNumbers?.includes(selectedRoute?.routeNumber);

          return (
            <Marker
              key={`${stop.name}-${stop.latitude.toFixed(5)}-${stop.longitude.toFixed(5)}`}
              position={toLatLng(stop)}
              icon={createBusIcon(isSelectedRouteStop)}
              title={stop.name}
              interactive={false}
            >
              {isSelectedRouteStop && (
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -24]}
                  opacity={1}
                  className="bus-stop-name-tooltip"
                >
                  {stop.name}
                </Tooltip>
              )}
            </Marker>
          );
        })}

        {selectedRouteStop && (
          <Marker
            position={toLatLng(selectedRouteStop)}
            icon={RouteLabelIcon(selectedRoute.routeNumber)}
            interactive={false}
          />
        )}

        {isValidLocation(currentLocation) && (
          <Marker
            position={toLatLng(currentLocation)}
            icon={currentLocationIcon}
            title="Vị trí hiện tại"
            interactive={false}
          />
        )}

        {(liveBusData?.buses || []).filter((bus) => isValidLocation(bus.currentLocation)).map((bus) => (
          <Marker
            key={bus.busId}
            position={toLatLng(bus.currentLocation)}
            icon={liveBusIcon(bus.status)}
            title={`${bus.busId} - ${bus.status}`}
            interactive={false}
          />
        ))}
      </MapContainer>

      <button
        type="button"
        onClick={onUseCurrentLocation}
        className="absolute right-5 top-5 z-[1000] flex items-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-semibold shadow-lg hover:bg-emerald-50"
      >
        <span className="material-symbols-outlined text-emerald-600">location_on</span>
        Trạm gần đây
      </button>

      {currentLocation && (
        <div className="absolute right-5 top-24 z-[1000] w-56 rounded-lg bg-white px-4 py-3 text-xs shadow-lg">
          <div className="flex items-center gap-2 font-black uppercase tracking-wide text-slate-950">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Tình trạng giao thông
          </div>
          <p className="mt-2 leading-5 text-slate-500">
            Đang kiểm tra các tuyến gần vị trí GPS hiện tại của bạn.
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-5 right-5 z-[1000] rounded-lg bg-white px-3 py-2 text-xs text-slate-500 shadow">
        Bản đồ Leaflet © OpenStreetMap
      </div>

      {(liveBusData || liveError) && (
        <div className="absolute right-5 top-24 z-[1000] w-72 rounded-xl bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Vị trí xe buýt trực tiếp</div>
            <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${
              liveError ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
            }`}>
              {liveError ? 'Không khả dụng' : 'Trực tiếp'}
            </span>
          </div>
          {liveError ? (
            <p className="mt-2 text-sm text-slate-600">{liveError}</p>
          ) : (
            <div className="mt-3 space-y-2">
              {(liveBusData.buses || []).map((bus) => (
                <div key={bus.busId} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-slate-950">{bus.busId}</span>
                    <span className={bus.status === 'Delayed' ? 'font-bold text-amber-600' : 'font-bold text-emerald-700'}>
                      {translateStatus(bus.status)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Trạm tiếp theo: {bus.nextStop} • ETA {bus.estimatedArrivalTime}
                  </div>
                  {bus.tripProgress && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                        <span>Tiến độ chuyến</span>
                        <span>{bus.tripProgress.progressPercent}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-emerald-600"
                          style={{ width: `${bus.tripProgress.progressPercent}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {bus.tripProgress.completedStops.length} đã qua • {bus.tripProgress.remainingStops.length} còn lại • {bus.tripProgress.estimatedRemainingTime}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {arrivalAlerts.length > 0 && (
        <div className="absolute left-5 top-5 z-[1000] w-80 space-y-2">
          {arrivalAlerts.map((alert) => (
            <div key={alert.id} className="rounded-xl border border-emerald-100 bg-white p-4 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                    <span className="material-symbols-outlined text-[19px] text-emerald-600">notifications_active</span>
                    {alert.title}
                  </div>
                  <p className="mt-1 text-sm leading-5 text-slate-600">{alert.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onDismissArrivalAlert?.(alert.id)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Đóng thông báo xe đến"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
const isSameRouteId = (left, right) => String(left || '') === String(right || '');

const buildStopId = (route, stop) => {
  const normalizedName = stop.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${route.routeNumber}-${stop.originalOrder || stop.order}-${normalizedName}`;
};

const buildArrivalNotificationId = (route, stop) => (
  `${route.routeNumber}-${buildStopId(route, stop)}-arrival`
);

const buildDelayNotificationId = (route) => `${route.routeNumber}-delay`;

const buildRouteChangeNotificationId = (route) => `${route.routeNumber}-route-change`;

const RouteCard = ({
  route,
  compact = false,
  isHighlighted = false,
  isFavorite = false,
  onSelect,
  onToggleFavorite,
}) => (
  <article
    role="button"
    tabIndex={0}
    onClick={onSelect}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect?.();
      }
    }}
    className={`relative block w-full rounded-xl border bg-white p-4 pr-14 text-left shadow-sm transition hover:border-emerald-500 hover:shadow-md ${
      isHighlighted ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200'
    }`}
  >
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggleFavorite?.(route);
      }}
      className={`absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg border ${
        isFavorite
          ? 'border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100'
          : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
      }`}
      aria-label={isFavorite ? 'Bỏ lưu tuyến yêu thích' : 'Lưu tuyến yêu thích'}
    >
      <span className="material-symbols-outlined text-[20px] leading-none">{isFavorite ? 'star' : 'star_border'}</span>
    </button>

    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-slate-600">
        <span className="material-symbols-outlined text-[22px]">directions_bus</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
            {route.routeNumber}
          </span>
          <h3 className="min-w-0 truncate text-base font-bold text-slate-950">{route.name}</h3>
        </div>
        <p className="mt-1 text-sm text-slate-700">
          {route.origin} - {route.destination}
        </p>
      </div>
    </div>

    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
      <div className="rounded-lg bg-slate-50 px-2 py-2">
        <div className="text-[11px] font-semibold uppercase text-slate-500">Thời gian</div>
        <div className="font-semibold text-slate-950">{formatDuration(route.estimatedDurationMinutes)}</div>
      </div>
      <div className="rounded-lg bg-slate-50 px-2 py-2">
        <div className="text-[11px] font-semibold uppercase text-slate-500">Giá vé</div>
        <div className="font-semibold text-slate-950">{formatFare(route.fare)}</div>
      </div>
      <div className="rounded-lg bg-slate-50 px-2 py-2">
        <div className="text-[11px] font-semibold uppercase text-slate-500">Quãng đường</div>
        <div className="font-semibold text-slate-950">{route.distanceKm} km</div>
      </div>
    </div>

    {!compact && (
      <div className="mt-3">
        <div className="mb-2 text-xs font-bold uppercase text-slate-500">Trạm dừng</div>
        <div className="flex flex-wrap gap-1.5">
          {route.stops.map((stop) => (
            <span
              key={`${route.id}-${stop.order}`}
              className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-700"
            >
              {stop.name}
            </span>
          ))}
        </div>
      </div>
    )}
  </article>
);

const RouteFeedbackForm = ({ route }) => {
  const [form, setForm] = useState({
    category: 'ROUTE_EXPERIENCE',
    title: '',
    description: '',
    ratingScore: '',
  });
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateForm = (updates) => {
    setForm((current) => ({ ...current, ...updates }));
    setErrors({});
    setSuccessMessage('');
  };

  const validate = () => {
    const nextErrors = {};

    if (!form.title.trim()) {
      nextErrors.title = 'Vui lòng nhập tiêu đề góp ý.';
    }
    if (!form.description.trim()) {
      nextErrors.description = 'Vui lòng nhập nội dung góp ý.';
    } else if (form.description.trim().length < 20) {
      nextErrors.description = 'Nội dung góp ý cần có ít nhất 20 ký tự.';
    }
    if (!form.ratingScore) {
      nextErrors.ratingScore = 'Vui lòng chọn mức đánh giá.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage('');

    try {
      const response = await customerSupportService.submitFeedback({
        type: 'SERVICE_FEEDBACK',
        category: form.category,
        title: form.title.trim(),
        description: form.description.trim(),
        routeName: `${route.routeNumber} - ${route.name}`,
        ratingScore: form.ratingScore,
        priority: form.category === 'COMPLAINT' ? 'HIGH' : 'NORMAL',
      });

      const referenceNumber = response?.data?.referenceNumber;
      setSuccessMessage(referenceNumber
        ? `Đã gửi góp ý thành công. Mã tham chiếu: ${referenceNumber}`
        : 'Đã gửi góp ý thành công.');
      setForm({
        category: 'ROUTE_EXPERIENCE',
        title: '',
        description: '',
        ratingScore: '',
      });
    } catch (error) {
      setErrors({
        submit: error?.message || 'Không thể gửi góp ý. Vui lòng thử lại sau.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
        <div className="text-sm font-black text-slate-950">Gửi góp ý cho tuyến này</div>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          Góp ý của bạn sẽ được gắn với tuyến {route.routeNumber} - {route.name} và chuyển đến bộ phận quản trị.
        </p>
      </div>

      {successMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold leading-5 text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      <label className="block space-y-1">
        <span className="text-xs font-black text-slate-700">Danh mục góp ý</span>
        <select
          value={form.category}
          onChange={(event) => updateForm({ category: event.target.value })}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        >
          {FEEDBACK_CATEGORIES.map((category) => (
            <option key={category.value} value={category.value}>{category.label}</option>
          ))}
        </select>
      </label>

      <div>
        <div className="mb-2 text-xs font-black text-slate-700">Đánh giá dịch vụ</div>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              key={score}
              type="button"
              onClick={() => updateForm({ ratingScore: String(score) })}
              className={`rounded-lg border px-2 py-2 text-sm font-black ${
                Number(form.ratingScore) === score
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50'
              }`}
            >
              {score}
            </button>
          ))}
        </div>
        {errors.ratingScore ? <p className="mt-1 text-xs font-semibold text-red-600">{errors.ratingScore}</p> : null}
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-black text-slate-700">Tiêu đề</span>
        <input
          value={form.title}
          onChange={(event) => updateForm({ title: event.target.value })}
          placeholder="Nhập tiêu đề ngắn cho góp ý"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
        {errors.title ? <p className="text-xs font-semibold text-red-600">{errors.title}</p> : null}
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-black text-slate-700">Nội dung góp ý</span>
        <textarea
          value={form.description}
          onChange={(event) => updateForm({ description: event.target.value })}
          placeholder="Mô tả trải nghiệm của bạn, điểm tốt hoặc điều cần cải thiện..."
          className="min-h-28 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
        {errors.description ? <p className="text-xs font-semibold text-red-600">{errors.description}</p> : null}
      </label>

      {errors.submit ? (
        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {errors.submit}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="material-symbols-outlined text-[18px]">
          {isSubmitting ? 'progress_activity' : 'send'}
        </span>
        {isSubmitting ? 'Đang gửi...' : 'Gửi góp ý'}
      </button>
    </form>
  );
};

const RouteDetailsPanel = ({
  route,
  currentLocation,
  liveBusData,
  isLiveTracking = false,
  isLiveLoading = false,
  liveError = '',
  isFavorite = false,
  isStopFavorite,
  isArrivalNotificationEnabled,
  isDelayNotificationEnabled,
  isRouteChangeNotificationEnabled,
  panelMessage = '',
  onToggleFavorite,
  onToggleFavoriteStop,
  onToggleArrivalNotification,
  onToggleDelayNotification,
  onToggleRouteChangeNotification,
  onToggleLiveLocation,
  onPurchaseTicket,
  onClose,
}) => {
  const [directionTab, setDirectionTab] = useState('outbound');
  const [detailTab, setDetailTab] = useState('info');
  const validStops = (route.stops || []).map(normalizeStopLocation).filter(isValidLocation);
  const nearestStop = currentLocation && validStops.length
    ? validStops
      .map((stop) => ({
        ...stop,
        distanceKm: calculateDistanceKm(currentLocation, stop),
      }))
      .filter((stop) => typeof stop.distanceKm === 'number')
      .sort((first, second) => first.distanceKm - second.distanceKm)[0]
    : null;
  const firstDeparture = route.operatingHours?.firstDeparture || '05:30';
  const lastDeparture = route.operatingHours?.lastDeparture || '21:00';
  const frequencyMinutes = route.operatingHours?.frequencyMinutes || 30;
  const maxOffsetMinutes = Math.max(
    ...route.stops.map((stop) => stop.estimatedOffsetMinutes || 0),
    route.estimatedDurationMinutes || 0
  );
  const directionStops = directionTab === 'outbound'
    ? route.stops
    : route.stops
      .slice()
      .reverse()
      .map((stop, index) => ({
        ...stop,
        originalOrder: stop.order,
        order: index + 1,
        estimatedOffsetMinutes: Math.max(maxOffsetMinutes - (stop.estimatedOffsetMinutes || 0), 0),
      }));
  const directionOrigin = directionTab === 'outbound' ? route.origin : route.destination;
  const directionDestination = directionTab === 'outbound' ? route.destination : route.origin;
  const detailTabs = [
    { id: 'info', label: 'Thông tin' },
    { id: 'stops', label: 'Trạm' },
    { id: 'arrival', label: 'Lịch chạy' },
    { id: 'progress', label: 'Tiến độ' },
    { id: 'feedback', label: 'Góp ý' },
  ];
  const stopEtaSummary = liveBusData?.stopEtaSummary || [];
  const getStopEta = (stop) => (
    stopEtaSummary.find((eta) => eta.stopId === buildStopId(route, stop))
  );

  return (
    <aside className="fixed bottom-0 right-0 top-[80px] z-[1200] flex w-[360px] max-w-[calc(100vw-24px)] flex-col border-l border-slate-200 bg-white shadow-2xl">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-black text-white">
                {route.routeNumber}
              </span>
              <span className="rounded bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-emerald-700">
                {translateStatus(route.status || 'ACTIVE')}
              </span>
            </div>
            <h2 className="mt-2 truncate text-xl font-black text-slate-950">{route.name}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {directionOrigin} - {directionDestination}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng chi tiết tuyến"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
          {[
            { id: 'outbound', label: 'Lượt đi' },
            { id: 'inbound', label: 'Lượt về' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDirectionTab(tab.id)}
              className={`rounded-md px-3 py-2 text-sm font-black ${
                directionTab === tab.id
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-5 gap-1">
          {detailTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDetailTab(tab.id)}
              title={tab.label}
              className={`min-w-0 truncate rounded-lg border px-1 py-2 text-[10px] font-black ${
                detailTab === tab.id
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {panelMessage && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold leading-5 text-emerald-800">
            {panelMessage}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {detailTab === 'info' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <div className="text-[11px] font-black uppercase text-slate-400">Giá vé</div>
                <div className="mt-1 font-black text-slate-950">{formatFare(route.fare)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <div className="text-[11px] font-black uppercase text-slate-400">Thời gian</div>
                <div className="mt-1 font-black text-slate-950">{formatDuration(route.estimatedDurationMinutes)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <div className="text-[11px] font-black uppercase text-slate-400">Quãng đường</div>
                <div className="mt-1 font-black text-slate-950">{route.distanceKm} km</div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase text-slate-400">Giờ hoạt động</div>
                  <div className="font-semibold text-slate-700">{firstDeparture} - {lastDeparture}</div>
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase text-slate-400">Điểm đi</div>
                  <div className="font-semibold text-slate-950">{directionOrigin}</div>
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase text-slate-400">Điểm đến</div>
                  <div className="font-semibold text-slate-950">{directionDestination}</div>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-slate-700">
              <div className="mb-1 text-[11px] font-black uppercase text-emerald-700">Mô tả tuyến</div>
              Tuyến tối ưu từ {directionOrigin} đến {directionDestination}, bao gồm các trạm chính,
              giờ hoạt động, thời gian di chuyển dự kiến, giá vé và hỗ trợ tìm trạm gần đây.
            </div>

            <div className="rounded-lg border border-emerald-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-slate-950">Vé xe buýt</div>
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    Mua vé một lượt hoặc vé tháng cho hành trình của bạn.
                  </p>
                </div>
                <span className="shrink-0 rounded bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-emerald-700">
                  {formatFare(route.fare)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onPurchaseTicket?.(route)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700"
              >
                <span className="material-symbols-outlined text-[19px]">confirmation_number</span>
                Mua vé
              </button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">notifications</span>
                  Cài đặt thông báo chuyến đi
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="text-sm font-black text-slate-900">Thông báo xe đến trạm</div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Bật chuông cạnh trạm để nhận thông báo khi xe sắp đến và đã đến.
                    </p>
                  </div>
                  <span className="rounded bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-emerald-700">
                    Trạm
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="text-sm font-black text-slate-900">Thông báo trễ chuyến</div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Thông báo khi xe trên tuyến này trễ so với lịch dự kiến.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleDelayNotification?.(route)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                      isDelayNotificationEnabled?.(route) ? 'bg-emerald-600' : 'bg-slate-200'
                    }`}
                    aria-label={isDelayNotificationEnabled?.(route) ? 'Tắt thông báo trễ chuyến' : 'Bật thông báo trễ chuyến'}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                        isDelayNotificationEnabled?.(route) ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="text-sm font-black text-slate-900">Thông báo đổi tuyến</div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Thông báo khi tuyến có đổi lộ trình, đổi trạm hoặc cập nhật tạm thời.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleRouteChangeNotification?.(route)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                      isRouteChangeNotificationEnabled?.(route) ? 'bg-emerald-600' : 'bg-slate-200'
                    }`}
                    aria-label={isRouteChangeNotificationEnabled?.(route) ? 'Tắt thông báo đổi tuyến' : 'Bật thông báo đổi tuyến'}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                        isRouteChangeNotificationEnabled?.(route) ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                    Vị trí xe buýt trực tiếp
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Theo dõi xe đang hoạt động trên tuyến bằng vị trí GPS, trạng thái và giờ đến trạm tiếp theo.
                  </p>
                </div>
                <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-black uppercase ${
                  isLiveTracking ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {isLiveTracking ? 'Trực tiếp' : 'Tắt'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onToggleLiveLocation?.(route)}
                disabled={isLiveLoading}
                className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-black transition disabled:opacity-60 ${
                  isLiveTracking
                    ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    : 'bg-slate-950 text-white hover:bg-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {isLiveLoading ? 'progress_activity' : 'gps_fixed'}
                </span>
                {isLiveTracking ? 'Tắt theo dõi trực tiếp' : 'Xem vị trí trực tiếp'}
              </button>
              {liveError && (
                <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {liveError}
                </div>
              )}
              {isLiveTracking && liveBusData?.buses?.length > 0 && (
                <div className="mt-3 space-y-2">
                  {liveBusData.buses.map((bus) => (
                    <div key={bus.busId} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-slate-950">{bus.busId}</span>
                        <span className={bus.status === 'Delayed' ? 'font-bold text-amber-600' : 'font-bold text-emerald-700'}>
                          {translateStatus(bus.status)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Trạm tiếp theo: {bus.nextStop} - ETA {bus.estimatedArrivalTime}
                      </div>
                      {bus.delay && (
                        <div className="mt-2 rounded border border-amber-100 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                          Trễ {bus.delay.delayDurationMinutes} phút • {bus.delay.delayReason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {isLiveTracking && stopEtaSummary.length > 0 && (
                <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                  <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-emerald-700">
                    Thời gian xe đến dự kiến (ETA)
                  </div>
                  <div className="space-y-2">
                    {stopEtaSummary.slice(0, 4).map((eta) => (
                      <div key={eta.stopId} className="flex items-center justify-between gap-3 rounded bg-white px-3 py-2 text-xs">
                        <div className="min-w-0">
                          <div className="truncate font-black text-slate-900">{eta.stopName}</div>
                          <div className="text-slate-500">{eta.nextBusId || 'Chưa có xe hoạt động'}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-black text-emerald-700">{eta.estimatedArrivalTime}</div>
                          <div className="text-[10px] font-bold uppercase text-slate-400">{translateStatus(eta.status)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {isLiveTracking && liveBusData?.routeChange && (
                <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900">
                  <div className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-amber-700">
                    <span className="material-symbols-outlined text-[16px]">route</span>
                    Thay đổi tuyến
                  </div>
                  <div className="font-semibold">{liveBusData.routeChange.reasonForChange}</div>
                  <p className="mt-1 text-xs leading-5">{liveBusData.routeChange.updatedRoutePath}</p>
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Trạm gần nhất</div>
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
                  Trực tiếp
                </span>
              </div>
              {nearestStop ? (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                  <div className="font-black text-slate-950">{nearestStop.name}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    {nearestStop.distanceKm.toFixed(2)} km từ vị trí hiện tại của bạn
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">
                  Dùng vị trí hiện tại để hiển thị trạm gần nhất của tuyến này.
                </div>
              )}
            </div>
          </div>
        )}

        {detailTab === 'stops' && (
          <div className="space-y-3">
            {!isLiveTracking && (
              <button
                type="button"
                onClick={() => onToggleLiveLocation?.(route)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700 hover:bg-emerald-100"
              >
                <span className="material-symbols-outlined text-[18px]">schedule</span>
                Xem ETA thời gian thực
              </button>
            )}
            {directionStops.map((stop) => {
              const stopEta = getStopEta(stop);

              return (
                <div key={`${route.id}-${directionTab}-stop-${stop.order}`} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-black text-emerald-700">
                    {stop.order}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-black text-slate-900">{stop.name}</div>
                    <div className="text-xs text-slate-500">
                      Giờ đến sớm nhất: {addMinutesToTime(firstDeparture, stop.estimatedOffsetMinutes || 0)}
                    </div>
                    <div className={`mt-1 text-xs font-black ${
                      stopEta?.etaMinutes ? 'text-emerald-700' : 'text-slate-400'
                    }`}>
                      ETA: {stopEta?.estimatedArrivalTime || 'Chưa có ETA'}
                      {stopEta?.nextBusId ? ` • ${stopEta.nextBusId}` : ''}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onToggleArrivalNotification?.(route, stop)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                        isArrivalNotificationEnabled?.(route, stop)
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                      aria-label={isArrivalNotificationEnabled?.(route, stop) ? 'Tắt thông báo xe đến' : 'Bật thông báo xe đến'}
                      title={isArrivalNotificationEnabled?.(route, stop) ? 'Tắt thông báo xe đến' : 'Bật thông báo xe đến'}
                    >
                      <span className="material-symbols-outlined text-[18px] leading-none">
                        {isArrivalNotificationEnabled?.(route, stop) ? 'notifications_active' : 'notifications'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleFavoriteStop?.(route, stop)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                        isStopFavorite?.(route, stop)
                          ? 'border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                      aria-label={isStopFavorite?.(route, stop) ? 'Bỏ lưu trạm yêu thích' : 'Lưu trạm yêu thích'}
                      title={isStopFavorite?.(route, stop) ? 'Bỏ lưu trạm yêu thích' : 'Lưu trạm yêu thích'}
                    >
                      <span className="material-symbols-outlined text-[18px] leading-none">
                        {isStopFavorite?.(route, stop) ? 'star' : 'star_border'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {detailTab === 'arrival' && (
          <div>
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="grid grid-cols-4 border-b border-slate-100 px-3 py-2 text-xs font-black uppercase text-slate-400">
                <span>Trạm</span>
                <span>Giờ đến sớm nhất</span>
                <span>ETA trực tiếp</span>
                <span>Tần suất</span>
              </div>
              {directionStops.map((stop) => {
                const stopEta = getStopEta(stop);

                return (
                  <div
                    key={`${route.id}-${directionTab}-arrival-${stop.order}`}
                    className="grid grid-cols-4 gap-2 border-b border-slate-100 px-3 py-2 text-xs last:border-b-0"
                  >
                    <span className="font-semibold text-slate-800">{stop.name}</span>
                    <span className="text-slate-600">{addMinutesToTime(firstDeparture, stop.estimatedOffsetMinutes || 0)}</span>
                    <span className={stopEta?.etaMinutes ? 'font-black text-emerald-700' : 'text-slate-400'}>
                      {stopEta?.estimatedArrivalTime || 'Không khả dụng'}
                    </span>
                    <span className="text-slate-600">Mỗi {frequencyMinutes} phút</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-xs font-semibold text-slate-500">
              Giờ đến sớm nhất được tính từ chuyến đầu lúc {firstDeparture}.
              ETA trực tiếp sẽ tự cập nhật khi bật theo dõi vị trí.
            </div>
          </div>
        )}

        {detailTab === 'progress' && (
          <div className="space-y-3">
            {!isLiveTracking && (
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-black text-slate-950">Chưa có tiến độ chuyến đi</div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Bật theo dõi vị trí trực tiếp để xem trạm đã qua, trạm còn lại, vị trí xe hiện tại,
                  trạng thái chuyến và thời gian còn lại dự kiến.
                </p>
                <button
                  type="button"
                  onClick={() => onToggleLiveLocation?.(route)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800"
                >
                  <span className="material-symbols-outlined text-[18px]">route</span>
                  Xem tiến độ chuyến
                </button>
              </div>
            )}

            {isLiveTracking && (liveBusData?.buses || []).map((bus) => {
              const progress = bus.tripProgress;

              if (!progress) {
                return null;
              }

              return (
                <div key={progress.tripId} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-wide text-slate-400">{progress.tripId}</div>
                      <div className="mt-1 font-black text-slate-950">{bus.busId}</div>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${
                      progress.tripStatus === 'Delayed'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {translateStatus(progress.tripStatus)}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs font-black text-slate-500">
                      <span>Tiến độ đến điểm cuối</span>
                      <span>{progress.progressPercent}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-600"
                        style={{ width: `${progress.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="font-black uppercase text-slate-400">Trạm hiện tại</div>
                      <div className="mt-1 font-semibold text-slate-900">{progress.currentStop}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="font-black uppercase text-slate-400">Trạm tiếp theo</div>
                      <div className="mt-1 font-semibold text-slate-900">{progress.nextStop}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="font-black uppercase text-slate-400">Đã qua</div>
                      <div className="mt-1 font-semibold text-slate-900">{progress.completedStops.length} trạm</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="font-black uppercase text-slate-400">Thời gian còn lại</div>
                      <div className="mt-1 font-semibold text-slate-900">{progress.estimatedRemainingTime}</div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500">Trạm đã qua</div>
                    <div className="space-y-1">
                      {progress.completedStops.length ? progress.completedStops.map((stop) => (
                        <div key={stop.stopId} className="flex items-center gap-2 text-xs text-slate-600">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span>{stop.stopName}</span>
                        </div>
                      )) : (
                        <div className="text-xs text-slate-400">Chưa qua trạm nào.</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500">Trạm còn lại</div>
                    <div className="space-y-1">
                      {progress.remainingStops.length ? progress.remainingStops.map((stop) => (
                        <div key={stop.stopId} className="flex items-center gap-2 text-xs text-slate-600">
                          <span className="h-2 w-2 rounded-full bg-slate-300" />
                          <span>{stop.stopName}</span>
                        </div>
                      )) : (
                        <div className="text-xs text-emerald-700">Chuyến đi sắp hoàn thành.</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {detailTab === 'feedback' && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <RouteFeedbackForm route={route} />
          </div>
        )}
      </div>
    </aside>
  );
};

const FavoriteRoutesPanel = ({ favoriteRoutes, routes, onSelect, onRemove }) => (
  <section className="mt-5 border-t border-slate-200 pt-4">
    <div className="mb-3 flex items-center justify-between">
      <div>
        <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Tuyến yêu thích</div>
        <p className="mt-1 text-xs text-slate-500">Quản lý các tuyến bạn thường sử dụng.</p>
      </div>
      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
        Hành khách
      </span>
    </div>

    {favoriteRoutes.length === 0 ? (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
        Chưa có tuyến yêu thích nào.
      </div>
    ) : (
      <div className="space-y-3">
        {favoriteRoutes.map((favoriteRoute) => {
          const route = routes.find((item) => (
            isSameRouteId(item.id, favoriteRoute.routeId)
            || item.routeNumber === favoriteRoute.routeNumber
          ));
          const savedDate = favoriteRoute.savedAt
            ? new Date(favoriteRoute.savedAt).toLocaleDateString('en-GB')
            : 'Vừa lưu';

          return (
            <article
              key={`${favoriteRoute.routeId || favoriteRoute.routeNumber}-${favoriteRoute.destination}`}
              className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-black text-white">
                      {favoriteRoute.routeNumber}
                    </span>
                    <span className="truncate text-sm font-black text-slate-950">
                      {route?.name || favoriteRoute.destination}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Đã lưu: {savedDate}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(favoriteRoute)}
                  className="rounded p-1 text-amber-600 hover:bg-amber-50"
                  aria-label="Bỏ lưu tuyến yêu thích"
                >
                  <span className="material-symbols-outlined text-[18px]">star</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => onSelect(favoriteRoute)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded bg-slate-950 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700"
              >
                Xem chi tiết
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </article>
          );
        })}
      </div>
    )}
  </section>
);

const FavoriteStopsPanel = ({ favoriteStops, onRemove }) => (
  <section className="mt-5 border-t border-slate-200 pt-4">
    <div className="mb-3 flex items-center justify-between">
      <div>
        <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Trạm yêu thích</div>
        <p className="mt-1 text-xs text-slate-500">Truy cập nhanh các trạm xe buýt thường dùng.</p>
      </div>
      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
        Hành khách
      </span>
    </div>

    {favoriteStops.length === 0 ? (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
        Chưa có trạm yêu thích nào.
      </div>
    ) : (
      <div className="space-y-3">
        {favoriteStops.map((favoriteStop) => {
          const savedDate = favoriteStop.savedAt
            ? new Date(favoriteStop.savedAt).toLocaleDateString('en-GB')
            : 'Vừa lưu';

          return (
            <article
              key={favoriteStop.stopId || `${favoriteStop.routeNumber}-${favoriteStop.stopName}`}
              className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-emerald-50 text-emerald-700">
                      <span className="material-symbols-outlined text-[17px]">directions_bus</span>
                    </span>
                    <span className="truncate text-sm font-black text-slate-950">{favoriteStop.stopName}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {favoriteStop.routeNumber || 'Tuyến'} • Đã lưu: {savedDate}
                  </p>
                  {favoriteStop.nearbyArrivalText ? (
                    <p className="mt-1 text-xs font-semibold text-slate-500">{favoriteStop.nearbyArrivalText}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(favoriteStop)}
                  className="rounded p-1 text-amber-600 hover:bg-amber-50"
                  aria-label="Bỏ lưu trạm yêu thích"
                >
                  <span className="material-symbols-outlined text-[18px]">star</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    )}
  </section>
);

const RouteChangeNotificationCenter = ({ notifications, onMarkRead, onDismiss }) => {
  const unreadCount = notifications.filter((notification) => (
    notification.notificationStatus === 'UNREAD'
  )).length;

  return (
    <section className="mt-5 border-t border-slate-200 pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
            Trung tâm thông báo
          </div>
          <p className="mt-1 text-xs text-slate-500">Thông báo thay đổi từ các tuyến đã đăng ký.</p>
        </div>
        <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${
          unreadCount ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
        }`}>
          {unreadCount} chưa đọc
        </span>
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
          Chưa có thông báo thay đổi tuyến.
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.slice(0, 5).map((notification) => {
            const deliveredDate = notification.deliveredAt
              ? new Date(notification.deliveredAt).toLocaleString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })
              : 'Vừa xong';
            const isUnread = notification.notificationStatus === 'UNREAD';

            return (
              <article
                key={notification.notificationId}
                className={`rounded-lg border p-3 shadow-sm ${
                  isUnread ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-black text-white">
                        {notification.routeNumber}
                      </span>
                      <span className="truncate text-sm font-black text-slate-950">
                        Tuyến đã thay đổi
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-700">
                      {notification.reasonForChange || 'Thông tin tuyến đã thay đổi.'}
                    </p>
                    {notification.updatedRoutePath && (
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        {notification.updatedRoutePath}
                      </p>
                    )}
                    {notification.changedStops?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {notification.changedStops.map((stop) => (
                          <span
                            key={`${notification.notificationId}-${stop.stopName}-${stop.changeType}`}
                            className="rounded border border-amber-200 bg-white px-2 py-0.5 text-[10px] font-bold text-amber-700"
                          >
                            {stop.stopName}
                          </span>
                        ))}
                      </div>
                    )}
                    {notification.alternativeSuggestion && (
                      <p className="mt-2 text-xs font-semibold leading-5 text-emerald-700">
                        {notification.alternativeSuggestion}
                      </p>
                    )}
                    <p className="mt-2 text-[11px] font-semibold text-slate-400">{deliveredDate}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {isUnread && (
                      <button
                        type="button"
                        onClick={() => onMarkRead(notification.notificationId)}
                        className="rounded p-1 text-emerald-700 hover:bg-white"
                        aria-label="Đánh dấu thông báo đổi tuyến là đã đọc"
                      >
                        <span className="material-symbols-outlined text-[18px]">done</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDismiss(notification.notificationId)}
                      className="rounded p-1 text-slate-500 hover:bg-white hover:text-slate-800"
                      aria-label="Đóng thông báo đổi tuyến"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

const PlannerResultCard = ({ result, isRecommended = false, isSelected = false, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    className={`w-full rounded-lg border bg-white p-3 text-left shadow-sm transition hover:border-emerald-500 ${
      isSelected || isRecommended ? 'border-emerald-600 ring-1 ring-emerald-600' : 'border-slate-200'
    }`}
  >
    {isRecommended && (
      <span className="-mt-5 mb-2 inline-flex rounded bg-slate-950 px-2 py-0.5 text-[10px] font-black uppercase text-white">
        Đề xuất
      </span>
    )}
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-black text-white">
            {result.route.routeNumber}
          </span>
          <h3 className="truncate text-sm font-black text-slate-950">{result.route.name}</h3>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {formatDuration(result.estimatedDurationMinutes)} · {result.estimatedDistanceKm} km
        </p>
      </div>
      <div className="shrink-0 text-right">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black uppercase text-emerald-700">
          <span className="material-symbols-outlined text-[14px]">directions_bus</span>
          Xe buýt
        </span>
        <div className="mt-1 text-sm font-black text-slate-950">
          {formatFare(result.estimatedFare || result.route.fare)}
        </div>
      </div>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
      <div className="rounded bg-slate-50 px-2 py-1.5">
        <div className="font-bold uppercase text-slate-400">Lên xe</div>
        <div className="truncate font-semibold text-slate-700">{result.startStop.name}</div>
      </div>
      <div className="rounded bg-slate-50 px-2 py-1.5">
        <div className="font-bold uppercase text-slate-400">Xuống xe</div>
        <div className="truncate font-semibold text-slate-700">{result.endStop.name}</div>
      </div>
    </div>
    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
      <div className="rounded bg-slate-50 px-2 py-1.5">
        <div className="font-bold uppercase text-slate-400">Thời gian</div>
        <div className="font-semibold text-slate-700">{formatDuration(result.estimatedDurationMinutes)}</div>
      </div>
      <div className="rounded bg-slate-50 px-2 py-1.5">
        <div className="font-bold uppercase text-slate-400">Quãng đường</div>
        <div className="font-semibold text-slate-700">{result.estimatedDistanceKm} km</div>
      </div>
    </div>
  </button>
);

const NearbyStopCard = ({ stop, onSelect }) => {
  const routeMinutes = stop.route.estimatedDurationMinutes;
  const routeDistanceKm = stop.route.distanceKm;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-emerald-500 hover:shadow-md"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-700">
        <span className="material-symbols-outlined text-[21px]">directions_bus</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-black text-slate-950">{stop.name}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {stop.route.routeNumber} - {stop.route.name}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm font-black text-slate-950">{formatDuration(routeMinutes)}</div>
            <div className="text-[11px] font-semibold text-slate-500">{routeDistanceKm} km</div>
          </div>
        </div>
        <div className="mt-2 text-[11px] font-semibold text-slate-400">
          Trạm gần nhất: {stop.distanceKm} km
        </div>
      </div>
    </button>
  );
};

const SearchRoutesPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('lookup');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [from, setFrom] = useState(searchParams.get('from') || '');
  const [to, setTo] = useState(searchParams.get('to') || '');
  const [bestFrom, setBestFrom] = useState(searchParams.get('from') || '');
  const [bestTo, setBestTo] = useState(searchParams.get('to') || '');
  const [routes, setRoutes] = useState([]);
  const [nearbyStops, setNearbyStops] = useState([]);
  const [bestRouteResult, setBestRouteResult] = useState(null);
  const [routePreference, setRoutePreference] = useState('fastest');
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isFindingBest, setIsFindingBest] = useState(false);
  const [error, setError] = useState('');
  const [favoriteRoutes, setFavoriteRoutes] = useState([]);
  const [favoriteStops, setFavoriteStops] = useState([]);
  const [favoriteMessage, setFavoriteMessage] = useState('');
  const [arrivalNotifications, setArrivalNotifications] = useState([]);
  const [delayNotifications, setDelayNotifications] = useState([]);
  const [routeChangeNotifications, setRouteChangeNotifications] = useState([]);
  const [routeChangeAlerts, setRouteChangeAlerts] = useState([]);
  const [arrivalAlerts, setArrivalAlerts] = useState([]);
  const [delayAlerts, setDelayAlerts] = useState([]);
  const [notifiedArrivalKeys, setNotifiedArrivalKeys] = useState(new Set());
  const [notifiedDelayKeys, setNotifiedDelayKeys] = useState(new Set());
  const [notifiedRouteChangeKeys, setNotifiedRouteChangeKeys] = useState(new Set());
  const [liveRouteId, setLiveRouteId] = useState(null);
  const [liveBusData, setLiveBusData] = useState(null);
  const [isLiveLoading, setIsLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState('');

  const activeFilters = useMemo(() => ({
    q: searchParams.get('q') || '',
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
  }), [searchParams]);

  const favoriteRouteIds = useMemo(() => new Set(
    favoriteRoutes.map((favoriteRoute) => String(favoriteRoute.routeId || favoriteRoute.routeNumber))
  ), [favoriteRoutes]);

  const favoriteStopIds = useMemo(() => new Set(
    favoriteStops.map((favoriteStop) => String(favoriteStop.stopId))
  ), [favoriteStops]);

  const arrivalNotificationIds = useMemo(() => new Set(
    arrivalNotifications
      .filter((subscription) => subscription.notificationStatus !== 'DISABLED')
      .map((subscription) => String(subscription.subscriptionId))
  ), [arrivalNotifications]);

  const delayNotificationIds = useMemo(() => new Set(
    delayNotifications
      .filter((subscription) => subscription.notificationStatus !== 'DISABLED')
      .map((subscription) => String(subscription.subscriptionId))
  ), [delayNotifications]);

  const routeChangeNotificationIds = useMemo(() => new Set(
    routeChangeNotifications
      .filter((subscription) => subscription.notificationStatus !== 'DISABLED')
      .map((subscription) => String(subscription.subscriptionId))
  ), [routeChangeNotifications]);

  const suggestedRouteOptions = useMemo(() => {
    if (!bestRouteResult) {
      return [];
    }

    if (Array.isArray(bestRouteResult.suggestions)) {
      return bestRouteResult.suggestions;
    }

    return [
      ...(bestRouteResult.bestRoute ? [{ ...bestRouteResult.bestRoute, isRecommended: true }] : []),
      ...(bestRouteResult.alternatives || []).map((alternative) => ({
        ...alternative,
        isRecommended: false,
      })),
    ];
  }, [bestRouteResult]);

  const isRouteFavorite = (route) => (
    favoriteRouteIds.has(String(route.id)) || favoriteRouteIds.has(String(route.routeNumber))
  );

  const isStopFavorite = (route, stop) => favoriteStopIds.has(buildStopId(route, stop));
  const isArrivalNotificationEnabled = (route, stop) => (
    arrivalNotificationIds.has(buildArrivalNotificationId(route, stop))
  );
  const isDelayNotificationEnabled = (route) => (
    delayNotificationIds.has(buildDelayNotificationId(route))
  );
  const isRouteChangeNotificationEnabled = (route) => (
    routeChangeNotificationIds.has(buildRouteChangeNotificationId(route))
    || routeChangeNotifications.some((subscription) => (
      subscription.notificationStatus !== 'DISABLED'
      && (
        subscription.routeNumber === route.routeNumber
        || isSameRouteId(subscription.routeId, route.id)
      )
    ))
  );
  const routePanelMessage = /notification|alert/i.test(favoriteMessage) ? favoriteMessage : '';
  const isLiveTrackingSelectedRoute = Boolean(
    selectedRoute?.id && isSameRouteId(liveRouteId, selectedRoute.id)
  );
  const canReceiveNotificationType = (type) => (
    user?.notificationEnabled !== false && user?.notificationTypes?.[type] !== false
  );

  const mapStops = useMemo(() => {
    const seen = new Set();
    const stops = [];

    for (const route of routes) {
      for (const stop of route.stops || []) {
        const normalizedStop = normalizeStopLocation(stop);
        const key = `${normalizedStop.name}-${normalizedStop.latitude.toFixed(5)}-${normalizedStop.longitude.toFixed(5)}`;

        if (!seen.has(key)) {
          seen.add(key);
          stops.push({ ...normalizedStop, routeNumbers: [route.routeNumber] });
        } else {
          const existingStop = stops.find((item) => (
            `${item.name}-${item.latitude.toFixed(5)}-${item.longitude.toFixed(5)}` === key
          ));

          if (existingStop && !existingStop.routeNumbers.includes(route.routeNumber)) {
            existingStop.routeNumbers.push(route.routeNumber);
          }
        }
      }
    }

    return stops;
  }, [routes]);

  useEffect(() => {
    let isMounted = true;

    const fetchRoutes = async () => {
      setIsLoading(true);
      setError('');

      try {
        const result = await routeService.searchRoutes(activeFilters);

        if (isMounted) {
          const nextRoutes = result.routes || [];
          setRoutes(nextRoutes);
          setSelectedRoute(null);
          setNearbyStops([]);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Không thể tìm tuyến xe.');
          setRoutes([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchRoutes();

    return () => {
      isMounted = false;
    };
  }, [activeFilters]);

  useEffect(() => {
    let isMounted = true;

    const fetchFavoriteRoutes = async () => {
      if (!user) {
        setFavoriteRoutes([]);
        setFavoriteStops([]);
        setArrivalNotifications([]);
        setDelayNotifications([]);
        setRouteChangeNotifications([]);
        setRouteChangeAlerts([]);
        return;
      }

      try {
        const [
          favoriteRouteResult,
          favoriteStopResult,
          arrivalNotificationResult,
          delayNotificationResult,
          routeChangeNotificationResult,
          routeChangeAlertResult,
        ] = await Promise.all([
          routeService.getFavoriteRoutes(),
          routeService.getFavoriteStops(),
          routeService.getArrivalNotifications(),
          routeService.getDelayNotifications(),
          routeService.getRouteChangeNotifications(),
          routeService.getRouteChangeAlerts(),
        ]);

        if (isMounted) {
          setFavoriteRoutes(favoriteRouteResult || []);
          setFavoriteStops(favoriteStopResult || []);
          setArrivalNotifications(arrivalNotificationResult || []);
          setDelayNotifications(delayNotificationResult || []);
          setRouteChangeNotifications(routeChangeNotificationResult || []);
          setRouteChangeAlerts(routeChangeAlertResult?.notifications || []);
        }
      } catch (err) {
        if (isMounted && err.statusCode !== 403) {
          setError(err.message || 'Không thể tải danh sách yêu thích.');
        }
      }
    };

    fetchFavoriteRoutes();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!liveRouteId) {
      setLiveBusData(null);
      setLiveError('');
      return undefined;
    }

    let isMounted = true;

    const fetchLiveBusLocations = async () => {
      setIsLiveLoading(true);

      try {
        const result = await routeService.getLiveBusLocations(liveRouteId);

        if (isMounted) {
          setLiveBusData(result);
          setLiveError(result.buses?.length ? '' : (result.message || 'Chưa có dữ liệu vị trí trực tiếp.'));
        }
      } catch (err) {
        if (isMounted) {
          setLiveBusData(null);
          setLiveError(err.message || 'Chưa có dữ liệu vị trí trực tiếp.');
        }
      } finally {
        if (isMounted) {
          setIsLiveLoading(false);
        }
      }
    };

    fetchLiveBusLocations();
    const intervalId = window.setInterval(fetchLiveBusLocations, 5000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [liveRouteId]);

  useEffect(() => {
    if (
      !canReceiveNotificationType('arrivalAlerts')
      || !liveBusData?.stopEtaSummary?.length
      || !arrivalNotifications.length
    ) {
      return;
    }

    const activeSubscriptions = arrivalNotifications.filter((subscription) => (
      subscription.notificationStatus !== 'DISABLED'
      && (
        isSameRouteId(subscription.routeId, liveBusData.route?.id)
        || subscription.routeNumber === liveBusData.route?.routeNumber
      )
    ));

    const nextAlerts = [];
    const nextNotifiedKeys = new Set(notifiedArrivalKeys);

    activeSubscriptions.forEach((subscription) => {
      const eta = liveBusData.stopEtaSummary.find((item) => item.stopId === subscription.stopId);
      const threshold = Number(subscription.etaThresholdMinutes) || 5;

      if (!eta || typeof eta.etaMinutes !== 'number' || eta.etaMinutes > threshold) {
        return;
      }

      const notificationType = eta.etaMinutes <= 1 ? 'arriving' : 'approaching';
      const notificationKey = `${subscription.subscriptionId}-${notificationType}`;

      if (nextNotifiedKeys.has(notificationKey)) {
        return;
      }

      nextNotifiedKeys.add(notificationKey);
      nextAlerts.push({
        id: `${notificationKey}-${Date.now()}`,
        title: notificationType === 'arriving' ? 'Xe đang đến trạm' : 'Xe sắp đến',
        message: `${subscription.routeNumber} đến ${subscription.stopName}: ${eta.estimatedArrivalTime}. ${eta.nextBusId || 'Xe đang theo dõi'} đang ${translateStatus(eta.status).toLowerCase()}.`,
        status: eta.status,
      });
    });

    if (!nextAlerts.length) {
      return;
    }

    setNotifiedArrivalKeys(nextNotifiedKeys);
    setArrivalAlerts((current) => [...nextAlerts, ...current].slice(0, 4));

    if ('Notification' in window && Notification.permission === 'granted') {
      nextAlerts.forEach((alert) => {
        new Notification(alert.title, {
          body: alert.message,
        });
      });
    }
  }, [arrivalNotifications, liveBusData, notifiedArrivalKeys, user]);

  useEffect(() => {
    if (
      !canReceiveNotificationType('delayAlerts')
      || !liveBusData?.buses?.length
      || !delayNotifications.length
    ) {
      return;
    }

    const activeSubscriptions = delayNotifications.filter((subscription) => (
      subscription.notificationStatus !== 'DISABLED'
      && (
        isSameRouteId(subscription.routeId, liveBusData.route?.id)
        || subscription.routeNumber === liveBusData.route?.routeNumber
      )
    ));

    const delayedBuses = liveBusData.buses.filter((bus) => bus.status === 'Delayed' && bus.delay);
    const nextAlerts = [];
    const nextNotifiedKeys = new Set(notifiedDelayKeys);

    activeSubscriptions.forEach((subscription) => {
      delayedBuses.forEach((bus) => {
        const delayMinutes = bus.delay?.delayDurationMinutes || 0;
        const threshold = Number(subscription.delayThresholdMinutes) || 5;

        if (delayMinutes < threshold) {
          return;
        }

        const notificationKey = `${subscription.subscriptionId}-${bus.busId}-${delayMinutes}`;

        if (nextNotifiedKeys.has(notificationKey)) {
          return;
        }

        nextNotifiedKeys.add(notificationKey);
        nextAlerts.push({
          id: `${notificationKey}-${Date.now()}`,
          title: 'Xe bị trễ chuyến',
          message: `${subscription.routeNumber} ${bus.busId} trễ ${delayMinutes} phút. Lý do: ${bus.delay.delayReason}. ETA cập nhật: ${bus.delay.updatedEta}.`,
          status: 'Trễ chuyến',
        });
      });
    });

    if (!nextAlerts.length) {
      return;
    }

    setNotifiedDelayKeys(nextNotifiedKeys);
    setDelayAlerts((current) => [...nextAlerts, ...current].slice(0, 4));

    if ('Notification' in window && Notification.permission === 'granted') {
      nextAlerts.forEach((alert) => {
        new Notification(alert.title, {
          body: alert.message,
        });
      });
    }
  }, [delayNotifications, liveBusData, notifiedDelayKeys, user]);

  useEffect(() => {
    if (
      !canReceiveNotificationType('routeChangeAlerts')
      || !liveBusData?.routeChange
      || !routeChangeNotifications.length
    ) {
      return;
    }

    const routeChange = liveBusData.routeChange;
    const activeSubscriptions = routeChangeNotifications.filter((subscription) => (
      subscription.notificationStatus !== 'DISABLED'
      && (
        isSameRouteId(subscription.routeId, liveBusData.route?.id)
        || subscription.routeNumber === liveBusData.route?.routeNumber
      )
    ));

    if (!activeSubscriptions.length) {
      return;
    }

    const nextNotifiedKeys = new Set(notifiedRouteChangeKeys);
    const nextAlerts = [];

    activeSubscriptions.forEach((subscription) => {
      const notificationKey = `${subscription.subscriptionId}-${routeChange.changeId}`;

      if (nextNotifiedKeys.has(notificationKey)) {
        return;
      }

      nextNotifiedKeys.add(notificationKey);
      nextAlerts.push({
        id: `${notificationKey}-${Date.now()}`,
        title: 'Phát hiện thay đổi tuyến',
        message: `${routeChange.routeNumber}: ${routeChange.reasonForChange}. ${routeChange.updatedRoutePath}`,
        status: 'Tuyến đã thay đổi',
      });
    });

    if (!nextAlerts.length) {
      return;
    }

    setNotifiedRouteChangeKeys(nextNotifiedKeys);
    setDelayAlerts((current) => [...nextAlerts, ...current].slice(0, 4));
    routeService.getRouteChangeAlerts()
      .then((result) => setRouteChangeAlerts(result?.notifications || []))
      .catch(() => {});

    if ('Notification' in window && Notification.permission === 'granted') {
      nextAlerts.forEach((alert) => {
        new Notification(alert.title, {
          body: alert.message,
        });
      });
    }
  }, [liveBusData, notifiedRouteChangeKeys, routeChangeNotifications, user]);

  const refreshRouteChangeAlerts = async () => {
    if (!user) {
      setRouteChangeAlerts([]);
      return [];
    }

    const result = await routeService.getRouteChangeAlerts();
    const notifications = result?.notifications || [];
    setRouteChangeAlerts(notifications);
    return notifications;
  };

  const handleMarkRouteChangeAlertRead = async (notificationId) => {
    try {
      const notification = await routeService.markRouteChangeAlertRead(notificationId);
      setRouteChangeAlerts((current) => current.map((item) => (
        item.notificationId === notification.notificationId ? notification : item
      )));
    } catch (err) {
      setError(err.message || 'Không thể cập nhật thông báo đổi tuyến.');
    }
  };

  const handleDismissRouteChangeAlert = async (notificationId) => {
    try {
      await routeService.dismissRouteChangeAlert(notificationId);
      setRouteChangeAlerts((current) => (
        current.filter((item) => item.notificationId !== notificationId)
      ));
    } catch (err) {
      setError(err.message || 'Không thể đóng thông báo đổi tuyến.');
    }
  };

  const clearError = () => {
    if (error) {
      setError('');
    }
    if (favoriteMessage) {
      setFavoriteMessage('');
    }
  };

  const handleSearch = (event) => {
    event.preventDefault();

    if (!query.trim() && !from.trim() && !to.trim()) {
      setError('Vui lòng nhập mã tuyến, trạm, điểm đi hoặc điểm đến.');
      setRoutes([]);
      return;
    }

    const nextParams = {};

    if (query.trim()) {
      nextParams.q = query.trim();
    }

    if (from.trim()) {
      nextParams.from = from.trim();
    }

    if (to.trim()) {
      nextParams.to = to.trim();
    }

    setSearchParams(nextParams);
  };

  const handleBackToAllRoutes = () => {
    clearError();
    setSearchParams({});
    setQuery('');
    setFrom('');
    setTo('');
    setBestFrom('');
    setBestTo('');
    setBestRouteResult(null);
    setNearbyStops([]);
    setSelectedRoute(null);
    setLiveRouteId(null);
    setLiveBusData(null);
    setLiveError('');
    setActiveTab('lookup');
  };

  const handleUseCurrentLocation = () => {
    setError('');

    if (!navigator.geolocation) {
      setError('Trình duyệt này không hỗ trợ lấy vị trí hiện tại.');
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const nextLocation = { latitude, longitude };
          const result = await routeService.searchNearbyRoutes({
            latitude,
            longitude,
            radiusKm: 8,
          });

          setCurrentLocation(nextLocation);
          setRoutes(result.routes || []);
          setSelectedRoute(null);
          setNearbyStops(result.nearbyStops || []);
          setActiveTab('lookup');
        } catch (err) {
          setError(err.message || 'Không thể tìm tuyến gần đây.');
          setRoutes([]);
          setNearbyStops([]);
          setCurrentLocation(null);
        } finally {
          setIsLocating(false);
        }
      },
      (geoError) => {
        const messages = {
          1: 'Bạn đã từ chối quyền truy cập vị trí.',
          2: 'Không thể xác định vị trí hiện tại.',
          3: 'Yêu cầu lấy vị trí đã hết thời gian.',
        };

        setError(messages[geoError.code] || 'Không thể đọc vị trí hiện tại.');
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  const handleSelectNearbyStop = (stop) => {
    const matchingRoute = routes.find((route) => (
      route.routeNumber === stop.route.routeNumber || route.id === stop.route.id
    ));

    if (matchingRoute) {
      setSelectedRoute(matchingRoute);
    }
  };

  const handleToggleFavoriteRoute = async (route) => {
    setError('');
    setFavoriteMessage('');

    if (!user) {
      setError('Vui lòng đăng nhập trước khi lưu tuyến yêu thích.');
      return;
    }

    try {
      if (isRouteFavorite(route)) {
        await routeService.removeFavoriteRoute(route.id);
        setFavoriteRoutes((current) => current.filter((favoriteRoute) => (
          !isSameRouteId(favoriteRoute.routeId, route.id)
          && favoriteRoute.routeNumber !== route.routeNumber
        )));
        setFavoriteMessage('Đã bỏ lưu tuyến yêu thích.');
        return;
      }

      const favoriteRoute = await routeService.saveFavoriteRoute(route.id);
      setFavoriteRoutes((current) => [
        favoriteRoute,
        ...current.filter((item) => (
          !isSameRouteId(item.routeId, favoriteRoute.routeId)
          && item.routeNumber !== favoriteRoute.routeNumber
        )),
      ]);
      setFavoriteMessage('Đã lưu tuyến yêu thích.');
    } catch (err) {
      if (err.message === 'Route already exists in favorites') {
        setFavoriteMessage('Tuyến này đã có trong danh sách yêu thích.');
        return;
      }

      setError(err.message || 'Không thể cập nhật tuyến yêu thích.');
    }
  };

  const handleSelectFavoriteRoute = async (favoriteRoute) => {
    const matchingRoute = routes.find((route) => (
      isSameRouteId(route.id, favoriteRoute.routeId)
      || route.routeNumber === favoriteRoute.routeNumber
    ));

    if (matchingRoute) {
      setSelectedRoute(matchingRoute);
      return;
    }

    try {
      const result = await routeService.searchRoutes({ q: favoriteRoute.routeNumber });
      const nextRoutes = result.routes || [];
      setRoutes(nextRoutes);
      setSelectedRoute(nextRoutes.find((route) => route.routeNumber === favoriteRoute.routeNumber) || nextRoutes[0] || null);
      setActiveTab('lookup');
    } catch (err) {
      setError(err.message || 'Không thể mở tuyến yêu thích.');
    }
  };

  const handleRemoveFavoriteRoute = async (favoriteRoute) => {
    const routeId = favoriteRoute.routeId
      || routes.find((route) => route.routeNumber === favoriteRoute.routeNumber)?.id;

    if (!routeId) {
      setError('Không tìm thấy tuyến.');
      return;
    }

    try {
      await routeService.removeFavoriteRoute(routeId);
      setFavoriteRoutes((current) => current.filter((item) => (
        !isSameRouteId(item.routeId, routeId)
        && item.routeNumber !== favoriteRoute.routeNumber
      )));
      setFavoriteMessage('Đã bỏ lưu tuyến yêu thích.');
    } catch (err) {
      setError(err.message || 'Không thể bỏ lưu tuyến yêu thích.');
    }
  };

  const handleToggleFavoriteStop = async (route, stop) => {
    setError('');
    setFavoriteMessage('');

    if (!user) {
      setError('Vui lòng đăng nhập trước khi lưu trạm yêu thích.');
      return;
    }

    const stopId = buildStopId(route, stop);

    try {
      if (favoriteStopIds.has(stopId)) {
        await routeService.removeFavoriteStop(stopId);
        setFavoriteStops((current) => current.filter((favoriteStop) => favoriteStop.stopId !== stopId));
        setFavoriteMessage('Đã bỏ lưu trạm yêu thích.');
        return;
      }

      const favoriteStop = await routeService.saveFavoriteStop({
        routeId: route.id,
        routeNumber: route.routeNumber,
        stopId,
        stopName: stop.name,
        order: stop.originalOrder || stop.order,
        address: `${route.name} stop`,
        nearbyArrivalText: `Every ${route.operatingHours?.frequencyMinutes || 30} min`,
        latitude: stop.latitude,
        longitude: stop.longitude,
      });

      setFavoriteStops((current) => [
        favoriteStop,
        ...current.filter((item) => item.stopId !== favoriteStop.stopId),
      ]);
      setFavoriteMessage('Đã lưu trạm yêu thích.');
    } catch (err) {
      if (err.message === 'Stop already exists in favorites') {
        setFavoriteMessage('Trạm này đã có trong danh sách yêu thích.');
        return;
      }

      setError(err.message || 'Không thể cập nhật trạm yêu thích.');
    }
  };

  const handleRemoveFavoriteStop = async (favoriteStop) => {
    if (!favoriteStop.stopId) {
      setError('Không tìm thấy trạm.');
      return;
    }

    try {
      await routeService.removeFavoriteStop(favoriteStop.stopId);
      setFavoriteStops((current) => current.filter((item) => item.stopId !== favoriteStop.stopId));
      setFavoriteMessage('Đã bỏ lưu trạm yêu thích.');
    } catch (err) {
      setError(err.message || 'Không thể bỏ lưu trạm yêu thích.');
    }
  };

  const handleToggleArrivalNotification = async (route, stop) => {
    setError('');
    setFavoriteMessage('');

    if (!user) {
      setError('Vui lòng đăng nhập trước khi bật thông báo xe đến.');
      return;
    }

    const subscriptionId = buildArrivalNotificationId(route, stop);

    try {
      if (arrivalNotificationIds.has(subscriptionId)) {
        await routeService.removeArrivalNotification(subscriptionId);
        setArrivalNotifications((current) => (
          current.filter((subscription) => subscription.subscriptionId !== subscriptionId)
        ));
        setFavoriteMessage('Đã tắt thông báo xe đến.');
        return;
      }

      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      const subscription = await routeService.subscribeArrivalNotification({
        routeId: route.id,
        stopId: buildStopId(route, stop),
        stopName: stop.name,
        order: stop.originalOrder || stop.order,
        etaThresholdMinutes: 5,
      });

      setArrivalNotifications((current) => [
        subscription,
        ...current.filter((item) => item.subscriptionId !== subscription.subscriptionId),
      ]);
      setFavoriteMessage(
        'Đã bật thông báo xe đến. Bạn sẽ được báo khi xe còn cách trạm trong khoảng 5 phút.'
      );

      if ('Notification' in window && Notification.permission === 'denied') {
        setError('Quyền thông báo của trình duyệt đang tắt. Thông báo trong ứng dụng vẫn sẽ hiển thị.');
      }
    } catch (err) {
      if (err.message === 'Arrival notification already enabled') {
        setFavoriteMessage('Thông báo xe đến đã được bật.');
        return;
      }

      setError(err.message || 'Không thể cập nhật thông báo xe đến.');
    }
  };

  const handleToggleDelayNotification = async (route) => {
    setError('');
    setFavoriteMessage('');

    if (!user) {
      setError('Vui lòng đăng nhập trước khi bật thông báo trễ chuyến.');
      return;
    }

    const subscriptionId = buildDelayNotificationId(route);

    try {
      if (delayNotificationIds.has(subscriptionId)) {
        await routeService.removeDelayNotification(subscriptionId);
        setDelayNotifications((current) => (
          current.filter((subscription) => subscription.subscriptionId !== subscriptionId)
        ));
        setFavoriteMessage('Đã tắt thông báo trễ chuyến.');
        return;
      }

      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      const subscription = await routeService.subscribeDelayNotification({
        routeId: route.id,
        routeNumber: route.routeNumber,
        delayThresholdMinutes: 5,
      });

      setDelayNotifications((current) => [
        subscription,
        ...current.filter((item) => item.subscriptionId !== subscription.subscriptionId),
      ]);
      setFavoriteMessage('Đã bật thông báo trễ chuyến cho tuyến này.');

      if ('Notification' in window && Notification.permission === 'denied') {
        setError('Quyền thông báo của trình duyệt đang tắt. Thông báo trễ chuyến trong ứng dụng vẫn sẽ hiển thị.');
      }
    } catch (err) {
      if (err.message === 'Delay notification already enabled') {
        setFavoriteMessage('Thông báo trễ chuyến đã được bật.');
        return;
      }

      setError(err.message || 'Không thể cập nhật thông báo trễ chuyến.');
    }
  };

  const handleToggleRouteChangeNotification = async (route) => {
    setError('');
    setFavoriteMessage('');

    if (!user) {
      setError('Vui lòng đăng nhập trước khi bật thông báo đổi tuyến.');
      return;
    }

    const subscriptionId = buildRouteChangeNotificationId(route);
    const existingSubscription = routeChangeNotifications.find((subscription) => (
      subscription.notificationStatus !== 'DISABLED'
      && (
        subscription.subscriptionId === subscriptionId
        || subscription.routeNumber === route.routeNumber
        || isSameRouteId(subscription.routeId, route.id)
      )
    ));

    try {
      if (existingSubscription) {
        await routeService.removeRouteChangeNotification(existingSubscription.subscriptionId);
        setRouteChangeNotifications((current) => (
          current.filter((subscription) => subscription.subscriptionId !== existingSubscription.subscriptionId)
        ));
        setRouteChangeAlerts((current) => (
          current.filter((notification) => notification.subscriptionId !== existingSubscription.subscriptionId)
        ));
        setFavoriteMessage('Đã tắt thông báo đổi tuyến.');
        return;
      }

      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      const subscription = await routeService.subscribeRouteChangeNotification({
        routeId: route.id,
        routeNumber: route.routeNumber,
      });

      setRouteChangeNotifications((current) => [
        subscription,
        ...current.filter((item) => item.subscriptionId !== subscription.subscriptionId),
      ]);
      setFavoriteMessage('Đã bật thông báo đổi tuyến cho tuyến này.');
      await refreshRouteChangeAlerts();

      if ('Notification' in window && Notification.permission === 'denied') {
        setError('Quyền thông báo của trình duyệt đang tắt. Thông báo đổi tuyến trong ứng dụng vẫn sẽ hiển thị.');
      }
    } catch (err) {
      if (err.message === 'Route change notification already enabled') {
        const subscriptions = await routeService.getRouteChangeNotifications();
        setRouteChangeNotifications(subscriptions || []);
        await refreshRouteChangeAlerts();
        setFavoriteMessage('Thông báo đổi tuyến đã được bật.');
        return;
      }

      setError(err.message || 'Không thể cập nhật thông báo đổi tuyến.');
    }
  };

  const handleToggleLiveLocation = (route) => {
    clearError();

    if (!route?.id) {
      setLiveError('Không tìm thấy xe buýt.');
      return;
    }

    if (isSameRouteId(liveRouteId, route.id)) {
      setLiveRouteId(null);
      setLiveBusData(null);
      setLiveError('');
      return;
    }

    setSelectedRoute(route);
    setLiveRouteId(route.id);
    setLiveBusData(null);
    setLiveError('');
  };

  const handleDismissArrivalAlert = (alertId) => {
    setArrivalAlerts((current) => current.filter((alert) => alert.id !== alertId));
    setDelayAlerts((current) => current.filter((alert) => alert.id !== alertId));
  };

  const handleOpenPurchaseTicket = (route) => {
    const params = route?.routeNumber ? `?route=${encodeURIComponent(route.routeNumber)}` : '';
    navigate(`/buy-tickets${params}`, { state: { route } });
  };

  const handleFindBestRoute = async (event) => {
    event.preventDefault();
    setError('');
    setBestRouteResult(null);

    if (!bestFrom.trim() || !bestTo.trim()) {
      setError('Vui lòng nhập đầy đủ điểm đi và điểm đến.');
      return;
    }

    setIsFindingBest(true);

    try {
      const result = await routeService.suggestRouteOptions({
        from: bestFrom.trim(),
        to: bestTo.trim(),
        preference: routePreference,
      });

      setBestRouteResult(result);

      const nextSuggestions = Array.isArray(result.suggestions)
        ? result.suggestions
        : [
          ...(result.bestRoute ? [{ ...result.bestRoute, isRecommended: true }] : []),
          ...(result.alternatives || []),
        ];

      if (nextSuggestions.length) {
        const nextRoutes = nextSuggestions.map((item) => item.route);
        setRoutes(nextRoutes);
        setSelectedRoute(nextSuggestions[0].route);
      } else {
        setSelectedRoute(null);
      }
    } catch (err) {
      setError(err.message || 'Không thể gợi ý tuyến phù hợp.');
    } finally {
      setIsFindingBest(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-100 text-slate-950">
      <Header />

      <main className="mt-[80px] flex h-[calc(100vh-80px)]">
        <aside className="z-10 flex w-[420px] shrink-0 flex-col overflow-y-auto border-r border-emerald-100 bg-emerald-50/40 shadow-xl">
          <div className="m-4 mb-0 grid grid-cols-2 gap-2 rounded-2xl border border-emerald-100 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTab('lookup')}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
                activeTab === 'lookup'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
              }`}
            >
              <span className="material-symbols-outlined">search</span>
              Tra cứu
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('directions')}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
                activeTab === 'directions'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
              }`}
            >
              <span className="material-symbols-outlined">conversion_path</span>
              Chỉ đường
            </button>
          </div>

          <div className="p-4">
            {activeTab === 'lookup' ? (
              <>
                <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                  <div className="text-sm font-black uppercase tracking-wide text-slate-950">Tìm tuyến xe</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Tra cứu tuyến xe và tìm các trạm gần vị trí hiện tại của bạn.
                  </p>

                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={isLocating}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black uppercase text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isLocating ? 'progress_activity' : 'my_location'}
                    </span>
                    {isLocating ? 'Đang xác định vị trí...' : 'Dùng vị trí hiện tại'}
                  </button>
                </div>

                <div className="mt-4 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Trạm gần đây</div>
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
                      Trực tiếp
                    </span>
                  </div>

                  {currentLocation && (
                    <div className="mb-3 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-slate-600">
                      <div className="font-bold text-slate-950">Đã xác định vị trí hiện tại</div>
                      <div>
                        {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
                      </div>
                    </div>
                  )}

                  {isLocating && (
                    <div className="rounded-lg bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-600">
                      Đang xác định vị trí GPS của bạn...
                    </div>
                  )}

                  {!isLocating && currentLocation && nearbyStops.length === 0 && (
                    <div className="rounded-lg border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600">
                      Không tìm thấy kết quả gần đây. Vui lòng thử lại hoặc kiểm tra quyền truy cập vị trí.
                    </div>
                  )}

                  {nearbyStops.length > 0 && (
                    <div className="space-y-3">
                      {nearbyStops.map((stop) => (
                        <NearbyStopCard
                          key={`${stop.route.routeNumber}-${stop.order}-${stop.name}`}
                          stop={stop}
                          onSelect={() => handleSelectNearbyStop(stop)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <form onSubmit={handleSearch} className="mt-4 space-y-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                  <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Tìm kiếm thủ công</div>
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      clearError();
                    }}
                    placeholder="Tìm tuyến hoặc trạm..."
                    className="w-full rounded-lg border-0 bg-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={from}
                      onChange={(event) => {
                        setFrom(event.target.value);
                        clearError();
                      }}
                      placeholder="Điểm đi"
                      className="w-full rounded-lg border-0 bg-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500"
                    />
                    <input
                      type="text"
                      value={to}
                      onChange={(event) => {
                        setTo(event.target.value);
                        clearError();
                      }}
                      placeholder="Điểm đến"
                      className="w-full rounded-lg border-0 bg-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700"
                  >
                    <span className="material-symbols-outlined">search</span>
                    Tìm tuyến
                  </button>
                </form>

                <FavoriteRoutesPanel
                  favoriteRoutes={favoriteRoutes}
                  routes={routes}
                  onSelect={handleSelectFavoriteRoute}
                  onRemove={handleRemoveFavoriteRoute}
                />
                <FavoriteStopsPanel
                  favoriteStops={favoriteStops}
                  onRemove={handleRemoveFavoriteStop}
                />
                <RouteChangeNotificationCenter
                  notifications={routeChangeAlerts}
                  onMarkRead={handleMarkRouteChangeAlertRead}
                  onDismiss={handleDismissRouteChangeAlert}
                />
              </>
            ) : (
              <form onSubmit={handleFindBestRoute} className="space-y-3">
                <input
                  type="text"
                  value={bestFrom}
                  onChange={(event) => {
                    setBestFrom(event.target.value);
                    clearError();
                  }}
                  placeholder="Nhập điểm đi"
                  className="w-full rounded-lg border-0 bg-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="text"
                  value={bestTo}
                  onChange={(event) => {
                    setBestTo(event.target.value);
                    clearError();
                  }}
                  placeholder="Nhập điểm đến"
                  className="w-full rounded-lg border-0 bg-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500"
                />
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Ưu tiên tuyến</div>
                  <div className="grid grid-cols-2 gap-2">
                    {ROUTE_PREFERENCES.map((preference) => {
                      const isActive = routePreference === preference.id;

                      return (
                        <button
                          key={preference.id}
                          type="button"
                          onClick={() => {
                            setRoutePreference(preference.id);
                            clearError();
                          }}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-bold transition ${
                            isActive
                              ? 'border-slate-950 bg-slate-950 text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[17px]">{preference.icon}</span>
                          <span>{preference.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isFindingBest}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined">
                    {isFindingBest ? 'progress_activity' : 'route'}
                  </span>
                  {isFindingBest ? 'Đang tính toán...' : 'Tìm tuyến phù hợp'}
                </button>

                {bestRouteResult && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-emerald-900">Gợi ý tuyến phù hợp</div>
                        <p className="mt-1 text-xs text-emerald-800">
                          So sánh các tuyến theo thời gian, quãng đường, giá vé và ưu tiên đã chọn.
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-black text-emerald-700">
                        {suggestedRouteOptions.length} kết quả
                      </span>
                    </div>

                    {suggestedRouteOptions.length ? (
                      <div className="mt-3 space-y-3">
                        {suggestedRouteOptions.map((suggestion, index) => (
                          <PlannerResultCard
                            key={`${suggestion.route.id}-${suggestion.startStop.name}-${suggestion.endStop.name}`}
                            result={suggestion}
                            isRecommended={suggestion.isRecommended || index === 0}
                            isSelected={selectedRoute?.routeNumber === suggestion.route.routeNumber}
                            onSelect={() => setSelectedRoute(suggestion.route)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-700">
                        Không tìm thấy tuyến phù hợp. Hãy thử điểm đi, điểm đến hoặc ưu tiên khác.
                      </div>
                    )}
                  </div>
                )}
              </form>
            )}

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {favoriteMessage && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {favoriteMessage}
              </div>
            )}

            {isLoading && (
              <div className="mt-4 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
                Đang tải tuyến xe...
              </div>
            )}

            {(activeTab === 'lookup' || !bestRouteResult) && (
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-bold text-slate-700">
                    {routes.length} tuyến được tìm thấy
                  </div>
                  {(activeFilters.q || activeFilters.from || activeFilters.to || selectedRoute || nearbyStops.length > 0 || bestRouteResult) && (
                    <button
                      type="button"
                      onClick={handleBackToAllRoutes}
                      className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-black text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                      Quay lại
                    </button>
                  )}
                </div>
                {routes.map((route) => {
                  const isSelected = selectedRoute?.routeNumber === route.routeNumber;

                  return (
                    <div key={route.id} className="space-y-3">
                      <RouteCard
                        route={route}
                        compact={activeTab === 'directions'}
                        isHighlighted={isSelected}
                        isFavorite={isRouteFavorite(route)}
                        onSelect={() => setSelectedRoute(route)}
                        onToggleFavorite={handleToggleFavoriteRoute}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <MapCanvas
          stops={mapStops}
          selectedRoute={selectedRoute}
          currentLocation={currentLocation}
          liveBusData={liveBusData}
          liveError={liveError}
          arrivalAlerts={[...delayAlerts, ...arrivalAlerts]}
          onDismissArrivalAlert={handleDismissArrivalAlert}
          onUseCurrentLocation={handleUseCurrentLocation}
        />
        {selectedRoute && (
          <RouteDetailsPanel
            route={selectedRoute}
            currentLocation={currentLocation}
            liveBusData={isLiveTrackingSelectedRoute ? liveBusData : null}
            isLiveTracking={isLiveTrackingSelectedRoute}
            isLiveLoading={isLiveTrackingSelectedRoute && isLiveLoading}
            liveError={isLiveTrackingSelectedRoute ? liveError : ''}
            isFavorite={isRouteFavorite(selectedRoute)}
            isStopFavorite={isStopFavorite}
            isArrivalNotificationEnabled={isArrivalNotificationEnabled}
            isDelayNotificationEnabled={isDelayNotificationEnabled}
            isRouteChangeNotificationEnabled={isRouteChangeNotificationEnabled}
            panelMessage={routePanelMessage}
            onToggleFavorite={handleToggleFavoriteRoute}
            onToggleFavoriteStop={handleToggleFavoriteStop}
            onToggleArrivalNotification={handleToggleArrivalNotification}
            onToggleDelayNotification={handleToggleDelayNotification}
            onToggleRouteChangeNotification={handleToggleRouteChangeNotification}
            onToggleLiveLocation={handleToggleLiveLocation}
            onPurchaseTicket={handleOpenPurchaseTicket}
            onClose={() => setSelectedRoute(null)}
          />
        )}
      </main>
    </div>
  );
};

export default SearchRoutesPage;
