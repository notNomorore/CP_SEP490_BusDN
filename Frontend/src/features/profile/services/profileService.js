import apiClient from '../../../shared/services/apiClient.js';

export const profileService = {
  getMyProfile: async () => {
    const response = await apiClient.get('/profile/me');
    return response.data;
  },

  updateProfile: async (payload) => {
    const response = await apiClient.put('/profile/update', payload);
    return response.data;
  },

  changePassword: async (payload) => {
    const response = await apiClient.put('/profile/change-password', payload);
    return response;
  },

  uploadAvatar: async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await apiClient.post('/profile/upload-avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  getFavoriteRoutes: async () => {
    const response = await apiClient.get('/profile/favorites/routes');
    return response.data;
  },

  getFavoriteStops: async () => {
    const response = await apiClient.get('/profile/favorites/stops');
    return response.data;
  },
};

export default profileService;
