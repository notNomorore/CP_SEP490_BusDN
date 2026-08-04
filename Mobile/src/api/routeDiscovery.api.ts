import apiClient from '@/api/client';
import type {
  BusRoute,
  FavoriteRoute,
  FavoriteStop,
  LiveBusResponse,
  NearbyRoutesResponse,
  NotificationSubscription,
  RouteSearchResponse,
  RouteStop,
  SuggestRouteResponse,
  SystemNotification,
} from '@/types/routeDiscovery';
import type { UserProfile } from '@/types/auth';

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: unknown;
};

const readData = <T>(response: unknown): T => (response as ApiEnvelope<T>).data;

export type FavoriteStopPayload = {
  routeId?: string;
  routeNumber?: string;
  stopId?: string;
  stopName?: string;
  order?: number;
  address?: string;
  nearbyArrivalText?: string;
  distanceMeters?: number;
};

export const buildStopId = (route: BusRoute, stop: RouteStop) => {
  const name = (stop.name || stop.stopName || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${route.routeNumber}-${stop.order || stop.stopOrder || 0}-${name}`;
};

export const routeDiscoveryApi = {
  searchRoutes: async (params: { q?: string; from?: string; to?: string }): Promise<RouteSearchResponse> => {
    const response = await apiClient.get('/routes/search', { params });
    return readData<RouteSearchResponse>(response);
  },

  searchNearbyRoutes: async (params: {
    latitude: number;
    longitude: number;
    radiusKm?: number;
  }): Promise<NearbyRoutesResponse> => {
    const response = await apiClient.get('/routes/nearby', { params });
    return readData<NearbyRoutesResponse>(response);
  },

  suggestRouteOptions: async (params: {
    from: string;
    to: string;
    preference?: string;
  }): Promise<SuggestRouteResponse> => {
    const response = await apiClient.get('/routes/suggestions', { params });
    return readData<SuggestRouteResponse>(response);
  },

  getRouteDetail: async (route: BusRoute | string): Promise<BusRoute | null> => {
    const routeId = typeof route === 'string' ? route : route.id || route.routeNumber;
    const response = await apiClient.get('/routes/search', { params: { q: routeId } });
    const data = readData<RouteSearchResponse>(response);
    return data.routes.find((item) => String(item.id) === String(routeId) || item.routeNumber === routeId) || data.routes[0] || null;
  },

  getLiveBusLocations: async (routeId: string): Promise<LiveBusResponse> => {
    const response = await apiClient.get(`/routes/${routeId}/live`);
    return readData<LiveBusResponse>(response);
  },

  getEstimatedArrivalTimes: async (routeId: string): Promise<LiveBusResponse> => {
    const response = await apiClient.get(`/routes/${routeId}/eta`);
    return readData<LiveBusResponse>(response);
  },

  getFavoriteRoutes: async (): Promise<FavoriteRoute[]> => {
    const response = await apiClient.get('/profile/favorites/routes');
    return readData<FavoriteRoute[]>(response);
  },

  saveFavoriteRoute: async (routeId: string): Promise<FavoriteRoute> => {
    const response = await apiClient.post(`/profile/favorites/routes/${routeId}`);
    return readData<FavoriteRoute>(response);
  },

  removeFavoriteRoute: async (routeId: string): Promise<FavoriteRoute> => {
    const response = await apiClient.delete(`/profile/favorites/routes/${routeId}`);
    return readData<FavoriteRoute>(response);
  },

  getFavoriteStops: async (): Promise<FavoriteStop[]> => {
    const response = await apiClient.get('/profile/favorites/stops');
    return readData<FavoriteStop[]>(response);
  },

  saveFavoriteStop: async (payload: FavoriteStopPayload): Promise<FavoriteStop> => {
    const response = await apiClient.post('/profile/favorites/stops', payload);
    return readData<FavoriteStop>(response);
  },

  removeFavoriteStop: async (stopId: string): Promise<FavoriteStop> => {
    const response = await apiClient.delete(`/profile/favorites/stops/${encodeURIComponent(stopId)}`);
    return readData<FavoriteStop>(response);
  },

  getArrivalNotifications: async (): Promise<NotificationSubscription[]> => {
    const response = await apiClient.get('/profile/notifications/arrival');
    return readData<NotificationSubscription[]>(response);
  },

  subscribeArrivalNotification: async (payload: FavoriteStopPayload & {
    etaThresholdMinutes?: number;
  }): Promise<NotificationSubscription> => {
    const response = await apiClient.post('/profile/notifications/arrival', payload);
    return readData<NotificationSubscription>(response);
  },

  removeArrivalNotification: async (subscriptionId: string): Promise<NotificationSubscription> => {
    const response = await apiClient.delete(`/profile/notifications/arrival/${encodeURIComponent(subscriptionId)}`);
    return readData<NotificationSubscription>(response);
  },

  getDelayNotifications: async (): Promise<NotificationSubscription[]> => {
    const response = await apiClient.get('/profile/notifications/delay');
    return readData<NotificationSubscription[]>(response);
  },

  subscribeDelayNotification: async (payload: { routeId: string; routeNumber?: string }): Promise<NotificationSubscription> => {
    const response = await apiClient.post('/profile/notifications/delay', payload);
    return readData<NotificationSubscription>(response);
  },

  removeDelayNotification: async (subscriptionId: string): Promise<NotificationSubscription> => {
    const response = await apiClient.delete(`/profile/notifications/delay/${encodeURIComponent(subscriptionId)}`);
    return readData<NotificationSubscription>(response);
  },

  getRouteChangeNotifications: async (): Promise<NotificationSubscription[]> => {
    const response = await apiClient.get('/profile/notifications/route-change');
    return readData<NotificationSubscription[]>(response);
  },

  subscribeRouteChangeNotification: async (payload: { routeId: string; routeNumber?: string }): Promise<NotificationSubscription> => {
    const response = await apiClient.post('/profile/notifications/route-change', payload);
    return readData<NotificationSubscription>(response);
  },

  removeRouteChangeNotification: async (subscriptionId: string): Promise<NotificationSubscription> => {
    const response = await apiClient.delete(`/profile/notifications/route-change/${encodeURIComponent(subscriptionId)}`);
    return readData<NotificationSubscription>(response);
  },

  getMyNotifications: async (): Promise<SystemNotification[]> => {
    const response = await apiClient.get('/notifications/me', { params: { limit: 30 } });
    return readData<SystemNotification[]>(response);
  },

  updateNotificationEnabled: async (profile: UserProfile, notificationEnabled: boolean): Promise<UserProfile> => {
    const response = await apiClient.put('/profile/update', {
      fullName: profile.fullName,
      email: profile.email,
      phoneNumber: profile.phoneNumber || profile.phone,
      gender: profile.gender || 'PREFER_NOT_TO_SAY',
      dateOfBirth: profile.dateOfBirth || null,
      address: profile.address || '',
      notificationEnabled,
    });
    return readData<UserProfile>(response);
  },
};

export default routeDiscoveryApi;
