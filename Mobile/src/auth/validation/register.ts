import { splitIdentifier, validatePassword } from '@/utils/validation';

export type RegisterFormValues = {
  fullName: string;
  identifier: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
};

export function validateRegisterForm(values: RegisterFormValues) {
  const passwordValidation = validatePassword(values.password);
  const passwordsMatch = values.confirmPassword.length > 0 && values.password === values.confirmPassword;
  const identifier = splitIdentifier(values.identifier);
  const canSubmit =
    Boolean(values.fullName.trim()) &&
    Boolean(values.identifier.trim()) &&
    passwordValidation.isValid &&
    passwordsMatch &&
    values.agreeToTerms;

  return {
    canSubmit,
    confirmPasswordError: values.confirmPassword && !passwordsMatch
      ? 'Passwords do not match.'
      : undefined,
    identifier,
    passwordValidation,
    passwordsMatch,
  };
}
