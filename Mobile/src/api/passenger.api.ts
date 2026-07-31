import apiClient from '@/api/client';

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data: T;
  pagination?: unknown;
};

export type BusRouteStop = {
  stopId?: string;
  name: string;
  order: number;
  estimatedOffsetMinutes?: number;
  latitude?: number;
  longitude?: number;
  address?: string;
};

export type RoutePathPoint = {
  latitude?: number;
  longitude?: number;
  name?: string;
};

export type BusRoute = {
  id: string;
  _id?: string;
  routeNumber: string;
  name: string;
  origin: string;
  destination: string;
  stops: BusRouteStop[];
  distanceKm?: number;
  estimatedDurationMinutes?: number;
  fare?: number;
  operatingHours?: {
    firstDeparture?: string;
    lastDeparture?: string;
    frequencyMinutes?: number;
  };
  pathPoints?: RoutePathPoint[];
  status?: string;
};

export type LiveBus = {
  busId: string;
  routeId?: string;
  routeNumber: string;
  currentLocation?: {
    latitude?: number;
    longitude?: number;
  };
  nextStop?: string;
  estimatedArrivalTime?: string;
  status?: string;
  delay?: {
    delayDurationMinutes?: number;
    delayReason?: string;
    updatedEta?: string;
  } | null;
  stopEtas?: Array<{
    stopId?: string;
    stopName?: string;
    stopOrder?: number;
    etaMinutes?: number | null;
    estimatedArrivalTime?: string;
    status?: string;
  }>;
  lastUpdated?: string;
  tripProgress?: {
    progressPercent?: number;
    currentStop?: string;
    nextStop?: string;
    estimatedRemainingTime?: string;
  };
};

export type NearbyStopRecord = {
  stopId?: string;
  name: string;
  order?: number;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  route?: {
    id?: string;
    routeNumber?: string;
    name?: string;
    origin?: string;
    destination?: string;
    distanceKm?: number;
    estimatedDurationMinutes?: number;
    fare?: number;
  };
};

export type FavoriteRouteRecord = {
  routeId?: string;
  routeNumber?: string;
  destination?: string;
  quickAccessPath?: string;
  color?: string;
  savedAt?: string;
  favoriteStatus?: 'SAVED' | 'REMOVED' | string;
};

export type FavoriteStopRecord = {
  stopId?: string;
  routeId?: string;
  routeNumber?: string;
  stopName?: string;
  address?: string;
  nearbyArrivalText?: string;
  distanceMeters?: number;
  latitude?: number;
  longitude?: number;
  savedAt?: string;
  favoriteStatus?: 'SAVED' | 'REMOVED' | string;
};

export type SaveFavoriteStopPayload = {
  routeId?: string;
  routeNumber?: string;
  stopId?: string;
  stopName: string;
  order?: number;
  address?: string;
  nearbyArrivalText?: string;
  distanceMeters?: number;
};

export type TicketRecord = {
  _id?: string;
  id?: string;
  ticketCode?: string;
  ticketType?: string;
  routeCode?: string;
  routeNumber?: string;
  routeName?: string;
  departureLocation?: string;
  destinationLocation?: string;
  serviceDate?: string;
  departureTime?: string;
  validFrom?: string;
  validUntil?: string;
  ticketPrice?: number;
  paymentStatus?: string;
  bookingStatus?: string;
  ticketStatus?: string;
  currentStatus?: string;
  digitalTicket?: {
    qrCode?: string;
    qrCodeImage?: string;
  };
};

export type MonthlyPassRecord = {
  _id?: string;
  id?: string;
  passCode?: string;
  passType?: string;
  routeCode?: string;
  passPrice?: number;
  paymentStatus?: string;
  passStatus?: string;
  startDate?: string;
  expiryDate?: string;
};

export type NotificationRecord = {
  _id?: string;
  id?: string;
  title?: string;
  message?: string;
  body?: string;
  type?: string;
  priority?: string;
  status?: string;
  createdAt?: string;
  sentAt?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
};

