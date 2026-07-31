import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Header from '../../../shared/components/navigation/Header.jsx';
import useTheme from '../../../shared/hooks/useTheme.js';
import adminService from '../services/adminService.js';
import {
  DA_NANG_BOUNDS,
  DA_NANG_CENTER,
  computeDirection,
  isInsideDaNang,
  normalizeRouteFromApi,
} from './routes/routeWorkflowUtils.js';

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
  AFTERNOON: 'Ca chiều',
};

const statusTone = {
  PLANNED: 'bg-slate-100 text-slate-700',
  ASSIGNED: 'bg-emerald-100 text-emerald-700',
  IN_PROGRESS: 'bg-sky-100 text-sky-700',
  COMPLETED: 'bg-indigo-100 text-indigo-700',
  CANCELLED: 'bg-rose-100 text-rose-700',
};

const toDateInputValue = (date = new Date()) => {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseClockToMinutes = (value) => {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 23 && minutes <= 59 ? (hours * 60) + minutes : null;
};

const formatPerson = (person = {}) => ({
  name: person.fullName || person.name || 'Chưa gán',
  phone: person.phone || person.phoneNumber || '',
  role: person.role || '',
});

const normalizeSearch = (value = '') => String(value)
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd');

const loadAllTripSchedules = async () => {
  const firstPage = await adminService.getTripSchedules({ limit: 100, page: 1 });
  const totalPages = Number(firstPage.pagination?.totalPages || 1);
  if (totalPages <= 1) return firstPage.schedules || [];
  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => (
      adminService.getTripSchedules({ limit: 100, page: index + 2 })
    ))
  );
  return [
    ...(firstPage.schedules || []),
    ...remainingPages.flatMap((response) => response.schedules || []),
  ];
};

const getScheduleRoute = (schedule, routes) => routes.find((route) => String(route._id) === String(schedule?.routeId));

const getScheduleDirection = (schedule, routes) => {
  const route = getScheduleRoute(schedule, routes);
  if (!route) return { route: null, direction: null, path: [], stops: [], distance: 0, duration: 0 };
  const direction = computeDirection(schedule?.direction === 'INBOUND' ? route.inboundRoute : route.outboundRoute);
  const stops = direction.orderedStops || [];
  const path = Array.isArray(direction.polylinePath) && direction.polylinePath.length >= 2
    ? direction.polylinePath
    : stops;
  return {
    route,
    direction,
    path,
    stops,
    distance: Number(direction.estimatedDistanceKm || 0),
    duration: Number(direction.estimatedDurationMinutes || 0),
  };
};

const stopMarkerIcon = (isTerminal = false) => L.divIcon({
  className: '',
  html: `<span style="display:flex;height:${isTerminal ? 30 : 22}px;width:${isTerminal ? 30 : 22}px;align-items:center;justify-content:center;border-radius:999px;background:${isTerminal ? '#047857' : '#10b981'};border:3px solid white;box-shadow:0 8px 18px rgba(15,23,42,.25);color:white;font-size:11px;font-weight:900;">${isTerminal ? 'T' : ''}</span>`,
  iconSize: [isTerminal ? 30 : 22, isTerminal ? 30 : 22],
  iconAnchor: [isTerminal ? 15 : 11, isTerminal ? 15 : 11],
});

