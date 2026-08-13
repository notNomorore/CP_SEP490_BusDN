import axios from 'axios';

import authStorage from '@/api/authStorage';
import { config } from '@/constants/config';

export const AUTH_TOKEN_KEY = 'authToken';
export const AUTH_USER_KEY = 'authUser';

let currentAuthToken: string | null = null;

export const setApiAuthToken = (token: string | null) => {
  currentAuthToken = token;
};

export const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

const isFormDataPayload = (value: unknown): value is FormData => (
  typeof FormData !== 'undefined' && value instanceof FormData
);

const removeContentTypeHeader = (headers?: Record<string, unknown> & {
  delete?: (header: string) => void;
}) => {
  if (!headers) return;
  headers.delete?.('Content-Type');
  headers.delete?.('content-type');
  delete headers['Content-Type'];
  delete headers['content-type'];
};

apiClient.interceptors.request.use(async (requestConfig) => {
  if (isFormDataPayload(requestConfig.data)) {
    removeContentTypeHeader(requestConfig.headers);
  }

  const token = currentAuthToken || await authStorage.getItem(AUTH_TOKEN_KEY);

  if (token) {
    requestConfig.headers.Authorization = `Bearer ${token}`;
  }

  return requestConfig;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const requestUrl = error.config?.url || '';
    const isPublicAuthRequest = [
      '/auth/login',
      '/auth/register',
      '/auth/verify-otp',
      '/auth/resend-otp',
      '/auth/forgot-password',
      '/auth/reset-password',
    ].some((path) => requestUrl.includes(path));

    if (error.response?.status === 401 && !isPublicAuthRequest) {
      setApiAuthToken(null);
      await authStorage.deleteItem(AUTH_TOKEN_KEY);
      await authStorage.deleteItem(AUTH_USER_KEY);
    }

    if (!error.response) {
      const method = error.config?.method?.toUpperCase?.() || 'REQUEST';
      const path = error.config?.url || '';
      const baseUrl = error.config?.baseURL || config.apiBaseUrl || 'not configured';
      throw {
        ...error,
        message: `${method} ${baseUrl}${path} failed. The BusDN server is unavailable or the device has no network connection.`,
      };
    }

    throw error.response.data || error;
  }
);

export default apiClient;
