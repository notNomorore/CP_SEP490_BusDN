import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, PanResponder, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';

import scheduleOperationsApi from '@/api/scheduleOperations.api';
import { AppButton } from '@/components/AppButton';
import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/colors';
import { formatDriverStatus, useDriverI18n, type DriverTranslation } from '@/i18n/driver';
import { useAuthStore } from '@/store/auth.store';
import type { AssignedTrip, RoutePoint } from '@/types/scheduleOperations';
import { getDeviceGpsPayload, type DeviceGpsPayload, watchDeviceGps } from '@/utils/deviceGps';
import { goBackOrReplace } from '@/utils/navigation';
import {
  formatCoordinate,
  formatTime,
  getTripArrivalTimeLabel,
  getTripDepartureTimeLabel,
  getTripScheduleAdjustmentMinutes,
  getRoutePathPoints,
  getRouteStops,
  getTripStatus,
  getVehicleLabel,
  hasVehicleReplacement,
  hasTripScheduleAdjustment,
} from '@/utils/scheduleOperations';
import { getErrorMessage } from '@/utils/validation';

const ARRIVAL_RADIUS_METERS = 30;
const LIVE_GPS_SYNC_INTERVAL_MS = 10000;
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
type BreakdownType = 'ENGINE_FAILURE' | 'BRAKE_FAILURE' | 'FLAT_TIRE' | 'ACCIDENT' | 'OTHER';
type EvidenceFile = {
  uri: string;
  name?: string;
  type?: string;
};

const DRIVER_INCIDENT_OPTIONS: Array<{
  type: DriverIncidentType;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}> = [
  {
    type: 'TRAFFIC_CONGESTION',
    icon: 'traffic-cone',
  },
  {
    type: 'ACCIDENT',
    icon: 'alert-octagon-outline',
  },
  {
    type: 'VEHICLE_BREAKDOWN',
    icon: 'bus-alert',
  },
];

const isValidRouteCoordinate = (point: RoutePoint) => (
  Number.isFinite(Number(point.latitude))
  && Number.isFinite(Number(point.longitude))
);

const isValidGpsCoordinate = (point?: DeviceGpsPayload | null) => (
  typeof point?.latitude === 'number'
  && typeof point?.longitude === 'number'
  && Number.isFinite(point.latitude)
  && Number.isFinite(point.longitude)
);

const toDeviceGpsPayload = (location?: AssignedTrip['startLocation'] | null): DeviceGpsPayload | null => {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
    accuracyMeters: location?.accuracyMeters,
    capturedAt: location?.capturedAt || undefined,
  };
};