const RouteMap = ({ schedule, routes }) => {
  const elementRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const detail = useMemo(() => getScheduleDirection(schedule, routes), [routes, schedule]);

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
    map.fitBounds(DA_NANG_BOUNDS, { padding: [24, 24] });
    window.setTimeout(() => map.invalidateSize(), 100);
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
    const path = detail.path
      .map((point) => [Number(point.latitude), Number(point.longitude)])
      .filter(([latitude, longitude]) => isInsideDaNang(latitude, longitude));

    if (path.length >= 2) {
      L.polyline(path, {
        color: detail.route?.routeColor || '#059669',
        opacity: 0.95,
        weight: 6,
      }).addTo(layer);
    }

    detail.stops
      .filter((stop) => isInsideDaNang(stop.latitude, stop.longitude))
      .forEach((stop, index) => {
        const marker = L.marker([Number(stop.latitude), Number(stop.longitude)], {
          icon: stopMarkerIcon(index === 0 || index === detail.stops.length - 1),
          title: stop.stopName,
        });
        marker.bindPopup(`<strong>${index + 1}. ${stop.stopName || ''}</strong><br/>${stop.address || ''}`);
        marker.addTo(layer);
      });

    const boundsPoints = path.length >= 2
      ? path
      : detail.stops
        .map((stop) => [Number(stop.latitude), Number(stop.longitude)])
        .filter(([latitude, longitude]) => isInsideDaNang(latitude, longitude));
    if (boundsPoints.length >= 2) {
      mapRef.current.fitBounds(boundsPoints, { padding: [32, 32] });
    } else {
      mapRef.current.fitBounds(DA_NANG_BOUNDS, { padding: [24, 24] });
    }
    window.setTimeout(() => mapRef.current?.invalidateSize(), 100);
  }, [detail]);

  return (
    <div className="relative h-[420px] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      <div ref={elementRef} className="h-full w-full" />
      {!schedule ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/75 p-6 text-center text-sm font-semibold text-slate-500">
          Chọn một lịch chuyến để xem tuyến đường trên bản đồ.
        </div>
      ) : null}
    </div>
  );
};

const SummaryCard = ({ label, value, hint }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4">
    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
    <strong className="mt-2 block text-2xl font-black text-slate-950">{value}</strong>
    <span className="mt-1 block text-xs font-semibold text-slate-500">{hint}</span>
  </div>
);

