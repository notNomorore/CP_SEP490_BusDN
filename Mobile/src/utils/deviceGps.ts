import * as Location from 'expo-location';

export type DeviceGpsPayload = {
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
  capturedAt?: string;
  retryCount?: number;
  message?: string;
};

export type GpsWatchSubscription = {
  remove: () => void;
};

const unavailableGps = (message: string, retryCount = 1): DeviceGpsPayload => ({
  latitude: null,
  longitude: null,
  accuracyMeters: null,
  capturedAt: new Date().toISOString(),
  retryCount,
  message,
});

const toGpsPayload = (location: Location.LocationObject): DeviceGpsPayload => ({
  latitude: location.coords.latitude,
  longitude: location.coords.longitude,
  accuracyMeters: location.coords.accuracy ?? null,
  capturedAt: new Date(location.timestamp || Date.now()).toISOString(),
  retryCount: 0,
});

export const requestLocationPermission = async () => {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    return {
      granted: false,
      message: 'Location services are disabled on this device.',
    };
  }

  const existingPermission = await Location.getForegroundPermissionsAsync();
  if (existingPermission.granted) {
    return { granted: true, message: '' };
  }

  const requestedPermission = await Location.requestForegroundPermissionsAsync();
  return {
    granted: requestedPermission.granted,
    message: requestedPermission.granted ? '' : 'Location permission was denied.',
  };
};

export const getDeviceGpsPayload = async (): Promise<DeviceGpsPayload> => {
  try {
    const permission = await requestLocationPermission();
    if (!permission.granted) {
      return unavailableGps(permission.message);
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return toGpsPayload(location);
  } catch (error) {
    return unavailableGps(error instanceof Error ? error.message : 'Unable to read device GPS.');
  }
};

export const watchDeviceGps = async (
  onLocation: (payload: DeviceGpsPayload) => void,
  onError?: (payload: DeviceGpsPayload) => void,
): Promise<GpsWatchSubscription | null> => {
  try {
    const permission = await requestLocationPermission();
    if (!permission.granted) {
      onError?.(unavailableGps(permission.message));
      return null;
    }

    return Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (location) => onLocation(toGpsPayload(location)),
    );
  } catch (error) {
    onError?.(unavailableGps(error instanceof Error ? error.message : 'Unable to watch device GPS.'));
    return null;
  }
};
