import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import passengerApi, {
  type BusRoute,
  type BusRouteStop,
  type FavoriteRouteRecord,
  type FavoriteStopRecord,
  type NearbyStopRecord,
  type NotificationRecord,
} from '@/api/passenger.api';
import { resolveBackendUrl } from '@/constants/config';
import { PassengerBottomNav } from '@/components/navigation/PassengerBottomNav';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';
import { getDeviceGpsPayload, type DeviceGpsPayload } from '@/utils/deviceGps';
import {
  clearPassengerSearchHistory,
  getPassengerSearchHistory,
  savePassengerSearchHistoryItem,
  type PassengerSearchHistoryItem,
  type PassengerSearchType,
} from '@/utils/passengerSearchHistory';

type SearchResult = {
  type: PassengerSearchType;
  id: string;
  title: string;
  subtitle: string;
  routeId?: string;
  routeNumber?: string;
};

type NearbyStopView = NearbyStopRecord & {
  etaText?: string;
  status?: string;
};

type MapMarker = {
  name: string;
  routeNumber?: string;
  latitude?: number;
  longitude?: number;
};

const searchTypes: Array<{
  key: PassengerSearchType;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}> = [
  { key: 'route', label: 'Route', icon: 'bus' },
  { key: 'stop', label: 'Stop', icon: 'map-marker-outline' },
  { key: 'destination', label: 'Destination', icon: 'flag-outline' },
];

const markerPositions = [
  { top: 48, left: 58 },
  { top: 78, left: 104 },
  { top: 106, left: 152 },
  { top: 135, left: 218 },
];

const normalize = (value?: string) => String(value || '').trim().toLowerCase();

const getRouteId = (route: BusRoute) => String(route.id || route._id || route.routeNumber);

const routeFavoriteKeys = (route: {
  id?: string;
  _id?: string;
  routeId?: string;
  routeNumber?: string;
}) => [
  'id' in route ? route.id : undefined,
  '_id' in route ? route._id : undefined,
  route.routeId,
  route.routeNumber,
].filter(Boolean).map((value) => normalize(String(value)));

const stopFavoriteKey = (routeNumber?: string, stopName?: string) => normalize(`${routeNumber || ''}-${stopName || ''}`);

