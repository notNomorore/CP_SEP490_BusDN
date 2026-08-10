const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const requiredEnv = (key: 'EXPO_PUBLIC_API_URL' | 'EXPO_PUBLIC_SOCKET_URL') => {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`${key} is required for BusDN mobile API configuration.`);
  }

  return trimTrailingSlash(value);
};

const apiBaseUrl = requiredEnv('EXPO_PUBLIC_API_URL');
const apiOrigin = apiBaseUrl.replace(/\/api\/?$/i, '');

export const resolveBackendUrl = (value?: string | null) => {
  if (!value) return '';
  if (/^(https?:|file:|blob:|data:)/i.test(value)) return value;

  return `${apiOrigin}${value.startsWith('/') ? value : `/${value}`}`;
};

export const config = {
  apiBaseUrl,
  apiOrigin,
  configuredApiBaseUrl: apiBaseUrl,
  socketUrl: requiredEnv('EXPO_PUBLIC_SOCKET_URL'),
};
