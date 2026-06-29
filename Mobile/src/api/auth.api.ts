import apiClient, { AUTH_TOKEN_KEY, AUTH_USER_KEY } from '@/api/client';
import authStorage from '@/api/authStorage';
import type {
  AuthUser,
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
  VerifyOtpPayload,
  VerifyOtpResponse,
} from '@/types/auth';

const persistSession = async (token?: string, user?: AuthUser) => {
  if (token) {
    await authStorage.setItem(AUTH_TOKEN_KEY, token);
  }

  if (user) {
    await authStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  }
};

export const authApi = {
  register: (data: RegisterPayload): Promise<RegisterResponse> =>
    apiClient.post('/auth/register', {
      email: data.email || undefined,
      phoneNumber: data.phoneNumber || data.phone || undefined,
      fullName: data.fullName,
      password: data.password,
      confirmPassword: data.confirmPassword,
    }) as unknown as Promise<RegisterResponse>,

  verifyOtp: (data: VerifyOtpPayload): Promise<VerifyOtpResponse> =>
    apiClient.post('/auth/verify-otp', {
      email: data.email || undefined,
      phoneNumber: data.phoneNumber || data.phone || undefined,
      otp: data.otp,
    }) as unknown as Promise<VerifyOtpResponse>,

  resendOtp: (data: Omit<VerifyOtpPayload, 'otp'>): Promise<RegisterResponse> =>
    apiClient.post('/auth/resend-otp', {
      email: data.email || undefined,
      phoneNumber: data.phoneNumber || data.phone || undefined,
    }) as unknown as Promise<RegisterResponse>,

  login: async (identifier: string, password: string): Promise<LoginResponse> => {
    const response = await apiClient.post('/auth/login', {
      identifier,
      password,
    }) as unknown as LoginResponse;

    await persistSession(response.token, response.user);
    return response;
  },

  getCurrentUser: async (): Promise<{ success: boolean; user: AuthUser }> => {
    const response = await apiClient.get('/auth/me') as unknown as { success: boolean; user: AuthUser };
    await persistSession(await authStorage.getItem(AUTH_TOKEN_KEY) || undefined, response.user);
    return response;
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // JWT sessions are stateless. Local token removal must still complete
      // when the API is unreachable or the token has already expired.
    } finally {
      await authStorage.deleteItem(AUTH_TOKEN_KEY);
      await authStorage.deleteItem(AUTH_USER_KEY);
    }
  },

  getStoredSession: async () => {
    const [token, storedUser] = await Promise.all([
      authStorage.getItem(AUTH_TOKEN_KEY),
      authStorage.getItem(AUTH_USER_KEY),
    ]);

    let user: AuthUser | null = null;
    if (storedUser) {
      try {
        user = JSON.parse(storedUser) as AuthUser;
      } catch {
        user = null;
      }
    }

    return { token, user };
  },
};

export default authApi;
