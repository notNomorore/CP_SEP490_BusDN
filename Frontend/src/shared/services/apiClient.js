import axios from 'axios';

const DEFAULT_API_URL = 'http://localhost:3000';
const DEFAULT_API_PATH = '/api';

const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL?.trim() || DEFAULT_API_URL;
  const apiPath = import.meta.env.VITE_API_PATH?.trim() || DEFAULT_API_PATH;
  return `${apiUrl.replace(/\/$/, '')}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`;
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
    const isPublicAuthRequest = [
      '/auth/login',
      '/auth/register',
      '/auth/verify-otp',
      '/auth/resend-otp',
      '/auth/forgot-password',
      '/auth/reset-password',
    ].some((path) => requestUrl.includes(path));

    if (error.response?.status === 401 && token && !isPublicAuthRequest) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      window.location.href = '/auth/login';
    }

    throw error.response?.data || error;
  }
);

export default apiClient;
