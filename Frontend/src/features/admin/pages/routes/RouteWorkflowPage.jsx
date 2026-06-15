import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Header from '../../../../shared/components/navigation/Header.jsx';
import { HOME_BUS_HERO_IMAGE } from '../../../../shared/constants/images.js';
import useTheme from '../../../../shared/hooks/useTheme.js';
import adminService from '../../services/adminService.js';
import ConfigureScheduleStep from './ConfigureScheduleStep.jsx';
import CreateRouteStep from './CreateRouteStep.jsx';
import DefinePathStep from './DefinePathStep.jsx';
import ReviewRouteStep from './ReviewRouteStep.jsx';
import { DA_NANG_BOUNDS, DA_NANG_CENTER, computeDirection, isInsideDaNang, normalizeRouteFromApi, routeStatusLabels, validateRouteDraft } from './routeWorkflowUtils.js';
import { useRouteWorkflowStore } from './routeWorkflowStore.js';

const steps = [
  { label: 'Tạo tuyến', hint: 'Thông tin cơ bản' },
  { label: 'Dựng lộ trình', hint: 'Trạm + bản đồ' },
  { label: 'Cấu hình lịch chạy', hint: 'Kế hoạch vận hành' },
  { label: 'Rà soát & kích hoạt', hint: 'Kiểm tra dữ liệu' },
];

const operationSections = [
  { key: 'routes', label: 'Vận hành tuyến', hint: 'Tạo, cập nhật, tạm dừng và dựng lộ trình' },
  { key: 'stops', label: 'Quản lý trạm dừng', hint: 'Tạo, cập nhật và gán trạm vào tuyến' },
  { key: 'fleet', label: 'Quản lý đội xe', hint: 'Thêm, cập nhật và gán xe vào tuyến' },
];

operationSections.push({ key: 'scheduling', label: 'Điều phối lịch chuyến', hint: 'Tạo lịch, gán xe và nhân sự theo chuyến' });
operationSections.push({ key: 'shift-list', label: 'Danh sách ca làm', hint: 'Xem, chỉnh sửa và xóa các ca đã tạo' });

