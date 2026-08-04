import { create } from 'zustand';

import priorityProfileApi from '@/api/priorityProfile.api';
import type {
  PriorityDocumentAsset,
  PriorityDocumentType,
  PriorityProfileResponse,
  PriorityRegistrationDraft,
} from '@/types/priorityProfile';
import { getErrorMessage } from '@/utils/validation';

export const initialPriorityDraft: PriorityRegistrationDraft = {
  fullName: '',
  dateOfBirth: '',
  profileType: '',
  identityNumber: '',
  cardNumber: '',
  issuingAuthority: '',
  reason: '',
};

type PriorityProfileState = {
  draft: PriorityRegistrationDraft;
  documents: PriorityDocumentAsset[];
  status: PriorityProfileResponse | null;
  requests: PriorityProfileResponse[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  setDraftField: <K extends keyof PriorityRegistrationDraft>(field: K, value: PriorityRegistrationDraft[K]) => void;
  saveDraft: (draft: PriorityRegistrationDraft) => void;
  addDocument: (document: Omit<PriorityDocumentAsset, 'id' | 'status' | 'progress'>) => void;
  replaceGroupDocuments: (
    groupId: string,
    documentType: PriorityDocumentType,
    documents: Array<Omit<PriorityDocumentAsset, 'id' | 'status' | 'progress' | 'documentType' | 'groupId'>>
  ) => void;
  updateDocumentGroupType: (groupId: string, documentType: PriorityDocumentType) => void;
  removeDocumentGroup: (groupId: string) => void;
  removeDocument: (documentType: PriorityDocumentType, id?: string) => void;
  loadStatus: () => Promise<void>;
  submitApplication: () => Promise<PriorityProfileResponse>;
  resetApplication: () => void;
  clearError: () => void;
};

const emptyPriorityStatus: PriorityProfileResponse = {
  requestId: null,
  isPriorityGroup: false,
  priorityStatus: 'NONE',
  profile: {
    profileType: null,
    fullName: '',
    dateOfBirth: null,
    identityNumber: null,
    cardNumber: null,
    issuingAuthority: null,
    reason: null,
    status: 'NONE',
    rejectionReason: null,
    expiryDate: null,
    submittedAt: null,
    reviewedAt: null,
    documents: [],
  },
};

const normalizePriorityResponse = (response?: PriorityProfileResponse | null): PriorityProfileResponse => {
  if (!response?.requestId || response.priorityStatus === 'NONE' || response.profile?.status === 'NONE') {
    return emptyPriorityStatus;
  }

  return response;
};

const normalizePriorityRequests = (requests?: PriorityProfileResponse[]) => (
  (requests || []).filter((request) => Boolean(request.requestId) && request.priorityStatus !== 'NONE' && request.profile?.status !== 'NONE')
);

export const usePriorityProfileStore = create<PriorityProfileState>((set, get) => ({
  draft: initialPriorityDraft,
  documents: [],
  status: null,
  requests: [],
  isLoading: false,
  isSubmitting: false,
  error: null,

  setDraftField: (field, value) => set((state) => ({
    draft: { ...state.draft, [field]: value },
  })),

  saveDraft: (draft) => set({ draft, error: null }),

  addDocument: (document) => set((state) => ({
    documents: [
      ...state.documents,
      {
        ...document,
        id: `${document.groupId || document.documentType}-${Date.now()}`,
        status: 'selected',
        progress: 0,
      },
    ],
  })),

  replaceGroupDocuments: (groupId, documentType, documents) => set((state) => ({
    documents: [
      ...state.documents.filter((document) => document.groupId !== groupId),
      ...documents.slice(0, 5).map((document, index) => ({
        ...document,
        id: `${groupId}-${Date.now()}-${index}`,
        groupId,
        documentType,
        status: 'selected' as const,
        progress: 0,
      })),
    ],
  })),

  updateDocumentGroupType: (groupId, documentType) => set((state) => ({
    documents: state.documents.map((document) => (
      document.groupId === groupId ? { ...document, documentType } : document
    )),
  })),

  removeDocumentGroup: (groupId) => set((state) => ({
    documents: state.documents.filter((document) => document.groupId !== groupId),
  })),

  removeDocument: (documentType, id) => set((state) => ({
    documents: state.documents.filter((document) => (
      id ? document.id !== id : document.documentType !== documentType
    )),
  })),

  loadStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const [status, requests] = await Promise.all([
        priorityProfileApi.getStatus(),
        priorityProfileApi.listMyRequests(),
      ]);
      set({
        status: normalizePriorityResponse(status),
        requests: normalizePriorityRequests(requests),
      });
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to load priority application status.');
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  submitApplication: async () => {
    set({ isSubmitting: true, error: null });
    try {
      set((state) => ({
        documents: state.documents.map((document) => ({ ...document, status: 'uploading', progress: 8 })),
      }));
      const response = await priorityProfileApi.submit(get().draft, get().documents, (progress) => {
        set((state) => ({
          documents: state.documents.map((document) => ({ ...document, progress })),
        }));
      });
      set((state) => ({
        status: response,
        requests: [response, ...state.requests.filter((request) => request.requestId !== response.requestId)],
        documents: state.documents.map((document) => ({ ...document, status: 'uploaded', progress: 100 })),
      }));
      return response;
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to submit priority application.');
      set((state) => ({
        error: message,
        documents: state.documents.map((document) => ({ ...document, status: 'error' })),
      }));
      throw error;
    } finally {
      set({ isSubmitting: false });
    }
  },

  resetApplication: () => set({ draft: initialPriorityDraft, documents: [], error: null }),

  clearError: () => set({ error: null }),
}));

export default usePriorityProfileStore;
