import apiClient from '@/api/client';
import type { UserProfile } from '@/types/auth';

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export const profileApi = {
  getMyProfile: async (): Promise<UserProfile> => {
    const response = await apiClient.get('/profile/me') as unknown as ApiEnvelope<UserProfile>;
    return response.data;
  },

  changePassword: async (payload: ChangePasswordPayload): Promise<void> => {
    await apiClient.put('/profile/change-password', payload);
  },
};

export default profileApi;
