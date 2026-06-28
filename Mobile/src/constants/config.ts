const RENDER_API_BASE_URL = 'https://cp-sep490-busdn.onrender.com/api';
const RENDER_SOCKET_URL = 'https://cp-sep490-busdn.onrender.com';
const API_PATH = '/api';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const normalizeApiBaseUrl = (value?: string) => {
  const normalized = value?.trim();
  if (!normalized) return '';

  const withoutTrailingSlash = trimTrailingSlash(normalized);
  return withoutTrailingSlash.endsWith(API_PATH)
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}${API_PATH}`;
};

const envApiBaseUrl = normalizeApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_BASE_URL
);
const envSocketUrl = trimTrailingSlash(process.env.EXPO_PUBLIC_SOCKET_URL?.trim() || RENDER_SOCKET_URL);

export const config = {
  apiBaseUrl: envApiBaseUrl || RENDER_API_BASE_URL,
  configuredApiBaseUrl: envApiBaseUrl,
  socketUrl: envSocketUrl,
};
