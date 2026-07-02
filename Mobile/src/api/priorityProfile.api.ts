import apiClient from '@/api/client';
import type {
  ApiEnvelope,
  PriorityDocumentAsset,
  PriorityProfileResponse,
  PriorityRegistrationDraft,
} from '@/types/priorityProfile';

export const PROFILE_TYPES = [
  { value: 'STUDENT', label: 'Student' },
  { value: 'SENIOR', label: 'Senior Citizen' },
  { value: 'DISABLED', label: 'Disabled Person' },
  { value: 'PREGNANT', label: 'Pregnant Passenger' },
  { value: 'CHILD_UNDER_6', label: 'Child Under 6' },
  { value: 'OTHER', label: 'Other Priority Group' },
] as const;

export const DOCUMENT_TYPES = [
  { value: 'IDENTITY_FRONT', label: 'CCCD/CMND front' },
  { value: 'IDENTITY_BACK', label: 'CCCD/CMND back' },
  { value: 'PRIORITY_PROOF', label: 'Priority Certificate' },
  { value: 'PORTRAIT', label: 'Portrait Photo' },
  { value: 'OTHER', label: 'Additional Supporting Documents' },
] as const;

const appendDocument = (formData: FormData, document: PriorityDocumentAsset) => {
  if (document.file) {
    formData.append('documents', document.file);
    return;
  }

  formData.append('documents', {
    uri: document.uri,
    name: document.name,
    type: document.mimeType || 'application/octet-stream',
  } as unknown as Blob);
};

const buildProfilePayload = (draft: PriorityRegistrationDraft) => ({
  profileType: draft.profileType,
  fullName: draft.fullName,
  dateOfBirth: draft.dateOfBirth,
  identityNumber: draft.identityNumber,
  reason: draft.reason,
});

export const priorityProfileApi = {
  getStatus: async (): Promise<PriorityProfileResponse> => {
    const response = await apiClient.get('/priority-profile/me') as unknown as ApiEnvelope<PriorityProfileResponse>;
    return response.data;
  },

  listMyRequests: async (): Promise<PriorityProfileResponse[]> => {
    const response = await apiClient.get('/priority-profile/me/requests') as unknown as ApiEnvelope<PriorityProfileResponse[]>;
    return response.data || [];
  },

  register: async (draft: PriorityRegistrationDraft): Promise<PriorityProfileResponse> => {
    const response = await apiClient.post(
      '/priority-profile/register',
      buildProfilePayload(draft),
    ) as unknown as ApiEnvelope<PriorityProfileResponse>;
    return response.data;
  },

  submit: async (
    draft: PriorityRegistrationDraft,
    documents: PriorityDocumentAsset[],
    onProgress?: (progress: number) => void,
  ): Promise<PriorityProfileResponse> => {
    const formData = new FormData();
    const payload = buildProfilePayload(draft);
    Object.entries(payload).forEach(([key, value]) => {
      formData.append(key, value || '');
    });

    documents.forEach((document) => appendDocument(formData, document));
    formData.append('documentTypes', JSON.stringify(documents.map((document) => document.documentType)));

    const response = await apiClient.post('/priority-profile/submit', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (!event.total) return;
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      },
    }) as unknown as ApiEnvelope<PriorityProfileResponse>;

    return response.data;
  },

  uploadDocuments: async (
    documentType: PriorityDocumentAsset['documentType'],
    documents: PriorityDocumentAsset[],
    onProgress?: (progress: number) => void,
  ): Promise<PriorityProfileResponse> => {
    const formData = new FormData();
    formData.append('documentType', documentType);
    documents.forEach((document) => appendDocument(formData, document));

    const response = await apiClient.post('/priority-profile/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (!event.total) return;
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      },
    }) as unknown as ApiEnvelope<PriorityProfileResponse>;

    return response.data;
  },
};

export default priorityProfileApi;
