import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { scheduleOperationsApi } from '@/api/scheduleOperations.api';
import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/colors';
import { formatDriverStatus, useDriverI18n, type DriverTranslation } from '@/i18n/driver';
import { useAuthStore } from '@/store/auth.store';
import type { AssignedTrip, RoutePoint } from '@/types/scheduleOperations';
import { goBackOrReplace } from '@/utils/navigation';
import {
  formatCoordinate,
  formatTime,
  getTripArrivalTimeLabel,
  getTripDepartureTimeLabel,
  getAssignedTripsRange,
  getRoutePathPoints,
  getRouteStops,
  getTripStatus,
  getTripVehicleLabel,
  getVehicleLabel,
  hasVehicleReplacement,
} from '@/utils/scheduleOperations';
import { getErrorMessage } from '@/utils/validation';

const mapHeight = Math.min(Math.max(Dimensions.get('window').height * 0.52, 390), 540);

function parseTripParam(value: unknown): AssignedTrip | null {
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value) as AssignedTrip;
  } catch {
    return null;
  }
}

function DetailRow({ label, value, fallback }: { label: string; value?: string | number | null; fallback: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || fallback}</Text>
    </View>
  );
}

function RouteStopRow({
  stop,
  index,
  t,
}: {
  stop: RoutePoint;
  index: number;
  t: DriverTranslation;
}) {
  return (
    <View style={styles.stopRow}>
      <View style={styles.stopIndex}>
        <Text style={styles.stopIndexText}>{index + 1}</Text>
      </View>
      <View style={styles.stopContent}>
        <Text style={styles.stopName}>{stop.stopName || `${t.lifecycle.stopPrefix} ${index + 1}`}</Text>
        <Text style={styles.stopAddress}>{stop.address || t.common.addressUnavailable}</Text>
      </View>
    </View>
  );
}

type MapPoint = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

type DriverMapPoint = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
};

const isValidCoordinate = (point: RoutePoint) => (
  Number.isFinite(Number(point.latitude))
  && Number.isFinite(Number(point.longitude))
  && !(Number(point.latitude) === 0 && Number(point.longitude) === 0)
);

const toValidCoordinate = (
  latitude?: number | string | null,
  longitude?: number | string | null,
) => {
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);

  if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
    return null;
  }

  if (parsedLatitude === 0 && parsedLongitude === 0) {
    return null;
  }

  return { latitude: parsedLatitude, longitude: parsedLongitude };
};

const toMapPoints = (stops: RoutePoint[], stopPrefix: string): MapPoint[] => stops
  .filter(isValidCoordinate)
  .map((stop, index) => ({
    name: stop.stopName || `${stopPrefix} ${index + 1}`,
    address: stop.address || '',
    latitude: Number(stop.latitude),
    longitude: Number(stop.longitude),
  }));

