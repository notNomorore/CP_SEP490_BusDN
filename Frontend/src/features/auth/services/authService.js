import apiClient from '../../../shared/services/apiClient.js';

const FRONTEND_RUN_ID_KEY = 'frontendRunId';
const AUTH_STORAGE_KEYS = ['authToken', 'authUser'];

const clearCookie = (name, path = '/') => {
  document.cookie = `${name}=; Max-Age=0; path=${path}; SameSite=Lax`;
};

const clearSessionCookies = () => {
  document.cookie
    .split(';')
    .map((cookie) => cookie.split('=')[0].trim())
    .filter(Boolean)
    .forEach((name) => {
      clearCookie(name);
      clearCookie(name, window.location.pathname || '/');
    });
};

const clearStoredAuthSession = () => {
  AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  sessionStorage.removeItem('registrationOtpSession');
  clearSessionCookies();
};

const clearAuthSessionAfterFrontendRestart = () => {
  const currentRunId = import.meta.env.VITE_FRONTEND_RUN_ID;
  const previousRunId = localStorage.getItem(FRONTEND_RUN_ID_KEY);

  if (previousRunId !== currentRunId) {
    clearStoredAuthSession();
    localStorage.setItem(FRONTEND_RUN_ID_KEY, currentRunId);
  }
};

clearAuthSessionAfterFrontendRestart();

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
      clearStoredAuthSession();
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
