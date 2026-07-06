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
    { key: 'length', label: 'Ãt nháº¥t 8 kÃ½ tá»±', valid: password.length >= 8 },
    { key: 'upper', label: 'CÃ³ má»™t chá»¯ hoa', valid: /[A-Z]/.test(password) },
    { key: 'lower', label: 'CÃ³ má»™t chá»¯ thÆ°á»ng', valid: /[a-z]/.test(password) },
    { key: 'number', label: 'CÃ³ má»™t chá»¯ sá»‘', valid: /[0-9]/.test(password) },
    { key: 'special', label: 'CÃ³ má»™t kÃ½ tá»± Ä‘áº·c biá»‡t (@$!%*?&)', valid: /[@$!%*?&]/.test(password) },
  ];

  return {
    checks,
    isValid: checks.every((check) => check.valid),
  };
};