const buildRouteMapHtml = (
  pathPoints: MapPoint[],
  stopPoints: MapPoint[],
  t: DriverTranslation,
  driverLocation?: DriverMapPoint | null,
) => {
  const serializedPathPoints = JSON.stringify(pathPoints)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
  const serializedStopPoints = JSON.stringify(stopPoints)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
  const serializedDriverLocation = JSON.stringify(driverLocation || null)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
  const serializedLabels = JSON.stringify({
    driverGps: t.detail.driverGps,
  }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #ecf6f2; touch-action: none; }
    .stop-marker {
      width: 30px;
      height: 30px;
      border-radius: 999px;
      border: 3px solid #ffffff;
      background: #00765a;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font: 800 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-shadow: 0 4px 10px rgba(0, 26, 15, 0.25);
    }
    .stop-marker.start { background: #003d2b; }
    .stop-marker.end { background: #2ba471; }
    .driver-marker {
      width: 38px;
      height: 38px;
      border-radius: 999px;
      border: 4px solid #ffffff;
      background: #2563eb;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 18px rgba(37, 99, 235, 0.35);
    }
    .driver-marker:before {
      content: "";
      width: 0;
      height: 0;
      border-left: 7px solid transparent;
      border-right: 7px solid transparent;
      border-bottom: 16px solid #ffffff;
      transform: translateY(-1px);
    }
    .leaflet-popup-content { margin: 10px 12px; font: 600 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #141d1b; }
    .popup-title { font-weight: 900; margin-bottom: 4px; }
    .popup-address { color: #426656; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const pathPoints = ${serializedPathPoints};
    const stopPoints = ${serializedStopPoints};
    const driver = ${serializedDriverLocation};
    const labels = ${serializedLabels};
    const fallbackCenter = [16.047079, 108.20623];
    const map = L.map('map', {
      zoomControl: true,
      attributionControl: true,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: false
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const bounds = [];
    if (pathPoints.length) {
      const latLngs = pathPoints.map((point) => [point.latitude, point.longitude]);
      L.polyline(latLngs, { color: '#00765a', weight: 5, opacity: 0.82 }).addTo(map);
      latLngs.forEach((latLng) => bounds.push(latLng));
    }

    if (stopPoints.length) {
      stopPoints.forEach((point, index) => {
        const markerClass = index === 0 ? 'start' : index === stopPoints.length - 1 ? 'end' : '';
        const icon = L.divIcon({
          className: '',
          html: '<div class="stop-marker ' + markerClass + '">' + (index + 1) + '</div>',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          popupAnchor: [0, -16]
        });
        L.marker([point.latitude, point.longitude], { icon })
          .addTo(map)
          .bindPopup('<div class="popup-title">' + point.name + '</div><div class="popup-address">' + point.address + '</div>');
        bounds.push([point.latitude, point.longitude]);
      });
    }

    if (driver) {
      const driverLatLng = [driver.latitude, driver.longitude];
      bounds.push(driverLatLng);
      const driverIcon = L.divIcon({
        className: '',
        html: '<div class="driver-marker"></div>',
        iconSize: [38, 38],
        iconAnchor: [19, 19],
        popupAnchor: [0, -18]
      });
      L.marker(driverLatLng, { icon: driverIcon })
        .addTo(map)
        .bindPopup('<div class="popup-title">' + labels.driverGps + '</div><div class="popup-address">' + driver.latitude + ', ' + driver.longitude + '</div>');
      if (driver.accuracyMeters) {
        L.circle(driverLatLng, {
          radius: Math.min(Math.max(Number(driver.accuracyMeters), 30), 5000),
          color: '#2563eb',
          weight: 1,
          fillColor: '#60a5fa',
          fillOpacity: 0.12
        }).addTo(map);
      }
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    } else {
      map.setView(fallbackCenter, 12);
    }
  </script>
</body>
</html>`;
};

function EmbeddedRouteMap({
  pathPoints,
  stopPoints,
  driverLocation,
  t,
}: {
  pathPoints: MapPoint[];
  stopPoints: MapPoint[];
  driverLocation?: DriverMapPoint | null;
  t: DriverTranslation;
}) {
  const html = useMemo(() => buildRouteMapHtml(pathPoints, stopPoints, t, driverLocation), [driverLocation, pathPoints, stopPoints, t]);

  if (!pathPoints.length && !stopPoints.length && !driverLocation) {
    return (
      <View style={styles.mapFallback}>
        <MaterialCommunityIcons color={colors.muted} name="alert-outline" size={26} />
        <Text style={styles.mapFallbackText}>{t.detail.noCoordinates}</Text>
      </View>
    );
  }

  return (
    <View style={styles.embeddedMap}>
      <WebView
        javaScriptEnabled
        bounces={false}
        nestedScrollEnabled
        originWhitelist={['*']}
        scrollEnabled
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        source={{ html }}
        style={styles.webView}
      />
    </View>
  );
}

function RouteOverview({ trip, t }: { trip: AssignedTrip; t: DriverTranslation }) {
  const stops = getRouteStops(trip);
  const routePathPoints = getRoutePathPoints(trip);
  const stopMapPoints = toMapPoints(stops, t.lifecycle.stopPrefix);
  const pathMapPoints = toMapPoints(routePathPoints, t.lifecycle.stopPrefix);
  const startLocation = trip.startLocation;
  const driverCoordinate = toValidCoordinate(startLocation?.latitude, startLocation?.longitude);
  const driverLocation = driverCoordinate
    ? {
      ...driverCoordinate,
      accuracyMeters: startLocation?.accuracyMeters,
    }
    : null;
  const firstStop = stopMapPoints[0] || pathMapPoints[0] || stops[0];
  const originLabel = stopMapPoints[0]?.name || pathMapPoints[0]?.name || stops[0]?.stopName || trip.route?.origin;
  const destinationLabel = stopMapPoints[stopMapPoints.length - 1]?.name
    || pathMapPoints[pathMapPoints.length - 1]?.name
    || stops[stops.length - 1]?.stopName
    || trip.route?.destination;
  return (
    <View style={styles.mapSection}>
      <View style={styles.mapTopRow}>
        <View style={styles.mapMetric}>
          <Text style={styles.mapMetricLabel}>{t.common.stops}</Text>
          <Text style={styles.mapMetricValue}>{stopMapPoints.length || stops.length || t.common.notAvailable}</Text>
        </View>
        <View style={styles.mapMetric}>
          <Text style={styles.mapMetricLabel}>{t.common.distance}</Text>
          <Text style={styles.mapMetricValue}>
            {trip.route?.estimatedDistanceKm ? `${trip.route.estimatedDistanceKm} km` : t.common.notAvailable}
          </Text>
        </View>
      </View>

      <EmbeddedRouteMap driverLocation={driverLocation} pathPoints={pathMapPoints} stopPoints={stopMapPoints} t={t} />

      <View style={styles.gpsBox}>
        <Text style={styles.gpsTitle}>{t.detail.driverGps}</Text>
        <Text style={styles.gpsValue}>
          Lat {formatCoordinate(startLocation?.latitude)} / Lng {formatCoordinate(startLocation?.longitude)}
        </Text>
        <Text style={styles.gpsMeta}>
          {t.common.gpsStatus}: {formatDriverStatus(trip.gpsSync?.status || 'NOT_REQUESTED', t)}
          {trip.startLocation?.accuracyMeters != null ? ` - ${t.common.accuracy} ${trip.startLocation.accuracyMeters}m` : ''}
        </Text>
      </View>

      <View style={styles.routeContext}>
        <Text numberOfLines={1} style={styles.routeContextLabel}>{originLabel || t.detail.origin}</Text>
        <MaterialCommunityIcons color={colors.accent} name="arrow-right" size={18} />
        <Text numberOfLines={1} style={styles.routeContextLabel}>{destinationLabel || t.detail.destination}</Text>
      </View>

      <View style={styles.stopList}>
        {stops.length === 0 ? (
          <Text style={styles.emptyText}>{t.detail.noStops}</Text>
        ) : (
          stops.map((stop, index) => (
            <RouteStopRow
              key={`${stop.stopOrder || index}-${stop.stopName || stop.address}`}
              stop={stop}
              index={index}
              t={t}
            />
          ))
        )}
      </View>
    </View>
  );
}

export default function TripDetailScreen() {
  const params = useLocalSearchParams<{ trip?: string; assignmentId?: string }>();
  const user = useAuthStore((state) => state.user);
  const { t } = useDriverI18n();
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const initialTrip = useMemo(() => parseTripParam(params.trip), [params.trip]);
  const [freshTrip, setFreshTrip] = useState<AssignedTrip | null>(null);
  const [isRefreshingTrip, setIsRefreshingTrip] = useState(false);
  const assignmentId = String(params.assignmentId || initialTrip?.id || '');
  const trip = freshTrip || initialTrip;
  const status = trip ? getTripStatus(trip) : 'UNKNOWN';

  const refreshTripDetail = useCallback(async () => {
    if (!assignmentId || !isHydrated || !isAuthenticated) return;

    setIsRefreshingTrip(true);
    try {
      const updatedTrip = await scheduleOperationsApi.getAssignedTripDetail(assignmentId);
      setFreshTrip(updatedTrip);
    } catch (error) {
      const message = getErrorMessage(error, t.trips.empty);
      const statusCode = (error as { statusCode?: number; response?: { status?: number } })?.statusCode
        || (error as { response?: { status?: number } })?.response?.status;
      const isAuthError = statusCode === 401 || message.toLowerCase().includes('no token provided');

      if (isAuthError) {
        await logout();
        router.replace('/auth/login');
        return;
      }

      try {
        const payload = await scheduleOperationsApi.getAssignedTrips(getAssignedTripsRange(initialTrip?.scheduledStart || new Date()));
        const fallbackTrip = (payload.trips || []).find((item) => (
          item.id === assignmentId
          || item.tripId === initialTrip?.tripId
          || item.tripCode === initialTrip?.tripCode
        ));
        if (fallbackTrip) {
          setFreshTrip(fallbackTrip);
        }
      } catch {
        // Keep the navigation payload visible if the detail refresh endpoint is not available yet.
      }
    } finally {
      setIsRefreshingTrip(false);
    }
  }, [assignmentId, initialTrip?.scheduledStart, initialTrip?.tripCode, initialTrip?.tripId, isAuthenticated, isHydrated, logout]);

  useEffect(() => {
    void refreshTripDetail();
  }, [refreshTripDetail]);

  if (!trip) {
    return (
      <View style={styles.screenShell}>
        <Screen>
          <View style={styles.header}>
            <Pressable accessibilityLabel={t.common.back} hitSlop={10} onPress={() => goBackOrReplace('/driver-assistant/assigned-trips')}>
              <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
            </Pressable>
            <Text style={styles.title}>{t.detail.kicker}</Text>
          </View>
          <Text style={styles.emptyText}>{t.common.tripUnavailable}</Text>
        </Screen>
        <RoleBottomNav active="trips" role={user?.role} />
      </View>
    );
  }

  return (
    <View style={styles.screenShell}>
      <Screen>
      <View style={styles.header}>
        <Pressable accessibilityLabel={t.common.back} hitSlop={10} onPress={() => goBackOrReplace('/driver-assistant/assigned-trips')}>
          <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
        </Pressable>
        <View>
          <Text style={styles.kicker}>{t.detail.kicker}</Text>
          <Text style={styles.title}>{trip.tripCode || trip.id}</Text>
        </View>
        {isRefreshingTrip ? <ActivityIndicator color={colors.primary} size="small" /> : null}
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.routeNumber}>{trip.route?.routeNumber || t.common.route}</Text>
            <Text style={styles.routeName}>{trip.route?.name || t.common.unknownRoute}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{formatDriverStatus(status, t)}</Text>
          </View>
        </View>
        <Text style={styles.directionText}>{trip.route?.origin || t.detail.origin} - {trip.route?.destination || t.detail.destination}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.detail.schedule}</Text>
        {(trip.incidentDelayMinutes || trip.propagatedDelayMinutes) ? (
          <View style={styles.delayNotice}>
            <MaterialCommunityIcons color="#9a6700" name="clock-alert-outline" size={22} />
            <View style={styles.replacementTextWrap}>
              <Text style={styles.delayTitle}>Lịch đã điều chỉnh do sự cố</Text>
              <Text style={styles.delayText}>
                Giờ gốc: {formatTime(trip.originalScheduledStart)} - {formatTime(trip.originalScheduledEnd)}.{`\n`}
                Giờ mới: {getTripDepartureTimeLabel(trip)} - {getTripArrivalTimeLabel(trip)}.{`\n`}
                Trễ trực tiếp: {trip.incidentDelayMinutes || 0} phút; dời do chuyến trước: {trip.propagatedDelayMinutes || 0} phút.
              </Text>
            </View>
          </View>
        ) : null}
        <View style={styles.detailsGrid}>
          <DetailRow fallback={t.common.notAvailable} label={t.common.direction} value={trip.route?.direction} />
          <DetailRow fallback={t.common.notAvailable} label={t.common.departure} value={getTripDepartureTimeLabel(trip)} />
          <DetailRow fallback={t.common.notAvailable} label={t.common.arrival} value={getTripArrivalTimeLabel(trip)} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.detail.vehicleCrew}</Text>
        {hasVehicleReplacement(trip) ? (
          <View style={styles.replacementNotice}>
            <MaterialCommunityIcons color={colors.primary} name="swap-horizontal-bold" size={19} />
            <View style={styles.replacementTextWrap}>
              <Text style={styles.replacementTitle}>{t.inspection.replacementTitle}</Text>
              <Text style={styles.replacementText}>
                {t.trips.oldVehicleMaintenance} {t.trips.replacementPrefix} {getVehicleLabel(trip.vehicleReplacement?.currentVehicle || trip.vehicle)}.
              </Text>
            </View>
          </View>
        ) : null}
        <View style={styles.detailsGrid}>
          <DetailRow fallback={t.common.notAvailable} label={t.common.vehicle} value={getTripVehicleLabel(trip)} />
          <DetailRow fallback={t.common.notAvailable} label={t.detail.passengerCapacity} value={trip.vehicle?.capacity} />
          <DetailRow fallback={t.common.notAvailable} label={t.common.driverName} value={trip.driver?.fullName} />
          <DetailRow fallback={t.common.notAvailable} label={t.common.assistantName} value={trip.busAssistant?.fullName} />
          <DetailRow fallback={t.common.notAvailable} label={t.detail.status} value={formatDriverStatus(trip.inspection?.status, t)} />
        </View>
      </View>

      <RouteOverview trip={trip} t={t} />
      <View style={styles.bottomSpacer} />
      </Screen>
      <RoleBottomNav active="trips" role={user?.role} />
    </View>
  );
}

const styles = StyleSheet.create({
  screenShell: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  kicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.primary, fontSize: 25, fontWeight: '900' },
  emptyText: { borderRadius: 18, backgroundColor: colors.surfaceLow, padding: 16, color: colors.muted, fontSize: 13, fontWeight: '700' },
  heroCard: { gap: 12, borderRadius: 26, backgroundColor: colors.primary, padding: 20 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  routeNumber: { color: '#aff4d1', fontSize: 13, fontWeight: '900' },
  routeName: { marginTop: 3, color: colors.white, fontSize: 23, fontWeight: '900' },
  statusBadge: { borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  directionText: { color: '#d4f2e5', fontSize: 14, fontWeight: '800' },
  section: { gap: 12, marginTop: 18, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  mapSection: { gap: 14, marginTop: 18, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  sectionHint: { marginTop: 3, color: colors.muted, fontSize: 12, fontWeight: '700' },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  replacementNotice: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#b8e8d0',
    backgroundColor: '#e8f8ef',
    padding: 12,
  },
  replacementTextWrap: { flex: 1, gap: 3 },
  replacementTitle: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  replacementText: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  delayNotice: { flexDirection: 'row', gap: 10, borderRadius: 16, borderWidth: 1, borderColor: '#f1d58a', backgroundColor: '#fff8df', padding: 12 },
  delayTitle: { color: '#805500', fontSize: 13, fontWeight: '900' },
  delayText: { color: '#725a24', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  detailRow: { width: '47%', gap: 4 },
  detailLabel: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  detailValue: { color: colors.text, fontSize: 13, fontWeight: '800' },
  mapButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, backgroundColor: '#d4f2e5', paddingHorizontal: 12 },
  mapButtonText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  routeSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  mapTopRow: { flexDirection: 'row', gap: 18 },
  mapMetric: { flex: 1, gap: 4 },
  mapMetricLabel: { color: colors.text, fontSize: 13, fontWeight: '900' },
  mapMetricValue: { color: colors.primary, fontSize: 17, fontWeight: '900' },
  embeddedMap: {
    height: mapHeight,
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceLow,
  },
  webView: { flex: 1, backgroundColor: colors.surfaceLow },
  mapFallback: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceLow,
    padding: 16,
  },
  mapFallbackText: { color: colors.muted, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  gpsBox: { gap: 3, borderRadius: 18, backgroundColor: colors.surfaceLow, padding: 14 },
  gpsTitle: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  gpsValue: { color: colors.text, fontSize: 14, fontWeight: '900' },
  gpsMeta: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  routeContext: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 18,
    backgroundColor: '#f2fbf7',
    paddingHorizontal: 12,
  },
  routeContextLabel: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '900' },
  stopList: { gap: 10 },
  stopRow: { flexDirection: 'row', gap: 12, borderRadius: 18, backgroundColor: colors.surfaceLow, padding: 14 },
  stopIndex: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.primary },
  stopIndexText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  stopContent: { flex: 1, gap: 2 },
  stopName: { color: colors.text, fontSize: 15, lineHeight: 19, fontWeight: '900' },
  stopAddress: { color: colors.muted, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  bottomSpacer: { height: 96 },
});