const toMapPoints = (stops: RoutePoint[], stopPrefix = 'Trạm'): MapPoint[] => stops
  .filter(isValidRouteCoordinate)
  .map((stop, index) => ({
    name: stop.stopName || `${stopPrefix} ${index + 1}`,
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

const formatDistance = (meters: number, t: DriverTranslation) => {
  if (!Number.isFinite(meters) || meters <= 0) return t.lifecycle.updatingInstruction;
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.max(1, Math.round(meters))} m`;
};

const fallbackInstruction = (meters: number, t: DriverTranslation) => (
  meters > 0
    ? t.lifecycle.straightDistance.replace('{{distance}}', formatDistance(meters, t))
    : t.lifecycle.updatingInstruction
);

const sanitizeForHtml = <T,>(value: T): string => (
  JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
);

const buildNavigationMapHtml = ({
  routePoints,
  stopPoints,
  driverLocation,
  currentStopIndex,
  labels,
}: {
  routePoints: MapPoint[];
  stopPoints: MapPoint[];
  driverLocation?: DriverMapPoint | null;
  currentStopIndex: number;
  labels: {
    driverLocation: string;
    accuracy: string;
    updatingInstruction: string;
    straightToNextStop: string;
    arriveNextStop: string;
    straight: string;
    left: string;
    right: string;
    roundabout: string;
    continue: string;
    after: string;
    onto: string;
  };
}) => {
  const serializedRoutePoints = sanitizeForHtml(routePoints);
  const serializedStopPoints = sanitizeForHtml(stopPoints);
  const serializedDriver = sanitizeForHtml(driverLocation || null);
  const serializedLabels = sanitizeForHtml(labels);

  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #e8f4ef; touch-action: none; }
    .leaflet-control-attribution { font-size: 9px; }
    .leaflet-control-zoom { border: 0 !important; box-shadow: 0 6px 16px rgba(0, 26, 15, 0.22); }
    .leaflet-control-zoom a {
      width: 38px !important;
      height: 38px !important;
      line-height: 38px !important;
      color: #002b1d !important;
      font: 900 22px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
    }
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
    const routePoints = ${serializedRoutePoints};
    const stopPoints = ${serializedStopPoints};
    let driver = ${serializedDriver};
    const labels = ${serializedLabels};
    const currentStopIndex = ${currentStopIndex};
    const fallbackCenter = [${DRIVER_FALLBACK_CENTER.latitude}, ${DRIVER_FALLBACK_CENTER.longitude}];
    const map = L.map('map', {
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: false
    });
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

    const routeLatLngs = (routePoints.length ? routePoints : stopPoints).map((point) => [point.latitude, point.longitude]);
    const nextStop = stopPoints[currentStopIndex] || null;
    if (routeLatLngs.length) {
      L.polyline(routeLatLngs, { color: '#2563eb', weight: 5, opacity: 0.62 }).addTo(map);
    }

    stopPoints.forEach((point, index) => {
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
        .bindPopup('<div class="popup-title">' + labels.driverLocation + '</div><div class="popup-address">' + labels.accuracy + ': ' + Math.round(driver.accuracyMeters || 0) + ' m</div>');
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
      const roadName = step?.name ? labels.onto + ' ' + step.name : '';
      const suffix = distance ? labels.after + ' ' + distance : '';
      if (type === 'arrive') return labels.arriveNextStop;
      if (modifier.includes('left')) return labels.left + suffix + roadName;
      if (modifier.includes('right')) return labels.right + suffix + roadName;
      if (modifier.includes('straight') || type === 'depart' || type === 'new name') {
        return labels.straight + suffix + roadName;
      }
      if (type === 'roundabout' || type === 'rotary') return labels.roundabout + suffix;
      return labels.continue + suffix + roadName;
    };
    const drawNavigation = async () => {
      if (!driver || !nextStop) {
        postMessage({ type: 'route', distanceMeters: 0, durationSeconds: 0, instruction: labels.updatingInstruction });
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
          instruction: labels.straightToNextStop,
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
  nextInstructionLabel,
  t,
}: {
  trip: AssignedTrip | null;
  currentGps: DeviceGpsPayload | null;
  currentStopIndex: number;
  routeInfo: RouteInstruction;
  onRouteInfo: (info: RouteInstruction) => void;
  nextInstructionLabel: string;
  t: DriverTranslation;
}) {
  const webViewRef = useRef<WebView | null>(null);
  const routeMapPoints = useMemo(() => toMapPoints(getRoutePathPoints(trip || ({} as AssignedTrip)), t.lifecycle.stopPrefix), [t, trip]);
  const routeStopPoints = useMemo(() => toMapPoints(getRouteStops(trip || ({} as AssignedTrip)), t.lifecycle.stopPrefix), [t, trip]);
  const stopMapPoints = routeStopPoints.length ? routeStopPoints : routeMapPoints;
  const driverLocation = useMemo(() => {
    const tripStartLocation = toDeviceGpsPayload(trip?.startLocation);
    const driverSource = isValidGpsCoordinate(currentGps) ? currentGps : tripStartLocation;
    return driverSource && isValidGpsCoordinate(driverSource)
      ? {
        name: t.detail.driverGps,
        address: '',
        latitude: Number(driverSource.latitude),
        longitude: Number(driverSource.longitude),
        accuracyMeters: driverSource.accuracyMeters ?? null,
      }
      : null;
  }, [currentGps, trip?.startLocation]);
  const html = useMemo(
    () => buildNavigationMapHtml({
      routePoints: routeMapPoints,
      stopPoints: stopMapPoints,
      driverLocation: null,
      currentStopIndex,
      labels: {
        driverLocation: t.detail.driverGps,
        accuracy: t.common.accuracy,
        updatingInstruction: t.lifecycle.updatingInstruction,
        straightToNextStop: t.lifecycle.straightToNextStop,
        arriveNextStop: t.lifecycle.arriveNextStop,
        straight: t.lifecycle.straightCommand,
        left: t.lifecycle.leftCommand,
        right: t.lifecycle.rightCommand,
        roundabout: t.lifecycle.roundaboutCommand,
        continue: t.lifecycle.continueCommand,
        after: t.lifecycle.afterDistance,
        onto: t.lifecycle.ontoRoad,
      },
    }),
    [currentStopIndex, routeMapPoints, stopMapPoints, t],
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
                instruction: String(message.instruction || fallbackInstruction(message.distanceMeters, t)),
                distanceMeters: Number(message.distanceMeters || 0),
                durationSeconds: Number(message.durationSeconds || 0),
              });
            }
          } catch {
            // Ignore malformed map messages.
          }
        }}
        originWhitelist={['*']}
        bounces={false}
        nestedScrollEnabled
        scrollEnabled
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        setSupportMultipleWindows={false}
        source={{ html }}
        style={styles.mapWebView}
      />

      <View pointerEvents="none" style={styles.turnBanner}>
        <MaterialCommunityIcons color={colors.white} name="navigation-variant" size={24} />
        <View style={styles.turnTextWrap}>
          <Text style={styles.turnLabel}>{nextInstructionLabel}</Text>
          <Text numberOfLines={2} style={styles.turnText}>{routeInfo.instruction}</Text>
        </View>
      </View>

      <View style={styles.floatingControls}>
        <Pressable
          accessibilityLabel={t.lifecycle.myLocation}
          onPress={() => webViewRef.current?.injectJavaScript('window.myLocation && window.myLocation(); true;')}
          style={styles.floatingButton}
        >
          <MaterialCommunityIcons color={colors.primary} name="crosshairs-gps" size={22} />
        </Pressable>
      </View>
    </View>
  );
}

export default function TripLifecycleScreen() {
  const params = useLocalSearchParams<{ trip?: string; assignmentId?: string }>();
  const { height: windowHeight } = useWindowDimensions();
  const user = useAuthStore((state) => state.user);
  const { t } = useDriverI18n();
  const initialTrip = useMemo(() => parseTripParam(params.trip), [params.trip]);
  const [trip, setTrip] = useState<AssignedTrip | null>(initialTrip);
  const [currentGps, setCurrentGps] = useState<DeviceGpsPayload | null>(
    toDeviceGpsPayload(initialTrip?.startLocation),
  );
  const lastGpsSyncAtRef = useRef(0);
  const gpsSyncInFlightRef = useRef(false);
  const [processingAction, setProcessingAction] = useState('');
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [completedStopCount, setCompletedStopCount] = useState(0);
  const [incidentType, setIncidentType] = useState<DriverIncidentType | null>(null);
  const [incidentSeverity, setIncidentSeverity] = useState<IncidentSeverity>('MEDIUM');
  const [trafficCategory, setTrafficCategory] = useState('HEAVY_TRAFFIC');
  const [estimatedDelayMinutes, setEstimatedDelayMinutes] = useState('10');
  const [injuriesReported, setInjuriesReported] = useState(false);
  const [policeNotified, setPoliceNotified] = useState(false);
  const [breakdownType, setBreakdownType] = useState<BreakdownType>('ENGINE_FAILURE');
  const [incidentDescription, setIncidentDescription] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [routeInfo, setRouteInfo] = useState<RouteInstruction>({
    instruction: t.lifecycle.updatingInstruction,
    distanceMeters: 0,
    durationSeconds: 0,
  });
  const incidentOptions = useMemo(() => ([
    { ...DRIVER_INCIDENT_OPTIONS[0], label: t.lifecycle.traffic, description: t.lifecycle.trafficDesc },
    { ...DRIVER_INCIDENT_OPTIONS[1], label: t.lifecycle.accident, description: t.lifecycle.accidentDesc },
    { ...DRIVER_INCIDENT_OPTIONS[2], label: t.lifecycle.breakdown, description: t.lifecycle.breakdownDesc },
  ]), [t]);
  const severityOptions = useMemo(() => ([
    { value: 'LOW' as const, label: t.lifecycle.low },
    { value: 'MEDIUM' as const, label: t.lifecycle.medium },
    { value: 'HIGH' as const, label: t.lifecycle.high },
    { value: 'CRITICAL' as const, label: t.lifecycle.critical },
  ]), [t]);
  const trafficCategoryOptions = useMemo(() => ([
    { value: 'HEAVY_TRAFFIC', label: t.lifecycle.trafficHeavy },
    { value: 'ROADWORK', label: t.lifecycle.roadwork },
    { value: 'FLOODING', label: t.lifecycle.flooding },
    { value: 'EVENT_CROWD', label: t.lifecycle.eventCrowd },
    { value: 'STOP_OVERLOAD', label: t.lifecycle.stopOverload },
    { value: 'TEMPORARY_BLOCK', label: t.lifecycle.temporaryBlock },
    { value: 'OTHER', label: t.lifecycle.other },
  ]), [t]);
  const breakdownTypeOptions = useMemo(() => ([
    { value: 'ENGINE_FAILURE' as const, label: t.lifecycle.engineFailure },
    { value: 'BRAKE_FAILURE' as const, label: t.lifecycle.brakeFailure },
    { value: 'FLAT_TIRE' as const, label: t.lifecycle.flatTire },
    { value: 'ACCIDENT' as const, label: t.lifecycle.accident },
    { value: 'OTHER' as const, label: t.lifecycle.other },
  ]), [t]);

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
  const mapPoints = useMemo(() => toMapPoints(getRoutePathPoints(trip || ({} as AssignedTrip)), t.lifecycle.stopPrefix), [t, trip]);
  const routeStops = useMemo(() => toMapPoints(getRouteStops(trip || ({} as AssignedTrip)), t.lifecycle.stopPrefix), [t, trip]);
  const stopPoints = routeStops.length ? routeStops : mapPoints;
  const nextStop = stopPoints[currentStopIndex] || null;
  const driverPoint = currentGps?.latitude != null && currentGps?.longitude != null && isValidGpsCoordinate(currentGps)
    ? { latitude: Number(currentGps.latitude), longitude: Number(currentGps.longitude) }
    : null;
  const navigationHeight = Math.max(620, Math.round(windowHeight * 0.78));
  const expandedSheetHeight = Math.min(245, Math.max(220, Math.round(windowHeight * 0.26)));
  const collapsedSheetHeight = 66;
  const maxSheetTranslate = expandedSheetHeight - collapsedSheetHeight;
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const sheetOffsetRef = useRef(0);
  const animateSheet = useCallback((toValue: number) => {
    sheetOffsetRef.current = toValue;
    Animated.spring(sheetTranslateY, {
      toValue,
      useNativeDriver: true,
      damping: 24,
      stiffness: 220,
    }).start();
  }, [sheetTranslateY]);
  const sheetPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 2,
    onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dy) > 2,
    onPanResponderGrant: () => {
      sheetTranslateY.stopAnimation((value) => {
        sheetOffsetRef.current = Math.min(maxSheetTranslate, Math.max(0, Number(value) || 0));
      });
    },
    onPanResponderMove: (_, gesture) => {
      const nextValue = Math.min(maxSheetTranslate, Math.max(0, sheetOffsetRef.current + gesture.dy));
      sheetTranslateY.setValue(nextValue);
    },
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dy) < 6) {
        animateSheet(sheetOffsetRef.current > 0 ? 0 : maxSheetTranslate);
        return;
      }
      const currentValue = Math.min(maxSheetTranslate, Math.max(0, sheetOffsetRef.current + gesture.dy));
      const shouldCollapse = gesture.vy > 0.25 || currentValue > maxSheetTranslate / 2;
      animateSheet(shouldCollapse ? maxSheetTranslate : 0);
    },
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  }), [animateSheet, maxSheetTranslate, sheetTranslateY]);
  const selectedIncidentOption = incidentOptions.find((option) => option.type === incidentType) || null;
  const canReportIncident = Boolean(
    incidentType
    && isTripInProgress
    && incidentDescription.trim().length >= 10
    && (!['TRAFFIC_CONGESTION', 'ACCIDENT'].includes(String(incidentType)) || Number(estimatedDelayMinutes) >= 1)
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
      Alert.alert(t.lifecycle.gpsUnavailable, getErrorMessage(error, t.lifecycle.gpsUnavailable));
    } finally {
      setProcessingAction('');
    }
  };

  const markStopArrived = (manual = false) => {
    if (!nextStop) {
      Alert.alert(t.lifecycle.completeTrip, t.lifecycle.routeComplete);
      return;
    }

    const nextCompletedCount = Math.min(stopPoints.length, currentStopIndex + 1);
    setCompletedStopCount(nextCompletedCount);
    setCurrentStopIndex((index) => Math.min(stopPoints.length, index + 1));

    if (nextCompletedCount >= stopPoints.length) {
      Alert.alert(t.lifecycle.completeTrip, t.lifecycle.routeComplete);
    } else if (manual) {
      Alert.alert(t.lifecycle.headingTo, `${t.lifecycle.stopPrefix} ${nextCompletedCount + 1}`);
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
    if (!assignmentId) return undefined;

    let isMounted = true;
    const refreshTrip = async () => {
      try {
        const updatedTrip = await scheduleOperationsApi.getAssignedTripDetail(assignmentId);
        if (isMounted) {
          setTrip(updatedTrip);
        }
      } catch {
        // Keep navigation available with the last known trip payload.
      }
    };

    void refreshTrip();
    const timer = setInterval(() => {
      void refreshTrip();
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [assignmentId]);

  useEffect(() => {
    if (!isTripInProgress) return undefined;

    let subscription: { remove: () => void } | null = null;
    let isMounted = true;

    void watchDeviceGps(
      (gps) => {
        if (isMounted && isValidGpsCoordinate(gps)) {
          setCurrentGps(gps);
          const now = Date.now();
          if (now - lastGpsSyncAtRef.current >= LIVE_GPS_SYNC_INTERVAL_MS && !gpsSyncInFlightRef.current) {
            lastGpsSyncAtRef.current = now;
            gpsSyncInFlightRef.current = true;
            void scheduleOperationsApi.syncTripGps(assignmentId, { gps })
              .then((updated) => {
                if (isMounted) setTrip(updated);
              })
              .catch(() => {
                // Keep tracking locally; the next GPS sample will retry automatically.
              })
              .finally(() => {
                gpsSyncInFlightRef.current = false;
              });
          }
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
      Alert.alert(t.lifecycle.startTrip, `${t.lifecycle.startedGps}: ${updated.gpsSync?.status || 'UNKNOWN'}.`);
    } catch (error) {
      Alert.alert(t.lifecycle.startTrip, getErrorMessage(error, t.lifecycle.startTrip));
    } finally {
      setProcessingAction('');
    }
  };

  const completeTrip = async () => {
    if (!assignmentId) return;
    await completeTripRequest();
  };

  const completeTripRequest = async () => {
    if (!assignmentId) return;
    setProcessingAction('complete');
    try {
      const updated = await scheduleOperationsApi.completeTrip(assignmentId);
      setTrip(updated);
      router.replace({
        pathname: '/driver-assistant/trip-completed',
        params: { assignmentId: updated.id || assignmentId, trip: JSON.stringify(updated) },
      } as unknown as Href);
    } catch (error) {
      const message = getErrorMessage(error, t.lifecycle.completeErrorFallback);
      if (message.toLowerCase().includes('already') && message.toLowerCase().includes('completed')) {
        const completedTrip = {
          ...trip,
          tripStatus: 'COMPLETED',
          actualEndAt: trip?.actualEndAt || new Date().toISOString(),
        };
        router.replace({
          pathname: '/driver-assistant/trip-completed',
          params: { assignmentId, trip: JSON.stringify(completedTrip) },
        } as unknown as Href);
        return;
      }
      Alert.alert(t.lifecycle.completeTrip, message);
    } finally {
      setProcessingAction('');
    }
  };

  const chooseEvidenceFiles = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t.lifecycle.reportIncident, t.lifecycle.incidentPlaceholder);
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
      Alert.alert(t.lifecycle.incidentDescription, t.lifecycle.incidentPlaceholder);
      return;
    }
    const autoLocation = currentGps?.latitude != null && currentGps?.longitude != null
      ? `${formatCoordinate(currentGps.latitude)}, ${formatCoordinate(currentGps.longitude)}`
      : trip?.route?.name || trip?.tripCode || t.common.currentGpsLocation;

    const payload: Record<string, unknown> = {
      type: incidentType,
      severity: incidentType === 'ACCIDENT' && incidentSeverity === 'LOW' ? 'MEDIUM' : incidentSeverity,
      description,
      locationText: autoLocation,
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
      payload.estimatedDelayMinutes = Math.max(1, Number(estimatedDelayMinutes) || 10);
    }

    if (incidentType === 'VEHICLE_BREAKDOWN') {
      payload.breakdownType = breakdownType;
      payload.canContinue = false;
      payload.requiresReplacementVehicle = true;
    }

    setProcessingAction('incident');
    try {
      await scheduleOperationsApi.reportOperationIncident(assignmentId, payload);
      setIncidentDescription('');
      setEvidenceFiles([]);
      setIncidentType(null);
      Alert.alert(t.lifecycle.reportIncident, t.lifecycle.incidentSubmitted);
    } catch (error) {
      Alert.alert(t.lifecycle.reportIncident, getErrorMessage(error, t.lifecycle.reportIncident));
    } finally {
      setProcessingAction('');
    }
  };

  return (
    <View style={styles.screenShell}>
      <Screen>
        <View style={styles.header}>
          <Pressable accessibilityLabel={t.common.back} hitSlop={10} onPress={() => goBackOrReplace('/driver-assistant/assigned-trips')}>
            <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>{t.lifecycle.kicker}</Text>
            <Text numberOfLines={1} style={styles.title}>{trip?.route?.routeNumber || trip?.tripCode || t.common.route}</Text>
          </View>
          <View style={styles.gpsPill}>
            <Text style={styles.gpsPillText}>{formatDriverStatus(gpsStatus, t)}</Text>
          </View>
        </View>

        {hasTripScheduleAdjustment(trip) ? (
          <View style={styles.delayNotice}>
            <MaterialCommunityIcons color="#9a6700" name="clock-alert-outline" size={20} />
            <View style={styles.delayTextWrap}>
              <Text style={styles.delayTitle}>Giờ đã điều chỉnh do sự cố</Text>
              <Text style={styles.delayText}>
                Giờ gốc {formatTime(trip?.originalScheduledStart)} - {formatTime(trip?.originalScheduledEnd)}; giờ mới {getTripDepartureTimeLabel(trip)} - {getTripArrivalTimeLabel(trip)}.{`\n`}
                Trễ trực tiếp {trip?.incidentDelayMinutes || 0} phút; dời lịch kế tiếp {trip?.propagatedDelayMinutes || 0} phút; tổng điều chỉnh {getTripScheduleAdjustmentMinutes(trip)} phút.
              </Text>
            </View>
          </View>
        ) : null}

        <View style={[styles.navigationCard, { height: navigationHeight }]}>
          <NavigationMap
            currentGps={currentGps}
            currentStopIndex={currentStopIndex}
            onRouteInfo={setRouteInfo}
            nextInstructionLabel={t.lifecycle.nextInstruction}
            routeInfo={routeInfo}
            t={t}
            trip={trip}
          />

          <Animated.View
            style={[
              styles.bottomSheet,
              {
                height: expandedSheetHeight,
                transform: [{ translateY: sheetTranslateY }],
              },
            ]}
          >
            <View
              accessibilityLabel={t.lifecycle.dragTripSummary}
              accessibilityRole="button"
              style={styles.sheetHandleTouch}
              {...sheetPanResponder.panHandlers}
            >
              <View style={styles.sheetHandle} />
            </View>
            <Text numberOfLines={1} style={styles.routeTitle}>{trip?.route?.name || t.common.route}</Text>
            {hasVehicleReplacement(trip) ? (
              <View style={styles.replacementNotice}>
                <MaterialCommunityIcons color={colors.primary} name="swap-horizontal-bold" size={17} />
                <Text numberOfLines={2} style={styles.replacementText}>
                  {t.trips.replacementPrefix} {getVehicleLabel(trip?.vehicleReplacement?.currentVehicle || trip?.vehicle)}. {t.trips.oldVehicleMaintenance}
                </Text>
              </View>
            ) : null}
            <Text style={styles.sheetLabel}>{t.lifecycle.headingTo}</Text>
            <Text numberOfLines={2} style={styles.nextStopName}>
              {nextStop ? `${t.lifecycle.stopPrefix} ${currentStopIndex + 1} - ${nextStop.name}` : t.lifecycle.routeComplete}
            </Text>

            <View style={styles.sheetActions}>
              {canStart ? (
                <AppButton
                  title={t.lifecycle.startTrip}
                  loading={processingAction === 'start'}
                  onPress={startTrip}
                  style={styles.sheetAction}
                />
              ) : null}
              <AppButton
                title={t.lifecycle.completeTrip}
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
              <Text style={styles.gpsReloadText}>{processingAction === 'gps' ? t.common.loading : t.lifecycle.reloadGps}</Text>
            </Pressable>
          </Animated.View>
        </View>

        <View style={styles.reportSection}>
          <View style={styles.reportHeader}>
            <View style={styles.reportTitleRow}>
              <MaterialCommunityIcons color={colors.error} name="alert-circle-outline" size={22} />
              <Text style={styles.reportTitle}>{t.lifecycle.reportIncident}</Text>
            </View>
            <View style={styles.reportStatusPill}>
              <Text style={styles.reportStatusText}>{isTripInProgress ? t.common.inProgress : t.common.notStart}</Text>
            </View>
          </View>
          <Text style={styles.reportHint}>{t.lifecycle.incidentHint}</Text>

          {!incidentType ? (
            <View style={styles.incidentPickerPanel}>
              <View style={styles.incidentPanelHeader}>
                <View>
                  <Text style={styles.incidentPanelTitle}>{t.lifecycle.reportIncident}</Text>
                  <Text style={styles.reportHint}>{t.lifecycle.chooseIncident}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={!isTripInProgress}
                  onPress={() => setIncidentType('TRAFFIC_CONGESTION')}
                  style={[styles.reportButtonSmall, !isTripInProgress && styles.reportButtonDisabled]}
                >
                  <MaterialCommunityIcons color={colors.white} name="alert-outline" size={16} />
                  <Text style={styles.reportButtonSmallText}>{t.lifecycle.reportIncident}</Text>
                </Pressable>
              </View>

              <View style={styles.incidentCardsGrid}>
                {incidentOptions.map((option) => (
                  <Pressable
                    key={option.type}
                    accessibilityRole="button"
                    disabled={!isTripInProgress || Boolean(processingAction)}
                    onPress={() => {
                      setIncidentType(option.type);
                      setIncidentSeverity(option.type === 'ACCIDENT' ? 'MEDIUM' : 'MEDIUM');
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
                    <Text style={styles.incidentTypeTitle}>{option.label}</Text>
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
                    {selectedIncidentOption?.label}
                  </Text>
                  <Text style={styles.reportHint}>{t.lifecycle.chooseIncident}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setIncidentType(null)}
                  style={styles.changeIncidentButton}
                >
                  <Text style={styles.changeIncidentText}>{t.lifecycle.chooseIncident}</Text>
                </Pressable>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t.common.status}</Text>
                <View style={styles.optionWrap}>
                  {severityOptions.map((severity) => {
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

              {['TRAFFIC_CONGESTION', 'ACCIDENT'].includes(String(incidentType)) ? (
                <>
                  {incidentType === 'TRAFFIC_CONGESTION' ? <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{t.lifecycle.traffic}</Text>
                    <View style={styles.optionWrap}>
                      {trafficCategoryOptions.map((category) => {
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
                  </View> : null}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>ETA</Text>
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
                    <Text style={styles.checkboxText}>{t.lifecycle.injuriesReported}</Text>
                  </Pressable>
                  <Pressable style={styles.checkboxRow} onPress={() => setPoliceNotified((value) => !value)}>
                    <MaterialCommunityIcons color={policeNotified ? colors.error : colors.muted} name={policeNotified ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} />
                    <Text style={styles.checkboxText}>{t.lifecycle.policeNotified}</Text>
                  </Pressable>
                </View>
              ) : null}

              {incidentType === 'VEHICLE_BREAKDOWN' ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t.lifecycle.breakdown}</Text>
                  <View style={styles.optionGrid}>
                    {breakdownTypeOptions.map((type) => {
                      const isActive = breakdownType === type.value;
                      return (
                        <Pressable
                          key={type.value}
                          accessibilityRole="button"
                          disabled={!isTripInProgress || Boolean(processingAction)}
                          onPress={() => setBreakdownType(type.value)}
                          style={[styles.optionChipWide, isActive && styles.optionChipDanger]}
                        >
                          <Text style={[styles.optionChipText, isActive && styles.optionChipTextDanger]}>{type.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.fileHelp}>
                    Chuyến, xe, tài xế, GPS hiện tại và thời điểm báo cáo sẽ được đính kèm tự động. Admin sẽ tiếp nhận và điều phối xe thay thế.
                  </Text>
                </View>
              ) : null}

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t.lifecycle.incidentDescription}</Text>
                <TextInput
                  editable={isTripInProgress && !Boolean(processingAction)}
                  multiline
                  onChangeText={setIncidentDescription}
                  placeholder={t.lifecycle.incidentPlaceholder}
                  placeholderTextColor={colors.muted}
                  style={styles.incidentInput}
                  value={incidentDescription}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t.lifecycle.evidence}</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={evidenceFiles.length >= 5 || Boolean(processingAction)}
                  onPress={chooseEvidenceFiles}
                  style={styles.filePicker}
                >
                  <View style={styles.filePickerButton}>
                    <Text style={styles.filePickerButtonText}>{t.common.chooseFile}</Text>
                  </View>
                  <Text numberOfLines={1} style={styles.filePickerText}>
                    {evidenceFiles.length ? `${evidenceFiles.length}` : t.common.noFile}
                  </Text>
                </Pressable>
                <Text style={styles.fileHelp}>{t.lifecycle.evidenceHelp}</Text>
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
                <Text style={styles.reportButtonText}>{processingAction === 'incident' ? t.common.loading : t.lifecycle.submitIncident}</Text>
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 14,
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  sheetHandleTouch: { alignItems: 'center', justifyContent: 'center', minHeight: 30, marginBottom: 2 },
  sheetHandle: { width: 48, height: 5, borderRadius: 999, backgroundColor: colors.outline },
  routeTitle: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  delayNotice: { flexDirection: 'row', gap: 10, borderRadius: 16, borderWidth: 1, borderColor: '#f1d58a', backgroundColor: '#fff8df', padding: 12 },
  delayTextWrap: { flex: 1, gap: 3 },
  delayTitle: { color: '#805500', fontSize: 13, fontWeight: '900' },
  delayText: { color: '#725a24', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  replacementNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: '#e8f8ef',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  replacementText: { flex: 1, color: colors.primary, fontSize: 11, lineHeight: 16, fontWeight: '800' },
  sheetLabel: { marginTop: 8, color: colors.accent, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  nextStopName: { marginTop: 3, color: colors.text, fontSize: 20, lineHeight: 25, fontWeight: '900' },
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
  optionGrid: { gap: 8 },
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
  optionChipDanger: { borderColor: colors.error, backgroundColor: colors.error },
  optionChipDisabled: { opacity: 0.35 },
  optionChipText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  optionChipTextActive: { color: colors.white },
  optionChipTextDanger: { color: colors.white },
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
