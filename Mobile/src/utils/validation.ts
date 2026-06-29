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
