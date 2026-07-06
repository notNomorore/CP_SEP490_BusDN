import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';

import scheduleOperationsApi from '@/api/scheduleOperations.api';
import { AppButton } from '@/components/AppButton';
import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';
import type { AssignedTrip, RoutePoint } from '@/types/scheduleOperations';
import { getDeviceGpsPayload, type DeviceGpsPayload, watchDeviceGps } from '@/utils/deviceGps';
import { goBackOrReplace } from '@/utils/navigation';
import { formatCoordinate, formatTime, getRouteStops, getTripStatus } from '@/utils/scheduleOperations';
import { getErrorMessage } from '@/utils/validation';

const ARRIVAL_RADIUS_METERS = 30;
const DRIVER_FALLBACK_CENTER = { latitude: 16.047079, longitude: 108.20623 };

function parseTripParam(value: unknown): AssignedTrip | null {
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value) as AssignedTrip;
  } catch {
    return null;
  }
}

type MapPoint = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

type DriverMapPoint = MapPoint & {
  accuracyMeters?: number | null;
};

type RouteInstruction = {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
};

type DriverIncidentType = 'TRAFFIC_CONGESTION' | 'ACCIDENT' | 'VEHICLE_BREAKDOWN';
type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type EvidenceFile = {
  uri: string;
  name?: string;
  type?: string;
};

const DRIVER_INCIDENT_OPTIONS: Array<{
  type: DriverIncidentType;
  code: string;
  label: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}> = [
  {
    type: 'TRAFFIC_CONGESTION',
    code: 'UC46',
    label: 'Bao ket xe',
    description: 'Bao un tac, cham tuyen hoac duong bi chan.',
    icon: 'traffic-cone',
  },
  {
    type: 'ACCIDENT',
    code: 'UC47',
    label: 'Bao tai nan',
    description: 'Bao tai nan, va cham hoac tinh huong can ho tro khan.',
    icon: 'alert-octagon-outline',
  },
  {
    type: 'VEHICLE_BREAKDOWN',
    code: 'UC48',
    label: 'Bao xe hong',
    description: 'Bao xe hong trong chuyen, can ho tro ky thuat hoac xe thay the.',
    icon: 'bus-alert',
  },
];

const INCIDENT_SEVERITIES: Array<{ value: IncidentSeverity; label: string }> = [
  { value: 'LOW', label: 'Thap' },
  { value: 'MEDIUM', label: 'Trung binh' },
  { value: 'HIGH', label: 'Cao' },
  { value: 'CRITICAL', label: 'Khan cap' },
];

const TRAFFIC_CATEGORIES = [
  { value: 'HEAVY_TRAFFIC', label: 'Un tac dong phuong tien' },
  { value: 'ROADWORK', label: 'Thi cong / rao chan duong' },
  { value: 'FLOODING', label: 'Ngap nuoc / thoi tiet xau' },
  { value: 'EVENT_CROWD', label: 'Su kien dong nguoi' },
  { value: 'STOP_OVERLOAD', label: 'Diem dung qua tai' },
  { value: 'TEMPORARY_BLOCK', label: 'Duong bi chan tam thoi' },
  { value: 'OTHER', label: 'Khac' },
];

const isValidRouteCoordinate = (point: RoutePoint) => (
  typeof point.latitude === 'number'
  && typeof point.longitude === 'number'
  && Number.isFinite(point.latitude)
  && Number.isFinite(point.longitude)
);

const isValidGpsCoordinate = (point?: DeviceGpsPayload | null) => (
  typeof point?.latitude === 'number'
  && typeof point?.longitude === 'number'
  && Number.isFinite(point.latitude)
  && Number.isFinite(point.longitude)
);

const toMapPoints = (stops: RoutePoint[]): MapPoint[] => stops
  .filter(isValidRouteCoordinate)
  .map((stop, index) => ({
    name: stop.stopName || `Tram ${index + 1}`,
    address: stop.address || '',
    latitude: Number(stop.latitude),
    longitude: Number(stop.longitude),
  }));

const toRadians = (value: number) => value * (Math.PI / 180);

const distanceMeters = (first?: Pick<MapPoint, 'latitude' | 'longitude'> | null, second?: Pick<MapPoint, 'latitude' | 'longitude'> | null) => {
  if (!first || !second) return 0;
  const earthRadiusMeters = 6371000;
  const deltaLat = toRadians(second.latitude - first.latitude);
  const deltaLon = toRadians(second.longitude - first.longitude);
  const startLat = toRadians(first.latitude);
  const endLat = toRadians(second.latitude);
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLon / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const formatDistance = (meters: number) => {
  if (!Number.isFinite(meters) || meters <= 0) return 'Dang cap nhat';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.max(1, Math.round(meters))} m`;
};

const formatEta = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Dang cap nhat';
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} phut`;
};

const fallbackInstruction = (meters: number) => (
  meters > 0 ? `Di thang ${formatDistance(meters)} den tram tiep theo` : 'Dang cap nhat huong dan'
);

const sanitizeForHtml = <T,>(value: T): string => (
  JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
);

