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

export type AvatarAsset = {
  uri: string;
  name?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  type?: string | null;
};

export const profileApi = {
  getMyProfile: async (): Promise<UserProfile> => {
    const response = await apiClient.get('/profile/me') as unknown as ApiEnvelope<UserProfile>;
    return response.data;
  },

  changePassword: async (payload: ChangePasswordPayload): Promise<void> => {
    await apiClient.put('/profile/change-password', payload);
  },

  uploadAvatar: async (asset: AvatarAsset): Promise<UserProfile> => {
    const formData = new FormData();
    formData.append('avatar', {
      uri: asset.uri,
      name: asset.fileName || asset.name || `avatar-${Date.now()}.jpg`,
      type: asset.mimeType || asset.type || 'image/jpeg',
    } as unknown as Blob);

    const response = await apiClient.post('/profile/upload-avatar', formData) as unknown as ApiEnvelope<UserProfile>;
    return response.data;
  },
};

export default profileApi;
