import axios from 'axios';

const DEFAULT_API_BASE_URL = 'http://localhost:3000/api';

const getApiBaseUrl = () => (
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL
);

const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    throw error.response?.data || error;
  }
);

export const routeService = {
  searchRoutes: async ({ q = '', from = '', to = '' } = {}) => {
    const response = await apiClient.get('/routes/search', {
      params: { q, from, to },
    });

    return response.data;
  },

  searchNearbyRoutes: async ({ latitude, longitude, radiusKm = 5 }) => {
    const response = await apiClient.get('/routes/nearby', {
      params: { latitude, longitude, radiusKm },
    });

    return response.data;
  },

  findBestRoute: async ({ from, to }) => {
    const response = await apiClient.get('/routes/best', {
      params: { from, to },
    });

    return response.data;
  },
};

export default routeService;