const buildNavigationMapHtml = ({
  points,
  driverLocation,
  currentStopIndex,
}: {
  points: MapPoint[];
  driverLocation?: DriverMapPoint | null;
  currentStopIndex: number;
}) => {
  const serializedPoints = sanitizeForHtml(points);
  const serializedDriver = sanitizeForHtml(driverLocation || null);

  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #e8f4ef; }
    .leaflet-control-attribution { font-size: 9px; }
    .leaflet-control-zoom { display: none; }
    .stop-marker, .driver-marker {
      width: 31px;
      height: 31px;
      border-radius: 999px;
      border: 3px solid #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font: 900 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-shadow: 0 5px 14px rgba(0, 26, 15, 0.25);
    }
    .stop-marker.passed { background: #8aa39a; }
    .stop-marker.next { width: 40px; height: 40px; background: #f5b700; color: #001a0f; border-width: 4px; font-size: 15px; }
    .stop-marker.future { background: #00765a; }
    .driver-marker {
      width: 42px;
      height: 42px;
      background: #1d4ed8;
      color: #fff;
      font-size: 22px;
      transform-origin: center;
    }
    .popup-title { font: 900 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin-bottom: 3px; color: #141d1b; }
    .popup-address { font: 700 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #426656; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const points = ${serializedPoints};
    let driver = ${serializedDriver};
    const currentStopIndex = ${currentStopIndex};
    const fallbackCenter = [${DRIVER_FALLBACK_CENTER.latitude}, ${DRIVER_FALLBACK_CENTER.longitude}];
    const map = L.map('map', { zoomControl: false, attributionControl: true, preferCanvas: true });
    const postMessage = (payload) => {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    };

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      updateWhenIdle: true,
      keepBuffer: 2,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    setTimeout(() => map.invalidateSize(), 120);

    const routeLatLngs = points.map((point) => [point.latitude, point.longitude]);
    const nextStop = points[currentStopIndex] || null;
    if (routeLatLngs.length) {
      L.polyline(routeLatLngs, { color: '#2563eb', weight: 5, opacity: 0.62 }).addTo(map);
    }

    points.forEach((point, index) => {
      const state = index < currentStopIndex ? 'passed' : index === currentStopIndex ? 'next' : 'future';
      const size = state === 'next' ? 40 : 31;
      const icon = L.divIcon({
        className: '',
        html: '<div class="stop-marker ' + state + '">' + (index + 1) + '</div>',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
      });
      L.marker([point.latitude, point.longitude], { icon })
        .addTo(map)
        .bindPopup('<div class="popup-title">' + point.name + '</div><div class="popup-address">' + point.address + '</div>');
    });

    const driverLayer = L.layerGroup().addTo(map);
    const navigationLayer = L.layerGroup().addTo(map);
    let lastRouteKey = '';
    const toRad = (value) => value * Math.PI / 180;
    const toDeg = (value) => value * 180 / Math.PI;
    const bearingTo = (from, to) => {
      if (!from || !to) return 0;
      const lat1 = toRad(from.latitude);
      const lat2 = toRad(to.latitude);
      const deltaLon = toRad(to.longitude - from.longitude);
      const y = Math.sin(deltaLon) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
      return (toDeg(Math.atan2(y, x)) + 360) % 360;
    };
    const formatMeters = (meters) => {
      if (!Number.isFinite(meters) || meters <= 0) return '';
      if (meters >= 1000) return (meters / 1000).toFixed(1) + ' km';
      return Math.max(1, Math.round(meters)) + ' m';
    };
    const renderDriver = () => {
      driverLayer.clearLayers();
      if (!driver) return;
      const heading = bearingTo(driver, nextStop);
      const driverIcon = L.divIcon({
        className: '',
        html: '<div class="driver-marker" style="transform: rotate(' + heading + 'deg)">▲</div>',
        iconSize: [42, 42],
        iconAnchor: [21, 21],
        popupAnchor: [0, -22]
      });
      L.marker([driver.latitude, driver.longitude], { icon: driverIcon })
        .addTo(driverLayer)
        .bindPopup('<div class="popup-title">Vi tri tai xe</div><div class="popup-address">Sai so: ' + Math.round(driver.accuracyMeters || 0) + ' m</div>');
      if (driver.accuracyMeters) {
        L.circle([driver.latitude, driver.longitude], {
          radius: driver.accuracyMeters,
          color: '#1d4ed8',
          fillColor: '#60a5fa',
          fillOpacity: 0.13,
          weight: 1
        }).addTo(driverLayer);
      }
    };
    renderDriver();

    const fitRoute = () => {
      const bounds = [];
      if (routeLatLngs.length) bounds.push(...routeLatLngs);
      if (driver) bounds.push([driver.latitude, driver.longitude]);
      if (bounds.length) map.fitBounds(bounds, { padding: [44, 44], maxZoom: 16 });
      else map.setView(fallbackCenter, 13);
    };
    const recenter = () => {
      if (driver && nextStop) {
        map.fitBounds(
          [[driver.latitude, driver.longitude], [nextStop.latitude, nextStop.longitude]],
          { paddingTopLeft: [80, 110], paddingBottomRight: [80, 230], maxZoom: 17 }
        );
      } else if (driver) map.setView([driver.latitude, driver.longitude], Math.max(map.getZoom(), 17), { animate: true });
      else fitRoute();
    };
    const centerOnDriver = () => {
      if (driver) map.setView([driver.latitude, driver.longitude], Math.max(map.getZoom(), 17), { animate: true });
      else fitRoute();
    };

    window.recenterDriver = recenter;
    window.zoomToRoute = fitRoute;
    window.myLocation = centerOnDriver;
    window.updateDriver = (nextDriver, shouldRecenter) => {
      driver = nextDriver;
      renderDriver();
      drawNavigation();
      if (shouldRecenter) recenter();
    };

    if (driver) recenter();
    else fitRoute();

    const fallbackDistance = (from, to) => {
      const radius = 6371000;
      const dLat = (to.latitude - from.latitude) * Math.PI / 180;
      const dLon = (to.longitude - from.longitude) * Math.PI / 180;
      const lat1 = from.latitude * Math.PI / 180;
      const lat2 = to.latitude * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
      return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    const instructionText = (step) => {
      const maneuver = step?.maneuver || {};
      const modifier = String(maneuver.modifier || '');
      const type = String(maneuver.type || '');
      const distance = formatMeters(step?.distance || 0);
      const roadName = step?.name ? ' vao ' + step.name : '';
      const suffix = distance ? ' sau ' + distance : '';
      if (type === 'arrive') return 'Den tram tiep theo';
      if (modifier.includes('left')) return 'Re trai' + suffix + roadName;
      if (modifier.includes('right')) return 'Re phai' + suffix + roadName;
      if (modifier.includes('straight') || type === 'depart' || type === 'new name') {
        return 'Di thang' + suffix + roadName;
      }
      if (type === 'roundabout' || type === 'rotary') return 'Vao vong xoay' + suffix;
      return 'Tiep tuc' + suffix + roadName;
    };
    const drawNavigation = async () => {
      if (!driver || !nextStop) {
        postMessage({ type: 'route', distanceMeters: 0, durationSeconds: 0, instruction: 'Dang cap nhat huong dan' });
        return;
      }
      const routeKey = [
        driver.latitude?.toFixed?.(5) || driver.latitude,
        driver.longitude?.toFixed?.(5) || driver.longitude,
        nextStop.latitude,
        nextStop.longitude
      ].join('|');
      if (routeKey === lastRouteKey) return;
      lastRouteKey = routeKey;
      navigationLayer.clearLayers();
      try {
        const url = 'https://router.project-osrm.org/route/v1/driving/'
          + driver.longitude + ',' + driver.latitude + ';'
          + nextStop.longitude + ',' + nextStop.latitude
          + '?overview=full&geometries=geojson&steps=true';
        const response = await fetch(url);
        const data = await response.json();
        const route = data.routes && data.routes[0];
        if (!route) throw new Error('No route');
        const navigationLatLngs = route.geometry.coordinates.map((coord) => [coord[1], coord[0]]);
        L.polyline(navigationLatLngs, { color: '#f59e0b', weight: 8, opacity: 0.9 }).addTo(navigationLayer);
        const steps = route.legs?.[0]?.steps || [];
        const step = steps.find((item) => item.distance > 15 && item.maneuver?.type !== 'depart') || steps[0];
        postMessage({
          type: 'route',
          distanceMeters: route.distance || 0,
          durationSeconds: route.duration || 0,
          instruction: instructionText(step),
        });
      } catch (error) {
        const distance = fallbackDistance(driver, nextStop);
        L.polyline([[driver.latitude, driver.longitude], [nextStop.latitude, nextStop.longitude]], {
          color: '#f59e0b',
          weight: 7,
          opacity: 0.82,
          dashArray: '10 8'
        }).addTo(navigationLayer);
        postMessage({
          type: 'route',
          distanceMeters: distance,
          durationSeconds: distance / 7,
          instruction: 'Di thang den tram tiep theo',
        });
      }
    };
    drawNavigation();
  </script>
</body>
</html>`;
};

function NavigationMap({
  trip,
  currentGps,
  currentStopIndex,
  routeInfo,
  onRouteInfo,
}: {
  trip: AssignedTrip | null;
  currentGps: DeviceGpsPayload | null;
  currentStopIndex: number;
  routeInfo: RouteInstruction;
  onRouteInfo: (info: RouteInstruction) => void;
}) {
  const webViewRef = useRef<WebView | null>(null);
  const mapPoints = useMemo(() => toMapPoints(getRouteStops(trip || ({} as AssignedTrip))), [trip]);
  const driverLocation = useMemo(() => {
    const tripStartLocation: DeviceGpsPayload | null = trip?.startLocation
      ? {
        latitude: trip.startLocation.latitude,
        longitude: trip.startLocation.longitude,
        accuracyMeters: trip.startLocation.accuracyMeters,
        capturedAt: trip.startLocation.capturedAt || undefined,
      }
      : null;
    const driverSource = isValidGpsCoordinate(currentGps) ? currentGps : tripStartLocation;
    return driverSource && isValidGpsCoordinate(driverSource)
      ? {
        name: 'Vi tri tai xe',
        address: '',
        latitude: Number(driverSource.latitude),
        longitude: Number(driverSource.longitude),
        accuracyMeters: driverSource.accuracyMeters ?? null,
      }
      : null;
  }, [currentGps, trip?.startLocation]);
  const html = useMemo(
    () => buildNavigationMapHtml({ points: mapPoints, driverLocation: null, currentStopIndex }),
    [currentStopIndex, mapPoints],
  );

  useEffect(() => {
    if (!driverLocation) return;
    const serializedDriver = sanitizeForHtml(driverLocation);
    webViewRef.current?.injectJavaScript(`
      window.updateDriver && window.updateDriver(${serializedDriver}, true);
      true;
    `);
  }, [driverLocation]);

  return (
    <View style={styles.navigationShell}>
      <WebView
        ref={webViewRef}
        androidLayerType="hardware"
        cacheEnabled
        domStorageEnabled
        javaScriptEnabled
        onLoadEnd={() => {
          if (!driverLocation) return;
          const serializedDriver = sanitizeForHtml(driverLocation);
          webViewRef.current?.injectJavaScript(`
            window.updateDriver && window.updateDriver(${serializedDriver}, true);
            true;
          `);
        }}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data);
            if (message.type === 'route') {
              onRouteInfo({
                instruction: String(message.instruction || fallbackInstruction(message.distanceMeters)),
                distanceMeters: Number(message.distanceMeters || 0),
                durationSeconds: Number(message.durationSeconds || 0),
              });
            }
          } catch {
            // Ignore malformed map messages.
          }
        }}
        originWhitelist={['*']}
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        source={{ html }}
        style={styles.mapWebView}
      />

      <View pointerEvents="none" style={styles.turnBanner}>
        <MaterialCommunityIcons color={colors.white} name="navigation-variant" size={24} />
        <View style={styles.turnTextWrap}>
          <Text style={styles.turnLabel}>Huong dan tiep theo</Text>
          <Text numberOfLines={2} style={styles.turnText}>{routeInfo.instruction}</Text>
        </View>
      </View>

      <View style={styles.floatingControls}>
        <Pressable
          accessibilityLabel="My location"
          onPress={() => webViewRef.current?.injectJavaScript('window.myLocation && window.myLocation(); true;')}
          style={styles.floatingButton}
        >
          <MaterialCommunityIcons color={colors.primary} name="crosshairs-gps" size={22} />
        </Pressable>
        <Pressable
          accessibilityLabel="Zoom to route"
          onPress={() => webViewRef.current?.injectJavaScript('window.zoomToRoute && window.zoomToRoute(); true;')}
          style={styles.floatingButton}
        >
          <MaterialCommunityIcons color={colors.primary} name="map-search-outline" size={22} />
        </Pressable>
        <Pressable
          accessibilityLabel="Recenter"
          onPress={() => webViewRef.current?.injectJavaScript('window.recenterDriver && window.recenterDriver(); true;')}
          style={styles.floatingButton}
        >
          <MaterialCommunityIcons color={colors.primary} name="navigation-variant-outline" size={22} />
        </Pressable>
      </View>
    </View>
  );
}

export default function TripLifecycleScreen() {
  const params = useLocalSearchParams<{ trip?: string; assignmentId?: string }>();
  const { height: windowHeight } = useWindowDimensions();
  const user = useAuthStore((state) => state.user);
  const initialTrip = useMemo(() => parseTripParam(params.trip), [params.trip]);
  const [trip, setTrip] = useState<AssignedTrip | null>(initialTrip);
  const [currentGps, setCurrentGps] = useState<DeviceGpsPayload | null>(
    initialTrip?.startLocation
      ? {
        latitude: initialTrip.startLocation.latitude,
        longitude: initialTrip.startLocation.longitude,
        accuracyMeters: initialTrip.startLocation.accuracyMeters,
        capturedAt: initialTrip.startLocation.capturedAt || undefined,
      }
      : null,
  );
  const [processingAction, setProcessingAction] = useState('');
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [completedStopCount, setCompletedStopCount] = useState(0);
  const [incidentType, setIncidentType] = useState<DriverIncidentType | null>(null);
  const [incidentSeverity, setIncidentSeverity] = useState<IncidentSeverity>('MEDIUM');
  const [incidentLocation, setIncidentLocation] = useState('');
  const [trafficCategory, setTrafficCategory] = useState('HEAVY_TRAFFIC');
  const [estimatedDelayMinutes, setEstimatedDelayMinutes] = useState('10');
  const [injuriesReported, setInjuriesReported] = useState(false);
  const [policeNotified, setPoliceNotified] = useState(false);
  const [canVehicleContinue, setCanVehicleContinue] = useState(true);
  const [requiresReplacementVehicle, setRequiresReplacementVehicle] = useState(false);
  const [incidentDescription, setIncidentDescription] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [routeInfo, setRouteInfo] = useState<RouteInstruction>({
    instruction: 'Dang cap nhat huong dan',
    distanceMeters: 0,
    durationSeconds: 0,
  });

  const assignmentId = trip?.id || params.assignmentId || '';
  const tripStatus = trip ? getTripStatus(trip) : 'READY';
  const inspectionStatus = trip?.inspection?.status || 'READY';
  const gpsStatus = trip?.gpsSync?.status || 'NOT_REQUESTED';
  const isTripReady = tripStatus === 'READY';
  const isTripInProgress = tripStatus === 'IN_PROGRESS';
  const isTripClosed = ['COMPLETED', 'CANCELLED'].includes(tripStatus);
  const isVehicleReady = inspectionStatus === 'READY';
  const canStart = user?.role === 'DRIVER' && isTripReady && isVehicleReady && !isTripInProgress && !isTripClosed;
  const canComplete = user?.role === 'DRIVER' && isTripInProgress && !isTripClosed;
  const mapPoints = useMemo(() => toMapPoints(getRouteStops(trip || ({} as AssignedTrip))), [trip]);
  const nextStop = mapPoints[currentStopIndex] || null;
  const progress = mapPoints.length ? Math.min(1, completedStopCount / mapPoints.length) : 0;
  const remainingStops = Math.max(0, mapPoints.length - completedStopCount);
  const driverPoint = currentGps?.latitude != null && currentGps?.longitude != null && isValidGpsCoordinate(currentGps)
    ? { latitude: Number(currentGps.latitude), longitude: Number(currentGps.longitude) }
    : null;
  const fallbackMeters = distanceMeters(driverPoint, nextStop);
  const displayDistance = routeInfo.distanceMeters || fallbackMeters;
  const displayDuration = routeInfo.durationSeconds || (fallbackMeters ? fallbackMeters / 7 : 0);
  const navigationHeight = Math.max(620, Math.round(windowHeight * 0.78));
  const selectedIncidentOption = DRIVER_INCIDENT_OPTIONS.find((option) => option.type === incidentType) || null;
  const canReportIncident = Boolean(
    incidentType
    && isTripInProgress
    && incidentLocation.trim().length >= 3
    && incidentDescription.trim().length >= 10
    && !processingAction
  );

  const syncGps = async () => {
    if (!assignmentId) return;
    setProcessingAction('gps');
    try {
      const gps = await getDeviceGpsPayload();
      setCurrentGps(gps);
      if (isTripInProgress) {
        const updated = await scheduleOperationsApi.syncTripGps(assignmentId, { gps });
        setTrip(updated);
      }
    } catch (error) {
      Alert.alert('Khong the tai GPS', getErrorMessage(error, 'Unable to reload GPS for this trip.'));
    } finally {
      setProcessingAction('');
    }
  };

  const markStopArrived = (manual = false) => {
    if (!nextStop) {
      Alert.alert('Hoan thanh chuyen', 'Tat ca tram trong tuyen da hoan thanh. Tai xe co the ket thuc chuyen.');
      return;
    }

    const nextCompletedCount = Math.min(mapPoints.length, currentStopIndex + 1);
    setCompletedStopCount(nextCompletedCount);
    setCurrentStopIndex((index) => Math.min(mapPoints.length, index + 1));

    if (nextCompletedCount >= mapPoints.length) {
      Alert.alert('Hoan thanh tat ca tram', 'Da di het cac tram trong tuyen. Ban co the bam Hoan thanh chuyen.');
    } else if (manual) {
      Alert.alert('Da den tram', `Dang huong den tram ${nextCompletedCount + 1}.`);
    }
  };

  useEffect(() => {
    let isMounted = true;
    void getDeviceGpsPayload().then((gps) => {
      if (isMounted && isValidGpsCoordinate(gps)) {
        setCurrentGps(gps);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isTripInProgress) return undefined;

    let subscription: { remove: () => void } | null = null;
    let isMounted = true;

    void watchDeviceGps(
      (gps) => {
        if (isMounted && isValidGpsCoordinate(gps)) {
          setCurrentGps(gps);
        }
      },
      (gps) => {
        if (isMounted) {
          setCurrentGps(gps);
        }
      },
    ).then((watchSubscription) => {
      subscription = watchSubscription;
    });

    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, [isTripInProgress]);

  useEffect(() => {
    if (!isTripInProgress || !driverPoint || !nextStop) return;
    if (distanceMeters(driverPoint, nextStop) <= ARRIVAL_RADIUS_METERS) {
      markStopArrived(false);
    }
  }, [driverPoint, isTripInProgress, nextStop]);

  const startTrip = async () => {
    if (!assignmentId) return;
    setProcessingAction('start');
    try {
      const gps = await getDeviceGpsPayload();
      setCurrentGps(gps);
      const updated = await scheduleOperationsApi.startTrip(assignmentId, { gps });
      setTrip(updated);
      Alert.alert('Bat dau chuyen', `Trip started. GPS: ${updated.gpsSync?.status || 'UNKNOWN'}.`);
    } catch (error) {
      Alert.alert('Khong the bat dau chuyen', getErrorMessage(error, 'Unable to start this trip.'));
    } finally {
      setProcessingAction('');
    }
  };

  const completeTrip = async () => {
    if (!assignmentId) return;
    if (completedStopCount < mapPoints.length) {
      Alert.alert(
        'Chua di het tram',
        `Da di ${completedStopCount}/${mapPoints.length} tram. Ban van muon hoan thanh chuyen?`,
        [
          { text: 'Huy', style: 'cancel' },
          { text: 'Hoan thanh', onPress: () => void completeTripRequest() },
        ],
      );
      return;
    }
    await completeTripRequest();
  };

  const completeTripRequest = async () => {
    if (!assignmentId) return;
    setProcessingAction('complete');
    try {
      const updated = await scheduleOperationsApi.completeTrip(assignmentId);
      setTrip(updated);
      Alert.alert('UC45 completed', 'Trip has been completed.');
    } catch (error) {
      Alert.alert('Khong the hoan thanh chuyen', getErrorMessage(error, 'Unable to complete this trip.'));
    } finally {
      setProcessingAction('');
    }
  };

  const chooseEvidenceFiles = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Can quyen truy cap anh', 'Vui long cho phep truy cap thu vien anh de gui anh hien truong.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.72,
      selectionLimit: Math.max(1, 5 - evidenceFiles.length),
    });

    if (result.canceled) return;

    const selectedFiles = result.assets.slice(0, Math.max(0, 5 - evidenceFiles.length)).map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName || `incident-${Date.now()}-${index + 1}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    }));
    setEvidenceFiles((current) => [...current, ...selectedFiles].slice(0, 5));
  };

  const reportIncident = async () => {
    if (!assignmentId || !incidentType) return;
    const description = incidentDescription.trim();
    if (description.length < 10) {
      Alert.alert('Can mo ta su co', 'Vui long nhap it nhat 10 ky tu.');
      return;
    }
    if (incidentLocation.trim().length < 3) {
      Alert.alert('Can vi tri su co', 'Vui long nhap vi tri su co.');
      return;
    }

    const payload: Record<string, unknown> = {
      type: incidentType,
      severity: incidentType === 'ACCIDENT' && incidentSeverity === 'LOW' ? 'MEDIUM' : incidentSeverity,
      description,
      locationText: incidentLocation.trim(),
      latitude: currentGps?.latitude,
      longitude: currentGps?.longitude,
      evidenceFiles,
    };

    if (incidentType === 'TRAFFIC_CONGESTION') {
      payload.trafficCategory = trafficCategory;
      payload.affectedDirection = 'CURRENT_DIRECTION';
      payload.estimatedDelayMinutes = Math.max(1, Number(estimatedDelayMinutes) || 10);
    }

    if (incidentType === 'ACCIDENT') {
      payload.injuriesReported = injuriesReported;
      payload.policeNotified = policeNotified;
    }

    if (incidentType === 'VEHICLE_BREAKDOWN') {
      payload.canContinue = canVehicleContinue;
      payload.requiresReplacementVehicle = requiresReplacementVehicle;
    }

    setProcessingAction('incident');
    try {
      await scheduleOperationsApi.reportOperationIncident(assignmentId, payload);
      setIncidentDescription('');
      setIncidentLocation('');
      setEvidenceFiles([]);
      setIncidentType(null);
      Alert.alert('Da gui bao cao', 'Su co da duoc gui ve dieu hanh.');
    } catch (error) {
      Alert.alert('Khong the gui bao cao', getErrorMessage(error, 'Unable to report incident.'));
    } finally {
      setProcessingAction('');
    }
  };

  return (
    <View style={styles.screenShell}>
      <Screen>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back" hitSlop={10} onPress={() => goBackOrReplace('/driver-assistant/assigned-trips')}>
            <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>TRIP NAVIGATION</Text>
            <Text numberOfLines={1} style={styles.title}>{trip?.route?.routeNumber || trip?.tripCode || 'Dang van hanh'}</Text>
          </View>
          <View style={styles.gpsPill}>
            <Text style={styles.gpsPillText}>{gpsStatus}</Text>
          </View>
        </View>

        <View style={[styles.navigationCard, { height: navigationHeight }]}>
          <NavigationMap
            currentGps={currentGps}
            currentStopIndex={currentStopIndex}
            onRouteInfo={setRouteInfo}
            routeInfo={routeInfo}
            trip={trip}
          />

          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text numberOfLines={1} style={styles.routeTitle}>{trip?.route?.name || 'Tuyen xe bus'}</Text>
            <Text style={styles.sheetLabel}>Dang huong den</Text>
            <Text numberOfLines={2} style={styles.nextStopName}>
              {nextStop ? `Tram ${currentStopIndex + 1} - ${nextStop.name}` : 'Tat ca tram da hoan thanh'}
            </Text>

            <View style={styles.metricsRow}>
              <View style={styles.metricBox}>
                <Text style={styles.metricValue}>{formatDistance(displayDistance)}</Text>
                <Text style={styles.metricLabel}>Con lai</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricValue}>{formatEta(displayDuration)}</Text>
                <Text style={styles.metricLabel}>ETA</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricValue}>{remainingStops}</Text>
                <Text style={styles.metricLabel}>Tram con lai</Text>
              </View>
            </View>

            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>Da di {completedStopCount}/{mapPoints.length} tram</Text>
              <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>

            <View style={styles.driverInfoRow}>
              <Text numberOfLines={1} style={styles.driverInfo}>Xe: {trip?.vehicle?.code || trip?.vehicle?.plateNumber || 'N/A'}</Text>
              <Text numberOfLines={1} style={styles.driverInfo}>Gio: {formatTime(trip?.scheduledStart)}</Text>
            </View>
            <View style={styles.driverInfoRow}>
              <Text numberOfLines={1} style={styles.driverInfo}>Vi do: {formatCoordinate(currentGps?.latitude)}</Text>
              <Text numberOfLines={1} style={styles.driverInfo}>Kinh do: {formatCoordinate(currentGps?.longitude)}</Text>
            </View>

            <View style={styles.sheetActions}>
              <AppButton
                title={canStart ? 'Bat dau chuyen' : 'Da den tram'}
                disabled={canStart ? false : !isTripInProgress || !nextStop}
                loading={processingAction === 'start'}
                onPress={canStart ? startTrip : () => markStopArrived(true)}
                style={styles.sheetAction}
              />
              <AppButton
                title="Hoan thanh chuyen"
                disabled={!canComplete}
                loading={processingAction === 'complete'}
                onPress={completeTrip}
                style={styles.sheetAction}
                variant="secondary"
              />
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={processingAction === 'gps'}
              onPress={syncGps}
              style={({ pressed }) => [styles.gpsReload, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons color={colors.primary} name="reload" size={18} />
              <Text style={styles.gpsReloadText}>{processingAction === 'gps' ? 'Dang tai GPS...' : 'Tai lai GPS'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.reportSection}>
          <View style={styles.reportHeader}>
            <View style={styles.reportTitleRow}>
              <MaterialCommunityIcons color={colors.error} name="alert-circle-outline" size={22} />
              <Text style={styles.reportTitle}>Bao cao su co</Text>
            </View>
            <View style={styles.reportStatusPill}>
              <Text style={styles.reportStatusText}>{isTripInProgress ? 'Dang van hanh' : 'Chua mo'}</Text>
            </View>
          </View>
          <Text style={styles.reportHint}>Chi bao su co khi chuyen dang van hanh. Bao cao se gui ve dieu hanh de xu ly.</Text>

          {!incidentType ? (
            <View style={styles.incidentPickerPanel}>
              <View style={styles.incidentPanelHeader}>
                <View>
                  <Text style={styles.incidentPanelTitle}>Bao cao su co</Text>
                  <Text style={styles.reportHint}>Chon loai su co dang xay ra de mo dung form bao cao.</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={!isTripInProgress}
                  onPress={() => setIncidentType('TRAFFIC_CONGESTION')}
                  style={[styles.reportButtonSmall, !isTripInProgress && styles.reportButtonDisabled]}
                >
                  <MaterialCommunityIcons color={colors.white} name="alert-outline" size={16} />
                  <Text style={styles.reportButtonSmallText}>Bao cao</Text>
                </Pressable>
              </View>

              <View style={styles.incidentCardsGrid}>
                {DRIVER_INCIDENT_OPTIONS.map((option) => (
                  <Pressable
                    key={option.type}
                    accessibilityRole="button"
                    disabled={!isTripInProgress || Boolean(processingAction)}
                    onPress={() => {
                      setIncidentType(option.type);
                      setIncidentSeverity(option.type === 'ACCIDENT' ? 'MEDIUM' : 'MEDIUM');
                      setIncidentLocation(nextStop?.name || trip?.route?.name || '');
                    }}
                    style={({ pressed }) => [
                      styles.incidentTypeCard,
                      (!isTripInProgress || Boolean(processingAction)) && styles.disabledCard,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.incidentTypeIcon}>
                      <MaterialCommunityIcons color={colors.error} name={option.icon} size={22} />
                    </View>
                    <Text style={styles.incidentTypeTitle}>{option.code} - {option.label}</Text>
                    <Text style={styles.incidentTypeDescription}>{option.description}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.incidentFormPanel}>
              <View style={styles.selectedIncidentHeader}>
                <View style={styles.selectedIncidentTitleWrap}>
                  <Text style={styles.selectedIncidentTitle}>
                    {selectedIncidentOption?.code} - {selectedIncidentOption?.label}
                  </Text>
                  <Text style={styles.reportHint}>Nhap thong tin chi tiet de gui ve dieu hanh.</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setIncidentType(null)}
                  style={styles.changeIncidentButton}
                >
                  <Text style={styles.changeIncidentText}>Doi loai su co</Text>
                </Pressable>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Muc do</Text>
                <View style={styles.optionWrap}>
                  {INCIDENT_SEVERITIES.map((severity) => {
                    const isDisabled = incidentType === 'ACCIDENT' && severity.value === 'LOW';
                    const isActive = incidentSeverity === severity.value;
                    return (
                      <Pressable
                        key={severity.value}
                        accessibilityRole="button"
                        disabled={isDisabled}
                        onPress={() => setIncidentSeverity(severity.value)}
                        style={[
                          styles.optionChip,
                          isActive && styles.optionChipActive,
                          isDisabled && styles.optionChipDisabled,
                        ]}
                      >
                        <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>{severity.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Vi tri</Text>
                <TextInput
                  editable={isTripInProgress && !Boolean(processingAction)}
                  onChangeText={setIncidentLocation}
                  placeholder="Vi du: gan cau Rong"
                  placeholderTextColor={colors.muted}
                  style={styles.singleLineInput}
                  value={incidentLocation}
                />
              </View>

              {incidentType === 'TRAFFIC_CONGESTION' ? (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Loai ket xe</Text>
                    <View style={styles.optionWrap}>
                      {TRAFFIC_CATEGORIES.map((category) => {
                        const isActive = trafficCategory === category.value;
                        return (
                          <Pressable
                            key={category.value}
                            accessibilityRole="button"
                            onPress={() => setTrafficCategory(category.value)}
                            style={[styles.optionChipWide, isActive && styles.optionChipActive]}
                          >
                            <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>{category.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Uoc tinh tre phut</Text>
                    <TextInput
                      editable={isTripInProgress && !Boolean(processingAction)}
                      keyboardType="number-pad"
                      onChangeText={setEstimatedDelayMinutes}
                      placeholder="10"
                      placeholderTextColor={colors.muted}
                      style={styles.singleLineInput}
                      value={estimatedDelayMinutes}
                    />
                  </View>
                </>
              ) : null}

              {incidentType === 'ACCIDENT' ? (
                <View style={styles.checkboxGrid}>
                  <Pressable style={styles.checkboxRow} onPress={() => setInjuriesReported((value) => !value)}>
                    <MaterialCommunityIcons color={injuriesReported ? colors.error : colors.muted} name={injuriesReported ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} />
                    <Text style={styles.checkboxText}>Co nguoi bi thuong</Text>
                  </Pressable>
                  <Pressable style={styles.checkboxRow} onPress={() => setPoliceNotified((value) => !value)}>
                    <MaterialCommunityIcons color={policeNotified ? colors.error : colors.muted} name={policeNotified ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} />
                    <Text style={styles.checkboxText}>Da bao co quan chuc nang</Text>
                  </Pressable>
                </View>
              ) : null}

              {incidentType === 'VEHICLE_BREAKDOWN' ? (
                <View style={styles.checkboxGrid}>
                  <Pressable style={styles.checkboxRow} onPress={() => setCanVehicleContinue((value) => !value)}>
                    <MaterialCommunityIcons color={canVehicleContinue ? colors.error : colors.muted} name={canVehicleContinue ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} />
                    <Text style={styles.checkboxText}>Xe con co the tiep tuc chay</Text>
                  </Pressable>
                  <Pressable style={styles.checkboxRow} onPress={() => setRequiresReplacementVehicle((value) => !value)}>
                    <MaterialCommunityIcons color={requiresReplacementVehicle ? colors.error : colors.muted} name={requiresReplacementVehicle ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} />
                    <Text style={styles.checkboxText}>Can xe thay the</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Mo ta</Text>
                <TextInput
                  editable={isTripInProgress && !Boolean(processingAction)}
                  multiline
                  onChangeText={setIncidentDescription}
                  placeholder="Mo ta ro tinh huong, muc anh huong va hanh dong da thuc hien."
                  placeholderTextColor={colors.muted}
                  style={styles.incidentInput}
                  value={incidentDescription}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Anh hien truong</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={evidenceFiles.length >= 5 || Boolean(processingAction)}
                  onPress={chooseEvidenceFiles}
                  style={styles.filePicker}
                >
                  <View style={styles.filePickerButton}>
                    <Text style={styles.filePickerButtonText}>Chon tep</Text>
                  </View>
                  <Text numberOfLines={1} style={styles.filePickerText}>
                    {evidenceFiles.length ? `${evidenceFiles.length} tep da chon` : 'Khong co tep nao duoc chon'}
                  </Text>
                </Pressable>
                <Text style={styles.fileHelp}>Co the chup hoac chon toi da 5 anh JPG, PNG, WEBP de admin xem tinh hinh ro hon.</Text>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={!canReportIncident}
                onPress={reportIncident}
                style={({ pressed }) => [
                  styles.reportButton,
                  !canReportIncident && styles.reportButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialCommunityIcons color={colors.white} name="send-outline" size={18} />
                <Text style={styles.reportButtonText}>{processingAction === 'incident' ? 'Dang gui...' : 'Gui bao cao su co'}</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </Screen>
      <RoleBottomNav active="trips" role={user?.role} />
    </View>
  );
}

const styles = StyleSheet.create({
  screenShell: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  headerText: { flex: 1 },
  kicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  gpsPill: { borderRadius: 16, backgroundColor: '#d4f2e5', paddingHorizontal: 10, paddingVertical: 6 },
  gpsPillText: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  navigationCard: {
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: colors.card,
  },
  navigationShell: { flex: 1, minHeight: 0, backgroundColor: colors.surfaceLow },
  mapWebView: { flex: 1, backgroundColor: colors.surfaceLow },
  turnBanner: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 76,
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 26, 15, 0.92)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  turnTextWrap: { flex: 1 },
  turnLabel: { color: '#bbf7d0', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  turnText: { color: colors.white, fontSize: 18, fontWeight: '900' },
  floatingControls: { position: 'absolute', right: 14, top: 14, gap: 10 },
  floatingButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
    shadowColor: colors.primary,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  bottomSheet: {
    minHeight: 286,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  sheetHandle: { alignSelf: 'center', width: 48, height: 5, borderRadius: 999, backgroundColor: colors.outline, marginBottom: 10 },
  routeTitle: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  sheetLabel: { marginTop: 8, color: colors.accent, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  nextStopName: { marginTop: 3, color: colors.text, fontSize: 20, lineHeight: 25, fontWeight: '900' },
  metricsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  metricBox: { flex: 1, borderRadius: 16, backgroundColor: colors.surfaceLow, padding: 10 },
  metricValue: { color: colors.primary, fontSize: 17, fontWeight: '900' },
  metricLabel: { marginTop: 2, color: colors.muted, fontSize: 10, fontWeight: '800' },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  progressText: { color: colors.muted, fontSize: 12, fontWeight: '900' },
  progressTrack: { height: 10, overflow: 'hidden', borderRadius: 999, backgroundColor: colors.surfaceHigh, marginTop: 7 },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.accent },
  driverInfoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 9 },
  driverInfo: { flex: 1, color: colors.muted, fontSize: 11, fontWeight: '800' },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  sheetAction: { flex: 1, minHeight: 52 },
  gpsReload: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: colors.surfaceLow,
  },
  gpsReloadText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  reportSection: {
    gap: 12,
    marginTop: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff7f7',
    padding: 16,
  },
  reportHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  reportTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  reportTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  reportStatusPill: { borderRadius: 16, backgroundColor: '#d4f2e5', paddingHorizontal: 10, paddingVertical: 6 },
  reportStatusText: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  reportHint: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  incidentPickerPanel: { gap: 14, borderRadius: 16, backgroundColor: colors.card, padding: 12 },
  incidentPanelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  incidentPanelTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  reportButtonSmall: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    backgroundColor: colors.error,
    paddingHorizontal: 12,
  },
  reportButtonSmallText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  incidentCardsGrid: { gap: 10 },
  incidentTypeCard: {
    gap: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
    padding: 14,
  },
  disabledCard: { opacity: 0.58 },
  incidentTypeIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.card,
  },
  incidentTypeTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  incidentTypeDescription: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  incidentFormPanel: { gap: 14 },
  selectedIncidentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: colors.card,
    padding: 12,
  },
  selectedIncidentTitleWrap: { flex: 1 },
  selectedIncidentTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  changeIncidentButton: {
    minHeight: 42,
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: colors.card,
    paddingHorizontal: 12,
  },
  changeIncidentText: { color: colors.error, fontSize: 12, fontWeight: '900' },
  fieldGroup: { gap: 7 },
  fieldLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  singleLineInput: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 12,
  },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
  },
  optionChipWide: {
    minHeight: 42,
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
  },
  optionChipActive: { borderColor: colors.error, backgroundColor: colors.error },
  optionChipDisabled: { opacity: 0.35 },
  optionChipText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  optionChipTextActive: { color: colors.white },
  checkboxGrid: { gap: 10 },
  checkboxRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: colors.card,
    paddingHorizontal: 12,
  },
  checkboxText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '800' },
  incidentTypeRow: { flexDirection: 'row', gap: 8 },
  incidentChip: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: colors.card,
    paddingHorizontal: 8,
  },
  incidentChipActive: { borderColor: colors.error, backgroundColor: colors.error },
  incidentChipText: { color: colors.error, fontSize: 12, fontWeight: '900' },
  incidentChipTextActive: { color: colors.white },
  incidentInput: {
    minHeight: 112,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    padding: 14,
    textAlignVertical: 'top',
  },
  reportButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: colors.error,
    paddingHorizontal: 18,
  },
  reportButtonDisabled: { opacity: 0.5 },
  reportButtonText: { color: colors.white, fontSize: 16, fontWeight: '900' },
  filePicker: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
  },
  filePickerButton: { borderRadius: 10, backgroundColor: colors.errorContainer, paddingHorizontal: 12, paddingVertical: 10 },
  filePickerButtonText: { color: colors.error, fontSize: 13, fontWeight: '900' },
  filePickerText: { flex: 1, marginLeft: 10, color: colors.muted, fontSize: 13, fontWeight: '700' },
  fileHelp: { color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  bottomSpacer: { height: 98 },
  pressed: { transform: [{ scale: 0.98 }] },
});
