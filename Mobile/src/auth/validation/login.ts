export type LoginFormValues = {
  identifier: string;
  password: string;
};

export function canSubmitLogin(values: LoginFormValues) {
  return Boolean(values.identifier.trim() && values.password);
}
