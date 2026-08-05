const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const requiredEnv = (key: 'EXPO_PUBLIC_API_URL' | 'EXPO_PUBLIC_SOCKET_URL') => {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`${key} is required for BusDN mobile API configuration.`);
  }

  return trimTrailingSlash(value);
};

export const config = {
  apiBaseUrl: requiredEnv('EXPO_PUBLIC_API_URL'),
  configuredApiBaseUrl: requiredEnv('EXPO_PUBLIC_API_URL'),
  socketUrl: requiredEnv('EXPO_PUBLIC_SOCKET_URL'),
};
