export type PriorityProfileType =
  | 'STUDENT'
  | 'SENIOR'
  | 'DISABLED'
  | 'PREGNANT'
  | 'CHILD_UNDER_6'
  | 'OTHER';

export type PriorityDocumentType =
  | 'IDENTITY_FRONT'
  | 'IDENTITY_BACK'
  | 'PRIORITY_PROOF'
  | 'PORTRAIT'
  | 'OTHER';

export type PriorityStatus = 'NONE' | 'PENDING' | 'UNDER_REVIEW' | 'DOCUMENT_VERIFIED' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export type PriorityRegistrationDraft = {
  fullName: string;
  dateOfBirth: string;
  profileType: PriorityProfileType | '';
  identityNumber: string;
  cardNumber: string;
  issuingAuthority: string;
  reason: string;
};

export type PriorityDocumentAsset = {
  id: string;
  groupId?: string;
  documentType: PriorityDocumentType;
  name: string;
  uri?: string;
  mimeType?: string;
  size?: number;
  file?: File;
  status: 'idle' | 'selected' | 'uploading' | 'uploaded' | 'error';
  progress: number;
};

export type PriorityProfileDocument = {
  _id?: string;
  type: PriorityDocumentType;
  originalName?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  url?: string;
  uploadedAt?: string;
};

export type PriorityProfileResponse = {
  requestId: string | null;
  userId?: string;
  isPriorityGroup: boolean;
  priorityStatus: PriorityStatus;
  profile: {
    profileType: PriorityProfileType | null;
    fullName: string;
    dateOfBirth: string | null;
    identityNumber: string | null;
    cardNumber?: string | null;
    issuingAuthority?: string | null;
    reason: string | null;
    status: PriorityStatus;
    rejectionReason?: string | null;
    expiryDate?: string | null;
    submittedAt?: string | null;
    reviewedAt?: string | null;
    documents: PriorityProfileDocument[];
  };
};

export type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T;
};
