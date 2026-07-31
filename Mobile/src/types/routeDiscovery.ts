export type RouteStop = {
  stopId?: string;
  name: string;
  stopName?: string;
  order: number;
  stopOrder?: number;
  estimatedOffsetMinutes?: number;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
};

export type BusRoute = {
  _id?: string;
  id: string;
  routeNumber: string;
  name: string;
  origin: string;
  destination: string;
  stops?: RouteStop[];
  distanceKm?: number;
  estimatedDurationMinutes?: number;
  fare?: number;
  operatingHours?: {
    firstDeparture?: string;
    lastDeparture?: string;
    frequencyMinutes?: number;
  };
  pathPoints?: Array<{ latitude: number; longitude: number }>;
  status?: string;
  source?: string;
};

export type NearbyStop = RouteStop & {
  route: BusRoute;
};

export type RouteSearchResponse = {
  routes: BusRoute[];
  count: number;
};

export type NearbyRoutesResponse = {
  userLocation: { latitude: number; longitude: number };
  radiusKm: number;
  nearbyStops: NearbyStop[];
  routes: BusRoute[];
  count: number;
};

export type RouteSuggestion = {
  route: BusRoute;
  startStop?: RouteStop;
  endStop?: RouteStop;
  estimatedDurationMinutes?: number;
  estimatedDistanceKm?: number;
  estimatedFare?: number;
  score?: number;
  isRecommended?: boolean;
};

export type SuggestRouteResponse = {
  suggestions: RouteSuggestion[];
  count: number;
  totalMatches?: number;
  bestRoute?: RouteSuggestion | null;
  alternatives?: RouteSuggestion[];
};

export type FavoriteRoute = {
  routeId: string;
  routeNumber: string;
  destination?: string;
  favoriteStatus?: string;
  savedAt?: string;
};

export type FavoriteStop = {
  stopId: string;
  routeId?: string;
  routeNumber?: string;
  stopName: string;
  address?: string;
  nearbyArrivalText?: string;
  distanceMeters?: number;
  latitude?: number;
  longitude?: number;
  favoriteStatus?: string;
};

export type StopEta = {
  stopId: string;
  stopName: string;
  stopOrder?: number;
  nextBusId?: string | null;
  busId?: string;
  etaMinutes?: number | null;
  estimatedArrivalTime?: string;
  status?: string;
};

export type TripProgress = {
  tripId: string;
  busId: string;
  progressPercent?: number;
  completedStops?: Array<{ stopId: string; stopName: string; stopOrder?: number }>;
  remainingStops?: Array<{ stopId: string; stopName: string; stopOrder?: number }>;
  tripStatus?: string;
  estimatedRemainingTime?: string;
  currentStop?: string;
  nextStop?: string;
};

export type LiveBus = {
  busId: string;
  routeId: string;
  routeNumber?: string;
  currentLocation?: { latitude: number; longitude: number };
  estimatedArrivalTime?: string;
  nextStop?: string;
  stopEtas?: StopEta[];
  tripProgress?: TripProgress;
  status?: string;
  delay?: {
    delayDurationMinutes?: number;
    delayReason?: string;
    updatedEta?: string;
  } | null;
  lastUpdated?: string;
};

export type RouteChangeNotice = {
  changeId?: string;
  routeId?: string;
  routeNumber?: string;
  reasonForChange?: string;
  updatedRoutePath?: string;
  alternativeSuggestion?: string;
  status?: string;
  detectedAt?: string;
  changedStops?: Array<{ stopName: string; changeType?: string }>;
};

export type LiveBusResponse = {
  route: BusRoute;
  buses: LiveBus[];
  stopEtaSummary?: StopEta[];
  routeChange?: RouteChangeNotice | null;
  count?: number;
  refreshedAt?: string;
  message?: string;
};

export type NotificationSubscription = {
  subscriptionId: string;
  routeId?: string;
  routeNumber?: string;
  stopId?: string;
  stopName?: string;
  notificationStatus?: string;
};

export type SystemNotification = {
  _id?: string;
  id?: string;
  title: string;
  message: string;
  type?: string;
  priority?: string;
  routeId?: string | null;
  tripId?: string | null;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  sentAt?: string;
  deliverySummary?: { sentAt?: string };
};