export type TravelHistoryRecord = {
  id: string;
  tripId?: string;
  routeNumber?: string;
  routeName?: string;
  boardingStop?: string;
  destinationStop?: string;
  travelDate?: string;
  boardingTime?: string;
  arrivalTime?: string;
  travelDurationMinutes?: number;
  ticketType?: string;
  ticketId?: string;
  fareAmount?: number;
  paymentMethod?: string;
  travelStatus?: string;
  vehicleLabel?: string;
};

export type FeedbackStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_PASSENGER'
  | 'RESOLVED'
  | 'REJECTED'
  | 'CLOSED';

export type FeedbackCategory =
  | 'SERVICE_QUALITY'
  | 'DRIVER_BEHAVIOR'
  | 'BUS_ASSISTANT_BEHAVIOR'
  | 'BUS_CLEANLINESS'
  | 'ROUTE_DELAY'
  | 'SAFETY'
  | 'APP_ISSUE'
  | 'PAYMENT_ISSUE'
  | 'OTHER';

export type PassengerFeedbackConversation = {
  id?: string;
  senderRole?: 'PASSENGER' | 'ADMIN' | string;
  sender?: {
    fullName?: string;
    role?: string;
  } | null;
  message?: string;
  createdAt?: string;
};

export type PassengerFeedback = {
  id: string;
  referenceNumber?: string;
  type?: 'SERVICE_FEEDBACK';
  title?: string;
  description?: string;
  category?: FeedbackCategory | string;
  ratingScore?: number;
  rating?: number;
  status?: FeedbackStatus | string;
  relatedTripId?: string;
  routeName?: string;
  tripCode?: string;
  adminResponse?: string;
  resolutionSummary?: string;
  conversation?: PassengerFeedbackConversation[];
  attachments?: Array<{ filename?: string; originalName?: string; url?: string; path?: string }>;
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
};

export type SubmitFeedbackPayload = {
  category: FeedbackCategory;
  title: string;
  description: string;
  ratingScore: number;
  relatedTripId: string;
  tripCode?: string;
  routeName?: string;
};

export type PaymentOrder = {
  orderCode?: number;
  status?: string;
  amount?: number;
  ticketType?: string;
  checkoutUrl?: string;
  qrCode?: string;
  qrCodeImage?: string;
  message?: string;
};

const unwrap = <T>(response: unknown): T => (response as ApiEnvelope<T>).data;

