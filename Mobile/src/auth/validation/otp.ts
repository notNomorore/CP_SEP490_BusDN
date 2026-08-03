const OTP_LENGTH = 6;

export function sanitizeOtpInput(value: string) {
  return value.replace(/\D/g, '').slice(0, OTP_LENGTH);
}

export function isValidOtp(value: string) {
  return value.length === OTP_LENGTH;
}
