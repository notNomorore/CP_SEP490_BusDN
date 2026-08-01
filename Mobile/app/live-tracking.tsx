import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import passengerApi, { type BusRoute, type LiveBus } from '@/api/passenger.api';
import { EmptyState, LoadingState, PassengerLayout, StatusPill } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';

type EtaRecord = {
  stopId?: string;
  stopName: string;
  stopOrder?: number;
  nextBusId?: string | null;
  etaMinutes?: number | null;
  estimatedArrivalTime?: string;
  status?: string;
};

type RouteChangeNotice = {
  reasonForChange?: string;
  updatedRoutePath?: string;
  alternativeSuggestion?: string;
  status?: string;
};

const refreshIntervalMs = 10000;

const escapeHtml = (value?: string) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const routeIdOf = (route?: BusRoute) => String(route?.id || route?._id || route?.routeNumber || '');

const formatTime = (value?: string) => {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const buildMapHtml = ({ route, buses, activeBusId }: { route?: BusRoute; buses: LiveBus[]; activeBusId?: string }) => {
  const stopMarkers = (route?.stops || [])
    .filter((stop) => typeof stop.latitude === 'number' && typeof stop.longitude === 'number')
    .map((stop) => ({
      name: escapeHtml(stop.name),
      order: stop.order,
      latitude: stop.latitude,
      longitude: stop.longitude,
    }));
  const busMarkers = buses
    .filter((bus) => typeof bus.currentLocation?.latitude === 'number' && typeof bus.currentLocation?.longitude === 'number')
    .map((bus) => ({
      busId: escapeHtml(bus.busId),
      routeNumber: escapeHtml(bus.routeNumber),
      status: escapeHtml(bus.status || 'Running'),
      nextStop: escapeHtml(bus.nextStop || ''),
      active: bus.busId === activeBusId,
      latitude: bus.currentLocation?.latitude,
      longitude: bus.currentLocation?.longitude,
    }));
  const pathPoints = (route?.pathPoints?.length ? route.pathPoints : route?.stops || [])
    .filter((point) => typeof point.latitude === 'number' && typeof point.longitude === 'number')
    .map((point) => [point.latitude, point.longitude]);
  const firstPoint = busMarkers[0] || stopMarkers[0] || { latitude: 16.047079, longitude: 108.206230 };

  return `
<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #d8e6ff; }
    .leaflet-control-attribution { font-size: 9px; }
    .busdn-stop {
      width: 20px; height: 20px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: #ffffff; color: #006c49; font: 800 9px system-ui;
      border: 2px solid #006c49; box-shadow: 0 2px 7px rgba(13, 28, 47, .18);
    }
    .busdn-bus {
      min-width: 38px; height: 30px; border-radius: 16px;
      display: flex; align-items: center; justify-content: center; padding: 0 8px;
      background: #006c49; color: #fff; font: 900 10px system-ui;
      border: 3px solid #fff; box-shadow: 0 4px 12px rgba(13, 28, 47, .32);
    }
    .busdn-bus.active { background: #0d6efd; transform: scale(1.08); }
    .busdn-bus.delayed { background: #b7791f; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const stops = ${JSON.stringify(stopMarkers)};
    const buses = ${JSON.stringify(busMarkers)};
    const path = ${JSON.stringify(pathPoints)};
    const map = L.map('map', { zoomControl: false, attributionControl: true }).setView([${firstPoint.latitude}, ${firstPoint.longitude}], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    const bounds = [];
    if (path.length > 1) {
      L.polyline(path, { color: '#006c49', weight: 5, opacity: 0.8 }).addTo(map);
      path.forEach((point) => bounds.push(point));
    }
    stops.forEach((stop) => {
      const point = [stop.latitude, stop.longitude];
      bounds.push(point);
      L.marker(point, {
        icon: L.divIcon({ className: '', html: '<div class="busdn-stop">' + stop.order + '</div>', iconSize: [24, 24], iconAnchor: [12, 12] })
      }).addTo(map).bindPopup(stop.name);
    });
    buses.forEach((bus) => {
      const point = [bus.latitude, bus.longitude];
      bounds.push(point);
      const delayed = bus.status === 'Delayed' ? ' delayed' : '';
      const active = bus.active ? ' active' : '';
      L.marker(point, {
        icon: L.divIcon({ className: '', html: '<div class="busdn-bus' + delayed + active + '">' + bus.busId + '</div>', iconSize: [52, 34], iconAnchor: [26, 17] })
      }).addTo(map).bindPopup(bus.busId + '<br>' + bus.nextStop);
    });
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
  </script>
</body>
</html>`;
};

export default function LiveTrackingScreen() {
  const params = useLocalSearchParams<{ routeId?: string }>();
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState(params.routeId || '');
  const [trackedRoute, setTrackedRoute] = useState<BusRoute | null>(null);
  const [buses, setBuses] = useState<LiveBus[]>([]);
  const [selectedBusId, setSelectedBusId] = useState('');
  const [eta, setEta] = useState<EtaRecord[]>([]);
  const [routeChange, setRouteChange] = useState<RouteChangeNotice | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState('');
  const [refreshedAt, setRefreshedAt] = useState('');
  const [mapFailed, setMapFailed] = useState(false);

  const selectedRoute = useMemo(() => (
    trackedRoute || routes.find((route) => routeIdOf(route) === selectedRouteId) || null
  ), [routes, selectedRouteId, trackedRoute]);
  const selectedBus = buses.find((bus) => bus.busId === selectedBusId) || buses[0] || null;
  const mapHtml = useMemo(() => buildMapHtml({
    route: selectedRoute || undefined,
    buses,
    activeBusId: selectedBus?.busId,
  }), [buses, selectedBus?.busId, selectedRoute]);

  const loadRoutes = useCallback(async () => {
    const data = await passengerApi.searchRoutes();
    const routeList = data.routes || [];
    setRoutes(routeList);
    return routeList;
  }, []);

  const loadLive = useCallback(async (routeId: string, silent = false) => {
    if (!routeId) return;
    silent ? setRefreshing(true) : setInitialLoading(true);
    setError('');
    try {
      const live = await passengerApi.getLiveTracking(routeId);
      const nextBuses = live.buses || [];
      setTrackedRoute(live.route || null);
      setBuses(nextBuses);
      setEta((live.stopEtaSummary || []) as EtaRecord[]);
      setRouteChange((live.routeChange || null) as RouteChangeNotice | null);
      setRefreshedAt(live.refreshedAt || new Date().toISOString());
      setSelectedBusId((current) => (
        nextBuses.some((bus) => bus.busId === current) ? current : nextBuses[0]?.busId || ''
      ));
    } catch (err) {
      setError((err as { message?: string })?.message || 'Không thể tải vị trí xe bus.');
    } finally {
      silent ? setRefreshing(false) : setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const loadedRoutes = await loadRoutes();
        const firstRouteId = selectedRouteId || routeIdOf(loadedRoutes[0]);
        setSelectedRouteId(firstRouteId);
        if (firstRouteId) await loadLive(firstRouteId);
        else setInitialLoading(false);
      } catch (err) {
        setError((err as { message?: string })?.message || 'Không thể tải danh sách tuyến.');
        setInitialLoading(false);
      }
    };
    void init();
  }, [loadLive, loadRoutes]);

  useEffect(() => {
    if (!autoRefresh || !selectedRouteId) return undefined;
    const interval = setInterval(() => {
      void loadLive(selectedRouteId, true);
    }, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [autoRefresh, loadLive, selectedRouteId]);

  const chooseRoute = (route: BusRoute) => {
    const routeId = routeIdOf(route);
    setSelectedRouteId(routeId);
    setTrackedRoute(route);
    setSelectedBusId('');
    setMapFailed(false);
    void loadLive(routeId);
  };

  return (
    <PassengerLayout
      active="explore"
      rightAction={(
        <Pressable accessibilityLabel="Làm mới vị trí xe" onPress={() => selectedRouteId && loadLive(selectedRouteId, true)} style={styles.iconButton}>
          {refreshing ? <ActivityIndicator color={colors.primary} size="small" /> : <MaterialCommunityIcons color={colors.primary} name="refresh" size={20} />}
        </Pressable>
      )}
      subtitle={selectedRoute?.routeNumber ? `Tuyến ${selectedRoute.routeNumber}` : 'Theo dõi vị trí xe theo thời gian thực'}
      title="Vị trí xe bus"
    >
      <View style={styles.routeStrip}>
        {routes.slice(0, 10).map((route) => {
          const routeId = routeIdOf(route);
          const active = routeId === selectedRouteId || route.routeNumber === selectedRoute?.routeNumber;
          return (
            <Pressable key={routeId} onPress={() => chooseRoute(route)} style={[styles.routeChip, active && styles.routeChipActive]}>
              <Text style={[styles.routeChipText, active && styles.routeChipTextActive]}>{route.routeNumber}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.toolbar}>
        <View>
          <Text style={styles.toolbarTitle}>{selectedRoute?.name || 'Chọn tuyến để theo dõi'}</Text>
          <Text style={styles.toolbarMeta}>Cập nhật mỗi {refreshIntervalMs / 1000} giây - {formatTime(refreshedAt)}</Text>
        </View>
        <Pressable onPress={() => setAutoRefresh((value) => !value)} style={[styles.autoButton, autoRefresh && styles.autoButtonActive]}>
          <MaterialCommunityIcons color={autoRefresh ? colors.white : colors.secondary} name={autoRefresh ? 'pause' : 'play'} size={16} />
          <Text style={[styles.autoButtonText, autoRefresh && styles.autoButtonTextActive]}>{autoRefresh ? 'Tự cập nhật' : 'Tạm dừng'}</Text>
        </Pressable>
      </View>

      {initialLoading ? <LoadingState label="Đang tải vị trí xe bus" /> : null}
      {!initialLoading && error ? <EmptyState icon="alert-circle-outline" title="Không có dữ liệu live" detail={error} /> : null}

      {!initialLoading && !error ? (
        <>
          <View style={styles.mapCard}>
            {!mapFailed ? (
              <WebView
                javaScriptEnabled
                onError={() => setMapFailed(true)}
                originWhitelist={['*']}
                source={{ html: mapHtml }}
                style={styles.webMap}
              />
            ) : (
              <View style={styles.mapFallback}>
                <MaterialCommunityIcons color={colors.secondary} name="map-outline" size={34} />
                <Text style={styles.mapFallbackText}>Không tải được bản đồ. Kiểm tra mạng thiết bị rồi bấm làm mới.</Text>
              </View>
            )}
            <View pointerEvents="none" style={styles.mapOverlay}>
              <Text style={styles.mapOverlayTitle}>{selectedBus?.busId || 'Chưa có xe đang chạy'}</Text>
              <Text numberOfLines={1} style={styles.mapOverlayMeta}>
                {selectedBus ? `${selectedBus.nextStop || 'Chưa rõ trạm tiếp theo'} - ${selectedBus.estimatedArrivalTime || 'ETA unavailable'}` : 'Chọn tuyến khác hoặc bấm làm mới'}
              </Text>
            </View>
          </View>

          {!buses.length ? <EmptyState icon="bus-alert" title="Chưa có xe active" detail="Thử làm mới hoặc chọn tuyến khác." /> : null}

          {buses.length ? (
            <View style={styles.busStrip}>
              {buses.map((bus) => {
                const active = bus.busId === selectedBus?.busId;
                return (
                  <Pressable key={bus.busId} onPress={() => setSelectedBusId(bus.busId)} style={[styles.busSelector, active && styles.busSelectorActive]}>
                    <MaterialCommunityIcons color={active ? colors.white : colors.primary} name="bus" size={18} />
                    <Text style={[styles.busSelectorText, active && styles.busSelectorTextActive]}>{bus.busId}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {selectedBus ? <BusCard bus={selectedBus} /> : null}

          {routeChange ? (
            <View style={styles.noticeCard}>
              <View style={styles.noticeHeader}>
                <MaterialCommunityIcons color="#6f5200" name="road-variant" size={20} />
                <Text style={styles.noticeTitle}>Thông báo thay đổi tuyến</Text>
              </View>
              <Text style={styles.noticeText}>{routeChange.reasonForChange || 'Tuyến có điều chỉnh tạm thời.'}</Text>
              <Text style={styles.noticeMeta}>{routeChange.updatedRoutePath || routeChange.alternativeSuggestion}</Text>
            </View>
          ) : null}

          {eta.length ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>ETA theo trạm</Text>
              {eta.map((item) => (
                <View key={item.stopId || item.stopName} style={styles.etaRow}>
                  <View style={styles.etaStopCopy}>
                    <Text numberOfLines={1} style={styles.etaStop}>{item.stopName}</Text>
                    <Text style={styles.etaBus}>{item.nextBusId ? `Xe gần nhất: ${item.nextBusId}` : item.status || 'Chưa có xe'}</Text>
                  </View>
                  <Text style={styles.etaTime}>{item.estimatedArrivalTime || '-'}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </PassengerLayout>
  );
}

function BusCard({ bus }: { bus: LiveBus }) {
  const progress = Math.min(Math.max(bus.tripProgress?.progressPercent || 0, 0), 100);
  const delayed = bus.status === 'Delayed';

  return (
    <View style={styles.busCard}>
      <View style={styles.busHeader}>
        <View>
          <Text style={styles.busId}>{bus.busId}</Text>
          <Text style={styles.busRoute}>Tuyến {bus.routeNumber}</Text>
        </View>
        <StatusPill label={delayed ? 'Chậm' : 'Đang chạy'} tone={delayed ? 'warning' : 'success'} />
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <View style={styles.infoGrid}>
        <InfoBlock label="Hiện tại" value={bus.tripProgress?.currentStop || 'Chưa rõ'} />
        <InfoBlock label="Trạm tiếp theo" value={bus.nextStop || bus.tripProgress?.nextStop || 'Chưa rõ'} />
        <InfoBlock label="ETA" value={bus.estimatedArrivalTime || bus.tripProgress?.estimatedRemainingTime || 'Chưa có'} />
        <InfoBlock label="Tiến độ" value={`${progress}%`} />
      </View>
      {bus.delay ? (
        <View style={styles.delayBox}>
          <MaterialCommunityIcons color="#6f5200" name="alert-outline" size={18} />
          <Text style={styles.delayText}>{bus.delay.delayReason || 'Kẹt xe'} - trễ khoảng {bus.delay.delayDurationMinutes || 0} phút.</Text>
        </View>
      ) : null}
      <Text style={styles.lastUpdated}>Vị trí cuối: {formatTime(bus.lastUpdated)}</Text>
    </View>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.card },
  routeStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  routeChip: { borderRadius: 999, backgroundColor: colors.card, paddingHorizontal: 13, paddingVertical: 9 },
  routeChipActive: { backgroundColor: colors.primaryContainer },
  routeChipText: { color: colors.secondary, fontSize: 12, fontWeight: '900' },
  routeChipTextActive: { color: colors.white },
  toolbar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  toolbarTitle: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  toolbarMeta: { marginTop: 3, color: colors.secondary, fontSize: 11, fontWeight: '700' },
  autoButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: colors.card, paddingHorizontal: 12 },
  autoButtonActive: { backgroundColor: colors.primaryContainer },
  autoButtonText: { color: colors.secondary, fontSize: 11, fontWeight: '900' },
  autoButtonTextActive: { color: colors.white },
  mapCard: { height: 292, overflow: 'hidden', borderWidth: 1, borderColor: '#d5e3fd', borderRadius: 24, backgroundColor: '#d8e6ff' },
  webMap: { flex: 1, backgroundColor: '#d8e6ff' },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  mapFallbackText: { color: colors.secondary, fontSize: 12, lineHeight: 17, fontWeight: '800', textAlign: 'center' },
  mapOverlay: { position: 'absolute', right: 14, bottom: 14, left: 14, minHeight: 66, justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.94)', paddingHorizontal: 14 },
  mapOverlayTitle: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  mapOverlayMeta: { marginTop: 3, color: colors.secondary, fontSize: 12, fontWeight: '800' },
  busStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  busSelector: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, backgroundColor: colors.card, paddingHorizontal: 12 },
  busSelectorActive: { backgroundColor: colors.primaryContainer },
  busSelectorText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  busSelectorTextActive: { color: colors.white },
  busCard: { gap: 13, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  busHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  busId: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  busRoute: { marginTop: 2, color: colors.secondary, fontSize: 12, fontWeight: '800' },
  progressTrack: { height: 10, overflow: 'hidden', borderRadius: 999, backgroundColor: colors.surfaceHigh },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.accent },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  infoBlock: { width: '47%', flexGrow: 1, minHeight: 68, justifyContent: 'center', borderRadius: 16, backgroundColor: colors.surfaceLow, padding: 12 },
  infoLabel: { color: colors.secondary, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  infoValue: { marginTop: 5, color: colors.primary, fontSize: 13, lineHeight: 18, fontWeight: '900' },
  delayBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 15, backgroundColor: '#fff4cc', padding: 10 },
  delayText: { flex: 1, color: '#6f5200', fontSize: 12, lineHeight: 17, fontWeight: '800' },
  lastUpdated: { color: colors.secondary, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  noticeCard: { gap: 8, borderRadius: 20, backgroundColor: '#fff4cc', padding: 14 },
  noticeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noticeTitle: { color: '#6f5200', fontSize: 14, fontWeight: '900' },
  noticeText: { color: '#6f5200', fontSize: 12, lineHeight: 17, fontWeight: '800' },
  noticeMeta: { color: '#6f5200', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  card: { gap: 10, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  cardTitle: { color: colors.primary, fontSize: 17, fontWeight: '900' },
  etaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outline },
  etaStopCopy: { flex: 1 },
  etaStop: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  etaBus: { marginTop: 2, color: colors.secondary, fontSize: 10, fontWeight: '700' },
  etaTime: { color: colors.accent, fontSize: 12, fontWeight: '900' },
});
