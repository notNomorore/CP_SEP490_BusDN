import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
    name: stop.stopName || `Stop ${index + 1}`,
    address: stop.address || '',
    latitude: Number(stop.latitude),
    longitude: Number(stop.longitude),
  }));

const buildOperationMapHtml = (points: MapPoint[], driverLocation?: DriverMapPoint | null) => {
  const serializedPoints = JSON.stringify(points).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  const serializedDriver = JSON.stringify(driverLocation || null).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #ecf6f2; }
    .stop-marker, .driver-marker {
      width: 30px;
      height: 30px;
      border-radius: 999px;
      border: 3px solid #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font: 800 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-shadow: 0 4px 10px rgba(0, 26, 15, 0.25);
    }
    .stop-marker { background: #00765a; }
    .stop-marker.start { background: #003d2b; }
    .stop-marker.end { background: #2ba471; }
    .driver-marker { width: 34px; height: 34px; background: #1d4ed8; font-size: 17px; }
    .leaflet-popup-content { margin: 10px 12px; font: 600 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #141d1b; }
    .popup-title { font-weight: 900; margin-bottom: 4px; }
    .popup-address { color: #426656; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const points = ${serializedPoints};
    const driver = ${serializedDriver};
    const fallbackCenter = [16.047079, 108.20623];
    const map = L.map('map', { zoomControl: true, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const bounds = [];
    if (points.length) {
      const latLngs = points.map((point) => [point.latitude, point.longitude]);
      bounds.push(...latLngs);
      L.polyline(latLngs, { color: '#2563eb', weight: 5, opacity: 0.82 }).addTo(map);
      points.forEach((point, index) => {
        const markerClass = index === 0 ? 'start' : index === points.length - 1 ? 'end' : '';
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
      });
    }

    if (driver) {
      bounds.push([driver.latitude, driver.longitude]);
      const driverIcon = L.divIcon({
        className: '',
        html: '<div class="driver-marker">●</div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18]
      });
      L.marker([driver.latitude, driver.longitude], { icon: driverIcon })
        .addTo(map)
        .bindPopup('<div class="popup-title">Vi tri hien tai</div><div class="popup-address">Accuracy: ' + (driver.accuracyMeters ?? 'N/A') + ' m</div>');
      if (driver.accuracyMeters) {
        L.circle([driver.latitude, driver.longitude], {
          radius: driver.accuracyMeters,
          color: '#1d4ed8',
          fillColor: '#60a5fa',
          fillOpacity: 0.14,
          weight: 1
        }).addTo(map);
      }
    }

    if (bounds.length) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
    else map.setView(fallbackCenter, 12);
  </script>
</body>
</html>`;
};

function OperationRouteMap({
  trip,
  currentGps,
}: {
  trip: AssignedTrip | null;
  currentGps: DeviceGpsPayload | null;
}) {
  const stops = getRouteStops(trip || ({} as AssignedTrip));
  const mapPoints = toMapPoints(stops);
  const tripStartLocation: DeviceGpsPayload | null = trip?.startLocation
    ? {
      latitude: trip.startLocation.latitude,
      longitude: trip.startLocation.longitude,
      accuracyMeters: trip.startLocation.accuracyMeters,
      capturedAt: trip.startLocation.capturedAt || undefined,
    }
    : null;
  const driverSource = isValidGpsCoordinate(currentGps) ? currentGps : tripStartLocation;
  const driverLocation = driverSource && isValidGpsCoordinate(driverSource)
    ? {
      name: 'Vi tri hien tai',
      address: '',
      latitude: Number(driverSource.latitude),
      longitude: Number(driverSource.longitude),
      accuracyMeters: driverSource.accuracyMeters ?? null,
    }
    : null;
  const html = useMemo(() => buildOperationMapHtml(mapPoints, driverLocation), [driverLocation, mapPoints]);
  const nextStops = mapPoints.slice(1, 9);

  return (
    <View style={styles.mapSection}>
      <View style={styles.mapHeader}>
        <View>
          <Text style={styles.sectionTitle}>Ban do van hanh chuyen</Text>
          <Text style={styles.helperText}>Theo doi vi tri tai xe hien tai va cac tram can di trong chuyen.</Text>
        </View>
        {driverLocation?.accuracyMeters != null ? (
          <View style={styles.accuracyPill}>
            <Text style={styles.accuracyText}>Accuracy: {Math.round(driverLocation.accuracyMeters)} m</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.embeddedMap}>
        <WebView
          javaScriptEnabled
          originWhitelist={['*']}
          scrollEnabled={false}
          source={{ html }}
          style={styles.webView}
        />
      </View>

      <View style={styles.mapFooter}>
        <Text style={styles.footerMetric}>Vi do: {formatCoordinate(driverLocation?.latitude)}</Text>
        <Text style={styles.footerMetric}>Kinh do: {formatCoordinate(driverLocation?.longitude)}</Text>
      </View>

      <View style={styles.stopList}>
        <Text style={styles.stopListTitle}>
          Tram can di: {mapPoints.length} tram
        </Text>
        {nextStops.map((stop, index) => (
          <View key={`${stop.name}-${stop.latitude}-${index}`} style={styles.stopRow}>
            <View style={styles.stopBadge}>
              <Text style={styles.stopBadgeText}>{index + 2}</Text>
            </View>
            <View style={styles.stopContent}>
              <Text style={styles.stopName}>{stop.name}</Text>
              <Text style={styles.stopAddress}>{stop.address || 'Address not available'}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function TripLifecycleScreen() {
  const params = useLocalSearchParams<{ trip?: string; assignmentId?: string }>();
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
  const [incidentDescription, setIncidentDescription] = useState('');
  const [processingAction, setProcessingAction] = useState('');

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
  const canSyncGps = user?.role === 'DRIVER' && isTripInProgress;
  const canReportIncident = isTripInProgress && incidentDescription.trim().length >= 10;

  const helperText = (() => {
    if (!isVehicleReady) return 'Vehicle must be ready before the trip can start.';
    if (isTripInProgress) return 'Trip is running. GPS can be reloaded and the trip can be completed.';
    if (isTripClosed) return 'This trip is closed.';
    if (canStart) return 'Vehicle is ready. Start the trip to move into operation monitoring.';
    return 'Trip is not ready to start.';
  })();

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

  const startTrip = async () => {
    if (!assignmentId) return;
    setProcessingAction('start');
    try {
      const gps = await getDeviceGpsPayload();
      setCurrentGps(gps);
      const updated = await scheduleOperationsApi.startTrip(assignmentId, { gps });
      setTrip(updated);
      Alert.alert('UC44 completed', `Trip started. GPS: ${updated.gpsSync?.status || 'UNKNOWN'}.`);
    } catch (error) {
      Alert.alert('Unable to start trip', getErrorMessage(error, 'Unable to start this trip.'));
    } finally {
      setProcessingAction('');
    }
  };

  const syncGps = async () => {
    if (!assignmentId) return;
    setProcessingAction('gps');
    try {
      const gps = await getDeviceGpsPayload();
      setCurrentGps(gps);
      const updated = await scheduleOperationsApi.syncTripGps(assignmentId, { gps });
      setTrip(updated);
      Alert.alert('GPS reloaded', `GPS: ${updated.gpsSync?.status || 'UNKNOWN'}.`);
    } catch (error) {
      Alert.alert('Unable to reload GPS', getErrorMessage(error, 'Unable to reload GPS for this trip.'));
    } finally {
      setProcessingAction('');
    }
  };

  const completeTrip = async () => {
    if (!assignmentId) return;
    setProcessingAction('complete');
    try {
      const updated = await scheduleOperationsApi.completeTrip(assignmentId);
      setTrip(updated);
      Alert.alert('UC45 completed', 'Trip has been completed.');
    } catch (error) {
      Alert.alert('Unable to complete trip', getErrorMessage(error, 'Unable to complete this trip.'));
    } finally {
      setProcessingAction('');
    }
  };

  const reportIncident = async () => {
    if (!assignmentId) return;
    const description = incidentDescription.trim();
    if (description.length < 10) {
      Alert.alert('Incident description required', 'Please enter at least 10 characters.');
      return;
    }

    setProcessingAction('incident');
    try {
      await scheduleOperationsApi.reportOperationIncident(assignmentId, {
        type: 'OTHER',
        severity: 'MEDIUM',
        description,
        locationText: trip?.route?.name || trip?.reportLocation || '',
        canContinue: true,
      });
      setIncidentDescription('');
      Alert.alert('Incident reported', 'The operation incident has been sent to dispatch.');
    } catch (error) {
      Alert.alert('Unable to report incident', getErrorMessage(error, 'Unable to report incident.'));
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
          <View>
            <Text style={styles.kicker}>TRIP OPERATIONS</Text>
            <Text style={styles.title}>Start Trip</Text>
          </View>
        </View>

        <View style={styles.tripCard}>
          <Text style={styles.tripCode}>{trip?.tripCode || assignmentId || 'Assigned trip'}</Text>
          <Text style={styles.routeName}>{trip?.route?.name || 'Unnamed route'}</Text>
          <View style={styles.summaryGrid}>
            <Text style={styles.summaryText}>Departure: {formatTime(trip?.scheduledStart)}</Text>
            <Text style={styles.summaryText}>Vehicle: {trip?.vehicle?.code || trip?.vehicle?.plateNumber || 'N/A'}</Text>
            <Text style={styles.summaryText}>Trip: {tripStatus}</Text>
            <Text style={styles.summaryText}>GPS: {gpsStatus}</Text>
          </View>
        </View>

        <OperationRouteMap trip={trip} currentGps={currentGps} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons color="#1d4ed8" name="play-circle-outline" size={22} />
              <Text style={styles.sectionTitle}>Van hanh chuyen</Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{tripStatus}</Text>
            </View>
          </View>
          <Text style={styles.helperText}>
            UC44 bat dau chuyen sau khi tai xe da xac nhan phuong tien san sang.
          </Text>
          <View style={styles.operationBox}>
            <Text style={styles.helperText}>{helperText}</Text>
            {gpsStatus !== 'NOT_REQUESTED' ? (
              <Text style={gpsStatus === 'SYNCED' ? styles.successText : styles.warningText}>
                GPS: {gpsStatus === 'SYNCED' ? 'Da dong bo khi bat dau chuyen' : 'Dong bo GPS chua thanh cong'}
              </Text>
            ) : null}
            <View style={styles.actionGrid}>
              <AppButton
                title="UC44 - Bat dau chuyen"
                disabled={!canStart}
                loading={processingAction === 'start'}
                onPress={startTrip}
                style={styles.actionButton}
              />
              <AppButton
                title="UC45 - Hoan thanh chuyen"
                disabled={!canComplete}
                loading={processingAction === 'complete'}
                onPress={completeTrip}
                style={styles.actionButton}
              />
              <AppButton
                title="Reload GPS"
                disabled={!canSyncGps}
                loading={processingAction === 'gps'}
                onPress={syncGps}
                variant="secondary"
                style={styles.actionButton}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <MaterialCommunityIcons color={colors.error} name="alert-circle-outline" size={22} />
            <Text style={styles.sectionTitle}>Report Incident</Text>
          </View>
          <Text style={styles.helperText}>Available while the trip is running.</Text>
          <TextInput
            editable={isTripInProgress && !Boolean(processingAction)}
            multiline
            onChangeText={setIncidentDescription}
            placeholder="Describe traffic, accident, breakdown, or another operation incident."
            placeholderTextColor={colors.muted}
            style={styles.incidentInput}
            value={incidentDescription}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!canReportIncident || processingAction === 'incident'}
            onPress={reportIncident}
            style={({ pressed }) => [
              styles.dangerButton,
              (!canReportIncident || processingAction === 'incident') && styles.dangerButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.dangerButtonText}>
              {processingAction === 'incident' ? 'Dang gui...' : 'Report Incident'}
            </Text>
          </Pressable>
        </View>

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
  title: { color: colors.primary, fontSize: 24, fontWeight: '900' },
  tripCard: { gap: 8, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  tripCode: { color: colors.primary, fontSize: 20, fontWeight: '900' },
  routeName: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  summaryGrid: { gap: 4, marginTop: 4 },
  summaryText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  section: { gap: 12, marginTop: 18, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  sectionTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  helperText: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  operationBox: { gap: 12, borderRadius: 18, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', padding: 14 },
  statusPill: { alignSelf: 'flex-start', borderRadius: 16, backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 6 },
  statusPillText: { color: '#1d4ed8', fontSize: 10, fontWeight: '900' },
  successText: { borderRadius: 14, backgroundColor: '#ecfdf5', padding: 12, color: '#047857', fontSize: 13, fontWeight: '800' },
  warningText: { borderRadius: 14, backgroundColor: '#fff7ed', padding: 12, color: '#9a3412', fontSize: 13, fontWeight: '800' },
  actionGrid: { gap: 10 },
  actionButton: { width: '100%' },
  mapSection: {
    gap: 12,
    marginTop: 18,
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: colors.card,
  },
  mapHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: 16, paddingBottom: 0 },
  accuracyPill: { borderRadius: 16, backgroundColor: '#d4f2e5', paddingHorizontal: 10, paddingVertical: 6 },
  accuracyText: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  embeddedMap: {
    height: 300,
    overflow: 'hidden',
    backgroundColor: colors.surfaceLow,
  },
  webView: { flex: 1, backgroundColor: colors.surfaceLow },
  mapFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.outline,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  footerMetric: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  stopList: { gap: 10, padding: 16, paddingTop: 0 },
  stopListTitle: { color: colors.muted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  stopRow: { flexDirection: 'row', gap: 10, borderRadius: 16, backgroundColor: colors.surfaceLow, padding: 12 },
  stopBadge: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#2563eb' },
  stopBadgeText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  stopContent: { flex: 1, gap: 2 },
  stopName: { color: colors.text, fontSize: 13, fontWeight: '900' },
  stopAddress: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  incidentInput: {
    minHeight: 110,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.outline,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    padding: 14,
    textAlignVertical: 'top',
  },
  dangerButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.error,
    paddingHorizontal: 18,
  },
  dangerButtonDisabled: { opacity: 0.5 },
  dangerButtonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  pressed: { transform: [{ scale: 0.98 }] },
  bottomSpacer: { height: 96 },
});
