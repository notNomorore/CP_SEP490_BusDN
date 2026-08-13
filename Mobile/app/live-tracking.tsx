import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import passengerApi, { type BusRoute, type BusRouteStop, type LiveBus } from '@/api/passenger.api';
import routeDiscoveryApi from '@/api/routeDiscovery.api';
import { PassengerBottomNav } from '@/components/navigation/PassengerBottomNav';
import { EmptyState, LoadingState, StatusPill } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';
import { type DeviceGpsPayload } from '@/utils/deviceGps';
import { getErrorMessage } from '@/utils/validation';

const pollingMs = 10000;
type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type SheetLevel = 'collapsed' | 'half' | 'full';
type StopState = 'completed' | 'current' | 'next' | 'pending' | 'unknown';
type RoutePanelTab = 'info' | 'schedule' | 'alerts';
type PanHandlers = ReturnType<typeof PanResponder.create>['panHandlers'];

type ProgressStop = BusRouteStop & {
  key: string;
  state: StopState;
  label: string;
};

type NotificationSubscriptionView = {
  subscriptionId: string;
  routeId?: string;
  routeNumber?: string;
  stopId?: string;
  stopName?: string;
  notificationStatus?: string;
};

const routeIdOf = (route?: BusRoute) => String(route?.id || route?._id || route?.routeNumber || '');
const normalize = (value?: string) => String(value || '').trim().toLowerCase();
const normalizeSearch = (value?: string) => normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const stopKey = (stop: BusRouteStop, index = 0) => String(stop.stopId || `${stop.order || index + 1}-${normalize(stop.name)}`);
const notificationStopId = (route: BusRoute, stop: BusRouteStop) => {
  const normalizedName = String(stop.name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${route.routeNumber}-${stop.order || 0}-${normalizedName}`;
};
const clampProgress = (value?: number) => Math.min(Math.max(Math.round(Number(value) || 0), 0), 100);
const normalizeStatus = (status?: string) => String(status || 'UNKNOWN').toUpperCase();
const isPassenger = (role?: string | null) => String(role || '').toUpperCase() === 'PASSENGER';

const escapeHtml = (value?: string) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const formatTime = (value?: string) => {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatFare = (fare?: number) => (
  typeof fare === 'number' && fare > 0
    ? `${fare.toLocaleString('vi-VN')} VND`
    : 'Chưa có giá vé'
);

const formatRouteHours = (route?: BusRoute | null) => {
  const hours = route?.operatingHours;
  if (!hours) return 'Chưa có giờ hoạt động';
  return `${hours.firstDeparture || '--:--'} - ${hours.lastDeparture || '--:--'} | mỗi ${hours.frequencyMinutes || '?'} phút`;
};

const parseClockMinutes = (value?: string) => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
};

const formatClockMinutes = (value: number) => {
  const normalized = ((value % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const buildDeparturePreview = (route: BusRoute, limit = 8) => {
  const first = parseClockMinutes(route.operatingHours?.firstDeparture);
  const last = parseClockMinutes(route.operatingHours?.lastDeparture);
  const frequency = Number(route.operatingHours?.frequencyMinutes || 0);
  if (first === null || last === null || !frequency || frequency <= 0) return [];

  const times: string[] = [];
  for (let minute = first; minute <= last && times.length < limit; minute += frequency) {
    times.push(formatClockMinutes(minute));
  }
  return times;
};

const tripStatusDisplay = (status?: string) => {
  const value = normalizeStatus(status);
  if (['ACTIVE', 'IN_PROGRESS', 'RUNNING'].includes(value)) return { label: 'Đang hoạt động', tone: 'success' as const };
  if (['SCHEDULED', 'READY'].includes(value)) return { label: 'Sắp khởi hành', tone: 'neutral' as const };
  if (['PAUSED', 'DELAYED', 'INCIDENT'].includes(value)) return { label: 'Tạm dừng hoặc trễ', tone: 'warning' as const };
  if (value === 'COMPLETED') return { label: 'Đã hoàn thành', tone: 'success' as const };
  if (value === 'CANCELLED') return { label: 'Đã hủy', tone: 'danger' as const };
  return { label: 'Chưa xác định', tone: 'neutral' as const };
};

const buildStopStates = (route: BusRoute | null, bus: LiveBus | null): ProgressStop[] => {
  const stops = [...(route?.stops || [])].sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
  const progress = bus?.tripProgress;
  const status = normalizeStatus(progress?.tripStatus || bus?.status);
  const currentIndex = typeof progress?.currentStopIndex === 'number' ? progress.currentStopIndex : -1;
  const currentName = normalize(progress?.currentStop);
  const nextName = normalize(progress?.nextStop || bus?.nextStop);
  const completedStops = new Set((progress?.completedStops || []).map((stop) => normalize(`${stop.stopOrder || ''}-${stop.stopName || stop.stopId || ''}`)));

  return stops.map((stop, index) => {
    const key = stopKey(stop, index);
    const name = normalize(stop.name);
    const completedByBackend = completedStops.has(normalize(`${stop.order || ''}-${stop.name}`)) || completedStops.has(normalize(stop.stopId));
    let state: StopState = 'pending';

    if (status === 'COMPLETED') state = 'completed';
    else if (status === 'CANCELLED') state = index < Math.max(currentIndex, 0) ? 'completed' : 'unknown';
    else if (completedByBackend || (currentIndex >= 0 && index < currentIndex)) state = 'completed';
    else if ((currentIndex >= 0 && index === currentIndex) || (currentName && name === currentName)) state = 'current';
    else if ((currentIndex >= 0 && index === currentIndex + 1) || (nextName && name === nextName)) state = 'next';

    return {
      ...stop,
      key,
      state,
      label: {
        completed: 'Đã đi qua',
        current: 'Trạm hiện tại',
        next: 'Trạm tiếp theo',
        pending: 'Chưa đến',
        unknown: 'Chưa xác định',
      }[state],
    };
  });
};

const progressFromStops = (stops: ProgressStop[], backendProgress?: number) => {
  if (backendProgress !== undefined && backendProgress !== null) return clampProgress(backendProgress);
  if (stops.length <= 1) return stops.every((stop) => stop.state === 'completed') ? 100 : 0;
  const completedSegments = stops.filter((stop) => stop.state === 'completed').length;
  return clampProgress((completedSegments / (stops.length - 1)) * 100);
};

const buildMapHtml = ({
  route,
  buses,
  activeBusId,
  selectedStopKey,
  progressStops,
  progressPercent,
  focusTarget,
  userLocation,
}: {
  route?: BusRoute | null;
  buses: LiveBus[];
  activeBusId?: string;
  selectedStopKey?: string;
  progressStops: ProgressStop[];
  progressPercent: number;
  focusTarget: 'bus' | 'stop' | 'route' | 'user';
  userLocation?: DeviceGpsPayload | null;
}) => {
  const stopMarkers = progressStops
    .filter((stop) => typeof stop.latitude === 'number' && typeof stop.longitude === 'number')
    .map((stop) => ({
      key: stop.key,
      name: escapeHtml(stop.name),
      order: stop.order,
      state: stop.state,
      selected: stop.key === selectedStopKey,
      latitude: stop.latitude,
      longitude: stop.longitude,
    }));
  const busMarkers = buses
    .filter((bus) => typeof bus.currentLocation?.latitude === 'number' && typeof bus.currentLocation?.longitude === 'number')
    .map((bus) => ({
      busId: escapeHtml(bus.busId),
      plateNumber: escapeHtml(bus.plateNumber || ''),
      tripCode: escapeHtml(bus.tripCode || bus.tripProgress?.tripCode || ''),
      status: normalizeStatus(bus.tripProgress?.tripStatus || bus.status),
      currentStop: escapeHtml(bus.tripProgress?.currentStop || ''),
      nextStop: escapeHtml(bus.nextStop || bus.tripProgress?.nextStop || ''),
      estimatedArrivalTime: escapeHtml(bus.estimatedArrivalTime || bus.tripProgress?.estimatedRemainingTime || ''),
      lastUpdated: escapeHtml(bus.lastUpdated || ''),
      active: bus.busId === activeBusId,
      latitude: bus.currentLocation?.latitude,
      longitude: bus.currentLocation?.longitude,
    }));
  const path = (route?.pathPoints?.length ? route.pathPoints : route?.stops || [])
    .filter((point) => typeof point.latitude === 'number' && typeof point.longitude === 'number')
    .map((point) => [point.latitude, point.longitude]);
  const splitIndex = Math.max(1, Math.min(path.length, Math.ceil((progressPercent / 100) * path.length)));
  const completedPath = path.slice(0, splitIndex);
  const remainingPath = path.slice(Math.max(splitIndex - 1, 0));
  const focusedStop = stopMarkers.find((stop) => stop.selected);
  const activeBus = busMarkers.find((bus) => bus.active);
  const userPoint = typeof userLocation?.latitude === 'number' && typeof userLocation?.longitude === 'number'
    ? { latitude: userLocation.latitude, longitude: userLocation.longitude }
    : null;
  const center = focusTarget === 'bus'
    ? activeBus || busMarkers[0] || focusedStop || stopMarkers[0] || { latitude: 16.047079, longitude: 108.206230 }
    : focusTarget === 'user'
      ? userPoint || activeBus || focusedStop || stopMarkers[0] || { latitude: 16.047079, longitude: 108.206230 }
      : focusTarget === 'stop'
        ? focusedStop || activeBus || busMarkers[0] || stopMarkers[0] || { latitude: 16.047079, longitude: 108.206230 }
        : focusedStop || activeBus || busMarkers[0] || stopMarkers[0] || { latitude: 16.047079, longitude: 108.206230 };

  return `
<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #ccdbf4; }
    .leaflet-control-attribution { font-size: 9px; }
    .stop { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #fff; color: #006c49; font: 900 9px system-ui; border: 2px solid #006c49; box-shadow: 0 2px 8px rgba(13,28,47,.18); }
    .stop.completed { background: #d8f6e7; color: #004532; border-color: #2ba471; }
    .stop.current { width: 34px; height: 34px; background: #6ffbbe; color: #002116; border: 3px solid #fff; }
    .stop.next { background: #d8e2ff; color: #003980; border-color: #003980; }
    .stop.selected { outline: 4px solid rgba(0,57,128,.22); }
    .bus { min-width: 42px; height: 32px; border-radius: 18px; display: flex; align-items: center; justify-content: center; padding: 0 8px; background: #006c49; color: #fff; font: 900 10px system-ui; border: 3px solid #fff; box-shadow: 0 5px 14px rgba(13,28,47,.32); }
    .bus.active { background: #003980; transform: scale(1.08); }
    .bus.delayed { background: #b7791f; }
    .user { width: 20px; height: 20px; border-radius: 50%; background: #003980; border: 4px solid #fff; box-shadow: 0 0 0 8px rgba(0,57,128,.18), 0 3px 10px rgba(13,28,47,.28); }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const stops = ${JSON.stringify(stopMarkers)};
    const buses = ${JSON.stringify(busMarkers)};
    const completedPath = ${JSON.stringify(completedPath)};
    const remainingPath = ${JSON.stringify(remainingPath)};
    const userPoint = ${JSON.stringify(userPoint)};
    const map = L.map('map', { zoomControl: false, attributionControl: true }).setView([${center.latitude}, ${center.longitude}], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    const bounds = [];
    if (remainingPath.length > 1) {
      L.polyline(remainingPath, { color: '#7f8f87', weight: 4, opacity: .55, dashArray: '7 6' }).addTo(map);
      remainingPath.forEach((point) => bounds.push(point));
    }
    if (completedPath.length > 1) {
      L.polyline(completedPath, { color: '#006c49', weight: 6, opacity: .86 }).addTo(map);
      completedPath.forEach((point) => bounds.push(point));
    }
    stops.forEach((stop) => {
      const point = [stop.latitude, stop.longitude];
      bounds.push(point);
      const size = stop.state === 'current' ? 38 : 28;
      L.marker(point, {
        icon: L.divIcon({ className: '', html: '<div class="stop ' + stop.state + (stop.selected ? ' selected' : '') + '">' + stop.order + '</div>', iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
      }).addTo(map).bindPopup(stop.name);
    });
    buses.forEach((bus) => {
      const point = [bus.latitude, bus.longitude];
      bounds.push(point);
      const delayed = ['DELAYED', 'PAUSED', 'INCIDENT'].includes(bus.status) ? ' delayed' : '';
      const active = bus.active ? ' active' : '';
      const marker = L.marker(point, {
        icon: L.divIcon({ className: '', html: '<div class="bus' + delayed + active + '">' + bus.busId + '</div>', iconSize: [56, 36], iconAnchor: [28, 18] })
      }).addTo(map);
      const statusLabel = bus.status === 'IN_PROGRESS' ? 'Đang hoạt động' : bus.status;
      const popup = '<div style="min-width:220px;line-height:1.45">'
        + '<strong style="font-size:16px;color:#003980">' + bus.busId + '</strong>'
        + '<div style="margin-top:5px"><b>Trạng thái:</b> ' + statusLabel + '</div>'
        + (bus.plateNumber ? '<div><b>Biển số:</b> ' + bus.plateNumber + '</div>' : '')
        + (bus.tripCode ? '<div><b>Mã chuyến:</b> ' + bus.tripCode + '</div>' : '')
        + (bus.currentStop ? '<div><b>Trạm hiện tại:</b> ' + bus.currentStop + '</div>' : '')
        + (bus.nextStop ? '<div><b>Trạm tiếp theo:</b> ' + bus.nextStop + '</div>' : '')
        + (bus.estimatedArrivalTime ? '<div><b>Dự kiến:</b> ' + bus.estimatedArrivalTime + '</div>' : '')
        + '<div><b>Tọa độ:</b> ' + Number(bus.latitude).toFixed(5) + ', ' + Number(bus.longitude).toFixed(5) + '</div>'
        + (bus.lastUpdated ? '<div style="color:#60746b;font-size:11px;margin-top:4px">Cập nhật: ' + bus.lastUpdated + '</div>' : '')
        + '</div>';
      marker.bindPopup(popup, { closeButton: true, autoPan: true, maxWidth: 280 });
      if (bus.active && ${JSON.stringify(focusTarget)} === 'bus') marker.openPopup();
    });
    if (userPoint) {
      const point = [userPoint.latitude, userPoint.longitude];
      bounds.push(point);
      L.marker(point, {
        icon: L.divIcon({ className: '', html: '<div class="user"></div>', iconSize: [28, 28], iconAnchor: [14, 14] })
      }).addTo(map).bindPopup('Vị trí của bạn');
    }
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [34, 34], maxZoom: 15 });
    setTimeout(() => {
      map.invalidateSize();
      if (${JSON.stringify(focusTarget)} !== 'route') {
        map.setView([${center.latitude}, ${center.longitude}], 15);
      }
    }, 120);
  </script>
</body>
</html>`;
};

export default function LiveTrackingScreen() {
  const params = useLocalSearchParams<{ routeId?: string; tripId?: string; vehicleId?: string }>();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const user = useAuthStore((state) => state.user);
  const mountedRef = useRef(true);
  const requestSeq = useRef(0);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const sheetHeightRef = useRef(0);
  const dragStartHeightRef = useRef(0);
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState(params.routeId || '');
  const [selectedBusId, setSelectedBusId] = useState('');
  const [selectedStopKey, setSelectedStopKey] = useState('');
  const [route, setRoute] = useState<BusRoute | null>(null);
  const [buses, setBuses] = useState<LiveBus[]>([]);
  const [stopSearch, setStopSearch] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [autoFollow, setAutoFollow] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [arrivalSubs, setArrivalSubs] = useState<NotificationSubscriptionView[]>([]);
  const [delaySubs, setDelaySubs] = useState<NotificationSubscriptionView[]>([]);
  const [routeChangeSubs, setRouteChangeSubs] = useState<NotificationSubscriptionView[]>([]);
  const [savingAlert, setSavingAlert] = useState('');
  const [mapFocusTarget, setMapFocusTarget] = useState<'bus' | 'stop' | 'route' | 'user'>('route');
  const [sheetLevel, setSheetLevel] = useState<SheetLevel>('collapsed');
  const [refreshedAt, setRefreshedAt] = useState('');
  const [mapFailed, setMapFailed] = useState(false);

  const bottomNavHeight = Math.max(insets.bottom, 10) + 72;
  const sheetMaxHeight = Math.max(windowHeight - insets.top - bottomNavHeight - 16, 420);
  const sheetHeights = useMemo(() => ({
    collapsed: Math.min(188, sheetMaxHeight * 0.24),
    half: sheetMaxHeight * 0.5,
    full: sheetMaxHeight * 0.78,
  }), [sheetMaxHeight]);

  const selectedRoute = route || routes.find((item) => routeIdOf(item) === selectedRouteId) || null;
  const canUsePassengerFeatures = isPassenger(user?.role);
  const selectedBus = useMemo(() => {
    if (!buses.length) return null;
    return buses.find((bus) => bus.busId === selectedBusId)
      || buses.find((bus) => bus.tripId === params.tripId || bus.vehicleId === params.vehicleId)
      || buses[0];
  }, [buses, params.tripId, params.vehicleId, selectedBusId]);
  const stopStates = useMemo(() => buildStopStates(selectedRoute, selectedBus), [selectedBus, selectedRoute]);
  const progressPercent = progressFromStops(stopStates, selectedBus?.tripProgress?.progressPercent);
  const completedCount = stopStates.filter((stop) => stop.state === 'completed').length;
  const selectedStop = stopStates.find((stop) => stop.key === selectedStopKey) || stopStates.find((stop) => stop.state === 'current') || stopStates[0] || null;
  const tripStatus = tripStatusDisplay(selectedBus?.tripProgress?.tripStatus || selectedBus?.status);
  const stale = refreshedAt ? Date.now() - new Date(refreshedAt).getTime() > pollingMs * 3 : false;
  const hasBusLocation = typeof selectedBus?.currentLocation?.latitude === 'number' && typeof selectedBus?.currentLocation?.longitude === 'number';
  const liveStatusLabel = refreshing
    ? 'ĐANG KẾT NỐI'
    : stale
      ? 'DỮ LIỆU ĐÃ CŨ'
      : hasBusLocation && autoRefresh
        ? 'ĐANG THEO DÕI TRỰC TIẾP'
        : hasBusLocation
          ? 'ĐÃ TẠM DỪNG'
          : 'CHƯA CÓ VỊ TRÍ XE';
  const filteredStops = useMemo(() => {
    const keyword = normalizeSearch(stopSearch);
    return keyword ? stopStates.filter((stop) => (
      normalizeSearch(stop.name).includes(keyword)
      || normalizeSearch(stop.stopId).includes(keyword)
      || normalizeSearch(stop.address).includes(keyword)
    )) : stopStates;
  }, [stopSearch, stopStates]);
  const mapHtml = useMemo(() => buildMapHtml({
    route: selectedRoute,
    buses,
    activeBusId: selectedBus?.busId,
    selectedStopKey: selectedStop?.key,
    progressStops: stopStates,
    progressPercent,
    focusTarget: mapFocusTarget,
    userLocation: null,
  }), [buses, mapFocusTarget, progressPercent, selectedBus?.busId, selectedRoute, selectedStop?.key, stopStates]);
  const routeDelaySub = useMemo(() => (
    selectedRoute
      ? delaySubs.find((item) => item.routeNumber === selectedRoute.routeNumber || String(item.routeId || '') === routeIdOf(selectedRoute))
      : null
  ), [delaySubs, selectedRoute]);
  const routeChangeSub = useMemo(() => (
    selectedRoute
      ? routeChangeSubs.find((item) => item.routeNumber === selectedRoute.routeNumber || String(item.routeId || '') === routeIdOf(selectedRoute))
      : null
  ), [routeChangeSubs, selectedRoute]);
  const selectedStopArrivalSub = useMemo(() => (
    selectedRoute && selectedStop
      ? arrivalSubs.find((item) => (
        item.stopId === notificationStopId(selectedRoute, selectedStop)
        || (item.routeNumber === selectedRoute.routeNumber && normalize(item.stopName) === normalize(selectedStop.name))
      ))
      : null
  ), [arrivalSubs, selectedRoute, selectedStop]);

  const snapSheet = useCallback((level: SheetLevel) => {
    setSheetLevel(level);
    sheetHeightRef.current = sheetHeights[level];
    Animated.spring(sheetAnim, {
      toValue: sheetHeights[level],
      damping: 22,
      stiffness: 190,
      mass: 0.9,
      useNativeDriver: false,
    }).start();
  }, [sheetAnim, sheetHeights]);

  const clampSheetHeight = useCallback((height: number) => (
    Math.min(Math.max(height, sheetHeights.collapsed), sheetHeights.full)
  ), [sheetHeights]);

  const getNearestSheetLevel = useCallback((height: number): SheetLevel => {
    const levels: SheetLevel[] = ['collapsed', 'half', 'full'];
    return levels.reduce((nearest, level) => (
      Math.abs(sheetHeights[level] - height) < Math.abs(sheetHeights[nearest] - height) ? level : nearest
    ), 'collapsed');
  }, [sheetHeights]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 8,
    onPanResponderGrant: () => {
      sheetAnim.stopAnimation((height) => {
        dragStartHeightRef.current = height || sheetHeights[sheetLevel];
        sheetHeightRef.current = dragStartHeightRef.current;
      });
    },
    onPanResponderMove: (_event, gesture) => {
      const nextHeight = clampSheetHeight(dragStartHeightRef.current - gesture.dy);
      sheetHeightRef.current = nextHeight;
      sheetAnim.setValue(nextHeight);
    },
    onPanResponderRelease: (_event, gesture) => {
      const projectedHeight = clampSheetHeight(sheetHeightRef.current - gesture.vy * 80);
      snapSheet(getNearestSheetLevel(projectedHeight));
    },
    onPanResponderTerminate: () => {
      snapSheet(getNearestSheetLevel(sheetHeightRef.current || sheetHeights[sheetLevel]));
    },
  }), [clampSheetHeight, getNearestSheetLevel, sheetAnim, sheetHeights, sheetLevel, snapSheet]);

  const loadRoutes = useCallback(async () => {
    const data = await passengerApi.searchRoutes();
    const nextRoutes = data.routes || [];
    if (mountedRef.current) setRoutes(nextRoutes);
    return nextRoutes;
  }, []);

  const loadNotificationSettings = useCallback(async () => {
    if (!canUsePassengerFeatures) {
      setArrivalSubs([]);
      setDelaySubs([]);
      setRouteChangeSubs([]);
      return;
    }

    try {
      const [arrival, delay, routeChange] = await Promise.all([
        routeDiscoveryApi.getArrivalNotifications(),
        routeDiscoveryApi.getDelayNotifications(),
        routeDiscoveryApi.getRouteChangeNotifications(),
      ]);
      if (!mountedRef.current) return;
      setArrivalSubs(arrival || []);
      setDelaySubs(delay || []);
      setRouteChangeSubs(routeChange || []);
    } catch {
      if (mountedRef.current) setActionMessage('Không thể tải cài đặt cảnh báo.');
    }
  }, [canUsePassengerFeatures]);

  const loadLive = useCallback(async (routeId: string, silent = false) => {
    if (!routeId) return;
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    silent ? setRefreshing(true) : setInitialLoading(true);
    setError('');

    try {
      const live = await passengerApi.getLiveTracking(routeId);
      if (!mountedRef.current || requestSeq.current !== seq) return;
      const nextBuses = live.buses || [];
      setRoute(live.route || null);
      setBuses(nextBuses);
      setRefreshedAt(live.refreshedAt || new Date().toISOString());
      setMapFailed(false);
      setSelectedBusId((current) => {
        if (nextBuses.some((bus) => bus.busId === current)) return current;
        const fromParams = nextBuses.find((bus) => bus.tripId === params.tripId || bus.vehicleId === params.vehicleId);
        return fromParams?.busId || nextBuses[0]?.busId || '';
      });
    } catch (err) {
      if (!mountedRef.current || requestSeq.current !== seq) return;
      setError((err as { message?: string })?.message || 'Không thể tải tiến trình chuyến.');
      setBuses([]);
    } finally {
      if (mountedRef.current && requestSeq.current === seq) {
        silent ? setRefreshing(false) : setInitialLoading(false);
      }
    }
  }, [params.tripId, params.vehicleId]);

  useEffect(() => {
    mountedRef.current = true;
    const init = async () => {
      try {
        const routeList = await loadRoutes();
        const firstRouteId = selectedRouteId || routeIdOf(routeList[0]);
        if (mountedRef.current) setSelectedRouteId(firstRouteId);
        if (firstRouteId) await loadLive(firstRouteId);
        else if (mountedRef.current) setInitialLoading(false);
      } catch (err) {
        if (!mountedRef.current) return;
        setError((err as { message?: string })?.message || 'Không thể tải danh sách tuyến.');
        setInitialLoading(false);
      }
    };
    void init();
    return () => {
      mountedRef.current = false;
      requestSeq.current += 1;
    };
  }, [loadLive, loadRoutes]);

  useEffect(() => {
    void loadNotificationSettings();
  }, [loadNotificationSettings, user?.id]);

  useEffect(() => {
    if (!autoRefresh || !selectedRouteId) return undefined;
    const timer = setInterval(() => {
      void loadLive(selectedRouteId, true);
    }, pollingMs);
    return () => clearInterval(timer);
  }, [autoRefresh, loadLive, selectedRouteId]);

  useEffect(() => {
    sheetHeightRef.current = sheetHeights[sheetLevel];
    sheetAnim.setValue(sheetHeights[sheetLevel]);
  }, [sheetAnim, sheetHeights, sheetLevel]);

  useEffect(() => {
    if (autoFollow && selectedBus?.currentLocation) setMapFocusTarget('bus');
  }, [autoFollow, refreshedAt, selectedBus?.busId, selectedBus?.currentLocation]);

  useEffect(() => {
    if (!selectedStopKey && stopStates.length) {
      setSelectedStopKey((stopStates.find((stop) => stop.state === 'current') || stopStates[0]).key);
    }
  }, [selectedStopKey, stopStates]);

  const chooseRoute = (nextRoute: BusRoute) => {
    const routeId = routeIdOf(nextRoute);
    setSelectedRouteId(routeId);
    setRoute(nextRoute);
    setSelectedBusId('');
    setSelectedStopKey('');
    setStopSearch('');
    setActionMessage('');
    setMapFocusTarget('route');
    void loadLive(routeId);
  };

  const chooseBus = (bus: LiveBus) => {
    setSelectedBusId(bus.busId);
    setActionMessage('');
    if (typeof bus.currentLocation?.latitude === 'number' && typeof bus.currentLocation?.longitude === 'number') {
      setMapFocusTarget('bus');
      return;
    }
    setActionMessage('Chưa có dữ liệu vị trí của xe này.');
  };

  const focusSelectedBus = () => {
    if (!selectedBus) {
      setActionMessage('Chưa chọn xe để xem vị trí.');
      return;
    }
    if (typeof selectedBus.currentLocation?.latitude !== 'number' || typeof selectedBus.currentLocation?.longitude !== 'number') {
      setActionMessage('Chưa có dữ liệu vị trí của xe này.');
      return;
    }
    setSelectedStopKey('');
    setActionMessage(`Đang focus vị trí ${selectedBus.busId}.`);
    setMapFocusTarget('bus');
  };

  const chooseStop = (stop: ProgressStop) => {
    setSelectedStopKey(stop.key);
    setActionMessage('');
    setMapFocusTarget('stop');
  };

  const requirePassenger = () => {
    if (canUsePassengerFeatures) return true;
    setActionMessage('Vui lòng đăng nhập tài khoản hành khách để dùng cảnh báo.');
    return false;
  };

  const toggleRouteAlert = async (kind: 'delay' | 'routeChange') => {
    if (!selectedRoute || !requirePassenger()) return;
    const routeId = routeIdOf(selectedRoute);
    const existing = kind === 'delay' ? routeDelaySub : routeChangeSub;
    setSavingAlert(kind);
    setActionMessage('');
    try {
      if (existing) {
        if (kind === 'delay') await routeDiscoveryApi.removeDelayNotification(existing.subscriptionId);
        else await routeDiscoveryApi.removeRouteChangeNotification(existing.subscriptionId);
        setActionMessage(kind === 'delay' ? 'Đã tắt cảnh báo trễ chuyến.' : 'Đã tắt cảnh báo thay đổi tuyến.');
      } else if (kind === 'delay') {
        await routeDiscoveryApi.subscribeDelayNotification({ routeId, routeNumber: selectedRoute.routeNumber });
        setActionMessage('Đã bật cảnh báo trễ chuyến.');
      } else {
        await routeDiscoveryApi.subscribeRouteChangeNotification({ routeId, routeNumber: selectedRoute.routeNumber });
        setActionMessage('Đã bật cảnh báo thay đổi tuyến.');
      }
      await loadNotificationSettings();
    } catch (err) {
      setActionMessage(getErrorMessage(err, 'Không thể cập nhật cảnh báo.'));
    } finally {
      setSavingAlert('');
    }
  };

  const toggleArrivalAlert = async () => {
    if (!selectedRoute || !selectedStop || !requirePassenger()) return;
    const routeId = routeIdOf(selectedRoute);
    const stopId = notificationStopId(selectedRoute, selectedStop);
    setSavingAlert('arrival');
    setActionMessage('');
    try {
      if (selectedStopArrivalSub) {
        await routeDiscoveryApi.removeArrivalNotification(selectedStopArrivalSub.subscriptionId);
        setActionMessage('Đã tắt cảnh báo xe đến cho trạm đang chọn.');
      } else {
        await routeDiscoveryApi.subscribeArrivalNotification({
          routeId,
          routeNumber: selectedRoute.routeNumber,
          stopId,
          stopName: selectedStop.name,
          order: selectedStop.order,
          address: selectedStop.address || selectedStop.name,
          etaThresholdMinutes: 5,
        });
        setActionMessage('Đã bật cảnh báo xe đến cho trạm đang chọn.');
      }
      await loadNotificationSettings();
    } catch (err) {
      setActionMessage(getErrorMessage(err, 'Không thể cập nhật cảnh báo xe đến.'));
    } finally {
      setSavingAlert('');
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.screen}>
        <TripHeader
          refreshing={refreshing}
          routeNumber={selectedRoute?.routeNumber}
          onBack={() => router.canGoBack() ? router.back() : router.replace('/route-search')}
          onRefresh={() => selectedRouteId && loadLive(selectedRouteId, true)}
        />

        <View style={styles.mapShell}>
          {initialLoading ? <LoadingState label="Đang tải tiến trình chuyến" /> : null}
          {!initialLoading && error ? (
            <View style={styles.errorLayer}>
              <EmptyState icon="alert-circle-outline" title="Không tải được tiến trình" detail={error} />
              <Pressable onPress={() => selectedRouteId && loadLive(selectedRouteId)} style={styles.retryButton}>
                <Text style={styles.retryText}>Thử lại</Text>
              </Pressable>
            </View>
          ) : null}
          {!initialLoading && !error ? (
            <MapSection
              autoRefresh={autoRefresh}
              liveStatusLabel={liveStatusLabel}
              mapFailed={mapFailed}
              mapHtml={mapHtml}
              stale={stale}
              onError={() => setMapFailed(true)}
            />
          ) : null}
          {!initialLoading && !error ? (
            <RouteChips routes={routes} selectedRoute={selectedRoute} selectedRouteId={selectedRouteId} onChooseRoute={chooseRoute} />
          ) : null}
          {!initialLoading && !error && selectedRoute ? (
            <SelectedRouteLegend route={selectedRoute} />
          ) : null}
          {!initialLoading && !error ? (
            <FloatingMapButtons
              autoFollow={autoFollow}
              canFollowBus={hasBusLocation}
              onFollowBus={focusSelectedBus}
              onOpenInfo={() => snapSheet('half')}
              onToggleFollow={() => {
                const next = !autoFollow;
                setAutoFollow(next);
                if (next) focusSelectedBus();
              }}
            />
          ) : null}
        </View>

        {actionMessage ? (
          <View style={[styles.messageToast, { bottom: bottomNavHeight + 10 }]}>
            <MaterialCommunityIcons color={colors.secondary} name="information-outline" size={18} />
            <Text style={styles.messageText}>{actionMessage}</Text>
          </View>
        ) : null}

        {!initialLoading && !error ? (
          <TripBottomSheet
            autoFollow={autoFollow}
            autoRefresh={autoRefresh}
            arrivalEnabled={Boolean(selectedStopArrivalSub)}
            bottomOffset={bottomNavHeight}
            buses={buses}
            completedCount={completedCount}
            delayEnabled={Boolean(routeDelaySub)}
            filteredStops={filteredStops}
            panHandlers={panResponder.panHandlers}
            progressPercent={progressPercent}
            refreshing={refreshing}
            routeChangeEnabled={Boolean(routeChangeSub)}
            savingAlert={savingAlert}
            selectedBus={selectedBus}
            selectedRoute={selectedRoute}
            selectedStop={selectedStop}
            sheetAnim={sheetAnim}
            sheetLevel={sheetLevel}
            stale={stale}
            stopSearch={stopSearch}
            stopStates={stopStates}
            tripStatus={tripStatus}
            updatedAt={refreshedAt}
            onChooseBus={chooseBus}
            onChooseStop={chooseStop}
            onFocusBus={focusSelectedBus}
            onPurchaseTicket={() => {
              if (!selectedRoute) return;
              router.push(`/buy-oneway-ticket?routeId=${encodeURIComponent(routeIdOf(selectedRoute))}`);
            }}
            onRefresh={() => selectedRouteId && loadLive(selectedRouteId, true)}
            onSetAutoFollow={setAutoFollow}
            onSetAutoRefresh={setAutoRefresh}
            onSetStopSearch={setStopSearch}
            onToggleArrivalAlert={toggleArrivalAlert}
            onToggleDelayAlert={() => void toggleRouteAlert('delay')}
            onToggleRouteChangeAlert={() => void toggleRouteAlert('routeChange')}
          />
        ) : null}

        <PassengerBottomNav active="tracking" />
      </View>
    </SafeAreaView>
  );
}

function SelectedRouteLegend({ route }: { route: BusRoute }) {
  return (
    <View pointerEvents="none" style={styles.selectedRouteLegend}>
      <View style={styles.legendTitleRow}>
        <View style={styles.legendRouteBadge}>
          <Text style={styles.legendRouteText}>{route.routeNumber}</Text>
        </View>
        <View style={styles.legendLine} />
        <Text numberOfLines={1} style={styles.legendTitle}>Tuyến đường đã chọn</Text>
      </View>
    </View>
  );
}

function TripHeader({ onBack, onRefresh, refreshing, routeNumber }: { onBack: () => void; onRefresh: () => void; refreshing: boolean; routeNumber?: string }) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityLabel="Quay lại" hitSlop={8} onPress={onBack} style={styles.headerButton}>
        <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={30} />
      </Pressable>
      <View style={styles.headerCopy}>
        <Text style={styles.headerTitle}>Tiến trình chuyến</Text>
        <Text style={styles.headerSubtitle}>{routeNumber ? `Tuyến ${routeNumber}` : 'Chọn tuyến'}</Text>
      </View>
      <Pressable accessibilityLabel="Cập nhật" hitSlop={8} onPress={onRefresh} style={styles.headerButton}>
        {refreshing ? <ActivityIndicator color={colors.primary} size="small" /> : <MaterialCommunityIcons color={colors.primary} name="refresh" size={29} />}
      </Pressable>
    </View>
  );
}

function RouteChips({ routes, selectedRoute, selectedRouteId, onChooseRoute }: { routes: BusRoute[]; selectedRoute: BusRoute | null; selectedRouteId: string; onChooseRoute: (route: BusRoute) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.routeStrip} horizontal showsHorizontalScrollIndicator={false} style={styles.routeScroller}>
      {routes.slice(0, 12).map((item) => {
        const id = routeIdOf(item);
        const active = id === selectedRouteId || item.routeNumber === selectedRoute?.routeNumber;
        return (
          <Pressable accessibilityRole="button" key={id} onPress={() => onChooseRoute(item)} style={[styles.routeChip, active && styles.routeChipActive]}>
            <Text style={[styles.routeChipText, active && styles.routeChipTextActive]}>{item.routeNumber}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function MapSection({
  autoRefresh,
  liveStatusLabel,
  mapFailed,
  mapHtml,
  stale,
  onError,
}: {
  autoRefresh: boolean;
  liveStatusLabel: string;
  mapFailed: boolean;
  mapHtml: string;
  stale: boolean;
  onError: () => void;
}) {
  return (
    <View style={styles.mapCard}>
      {!mapFailed ? (
        <WebView
          javaScriptEnabled
          onError={onError}
          originWhitelist={['*']}
          source={{ html: mapHtml }}
          style={styles.webMap}
        />
      ) : (
        <View style={styles.mapFallback}>
          <MaterialCommunityIcons color={colors.secondary} name="map-outline" size={34} />
          <Text style={styles.mapFallbackText}>Không tải được bản đồ. Kiểm tra mạng rồi cập nhật lại.</Text>
        </View>
      )}
      <View pointerEvents="none" style={styles.mapTopOverlay}>
        <View style={[styles.liveDot, (!autoRefresh || stale) && styles.liveDotPaused]} />
        <Text style={styles.mapTopText}>{liveStatusLabel}</Text>
      </View>
    </View>
  );
}

function FloatingMapButtons({
  autoFollow,
  canFollowBus,
  onFollowBus,
  onOpenInfo,
  onToggleFollow,
}: {
  autoFollow: boolean;
  canFollowBus: boolean;
  onFollowBus: () => void;
  onOpenInfo: () => void;
  onToggleFollow: () => void;
}) {
  return (
    <View pointerEvents="box-none" style={styles.floatingButtons}>
      <Pressable accessibilityLabel="Vị trí xe đang chọn" onPress={onFollowBus} style={[styles.mapFab, !canFollowBus && styles.disabledButton]}>
        <MaterialCommunityIcons color={colors.primary} name="crosshairs-gps" size={21} />
      </Pressable>
      <Pressable accessibilityLabel="Bật tắt tự theo dõi xe" onPress={onToggleFollow} style={[styles.mapFab, autoFollow && styles.mapFabPrimary]}>
        <MaterialCommunityIcons color={autoFollow ? colors.white : colors.primary} name="navigation-variant" size={21} />
      </Pressable>
      <Pressable accessibilityLabel="Mở thông tin xe" onPress={onOpenInfo} style={[styles.mapFab, styles.mapFabPrimary]}>
        <MaterialCommunityIcons color={colors.white} name="bus-marker" size={21} />
      </Pressable>
    </View>
  );
}

function TripBottomSheet({
  autoFollow,
  autoRefresh,
  arrivalEnabled,
  bottomOffset,
  buses,
  completedCount,
  delayEnabled,
  filteredStops,
  panHandlers,
  progressPercent,
  refreshing,
  routeChangeEnabled,
  savingAlert,
  selectedBus,
  selectedRoute,
  selectedStop,
  sheetAnim,
  sheetLevel,
  stale,
  stopSearch,
  stopStates,
  tripStatus,
  updatedAt,
  onChooseBus,
  onChooseStop,
  onFocusBus,
  onPurchaseTicket,
  onRefresh,
  onSetAutoFollow,
  onSetAutoRefresh,
  onSetStopSearch,
  onToggleArrivalAlert,
  onToggleDelayAlert,
  onToggleRouteChangeAlert,
}: {
  autoFollow: boolean;
  autoRefresh: boolean;
  arrivalEnabled: boolean;
  bottomOffset: number;
  buses: LiveBus[];
  completedCount: number;
  delayEnabled: boolean;
  filteredStops: ProgressStop[];
  panHandlers: PanHandlers;
  progressPercent: number;
  refreshing: boolean;
  routeChangeEnabled: boolean;
  savingAlert: string;
  selectedBus: LiveBus | null;
  selectedRoute: BusRoute | null;
  selectedStop: ProgressStop | null;
  sheetAnim: Animated.Value;
  sheetLevel: SheetLevel;
  stale: boolean;
  stopSearch: string;
  stopStates: ProgressStop[];
  tripStatus: ReturnType<typeof tripStatusDisplay>;
  updatedAt?: string;
  onChooseBus: (bus: LiveBus) => void;
  onChooseStop: (stop: ProgressStop) => void;
  onFocusBus: () => void;
  onPurchaseTicket: () => void;
  onRefresh: () => void;
  onSetAutoFollow: (value: boolean) => void;
  onSetAutoRefresh: (value: boolean) => void;
  onSetStopSearch: (value: string) => void;
  onToggleArrivalAlert: () => void;
  onToggleDelayAlert: () => void;
  onToggleRouteChangeAlert: () => void;
}) {
  return (
    <Animated.View style={[styles.bottomSheet, { bottom: bottomOffset, height: sheetAnim }]}>
      <View {...panHandlers} accessibilityLabel="Kéo để mở rộng hoặc thu gọn bảng thông tin" style={styles.sheetHandleWrap}>
        <View style={styles.sheetHandle} />
      </View>
      <View style={styles.sheetContent}>
        {sheetLevel === 'collapsed' ? (
          <BusInfoCard
            compact
            completedCount={completedCount}
            progressPercent={progressPercent}
            selectedBus={selectedBus}
            selectedRoute={selectedRoute}
            stopCount={stopStates.length}
            tripStatus={tripStatus}
            updatedAt={updatedAt}
          />
        ) : null}

        {sheetLevel !== 'collapsed' ? (
          <ScrollView
            contentContainerStyle={styles.sheetScrollContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={styles.sheetScroll}
          >
            <RouteSyncPanel
              arrivalEnabled={arrivalEnabled}
              delayEnabled={delayEnabled}
              routeChangeEnabled={routeChangeEnabled}
              savingAlert={savingAlert}
              selectedRoute={selectedRoute}
              selectedStop={selectedStop}
              onPurchaseTicket={onPurchaseTicket}
              onToggleArrivalAlert={onToggleArrivalAlert}
              onToggleDelayAlert={onToggleDelayAlert}
              onToggleRouteChangeAlert={onToggleRouteChangeAlert}
            />
            <BusInfoCard
              completedCount={completedCount}
              progressPercent={progressPercent}
              selectedBus={selectedBus}
              selectedRoute={selectedRoute}
              stopCount={stopStates.length}
              tripStatus={tripStatus}
              updatedAt={updatedAt}
            />
            <View style={styles.sheetActions}>
              <Pressable onPress={() => onSetAutoRefresh(!autoRefresh)} style={[styles.actionButton, autoRefresh && styles.actionButtonActive]}>
                <MaterialCommunityIcons color={autoRefresh ? colors.white : colors.secondary} name={autoRefresh ? 'pause-circle' : 'play-circle'} size={17} />
                <Text style={[styles.actionText, autoRefresh && styles.actionTextActive]}>{autoRefresh ? 'Tự cập nhật' : 'Tạm dừng'}</Text>
              </Pressable>
              <Pressable onPress={() => onSetAutoFollow(!autoFollow)} style={[styles.actionButton, autoFollow && styles.actionButtonActive]}>
                <MaterialCommunityIcons color={autoFollow ? colors.white : colors.secondary} name="navigation-variant" size={17} />
                <Text style={[styles.actionText, autoFollow && styles.actionTextActive]}>{autoFollow ? 'Tự theo dõi' : 'Tự do xem'}</Text>
              </Pressable>
              <Pressable onPress={onFocusBus} style={styles.actionButton}>
                <MaterialCommunityIcons color={colors.secondary} name="crosshairs-gps" size={17} />
                <Text style={styles.actionText}>Vị trí xe</Text>
              </Pressable>
              <Pressable onPress={onRefresh} style={styles.actionButton}>
                {refreshing ? <ActivityIndicator color={colors.secondary} size="small" /> : <MaterialCommunityIcons color={colors.secondary} name="refresh" size={17} />}
                <Text style={styles.actionText}>Cập nhật</Text>
              </Pressable>
            </View>
            {stale ? (
              <View style={styles.warningBox}>
                <MaterialCommunityIcons color="#6f5200" name="wifi-alert" size={18} />
                <Text style={styles.warningText}>Dữ liệu realtime có thể đã cũ. Bấm Cập nhật để tải lại.</Text>
              </View>
            ) : null}
            {buses.length ? <BusSelector buses={buses} selectedBus={selectedBus} onChooseBus={onChooseBus} /> : <EmptyState icon="bus-alert" title="Chưa có xe đang hoạt động" detail="Thử làm mới hoặc chọn tuyến khác." />}

            {sheetLevel === 'full' ? (
              <View style={styles.fullContent}>
                <StopSearch stopSearch={stopSearch} onSetStopSearch={onSetStopSearch} />
                <StopTimeline
                  filteredStops={filteredStops}
                  selectedStop={selectedStop}
                  stopStates={stopStates}
                  onChooseStop={onChooseStop}
                />
              </View>
            ) : null}
          </ScrollView>
        ) : null}
      </View>
    </Animated.View>
  );
}

function RouteSyncPanel({
  arrivalEnabled,
  delayEnabled,
  routeChangeEnabled,
  savingAlert,
  selectedRoute,
  selectedStop,
  onPurchaseTicket,
  onToggleArrivalAlert,
  onToggleDelayAlert,
  onToggleRouteChangeAlert,
}: {
  arrivalEnabled: boolean;
  delayEnabled: boolean;
  routeChangeEnabled: boolean;
  savingAlert: string;
  selectedRoute: BusRoute | null;
  selectedStop: ProgressStop | null;
  onPurchaseTicket: () => void;
  onToggleArrivalAlert: () => void;
  onToggleDelayAlert: () => void;
  onToggleRouteChangeAlert: () => void;
}) {
  const [activeTab, setActiveTab] = useState<RoutePanelTab>('info');
  const departurePreview = selectedRoute ? buildDeparturePreview(selectedRoute) : [];
  const hasScheduleConfig = Boolean(
    selectedRoute?.operatingHours?.firstDeparture
    && selectedRoute.operatingHours?.lastDeparture
    && selectedRoute.operatingHours?.frequencyMinutes
  );
  const tabs: Array<{ key: RoutePanelTab; label: string }> = [
    { key: 'info', label: 'Thông tin' },
    { key: 'schedule', label: 'Lịch chạy' },
    { key: 'alerts', label: 'Cảnh báo' },
  ];

  if (!selectedRoute) return null;

  return (
    <View style={styles.routeSyncPanel}>
      <View style={styles.routeSummaryHeader}>
        <View style={styles.routeCodeSmall}>
          <Text style={styles.routeCodeSmallText}>{selectedRoute.routeNumber}</Text>
        </View>
        <View style={styles.routeSummaryCopy}>
          <Text numberOfLines={1} style={styles.routeSummaryTitle}>{selectedRoute.name}</Text>
          <Text numberOfLines={1} style={styles.routeSummaryMeta}>{selectedRoute.origin} đến {selectedRoute.destination}</Text>
        </View>
        <StatusPill label={selectedRoute.status || 'Đang hoạt động'} tone="success" />
      </View>

      <View style={styles.detailTabs}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={[styles.detailTab, active && styles.detailTabActive]}>
              <Text style={[styles.detailTabText, active && styles.detailTabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === 'info' ? (
        <>
          <View style={styles.routeMetricGrid}>
            <InfoBlock icon="clock-outline" label="Thời gian" value={`${selectedRoute.estimatedDurationMinutes || '?'} phút`} />
            <InfoBlock icon="map-marker-distance" label="Quãng đường" value={`${selectedRoute.distanceKm || '?'} km`} />
          </View>
          <View style={styles.ticketPanel}>
            <View style={styles.ticketCopy}>
              <Text style={styles.ticketTitle}>Vé xe buýt</Text>
              <Text style={styles.ticketText}>Mua vé một lượt cho tuyến đang chọn.</Text>
            </View>
            <Text style={styles.fareBadge}>{formatFare(selectedRoute.fare)}</Text>
          </View>
          <Pressable onPress={onPurchaseTicket} style={styles.buyTicketButton}>
            <MaterialCommunityIcons color={colors.white} name="ticket-confirmation-outline" size={18} />
            <Text style={styles.buyTicketText}>Mua vé</Text>
          </Pressable>
        </>
      ) : null}

      {activeTab === 'schedule' ? (
        <View style={styles.schedulePanel}>
          <View style={styles.scheduleGrid}>
            <ScheduleStatCard icon="clock-start" label="Chuyến đầu" value={selectedRoute.operatingHours?.firstDeparture || '--:--'} />
            <ScheduleStatCard icon="clock-end" label="Chuyến cuối" value={selectedRoute.operatingHours?.lastDeparture || '--:--'} />
            <ScheduleStatCard icon="timer-outline" label="Tần suất" value={selectedRoute.operatingHours?.frequencyMinutes ? `${selectedRoute.operatingHours.frequencyMinutes} phút` : 'Chưa có'} />
            <ScheduleStatCard icon="map-clock-outline" label="Thời lượng" value={`${selectedRoute.estimatedDurationMinutes || '?'} phút`} />
          </View>

          <View style={styles.departureCard}>
            <View style={styles.departureHeader}>
              <View>
                <Text style={styles.departureTitle}>Khung giờ khởi hành</Text>
                <Text style={styles.departureMeta}>{formatRouteHours(selectedRoute)}</Text>
              </View>
              <MaterialCommunityIcons color={colors.accent} name="calendar-clock" size={20} />
            </View>
            {departurePreview.length ? (
              <View style={styles.departureTimes}>
                {departurePreview.map((time) => (
                  <Text key={time} style={styles.departureTimePill}>{time}</Text>
                ))}
              </View>
            ) : (
              <View style={styles.scheduleEmptyRow}>
                <MaterialCommunityIcons color={colors.secondary} name="calendar-remove-outline" size={18} />
                <Text style={styles.scheduleEmptyText}>Tuyến này chưa có đủ cấu hình giờ chạy để hiển thị danh sách giờ.</Text>
              </View>
            )}
          </View>

          <View style={[styles.scheduleNote, !hasScheduleConfig && styles.scheduleWarningNote]}>
            <MaterialCommunityIcons color={hasScheduleConfig ? colors.secondary : '#8a5a00'} name={hasScheduleConfig ? 'information-outline' : 'alert-circle-outline'} size={18} />
            <Text style={[styles.scheduleNoteText, !hasScheduleConfig && styles.scheduleWarningText]}>
              {hasScheduleConfig
                ? 'Lịch chạy được lấy từ cấu hình tuyến trên hệ thống BusDN. Giờ thực tế có thể thay đổi theo điều hành.'
                : 'Thiếu cấu hình giờ chạy. Vui lòng kiểm tra lại phần vận hành tuyến trên hệ thống quản trị.'}
            </Text>
          </View>
        </View>
      ) : null}

      {activeTab === 'alerts' ? (
        <View style={styles.notificationPanel}>
          <View style={styles.notificationPanelHeader}>
            <MaterialCommunityIcons color={colors.accent} name="bell-outline" size={18} />
            <Text style={styles.notificationPanelTitle}>Cài đặt cảnh báo chuyến đi</Text>
          </View>
          <AlertSettingRow
            detail={selectedStop ? `Nhận cảnh báo khi xe gần đến ${selectedStop.name}.` : 'Chọn một trạm trong lộ trình để bật cảnh báo xe đến.'}
            disabled={!selectedStop || savingAlert !== ''}
            label="Cảnh báo xe buýt đến"
            loading={savingAlert === 'arrival'}
            onValueChange={onToggleArrivalAlert}
            value={arrivalEnabled}
          />
          <AlertSettingRow
            detail="Thông báo khi xe buýt trên tuyến này trễ ngoài lịch trình dự kiến."
            disabled={savingAlert !== ''}
            label="Cảnh báo trễ"
            loading={savingAlert === 'delay'}
            onValueChange={onToggleDelayAlert}
            value={delayEnabled}
          />
          <AlertSettingRow
            detail="Thông báo khi tuyến có đổi đường, đổi trạm hoặc cập nhật tạm thời."
            disabled={savingAlert !== ''}
            label="Cảnh báo thay đổi tuyến"
            loading={savingAlert === 'routeChange'}
            onValueChange={onToggleRouteChangeAlert}
            value={routeChangeEnabled}
          />
        </View>
      ) : null}
    </View>
  );
}

function AlertSettingRow({
  detail,
  disabled,
  label,
  loading,
  onValueChange,
  value,
}: {
  detail: string;
  disabled?: boolean;
  label: string;
  loading: boolean;
  onValueChange: () => void;
  value: boolean;
}) {
  return (
    <View style={styles.alertSettingRow}>
      <View style={styles.alertSettingCopy}>
        <Text style={styles.alertSettingLabel}>{label}</Text>
        <Text style={styles.alertSettingDetail}>{detail}</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Switch disabled={disabled} onValueChange={onValueChange} value={value} />
      )}
    </View>
  );
}

function ScheduleStatCard({ icon, label, value }: { icon: MaterialIconName; label: string; value: string }) {
  return (
    <View style={styles.scheduleStatCard}>
      <View style={styles.scheduleStatIcon}>
        <MaterialCommunityIcons color={colors.secondary} name={icon} size={16} />
      </View>
      <View style={styles.scheduleStatCopy}>
        <Text style={styles.scheduleStatLabel}>{label}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={styles.scheduleStatValue}>{value}</Text>
      </View>
    </View>
  );
}

function BusInfoCard({ compact = false, completedCount, progressPercent, selectedBus, selectedRoute, stopCount, tripStatus, updatedAt }: { compact?: boolean; completedCount: number; progressPercent: number; selectedBus: LiveBus | null; selectedRoute: BusRoute | null; stopCount: number; tripStatus: ReturnType<typeof tripStatusDisplay>; updatedAt?: string }) {
  const currentStop = selectedBus?.tripProgress?.currentStop || 'Chưa xác định';
  const nextStop = selectedBus?.tripProgress?.nextStop || selectedBus?.nextStop || 'Chưa xác định';
  return (
    <View style={[styles.busInfoCard, compact && styles.busInfoCardCompact]}>
      <View style={styles.tripHeader}>
        <View style={[styles.busIcon, compact && styles.busIconCompact]}>
          <MaterialCommunityIcons color={colors.primary} name="bus" size={compact ? 18 : 22} />
        </View>
        <View style={styles.tripCopy}>
          <Text numberOfLines={1} style={[styles.tripTitle, compact && styles.tripTitleCompact]}>{selectedBus?.busId || 'Chưa có xe đang chạy'}</Text>
          <Text numberOfLines={1} style={[styles.tripMeta, compact && styles.tripMetaCompact]}>{selectedRoute ? `${selectedRoute.origin} đến ${selectedRoute.destination}` : 'Chọn tuyến để theo dõi'}</Text>
        </View>
        <StatusPill label={tripStatus.label} tone={tripStatus.tone} />
      </View>
      <View style={[styles.progressLine, compact && styles.progressLineCompact]}>
        <Text style={[styles.progressTitle, compact && styles.progressTitleCompact]}>{progressPercent}%</Text>
        <Text style={[styles.progressMeta, compact && styles.progressMetaCompact]}>{completedCount}/{stopCount} trạm</Text>
        <Text style={[styles.lastUpdated, compact && styles.lastUpdatedCompact]}>{formatTime(updatedAt)}</Text>
      </View>
      <View style={[styles.progressTrack, compact && styles.progressTrackCompact]}>
        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
      </View>
      {compact ? (
        <View style={styles.compactStopLine}>
          <MaterialCommunityIcons color={colors.secondary} name="near-me" size={15} />
          <Text numberOfLines={1} style={styles.compactStopText}>Hiện tại: {currentStop}</Text>
          <MaterialCommunityIcons color={colors.secondary} name="map-marker-path" size={15} />
          <Text numberOfLines={1} style={styles.compactStopText}>Tiếp theo: {nextStop}</Text>
        </View>
      ) : (
        <View style={styles.sheetGrid}>
          <InfoBlock icon="near-me" label="Trạm hiện tại" value={currentStop} />
          <InfoBlock icon="map-marker-path" label="Trạm tiếp theo" value={nextStop} />
        </View>
      )}
    </View>
  );
}

function BusSelector({ buses, selectedBus, onChooseBus }: { buses: LiveBus[]; selectedBus: LiveBus | null; onChooseBus: (bus: LiveBus) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.busStrip} horizontal showsHorizontalScrollIndicator={false}>
      {buses.map((bus) => {
        const active = bus.busId === selectedBus?.busId;
        const status = tripStatusDisplay(bus.tripProgress?.tripStatus || bus.status);
        return (
          <Pressable key={bus.busId} onPress={() => onChooseBus(bus)} style={[styles.busChip, active && styles.busChipActive]}>
            <MaterialCommunityIcons color={active ? colors.white : colors.primary} name="bus" size={17} />
            <View style={styles.busChipCopy}>
              <Text style={[styles.busChipText, active && styles.busChipTextActive]}>{bus.busId}</Text>
              <Text style={[styles.busChipMeta, active && styles.busChipTextActive]}>{status.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function StopSearch({ stopSearch, onSetStopSearch }: { stopSearch: string; onSetStopSearch: (value: string) => void }) {
  return (
    <View style={styles.searchBox}>
      <MaterialCommunityIcons color={colors.secondary} name="magnify" size={20} />
      <TextInput
        accessibilityLabel="Tìm trạm trong chuyến"
        editable
        onChangeText={onSetStopSearch}
        placeholder="Tìm trạm trong lộ trình..."
        placeholderTextColor={colors.secondary}
        returnKeyType="search"
        style={styles.searchInput}
        value={stopSearch}
      />
      {stopSearch ? (
        <Pressable accessibilityLabel="Xóa từ khóa tìm kiếm" hitSlop={8} onPress={() => onSetStopSearch('')}>
          <MaterialCommunityIcons color={colors.secondary} name="close-circle" size={20} />
        </Pressable>
      ) : null}
    </View>
  );
}

function StopTimeline({ filteredStops, selectedStop, stopStates, onChooseStop }: { filteredStops: ProgressStop[]; selectedStop: ProgressStop | null; stopStates: ProgressStop[]; onChooseStop: (stop: ProgressStop) => void }) {
  return (
    <View style={styles.timelineCard}>
      <View style={styles.timelineHeader}>
        <Text style={styles.sectionTitle}>Danh sách trạm</Text>
        <Text style={styles.timelineCount}>{filteredStops.length}/{stopStates.length}</Text>
      </View>
      {!stopStates.length ? <EmptyState icon="map-marker-off-outline" title="Tuyến chưa có danh sách trạm" detail="Không thể hiển thị tiến trình nếu tuyến thiếu trạm." /> : null}
      {stopStates.length > 0 && !filteredStops.length ? <EmptyState icon="magnify-close" title="Không tìm thấy trạm" detail="Xóa hoặc đổi từ khóa để xem lại danh sách trạm." /> : null}
      <ScrollView style={styles.timelineScroll} showsVerticalScrollIndicator={false}>
        {filteredStops.map((stop, index) => (
          <ProgressStopRow
            active={stop.key === selectedStop?.key}
            first={index === 0}
            key={stop.key}
            last={index === filteredStops.length - 1}
            onPress={() => onChooseStop(stop)}
            stop={stop}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function InfoBlock({ icon, label, value }: { icon: MaterialIconName; label: string; value: string }) {
  return (
    <View style={styles.infoBlock}>
      <View style={styles.infoIcon}>
        <MaterialCommunityIcons color={colors.secondary} name={icon} size={17} />
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text numberOfLines={2} style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function ProgressStopRow({ active, first, last, onPress, stop }: { active: boolean; first: boolean; last: boolean; onPress: () => void; stop: ProgressStop }) {
  const tone = {
    completed: { icon: 'check-circle' as MaterialIconName, color: colors.accent, bg: '#dff7ea' },
    current: { icon: 'navigation-variant' as MaterialIconName, color: colors.primaryContainer, bg: '#a9f5cd' },
    next: { icon: 'map-marker' as MaterialIconName, color: '#003980', bg: '#d8e2ff' },
    pending: { icon: 'circle-outline' as MaterialIconName, color: colors.secondary, bg: colors.surfaceLow },
    unknown: { icon: 'help-circle-outline' as MaterialIconName, color: colors.muted, bg: colors.surfaceHigh },
  }[stop.state];

  return (
    <Pressable onPress={onPress} style={[styles.stopRow, active && styles.stopRowActive]}>
      <View style={styles.stopRail}>
        {!first ? <View style={[styles.railLine, styles.railLineTop]} /> : null}
        <View style={[styles.stopNode, { backgroundColor: tone.bg }]}>
          <MaterialCommunityIcons color={tone.color} name={tone.icon} size={18} />
        </View>
        {!last ? <View style={[styles.railLine, styles.railLineBottom]} /> : null}
      </View>
      <View style={styles.stopCopy}>
        <View style={styles.stopTitleRow}>
          <Text numberOfLines={1} style={styles.stopTitle}>{stop.order ? `${stop.order}. ` : ''}{stop.name}</Text>
          <Text style={[styles.stopBadge, stop.state === 'current' && styles.stopBadgeCurrent]}>{stop.label}</Text>
        </View>
        <Text numberOfLines={1} style={styles.stopMeta}>{stop.address || stop.stopId || 'Chưa có địa chỉ'}</Text>
      </View>
    </Pressable>
  );
}

const shadow = {
  elevation: 6,
  shadowColor: '#0d1c2f',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.12,
  shadowRadius: 18,
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    alignItems: 'center',
    backgroundColor: 'rgba(242,252,248,0.97)',
    flexDirection: 'row',
    gap: 10,
    height: 68,
    paddingHorizontal: 16,
    zIndex: 20,
  },
  headerButton: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.outline,
    borderRadius: 21,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 3,
  },
  routeScroller: {
    left: 0,
    maxHeight: 42,
    position: 'absolute',
    right: 0,
    top: 10,
    zIndex: 24,
  },
  routeStrip: {
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
  },
  routeChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(216,232,255,0.96)',
    borderRadius: 16,
    height: 34,
    justifyContent: 'center',
    minWidth: 66,
    paddingHorizontal: 12,
  },
  routeChipActive: {
    backgroundColor: colors.primaryContainer,
  },
  routeChipText: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '900',
  },
  routeChipTextActive: {
    color: colors.white,
  },
  selectedRouteLegend: {
    ...shadow,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderColor: 'rgba(15,23,42,0.08)',
    borderRadius: 999,
    borderWidth: 1,
    left: 14,
    maxWidth: 258,
    paddingHorizontal: 10,
    paddingVertical: 8,
    position: 'absolute',
    top: 58,
    zIndex: 23,
  },
  legendTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  legendRouteBadge: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  legendRouteText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  legendTitle: {
    color: colors.primary,
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
  },
  legendLineRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  legendLine: {
    backgroundColor: '#34d399',
    borderColor: colors.primary,
    borderRadius: 999,
    borderWidth: 2,
    height: 7,
    width: 34,
  },
  legendLineText: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '800',
  },
  mapShell: {
    backgroundColor: '#ccdbf4',
    flex: 1,
    position: 'relative',
  },
  mapCard: {
    backgroundColor: '#ccdbf4',
    flex: 1,
    overflow: 'hidden',
  },
  webMap: {
    backgroundColor: '#ccdbf4',
    flex: 1,
  },
  mapFallback: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  mapFallbackText: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 10,
    textAlign: 'center',
  },
  mapTopOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 7,
    left: 14,
    paddingHorizontal: 11,
    paddingVertical: 7,
    position: 'absolute',
    top: 100,
  },
  liveDot: {
    backgroundColor: colors.accent,
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  liveDotPaused: {
    backgroundColor: '#b7791f',
  },
  mapTopText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  floatingButtons: {
    gap: 10,
    position: 'absolute',
    right: 14,
    top: 158,
    zIndex: 25,
  },
  mapFab: {
    ...shadow,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: 'rgba(0,26,15,0.08)',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  mapFabPrimary: {
    backgroundColor: colors.primaryContainer,
  },
  disabledButton: {
    opacity: 0.55,
  },
  messageToast: {
    ...shadow,
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderColor: 'rgba(0,26,15,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    maxWidth: '92%',
    paddingHorizontal: 13,
    paddingVertical: 9,
    position: 'absolute',
    zIndex: 30,
  },
  messageText: {
    color: colors.primary,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '800',
  },
  errorLayer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  retryButton: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 22,
    marginTop: 14,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  retryText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  bottomSheet: {
    ...shadow,
    backgroundColor: '#fbfffd',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    zIndex: 22,
  },
  sheetHandleWrap: {
    alignItems: 'center',
    paddingBottom: 7,
    paddingTop: 8,
  },
  sheetHandle: {
    backgroundColor: colors.outline,
    borderRadius: 3,
    height: 5,
    width: 44,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    gap: 10,
    paddingBottom: 18,
  },
  routeSyncPanel: {
    gap: 9,
    marginTop: 4,
  },
  routeSummaryHeader: {
    alignItems: 'center',
    backgroundColor: '#f8fffb',
    borderColor: '#d9e8e0',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    padding: 10,
  },
  routeCodeSmall: {
    alignItems: 'center',
    backgroundColor: colors.primaryContainer,
    borderRadius: 13,
    minWidth: 48,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  routeCodeSmallText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  routeSummaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  routeSummaryTitle: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  routeSummaryMeta: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },
  routeMetricGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  detailTabs: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 4,
    padding: 3,
  },
  detailTab: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 11,
    flex: 1,
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  detailTabActive: {
    backgroundColor: colors.primaryContainer,
  },
  detailTabText: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: '900',
  },
  detailTabTextActive: {
    color: colors.white,
  },
  scheduleNote: {
    alignItems: 'center',
    backgroundColor: colors.surfaceLow,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 9,
    padding: 11,
  },
  schedulePanel: {
    gap: 9,
  },
  scheduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scheduleStatCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: '#d9e8e0',
    borderRadius: 15,
    borderWidth: 1,
    flexBasis: '48%',
    flexDirection: 'row',
    flexGrow: 1,
    gap: 8,
    minHeight: 58,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  scheduleStatIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceLow,
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  scheduleStatCopy: {
    flex: 1,
    minWidth: 0,
  },
  scheduleStatLabel: {
    color: colors.secondary,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  scheduleStatValue: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 3,
  },
  departureCard: {
    backgroundColor: '#f8fffb',
    borderColor: '#d9e8e0',
    borderRadius: 16,
    borderWidth: 1,
    padding: 11,
  },
  departureHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  departureTitle: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  departureMeta: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },
  departureTimes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 10,
  },
  departureTimePill: {
    backgroundColor: colors.white,
    borderColor: colors.outline,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scheduleEmptyRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceLow,
    borderRadius: 13,
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    padding: 10,
  },
  scheduleEmptyText: {
    color: colors.secondary,
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  scheduleWarningNote: {
    backgroundColor: '#fff7df',
  },
  scheduleWarningText: {
    color: '#8a5a00',
  },
  scheduleNoteText: {
    color: colors.secondary,
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  ticketPanel: {
    alignItems: 'flex-start',
    backgroundColor: '#f8fffb',
    borderColor: '#d9e8e0',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    padding: 11,
  },
  ticketCopy: {
    flex: 1,
  },
  ticketTitle: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  ticketText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 3,
  },
  fareBadge: {
    backgroundColor: '#d8f6e7',
    borderRadius: 8,
    color: colors.primaryContainer,
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  buyTicketButton: {
    alignItems: 'center',
    backgroundColor: colors.primaryContainer,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
  },
  buyTicketText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  notificationPanel: {
    backgroundColor: '#f8fffb',
    borderColor: '#d9e8e0',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  notificationPanelHeader: {
    alignItems: 'center',
    borderBottomColor: '#edf3ef',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    padding: 11,
  },
  notificationPanelTitle: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  alertSettingRow: {
    alignItems: 'flex-start',
    borderBottomColor: '#edf3ef',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    padding: 11,
  },
  alertSettingCopy: {
    flex: 1,
    minWidth: 0,
  },
  alertSettingLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  alertSettingDetail: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 15,
    marginTop: 3,
  },
  busInfoCard: {
    backgroundColor: colors.surfaceLow,
    borderColor: '#d9e8e0',
    borderRadius: 18,
    borderWidth: 1,
    padding: 11,
  },
  busInfoCardCompact: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  tripHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  busIcon: {
    alignItems: 'center',
    backgroundColor: '#baf8d9',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  busIconCompact: {
    borderRadius: 15,
    height: 30,
    width: 30,
  },
  tripCopy: {
    flex: 1,
  },
  tripTitle: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  tripTitleCompact: {
    fontSize: 15,
  },
  tripMeta: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  tripMetaCompact: {
    fontSize: 10,
    marginTop: 1,
  },
  progressLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  progressLineCompact: {
    gap: 7,
    marginTop: 7,
  },
  progressTitle: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '900',
  },
  progressTitleCompact: {
    fontSize: 24,
  },
  progressMeta: {
    color: colors.secondary,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  progressMetaCompact: {
    fontSize: 12,
  },
  lastUpdated: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  lastUpdatedCompact: {
    fontSize: 10,
  },
  progressTrack: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: 999,
    height: 8,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressTrackCompact: {
    height: 6,
    marginTop: 6,
  },
  progressFill: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    height: '100%',
  },
  sheetGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  infoBlock: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: '#d9e8e0',
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 60,
    padding: 9,
  },
  infoIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceLow,
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  infoCopy: {
    flex: 1,
  },
  infoLabel: {
    color: colors.secondary,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  infoValue: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 3,
  },
  compactStopLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: 7,
  },
  compactStopText: {
    color: colors.secondary,
    flex: 1,
    fontSize: 10,
    fontWeight: '800',
  },
  sheetActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.outline,
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 12,
  },
  actionButtonActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primaryContainer,
  },
  actionText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '900',
  },
  actionTextActive: {
    color: colors.white,
  },
  warningBox: {
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    borderColor: '#f5d274',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    padding: 10,
  },
  warningText: {
    color: '#6f5200',
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  busStrip: {
    gap: 8,
    paddingVertical: 10,
  },
  busChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceLow,
    borderColor: '#d9e8e0',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 48,
    minWidth: 128,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  busChipActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primaryContainer,
  },
  busChipCopy: {
    flex: 1,
  },
  busChipText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  busChipMeta: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  busChipTextActive: {
    color: colors.white,
  },
  fullContent: {
    flex: 1,
    marginTop: 2,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.surfaceLow,
    borderColor: colors.outline,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: colors.primary,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    paddingVertical: 10,
  },
  timelineCard: {
    backgroundColor: colors.white,
    borderColor: '#d9e8e0',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 10,
    padding: 12,
  },
  timelineHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: 19,
    fontWeight: '900',
  },
  timelineCount: {
    color: colors.secondary,
    fontSize: 15,
    fontWeight: '900',
  },
  timelineScroll: {
    height: 282,
  },
  stopRow: {
    borderRadius: 16,
    flexDirection: 'row',
    minHeight: 70,
    paddingRight: 8,
  },
  stopRowActive: {
    backgroundColor: colors.surfaceLow,
  },
  stopRail: {
    alignItems: 'center',
    width: 44,
  },
  railLine: {
    backgroundColor: '#d4e0da',
    position: 'absolute',
    width: 2,
  },
  railLineTop: {
    height: 26,
    top: 0,
  },
  railLineBottom: {
    bottom: 0,
    height: 36,
  },
  stopNode: {
    alignItems: 'center',
    borderColor: colors.white,
    borderRadius: 18,
    borderWidth: 3,
    height: 36,
    justifyContent: 'center',
    marginTop: 14,
    width: 36,
    zIndex: 2,
  },
  stopCopy: {
    borderBottomColor: '#edf3ef',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  stopTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  stopTitle: {
    color: colors.primary,
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
  },
  stopBadge: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: 10,
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stopBadgeCurrent: {
    backgroundColor: '#baf8d9',
    color: colors.primaryContainer,
  },
  stopMeta: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
});