const busStatusLabels = {
  ACTIVE: 'Đang hoạt động',
  RESERVE: 'Dự phòng',
  MAINTENANCE: 'Đang bảo trì',
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
  capacity: 60,
  operator: 'Veridian Transit',
  status: 'ACTIVE',
  currentLatitude: '',
  currentLongitude: '',
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
  emergencyReason: '',
  notes: '',
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

const parseClockToMinutes = (value = '') => {
  const match = String(value).match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return (hours * 60) + minutes;
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

const isActiveShiftAssignment = (assignment) => ['ASSIGNED', 'IN_PROGRESS'].includes(assignment?.status);

const isTimeRangeInsideShift = ({ departureTime, expectedArrivalTime }, shift) => {
  const departure = parseClockToMinutes(departureTime);
  const arrival = parseClockToMinutes(expectedArrivalTime || departureTime);
  const shiftStart = parseClockToMinutes(shift?.startTime);
  const shiftEnd = parseClockToMinutes(shift?.endTime);
  return departure !== null
    && arrival !== null
    && shiftStart !== null
    && shiftEnd !== null
    && departure <= arrival
    && departure >= shiftStart
    && arrival <= shiftEnd;
};

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
  addressSearchLoading,
  addressSearchResults,
  form,
  mapSearchQuery,
  mapSearchResults,
  onMapSearchChange,
  onPickAddress,
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
      mapRef.current.setView([latitude, longitude], Math.max(mapRef.current.getZoom(), 15));
    }

    window.setTimeout(() => mapRef.current?.invalidateSize(), 80);
  }, [form._id, form.latitude, form.longitude, form.stationName, stations]);

  return (
    <div className="relative min-h-[320px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      <div ref={elementRef} className="h-[360px] w-full" />
      <div
        className="absolute left-3 right-3 top-3 z-[500] max-w-[380px] rounded-xl border border-slate-200/80 bg-white/95 p-2.5 shadow-lg backdrop-blur"
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <label className="block">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Tìm nhanh trên map</span>
          <input
            value={mapSearchQuery}
            onChange={(event) => onMapSearchChange(event.target.value)}
            placeholder="Nhập mã, tên hoặc địa chỉ trạm..."
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto pr-1">
          {addressSearchResults.length ? (
            <div className="pb-1">
              <p className="mb-1 px-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">Địa chỉ trên bản đồ</p>
              <div className="space-y-1.5">
                {addressSearchResults.map((result) => (
                  <button
                    key={`address-${result.id}`}
                    type="button"
                    onClick={() => onPickAddress(result)}
                    className="w-full rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-left text-xs transition hover:border-cyan-400 hover:bg-white hover:shadow-sm"
                  >
                    <span className="block text-sm font-black text-slate-900">{result.displayName}</span>
                    <span className="mt-1 block font-bold text-cyan-700">Bấm để hiển thị vị trí trên bản đồ</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {mapSearchResults.length ? <p className="px-1 pt-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Trạm đã có</p> : null}
          {mapSearchResults.map((station) => (
            <button
              key={station._id}
              type="button"
              onClick={() => onPickStation(station)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs transition hover:border-emerald-300 hover:bg-white hover:shadow-sm"
            >
              <span className="block truncate text-sm font-black text-slate-900">{station.stationCode ? `${station.stationCode} - ` : ''}{station.stationName}</span>
              <span className="mt-0.5 block truncate text-slate-500">{station.address}</span>
              <span className="mt-1 grid grid-cols-2 gap-1 text-[11px] font-bold text-emerald-700">
                <span className="rounded-md bg-emerald-50 px-2 py-1">Vĩ độ {Number(station.latitude).toFixed(6)}</span>
                <span className="rounded-md bg-emerald-50 px-2 py-1">Kinh độ {Number(station.longitude).toFixed(6)}</span>
              </span>
            </button>
          ))}
          {addressSearchLoading ? (
            <div className="rounded-lg border border-dashed border-cyan-200 bg-cyan-50 p-3 text-xs font-semibold text-cyan-700">
              Đang tìm địa chỉ...
            </div>
          ) : null}
          {mapSearchQuery.trim() && !mapSearchResults.length && !addressSearchResults.length && !addressSearchLoading ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-500">
              Không tìm thấy địa chỉ hoặc trạm phù hợp.
            </div>
          ) : null}
        </div>
      </div>
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
          height: 30px;
          justify-content: center;
          width: 30px;
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

const ScheduleListPanel = ({ onDeleteSchedule, onEditSchedule, onSelectSchedule, routes, schedules, selectedScheduleId }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-black text-slate-950">Danh sách ca làm</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">Xem, chỉnh sửa hoặc xóa từng ca trong lịch điều phối tuyến.</p>
      </div>
      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{schedules.length} ca</span>
    </div>
    <div className="mt-4 max-h-[560px] overflow-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[1320px] border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
          <tr>
            {['Mã ca', 'Tuyến', 'Ngày', 'Thời gian', 'Chiều', 'Xe', 'Tài xế', 'Phụ xe', 'Trạng thái', 'Ghi chú', 'Thao tác'].map((label) => (
              <th key={label} className="border-b border-slate-200 px-3 py-3 font-black uppercase">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schedules.map((schedule) => {
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
                <td className="px-3 py-3 whitespace-nowrap">{scheduleDirectionLabels[schedule.direction] || schedule.direction}</td>
                <td className="px-3 py-3"><span className="block font-bold">{schedule.vehicle?.busCode || vehicle.busCode || 'Chưa gán'}</span><span className="mt-1 block text-slate-500">{schedule.vehicle?.plateNumber || vehicle.plateNumber || ''}</span></td>
                <td className="px-3 py-3"><span className="block font-bold">{schedule.driver?.fullName || driver.fullName || 'Chưa gán'}</span><span className="mt-1 block text-slate-500">{schedule.driver?.phone || driver.phoneNumber || ''}</span></td>
                <td className="px-3 py-3"><span className="block font-bold">{schedule.assistant?.fullName || assistant.fullName || 'Chưa gán'}</span><span className="mt-1 block text-slate-500">{schedule.assistant?.phone || assistant.phoneNumber || ''}</span></td>
                <td className="px-3 py-3 whitespace-nowrap"><span className="rounded-full bg-slate-100 px-2 py-1 font-bold">{scheduleStatusLabels[schedule.status] || schedule.status}</span></td>
                <td className="px-3 py-3 max-w-52 text-slate-500">{schedule.notes || '-'}</td>
                <td className="px-3 py-3"><div className="flex gap-2"><button type="button" onClick={(event) => { event.stopPropagation(); onEditSchedule(schedule); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold hover:border-emerald-300">Sửa</button><button type="button" disabled={schedule.status === 'IN_PROGRESS'} onClick={(event) => { event.stopPropagation(); onDeleteSchedule(schedule); }} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 font-bold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40">Xóa</button></div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!schedules.length ? <div className="p-6 text-center text-sm text-slate-500">Chưa có ca làm.</div> : null}
    </div>
  </div>
);

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

const toAssignedPerson = (userId, people) => {
  const user = people.find((item) => String(item._id) === String(userId));
  return user ? {
    userId: user._id,
    fullName: user.fullName,
    role: user.role,
    phone: user.phone || user.phoneNumber || '',
  } : {};
};

const FrequencyScheduleModal = ({ onClose, onSaved, routes }) => {
  const [form, setForm] = useState({ routeId: '', startDate: toDateInputValue(), endDate: toDateInputValue(), autoAssign: true, replaceScheduled: false });
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const selectedRoute = routes.find((route) => String(route._id) === String(form.routeId));

  const generate = async () => {
    if (!form.routeId || !form.startDate || !form.endDate) return setMessage('Vui lòng chọn tuyến và khoảng ngày.');
    setIsLoading(true);
    setMessage('');
    try {
      const response = await adminService.generateTripSchedulePreview(form);
      setRows(response.rows || []);
      if (!response.rows?.length) setMessage('Không có ngày hoạt động trong khoảng đã chọn.');
    } catch (error) {
      setMessage(error?.message || 'Không thể sinh lịch theo tần suất tuyến.');
    } finally {
      setIsLoading(false);
    }
  };

  const confirm = async () => {
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
          <div><h2 className="text-xl font-black">Sinh lịch theo tần suất tuyến</h2><p className="mt-1 text-sm text-slate-500">Tạo bản xem trước trước khi lưu chính thức.</p></div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-lg border border-slate-200 text-xl">×</button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="md:col-span-3"><span className="mb-1 block text-xs font-bold uppercase text-slate-500">Tuyến *</span><select className="h-11 w-full rounded-lg border border-slate-200 px-3" value={form.routeId} onChange={(event) => setForm((current) => ({ ...current, routeId: event.target.value }))}><option value="">Chọn tuyến</option>{routes.map((route) => <option key={route._id} value={route._id}>{route.routeCode} - {route.routeName}</option>)}</select></label>
          <label><span className="mb-1 block text-xs font-bold uppercase text-slate-500">Từ ngày *</span><input type="date" className="h-11 w-full rounded-lg border border-slate-200 px-3" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} /></label>
          <label><span className="mb-1 block text-xs font-bold uppercase text-slate-500">Đến ngày *</span><input type="date" min={form.startDate} className="h-11 w-full rounded-lg border border-slate-200 px-3" value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} /></label>
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{selectedRoute ? `${selectedRoute.scheduleConfig?.firstDepartureTime || '--:--'} - ${selectedRoute.scheduleConfig?.lastDepartureTime || '--:--'} · ${selectedRoute.scheduleConfig?.frequencyMinutes || 0} phút/chuyến` : 'Chọn tuyến để xem cấu hình.'}</div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-bold"><input type="checkbox" checked={form.autoAssign} onChange={(event) => setForm((current) => ({ ...current, autoAssign: event.target.checked }))} /> Tự gán xe, tài xế và phụ xe</label>
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-bold"><input type="checkbox" checked={form.replaceScheduled} onChange={(event) => setForm((current) => ({ ...current, replaceScheduled: event.target.checked }))} /> Xóa lịch PLANNED cũ trong khoảng ngày</label>
        </div>
        <div className="mt-4 flex gap-2"><button type="button" disabled={isLoading} onClick={generate} className="rounded-lg bg-violet-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{rows.length ? 'Sinh lại' : 'Sinh lịch'}</button><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-5 py-3 text-sm font-bold">Đóng</button></div>
        {message ? <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{message}</div> : null}
        {rows.length ? <div className="mt-5"><div className="mb-3 flex justify-between"><h3 className="font-black">Bản xem trước</h3><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{rows.length} chuyến</span></div><div className="max-h-96 overflow-auto rounded-lg border border-slate-200"><table className="min-w-[1050px] w-full text-left text-xs"><thead className="sticky top-0 bg-slate-100"><tr>{['Ngày', 'Mã lịch', 'Chiều', 'Xuất bến', 'Đến', 'Xe', 'Tài xế', 'Phụ xe', 'Cảnh báo', ''].map((item) => <th key={item} className="px-3 py-3 font-black uppercase text-slate-500">{item}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.previewId} className="border-t border-slate-200"><td className="px-3 py-3">{row.serviceDate}</td><td className="px-3 py-3 font-bold">{row.scheduleCode}</td><td className="px-3 py-3">{scheduleDirectionLabels[row.direction]}</td><td className="px-3 py-3">{row.departureTime}</td><td className="px-3 py-3">{row.expectedArrivalTime}</td><td className="px-3 py-3">{row.vehicle?.busCode || 'Chưa gán'}</td><td className="px-3 py-3">{row.driver?.fullName || 'Chưa gán'}</td><td className="px-3 py-3">{row.assistant?.fullName || 'Chưa gán'}</td><td className="px-3 py-3 text-amber-700">{row.warnings?.join(' ') || 'Hợp lệ'}</td><td className="px-3 py-3"><button type="button" onClick={() => setRows((current) => current.filter((item) => item.previewId !== row.previewId))} className="text-rose-600">Xóa</button></td></tr>)}</tbody></table></div><div className="mt-4 flex justify-end"><button type="button" disabled={isLoading} onClick={confirm} className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-black text-emerald-950 disabled:opacity-50">Xác nhận tạo lịch</button></div></div> : null}
      </div>
    </div>
  );
};

const SchedulingOperationsPanel = ({ assistantStaff, buses, driverShiftAssignments, drivers, editingSchedule, onSaved, routes, schedules, shifts }) => {
  const [editingScheduleId, setEditingScheduleId] = useState('');
  const [form, setForm] = useState(() => createEmptyScheduleForm());
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showFrequencyGenerator, setShowFrequencyGenerator] = useState(false);
  const inputClassName = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-300';
  const labelClassName = 'mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500';
  const availableBuses = useMemo(() => buses.filter((bus) => bus.status !== 'MAINTENANCE'), [buses]);
  const selectedRoute = useMemo(() => routes.find((route) => String(route._id) === String(form.routeId)), [form.routeId, routes]);
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
        (form.busId && String(schedule.vehicle?.busId || '') === String(form.busId))
        || (form.driverId && String(schedule.driver?.userId || '') === String(form.driverId))
        || (form.assistantId && String(schedule.assistant?.userId || '') === String(form.assistantId))
      )
    ));
  }, [editingScheduleId, form, schedules]);
  const availableDrivers = useMemo(() => {
    if (!form.serviceDate || !form.departureTime || !form.expectedArrivalTime) return [];
    return drivers.filter((driver) => {
      const hasMatchingShift = driverShiftAssignments.some((assignment) => {
        const assignedDriverId = assignment.driverId?._id || assignment.driverId;
        const shift = typeof assignment.shiftId === 'object' && assignment.shiftId !== null
          ? assignment.shiftId
          : shifts.find((item) => String(item._id) === String(assignment.shiftId));
        return String(assignedDriverId || '') === String(driver._id || '')
          && isActiveShiftAssignment(assignment)
          && isSameDateInputValue(assignment.workDate, form.serviceDate)
          && shift?.status === 'ACTIVE'
          && isTimeRangeInsideShift(form, shift);
      });
      if (!hasMatchingShift) return false;
      return !schedules.some((schedule) => (
        String(schedule._id || '') !== String(editingScheduleId || '')
        && schedule.status !== 'CANCELLED'
        && isSameDateInputValue(schedule.serviceDate, form.serviceDate)
        && String(schedule.driver?.userId || '') === String(driver._id || '')
        && scheduleTimeRangesOverlap(form, schedule)
      ));
    });
  }, [driverShiftAssignments, drivers, editingScheduleId, form, schedules, shifts]);
  const availableAssistants = useMemo(() => {
    if (!form.serviceDate || !form.departureTime || !form.expectedArrivalTime) return [];
    return assistantStaff.filter((assistant) => !schedules.some((schedule) => (
      String(schedule._id || '') !== String(editingScheduleId || '')
      && schedule.status !== 'CANCELLED'
      && isSameDateInputValue(schedule.serviceDate, form.serviceDate)
      && String(schedule.assistant?.userId || '') === String(assistant._id || '')
      && scheduleTimeRangesOverlap(form, schedule)
    )));
  }, [assistantStaff, editingScheduleId, form, schedules]);

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
    if (!isStillAvailable) {
      setForm((current) => ({ ...current, driverId: '' }));
    }
  }, [availableDrivers, form.driverId]);

  useEffect(() => {
    if (!form.assistantId) return;
    const isStillAvailable = availableAssistants.some((assistant) => String(assistant._id || '') === String(form.assistantId));
    if (!isStillAvailable) setForm((current) => ({ ...current, assistantId: '' }));
  }, [availableAssistants, form.assistantId]);

  const resetForm = () => {
    setEditingScheduleId('');
    setForm(createEmptyScheduleForm());
    setMessage('');
  };

  const updateForm = (patch) => {
    setForm((current) => {
      const next = { ...current, ...patch };
      const route = routes.find((item) => String(item._id) === String(next.routeId));
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
      routeId: schedule.routeId || '',
      direction: schedule.direction || 'OUTBOUND',
      departureTime: schedule.departureTime || '05:30',
      expectedArrivalTime: schedule.expectedArrivalTime || '',
      shiftLabel: schedule.shiftLabel || '',
      status: schedule.status || 'PLANNED',
      busId: schedule.vehicle?.busId || '',
      driverId: schedule.driver?.userId || '',
      assistantId: schedule.assistant?.userId || '',
      emergencyReason: '',
      notes: schedule.notes || '',
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
    if (assignmentConflict) {
      setMessage(`Trùng phân công với lịch ${assignmentConflict.scheduleCode} lúc ${assignmentConflict.departureTime}. Vui lòng đổi xe, tài xế, phụ xe hoặc giờ xuất bến.`);
      return;
    }
    const hasAssignments = Boolean(form.busId || form.driverId || form.assistantId);
    const payload = {
      scheduleCode: form.scheduleCode,
      serviceDate: form.serviceDate,
      routeId: form.routeId,
      direction: form.direction,
      departureTime: form.departureTime,
      expectedArrivalTime: form.expectedArrivalTime,
      shiftLabel: form.shiftLabel,
      status: hasAssignments && form.status === 'PLANNED' ? 'ASSIGNED' : form.status,
      vehicle: toAssignedVehicle(form.busId, availableBuses),
      driver: toAssignedPerson(form.driverId, drivers),
      assistant: toAssignedPerson(form.assistantId, assistantStaff),
      emergencyReason: form.emergencyReason,
      notes: form.notes,
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
            <input type="time" className={inputClassName} value={form.departureTime} onChange={(event) => updateForm({ departureTime: event.target.value })} />
          </label>
          <label>
            <span className={labelClassName}>Giờ đến dự kiến</span>
            <input type="time" className={inputClassName} value={form.expectedArrivalTime} onChange={(event) => updateForm({ expectedArrivalTime: event.target.value })} />
          </label>
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          <label>
            <span className={labelClassName}>Tuyến</span>
            <select className={inputClassName} value={form.routeId} onChange={(event) => updateForm({ routeId: event.target.value })}>
              <option value="">Chọn tuyến</option>
              {routes.map((route) => <option key={route._id} value={route._id}>{route.routeCode} - {route.routeName}</option>)}
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
              {availableDrivers.map((driver) => <option key={driver._id} value={driver._id}>{driver.fullName}{driver.phone ? ` - ${driver.phone}` : ''}</option>)}
            </select>
            {form.serviceDate && form.departureTime && form.expectedArrivalTime && !availableDrivers.length ? (
              <span className="mt-1 block text-xs font-semibold text-amber-600">Khong co tai xe co ca lam phu hop hoac tai xe da ban trong khung gio nay.</span>
            ) : null}
          </label>
          <label>
            <span className={labelClassName}>Phụ xe</span>
            <select className={inputClassName} value={form.assistantId} onChange={(event) => updateForm({ assistantId: event.target.value })}>
              <option value="">Chưa gán phụ xe</option>
              {availableAssistants.map((staff) => <option key={staff._id} value={staff._id}>{staff.fullName}{staff.phone ? ` - ${staff.phone}` : ''}</option>)}
            </select>
            {form.serviceDate && form.departureTime && form.expectedArrivalTime && !availableAssistants.length ? (
              <span className="mt-1 block text-xs font-semibold text-amber-600">Không có phụ xe rảnh trong khung giờ này.</span>
            ) : null}
          </label>
        </div>
        {selectedRoute ? (
          <div className="grid gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800 sm:grid-cols-3">
            <span><strong>Tuyến:</strong> {selectedRoute.routeCode} - {selectedRoute.routeName}</span>
            <span><strong>Chiều:</strong> {scheduleDirectionLabels[form.direction]}</span>
            <span><strong>Thời lượng ước tính:</strong> {estimatedDurationMinutes || 0} phút</span>
          </div>
        ) : null}
        {assignmentConflict ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Trùng phân công với lịch {assignmentConflict.scheduleCode} lúc {assignmentConflict.departureTime}. Hệ thống sẽ không lưu cho đến khi đổi xe, tài xế, phụ xe hoặc giờ xuất bến.
          </div>
        ) : null}
        <div className="grid gap-2 lg:grid-cols-2">
          <label>
            <span className={labelClassName}>Lý do đổi khẩn cấp</span>
            <input className={inputClassName} placeholder="Chỉ nhập khi thay xe hoặc thay nhân sự đột xuất" value={form.emergencyReason} onChange={(event) => updateForm({ emergencyReason: event.target.value })} />
          </label>
          <label>
            <span className={labelClassName}>Ghi chú vận hành</span>
            <input className={inputClassName} placeholder="VD: ưu tiên xe sàn thấp, theo dõi giờ cao điểm" value={form.notes} onChange={(event) => updateForm({ notes: event.target.value })} />
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="submit" disabled={isSaving || Boolean(assignmentConflict)} className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60">{editingScheduleId ? 'Cập nhật lịch' : 'Tạo lịch chuyến'}</button>
          <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">Làm mới</button>
        </div>
        {message ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{message}</div> : null}
      </form>

      <div className="hidden">
        {schedules.map((schedule) => (
          <button key={schedule._id} type="button" onClick={() => editSchedule(schedule)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm hover:border-emerald-300">
            <span className="block font-black text-slate-900">{schedule.scheduleCode} - {schedule.routeCode} - {schedule.departureTime}{schedule.expectedArrivalTime ? ` đến ${schedule.expectedArrivalTime}` : ''}</span>
            <span className="mt-1 block text-xs text-slate-500">{toDateInputValue(schedule.serviceDate)} | {scheduleDirectionLabels[schedule.direction] || schedule.direction} | {scheduleStatusLabels[schedule.status] || schedule.status}</span>
            <span className="mt-1 block text-xs text-slate-500">{schedule.vehicle?.busCode || 'Chưa gán xe'} | {schedule.driver?.fullName || 'Chưa gán tài xế'} | {schedule.assistant?.fullName || 'Chưa gán phụ xe'}</span>
          </button>
        ))}
        {!schedules.length ? <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Chưa có lịch chuyến.</div> : null}
      </div>
    </div>
  );
};

const FleetOperationsPanel = ({ buses, onSaved, routes }) => {
  const [query, setQuery] = useState('');
  const [editingBusId, setEditingBusId] = useState('');
  const [form, setForm] = useState(emptyBusForm);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [assignForm, setAssignForm] = useState({ routeId: '', busId: '' });
  const [assignMessage, setAssignMessage] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const inputClassName = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-300';
  const assignableBuses = useMemo(() => buses.filter((bus) => bus.status !== 'MAINTENANCE'), [buses]);
  const filteredBuses = useMemo(() => {
    const normalizedQuery = normalizeStationSearch(query);
    return buses
      .filter((bus) => !normalizedQuery || [bus.busCode, bus.plateNumber, bus.busType, bus.status].some((value) => normalizeStationSearch(value).includes(normalizedQuery)))
      .slice(0, 5);
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
      capacity: bus.capacity || 60,
      operator: bus.operator || 'Veridian Transit',
      status: bus.status || 'ACTIVE',
      currentLatitude: bus.currentLatitude ?? '',
      currentLongitude: bus.currentLongitude ?? '',
    });
    setMessage('');
  };
  const saveBus = async (event) => {
    event.preventDefault();
    const capacity = Number(form.capacity);
    if (!form.busCode.trim() || !form.plateNumber.trim() || !form.busType.trim() || !Number.isFinite(capacity) || capacity < 1) {
      setMessage('Cần nhập mã xe, biển số, loại xe và sức chứa hợp lệ.');
      return;
    }
    const payload = {
      ...form,
      capacity,
      currentLatitude: form.currentLatitude === '' ? undefined : Number(form.currentLatitude),
      currentLongitude: form.currentLongitude === '' ? undefined : Number(form.currentLongitude),
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
  const assignBusToRoute = async (event) => {
    event.preventDefault();
    const route = routes.find((item) => item._id === assignForm.routeId);
    const bus = buses.find((item) => item._id === assignForm.busId);
    if (!route || !bus) {
      setAssignMessage('Cần chọn tuyến và xe hợp lệ.');
      return;
    }
    if (bus.status === 'MAINTENANCE') {
      setAssignMessage('Xe đang bảo trì không thể gán vào tuyến.');
      return;
    }

    const currentAssignment = route.vehicleAssignment || {};
    const assignedBuses = currentAssignment.assignedBuses || [];
    if (assignedBuses.some((assignedBus) => String(assignedBus.busId) === String(bus._id))) {
      setAssignMessage('Xe này đã được gán cho tuyến.');
      return;
    }

    setIsAssigning(true);
    try {
      await adminService.updateRoute(route._id, {
        ...route,
        vehicleAssignment: {
          ...currentAssignment,
          busType: currentAssignment.busType || bus.busType,
          capacity: Math.max(Number(currentAssignment.capacity || 0), Number(bus.capacity || 0)),
          assignedBuses: [
            ...assignedBuses,
            {
              busId: bus._id,
              busCode: bus.busCode,
              plateNumber: bus.plateNumber,
              busType: bus.busType,
              capacity: Number(bus.capacity || 0),
            },
          ],
        },
      });
      setAssignForm({ routeId: route._id, busId: '' });
      setAssignMessage('Đã gán xe vào tuyến.');
      await onSaved?.();
    } catch (error) {
      setAssignMessage(error?.message || 'Không thể gán xe vào tuyến.');
    } finally {
      setIsAssigning(false);
    }
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950">Quản lý đội xe</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Đăng ký xe, cập nhật trạng thái bảo trì và gán xe vào tuyến.</p>
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
          <input type="number" min="1" className={inputClassName} placeholder="Sức chứa" value={form.capacity} onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))} />
          <select className={inputClassName} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
            <option value="ACTIVE">{busStatusLabels.ACTIVE}</option>
            <option value="RESERVE">{busStatusLabels.RESERVE}</option>
            <option value="MAINTENANCE">{busStatusLabels.MAINTENANCE}</option>
          </select>
        </div>
        <input className={inputClassName} placeholder="Đơn vị vận hành" value={form.operator} onChange={(event) => setForm((current) => ({ ...current, operator: event.target.value }))} />
        <div className="grid gap-2 sm:grid-cols-2">
          <input className={inputClassName} placeholder="Vĩ độ hiện tại" value={form.currentLatitude} onChange={(event) => setForm((current) => ({ ...current, currentLatitude: event.target.value }))} />
          <input className={inputClassName} placeholder="Kinh độ hiện tại" value={form.currentLongitude} onChange={(event) => setForm((current) => ({ ...current, currentLongitude: event.target.value }))} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="submit" disabled={isSaving} className="rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60">{editingBusId ? 'Cập nhật xe' : 'Thêm xe mới'}</button>
          <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">Làm mới</button>
        </div>
        {message ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{message}</div> : null}
      </form>
      <form onSubmit={assignBusToRoute} className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <h3 className="text-sm font-black text-slate-950">Gán xe vào tuyến</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select className={inputClassName} value={assignForm.routeId} onChange={(event) => setAssignForm((current) => ({ ...current, routeId: event.target.value }))}>
            <option value="">Chọn tuyến</option>
            {routes.map((route) => (
              <option key={route._id} value={route._id}>{route.routeCode} - {route.routeName}</option>
            ))}
          </select>
          <select className={inputClassName} value={assignForm.busId} onChange={(event) => setAssignForm((current) => ({ ...current, busId: event.target.value }))}>
            <option value="">Chọn xe khả dụng</option>
            {assignableBuses.map((bus) => (
              <option key={bus._id} value={bus._id}>{bus.busCode} - {bus.plateNumber}</option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={isAssigning} className="mt-3 w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60">Gán xe</button>
        {assignMessage ? <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">{assignMessage}</div> : null}
      </form>
      <input className={`${inputClassName} mt-5`} placeholder="Tìm xe để cập nhật..." value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
        {filteredBuses.map((bus) => (
          <button key={bus._id} type="button" onClick={() => editBus(bus)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm hover:border-sky-300">
            <span className="block font-black text-slate-900">{bus.busCode} - {bus.plateNumber}</span>
            <span className="mt-1 block text-xs text-slate-500">{bus.busType} | {bus.capacity} chỗ | {busStatusLabels[bus.status] || bus.status}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const StopOperationsPanel = ({ isDarkMode, onSaved, routes, stations }) => {
  const [query, setQuery] = useState('');
  const [editingStationId, setEditingStationId] = useState('');
  const [form, setForm] = useState(emptyStopForm);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [addressSearchResults, setAddressSearchResults] = useState([]);
  const [addressSearchLoading, setAddressSearchLoading] = useState(false);
  const skipStationAutoPickRef = useRef(false);

  const matchingStations = useMemo(() => {
    const normalizedQuery = normalizeStationSearch(query);
    return stations
      .filter((station) => !normalizedQuery || [
        station.stationCode,
        station.stationName,
        station.address,
        station.district,
        station.ward,
      ].some((value) => normalizeStationSearch(value).includes(normalizedQuery)));
  }, [query, stations]);
  const filteredStations = useMemo(() => matchingStations.slice(0, 6), [matchingStations]);
  const mapSearchResults = useMemo(() => {
    if (!query.trim()) return [];
    return matchingStations
      .filter((station) => isInsideDaNang(station.latitude, station.longitude))
      .slice(0, 8);
  }, [matchingStations, query]);
  const quickSuggestions = useMemo(() => {
    if (filteredStations.length) return filteredStations.slice(0, 5);
    return stations
      .filter((station) => isInsideDaNang(station.latitude, station.longitude))
      .slice(0, 5);
  }, [filteredStations, stations]);

  useEffect(() => {
    const searchText = query.trim();
    if (searchText.length < 3) {
      setAddressSearchResults([]);
      setAddressSearchLoading(false);
      return undefined;
    }

    let active = true;
    const timeoutId = window.setTimeout(async () => {
      setAddressSearchLoading(true);
      try {
        const response = await adminService.searchStopAddresses(searchText);
        if (active) setAddressSearchResults(response.results || []);
      } catch (_error) {
        if (active) setAddressSearchResults([]);
      } finally {
        if (active) setAddressSearchLoading(false);
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  const resetForm = () => {
    setEditingStationId('');
    setForm(emptyStopForm);
    setErrors({});
    setMessage('');
    setAddressSearchResults([]);
  };

  const handleStationSearchChange = (value) => {
    setQuery(value);
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
  const pickAddressResult = (result) => {
    skipStationAutoPickRef.current = true;
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
    setQuery(result.displayName || result.address || query);
    setErrors((current) => ({ ...current, address: undefined, latitude: undefined, longitude: undefined }));
    setMessage('Đã chọn địa chỉ và hiển thị vị trí trên bản đồ.');
    setAddressSearchResults([]);
  };

  useEffect(() => {
    const normalizedQuery = normalizeStationSearch(query);
    if (!normalizedQuery || editingStationId) return;
    if (skipStationAutoPickRef.current) {
      skipStationAutoPickRef.current = false;
      return;
    }

    const exactMatch = mapSearchResults.find((station) => [
      station.stationCode,
      station.stationName,
    ].some((value) => normalizeStationSearch(value) === normalizedQuery));
    const stationToRender = exactMatch || (mapSearchResults.length === 1 ? mapSearchResults[0] : null);
    if (!stationToRender) return;

    setEditingStationId(stationToRender._id);
    setForm({
      _id: stationToRender._id || '',
      stationCode: stationToRender.stationCode || '',
      stationName: stationToRender.stationName || '',
      address: stationToRender.address || '',
      latitude: stationToRender.latitude ?? '',
      longitude: stationToRender.longitude ?? '',
      district: stationToRender.district || '',
      ward: stationToRender.ward || '',
      isMainStation: Boolean(stationToRender.isMainStation),
    });
    setErrors((current) => ({ ...current, latitude: undefined, longitude: undefined }));
  }, [editingStationId, mapSearchResults, query]);

  const validateForm = () => {
    const nextErrors = {};
    if (!form.stationCode.trim()) nextErrors.stationCode = 'Nhập mã trạm';
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
      await onSaved?.();
    } catch (error) {
      setMessage(error?.message || 'Không thể lưu trạm.');
    } finally {
      setIsSaving(false);
    }
  };

  const labelClassName = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const stopInputClassName = 'h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950">Quản lý trạm dừng</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Tạo và cập nhật trạm dừng. Gán trạm vào tuyến tại bước Dựng lộ trình bằng cách thêm trạm vào chiều tuyến.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{stations.length}</span>
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <form onSubmit={saveStop} className="grid content-start gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div>
            <h3 className="text-sm font-black text-slate-950">Thông tin trạm</h3>
            <p className="mt-1 text-xs text-slate-500">Nhập thông tin cơ bản hoặc chọn nhanh một trạm trên bản đồ.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={`mb-1 block text-[11px] font-bold uppercase tracking-[0.18em] ${labelClassName}`}>Mã trạm</span>
              <input className={stopInputClassName} value={form.stationCode} onChange={(event) => setForm((current) => ({ ...current, stationCode: event.target.value }))} />
              {errors.stationCode ? <span className="mt-1 block text-xs text-rose-600">{errors.stationCode}</span> : null}
            </label>
            <label>
              <span className={`mb-1 block text-[11px] font-bold uppercase tracking-[0.18em] ${labelClassName}`}>Tên trạm</span>
              <input className={stopInputClassName} value={form.stationName} onChange={(event) => setForm((current) => ({ ...current, stationName: event.target.value }))} />
              {errors.stationName ? <span className="mt-1 block text-xs text-rose-600">{errors.stationName}</span> : null}
            </label>
          </div>
          <label>
            <span className={`mb-1 block text-[11px] font-bold uppercase tracking-[0.18em] ${labelClassName}`}>Địa chỉ</span>
            <input className={stopInputClassName} value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
            {errors.address ? <span className="mt-1 block text-xs text-rose-600">{errors.address}</span> : null}
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={`mb-1 block text-[11px] font-bold uppercase tracking-[0.18em] ${labelClassName}`}>Latitude</span>
              <input className={stopInputClassName} value={form.latitude} onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))} />
              {errors.latitude ? <span className="mt-1 block text-xs text-rose-600">{errors.latitude}</span> : null}
            </label>
            <label>
              <span className={`mb-1 block text-[11px] font-bold uppercase tracking-[0.18em] ${labelClassName}`}>Longitude</span>
              <input className={stopInputClassName} value={form.longitude} onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))} />
              {errors.longitude ? <span className="mt-1 block text-xs text-rose-600">{errors.longitude}</span> : null}
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={stopInputClassName} placeholder="Quận/huyện" value={form.district} onChange={(event) => setForm((current) => ({ ...current, district: event.target.value }))} />
            <input className={stopInputClassName} placeholder="Phường/xã" value={form.ward} onChange={(event) => setForm((current) => ({ ...current, ward: event.target.value }))} />
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
        <div className="grid content-start gap-3">
          <StopMapPicker
            addressSearchLoading={addressSearchLoading}
            addressSearchResults={addressSearchResults}
            form={form}
            mapSearchQuery={query}
            mapSearchResults={mapSearchResults}
            onMapSearchChange={handleStationSearchChange}
            onPickAddress={pickAddressResult}
            onPickLocation={pickMapLocation}
            onPickStation={pickSuggestedStation}
            stations={stations}
          />
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-slate-950">Gợi ý nhanh</h3>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{quickSuggestions.length}</span>
            </div>
            <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto pr-1">
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

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-950">Danh sách trạm</h3>
            <p className="mt-1 text-xs text-slate-500">Tìm trạm đã có để cập nhật nhanh thông tin.</p>
          </div>
          <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-slate-600">{filteredStations.length}</span>
        </div>
        <input className={stopInputClassName} placeholder="Tìm trạm để cập nhật..." value={query} onChange={(event) => handleStationSearchChange(event.target.value)} />
        <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
          {filteredStations.map((station) => (
            <button key={station._id} type="button" onClick={() => editStation(station)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:border-emerald-300 hover:shadow-sm">
              <span className="block font-black text-slate-900">{station.stationCode} - {station.stationName}</span>
              <span className="mt-1 block text-xs text-slate-500">{station.address}</span>
              <span className="mt-1 block text-xs text-slate-400">{station.routeAssignments?.length || 0} lượt gán | {routes.length} tuyến trong thư viện</span>
            </button>
          ))}
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
  const [drivers, setDrivers] = useState([]);
  const [assistantStaff, setAssistantStaff] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [driverShiftAssignments, setDriverShiftAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeOperationSection, setActiveOperationSection] = useState('routes');
  const activeStep = useRouteWorkflowStore((state) => state.activeStep);
  const setActiveStep = useRouteWorkflowStore((state) => state.setActiveStep);
  const draft = useRouteWorkflowStore((state) => state.draft);
  const loadRoute = useRouteWorkflowStore((state) => state.loadRoute);
  const resetDraft = useRouteWorkflowStore((state) => state.resetDraft);
  const validation = useMemo(() => validateRouteDraft(draft), [draft]);

  const shellClassName = isDarkMode ? 'bg-[#071516] text-slate-100' : 'bg-[#f4fbfd] text-slate-900';
  const panelClassName = isDarkMode
    ? 'border-white/10 bg-[#0f1d1f]/92 shadow-[0_20px_60px_rgba(0,0,0,0.22)]'
    : 'border-slate-200 bg-white/96 shadow-[0_20px_44px_rgba(148,163,184,0.14)]';
  const inputClassName = `w-full rounded-xl border px-4 py-3 text-sm outline-none ${
    isDarkMode ? 'border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500' : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400'
  }`;

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [stationsResponse, routesResponse, busesResponse, staffResponse, schedulesResponse, shiftsResponse, shiftAssignmentsResponse] = await Promise.all([
        adminService.getStations({ limit: 1000 }),
        adminService.getRoutes({ limit: 100 }),
        adminService.getBuses(),
        adminService.getDrivers(),
        adminService.getTripSchedules({ limit: 100 }),
        adminService.getShifts({ status: 'ACTIVE' }),
        adminService.getShiftAssignments(),
      ]);
      setStations(stationsResponse.stations || []);
      setRoutes(routesResponse.routes || []);
      setBuses(busesResponse.buses || []);
      setDrivers(staffResponse.drivers || []);
      setAssistantStaff(staffResponse.assistantStaff || []);
      setShifts(shiftsResponse.shifts || []);
      setDriverShiftAssignments(shiftAssignmentsResponse.driverAssignments || []);
      const nextSchedules = schedulesResponse.schedules || [];
      setSchedules(nextSchedules);
      setSelectedSchedule((current) => (
        nextSchedules.find((schedule) => String(schedule._id) === String(current?._id))
        || nextSchedules[0]
        || null
      ));
    } catch (loadError) {
      setError(loadError?.message || 'Không thể tải dữ liệu quản lý tuyến.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const deleteSchedule = async (schedule) => {
    const confirmed = window.confirm(`Xóa ca ${schedule.scheduleCode}? Thao tác này không thể hoàn tác.`);
    if (!confirmed) return;
    try {
      await adminService.deleteTripSchedule(schedule._id);
      if (String(scheduleForEditing?._id || '') === String(schedule._id)) setScheduleForEditing(null);
      await loadData();
    } catch (deleteError) {
      setError(deleteError?.message || 'Không thể xóa ca làm.');
    }
  };

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
    <ConfigureScheduleStep key="schedule" inputClassName={inputClassName} panelClassName={panelClassName} />,
    <ReviewRouteStep key="review" panelClassName={panelClassName} isDarkMode={isDarkMode} onSaved={loadData} routes={routes} />,
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Header forceDarkMode={isDarkMode} />
        <div className="px-6 pt-40 text-center">
          <p className="text-sm uppercase tracking-[0.32em] text-slate-500">Đang tải workflow quản lý tuyến</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen overflow-hidden ${shellClassName}`}>
      <Header forceDarkMode={isDarkMode} />
      <main className="relative min-h-screen pt-28">
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
          <img src={HOME_BUS_HERO_IMAGE} alt="" aria-hidden="true" className="h-full w-full object-cover object-center" style={{ opacity: isDarkMode ? 0.36 : 0.14 }} />
          <div className={`absolute inset-0 ${isDarkMode ? 'bg-[#001a0f]/70' : 'bg-white/68'}`} />
        </div>
        <div className="route-workflow-readable relative mx-auto max-w-[1800px] px-4 pb-16 lg:px-6">
          <div className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.34em] text-emerald-500">Quản lý tuyến</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight">Quản lý tuyến xe buýt</h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-500">
                Hoàn tất các nghiệp vụ quản trị: tạo tuyến, cập nhật thông tin, dựng lộ trình hai chiều, quản lý trạm dừng và điều phối đội xe.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={resetDraft} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">
                Tạo bản nháp mới
              </button>
              <button type="button" onClick={loadData} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">
                Tải lại
              </button>
            </div>
          </div>

          {error ? <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

          <div className={`mb-5 rounded-2xl border p-3 ${panelClassName}`}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {operationSections.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveOperationSection(section.key)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
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
          <div className={`mb-5 rounded-2xl border p-4 ${panelClassName}`}>
            <div className="grid gap-3 md:grid-cols-4">
              {steps.map((step, index) => (
                <button
                  key={step.label}
                  type="button"
                  onClick={() => setActiveStep(index)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
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
          <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div>{activeStepContent[activeStep]}</div>
            <aside className={`rounded-2xl border p-5 ${panelClassName}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">Thư viện tuyến</h2>
                <span className="text-xs font-bold text-slate-500">{routes.length} tuyến</span>
              </div>
              <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
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

              {activeStep === 2 ? (
                <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  <strong className="block text-slate-900">Xem nhanh kiểm tra</strong>
                  <span className="mt-2 block">{validation.errors.length} lỗi, {validation.warnings.length} cảnh báo. Chi tiết đầy đủ hiển thị ở bước rà soát.</span>
                </div>
              ) : null}
            </aside>
          </div>
          ) : null}

          {activeOperationSection === 'stops' ? (
            <section className="mb-5 grid gap-5">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <StopOperationsPanel
                isDarkMode={isDarkMode}
                onSaved={loadData}
                routes={routes}
                stations={stations}
              />
              <aside className={`rounded-2xl border p-5 ${panelClassName}`}>
                <h2 className="text-lg font-black">Gán trạm vào tuyến</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Trạm sau khi tạo hoặc cập nhật sẽ xuất hiện trong bước Dựng lộ trình. Thêm trạm vào Chiều đi/Chiều về và sắp xếp thứ tự để tạo chuỗi điểm dừng.
                </p>
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  <strong className="block text-slate-900">{stations.length} trạm khả dụng</strong>
                  <span className="mt-1 block">{routes.length} tuyến trong thư viện có thể gán trạm.</span>
                </div>
              </aside>
              </div>
            </section>
          ) : null}

          {activeOperationSection === 'fleet' ? (
            <section className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <FleetOperationsPanel
                buses={buses}
                onSaved={loadData}
                routes={routes}
              />
              <aside className={`rounded-2xl border p-5 ${panelClassName}`}>
                <h2 className="text-lg font-black">Tổng quan đội xe</h2>
                <div className="mt-4 grid gap-3">
                  {['ACTIVE', 'RESERVE', 'MAINTENANCE'].map((status) => (
                    <div key={status} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
                      <span className="font-black text-slate-900">{busStatusLabels[status] || status}</span>
                      <span className="mt-1 block text-slate-500">{buses.filter((bus) => bus.status === status).length} xe</span>
                    </div>
                  ))}
                </div>
              </aside>
            </section>
          ) : null}

          {activeOperationSection === 'scheduling' ? (
            <section className="mb-5 grid gap-5">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <SchedulingOperationsPanel
                assistantStaff={assistantStaff}
                buses={buses}
                driverShiftAssignments={driverShiftAssignments}
                drivers={drivers}
                editingSchedule={scheduleForEditing}
                onSaved={loadData}
                routes={routes}
                schedules={schedules}
                shifts={shifts}
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
              </aside>
              </div>
            </section>
          ) : null}

          {activeOperationSection === 'shift-list' ? (
            <section className="mb-5 grid gap-5">
                <ScheduleListPanel
                  onDeleteSchedule={deleteSchedule}
                  onEditSchedule={(schedule) => {
                    setScheduleForEditing(schedule);
                    setSelectedSchedule(schedule);
                    setActiveOperationSection('scheduling');
                  }}
                  onSelectSchedule={setSelectedSchedule}
                  routes={routes}
                  schedules={schedules}
                  selectedScheduleId={selectedSchedule?._id}
                />
                <ScheduleRouteDetailPanel routes={routes} schedule={selectedSchedule} />
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default RouteWorkflowPage;
