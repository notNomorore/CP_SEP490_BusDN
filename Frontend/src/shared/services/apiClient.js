import axios from 'axios';

import { API_BASE_URL } from '../config/apiConfig.js';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const pendingGetRequests = new Map();

const stableParams = (params = {}) => Object.keys(params)
  .sort()
  .reduce((result, key) => {
    result[key] = params[key];
    return result;
  }, {});

const getRequestKey = (url, config = {}) => JSON.stringify({
  url,
  params: stableParams(config.params),
  responseType: config.responseType || 'json',
});
const getStoredToken = () => {
  const directToken = localStorage.getItem('authToken')
    || localStorage.getItem('token')
    || localStorage.getItem('accessToken');

  if (directToken) {
    return directToken;
  }

  try {
    const storedUser = JSON.parse(localStorage.getItem('authUser') || '{}');
    return storedUser.token || storedUser.accessToken || '';
  } catch {
    return '';
  }
};

const firstMessageFromDetails = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(firstMessageFromDetails).find(Boolean) || '';
  }
  if (typeof value === 'object') {
    return value.message || Object.values(value).map(firstMessageFromDetails).find(Boolean) || '';
  }
  return '';
};

apiClient.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const token = getStoredToken();
    const requestUrl = error.config?.url || '';
    const responseData = error.response?.data;
    const isPublicAuthRequest = [
      '/auth/login',
      '/auth/register',
      '/auth/verify-otp',
      '/auth/resend-otp',
      '/auth/forgot-password',
      '/auth/reset-password',
    ].some((path) => requestUrl.includes(path));

    const isLockedAccount = responseData?.code === 'ACCOUNT_LOCKED' || error.response?.status === 423;

    if (isLockedAccount && token && !isPublicAuthRequest) {
      sessionStorage.setItem(
        'authLockMessage',
        responseData?.message || 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.'
      );
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      window.location.href = '/auth/login';
    }

    if (error.response?.status === 401 && token && !isPublicAuthRequest) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      window.location.href = '/auth/login';
    }

    const responseError = error.response?.data || error;
    if (responseError && typeof responseError === 'object') {
      const detailedMessage = firstMessageFromDetails(responseError.details || responseError.errors);
      const genericMessages = new Set([
        'Validation failed',
        'Validation error',
        'Database validation error',
        'Trip schedule validation failed',
      ]);
      if (detailedMessage && (!responseError.message || genericMessages.has(responseError.message))) {
        responseError.message = detailedMessage;
      }
      responseError.status = error.response?.status || responseError.status;
      responseError.statusCode = error.response?.status || responseError.statusCode;
    }
    if (error.response?.status === 429) {
      responseError.isRateLimited = true;
      responseError.retryAfter = error.response.headers?.['retry-after'] || responseError.retryAfter;
    }

    throw responseError;
  }
);

const axiosGet = apiClient.get.bind(apiClient);
apiClient.get = (url, config = {}) => {
  const key = getRequestKey(url, config);
  const pending = pendingGetRequests.get(key);
  if (pending) {
    return pending;
  }

  const request = axiosGet(url, config).finally(() => {
    if (pendingGetRequests.get(key) === request) {
      pendingGetRequests.delete(key);
    }
  });
  pendingGetRequests.set(key, request);
  return request;
};

export default apiClient;