const formatDistance = (distanceKm?: number) => {
  if (typeof distanceKm !== 'number' || Number.isNaN(distanceKm)) return 'Unknown distance';
  return distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`;
};

const sanitizeError = (fallback: string) => fallback;

const getInitials = (name?: string) => {
  const initials = String(name || 'Passenger')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return initials || 'P';
};

const escapeHtml = (value?: string) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const buildMapHtml = ({
  latitude,
  longitude,
  markers,
}: {
  latitude: number;
  longitude: number;
  markers: MapMarker[];
}) => {
  const markerPayload = JSON.stringify(markers
    .filter((marker) => typeof marker.latitude === 'number' && typeof marker.longitude === 'number')
    .map((marker) => ({
      name: escapeHtml(marker.name),
      routeNumber: escapeHtml(marker.routeNumber || 'BUS'),
      latitude: marker.latitude,
      longitude: marker.longitude,
    })));

  return `
<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #d8e6ff; }
    .leaflet-control-attribution { font-size: 9px; }
    .busdn-user {
      width: 18px; height: 18px; border-radius: 50%;
      background: #166bc9; border: 3px solid #fff;
      box-shadow: 0 2px 8px rgba(13, 28, 47, .35);
    }
    .busdn-stop {
      width: 28px; height: 28px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: #07834e; color: #fff; font: 800 9px system-ui;
      border: 2px solid #fff; box-shadow: 0 2px 8px rgba(13, 28, 47, .25);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const center = [${latitude}, ${longitude}];
    const markers = ${markerPayload};
    const map = L.map('map', { zoomControl: false, attributionControl: true }).setView(center, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    L.marker(center, {
      icon: L.divIcon({ className: '', html: '<div class="busdn-user"></div>', iconSize: [24, 24], iconAnchor: [12, 12] })
    }).addTo(map).bindPopup('Current GPS location');
    const bounds = [center];
    markers.forEach((item) => {
      const point = [item.latitude, item.longitude];
      bounds.push(point);
      L.marker(point, {
        icon: L.divIcon({ className: '', html: '<div class="busdn-stop">' + item.routeNumber + '</div>', iconSize: [32, 32], iconAnchor: [16, 16] })
      }).addTo(map).bindPopup(item.name);
    });
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
  </script>
</body>
</html>`;
};

export default function SearchRoutesScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<PassengerSearchType>('route');
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [recentSearches, setRecentSearches] = useState<PassengerSearchHistoryItem[]>([]);
  const [location, setLocation] = useState<DeviceGpsPayload | null>(null);
  const [locationLabel, setLocationLabel] = useState('Use current location to find nearby stops');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [nearbyStops, setNearbyStops] = useState<NearbyStopView[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState('');
  const [mapFailed, setMapFailed] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [favoriteRoutes, setFavoriteRoutes] = useState<Record<string, FavoriteRouteRecord>>({});
  const [favoriteStops, setFavoriteStops] = useState<Record<string, FavoriteStopRecord>>({});
  const [favoriteBusyKey, setFavoriteBusyKey] = useState('');
  const [favoriteMessage, setFavoriteMessage] = useState('');
  const requestSeq = useRef(0);

  const loadHistory = useCallback(async () => {
    setRecentSearches(await getPassengerSearchHistory());
  }, []);

  const loadInitialRoutes = useCallback(async () => {
    setSearchLoading(true);
    setSearchError('');
    try {
      const data = await passengerApi.searchRoutes();
      setRoutes(data.routes || []);
      setSearchResults((data.routes || []).slice(0, 8).map((route) => ({
        type: 'route',
        id: String(route.id || route._id || route.routeNumber),
        routeId: String(route.id || route._id || route.routeNumber),
        routeNumber: route.routeNumber,
        title: `${route.routeNumber} - ${route.name}`,
        subtitle: `${route.origin} to ${route.destination}`,
      })));
    } catch {
      setSearchError(sanitizeError('Unable to load routes. Please retry.'));
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const loadNotificationCount = useCallback(async () => {
    try {
      const notifications = await passengerApi.getNotifications();
      const unread = notifications.filter((item) => (
        item.isRead === false || item.status === 'unread'
      ));
      setNotificationCount(unread.length);
    } catch {
      setNotificationCount(0);
    }
  }, []);

  const loadFavorites = useCallback(async () => {
    try {
      const [savedRoutes, savedStops] = await Promise.all([
        passengerApi.getFavoriteRoutes(),
        passengerApi.getFavoriteStops(),
      ]);

      const nextRouteMap: Record<string, FavoriteRouteRecord> = {};
      savedRoutes.forEach((route) => {
        routeFavoriteKeys(route).forEach((key) => {
          nextRouteMap[key] = route;
        });
      });

      const nextStopMap: Record<string, FavoriteStopRecord> = {};
      savedStops.forEach((stop) => {
        if (stop.stopId) nextStopMap[normalize(stop.stopId)] = stop;
        nextStopMap[stopFavoriteKey(stop.routeNumber, stop.stopName)] = stop;
      });

      setFavoriteRoutes(nextRouteMap);
      setFavoriteStops(nextStopMap);
    } catch {
      setFavoriteRoutes({});
      setFavoriteStops({});
    }
  }, []);

  useEffect(() => {
    void loadHistory();
    void loadInitialRoutes();
    void loadNotificationCount();
    void loadFavorites();
  }, [loadHistory, loadInitialRoutes, loadNotificationCount, loadFavorites]);

  const buildResults = useCallback((routeList: BusRoute[], activeType: PassengerSearchType, activeQuery: string): SearchResult[] => {
    const normalizedQuery = normalize(activeQuery);
    const matchesText = (value?: string) => normalize(value).includes(normalizedQuery);

    if (activeType === 'route') {
      return routeList
        .filter((route) => (
          !normalizedQuery
          || matchesText(route.routeNumber)
          || matchesText(route.name)
          || matchesText(route.origin)
          || matchesText(route.destination)
        ))
        .slice(0, 12)
        .map((route) => ({
          type: 'route',
          id: String(route.id || route._id || route.routeNumber),
          routeId: String(route.id || route._id || route.routeNumber),
          routeNumber: route.routeNumber,
          title: `${route.routeNumber} - ${route.name}`,
          subtitle: `${route.origin} to ${route.destination}`,
        }));
    }

    const stopMap = new Map<string, SearchResult>();
    routeList.forEach((route) => {
      (route.stops || []).forEach((stop: BusRouteStop) => {
        const stopName = stop.name || '';
        const destinationMatched = activeType === 'destination' && (
          matchesText(stopName) || matchesText(route.destination)
        );
        const stopMatched = activeType === 'stop' && matchesText(stopName);

        if (normalizedQuery && !destinationMatched && !stopMatched) return;
        const key = `${activeType}-${stopName.toLowerCase()}-${route.routeNumber}`;
        if (!stopMap.has(key)) {
          stopMap.set(key, {
            type: activeType,
            id: `${route.routeNumber}-${stop.order}-${stopName}`,
            routeId: String(route.id || route._id || route.routeNumber),
            routeNumber: route.routeNumber,
            title: stopName,
            subtitle: `${route.routeNumber} - ${route.name}`,
          });
        }
      });
    });
    return Array.from(stopMap.values()).slice(0, 12);
  }, []);

  const runSearch = useCallback(async (activeQuery: string, activeType: PassengerSearchType) => {
    const trimmedQuery = activeQuery.trim();
    const currentSeq = requestSeq.current + 1;
    requestSeq.current = currentSeq;

    if (!trimmedQuery) {
      setSearchResults(buildResults(routes, activeType, ''));
      setSearchError('');
      return;
    }

    if (trimmedQuery.length < 2) {
      setSearchResults([]);
      setSearchError('');
      return;
    }

    setSearchLoading(true);
    setSearchError('');
    try {
      const params = activeType === 'destination'
        ? { to: trimmedQuery }
        : activeType === 'stop'
          ? { q: trimmedQuery }
          : { q: trimmedQuery };
      const data = await passengerApi.searchRoutes(params);
      if (requestSeq.current !== currentSeq) return;
      const nextRoutes = data.routes || [];
      setRoutes(nextRoutes);
      const nextResults = buildResults(nextRoutes, activeType, trimmedQuery);
      setSearchResults(nextResults);
    } catch {
      if (requestSeq.current === currentSeq) {
        setSearchError(sanitizeError('Search is unavailable. Please retry.'));
      }
    } finally {
      if (requestSeq.current === currentSeq) {
        setSearchLoading(false);
      }
    }
  }, [buildResults, routes]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void runSearch(query, searchType);
    }, 350);
    return () => clearTimeout(timer);
  }, [query, searchType, runSearch]);

  const loadNearbyStops = useCallback(async (gps: DeviceGpsPayload) => {
    if (typeof gps.latitude !== 'number' || typeof gps.longitude !== 'number') return;
    setNearbyLoading(true);
    setNearbyError('');
    try {
      const nearby = await passengerApi.getNearbyRoutes({
        latitude: gps.latitude,
        longitude: gps.longitude,
        radiusKm: 5,
      });
      const stops = nearby.nearbyStops || [];
      const enrichedStops = await Promise.all(stops.slice(0, 6).map(async (stop) => {
        try {
          const routeId = String(stop.route?.id || stop.route?.routeNumber || '');
          if (!routeId) return { ...stop, etaText: 'No ETA data', status: 'No service' };
          const live = await passengerApi.getLiveTracking(routeId);
          const eta = live.stopEtaSummary?.find((item) => normalize(item.stopName) === normalize(stop.name));
          return {
            ...stop,
            etaText: eta?.estimatedArrivalTime || 'No ETA data',
            status: eta?.status || 'Scheduled',
          };
        } catch {
          return { ...stop, etaText: 'No ETA data', status: 'Scheduled' };
        }
      }));
      setNearbyStops(enrichedStops);
    } catch {
      setNearbyError(sanitizeError('Unable to load nearby stops. Please retry.'));
    } finally {
      setNearbyLoading(false);
    }
  }, []);

  const useCurrentLocation = async () => {
    setLocationLoading(true);
    setLocationError('');
    try {
      const gps = await getDeviceGpsPayload();
      if (typeof gps.latitude !== 'number' || typeof gps.longitude !== 'number') {
        setLocationError(gps.message || 'Location permission is required to find nearby stops.');
        setLocation(gps);
        return;
      }
      setLocation(gps);
      setLocationLabel(`Lat ${gps.latitude.toFixed(5)}, Lng ${gps.longitude.toFixed(5)}`);
      await loadNearbyStops(gps);
    } finally {
      setLocationLoading(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setSearchError('');
    setSearchResults(buildResults(routes, searchType, ''));
  };

  const clearHistory = () => {
    Alert.alert('Clear recent searches', 'Remove all recent searches from this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          void clearPassengerSearchHistory().then(() => setRecentSearches([]));
        },
      },
    ]);
  };

  const openResult = async (result: SearchResult) => {
    setRecentSearches(await savePassengerSearchHistoryItem({
      type: result.type,
      id: result.id,
      displayName: result.title,
      subtitle: result.subtitle,
    }));

    if (result.type === 'route') {
      router.push({ pathname: '/route-detail/[routeId]', params: { routeId: result.routeId || result.id } });
      return;
    }

    if (result.type === 'destination') {
      router.push(`/plan-trip?to=${encodeURIComponent(result.title)}`);
      return;
    }

    router.push(`/live-tracking?routeId=${encodeURIComponent(result.routeId || result.routeNumber || '')}`);
  };

  const openHistory = (item: PassengerSearchHistoryItem) => {
    if (item.id && item.type === 'route') {
      router.push({ pathname: '/route-detail/[routeId]', params: { routeId: item.id } });
      return;
    }
    setSearchType(item.type);
    setQuery(item.displayName);
  };

  const getFavoriteRoute = useCallback((route: BusRoute) => (
    routeFavoriteKeys(route).map((key) => favoriteRoutes[key]).find(Boolean)
  ), [favoriteRoutes]);

  const getFavoriteStop = useCallback((stop: NearbyStopView) => (
    (stop.stopId ? favoriteStops[normalize(stop.stopId)] : undefined)
    || favoriteStops[stopFavoriteKey(stop.route?.routeNumber, stop.name)]
  ), [favoriteStops]);

  const toggleFavoriteRoute = async (route: BusRoute) => {
    const routeId = getRouteId(route);
    const existing = getFavoriteRoute(route);
    const busyKey = `route-${routeId}`;

    setFavoriteBusyKey(busyKey);
    setFavoriteMessage('');
    try {
      if (existing?.routeId) {
        await passengerApi.removeFavoriteRoute(existing.routeId);
        setFavoriteMessage('Đã bỏ lưu tuyến yêu thích.');
      } else {
        await passengerApi.saveFavoriteRoute(routeId);
        setFavoriteMessage('Đã lưu tuyến yêu thích.');
      }
      await loadFavorites();
    } catch {
      setFavoriteMessage('Không thể cập nhật tuyến yêu thích. Vui lòng thử lại.');
      await loadFavorites();
    } finally {
      setFavoriteBusyKey('');
    }
  };

  const toggleFavoriteStop = async (stop: NearbyStopView) => {
    const routeId = String(stop.route?.id || stop.route?.routeNumber || '');
    const routeNumber = stop.route?.routeNumber || '';
    const existing = getFavoriteStop(stop);
    const busyKey = `stop-${routeNumber}-${stop.name}`;

    if (!routeId && !routeNumber) {
      setFavoriteMessage('Không đủ thông tin tuyến để lưu trạm.');
      return;
    }

    setFavoriteBusyKey(busyKey);
    setFavoriteMessage('');
    try {
      if (existing?.stopId) {
        await passengerApi.removeFavoriteStop(existing.stopId);
        setFavoriteMessage('Đã bỏ lưu trạm yêu thích.');
      } else {
        await passengerApi.saveFavoriteStop({
          routeId,
          routeNumber,
          stopName: stop.name,
          order: stop.order,
          address: stop.route?.name || stop.name,
          nearbyArrivalText: stop.etaText || stop.status || 'Theo lịch trình',
          distanceMeters: typeof stop.distanceKm === 'number' ? Math.round(stop.distanceKm * 1000) : 0,
        });
        setFavoriteMessage('Đã lưu trạm yêu thích.');
      }
      await loadFavorites();
    } catch {
      setFavoriteMessage('Không thể cập nhật trạm yêu thích. Vui lòng thử lại.');
      await loadFavorites();
    } finally {
      setFavoriteBusyKey('');
    }
  };

  const hasMapData = typeof location?.latitude === 'number' && typeof location?.longitude === 'number';
  const visibleRecentSearches = useMemo(() => recentSearches.slice(0, 4), [recentSearches]);
  const previewStops = useMemo<MapMarker[]>(() => {
    const stops = routes.flatMap((route) => (
      (route.stops || [])
        .filter((stop) => typeof stop.latitude === 'number' && typeof stop.longitude === 'number')
        .slice(0, 2)
        .map((stop) => ({
          name: stop.name,
          routeNumber: route.routeNumber,
          latitude: stop.latitude,
          longitude: stop.longitude,
        }))
    ));
    return stops.slice(0, 4);
  }, [routes]);
  const mapMarkers: MapMarker[] = nearbyStops.length
    ? nearbyStops.slice(0, 4).map((stop) => ({
      name: stop.name,
      routeNumber: stop.route?.routeNumber || 'BUS',
      latitude: stop.latitude,
      longitude: stop.longitude,
    }))
    : previewStops;
  const mapCenter = {
    latitude: typeof location?.latitude === 'number' ? location.latitude : 16.047079,
    longitude: typeof location?.longitude === 'number' ? location.longitude : 108.206230,
  };
  const mapHtml = useMemo(() => buildMapHtml({
    latitude: mapCenter.latitude,
    longitude: mapCenter.longitude,
    markers: mapMarkers,
  }), [mapCenter.latitude, mapCenter.longitude, mapMarkers]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.brand}>BusDN</Text>
            <View style={styles.headerActions}>
              <Pressable accessibilityLabel="Open notifications" onPress={() => router.push('/notifications')} style={styles.iconButton}>
                <MaterialCommunityIcons color={colors.primary} name="bell-outline" size={22} />
                {notificationCount ? <Text style={styles.badge}>{Math.min(notificationCount, 9)}</Text> : null}
              </Pressable>
              <Pressable accessibilityLabel="Open profile" onPress={() => router.push('/profile')} style={styles.avatar}>
                {user?.avatar ? <Image source={{ uri: resolveBackendUrl(user.avatar) }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{getInitials(user?.fullName)}</Text>}
              </Pressable>
            </View>
          </View>

          <View style={styles.searchBox}>
            <MaterialCommunityIcons color={colors.secondary} name="magnify" size={21} />
            <TextInput
              accessibilityLabel="Search routes, stops, or destinations"
              onChangeText={setQuery}
              onSubmitEditing={() => runSearch(query, searchType)}
              placeholder="Search for routes or stops..."
              placeholderTextColor={colors.secondary}
              returnKeyType="search"
              style={styles.input}
              value={query}
            />
            {searchLoading ? <ActivityIndicator color={colors.primary} size="small" /> : null}
            {query ? (
              <Pressable accessibilityLabel="Clear search" hitSlop={8} onPress={clearSearch}>
                <MaterialCommunityIcons color={colors.secondary} name="close-circle" size={20} />
              </Pressable>
            ) : null}
            <Pressable accessibilityLabel="Use current location" hitSlop={8} onPress={useCurrentLocation}>
              <MaterialCommunityIcons color={colors.primary} name="crosshairs-gps" size={22} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.chips} horizontal showsHorizontalScrollIndicator={false}>
            {searchTypes.map((item) => {
              const active = item.key === searchType;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={item.key}
                  onPress={() => setSearchType(item.key)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <MaterialCommunityIcons color={active ? colors.white : colors.secondary} name={item.icon} size={18} />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 112 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {(query.trim().length >= 2 || searchError) ? (
            <View style={styles.panel}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Search Results</Text>
                {searchError ? <Pressable onPress={() => runSearch(query, searchType)}><Text style={styles.link}>Retry</Text></Pressable> : null}
              </View>
              {searchError ? <StateText icon="alert-circle-outline" text={searchError} /> : null}
              {!searchError && !searchLoading && !searchResults.length ? <StateText icon="magnify-close" text="No matching result found." /> : null}
              {!searchError && searchResults.map((result) => (
                <Pressable key={`${result.type}-${result.id}`} onPress={() => openResult(result)} style={styles.resultRow}>
                  <View style={styles.resultIcon}>
                    <MaterialCommunityIcons color={colors.primary} name={result.type === 'route' ? 'bus' : result.type === 'stop' ? 'map-marker-outline' : 'flag-outline'} size={19} />
                  </View>
                  <View style={styles.resultCopy}>
                    <Text numberOfLines={1} style={styles.resultTitle}>{result.title}</Text>
                    <Text numberOfLines={1} style={styles.resultSubtitle}>{result.subtitle}</Text>
                  </View>
                  <MaterialCommunityIcons color={colors.outline} name="chevron-right" size={21} />
                </Pressable>
              ))}
            </View>
          ) : null}

          {!query.trim() && routes.length ? (
            <>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Available Routes</Text>
                <Text style={styles.mutedLink}>{routes.length} routes</Text>
              </View>
              {favoriteMessage ? <Text style={styles.favoriteMessage}>{favoriteMessage}</Text> : null}
              <ScrollView contentContainerStyle={styles.routeStrip} horizontal showsHorizontalScrollIndicator={false}>
                {routes.slice(0, 10).map((route) => {
                  const routeId = getRouteId(route);
                  const isSaved = Boolean(getFavoriteRoute(route));
                  const isBusy = favoriteBusyKey === `route-${routeId}`;
                  return (
                    <View key={routeId} style={styles.routeCard}>
                      <Pressable onPress={() => router.push({ pathname: '/route-detail/[routeId]', params: { routeId } })} style={styles.routeCardMain}>
                        <View style={styles.routeCodePill}>
                          <Text style={styles.routeCodeText}>{route.routeNumber}</Text>
                        </View>
                        <Text numberOfLines={2} style={styles.routeCardTitle}>{route.name || `${route.origin} - ${route.destination}`}</Text>
                        <Text numberOfLines={1} style={styles.routeCardMeta}>{route.origin} to {route.destination}</Text>
                        <Text style={styles.routeCardMeta}>{route.estimatedDurationMinutes || 0} min - {Number(route.fare || 0).toLocaleString('vi-VN')} VND</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSaved, busy: isBusy }}
                        disabled={isBusy}
                        onPress={() => toggleFavoriteRoute(route)}
                        style={[styles.favoriteButton, isSaved && styles.favoriteButtonSaved]}
                      >
                        {isBusy ? (
                          <ActivityIndicator color={isSaved ? colors.primary : colors.white} size="small" />
                        ) : (
                          <MaterialCommunityIcons color={isSaved ? colors.primary : colors.white} name={isSaved ? 'heart' : 'heart-outline'} size={17} />
                        )}
                        <Text style={[styles.favoriteButtonText, isSaved && styles.favoriteButtonTextSaved]}>{isSaved ? 'Đã lưu tuyến' : 'Lưu tuyến'}</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Current Location</Text>
            <Pressable onPress={useCurrentLocation}>
              <Text style={styles.link}>{hasMapData ? 'Refresh' : 'Refresh'}</Text>
            </Pressable>
          </View>
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
              <View style={styles.mapCanvas}>
                <View style={styles.mapRoadA} />
                <View style={styles.mapRoadB} />
                <View style={styles.mapRoadC} />
                <View style={styles.userMarker} />
                {mapMarkers.map((stop, index) => (
                  <View key={`${stop.name}-${index}`} style={[styles.stopMarker, markerPositions[index] || markerPositions[0]]}>
                    <MaterialCommunityIcons color={colors.white} name="bus-stop" size={13} />
                  </View>
                ))}
              </View>
            )}
            <View pointerEvents="none" style={styles.locationOverlay}>
              <View style={styles.locationIcon}>
                {locationLoading ? <ActivityIndicator color={colors.primary} size="small" /> : <MaterialCommunityIcons color={colors.primary} name="map-marker" size={22} />}
              </View>
              <View style={styles.locationCopy}>
                <Text style={styles.locationTitle}>{hasMapData ? 'Current GPS location' : 'Da Nang map preview'}</Text>
                <Text numberOfLines={1} style={styles.locationSubtitle}>{locationError || locationLabel}</Text>
              </View>
            </View>
          </View>
          {locationError ? <StateText icon="map-marker-alert-outline" text={locationError} /> : null}
          {mapFailed ? (
            <Text style={styles.mapNote}>Unable to load OpenStreetMap tiles. Check the device network connection and try refreshing.</Text>
          ) : (
            <Text style={styles.mapNote}>Map uses OpenStreetMap tiles through WebView. Tap Refresh to update GPS and nearby stop markers.</Text>
          )}

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent Searches</Text>
            {visibleRecentSearches.length ? <Pressable onPress={clearHistory}><Text style={styles.mutedLink}>Clear All</Text></Pressable> : null}
          </View>
          {visibleRecentSearches.length ? (
            <View style={styles.recentGrid}>
              {visibleRecentSearches.map((item) => (
                <Pressable key={`${item.timestamp}-${item.displayName}`} onPress={() => openHistory(item)} style={styles.recentCard}>
                  <MaterialCommunityIcons color={colors.secondary} name="history" size={20} />
                  <Text numberOfLines={1} style={styles.recentTitle}>{item.displayName}</Text>
                  <Text numberOfLines={1} style={styles.recentSubtitle}>{item.subtitle || item.type}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.recentCard}>
              <MaterialCommunityIcons color={colors.secondary} name="history" size={20} />
              <Text numberOfLines={1} style={styles.recentTitle}>Chưa có tìm kiếm gần đây</Text>
              <Text numberOfLines={1} style={styles.recentSubtitle}>Kết quả bạn chọn sẽ xuất hiện tại đây</Text>
            </View>
          )}

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Nearby Stops</Text>
            {nearbyError ? <Pressable onPress={() => location && loadNearbyStops(location)}><Text style={styles.link}>Retry</Text></Pressable> : null}
          </View>
          {favoriteMessage ? <Text style={styles.favoriteMessage}>{favoriteMessage}</Text> : null}
          {nearbyLoading ? <LoadingRows /> : null}
          {!nearbyLoading && nearbyError ? <StateText icon="alert-circle-outline" text={nearbyError} /> : null}
          {!nearbyLoading && !nearbyError && !nearbyStops.length ? <StateText icon="bus-stop" text="Tap the location button to find nearby stops." /> : null}
          {!nearbyLoading && !nearbyError && nearbyStops.map((stop) => (
            <View key={`${stop.route?.routeNumber}-${stop.name}`} style={styles.stopCard}>
              <Pressable
                onPress={() => router.push(`/live-tracking?routeId=${encodeURIComponent(String(stop.route?.id || stop.route?.routeNumber || ''))}`)}
                style={styles.stopMain}
              >
                <View style={styles.routeBadge}>
                  <Text style={styles.routeBadgeText}>{stop.route?.routeNumber || 'BUS'}</Text>
                </View>
                <View style={styles.stopCopy}>
                  <Text numberOfLines={1} style={styles.stopName}>{stop.name}</Text>
                  <Text numberOfLines={1} style={styles.stopMeta}>{formatDistance(stop.distanceKm)} - {stop.route?.name || 'BusDN route'}</Text>
                </View>
                <View style={styles.etaCopy}>
                  <Text style={styles.etaText}>{stop.etaText || 'No ETA data'}</Text>
                  <Text style={[styles.statusText, stop.status === 'Delayed' && styles.statusDelayed]}>{stop.status || 'Scheduled'}</Text>
                </View>
              </Pressable>
              <View style={styles.stopFavoriteRow}>
                {(() => {
                  const isSaved = Boolean(getFavoriteStop(stop));
                  const busyKey = `stop-${stop.route?.routeNumber || ''}-${stop.name}`;
                  const isBusy = favoriteBusyKey === busyKey;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSaved, busy: isBusy }}
                      disabled={isBusy}
                      onPress={() => toggleFavoriteStop(stop)}
                      style={[styles.favoriteButton, styles.stopFavoriteButton, isSaved && styles.favoriteButtonSaved]}
                    >
                      {isBusy ? (
                        <ActivityIndicator color={isSaved ? colors.primary : colors.white} size="small" />
                      ) : (
                        <MaterialCommunityIcons color={isSaved ? colors.primary : colors.white} name={isSaved ? 'heart' : 'heart-outline'} size={17} />
                      )}
                      <Text style={[styles.favoriteButtonText, isSaved && styles.favoriteButtonTextSaved]}>{isSaved ? 'Đã lưu trạm' : 'Lưu trạm'}</Text>
                    </Pressable>
                  );
                })()}
              </View>
            </View>
          ))}

          <View style={styles.cta}>
            <Text style={styles.ctaTitle}>Going somewhere new?</Text>
            <Text style={styles.ctaBody}>Let BusDN help you plan the most efficient route across the city.</Text>
            <Pressable onPress={() => router.push('/plan-trip')} style={styles.ctaButton}>
              <Text style={styles.ctaButtonText}>Plan New Trip</Text>
              <MaterialCommunityIcons color={colors.white} name="arrow-right" size={20} />
            </Pressable>
          </View>
        </ScrollView>
        <PassengerBottomNav active="explore" />
      </View>
    </SafeAreaView>
  );
}

function StateText({ icon, text }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; text: string }) {
  return (
    <View style={styles.stateRow}>
      <MaterialCommunityIcons color={colors.secondary} name={icon} size={19} />
      <Text style={styles.stateText}>{text}</Text>
    </View>
  );
}

function LoadingRows() {
  return (
    <View style={styles.loadingBox}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.stateText}>Loading nearby stops</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fbf9ff' },
  screen: { flex: 1, backgroundColor: '#fbf9ff' },
  header: { width: '100%', maxWidth: 430, alignSelf: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 13, backgroundColor: '#fbf9ff' },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: '#004532', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: '#dceafe' },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 17, height: 17, overflow: 'hidden', borderRadius: 9, backgroundColor: colors.error, color: colors.white, fontSize: 10, fontWeight: '900', textAlign: 'center', lineHeight: 17 },
  avatar: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#8df3c3', borderRadius: 21, backgroundColor: '#d8f6e7' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#004532', fontSize: 14, fontWeight: '900' },
  searchBox: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#c1c8c3', borderRadius: 17, backgroundColor: colors.white, paddingHorizontal: 14 },
  input: { flex: 1, color: '#0d1c2f', fontSize: 14, fontWeight: '800' },
  chips: { gap: 8, paddingRight: 20 },
  chip: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: '#d9e8ff', paddingHorizontal: 13 },
  chipActive: { backgroundColor: '#004532' },
  chipText: { color: '#3f4944', fontSize: 12, fontWeight: '900' },
  chipTextActive: { color: colors.white },
  content: { width: '100%', maxWidth: 430, alignSelf: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 12 },
  panel: { gap: 10, borderRadius: 22, backgroundColor: colors.white, padding: 14 },
  sectionRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { color: '#0d1c2f', fontSize: 21, fontWeight: '900', letterSpacing: -0.4 },
  link: { color: '#006c49', fontSize: 13, fontWeight: '900' },
  mutedLink: { color: '#6f7973', fontSize: 12, fontWeight: '900' },
  resultRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 16, backgroundColor: '#eff4ff', padding: 10 },
  resultIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#a6f2d1' },
  resultCopy: { flex: 1 },
  resultTitle: { color: '#0d1c2f', fontSize: 14, fontWeight: '900' },
  resultSubtitle: { marginTop: 2, color: '#6f7973', fontSize: 12, fontWeight: '700' },
  routeStrip: { gap: 12, paddingRight: 20 },
  routeCard: { width: 230, minHeight: 172, gap: 10, borderWidth: 1, borderColor: '#d5e3fd', borderRadius: 22, backgroundColor: colors.white, padding: 14 },
  routeCardMain: { flex: 1, gap: 8 },
  routeCodePill: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#004532', paddingHorizontal: 11, paddingVertical: 6 },
  routeCodeText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  routeCardTitle: { color: '#0d1c2f', fontSize: 15, lineHeight: 20, fontWeight: '900' },
  routeCardMeta: { color: '#6f7973', fontSize: 11, fontWeight: '800' },
  favoriteMessage: { marginTop: -6, color: '#006c49', fontSize: 12, lineHeight: 17, fontWeight: '800' },
  favoriteButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 999, backgroundColor: '#006c49', paddingHorizontal: 12 },
  favoriteButtonSaved: { borderWidth: 1, borderColor: '#8df3c3', backgroundColor: '#d8f6e7' },
  favoriteButtonText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  favoriteButtonTextSaved: { color: colors.primary },
  mapCard: { height: 240, overflow: 'hidden', borderWidth: 1, borderColor: '#d5e3fd', borderRadius: 24, backgroundColor: '#d8e6ff' },
  webMap: { flex: 1, backgroundColor: '#d8e6ff' },
  mapCanvas: { flex: 1, backgroundColor: '#d8e6ff' },
  mapRoadA: { position: 'absolute', top: 45, left: -20, width: 250, height: 2, backgroundColor: 'rgba(255,255,255,0.55)', transform: [{ rotate: '-18deg' }] },
  mapRoadB: { position: 'absolute', top: 105, right: -15, width: 260, height: 2, backgroundColor: 'rgba(255,255,255,0.55)', transform: [{ rotate: '15deg' }] },
  mapRoadC: { position: 'absolute', top: 30, left: 170, width: 2, height: 150, backgroundColor: 'rgba(255,255,255,0.45)', transform: [{ rotate: '8deg' }] },
  userMarker: { position: 'absolute', top: 126, left: '49%', width: 18, height: 18, borderWidth: 3, borderColor: colors.white, borderRadius: 9, backgroundColor: '#166bc9' },
  stopMarker: { position: 'absolute', width: 27, height: 27, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white, borderRadius: 14, backgroundColor: '#07834e' },
  locationOverlay: { position: 'absolute', right: 14, bottom: 14, left: 14, minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.94)', padding: 12 },
  locationIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: '#6ffbbe' },
  locationCopy: { flex: 1 },
  locationTitle: { color: '#0d1c2f', fontSize: 13, fontWeight: '900' },
  locationSubtitle: { marginTop: 2, color: '#6f7973', fontSize: 11, fontWeight: '700' },
  mapNote: { color: '#6f7973', fontSize: 11, lineHeight: 16, fontWeight: '800' },
  stateRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 16, backgroundColor: '#eff4ff', padding: 12 },
  stateText: { flex: 1, color: '#3f4944', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  recentGrid: { gap: 10 },
  recentCard: { minHeight: 94, gap: 7, borderWidth: 1, borderColor: '#d5e3fd', borderRadius: 20, backgroundColor: '#eff4ff', padding: 14 },
  recentTitle: { color: '#0d1c2f', fontSize: 13, fontWeight: '900' },
  recentSubtitle: { color: '#6f7973', fontSize: 11, fontWeight: '700' },
  loadingBox: { minHeight: 92, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 20, backgroundColor: colors.white },
  stopCard: { minHeight: 116, gap: 12, borderWidth: 1, borderColor: '#d5e3fd', borderRadius: 20, backgroundColor: colors.white, padding: 14 },
  stopMain: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeBadge: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#d8f6e7' },
  routeBadgeText: { color: '#006c49', fontSize: 12, fontWeight: '900' },
  stopCopy: { flex: 1 },
  stopName: { color: '#0d1c2f', fontSize: 14, fontWeight: '900' },
  stopMeta: { marginTop: 3, color: '#6f7973', fontSize: 11, fontWeight: '700' },
  etaCopy: { alignItems: 'flex-end', maxWidth: 96 },
  etaText: { color: '#006c49', fontSize: 14, fontWeight: '900' },
  statusText: { marginTop: 2, color: '#6f7973', fontSize: 10, fontWeight: '900' },
  statusDelayed: { color: colors.error },
  stopFavoriteRow: { alignItems: 'flex-end' },
  stopFavoriteButton: { minWidth: 126 },
  cta: { gap: 10, overflow: 'hidden', borderRadius: 28, backgroundColor: '#065f46', padding: 20 },
  ctaTitle: { color: '#a6f2d1', fontSize: 20, fontWeight: '900' },
  ctaBody: { color: 'rgba(216,246,231,0.85)', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  ctaButton: { alignSelf: 'flex-start', minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, backgroundColor: '#006c49', paddingHorizontal: 16 },
  ctaButtonText: { color: colors.white, fontSize: 13, fontWeight: '900' },
});
