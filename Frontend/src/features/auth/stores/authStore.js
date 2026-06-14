import { create } from 'zustand';
import authService from '../services/authService.js';

/**
 * Auth Store - Zustand store for authentication state
 */
export const useAuthStore = create((set, get) => ({
  // State
  user: authService.getStoredUser() || null,
  token: authService.getToken() || null,
  isLoading: false,
  isAuthenticated: authService.isAuthenticated(),
  error: null,

  // Selectors
  isAdmin: () => get().user?.role === 'ADMIN',
  isDriver: () => get().user?.role === 'DRIVER',
  isConductor: () => get().user?.role === 'CONDUCTOR' || get().user?.role === 'BUS_ASSISTANT',
  isPassenger: () => get().user?.role === 'PASSENGER',

  // Actions
  /**
   * Register new user
   */
  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authService.register(data);
      return result;
    } catch (error) {
      const errorMsg = error.message || error.errors || 'Registration failed';
      set({ error: errorMsg });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Verify OTP
   */
  verifyOTP: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authService.verifyOTP(data);
      set({ error: null });

      return result;
    } catch (error) {
      const errorMsg = error.message || 'OTP verification failed';
      set({ error: errorMsg });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Resend account verification OTP
   */
  resendOtp: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authService.resendOtp(data);
      return result;
    } catch (error) {
      const errorMsg = error.message || 'OTP resend failed';
      set({ error: errorMsg });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Login user
   */
  login: async (identifier, password) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authService.login(identifier, password);

      set({
        user: result.user,
        token: result.token,
        isAuthenticated: true,
        error: null,
      });

      return result;
    } catch (error) {
      const errorMsg = error.message || 'Đăng nhập thất bại. Vui lòng kiểm tra tài khoản, mật khẩu hoặc trạng thái tài khoản.';
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        error: errorMsg,
      });
      throw new Error(errorMsg);
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Request password reset
   */
  requestPasswordReset: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authService.requestPasswordReset(data);
      return result;
    } catch (error) {
      const errorMsg = error.message || 'Password reset request failed';
      set({ error: errorMsg });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Reset password
   */
  resetPassword: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authService.resetPassword(data);
      return result;
    } catch (error) {
      const errorMsg = error.message || 'Password reset failed';
      set({ error: errorMsg });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Change password
   */
  changePassword: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authService.changePassword(data);

      set({
        user: result.user,
        error: null,
      });

      return result;
    } catch (error) {
      const errorMsg = error.message || 'Password change failed';
      set({ error: errorMsg });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Get current user profile
   */
  refreshUser: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await authService.getCurrentUser();

      set({
        user: result.user,
        error: null,
      });

      return result;
    } catch (error) {
      const errorMsg = error.message || 'Failed to fetch user profile';
      set({ error: errorMsg });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Update user profile
   */
  updateProfile: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authService.updateProfile(data);

      set({
        user: result.user,
        error: null,
      });

      return result;
    } catch (error) {
      const errorMsg = error.message || 'Profile update failed';
      set({ error: errorMsg });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Logout user
   */
  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      await authService.logout();

      set({
        user: null,
        token: null,
        isAuthenticated: false,
        error: null,
      });
    } catch (error) {
      // Still logout even if API call fails
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        error: null,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Clear error
   */
  clearError: () => {
    set({ error: null });
  },

  syncUser: (user) => {
    authService.setStoredUser(user);
    set({
      user,
      isAuthenticated: true,
    });
  },

  /**
   * Restore from storage (called on app init)
   */
  restoreSession: () => {
    const user = authService.getStoredUser();
    const token = authService.getToken();
    const isAuthenticated = authService.isAuthenticated();

    set({
      user,
      token,
      isAuthenticated,
    });
  },
}));

export default useAuthStore;
