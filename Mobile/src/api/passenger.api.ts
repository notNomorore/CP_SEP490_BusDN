import apiClient from '@/api/client';

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data: T;
};

const unwrap = <T>(response: unknown): T => {
  const envelope = response as ApiEnvelope<T>;
  return envelope?.data ?? (response as T);
};

export type RouteSearchParams = {
  q?: string;
  from?: string;
  to?: string;
};

export type NearbyRouteParams = {
  latitude: number;
  longitude: number;
  radiusKm?: number;
};

export type PlanTripPayload = {
  from: string;
  to: string;
  preference?: 'fastest' | 'shortest' | 'lowest-cost' | 'least-traffic';
};

export type OneWayTicketPayload = {
  routeId: string;
  departureLocation: string;
  destinationLocation: string;
  passengerType: 'STANDARD' | 'STUDENT' | 'PRIORITY';
  paymentMethod: 'CREDIT_CARD' | 'E_WALLET' | 'CASHLESS';
  paymentReference?: string;
  serviceDate: string;
  departureTime: string;
};

export type MonthlyPassPayload = {
  passType: 'STANDARD' | 'STUDENT' | 'PRIORITY';
  routeId?: string;
  routeCode?: string;
  startDate: string;
  validityMonths: number;
  paymentMethod: 'CREDIT_CARD' | 'E_WALLET' | 'ONLINE_BANKING';
  paymentReference?: string;
  renew?: boolean;
};

const pickList = (data: any, keys: string[]) => {
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
};

export const passengerApi = {
  searchRoutes: async (params: RouteSearchParams = {}) => {
    const response = await apiClient.get('/routes/search', { params });
    return unwrap<any>(response);
  },

  searchNearbyRoutes: async (params: NearbyRouteParams) => {
    const response = await apiClient.get('/routes/nearby', { params });
    return unwrap<any>(response);
  },

  getRouteDetail: async (routeId: string) => {
    const searchResponse = await apiClient.get('/routes/search', { params: { q: routeId } });
    const data = unwrap<any>(searchResponse);
    const routes = data?.routes || [];
    return routes.find((route: any) => String(route.id || route._id) === String(routeId) || route.routeNumber === routeId) || routes[0] || null;
  },

  planTrip: async (payload: PlanTripPayload) => {
    const response = await apiClient.get('/routes/best', {
      params: {
        from: payload.from,
        to: payload.to,
        preference: payload.preference || 'fastest',
      },
    });
    return unwrap<any>(response);
  },

  suggestRouteOptions: async (payload: PlanTripPayload) => {
    const response = await apiClient.get('/routes/suggestions', {
      params: {
        from: payload.from,
        to: payload.to,
        preference: payload.preference || 'fastest',
      },
    });
    return unwrap<any>(response);
  },

  getLiveTracking: async (routeId: string) => {
    const response = await apiClient.get(`/routes/${encodeURIComponent(routeId)}/live`);
    return unwrap<any>(response);
  },

  getEta: async (routeId: string) => {
    const response = await apiClient.get(`/routes/${encodeURIComponent(routeId)}/eta`);
    return unwrap<any>(response);
  },

  getNotifications: async () => {
    const [arrival, delay, routeChangeAlerts] = await Promise.allSettled([
      apiClient.get('/profile/notifications/arrival'),
      apiClient.get('/profile/notifications/delay'),
      apiClient.get('/profile/notifications/route-change/alerts'),
    ]);

    const normalize = (result: PromiseSettledResult<unknown>, type: string) => {
      if (result.status !== 'fulfilled') return [];
      const data = unwrap<any>(result.value);
      const list = Array.isArray(data) ? data : data?.notifications || [];
      return list.map((item: any) => ({ ...item, type }));
    };

    return [
      ...normalize(arrival, 'Arrival'),
      ...normalize(delay, 'Delay'),
      ...normalize(routeChangeAlerts, 'Route Change'),
    ];
  },

  markRouteChangeAlertRead: async (notificationId: string) => {
    const response = await apiClient.patch(`/profile/notifications/route-change/alerts/${encodeURIComponent(notificationId)}/read`);
    return unwrap<any>(response);
  },

  getTickets: async () => {
    const response = await apiClient.get('/tickets/me');
    return pickList(unwrap<any>(response), ['tickets', 'items', 'data']);
  },

  purchaseOneWayTicket: async (payload: OneWayTicketPayload) => {
    const response = await apiClient.post('/tickets/one-way', payload);
    return unwrap<any>(response);
  },

  getMonthlyPasses: async () => {
    const response = await apiClient.get('/tickets/monthly-passes/me');
    return pickList(unwrap<any>(response), ['monthlyPasses', 'passes', 'items', 'data']);
  },

  purchaseMonthlyPass: async (payload: MonthlyPassPayload) => {
    const response = await apiClient.post('/tickets/monthly-pass', payload);
    return unwrap<any>(response);
  },

  getTravelHistory: async () => {
    const response = await apiClient.get('/profile/travel-history');
    return pickList(unwrap<any>(response), ['travelHistory', 'history', 'items', 'data']);
  },
};

export default passengerApi;
