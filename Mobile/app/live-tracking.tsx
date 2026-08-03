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
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import passengerApi, { type BusRoute, type BusRouteStop, type LiveBus } from '@/api/passenger.api';
import { PassengerBottomNav } from '@/components/navigation/PassengerBottomNav';
import { EmptyState, LoadingState, StatusPill } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';
import { type DeviceGpsPayload } from '@/utils/deviceGps';

const pollingMs = 10000;
type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type SheetLevel = 'collapsed' | 'half' | 'full';
type StopState = 'completed' | 'current' | 'next' | 'pending' | 'unknown';
type PanHandlers = ReturnType<typeof PanResponder.create>['panHandlers'];

type ProgressStop = BusRouteStop & {
  key: string;
  state: StopState;
  label: string;
};

const routeIdOf = (route?: BusRoute) => String(route?.id || route?._id || route?.routeNumber || '');
const normalize = (value?: string) => String(value || '').trim().toLowerCase();
const normalizeSearch = (value?: string) => normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const stopKey = (stop: BusRouteStop, index = 0) => String(stop.stopId || `${stop.order || index + 1}-${normalize(stop.name)}`);
const clampProgress = (value?: number) => Math.min(Math.max(Math.round(Number(value) || 0), 0), 100);
const normalizeStatus = (status?: string) => String(status || 'UNKNOWN').toUpperCase();

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
        current: 'Current',
        next: 'Next Stop',
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
      status: normalizeStatus(bus.tripProgress?.tripStatus || bus.status),
      nextStop: escapeHtml(bus.nextStop || bus.tripProgress?.nextStop || ''),
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
      L.marker(point, {
        icon: L.divIcon({ className: '', html: '<div class="bus' + delayed + active + '">' + bus.busId + '</div>', iconSize: [56, 36], iconAnchor: [28, 18] })
      }).addTo(map).bindPopup(bus.busId + '<br>' + bus.nextStop);
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
      if (${JSON.stringify(focusTarget)} !== 'route') map.setView([${center.latitude}, ${center.longitude}], 15);
    }, 120);
  </script>
