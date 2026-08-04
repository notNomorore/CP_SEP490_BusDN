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

export const getErrorStatusCode = (error: unknown) => {
  if (!error || typeof error !== 'object') return undefined;

  const candidate = error as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
  };
  const status = candidate.response?.status ?? candidate.statusCode ?? candidate.status;
  return typeof status === 'number' ? status : undefined;
};

export const isPermissionError = (error: unknown) => {
  const statusCode = getErrorStatusCode(error);
  if (statusCode === 403) return true;

  const message = getErrorMessage(error, '').toLowerCase();
  return message.includes('forbidden') || message.includes('insufficient permissions');
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
  profileType: string;
  identityNumber: string;
  cardNumber: string;
  issuingAuthority: string;
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

  if (!values.fullName.trim()) errors.fullName = 'Vui lòng nhập họ và tên.';
  if (!values.dateOfBirth.trim()) {
    errors.dateOfBirth = 'Vui lòng nhập ngày sinh.';
  } else if (!isValidIsoDate(values.dateOfBirth.trim())) {
    errors.dateOfBirth = 'Vui lòng nhập ngày sinh hợp lệ theo định dạng YYYY-MM-DD.';
  } else if (new Date(values.dateOfBirth) > new Date()) {
    errors.dateOfBirth = 'Ngày sinh không được ở tương lai.';
  }
  if (!values.profileType.trim()) errors.profileType = 'Vui lòng chọn nhóm ưu tiên.';
  if (!values.identityNumber.trim()) errors.identityNumber = 'Vui lòng nhập số CCCD/CMND.';
  if (!values.issuingAuthority.trim()) errors.issuingAuthority = 'Vui lòng nhập nơi cấp giấy tờ ưu tiên.';
  if (!values.reason.trim()) errors.reason = 'Vui lòng nhập lý do đăng ký ưu tiên.';

  return errors;
};
