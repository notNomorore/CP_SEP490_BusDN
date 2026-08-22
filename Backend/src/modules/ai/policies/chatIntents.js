import { isPromptInjection, normalizeForPolicy } from './chatPolicy.js';

export const CHAT_INTENTS = {
  ROUTE_SEARCH: 'ROUTE_SEARCH',
  ROUTE_SUGGESTION: 'ROUTE_SUGGESTION',
  NEARBY_ROUTE: 'NEARBY_ROUTE',
  ROUTE_ETA: 'ROUTE_ETA',
  ROUTE_LIVE: 'ROUTE_LIVE',
  TICKET_PURCHASE: 'TICKET_PURCHASE',
  TICKET_LOOKUP: 'TICKET_LOOKUP',
  LOST_ITEM: 'LOST_ITEM',
  FEEDBACK: 'FEEDBACK',
  FAQ: 'FAQ',
  OUT_OF_SCOPE: 'OUT_OF_SCOPE',
  PROMPT_INJECTION: 'PROMPT_INJECTION',
  UNKNOWN: 'UNKNOWN',
};

const routeNumberPatterns = [
  /(?:tuyen|route|xe tuyen)\s*([a-z0-9_-]{1,16})/i,
  /\b(dn\d{1,3}|\d{1,3})\b/i,
];

const extractRouteId = (text) => {
  const normalized = normalizeForPolicy(text);
  for (const pattern of routeNumberPatterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) return match[1].toUpperCase();
  }
  return '';
};

const extractRouteSuggestion = (text) => {
  const normalized = normalizeForPolicy(text);
  const match = normalized.match(/(?:tu|from)\s+(.+?)\s+(?:den|toi|to)\s+(.+)$/i);
  if (!match) return {};

  return {
    from: match[1].trim(),
    to: match[2].trim(),
  };
};

const makeResult = (intent, {
  confidence = 0.7,
  requiresBackendData = false,
  requiresAuthentication = false,
  entities = {},
} = {}) => ({
  intent,
  confidence,
  requiresBackendData,
  requiresAuthentication,
  entities,
});

export const detectChatIntent = (text) => {
  const normalized = normalizeForPolicy(text);

  if (/hack|malware|exploit|wifi attack|hack wifi|ddos|phishing|medical advice|legal advice|financial advice|stock advice|crypto advice/i.test(normalized)) {
    return makeResult(CHAT_INTENTS.OUT_OF_SCOPE, { confidence: 0.95 });
  }

  if (isPromptInjection(text)) {
    return makeResult(CHAT_INTENTS.PROMPT_INJECTION, { confidence: 0.99 });
  }

  if (/xem\s*ve|ve cua toi|my ticket|ticket status|lich su ve/i.test(normalized)) {
    return makeResult(CHAT_INTENTS.TICKET_LOOKUP, {
      confidence: 0.92,
      requiresBackendData: true,
      requiresAuthentication: true,
    });
  }

  if (/mua\s*ve|dat\s*ve|buy ticket|purchase ticket|hay mua ve/i.test(normalized)) {
    return makeResult(CHAT_INTENTS.TICKET_PURCHASE, {
      confidence: 0.92,
      requiresBackendData: false,
      requiresAuthentication: true,
    });
  }

  if (/that\s*lac|mat\s*do|lost item|lost property|bao mat do/i.test(normalized)) {
    return makeResult(CHAT_INTENTS.LOST_ITEM, {
      confidence: 0.9,
      requiresBackendData: /trang thai|status|ho so|case|cua toi/i.test(normalized),
      requiresAuthentication: /trang thai|status|ho so|case|cua toi/i.test(normalized),
    });
  }

  if (/phan\s*hoi|feedback|khieu\s*nai|gop y|complaint/i.test(normalized)) {
    return makeResult(CHAT_INTENTS.FEEDBACK, {
      confidence: 0.9,
      requiresBackendData: /trang thai|status|cua toi|my/i.test(normalized),
      requiresAuthentication: /trang thai|status|cua toi|my/i.test(normalized),
    });
  }

  if (/gan day|nearby|quanh day|xung quanh/i.test(normalized)) {
    return makeResult(CHAT_INTENTS.NEARBY_ROUTE, {
      confidence: 0.82,
      requiresBackendData: true,
      entities: {},
    });
  }

  const routeId = extractRouteId(text);
  if (routeId && /(dang o dau|vi tri|live|xe tuyen|where)/i.test(normalized)) {
    return makeResult(CHAT_INTENTS.ROUTE_LIVE, {
      confidence: 0.88,
      requiresBackendData: true,
      entities: { routeId },
    });
  }

  if (routeId && /(eta|khi nao den|gio den|may phut|arrival)/i.test(normalized)) {
    return makeResult(CHAT_INTENTS.ROUTE_ETA, {
      confidence: 0.88,
      requiresBackendData: true,
      entities: { routeId },
    });
  }

  const routeSuggestion = extractRouteSuggestion(text);
  if (routeSuggestion.from && routeSuggestion.to) {
    return makeResult(CHAT_INTENTS.ROUTE_SUGGESTION, {
      confidence: 0.9,
      requiresBackendData: true,
      entities: routeSuggestion,
    });
  }

  if (/tim\s*tuyen|lo\s*trinh|route search|search route|tuyen xe|gia\s*ve/i.test(normalized)) {
    return makeResult(CHAT_INTENTS.ROUTE_SEARCH, {
      confidence: 0.78,
      requiresBackendData: true,
      entities: { q: normalized },
    });
  }

  if (/the thang|monthly pass|quy dinh|huong dan|ho tro|faq|gio hoat dong|service hour/i.test(normalized)) {
    return makeResult(CHAT_INTENTS.FAQ, { confidence: 0.72 });
  }

  return makeResult(CHAT_INTENTS.UNKNOWN, { confidence: 0.4 });
};

export default {
  CHAT_INTENTS,
  detectChatIntent,
};
