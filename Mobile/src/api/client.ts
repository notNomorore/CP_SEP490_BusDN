import axios from 'axios';
import { router } from 'expo-router';

import authStorage from '@/api/authStorage';
import { config } from '@/constants/config';

export const AUTH_TOKEN_KEY = 'authToken';
export const AUTH_USER_KEY = 'authUser';

export const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (requestConfig) => {
  const token = await authStorage.getItem(AUTH_TOKEN_KEY);

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
      await authStorage.deleteItem(AUTH_TOKEN_KEY);
      await authStorage.deleteItem(AUTH_USER_KEY);
      router.replace('/auth/login');
    }

    if (!error.response) {
      const method = error.config?.method?.toUpperCase?.() || 'REQUEST';
      const path = error.config?.url || '';
      const baseUrl = error.config?.baseURL || config.apiBaseUrl || 'not configured';
      throw {
        ...error,
        message: `${method} ${baseUrl}${path} thất bại. Máy chủ BusDN không khả dụng hoặc thiết bị không có kết nối mạng.`,
      };
    }

    throw error.response.data || error;
  }
);

export default apiClient;
