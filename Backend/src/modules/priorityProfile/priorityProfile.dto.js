const PROFILE_TYPES = ['STUDENT', 'SENIOR', 'DISABLED', 'PREGNANT', 'CHILD_UNDER_6', 'OTHER'];
const DOCUMENT_TYPES = ['IDENTITY_FRONT', 'IDENTITY_BACK', 'PRIORITY_PROOF', 'PORTRAIT', 'OTHER'];

const getStartOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

export const RegisterPriorityProfileDTO = {
  validate: (body) => {
    const errors = {};

    if (!PROFILE_TYPES.includes(body.profileType)) {
      errors.profileType = 'Priority profile type is invalid';
    }

    if (!body.fullName?.trim()) {
      errors.fullName = 'Full name is required';
    }

    if (!body.dateOfBirth) {
      errors.dateOfBirth = 'Date of birth is required';
    } else if (Number.isNaN(Date.parse(body.dateOfBirth))) {
      errors.dateOfBirth = 'Date of birth is invalid';
    }

    if (!body.identityNumber?.trim()) {
      errors.identityNumber = 'Identity number is required';
    }

    if (!body.reason?.trim()) {
      errors.reason = 'Priority support reason is required';
    }

    return Object.keys(errors).length === 0 ? null : errors;
  },
};

export const UploadPriorityDocumentsDTO = {
  validate: (body, files) => {
    const errors = {};

    if (!DOCUMENT_TYPES.includes(body.documentType)) {
      errors.documentType = 'Document type is invalid';
    }

    if (!files || files.length === 0) {
      errors.documents = 'At least one verification document is required';
    }

    return Object.keys(errors).length === 0 ? null : errors;
  },
};

export const VerifyPriorityProfileDTO = {
  validate: (body) => {
    const errors = {};

    if (!['APPROVED', 'REJECTED'].includes(body.status)) {
      errors.status = 'Verification status must be APPROVED or REJECTED';
    }

    if (body.status === 'REJECTED' && !body.rejectionReason?.trim()) {
      errors.rejectionReason = 'Rejection reason is required when rejecting a profile';
    }

    if (body.noExpiry !== undefined && typeof body.noExpiry !== 'boolean') {
      errors.noExpiry = 'No expiry flag must be boolean';
    }

    if (body.status === 'APPROVED' && !body.noExpiry && !body.expiryDate) {
      errors.expiryDate = 'Expiry date is required unless no expiry is selected';
    }

    if (!body.noExpiry && body.expiryDate && Number.isNaN(Date.parse(body.expiryDate))) {
      errors.expiryDate = 'Expiry date is invalid';
    }

    if (!body.noExpiry && body.expiryDate && new Date(body.expiryDate) < getStartOfToday()) {
      errors.expiryDate = 'Expiry date cannot be in the past';
    }

    return Object.keys(errors).length === 0 ? null : errors;
  },
};

export const PriorityProfileResponseDTO = {
  format: (user) => {
    const profile = user.priorityProfile || {};

    return {
      userId: user._id,
      isPriorityGroup: user.isPriorityGroup,
      priorityStatus: user.priorityStatus,
      profile: {
        profileType: profile.profileType || null,
        fullName: profile.fullName || user.fullName,
        dateOfBirth: profile.dateOfBirth || null,
        identityNumber: profile.identityNumber || null,
        cardNumber: profile.cardNumber || null,
        issuingAuthority: profile.issuingAuthority || null,
        reason: profile.reason || null,
        status: profile.status || 'NONE',
        rejectionReason: profile.rejectionReason || null,
        expiryDate: profile.expiryDate || null,
        submittedAt: profile.submittedAt || null,
        reviewedAt: profile.reviewedAt || null,
        documents: profile.documents || [],
      },
    };
  },
};

export { PROFILE_TYPES, DOCUMENT_TYPES };
