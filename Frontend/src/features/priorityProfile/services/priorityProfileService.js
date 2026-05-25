import { apiClient } from '../../auth/services/authService.js';

export const PROFILE_TYPES = [
  { value: 'STUDENT', label: 'Học sinh / Sinh viên' },
  { value: 'SENIOR', label: 'Người cao tuổi' },
  { value: 'DISABLED', label: 'Người khuyết tật' },
  { value: 'PREGNANT', label: 'Phụ nữ mang thai' },
  { value: 'CHILD_UNDER_6', label: 'Trẻ em dưới 6 tuổi' },
  { value: 'OTHER', label: 'Đối tượng ưu tiên khác' },
];

export const DOCUMENT_TYPES = [
  { value: 'IDENTITY_FRONT', label: 'CCCD/CMND mặt trước' },
  { value: 'IDENTITY_BACK', label: 'CCCD/CMND mặt sau' },
  { value: 'PRIORITY_PROOF', label: 'Giấy tờ chứng minh ưu tiên' },
  { value: 'PORTRAIT', label: 'Ảnh chân dung' },
  { value: 'OTHER', label: 'Tài liệu khác' },
];

export const priorityProfileService = {
  getStatus: async () => {
    return apiClient.get('/priority-profile/me');
  },

  register: async (payload) => {
    return apiClient.post('/priority-profile/register', payload);
  },

  uploadDocuments: async ({ documentType, files }) => {
    const formData = new FormData();
    formData.append('documentType', documentType);

    Array.from(files).forEach((file) => {
      formData.append('documents', file);
    });

    return apiClient.post('/priority-profile/documents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  listAdminRequests: async ({ status = 'PENDING', page = 1, limit = 20 } = {}) => {
    return apiClient.get('/priority-profile/admin/requests', {
      params: { status, page, limit },
    });
  },

  getAdminRequestDetail: async (userId) => {
    return apiClient.get(`/priority-profile/admin/requests/${userId}`);
  },

  verifyAdminRequest: async (userId, payload) => {
    return apiClient.patch(`/priority-profile/admin/requests/${userId}/verify`, payload);
  },
};

export default priorityProfileService;
