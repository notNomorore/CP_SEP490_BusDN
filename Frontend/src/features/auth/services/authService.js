import apiClient from '../../../shared/services/apiClient.js';

const persistSession = (token, user) => {
  if (token) {
    localStorage.setItem('authToken', token);
  }

  if (user) {
    localStorage.setItem('authUser', JSON.stringify(user));
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
    let response;
    try {
      response = await apiClient.post('/auth/login', {
        identifier,
        password,
      });
    } catch (error) {
      const isLocked = error?.code === 'ACCOUNT_LOCKED' || error?.statusCode === 423 || error?.response?.status === 423;
      const message = isLocked
        ? error?.message || 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.'
        : error?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra tài khoản, mật khẩu hoặc trạng thái tài khoản.';
      const normalizedError = new Error(message);
      normalizedError.code = isLocked ? 'ACCOUNT_LOCKED' : error?.code;
      normalizedError.reason = error?.reason;
      normalizedError.lockedUntil = error?.lockedUntil;
      throw normalizedError;
    }

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

  changePassword: async (data) =>
    apiClient.post('/auth/change-password', {
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
      confirmPassword: data.confirmPassword,
    }),

  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me');
    persistSession(localStorage.getItem('authToken'), response.user);
    return response;
  },

  updateProfile: async (data) => {
    const response = await apiClient.put('/auth/profile', data);
    persistSession(localStorage.getItem('authToken'), response.user);
    return response;
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
    }
  },

  isAuthenticated: () => Boolean(localStorage.getItem('authToken')),

  getStoredUser: () => {
    const stored = localStorage.getItem('authUser');
    return stored ? JSON.parse(stored) : null;
  },

  getToken: () => localStorage.getItem('authToken'),

  setStoredUser: (user) => persistSession(localStorage.getItem('authToken'), user),
};

export { apiClient };
export default authService;