export const passengerApi = {
  searchRoutes: async (params: { q?: string; from?: string; to?: string } = {}) => {
    const response = await apiClient.get('/routes/search', { params }) as unknown;
    return unwrap<{ routes: BusRoute[]; count: number }>(response);
  },

  getNearbyRoutes: async (params: { latitude: number; longitude: number; radiusKm?: number }) => {
    const response = await apiClient.get('/routes/nearby', { params }) as unknown;
    return unwrap<{
      userLocation: { latitude: number; longitude: number };
      radiusKm: number;
      nearbyStops: NearbyStopRecord[];
      routes: BusRoute[];
      count: number;
    }>(response);
  },

  getRouteDetail: async (routeId: string) => {
    const response = await apiClient.get('/routes/search') as unknown;
    const data = unwrap<{ routes: BusRoute[] }>(response);
    return data.routes.find((route) => (
      String(route.id) === routeId
      || String(route._id) === routeId
      || route.routeNumber === routeId
    )) || data.routes[0] || null;
  },

  getBestRoute: async (params: { from: string; to: string; preference?: string }) => {
    const response = await apiClient.get('/routes/best', { params }) as unknown;
    return unwrap<{
      bestRoute: unknown;
      alternatives: unknown[];
      count: number;
      criteria?: unknown;
    }>(response);
  },

  getLiveTracking: async (routeId: string) => {
    const response = await apiClient.get(`/routes/${encodeURIComponent(routeId)}/live`) as unknown;
    return unwrap<{
      route: BusRoute;
      buses: LiveBus[];
      stopEtaSummary?: Array<{
        stopName: string;
        estimatedArrivalTime?: string;
        status?: string;
      }>;
      routeChange?: unknown;
      refreshedAt?: string;
    }>(response);
  },

  getFavoriteRoutes: async () => {
    const response = await apiClient.get('/profile/favorites/routes') as unknown;
    return unwrap<FavoriteRouteRecord[]>(response);
  },

  saveFavoriteRoute: async (routeId: string) => {
    const response = await apiClient.post(`/profile/favorites/routes/${encodeURIComponent(routeId)}`) as unknown;
    return unwrap<FavoriteRouteRecord>(response);
  },

  removeFavoriteRoute: async (routeId: string) => {
    const response = await apiClient.delete(`/profile/favorites/routes/${encodeURIComponent(routeId)}`) as unknown;
    return unwrap<FavoriteRouteRecord>(response);
  },

  getFavoriteStops: async () => {
    const response = await apiClient.get('/profile/favorites/stops') as unknown;
    return unwrap<FavoriteStopRecord[]>(response);
  },

  saveFavoriteStop: async (payload: SaveFavoriteStopPayload) => {
    const response = await apiClient.post('/profile/favorites/stops', payload) as unknown;
    return unwrap<FavoriteStopRecord>(response);
  },

  removeFavoriteStop: async (stopId: string) => {
    const response = await apiClient.delete(`/profile/favorites/stops/${encodeURIComponent(stopId)}`) as unknown;
    return unwrap<FavoriteStopRecord>(response);
  },

  getTickets: async () => {
    const response = await apiClient.get('/tickets/me') as unknown;
    return unwrap<{ tickets: TicketRecord[]; count: number }>(response);
  },

  getMonthlyPasses: async () => {
    const response = await apiClient.get('/tickets/monthly-passes/me') as unknown;
    return unwrap<{ passes: MonthlyPassRecord[]; count: number }>(response);
  },

  createPayment: async (payload: Record<string, unknown>) => {
    const response = await apiClient.post('/tickets/payments', payload) as unknown;
    return unwrap<PaymentOrder>(response);
  },

  getNotifications: async () => {
    const response = await apiClient.get('/notifications/me', { params: { limit: 50 } }) as unknown;
    const data = unwrap<NotificationRecord[] | { items: NotificationRecord[] }>(response);
    return Array.isArray(data) ? data : data.items || [];
  },

  getTravelHistory: async () => {
    const response = await apiClient.get('/profile/travel-history') as unknown;
    return unwrap<{
      records: TravelHistoryRecord[];
      count: number;
      summary?: {
        totalTrips?: number;
        totalFare?: number;
        totalDurationMinutes?: number;
      };
    }>(response);
  },

  submitFeedback: async (payload: SubmitFeedbackPayload) => {
    const response = await apiClient.post('/customer-support/cases', {
      type: 'SERVICE_FEEDBACK',
      ...payload,
    }) as unknown;
    return unwrap<PassengerFeedback>(response);
  },

  getMyFeedback: async (params: { status?: string; search?: string; page?: number; limit?: number } = {}) => {
    const response = await apiClient.get('/customer-support/feedback/me', { params }) as unknown;
    const envelope = response as ApiEnvelope<PassengerFeedback[]> & {
      meta?: { page?: number; limit?: number; total?: number; totalPages?: number };
    };
    return {
      items: envelope.data || [],
      meta: envelope.meta || { page: params.page || 1, limit: params.limit || 10, total: 0, totalPages: 1 },
    };
  },

  getFeedbackDetail: async (feedbackId: string) => {
    const response = await apiClient.get(`/customer-support/feedback/${encodeURIComponent(feedbackId)}`) as unknown;
    return unwrap<PassengerFeedback>(response);
  },

  replyToFeedback: async (feedbackId: string, payload: { message: string }) => {
    const response = await apiClient.post(`/customer-support/feedback/${encodeURIComponent(feedbackId)}/replies`, payload) as unknown;
    return unwrap<PassengerFeedback>(response);
  },
};

export default passengerApi;