</body>
</html>`;
};

export default function LiveTrackingScreen() {
  const params = useLocalSearchParams<{ routeId?: string; tripId?: string; vehicleId?: string }>();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const mountedRef = useRef(true);
  const requestSeq = useRef(0);
  const sheetAnim = useRef(new Animated.Value(0)).current;
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
  const [mapFocusTarget, setMapFocusTarget] = useState<'bus' | 'stop' | 'route' | 'user'>('route');
  const [sheetLevel, setSheetLevel] = useState<SheetLevel>('collapsed');
  const [refreshedAt, setRefreshedAt] = useState('');
  const [mapFailed, setMapFailed] = useState(false);

  const bottomNavHeight = Math.max(insets.bottom, 10) + 72;
  const sheetMaxHeight = Math.max(windowHeight - insets.top - bottomNavHeight - 16, 420);
  const sheetHeights = useMemo(() => ({
    collapsed: Math.min(250, sheetMaxHeight * 0.32),
    half: sheetMaxHeight * 0.5,
    full: sheetMaxHeight * 0.78,
  }), [sheetMaxHeight]);

  const selectedRoute = route || routes.find((item) => routeIdOf(item) === selectedRouteId) || null;
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

  const snapSheet = useCallback((level: SheetLevel) => {
    setSheetLevel(level);
    Animated.spring(sheetAnim, {
      toValue: sheetHeights[level],
      damping: 22,
      stiffness: 190,
      mass: 0.9,
      useNativeDriver: false,
    }).start();
  }, [sheetAnim, sheetHeights]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 8,
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dy < -40 || gesture.vy < -0.7) {
        snapSheet(sheetLevel === 'collapsed' ? 'half' : 'full');
        return;
      }
      if (gesture.dy > 40 || gesture.vy > 0.7) {
        snapSheet(sheetLevel === 'full' ? 'half' : 'collapsed');
      }
    },
  }), [sheetLevel, snapSheet]);

  const loadRoutes = useCallback(async () => {
    const data = await passengerApi.searchRoutes();
    const nextRoutes = data.routes || [];
    if (mountedRef.current) setRoutes(nextRoutes);
    return nextRoutes;
  }, []);

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
      setError((err as { message?: string })?.message || 'Khong the tai tien trinh chuyen.');
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
        setError((err as { message?: string })?.message || 'Khong the tai danh sach tuyen.');
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
    if (!autoRefresh || !selectedRouteId) return undefined;
    const timer = setInterval(() => {
      void loadLive(selectedRouteId, true);
    }, pollingMs);
    return () => clearInterval(timer);
  }, [autoRefresh, loadLive, selectedRouteId]);

  useEffect(() => {
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
          <View style={[styles.messageToast, { bottom: bottomNavHeight + sheetHeights.collapsed + 8 }]}>
            <MaterialCommunityIcons color={colors.secondary} name="information-outline" size={18} />
            <Text style={styles.messageText}>{actionMessage}</Text>
          </View>
        ) : null}

        {!initialLoading && !error ? (
          <TripBottomSheet
            autoFollow={autoFollow}
            autoRefresh={autoRefresh}
            bottomOffset={bottomNavHeight}
            buses={buses}
            completedCount={completedCount}
            filteredStops={filteredStops}
            panHandlers={panResponder.panHandlers}
            progressPercent={progressPercent}
            refreshing={refreshing}
            selectedBus={selectedBus}
            selectedRoute={selectedRoute}
            selectedStop={selectedStop}
            sheetAnim={sheetAnim}
            sheetLevel={sheetLevel}
            snapSheet={snapSheet}
            stale={stale}
            stopSearch={stopSearch}
            stopStates={stopStates}
            tripStatus={tripStatus}
            updatedAt={refreshedAt}
            onChooseBus={chooseBus}
            onChooseStop={chooseStop}
            onFocusBus={focusSelectedBus}
            onRefresh={() => selectedRouteId && loadLive(selectedRouteId, true)}
            onSetAutoFollow={setAutoFollow}
            onSetAutoRefresh={setAutoRefresh}
            onSetStopSearch={setStopSearch}
          />
        ) : null}

        <PassengerBottomNav active="explore" />
      </View>
    </SafeAreaView>
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
  bottomOffset,
  buses,
  completedCount,
  filteredStops,
  panHandlers,
  progressPercent,
  refreshing,
  selectedBus,
  selectedRoute,
  selectedStop,
  sheetAnim,
  sheetLevel,
  snapSheet,
  stale,
  stopSearch,
  stopStates,
  tripStatus,
  updatedAt,
  onChooseBus,
  onChooseStop,
  onFocusBus,
  onRefresh,
  onSetAutoFollow,
  onSetAutoRefresh,
  onSetStopSearch,
}: {
  autoFollow: boolean;
  autoRefresh: boolean;
  bottomOffset: number;
  buses: LiveBus[];
  completedCount: number;
  filteredStops: ProgressStop[];
  panHandlers: PanHandlers;
  progressPercent: number;
  refreshing: boolean;
  selectedBus: LiveBus | null;
  selectedRoute: BusRoute | null;
  selectedStop: ProgressStop | null;
  sheetAnim: Animated.Value;
  sheetLevel: SheetLevel;
  snapSheet: (level: SheetLevel) => void;
  stale: boolean;
  stopSearch: string;
  stopStates: ProgressStop[];
  tripStatus: ReturnType<typeof tripStatusDisplay>;
  updatedAt?: string;
  onChooseBus: (bus: LiveBus) => void;
  onChooseStop: (stop: ProgressStop) => void;
  onFocusBus: () => void;
  onRefresh: () => void;
  onSetAutoFollow: (value: boolean) => void;
  onSetAutoRefresh: (value: boolean) => void;
  onSetStopSearch: (value: string) => void;
}) {
  return (
    <Animated.View style={[styles.bottomSheet, { bottom: bottomOffset, height: sheetAnim }]}>
      <Pressable {...panHandlers} onPress={() => snapSheet(sheetLevel === 'collapsed' ? 'half' : sheetLevel === 'half' ? 'full' : 'collapsed')} style={styles.sheetHandleWrap}>
        <View style={styles.sheetHandle} />
      </Pressable>
      <View style={styles.sheetContent}>
        <BusInfoCard
          completedCount={completedCount}
          progressPercent={progressPercent}
          selectedBus={selectedBus}
          selectedRoute={selectedRoute}
          stopCount={stopStates.length}
          tripStatus={tripStatus}
          updatedAt={updatedAt}
        />

        {sheetLevel !== 'collapsed' ? (
          <>
            <View style={styles.sheetActions}>
              <Pressable onPress={() => onSetAutoRefresh(!autoRefresh)} style={[styles.actionButton, autoRefresh && styles.actionButtonActive]}>
                <MaterialCommunityIcons color={autoRefresh ? colors.white : colors.secondary} name={autoRefresh ? 'pause-circle' : 'play-circle'} size={17} />
                <Text style={[styles.actionText, autoRefresh && styles.actionTextActive]}>{autoRefresh ? 'Tự cập nhật' : 'Tạm dừng'}</Text>
              </Pressable>
              <Pressable onPress={() => onSetAutoFollow(!autoFollow)} style={[styles.actionButton, autoFollow && styles.actionButtonActive]}>
                <MaterialCommunityIcons color={autoFollow ? colors.white : colors.secondary} name="navigation-variant" size={17} />
                <Text style={[styles.actionText, autoFollow && styles.actionTextActive]}>{autoFollow ? 'Auto follow' : 'Tự do xem'}</Text>
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
          </>
        ) : null}

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
      </View>
    </Animated.View>
  );
}

function BusInfoCard({ completedCount, progressPercent, selectedBus, selectedRoute, stopCount, tripStatus, updatedAt }: { completedCount: number; progressPercent: number; selectedBus: LiveBus | null; selectedRoute: BusRoute | null; stopCount: number; tripStatus: ReturnType<typeof tripStatusDisplay>; updatedAt?: string }) {
  const currentStop = selectedBus?.tripProgress?.currentStop || 'Chưa xác định';
  const nextStop = selectedBus?.tripProgress?.nextStop || selectedBus?.nextStop || 'Chưa xác định';
  return (
    <View style={styles.busInfoCard}>
      <View style={styles.tripHeader}>
        <View style={styles.busIcon}>
          <MaterialCommunityIcons color={colors.primary} name="bus" size={22} />
        </View>
        <View style={styles.tripCopy}>
          <Text numberOfLines={1} style={styles.tripTitle}>{selectedBus?.busId || 'Chưa có xe đang chạy'}</Text>
          <Text numberOfLines={1} style={styles.tripMeta}>{selectedRoute ? `${selectedRoute.origin} đến ${selectedRoute.destination}` : 'Chọn tuyến để theo dõi'}</Text>
        </View>
        <StatusPill label={tripStatus.label} tone={tripStatus.tone} />
      </View>
      <View style={styles.progressLine}>
        <Text style={styles.progressTitle}>{progressPercent}%</Text>
        <Text style={styles.progressMeta}>{completedCount}/{stopCount} stops</Text>
        <Text style={styles.lastUpdated}>{formatTime(updatedAt)}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
      </View>
      <View style={styles.sheetGrid}>
        <InfoBlock icon="near-me" label="Trạm hiện tại" value={currentStop} />
        <InfoBlock icon="map-marker-path" label="Trạm tiếp theo" value={nextStop} />
      </View>
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
        accessibilityLabel="Tim tram trong chuyen"
        editable
        onChangeText={onSetStopSearch}
        placeholder="Tìm trạm trong lộ trình..."
        placeholderTextColor={colors.secondary}
        returnKeyType="search"
        style={styles.searchInput}
        value={stopSearch}
      />
      {stopSearch ? (
        <Pressable accessibilityLabel="Xoa tu khoa tim kiem" hitSlop={8} onPress={() => onSetStopSearch('')}>
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
        <Text style={styles.sectionTitle}>Trip Stops</Text>
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
    gap: 12,
    height: 76,
    paddingHorizontal: 16,
    zIndex: 20,
  },
  headerButton: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.outline,
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    color: colors.primary,
    fontSize: 24,
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
    maxHeight: 48,
    position: 'absolute',
    right: 0,
    top: 12,
    zIndex: 24,
  },
  routeStrip: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  routeChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(216,232,255,0.96)',
    borderRadius: 18,
    height: 38,
    justifyContent: 'center',
    minWidth: 72,
    paddingHorizontal: 14,
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
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    left: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'absolute',
    top: 66,
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
    fontSize: 12,
    fontWeight: '900',
  },
  floatingButtons: {
    gap: 10,
    position: 'absolute',
    right: 16,
    top: 122,
    zIndex: 25,
  },
  mapFab: {
    ...shadow,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: 'rgba(0,26,15,0.08)',
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
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
    backgroundColor: colors.white,
    borderColor: colors.outline,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    maxWidth: '88%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'absolute',
    zIndex: 30,
  },
  messageText: {
    color: colors.primary,
    flexShrink: 1,
    fontSize: 12,
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
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    zIndex: 22,
  },
  sheetHandleWrap: {
    alignItems: 'center',
    paddingBottom: 8,
    paddingTop: 10,
  },
  sheetHandle: {
    backgroundColor: colors.outline,
    borderRadius: 3,
    height: 5,
    width: 48,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  busInfoCard: {
    backgroundColor: colors.surfaceLow,
    borderColor: '#d9e8e0',
    borderRadius: 20,
    borderWidth: 1,
    padding: 13,
  },
  tripHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  busIcon: {
    alignItems: 'center',
    backgroundColor: '#baf8d9',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  tripCopy: {
    flex: 1,
  },
  tripTitle: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '900',
  },
  tripMeta: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  progressLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  progressTitle: {
    color: colors.primary,
    fontSize: 30,
    fontWeight: '900',
  },
  progressMeta: {
    color: colors.secondary,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  lastUpdated: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: 999,
    height: 9,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    height: '100%',
  },
  sheetGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  infoBlock: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: '#d9e8e0',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 66,
    padding: 10,
  },
  infoIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceLow,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  infoCopy: {
    flex: 1,
  },
  infoLabel: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  infoValue: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 3,
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
    paddingVertical: 12,
  },
  busChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceLow,
    borderColor: '#d9e8e0',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 52,
    minWidth: 138,
    paddingHorizontal: 12,
    paddingVertical: 9,
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
    fontSize: 13,
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
    marginTop: 4,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.surfaceLow,
    borderColor: colors.outline,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 46,
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
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
  },
  timelineHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '900',
  },
  timelineCount: {
    color: colors.secondary,
    fontSize: 19,
    fontWeight: '900',
  },
  timelineScroll: {
    height: 300,
  },
  stopRow: {
    borderRadius: 20,
    flexDirection: 'row',
    minHeight: 82,
    paddingRight: 8,
  },
  stopRowActive: {
    backgroundColor: colors.surfaceLow,
  },
  stopRail: {
    alignItems: 'center',
    width: 50,
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
    borderRadius: 22,
    borderWidth: 3,
    height: 44,
    justifyContent: 'center',
    marginTop: 16,
    width: 44,
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
    fontSize: 22,
    fontWeight: '900',
  },
  stopBadge: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: 10,
    color: colors.secondary,
    fontSize: 14,
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
    fontSize: 17,
    fontWeight: '700',
    marginTop: 4,
  },
});
