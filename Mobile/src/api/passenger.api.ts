import apiClient from '@/api/client';

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data: T;
  pagination?: PaginationMeta;
};

export type PaginationMeta = {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
};

export type BusRouteStop = {
  stopId?: string;
  id?: string;
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
  directions?: {
    OUTBOUND?: { stops?: BusRouteStop[] };
    INBOUND?: { stops?: BusRouteStop[] };
  };
  pathPoints?: RoutePathPoint[];
  status?: string;
};

export type LiveBus = {
  busId: string;
  vehicleId?: string;
  plateNumber?: string;
  tripId?: string;
  tripCode?: string;
  routeId?: string;
  routeNumber: string;
  currentLocation?: {
    latitude?: number;
    longitude?: number;
    heading?: number;
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
    tripId?: string;
    tripCode?: string;
    busId?: string;
    routeId?: string;
    progressPercent?: number;
    completedStops?: Array<{ stopId?: string; stopName?: string; stopOrder?: number }>;
    remainingStops?: Array<{ stopId?: string; stopName?: string; stopOrder?: number }>;
    tripStatus?: string;
    currentStop?: string;
    currentStopIndex?: number;
    nextStop?: string;
    totalStops?: number;
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

export type StopEtaSummaryRecord = {
  stopId?: string;
  stopName: string;
  stopOrder?: number;
  nextBusId?: string | null;
  etaMinutes?: number | null;
  estimatedArrivalTime?: string;
  status?: string;
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
  status?: string;
  passengerType?: string;
  paymentMethod?: string;
  purchasedAt?: string;
  digitalTicket?: {
    qrCode?: string;
    qrCodeImage?: string;
  };
};

export type TicketDetailRecord = TicketRecord & {
  status?: string;
  canCancel?: boolean;
  qrCode?: {
    payload?: string;
    data?: string;
    image?: string;
    validFrom?: string;
    validUntil?: string;
    expiresAt?: string;
  };
  passengerInfo?: { fullName?: string; email?: string; phoneNumber?: string };
  tripInfo?: {
    routeName?: string;
    boardingPoint?: string;
    destinationPoint?: string;
    estimatedArrivalTime?: string;
    estimatedDurationMinutes?: number;
    progressPercent?: number;
    stops?: Array<{ stopId?: string; name?: string; order?: number; isBoardingPoint?: boolean; isDestination?: boolean }>;
  };
  importantNotes?: string[];
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
  paymentMethod?: string;
  dailyRideLimit?: number;
  ridesUsedToday?: number;
  nextScanAllowedAt?: string;
  validationLogs?: Array<{
    validatedAt?: string;
    result?: string;
    routeCode?: string;
  }>;
  digitalPass?: { qrPayload?: string; qrCodeImage?: string };
};

export type PurchasableTripSchedule = {
  id?: string;
  scheduleId?: string;
  scheduleCode?: string;
  routeId?: string;
  routeCode?: string;
  routeName?: string;
  direction?: 'OUTBOUND' | 'INBOUND' | string;
  serviceDate?: string;
  departureTime: string;
  expectedArrivalTime?: string;
  status?: string;
  statusLabel?: string;
  vehicle?: {
    busId?: string;
    busCode?: string;
    plateNumber?: string;
  } | null;
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
  readAt?: string | null;
  isRead?: boolean;
  actionUrl?: string;
  sourceType?: string;
  sourceId?: string | null;
  routeId?: string | null;
  tripId?: string | null;
  deliverySummary?: { sentAt?: string };
  metadata?: Record<string, unknown>;
};

export type NotificationListResult = {
  items: NotificationRecord[];
  pagination: PaginationMeta;
};

export type NotificationSubscriptionRecord = {
  subscriptionId: string;
  routeId?: string;
  routeNumber?: string;
  stopId?: string;
  stopName?: string;
  notificationStatus?: string;
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

export type LostItemCategory =
  | 'PERSONAL_BELONGINGS'
  | 'ELECTRONICS'
  | 'WALLET_DOCUMENTS'
  | 'CLOTHING'
  | 'BAGS_LUGGAGE'
  | 'OTHER_ITEMS';

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

export type LostItemAttachmentAsset = {
  uri: string;
  name?: string;
  fileName?: string;
  type?: string;
  mimeType?: string;
};

const lostItemImageMimeByExtension: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

const lostItemImageExtensionByMime: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const getFileExtension = (value?: string) => {
  const match = value?.split('?')[0]?.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() || '';
};

const inferLostItemImageMimeType = (asset: LostItemAttachmentAsset) => {
  const explicitMimeType = asset.mimeType || (asset.type?.startsWith('image/') ? asset.type : '');
  if (explicitMimeType) return explicitMimeType;

  const extension = getFileExtension(asset.fileName || asset.name || asset.uri);
  return lostItemImageMimeByExtension[extension] || 'image/jpeg';
};

const buildLostItemImageFileName = (asset: LostItemAttachmentAsset, index: number) => {
  const mimeType = inferLostItemImageMimeType(asset);
  const baseName = asset.fileName || asset.name || `lost-item-${index + 1}`;

  if (getFileExtension(baseName)) return baseName;

  return `${baseName}.${lostItemImageExtensionByMime[mimeType] || 'jpg'}`;
};

export type LostItemTimelineRecord = {
  label?: string;
  status?: string;
  message?: string;
  timestamp?: string;
};

export type LostItemAdminNote = {
  message?: string;
  createdAt?: string;
  responder?: {
    fullName?: string;
    email?: string;
    role?: string;
  };
};

export type LostItemCase = {
  id: string;
  _id?: string;
  caseId?: string;
  referenceNumber?: string;
  title?: string;
  description?: string;
  status?: string;
  currentCaseStatus?: string;
  relatedTripId?: string;
  routeName?: string;
  tripCode?: string;
  contactPhone?: string;
  contactEmail?: string;
  attachments?: Array<{ originalName?: string; fileName?: string; filename?: string; path?: string; url?: string; mimeType?: string; size?: number }>;
  lostItem?: {
    itemName?: string;
    itemCategory?: LostItemCategory | string;
    itemDescription?: string;
    lastSeenLocation?: string;
    lostAt?: string;
    recoveryStatus?: string;
    foundAt?: string;
    returnedAt?: string;
  };
  timeline?: LostItemTimelineRecord[];
  administratorNotes?: LostItemAdminNote[];
  collectionInstructions?: string;
  createdAt?: string;
  updatedAt?: string;
  lastUpdatedAt?: string;
};

export type SubmitLostItemPayload = {
  itemName: string;
  itemCategory: LostItemCategory;
  itemDescription: string;
  lastSeenLocation: string;
  lostAt: string;
  contactPhone?: string;
  contactEmail?: string;
  relatedTripId?: string;
  tripCode?: string;
  routeName?: string;
  attachments?: LostItemAttachmentAsset[];
};

export type PaymentOrder = {
  orderCode?: number;
  status?: string;
  amount?: number;
  ticketType?: string;
  ticketId?: string;
  monthlyPassId?: string;
  checkoutUrl?: string;
  qrCode?: string;
  qrCodeImage?: string;
  paymentLinkId?: string;
  rawStatus?: string;
  message?: string;
  originalPrice?: number;
  priorityDiscountAmount?: number;
  promotionDiscountAmount?: number;
  discountAmount?: number;
  finalPrice?: number;
  pricing?: TicketPriceQuote;
};

export type PromotionPreview = {
  promotionId?: string;
  promotionCode?: string;
  promotionName?: string;
  discountType?: string;
  discountValue?: number;
  originalAmount?: number;
  discountAmount?: number;
  finalAmount?: number;
};

export type TicketPriceQuote = PromotionPreview & {
  originalPrice?: number;
  priorityDiscountAmount?: number;
  promotionDiscountAmount?: number;
  finalPrice?: number;
  appliedDiscount?: {
    type?: string;
    priorityType?: string;
    label?: string;
    discountPercent?: number;
    discountAmount?: number;
  } | null;
  appliedPromotion?: PromotionPreview;
  dailyRideLimit?: number;
  startDate?: string;
  expiryDate?: string;
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
      stopEtaSummary?: StopEtaSummaryRecord[];
      routeChange?: unknown;
      refreshedAt?: string;
    }>(response);
  },

  getEstimatedArrivalTimes: async (routeId: string) => {
    const response = await apiClient.get(`/routes/${encodeURIComponent(routeId)}/eta`) as unknown;
    return unwrap<{
      route: BusRoute;
      buses: LiveBus[];
      stopEtaSummary: StopEtaSummaryRecord[];
      tripProgress?: unknown[];
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

  getTicket: async (ticketId: string) => {
    const response = await apiClient.get(`/tickets/${encodeURIComponent(ticketId)}`) as unknown;
    return unwrap<TicketDetailRecord>(response);
  },

  createPendingTicketPayment: async (ticketId: string) => {
    const response = await apiClient.post(`/tickets/${encodeURIComponent(ticketId)}/payment`) as unknown;
    return unwrap<{ status?: string; checkoutUrl?: string; message?: string }>(response);
  },

  cancelTicket: async (ticketId: string) => {
    const response = await apiClient.patch(`/tickets/${encodeURIComponent(ticketId)}/cancel`) as unknown;
    return unwrap<TicketRecord>(response);
  },

  getMonthlyPasses: async () => {
    const response = await apiClient.get('/tickets/monthly-passes/me') as unknown;
    return unwrap<{ passes: MonthlyPassRecord[]; count: number }>(response);
  },

  createPendingMonthlyPassPayment: async (passId: string) => {
    const response = await apiClient.post(`/tickets/monthly-passes/${encodeURIComponent(passId)}/payment`) as unknown;
    return unwrap<PaymentOrder>(response);
  },

  cancelMonthlyPass: async (passId: string) => {
    const response = await apiClient.patch(`/tickets/monthly-passes/${encodeURIComponent(passId)}/cancel`) as unknown;
    return unwrap<MonthlyPassRecord>(response);
  },

  getPurchasableSchedules: async (params: { routeId: string; direction: string; serviceDate: string }) => {
    const response = await apiClient.get('/tickets/purchasable-schedules', { params }) as unknown;
    return unwrap<{
      schedules: PurchasableTripSchedule[];
      count: number;
      serverTime?: string;
      serverClock?: string;
      serverDate?: string;
    }>(response);
  },

  quoteTicket: async (payload: Record<string, unknown>) => {
    const response = await apiClient.post('/tickets/quote', payload) as unknown;
    return unwrap<TicketPriceQuote>(response);
  },

  createPayment: async (payload: Record<string, unknown>) => {
    const response = await apiClient.post('/tickets/payments', payload) as unknown;
    return unwrap<PaymentOrder>(response);
  },

  applyPromotion: async (payload: {
    promotionCode: string;
    ticketType: 'ONE_WAY' | 'MONTHLY_PASS';
    routeId?: string;
    amount: number;
  }) => {
    const response = await apiClient.post('/tickets/promotions/apply', payload) as unknown;
    return unwrap<PromotionPreview>(response);
  },

  getPaymentStatus: async (orderCode: number | string) => {
    const response = await apiClient.get(`/tickets/payments/${encodeURIComponent(String(orderCode))}`) as unknown;
    return unwrap<PaymentOrder>(response);
  },

  getNotificationPage: async (params: { page?: number; limit?: number; type?: string } = {}): Promise<NotificationListResult> => {
    const response = await apiClient.get('/notifications/me', {
      params: {
        limit: 20,
        ...params,
      },
    }) as unknown;
    const envelope = response as ApiEnvelope<NotificationRecord[] | { items: NotificationRecord[] }>;
    const data = envelope.data;
    return {
      items: Array.isArray(data) ? data : data.items || [],
      pagination: envelope.pagination || { page: params.page || 1, limit: params.limit || 20, total: 0, totalPages: 1 },
    };
  },

  getNotifications: async () => {
    const result = await passengerApi.getNotificationPage({ limit: 50 });
    return result.items;
  },

  getNotificationUnreadCount: async () => {
    const response = await apiClient.get('/notifications/me/unread-count') as unknown;
    return unwrap<{ unreadCount: number }>(response);
  },

  markNotificationRead: async (notificationId: string) => {
    const response = await apiClient.patch(`/notifications/me/${encodeURIComponent(notificationId)}/read`) as unknown;
    return unwrap<NotificationRecord>(response);
  },

  markAllNotificationsRead: async () => {
    const response = await apiClient.patch('/notifications/me/read-all') as unknown;
    return unwrap<{ updatedCount: number }>(response);
  },

  getArrivalNotificationSubscriptions: async () => {
    const response = await apiClient.get('/profile/notifications/arrival') as unknown;
    return unwrap<NotificationSubscriptionRecord[]>(response);
  },

  getDelayNotificationSubscriptions: async () => {
    const response = await apiClient.get('/profile/notifications/delay') as unknown;
    return unwrap<NotificationSubscriptionRecord[]>(response);
  },

  getRouteChangeNotificationSubscriptions: async () => {
    const response = await apiClient.get('/profile/notifications/route-change') as unknown;
    return unwrap<NotificationSubscriptionRecord[]>(response);
  },

  removeArrivalNotificationSubscription: async (subscriptionId: string) => {
    const response = await apiClient.delete(`/profile/notifications/arrival/${encodeURIComponent(subscriptionId)}`) as unknown;
    return unwrap<NotificationSubscriptionRecord>(response);
  },

  removeDelayNotificationSubscription: async (subscriptionId: string) => {
    const response = await apiClient.delete(`/profile/notifications/delay/${encodeURIComponent(subscriptionId)}`) as unknown;
    return unwrap<NotificationSubscriptionRecord>(response);
  },

  removeRouteChangeNotificationSubscription: async (subscriptionId: string) => {
    const response = await apiClient.delete(`/profile/notifications/route-change/${encodeURIComponent(subscriptionId)}`) as unknown;
    return unwrap<NotificationSubscriptionRecord>(response);
  },

  updateNotificationEnabled: async (profile: {
    fullName: string;
    email?: string;
    phone?: string;
    phoneNumber?: string;
    gender?: string;
    dateOfBirth?: string | null;
    address?: string;
  }, notificationEnabled: boolean) => {
    const response = await apiClient.put('/profile/update', {
      fullName: profile.fullName,
      email: profile.email,
      phoneNumber: profile.phoneNumber || profile.phone,
      gender: profile.gender || 'PREFER_NOT_TO_SAY',
      dateOfBirth: profile.dateOfBirth || null,
      address: profile.address || '',
      notificationEnabled,
    }) as unknown;
    return unwrap<unknown>(response);
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

  submitLostItem: async (payload: SubmitLostItemPayload) => {
    const formData = new FormData();
    formData.append('type', 'LOST_ITEM');
    formData.append('title', `Đồ thất lạc: ${payload.itemName.trim()}`);
    formData.append('description', payload.itemDescription.trim());
    formData.append('category', 'LOST_ITEM');
    formData.append('priority', 'NORMAL');
    formData.append('incidentAt', payload.lostAt);
    formData.append('lostItem', JSON.stringify({
      itemName: payload.itemName.trim(),
      itemCategory: payload.itemCategory,
      itemDescription: payload.itemDescription.trim(),
      lastSeenLocation: payload.lastSeenLocation.trim(),
      lostAt: payload.lostAt,
    }));

    if (payload.relatedTripId) formData.append('relatedTripId', payload.relatedTripId);
    if (payload.tripCode) formData.append('tripCode', payload.tripCode);
    if (payload.routeName) formData.append('routeName', payload.routeName);
    if (payload.contactPhone) formData.append('contactPhone', payload.contactPhone.trim());
    if (payload.contactEmail) formData.append('contactEmail', payload.contactEmail.trim());
    (payload.attachments || []).forEach((asset, index) => {
      const mimeType = inferLostItemImageMimeType(asset);

      formData.append('attachments', {
        uri: asset.uri,
        name: buildLostItemImageFileName(asset, index),
        type: mimeType,
      } as unknown as Blob);
    });

    const response = await apiClient.post('/customer-support/cases', formData) as unknown;
    return unwrap<LostItemCase>(response);
  },

  getMyLostItems: async () => {
    const response = await apiClient.get('/customer-support/lost-items/me') as unknown;
    const envelope = response as ApiEnvelope<LostItemCase[]> & { meta?: { total?: number } };
    return {
      items: envelope.data || [],
      meta: envelope.meta || { total: envelope.data?.length || 0 },
    };
  },

  getLostItemDetail: async (caseId: string) => {
    const response = await apiClient.get(`/customer-support/lost-items/${encodeURIComponent(caseId)}`) as unknown;
    return unwrap<LostItemCase>(response);
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
