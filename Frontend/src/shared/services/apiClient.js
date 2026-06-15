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

    const responseError = error.response?.data || error;
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
