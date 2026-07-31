import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import routeDiscoveryApi, { buildStopId } from '@/api/routeDiscovery.api';
import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';
import type {
  BusRoute,
  FavoriteRoute,
  FavoriteStop,
  LiveBusResponse,
  NearbyStop,
  NotificationSubscription,
  RouteStop,
  RouteSuggestion,
  SystemNotification,
} from '@/types/routeDiscovery';
import { getDeviceGpsPayload } from '@/utils/deviceGps';
import { getErrorMessage } from '@/utils/validation';

type TabKey = 'search' | 'nearby' | 'best' | 'saved' | 'notifications';

const formatFare = (fare?: number) => (
  typeof fare === 'number' && fare > 0
    ? `${fare.toLocaleString('vi-VN')} VND`
    : 'Fare unavailable'
);

const formatHours = (route: BusRoute) => {
  const hours = route.operatingHours;
  if (!hours) return 'Operating hours unavailable';
  return `${hours.firstDeparture || '--:--'} - ${hours.lastDeparture || '--:--'} | ${hours.frequencyMinutes || '?'} min`;
};

const routeIdOf = (route: BusRoute | FavoriteRoute | NotificationSubscription) => (
  String(('id' in route ? route.id : undefined) || ('routeId' in route ? route.routeId : undefined) || '')
);

const isPassenger = (role?: string | null) => String(role || '').toUpperCase() === 'PASSENGER';

