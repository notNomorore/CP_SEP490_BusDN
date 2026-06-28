import { create } from 'zustand';

import authApi from '@/api/auth.api';
import type { AuthUser, PendingRegistrationOtp, RegisterPayload, VerifyOtpPayload } from '@/types/auth';
import { getErrorMessage } from '@/utils/validation';

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  pendingRegistration: PendingRegistrationOtp | null;
  restoreSession: () => Promise<void>;
  register: (payload: RegisterPayload & { identifier: string }) => Promise<void>;
  verifyOtp: (payload: VerifyOtpPayload) => Promise<void>;
  resendOtp: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isHydrated: false,
  isLoading: false,
  error: null,
  pendingRegistration: null,

  restoreSession: async () => {
    const { token, user } = await authApi.getStoredSession();

    set({
      token,
      user,
      isAuthenticated: Boolean(token),
      isHydrated: true,
    });
  },

  register: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authApi.register(payload);
      set({
        pendingRegistration: {
          email: payload.email,
          phone: payload.phone || payload.phoneNumber,
          identifier: payload.identifier,
          expiresAt: result.expiresAt,
        },
      });
    } catch (error) {
      const message = getErrorMessage(error, 'Registration failed.');
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  verifyOtp: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      await authApi.verifyOtp(payload);
      set({ pendingRegistration: null });
    } catch (error) {
      const message = getErrorMessage(error, 'OTP verification failed.');
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  resendOtp: async () => {
    const pending = get().pendingRegistration;
    if (!pending) return;

    set({ isLoading: true, error: null });
    try {
      const result = await authApi.resendOtp({
        email: pending.email,
        phone: pending.phone,
      });
      set({
        pendingRegistration: {
          ...pending,
          expiresAt: result.expiresAt || pending.expiresAt,
        },
      });
    } catch (error) {
      const message = getErrorMessage(error, 'OTP resend failed.');
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (identifier, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authApi.login(identifier, password);

      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        error: null,
      });
    } catch (error) {
      const message = getErrorMessage(error, 'Login failed.');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        error: message,
      });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  refreshUser: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await authApi.getCurrentUser();
      set({ user: response.user });
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to refresh profile.');
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      await authApi.logout();
    } finally {
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
