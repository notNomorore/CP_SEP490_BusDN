import { CHAT_REFUSAL, SAFE_DATA_FALLBACK, normalizeForPolicy } from './chatPolicy.js';

const MAX_RESPONSE_LENGTH = 2500;

const SENSITIVE_OUTPUT_PATTERNS = [
  /system prompt|developer message|hidden instruction|internal instruction/i,
  /api key|environment variable|env var|access token|jwt|password|secret/i,
  /mongodb_uri|jwt_secret|gemini_api_key|vite_gemini_api_key|database_name/i,
];

const INTERNAL_PATH_PATTERN = /\/api\/(auth|admin|tickets|customer-support|profile|ai\/chat)\b/i;

const UNSUPPORTED_ACTION_CLAIMS = [
  /da mua ve|ve da duoc mua|i bought|ticket has been purchased/i,
  /da huy ve|ve da duoc huy|cancelled your ticket/i,
  /da cap nhat tai khoan|updated your account/i,
  /da tao ho so|case has been created|submitted your feedback/i,
];

const UNSUPPORTED_DYNAMIC_CLAIMS = [
  /gia ve .* la \d/i,
  /chuyen cuoi .* \d{1,2}:\d{2}/i,
  /xe .* dang o/i,
  /eta .* \d+\s*(phut|min)/i,
];

export const sanitizeChatText = (value) => String(value || '')
  .replace(/<[^>]*>/g, '')
  .replace(/\s+\n/g, '\n')
  .trim();

export const clampChatResponse = (text) => {
  const sanitized = sanitizeChatText(text);
  if (sanitized.length <= MAX_RESPONSE_LENGTH) return sanitized;
  return `${sanitized.slice(0, MAX_RESPONSE_LENGTH).trim()}...`;
};

export const validateModelResponse = (text, context = {}) => {
  const sanitizedResponse = clampChatResponse(text);
  const normalized = normalizeForPolicy(sanitizedResponse);

  if (!sanitizedResponse) {
    return {
      allowed: false,
      reason: 'EMPTY_RESPONSE',
      sanitizedResponse: SAFE_DATA_FALLBACK,
    };
  }

  if (SENSITIVE_OUTPUT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      allowed: false,
      reason: 'SENSITIVE_OUTPUT',
      sanitizedResponse: CHAT_REFUSAL,
    };
  }

  if (INTERNAL_PATH_PATTERN.test(sanitizedResponse)) {
    return {
      allowed: false,
      reason: 'INTERNAL_ENDPOINT_EXPOSURE',
      sanitizedResponse: SAFE_DATA_FALLBACK,
    };
  }

  if (!context.actionPerformed && UNSUPPORTED_ACTION_CLAIMS.some((pattern) => pattern.test(normalized))) {
    return {
      allowed: false,
      reason: 'UNSUPPORTED_ACTION_CLAIM',
      sanitizedResponse: SAFE_DATA_FALLBACK,
    };
  }

  if (!context.hasVerifiedDynamicData && UNSUPPORTED_DYNAMIC_CLAIMS.some((pattern) => pattern.test(normalized))) {
    return {
      allowed: false,
      reason: 'UNSUPPORTED_DYNAMIC_CLAIM',
      sanitizedResponse: SAFE_DATA_FALLBACK,
    };
  }

  return {
    allowed: true,
    reason: 'ALLOWED',
    sanitizedResponse,
  };
};

export default {
  sanitizeChatText,
  clampChatResponse,
  validateModelResponse,
};