function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.stateBox}>
      <MaterialCommunityIcons color={colors.secondary} name="map-search-outline" size={24} />
      <Text style={styles.stateText}>{message}</Text>
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={[styles.stateBox, styles.errorBox]}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.inlineButton}>
          <Text style={styles.inlineButtonText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function RouteCard({
  route,
  favorite,
  disabled,
  onOpen,
  onToggleFavorite,
}: {
  route: BusRoute;
  favorite: boolean;
  disabled?: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <Pressable onPress={onOpen} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.routeBadge}>
          <Text style={styles.routeBadgeText}>{route.routeNumber || 'BUS'}</Text>
        </View>
        <View style={styles.cardTitleWrap}>
          <Text numberOfLines={2} style={styles.cardTitle}>{route.name || 'Unnamed route'}</Text>
          <Text style={styles.cardMeta}>{route.origin || 'Unknown'} {'->'} {route.destination || 'Unknown'}</Text>
        </View>
        <Pressable
          disabled={disabled}
          hitSlop={8}
          onPress={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
          style={styles.iconButton}
        >
          <MaterialCommunityIcons
            color={favorite ? '#d59600' : colors.secondary}
            name={favorite ? 'star' : 'star-outline'}
            size={22}
          />
        </Pressable>
      </View>
      <View style={styles.rowWrap}>
        <Text style={styles.pill}>{formatHours(route)}</Text>
        <Text style={styles.pill}>{route.estimatedDurationMinutes || '?'} min</Text>
        <Text style={styles.pill}>{formatFare(route.fare)}</Text>
      </View>
    </Pressable>
  );
}

function StopCard({
  stop,
  favorite,
  onFavorite,
  onOpenRoute,
}: {
  stop: NearbyStop | (FavoriteStop & { route?: BusRoute });
  favorite: boolean;
  onFavorite: () => void;
  onOpenRoute?: () => void;
}) {
  const stopName = 'stopName' in stop ? stop.stopName : stop.name;
  const routeNumber = stop.route?.routeNumber || ('routeNumber' in stop ? stop.routeNumber : '');

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons color={colors.accent} name="bus-stop" size={23} />
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle}>{stopName}</Text>
          <Text style={styles.cardMeta}>
            {routeNumber ? `Route ${routeNumber}` : 'Saved stop'}
            {'distanceKm' in stop && typeof stop.distanceKm === 'number' ? ` | ${stop.distanceKm} km` : ''}
          </Text>
        </View>
        <Pressable hitSlop={8} onPress={onFavorite} style={styles.iconButton}>
          <MaterialCommunityIcons color={favorite ? '#d59600' : colors.secondary} name={favorite ? 'star' : 'star-outline'} size={22} />
        </Pressable>
      </View>
      {onOpenRoute ? (
        <Pressable onPress={onOpenRoute} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Open route detail</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function RouteSearchScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ from?: string; to?: string; q?: string }>();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const [tab, setTab] = useState<TabKey>('search');
  const [keyword, setKeyword] = useState('');
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [nearbyStops, setNearbyStops] = useState<NearbyStop[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<BusRoute | null>(null);
  const [bestFrom, setBestFrom] = useState('');
  const [bestTo, setBestTo] = useState('');
  const [preference, setPreference] = useState('fastest');
  const [suggestions, setSuggestions] = useState<RouteSuggestion[]>([]);
  const [favoriteRoutes, setFavoriteRoutes] = useState<FavoriteRoute[]>([]);
  const [favoriteStops, setFavoriteStops] = useState<FavoriteStop[]>([]);
  const [arrivalSubs, setArrivalSubs] = useState<NotificationSubscription[]>([]);
  const [delaySubs, setDelaySubs] = useState<NotificationSubscription[]>([]);
  const [routeChangeSubs, setRouteChangeSubs] = useState<NotificationSubscription[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [liveData, setLiveData] = useState<LiveBusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canUsePassengerFeatures = isAuthenticated && isPassenger(user?.role);

  useEffect(() => {
    const from = typeof params.from === 'string' ? params.from : '';
    const to = typeof params.to === 'string' ? params.to : '';
    const q = typeof params.q === 'string' ? params.q : '';

    if (from || to) {
      setBestFrom(from);
      setBestTo(to);
      setTab('best');
      return;
    }

    if (q) {
      setKeyword(q);
      setTab('search');
    }
  }, [params.from, params.q, params.to]);

  const isFavoriteRoute = useCallback((route: BusRoute) => (
    favoriteRoutes.some((item) => routeIdOf(item) === String(route.id) || item.routeNumber === route.routeNumber)
  ), [favoriteRoutes]);

  const isFavoriteStop = useCallback((route: BusRoute, stop: RouteStop) => {
    const stopId = buildStopId(route, stop);
    return favoriteStops.some((item) => item.stopId === stopId);
  }, [favoriteStops]);

  const loadPassengerData = useCallback(async () => {
    if (!canUsePassengerFeatures) return;

    try {
      const [
        nextFavoriteRoutes,
        nextFavoriteStops,
        nextArrival,
        nextDelay,
        nextRouteChange,
        nextNotifications,
      ] = await Promise.all([
        routeDiscoveryApi.getFavoriteRoutes(),
        routeDiscoveryApi.getFavoriteStops(),
        routeDiscoveryApi.getArrivalNotifications(),
        routeDiscoveryApi.getDelayNotifications(),
        routeDiscoveryApi.getRouteChangeNotifications(),
        routeDiscoveryApi.getMyNotifications(),
      ]);

      setFavoriteRoutes(nextFavoriteRoutes || []);
      setFavoriteStops(nextFavoriteStops || []);
      setArrivalSubs(nextArrival || []);
      setDelaySubs(nextDelay || []);
      setRouteChangeSubs(nextRouteChange || []);
      setNotifications(nextNotifications || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load passenger saved data.'));
    }
  }, [canUsePassengerFeatures]);

  const searchRoutes = useCallback(async (rawKeyword: string) => {
    const q = rawKeyword.trim();
    if (!q) {
      setRoutes([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await routeDiscoveryApi.searchRoutes({ q });
      setRoutes((result.routes || []).filter((route) => route.status !== 'DRAFT' && route.status !== 'INACTIVE'));
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to search routes.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (tab === 'search') void searchRoutes(keyword);
    }, 450);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [keyword, searchRoutes, tab]);

  useEffect(() => {
    void loadPassengerData();
  }, [loadPassengerData]);

  const openRoute = async (route: BusRoute) => {
    setDetailLoading(true);
    setError('');
    try {
      const detail = await routeDiscoveryApi.getRouteDetail(route);
      setSelectedRoute(detail || route);
      setTab('search');
      setLiveData(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load route detail.'));
      setSelectedRoute(route);
    } finally {
      setDetailLoading(false);
    }
  };

  const requirePassenger = () => {
    if (canUsePassengerFeatures) return true;
    Alert.alert('Login required', 'Please sign in with a passenger account to use favorites and notification preferences.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Login', onPress: () => router.push('/auth/login') },
    ]);
    return false;
  };

  const toggleFavoriteRoute = async (route: BusRoute) => {
    if (!requirePassenger()) return;
    setSaving(true);
    setError('');
    try {
      if (isFavoriteRoute(route)) {
        await routeDiscoveryApi.removeFavoriteRoute(String(route.id));
      } else {
        await routeDiscoveryApi.saveFavoriteRoute(String(route.id));
      }
      await loadPassengerData();
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to update favorite route.');
      if (!message.toLowerCase().includes('already')) setError(message);
      await loadPassengerData();
    } finally {
      setSaving(false);
    }
  };

  const toggleFavoriteStop = async (route: BusRoute, stop: RouteStop) => {
    if (!requirePassenger()) return;
    const stopId = buildStopId(route, stop);
    setSaving(true);
    setError('');
    try {
      if (isFavoriteStop(route, stop)) {
        await routeDiscoveryApi.removeFavoriteStop(stopId);
      } else {
        await routeDiscoveryApi.saveFavoriteStop({
          routeId: String(route.id),
          routeNumber: route.routeNumber,
          stopId,
          stopName: stop.name || stop.stopName,
          order: stop.order || stop.stopOrder,
          nearbyArrivalText: `Every ${route.operatingHours?.frequencyMinutes || 30} min`,
        });
      }
      await loadPassengerData();
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to update favorite stop.');
      if (!message.toLowerCase().includes('already')) setError(message);
      await loadPassengerData();
    } finally {
      setSaving(false);
    }
  };

  const useCurrentLocation = async () => {
    setLoading(true);
    setError('');
    setTab('nearby');
    try {
      const gps = await getDeviceGpsPayload();
      const latitude = Number(gps.latitude);
      const longitude = Number(gps.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        setError(gps.message || 'GPS is unavailable. You can still search manually.');
        return;
      }

      const result = await routeDiscoveryApi.searchNearbyRoutes({ latitude, longitude, radiusKm: 5 });
      setNearbyStops([...(result.nearbyStops || [])].sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0)));
      setRoutes(result.routes || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to find nearby stops.'));
    } finally {
      setLoading(false);
    }
  };

  const findBestRoute = async () => {
    const from = bestFrom.trim();
    const to = bestTo.trim();
    setError('');

    if (!from || !to) {
      setError('Origin and destination are required.');
      return;
    }
    if (from.toLowerCase() === to.toLowerCase()) {
      setError('Origin and destination must be different.');
      return;
    }

    setLoading(true);
    try {
      const result = await routeDiscoveryApi.suggestRouteOptions({ from, to, preference });
      const nextSuggestions = result.suggestions?.length
        ? result.suggestions
        : [
          ...(result.bestRoute ? [{ ...result.bestRoute, isRecommended: true }] : []),
          ...(result.alternatives || []),
        ];
      setSuggestions(nextSuggestions);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to find best route.'));
    } finally {
      setLoading(false);
    }
  };

  const refreshLive = useCallback(async (route: BusRoute) => {
    setLiveLoading(true);
    try {
      const result = await routeDiscoveryApi.getLiveBusLocations(String(route.id));
      setLiveData(result);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to refresh live bus locations.'));
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedRoute) return undefined;
    void refreshLive(selectedRoute);
    const interval = setInterval(() => {
      void refreshLive(selectedRoute);
    }, 20000);
    return () => clearInterval(interval);
  }, [refreshLive, selectedRoute]);

  const toggleRouteSubscription = async (
    kind: 'delay' | 'routeChange',
    route: BusRoute,
  ) => {
    if (!requirePassenger()) return;
    setSaving(true);
    setError('');
    const list = kind === 'delay' ? delaySubs : routeChangeSubs;
    const existing = list.find((item) => routeIdOf(item) === String(route.id) || item.routeNumber === route.routeNumber);
    try {
      if (existing) {
        if (kind === 'delay') await routeDiscoveryApi.removeDelayNotification(existing.subscriptionId);
        else await routeDiscoveryApi.removeRouteChangeNotification(existing.subscriptionId);
      } else if (kind === 'delay') {
        await routeDiscoveryApi.subscribeDelayNotification({ routeId: String(route.id), routeNumber: route.routeNumber });
      } else {
        await routeDiscoveryApi.subscribeRouteChangeNotification({ routeId: String(route.id), routeNumber: route.routeNumber });
      }
      await loadPassengerData();
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to update notification.');
      if (!message.toLowerCase().includes('already')) setError(message);
      await loadPassengerData();
    } finally {
      setSaving(false);
    }
  };

  const toggleArrivalSubscription = async (route: BusRoute, stop: RouteStop) => {
    if (!requirePassenger()) return;
    const stopId = buildStopId(route, stop);
    const existing = arrivalSubs.find((item) => item.stopId === stopId);
    setSaving(true);
    setError('');
    try {
      if (existing) {
        await routeDiscoveryApi.removeArrivalNotification(existing.subscriptionId);
      } else {
        await routeDiscoveryApi.subscribeArrivalNotification({
          routeId: String(route.id),
          routeNumber: route.routeNumber,
          stopId,
          stopName: stop.name || stop.stopName,
          order: stop.order || stop.stopOrder,
          etaThresholdMinutes: 5,
        });
      }
      await loadPassengerData();
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to update arrival notification.');
      if (!message.toLowerCase().includes('already')) setError(message);
      await loadPassengerData();
    } finally {
      setSaving(false);
    }
  };

  const toggleGlobalNotifications = async (enabled: boolean) => {
    if (!requirePassenger() || !user) return;
    setSaving(true);
    setError('');
    try {
      await routeDiscoveryApi.updateNotificationEnabled(user, enabled);
      await refreshUser();
      await loadPassengerData();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to save notification preference.'));
    } finally {
      setSaving(false);
    }
  };

  const routeDelaySub = useMemo(() => (
    selectedRoute
      ? delaySubs.find((item) => routeIdOf(item) === String(selectedRoute.id) || item.routeNumber === selectedRoute.routeNumber)
      : null
  ), [delaySubs, selectedRoute]);

  const routeChangeSub = useMemo(() => (
    selectedRoute
      ? routeChangeSubs.find((item) => routeIdOf(item) === String(selectedRoute.id) || item.routeNumber === selectedRoute.routeNumber)
      : null
  ), [routeChangeSubs, selectedRoute]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 130 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.kicker}>BusDN Mobile</Text>
              <Text style={styles.title}>Route Discovery</Text>
            </View>
            <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} style={styles.iconButton}>
              <MaterialCommunityIcons color={colors.primary} name="close" size={24} />
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {[
              ['search', 'Search'],
              ['nearby', 'Nearby'],
              ['best', 'Best Route'],
              ['saved', 'Saved'],
              ['notifications', 'Alerts'],
            ].map(([key, label]) => (
              <Pressable key={key} onPress={() => setTab(key as TabKey)} style={[styles.tab, tab === key && styles.tabActive]}>
                <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {error ? <ErrorState message={error} onRetry={tab === 'nearby' ? useCurrentLocation : undefined} /> : null}

          {tab === 'search' ? (
            <View style={styles.section}>
              <View style={styles.searchBox}>
                <MaterialCommunityIcons color={colors.secondary} name="magnify" size={21} />
                <TextInput
                  onChangeText={setKeyword}
                  placeholder="Route number, route name, stop, destination"
                  placeholderTextColor="#64736c"
                  style={styles.searchInput}
                  value={keyword}
                />
              </View>
              <Pressable disabled={loading} onPress={useCurrentLocation} style={styles.primaryButton}>
                <MaterialCommunityIcons color={colors.white} name="crosshairs-gps" size={19} />
                <Text style={styles.primaryButtonText}>{loading ? 'Loading...' : 'Use current location'}</Text>
              </Pressable>
              {loading ? <ActivityIndicator color={colors.primary} /> : null}
              {!loading && keyword.trim() && routes.length === 0 ? <EmptyState message="No matching routes found." /> : null}
              {routes.map((route) => (
                <RouteCard
                  disabled={saving}
                  favorite={isFavoriteRoute(route)}
                  key={String(route.id || route.routeNumber)}
                  onOpen={() => void openRoute(route)}
                  onToggleFavorite={() => void toggleFavoriteRoute(route)}
                  route={route}
                />
              ))}
            </View>
          ) : null}

          {tab === 'nearby' ? (
            <View style={styles.section}>
              <Pressable disabled={loading} onPress={useCurrentLocation} style={styles.primaryButton}>
                <MaterialCommunityIcons color={colors.white} name="map-marker-radius-outline" size={19} />
                <Text style={styles.primaryButtonText}>{loading ? 'Checking GPS...' : 'Refresh nearby stops'}</Text>
              </Pressable>
              {loading ? <ActivityIndicator color={colors.primary} /> : null}
              {!loading && nearbyStops.length === 0 ? <EmptyState message="Use current location to find nearby stops and suggested routes." /> : null}
              {nearbyStops.map((stop) => (
                <StopCard
                  favorite={stop.route ? isFavoriteStop(stop.route, stop) : false}
                  key={`${stop.route?.routeNumber}-${stop.order}-${stop.name}`}
                  onFavorite={() => stop.route && void toggleFavoriteStop(stop.route, stop)}
                  onOpenRoute={() => stop.route && void openRoute(stop.route)}
                  stop={stop}
                />
              ))}
            </View>
          ) : null}

          {tab === 'best' ? (
            <View style={styles.section}>
              <TextInput onChangeText={setBestFrom} placeholder="Origin stop or address" placeholderTextColor="#64736c" style={styles.input} value={bestFrom} />
              <TextInput onChangeText={setBestTo} placeholder="Destination stop or address" placeholderTextColor="#64736c" style={styles.input} value={bestTo} />
              <View style={styles.rowWrap}>
                {['fastest', 'shortest', 'lowest-cost', 'least-traffic'].map((item) => (
                  <Pressable key={item} onPress={() => setPreference(item)} style={[styles.choice, preference === item && styles.choiceActive]}>
                    <Text style={[styles.choiceText, preference === item && styles.choiceTextActive]}>{item}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable disabled={loading} onPress={findBestRoute} style={styles.primaryButton}>
                <MaterialCommunityIcons color={colors.white} name="routes" size={19} />
                <Text style={styles.primaryButtonText}>{loading ? 'Calculating...' : 'Find best route'}</Text>
              </Pressable>
              {!loading && suggestions.length === 0 ? <EmptyState message="No route option selected yet." /> : null}
              {suggestions.map((item, index) => (
                <Pressable key={`${item.route?.id}-${index}`} onPress={() => void openRoute(item.route)} style={styles.card}>
                  <Text style={styles.cardTitle}>{item.isRecommended || index === 0 ? 'Recommended: ' : ''}{item.route.routeNumber} - {item.route.name}</Text>
                  <Text style={styles.cardMeta}>{item.startStop?.name || item.route.origin} {'->'} {item.endStop?.name || item.route.destination}</Text>
                  <View style={styles.rowWrap}>
                    <Text style={styles.pill}>{item.estimatedDurationMinutes || item.route.estimatedDurationMinutes || '?'} min</Text>
                    <Text style={styles.pill}>{item.estimatedDistanceKm || item.route.distanceKm || '?'} km</Text>
                    <Text style={styles.pill}>{formatFare(item.estimatedFare || item.route.fare)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          {tab === 'saved' ? (
            <View style={styles.section}>
              {!canUsePassengerFeatures ? <EmptyState message="Login as passenger to view favorite routes and stops." /> : null}
              {canUsePassengerFeatures && favoriteRoutes.length === 0 && favoriteStops.length === 0 ? <EmptyState message="No saved routes or stops yet." /> : null}
              {favoriteRoutes.map((item) => (
                <Pressable
                  key={item.routeId || item.routeNumber}
                  onPress={() => void searchRoutes(item.routeNumber)}
                  style={styles.card}
                >
                  <Text style={styles.cardTitle}>{item.routeNumber}</Text>
                  <Text style={styles.cardMeta}>{item.destination || 'Favorite route'}</Text>
                </Pressable>
              ))}
              {favoriteStops.map((item) => (
                <StopCard
                  favorite
                  key={item.stopId}
                  onFavorite={() => void routeDiscoveryApi.removeFavoriteStop(item.stopId).then(loadPassengerData)}
                  stop={item}
                />
              ))}
            </View>
          ) : null}

          {tab === 'notifications' ? (
            <View style={styles.section}>
              {!canUsePassengerFeatures ? <EmptyState message="Login as passenger to manage notifications." /> : (
                <>
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardTitleWrap}>
                        <Text style={styles.cardTitle}>Global notifications</Text>
                        <Text style={styles.cardMeta}>Saved to Backend profile preference.</Text>
                      </View>
                      <Switch
                        disabled={saving}
                        onValueChange={toggleGlobalNotifications}
                        value={Boolean(user?.notificationEnabled)}
                      />
                    </View>
                  </View>
                  <Text style={styles.sectionTitle}>Notification list</Text>
                  {notifications.length === 0 ? <EmptyState message="No bus arrival, delay, or route change notifications found." /> : null}
                  {notifications.map((item) => (
                    <View key={item.id || item._id || item.title} style={styles.card}>
                      <Text style={styles.cardTitle}>{item.title}</Text>
                      <Text style={styles.cardMeta}>{item.type || 'system'} | {item.priority || 'normal'}</Text>
                      <Text style={styles.bodyText}>{item.message}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          ) : null}

          {selectedRoute ? (
            <View style={styles.detailPanel}>
              <View style={styles.cardHeader}>
                <View style={styles.routeBadge}>
                  <Text style={styles.routeBadgeText}>{selectedRoute.routeNumber}</Text>
                </View>
                <View style={styles.cardTitleWrap}>
                  <Text style={styles.detailTitle}>{selectedRoute.name}</Text>
                  <Text style={styles.cardMeta}>{selectedRoute.origin} {'->'} {selectedRoute.destination}</Text>
                </View>
              </View>

              {detailLoading ? <ActivityIndicator color={colors.primary} /> : null}

              <View style={styles.rowWrap}>
                <Text style={styles.pill}>{formatHours(selectedRoute)}</Text>
                <Text style={styles.pill}>{selectedRoute.estimatedDurationMinutes || '?'} min</Text>
                <Text style={styles.pill}>{formatFare(selectedRoute.fare)}</Text>
              </View>

              <View style={styles.actionRow}>
                <Pressable disabled={saving} onPress={() => void toggleFavoriteRoute(selectedRoute)} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>{isFavoriteRoute(selectedRoute) ? 'Unsave route' : 'Save route'}</Text>
                </Pressable>
                <Pressable disabled={liveLoading} onPress={() => void refreshLive(selectedRoute)} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>{liveLoading ? 'Refreshing...' : 'Refresh live'}</Text>
                </Pressable>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Notification preferences</Text>
                <View style={styles.toggleLine}>
                  <Text style={styles.bodyText}>Delay alerts</Text>
                  <Switch disabled={saving} onValueChange={() => void toggleRouteSubscription('delay', selectedRoute)} value={Boolean(routeDelaySub)} />
                </View>
                <View style={styles.toggleLine}>
                  <Text style={styles.bodyText}>Route change alerts</Text>
                  <Switch disabled={saving} onValueChange={() => void toggleRouteSubscription('routeChange', selectedRoute)} value={Boolean(routeChangeSub)} />
                </View>
              </View>

              <Text style={styles.sectionTitle}>Stops and arrival alerts</Text>
              {(selectedRoute.stops || []).length === 0 ? <EmptyState message="This route has no stop/path data yet." /> : null}
              {(selectedRoute.stops || []).map((stop) => {
                const stopId = buildStopId(selectedRoute, stop);
                const arrivalEnabled = arrivalSubs.some((item) => item.stopId === stopId);
                const eta = liveData?.stopEtaSummary?.find((item) => item.stopId === stopId || item.stopName === stop.name);
                return (
                  <View key={stopId} style={styles.stopLine}>
                    <View style={styles.stopDot}>
                      <Text style={styles.stopOrder}>{stop.order}</Text>
                    </View>
                    <View style={styles.cardTitleWrap}>
                      <Text style={styles.bodyStrong}>{stop.name || stop.stopName}</Text>
                      <Text style={styles.cardMeta}>{eta?.estimatedArrivalTime || 'ETA not available'}</Text>
                    </View>
                    <Pressable disabled={saving} onPress={() => void toggleFavoriteStop(selectedRoute, stop)} hitSlop={8}>
                      <MaterialCommunityIcons color={isFavoriteStop(selectedRoute, stop) ? '#d59600' : colors.secondary} name="star-outline" size={20} />
                    </Pressable>
                    <Pressable disabled={saving} onPress={() => void toggleArrivalSubscription(selectedRoute, stop)} hitSlop={8}>
                      <MaterialCommunityIcons color={arrivalEnabled ? colors.accent : colors.secondary} name={arrivalEnabled ? 'bell-ring' : 'bell-outline'} size={20} />
                    </Pressable>
                  </View>
                );
              })}

              <Text style={styles.sectionTitle}>Live buses, ETA, trip progress</Text>
              {!liveData || liveData.buses.length === 0 ? <EmptyState message="No active buses right now." /> : null}
              {liveData?.buses.map((bus) => (
                <View key={bus.busId} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <MaterialCommunityIcons color={colors.accent} name="bus-clock" size={23} />
                    <View style={styles.cardTitleWrap}>
                      <Text style={styles.cardTitle}>{bus.busId}</Text>
                      <Text style={styles.cardMeta}>{bus.status || 'Running'} | Next: {bus.nextStop || 'Unknown'} | ETA {bus.estimatedArrivalTime || 'N/A'}</Text>
                    </View>
                  </View>
                  {bus.delay ? <Text style={styles.warningText}>Delay {bus.delay.delayDurationMinutes} min: {bus.delay.delayReason}. Updated ETA {bus.delay.updatedEta}</Text> : null}
                  {bus.tripProgress ? (
                    <View style={styles.progressWrap}>
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${bus.tripProgress.progressPercent || 0}%` }]} />
                      </View>
                      <Text style={styles.cardMeta}>
                        {bus.tripProgress.currentStop || 'Current'} {'->'} {bus.tripProgress.nextStop || 'Next'} | {bus.tripProgress.estimatedRemainingTime || 'calculating'}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))}

              {liveData?.routeChange ? (
                <View style={[styles.card, styles.warningBox]}>
                  <Text style={styles.cardTitle}>Route change</Text>
                  <Text style={styles.bodyText}>{liveData.routeChange.reasonForChange}</Text>
                  <Text style={styles.cardMeta}>{liveData.routeChange.updatedRoutePath}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        <RoleBottomNav active="explore" role={user?.role} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 18, paddingTop: 14, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colors.primary, fontSize: 28, fontWeight: '900' },
  tabs: { gap: 8, paddingVertical: 4 },
  tab: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: colors.surfaceHigh },
  tabActive: { backgroundColor: colors.primaryContainer },
  tabText: { color: colors.secondary, fontSize: 12, fontWeight: '800' },
  tabTextActive: { color: colors.white },
  section: { gap: 12 },
  sectionTitle: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  searchBox: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.card },
  searchInput: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  input: { minHeight: 50, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.card, color: colors.text, fontSize: 13, fontWeight: '700' },
  primaryButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 25, backgroundColor: colors.primaryContainer },
  primaryButtonText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  secondaryButton: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14, backgroundColor: '#e3f4ec' },
  secondaryButtonText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  inlineButton: { marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.primaryContainer },
  inlineButtonText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  card: { gap: 10, padding: 14, borderRadius: 18, backgroundColor: colors.card, shadowColor: '#003120', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardTitleWrap: { flex: 1, minWidth: 0 },
  cardTitle: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  detailTitle: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  cardMeta: { marginTop: 3, color: colors.secondary, fontSize: 11, fontWeight: '700' },
  bodyText: { color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  bodyStrong: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  warningText: { color: '#9a5b00', fontSize: 12, fontWeight: '800' },
  routeBadge: { minWidth: 48, height: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderRadius: 13, backgroundColor: '#d8f7e8' },
  routeBadgeText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.surfaceLow },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  pill: { overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 13, backgroundColor: colors.surfaceLow, color: colors.secondary, fontSize: 10, fontWeight: '800' },
  choice: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 13, backgroundColor: colors.surfaceHigh },
  choiceActive: { backgroundColor: colors.primaryContainer },
  choiceText: { color: colors.secondary, fontSize: 10, fontWeight: '900' },
  choiceTextActive: { color: colors.white },
  stateBox: { gap: 8, alignItems: 'flex-start', padding: 14, borderRadius: 18, backgroundColor: colors.surfaceLow },
  stateText: { color: colors.secondary, fontSize: 13, fontWeight: '700' },
  errorBox: { backgroundColor: colors.errorContainer },
  errorText: { color: colors.error, fontSize: 13, fontWeight: '800' },
  detailPanel: { gap: 13, marginTop: 4, padding: 14, borderRadius: 22, backgroundColor: '#eef8f3' },
  actionRow: { flexDirection: 'row', gap: 10 },
  toggleLine: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stopLine: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: colors.card },
  stopDot: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.primaryContainer },
  stopOrder: { color: colors.white, fontSize: 11, fontWeight: '900' },
  progressWrap: { gap: 7 },
  progressBar: { height: 7, overflow: 'hidden', borderRadius: 5, backgroundColor: colors.surfaceHigh },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: colors.accent },
  warningBox: { backgroundColor: '#fff4d8' },
});
