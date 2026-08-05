const API_PATH = '/api';

const trimTrailingSlash = (value) => String(value || '').trim().replace(/\/+$/, '');

const requiredEnv = (key, value) => {
  const normalized = trimTrailingSlash(value);

  if (!normalized) {
    throw new Error(`${key} is required for BusDN frontend API configuration.`);
  }

  return normalized;
};

const withApiPath = (value) => {
  const normalized = value;
  return /\/api$/i.test(normalized) ? normalized : `${normalized}${API_PATH}`;
};

export const API_BASE_URL = withApiPath(
  requiredEnv('VITE_API_URL', import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL)
);

export const API_ORIGIN = API_BASE_URL.replace(/\/api$/i, '');

export const SOCKET_URL = requiredEnv('VITE_SOCKET_URL', import.meta.env.VITE_SOCKET_URL);

export const resolveBackendUrl = (path) => {
  if (!path) return '';
  if (/^(https?:|blob:|data:)/i.test(path)) return path;

  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
};
