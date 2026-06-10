import apiClient from '../../../shared/services/apiClient.js';

const persistSession = (token, user) => {
  if (token) {
    localStorage.setItem('authToken', token);
  }

  if (user) {
    localStorage.setItem('authUser', JSON.stringify(user));
  }
};

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

export const authService = {
  register: async (data) =>
    apiClient.post('/auth/register', {
      email: data.email || undefined,
      phoneNumber: data.phoneNumber || data.phone || undefined,
      fullName: data.fullName,
      password: data.password,
      confirmPassword: data.confirmPassword,
    }),

  verifyOTP: async (data) =>
    apiClient.post('/auth/verify-otp', {
      email: data.email || undefined,
      phoneNumber: data.phoneNumber || data.phone || undefined,
      otp: data.otp,
    }),

  resendOtp: async (data) =>
    apiClient.post('/auth/resend-otp', {
      email: data.email || undefined,
      phoneNumber: data.phoneNumber || data.phone || undefined,
    }),

  login: async (identifier, password) => {
    const response = await apiClient.post('/auth/login', {
      identifier,
      password,
    });

    persistSession(response.token, response.user);
    return response;
  },

  requestPasswordReset: async (data) =>
    apiClient.post('/auth/forgot-password', {
      email: data.email || undefined,
      phoneNumber: data.phoneNumber || data.phone || undefined,
    }),

  resetPassword: async (data) =>
    apiClient.post('/auth/reset-password', {
      token: data.token,
      otp: data.otp,
      newPassword: data.newPassword,
      confirmPassword: data.confirmPassword,
    }),

  changePassword: async (data) => {
    const response = await apiClient.post('/auth/change-password', {
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
      confirmPassword: data.confirmPassword,
    });
    persistSession(getStoredToken(), response.user);
    return response;
  },

  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me');
    persistSession(getStoredToken(), response.user);
    return response;
  },

  updateProfile: async (data) => {
    const response = await apiClient.put('/auth/profile', data);
    persistSession(getStoredToken(), response.user);
    return response;
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      localStorage.removeItem('authToken');
      localStorage.removeItem('token');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('authUser');
    }
  },

  isAuthenticated: () => Boolean(getStoredToken()),

  getStoredUser: () => {
    const stored = localStorage.getItem('authUser');
    return stored ? JSON.parse(stored) : null;
  },

  getToken: () => getStoredToken(),

  setStoredUser: (user) => persistSession(getStoredToken(), user),
};

export { apiClient };
export default authService;