const TripScheduleDetailPage = () => {
  useTheme('admin');
  const [routes, setRoutes] = useState([]);
  const [allSchedules, setAllSchedules] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [filters, setFilters] = useState({
    serviceDate: toDateInputValue(),
    status: '',
    routeId: '',
    search: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setMessage('');
    try {
      const [routeResponse, scheduleResponse] = await Promise.all([
        adminService.getRoutes({ limit: 200, page: 1 }),
        loadAllTripSchedules(),
      ]);
      const nextRoutes = (routeResponse.routes || routeResponse.data || []).map(normalizeRouteFromApi);
      setRoutes(nextRoutes);
      setAllSchedules(scheduleResponse);
    } catch (error) {
      setMessage(error?.message || 'Không thể tải lịch chuyến.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const schedules = useMemo(() => {
    const search = normalizeSearch(filters.search);
    return allSchedules.filter((schedule) => {
      const matchesDate = !filters.serviceDate || toDateInputValue(schedule.serviceDate) === filters.serviceDate;
      const matchesStatus = !filters.status || schedule.status === filters.status;
      const scheduleRouteId = typeof schedule.routeId === 'object' ? schedule.routeId?._id : schedule.routeId;
      const matchesRoute = !filters.routeId || String(scheduleRouteId || '') === String(filters.routeId);
      const haystack = normalizeSearch([
        schedule.scheduleCode,
        schedule.routeCode,
        schedule.routeName,
        schedule.vehicle?.busCode,
        schedule.vehicle?.plateNumber,
        schedule.driver?.fullName,
        schedule.assistant?.fullName,
      ].filter(Boolean).join(' '));
      return matchesDate && matchesStatus && matchesRoute && (!search || haystack.includes(search));
    });
  }, [allSchedules, filters.routeId, filters.search, filters.serviceDate, filters.status]);

  useEffect(() => {
    setSelectedScheduleId((current) => (
      schedules.some((schedule) => String(schedule._id) === String(current))
        ? current
        : String(schedules[0]?._id || '')
    ));
  }, [schedules]);

  const selectedSchedule = useMemo(() => (
    schedules.find((schedule) => String(schedule._id) === String(selectedScheduleId)) || null
  ), [schedules, selectedScheduleId]);
  const selectedDetail = useMemo(() => getScheduleDirection(selectedSchedule, routes), [routes, selectedSchedule]);

  const summary = useMemo(() => ({
    total: schedules.length,
    assigned: schedules.filter((schedule) => schedule.status === 'ASSIGNED').length,
    running: schedules.filter((schedule) => schedule.status === 'IN_PROGRESS').length,
    unassigned: schedules.filter((schedule) => !schedule.driver?.userId || !schedule.assistant?.userId || !schedule.vehicle?.busId).length,
  }), [schedules]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <Header />
      <main className="mx-auto w-full max-w-[1720px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Lịch chuyến</h1>
            <p className="mt-1 text-sm text-slate-500">Theo dõi từng chuyến, tuyến đường, xe khai thác và kíp vận hành.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => updateFilter('serviceDate', toDateInputValue())} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black hover:border-emerald-300">Hôm nay</button>
            <button type="button" onClick={() => setFilters({ serviceDate: '', status: '', routeId: '', search: '' })} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold hover:bg-slate-50">Xem tất cả</button>
            <button type="button" onClick={loadData} disabled={isLoading} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-black text-emerald-950 disabled:opacity-50">Tải lại</button>
          </div>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-4">
          <SummaryCard label="Tổng lịch" value={summary.total} hint={filters.serviceDate ? `Ngày ${filters.serviceDate}` : 'Tất cả ngày'} />
          <SummaryCard label="Đã phân công" value={summary.assigned} hint="Đủ xe, tài xế, phụ xe" />
          <SummaryCard label="Đang chạy" value={summary.running} hint="Theo trạng thái vận hành" />
          <SummaryCard label="Cần kiểm tra" value={summary.unassigned} hint="Thiếu xe hoặc nhân sự" />
        </div>

        <section className="mb-5 rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid gap-3 lg:grid-cols-[180px_220px_220px_minmax(220px,1fr)]">
            <label>
              <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Ngày chạy</span>
              <input type="date" value={filters.serviceDate} onChange={(event) => updateFilter('serviceDate', event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-emerald-300" />
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Trạng thái</span>
              <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-emerald-300">
                <option value="">Tất cả trạng thái</option>
                {Object.entries(scheduleStatusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Tuyến</span>
              <select value={filters.routeId} onChange={(event) => updateFilter('routeId', event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-emerald-300">
                <option value="">Tất cả tuyến</option>
                {routes.map((route) => <option key={route._id} value={route._id}>{route.routeCode} - {route.routeName}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Tìm kiếm</span>
              <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Mã lịch, tuyến, biển số, tài xế..." className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-emerald-300" />
            </label>
          </div>
        </section>

        {message ? <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{message}</div> : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(560px,0.92fr)_minmax(520px,1.08fr)]">
          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="font-black">Danh sách chuyến</h2>
                <p className="mt-1 text-xs text-slate-500">Chọn một chuyến để xem chi tiết.</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{schedules.length} lịch</span>
            </div>
            <div className="max-h-[720px] overflow-auto">
              {isLoading ? (
                <div className="p-8 text-center text-sm font-semibold text-slate-500">Đang tải lịch chuyến...</div>
              ) : schedules.length ? schedules.map((schedule) => {
                const isSelected = String(schedule._id) === String(selectedScheduleId);
                const driver = formatPerson(schedule.driver);
                const assistant = formatPerson(schedule.assistant);
                return (
                  <button
                    key={schedule._id}
                    type="button"
                    onClick={() => setSelectedScheduleId(schedule._id)}
                    className={`block w-full border-b border-slate-100 px-4 py-4 text-left transition ${isSelected ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-black text-slate-950">{schedule.scheduleCode}</span>
                        <span className="mt-1 block truncate text-xs font-semibold text-slate-500">{schedule.routeCode} - {schedule.routeName}</span>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${statusTone[schedule.status] || 'bg-slate-100 text-slate-700'}`}>{scheduleStatusLabels[schedule.status] || schedule.status}</span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                      <span><strong className="text-slate-900">{toDateInputValue(schedule.serviceDate)}</strong> | {schedule.departureTime} - {schedule.expectedArrivalTime}</span>
                      <span>{scheduleDirectionLabels[schedule.direction] || schedule.direction} | {scheduleShiftLabels[schedule.shiftLabel] || '-'}</span>
                      <span className="truncate">Xe: <strong>{schedule.vehicle?.busCode || 'Chưa gán'}</strong></span>
                      <span className="truncate">Tài xế: <strong>{driver.name}</strong></span>
                      <span className="truncate">Phụ xe: <strong>{assistant.name}</strong></span>
                    </div>
                  </button>
                );
              }) : (
                <div className="p-8 text-center text-sm font-semibold text-slate-500">Không có lịch chuyến theo bộ lọc hiện tại.</div>
              )}
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-xl font-black">Chi tiết chuyến</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedSchedule ? `${selectedSchedule.scheduleCode} | ${scheduleDirectionLabels[selectedSchedule.direction] || selectedSchedule.direction}` : 'Chưa chọn chuyến'}
                  </p>
                </div>
                {selectedSchedule ? <span className={`rounded-full px-3 py-1 text-xs font-black ${statusTone[selectedSchedule.status] || 'bg-slate-100 text-slate-700'}`}>{scheduleStatusLabels[selectedSchedule.status] || selectedSchedule.status}</span> : null}
              </div>

              {selectedSchedule ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {[
                    ['Tuyến', `${selectedSchedule.routeCode || selectedDetail.route?.routeCode || '-'} - ${selectedSchedule.routeName || selectedDetail.route?.routeName || '-'}`],
                    ['Thời gian', `${toDateInputValue(selectedSchedule.serviceDate)} | ${selectedSchedule.departureTime} - ${selectedSchedule.expectedArrivalTime}`],
                    ['Xe khai thác', `${selectedSchedule.vehicle?.busCode || 'Chưa gán'}${selectedSchedule.vehicle?.plateNumber ? ` - ${selectedSchedule.vehicle.plateNumber}` : ''}`],
                    ['Tài xế', `${formatPerson(selectedSchedule.driver).name}${formatPerson(selectedSchedule.driver).phone ? ` - ${formatPerson(selectedSchedule.driver).phone}` : ''}`],
                    ['Phụ xe', `${formatPerson(selectedSchedule.assistant).name}${formatPerson(selectedSchedule.assistant).phone ? ` - ${formatPerson(selectedSchedule.assistant).phone}` : ''}`],
                    ['Lộ trình', `${selectedDetail.stops.length} trạm | ${selectedDetail.distance || 0} km | ${selectedDetail.duration || 0} phút`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <span className="block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
                      <span className="mt-1 block text-sm font-black text-slate-950">{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500">Chọn chuyến ở danh sách để xem chi tiết.</div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-black">Bản đồ tuyến đường</h2>
                  <p className="mt-1 text-xs text-slate-500">Hiển thị đường đi và các trạm dừng của chuyến đã chọn.</p>
                </div>
                {selectedSchedule ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{selectedDetail.stops.length} trạm</span> : null}
              </div>
              <RouteMap schedule={selectedSchedule} routes={routes} />
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="font-black">Trạm dừng</h2>
              <div className="mt-3 max-h-[360px] overflow-auto rounded-lg border border-slate-200">
                {selectedDetail.stops.length ? selectedDetail.stops.map((stop, index) => (
                  <div key={`${stop.stationId || stop.stopName || index}-${index}`} className="flex gap-3 border-b border-slate-100 p-3 last:border-b-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">{index + 1}</span>
                    <div>
                      <span className="block text-sm font-black text-slate-950">{stop.stopName}</span>
                      <span className="mt-1 block text-xs text-slate-500">{stop.address}</span>
                      <span className="mt-1 block text-xs text-slate-400">
                        {Number.isFinite(Number(stop.latitude)) ? `${Number(stop.latitude).toFixed(6)}, ${Number(stop.longitude).toFixed(6)}` : 'Chưa có tọa độ'}
                      </span>
                    </div>
                  </div>
                )) : (
                  <div className="p-6 text-center text-sm font-semibold text-slate-500">Chưa có dữ liệu trạm dừng.</div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default TripScheduleDetailPage;
