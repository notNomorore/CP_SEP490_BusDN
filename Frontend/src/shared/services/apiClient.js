import axios from 'axios';

const DEFAULT_API_URL = 'http://localhost:5000';
const DEFAULT_API_PATH = '/api';
const DEFAULT_API_BASE_URL = `${DEFAULT_API_URL}${DEFAULT_API_PATH}`;

const getBaseUrl = () => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (apiBaseUrl) {
    return apiBaseUrl.replace(/\/$/, '');
  }

  const apiUrl = import.meta.env.VITE_API_URL?.trim() || DEFAULT_API_URL;
  const apiPath = import.meta.env.VITE_API_PATH?.trim() || DEFAULT_API_PATH;
  const baseUrl = `${apiUrl.replace(/\/$/, '')}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`;
  return baseUrl || DEFAULT_API_BASE_URL;
};

const apiClient = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
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
    const token = localStorage.getItem('authToken');
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

    throw responseData || error;
  }
);

export default apiClient;
