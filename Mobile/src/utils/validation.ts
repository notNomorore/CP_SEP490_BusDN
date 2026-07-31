export const splitIdentifier = (identifier: string) => {
  const normalized = identifier.trim();

  if (normalized.includes('@')) {
    return { email: normalized.toLowerCase(), phone: undefined };
  }

  return { email: undefined, phone: normalized.replace(/\s+/g, '') };
};

export const getErrorMessage = (error: unknown, fallback: string) => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && 'errors' in error) {
    const errors = (error as { errors?: unknown }).errors;
    if (typeof errors === 'object' && errors) {
      const messages = Object.values(errors)
        .flat()
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
      if (messages.length > 0) return messages.join(' ');
    }
  }
  if (typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
};

export const validatePassword = (password: string) => {
  const checks = [
    { key: 'length', label: 'At least 8 characters', valid: password.length >= 8 },
    { key: 'upper', label: 'Includes one uppercase letter', valid: /[A-Z]/.test(password) },
    { key: 'lower', label: 'Includes one lowercase letter', valid: /[a-z]/.test(password) },
    { key: 'number', label: 'Includes one number', valid: /[0-9]/.test(password) },
    { key: 'special', label: 'Includes one special character (@$!%*?&)', valid: /[@$!%*?&]/.test(password) },
  ];

  return {
    checks,
    isValid: checks.every((check) => check.valid),
  };
};

export type PriorityRegistrationValues = {
  fullName: string;
  dateOfBirth: string;
  gender: string;
  phoneNumber: string;
  email: string;
  residentialAddress: string;
  profileType: string;
  identityNumber: string;
  reason: string;
};

const isValidIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
  );
};

export const validatePriorityRegistration = (values: PriorityRegistrationValues) => {
  const errors: Partial<Record<keyof PriorityRegistrationValues, string>> = {};

  if (!values.fullName.trim()) errors.fullName = 'Full name is required.';
  if (!values.dateOfBirth.trim()) {
    errors.dateOfBirth = 'Date of birth is required.';
  } else if (!isValidIsoDate(values.dateOfBirth.trim())) {
    errors.dateOfBirth = 'Use a valid date in YYYY-MM-DD format.';
  } else if (new Date(values.dateOfBirth) > new Date()) {
    errors.dateOfBirth = 'Date of birth cannot be in the future.';
  }
  if (!values.gender.trim()) errors.gender = 'Gender is required.';
  if (!values.phoneNumber.trim()) errors.phoneNumber = 'Phone number is required.';
  if (values.email.trim() && !/^\S+@\S+\.\S+$/.test(values.email.trim())) {
    errors.email = 'Email address is invalid.';
  }
  if (!values.residentialAddress.trim()) errors.residentialAddress = 'Residential address is required.';
  if (!values.profileType.trim()) errors.profileType = 'Priority type is required.';
  if (!values.identityNumber.trim()) errors.identityNumber = 'Identification number is required.';
  if (!values.reason.trim()) errors.reason = 'Reason for priority request is required.';

  return errors;
};
