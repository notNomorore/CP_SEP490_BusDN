import axios from 'axios';

const DEFAULT_API_BASE_URL = 'http://localhost:5000/api';

// Always prefer the current environment/default over stale browser storage.
const getApiBaseUrl = () => {
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  const baseUrl = envBaseUrl || DEFAULT_API_BASE_URL;

  localStorage.setItem('apiBaseUrl', baseUrl);
  return baseUrl;
};

// Create axios instance
const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
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

// Handle response errors
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

    // Logout if unauthorized
    if (error.response?.status === 401 && token && !isPublicAuthRequest) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      window.location.href = '/auth/login';
    }
    throw error.response?.data || error;
  }
);

/**
 * Auth Service - API calls for authentication
 */
export const authService = {
  /**
   * Register new user
   */
  register: async (data) => {
    return apiClient.post('/auth/register', {
      email: data.email || undefined,
      phone: data.phone || undefined,
      fullName: data.fullName,
      password: data.password,
      confirmPassword: data.confirmPassword,
    });
  },

  /**
   * Verify OTP
   */
  verifyOTP: async (data) => {
    return apiClient.post('/auth/verify-otp', {
      email: data.email || undefined,
      phone: data.phone || undefined,
      otp: data.otp,
    });
  },

  /**
   * Resend account verification OTP
   */
  resendOtp: async (data) => {
    return apiClient.post('/auth/resend-otp', {
      email: data.email || undefined,
      phone: data.phone || undefined,
    });
  },

  /**
   * Login user
   */
  login: async (identifier, password) => {
    const response = await apiClient.post('/auth/login', {
      identifier,
      password,
    });

    // Store token and user
    if (response.token) {
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('authUser', JSON.stringify(response.user));
    }

    return response;
  },

  /**
   * Request password reset
   */
  requestPasswordReset: async (data) => {
    return apiClient.post('/auth/forgot-password', {
      email: data.email || undefined,
      phone: data.phone || undefined,
    });
  },

  /**
   * Reset password with OTP
   */
  resetPassword: async (data) => {
    const response = await apiClient.post('/auth/reset-password', {
      token: data.token,
      otp: data.otp,
      newPassword: data.newPassword,
      confirmPassword: data.confirmPassword,
    });

    return response;
  },

  /**
   * Change password (requires auth)
   */
  changePassword: async (data) => {
    return apiClient.post('/auth/change-password', {
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
      confirmPassword: data.confirmPassword,
    });
  },

  /**
   * Get current user profile
   */
  getCurrentUser: async () => {
    return apiClient.get('/auth/me');
  },

  /**
   * Update user profile
   */
  updateProfile: async (data) => {
    const response = await apiClient.put('/auth/profile', data);

    // Update stored user
    if (response.user) {
      localStorage.setItem('authUser', JSON.stringify(response.user));
    }

    return response;
  },

  /**
   * Logout user
   */
  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      // Clear stored data regardless of API response
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
    }
  },

  /**
   * Check if user has valid token
   */
  isAuthenticated: () => {
    return !!localStorage.getItem('authToken');
  },

  /**
   * Get stored user data
   */
  getStoredUser: () => {
    const stored = localStorage.getItem('authUser');
    return stored ? JSON.parse(stored) : null;
  },

  /**
   * Get stored token
   */
  getToken: () => {
    return localStorage.getItem('authToken');
  },
};

export { apiClient };
export default authService;
