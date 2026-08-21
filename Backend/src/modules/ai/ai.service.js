import { HTTP_STATUS } from '../../constants/index.js';
import axios from 'axios';
import { config } from '../../config/environment.js';
import { CustomError } from '../../middleware/errorHandler.js';
import logger from '../../utils/logger.js';
import CustomerSupportService from '../customerSupport/CustomerSupportService.js';
import RouteService from '../routes/RouteService.js';
import TicketService from '../tickets/TicketService.js';
import { searchKnowledgeBase } from './knowledge/chatKnowledge.js';
import { CHAT_INTENTS, detectChatIntent } from './policies/chatIntents.js';
import {
  CHAT_REFUSAL as POLICY_CHAT_REFUSAL,
  CHAT_SYSTEM_PROMPT as POLICY_CHAT_SYSTEM_PROMPT,
  RESPONSE_SOURCES,
  SAFE_DATA_FALLBACK,
  evaluateChatPolicy,
} from './policies/chatPolicy.js';
import {
  clampChatResponse,
  sanitizeChatText as sanitizeChatInput,
  validateModelResponse,
} from './policies/chatModeration.js';

const CHAT_HISTORY_LIMIT = 12;
const GEMINI_DEFAULT_MODEL = 'gemini-flash-latest';
const GEMINI_FALLBACK_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
];

const normalizeGeminiModel = (model) => String(model || GEMINI_DEFAULT_MODEL)
  .trim()
  .replace(/^models\//, '')
  .replace(/lastest/gi, 'latest');

const getGeminiModelCandidates = () => {
  const configuredModel = normalizeGeminiModel(config.gemini.model);
  return [...new Set([configuredModel, ...GEMINI_FALLBACK_MODELS.map(normalizeGeminiModel)])];
};

const normalizeChatMessages = (messages = []) => messages
  .slice(-CHAT_HISTORY_LIMIT)
  .map((message) => ({
    role: message.role === 'model' ? 'model' : 'user',
    parts: [{ text: sanitizeChatInput(message.text) }],
  }))
  .filter((message) => message.parts[0].text);

const extractGeminiText = (responseData = {}) => (
  responseData.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter(Boolean)
    .join('\n')
    .trim()
);

const isRetryableGeminiError = (error) => {
  const status = error.response?.status;
  const message = String(error.response?.data?.error?.message || error.message || '');

  return status === 429
    || status >= 500
    || /high demand|overloaded|temporarily|timeout|deadline|unavailable|no longer available/i.test(message);
};

const createGeminiPayload = (messages, verifiedContext = '') => ({
  systemInstruction: {
    parts: [{
      text: verifiedContext
        ? `${POLICY_CHAT_SYSTEM_PROMPT}\n\nVerified BusDN context:\n${verifiedContext}`
        : POLICY_CHAT_SYSTEM_PROMPT,
    }],
  },
  contents: normalizeChatMessages(messages),
  generationConfig: {
    temperature: 0.25,
    topP: 0.8,
    maxOutputTokens: 700,
  },
});

const escapeRegexText = (value) => String(value || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toStringOrEmpty = (value) => (value === undefined || value === null ? '' : String(value));

const sanitizeCoordinate = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const sanitizeStop = (stop = {}) => ({
  stopId: stop.stopId ? String(stop.stopId) : undefined,
  name: stop.name || stop.stopName || '',
  order: stop.order ?? stop.stopOrder ?? null,
  estimatedOffsetMinutes: stop.estimatedOffsetMinutes ?? stop.arrivalOffsetMinutes ?? null,
  latitude: sanitizeCoordinate(stop.latitude ?? stop.lat),
  longitude: sanitizeCoordinate(stop.longitude ?? stop.lng),
});

const sanitizeStops = (stops = []) => (
  Array.isArray(stops) ? stops.map(sanitizeStop) : []
);

const sanitizeRoute = (route = {}) => {
  const routeId = route.id || route._id || route.routeId || route.routeNumber;

  return {
    routeId: routeId ? String(routeId) : '',
    routeNumber: route.routeNumber || route.routeCode || '',
    routeName: route.name || route.routeName || '',
    origin: route.origin || '',
    destination: route.destination || '',
    stops: sanitizeStops(route.stops),
    directions: route.directions ? {
      OUTBOUND: {
        label: route.directions.OUTBOUND?.label || 'Outbound',
        stops: sanitizeStops(route.directions.OUTBOUND?.stops),
      },
      INBOUND: {
        label: route.directions.INBOUND?.label || 'Inbound',
        stops: sanitizeStops(route.directions.INBOUND?.stops),
      },
    } : undefined,
    distanceKm: Number(route.distanceKm || 0),
    estimatedDurationMinutes: Number(route.estimatedDurationMinutes || 0),
    fare: Number(route.fare || 0),
    operatingHours: route.operatingHours ? {
      firstDeparture: route.operatingHours.firstDeparture || '',
      lastDeparture: route.operatingHours.lastDeparture || '',
      frequencyMinutes: Number(route.operatingHours.frequencyMinutes || 0),
    } : undefined,
    pathPoints: Array.isArray(route.pathPoints)
      ? route.pathPoints.map((point) => ({
        latitude: sanitizeCoordinate(point.latitude ?? point.lat),
        longitude: sanitizeCoordinate(point.longitude ?? point.lng),
      })).filter((point) => point.latitude !== null && point.longitude !== null)
      : [],
    status: route.status || '',
  };
};

const sanitizeRouteSummary = (route = {}) => ({
  routeId: route.id || route._id || route.routeId || route.routeNumber
    ? String(route.id || route._id || route.routeId || route.routeNumber)
    : '',
  routeNumber: route.routeNumber || route.routeCode || '',
  routeName: route.name || route.routeName || '',
  origin: route.origin || '',
  destination: route.destination || '',
  distanceKm: Number(route.distanceKm || 0),
  estimatedDurationMinutes: Number(route.estimatedDurationMinutes || 0),
  fare: Number(route.fare || 0),
});

const sanitizeNearbyStop = (stop = {}) => ({
  name: stop.name || stop.stopName || '',
  order: stop.order ?? stop.stopOrder ?? null,
  latitude: sanitizeCoordinate(stop.latitude ?? stop.lat),
  longitude: sanitizeCoordinate(stop.longitude ?? stop.lng),
  distanceKm: Number(stop.distanceKm || 0),
  route: sanitizeRouteSummary(stop.route),
});

const sanitizeRouteOption = (option = {}) => ({
  route: sanitizeRoute(option.route),
  startStop: option.startStop ? sanitizeStop(option.startStop) : null,
  endStop: option.endStop ? sanitizeStop(option.endStop) : null,
  estimatedDurationMinutes: Number(option.estimatedDurationMinutes || 0),
  estimatedDistanceKm: Number(option.estimatedDistanceKm || 0),
  estimatedFare: Number(option.estimatedFare || 0),
  isRecommended: Boolean(option.isRecommended),
});

const sanitizeStopEta = (eta = {}) => ({
  stopId: eta.stopId ? String(eta.stopId) : undefined,
  stopName: eta.stopName || '',
  stopOrder: eta.stopOrder ?? null,
  etaMinutes: eta.etaMinutes ?? null,
  estimatedArrivalTime: eta.estimatedArrivalTime || '',
  status: eta.status || '',
});

const sanitizeTripProgressStop = (stop = {}) => ({
  stopId: stop.stopId ? String(stop.stopId) : undefined,
  stopName: stop.stopName || '',
  stopOrder: stop.stopOrder ?? null,
});

const sanitizeTripProgress = (progress = {}) => ({
  progressPercent: Number(progress.progressPercent || 0),
  currentStop: progress.currentStop || '',
  currentStopIndex: progress.currentStopIndex ?? null,
  nextStop: progress.nextStop || '',
  totalStops: progress.totalStops ?? null,
  estimatedRemainingTime: progress.estimatedRemainingTime || '',
  completedStops: Array.isArray(progress.completedStops)
    ? progress.completedStops.map(sanitizeTripProgressStop)
    : [],
  remainingStops: Array.isArray(progress.remainingStops)
    ? progress.remainingStops.map(sanitizeTripProgressStop)
    : [],
  tripStatus: progress.tripStatus || '',
});

const sanitizeLocation = (location = {}) => {
  const latitude = sanitizeCoordinate(location.latitude ?? location.lat);
  const longitude = sanitizeCoordinate(location.longitude ?? location.lng);

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    latitude,
    longitude,
    heading: location.heading ?? null,
  };
};

const sanitizePublicBus = (bus = {}, index = 0) => ({
  publicBusId: `${bus.routeNumber || 'route'}-bus-${index + 1}`,
  routeNumber: bus.routeNumber || '',
  currentLocation: sanitizeLocation(bus.currentLocation),
  nextStop: bus.nextStop || '',
  estimatedArrivalTime: bus.estimatedArrivalTime || '',
  operationalStatus: bus.status || '',
  delay: bus.delay ? {
    delayDurationMinutes: Number(bus.delay.delayDurationMinutes || 0),
    delayReason: bus.delay.delayReason || '',
    updatedEta: bus.delay.updatedEta || '',
  } : null,
  lastUpdated: bus.lastUpdated || null,
});

const sanitizeRouteChange = (routeChange) => {
  if (!routeChange) {
    return null;
  }

  return {
    changeId: routeChange.changeId || '',
    routeId: routeChange.routeId || '',
    routeNumber: routeChange.routeNumber || '',
    reasonForChange: routeChange.reasonForChange || '',
    changedStops: Array.isArray(routeChange.changedStops)
      ? routeChange.changedStops.map((stop) => ({
        stopName: stop.stopName || '',
        changeType: stop.changeType || '',
      }))
      : [],
    updatedRoutePath: routeChange.updatedRoutePath || '',
    alternativeSuggestion: routeChange.alternativeSuggestion || '',
    status: routeChange.status || '',
    detectedAt: routeChange.detectedAt || null,
  };
};

const toRouteNotFound = (error) => {
  if (error.message === 'Bus not found') {
    return new CustomError('Route not found', HTTP_STATUS.NOT_FOUND);
  }
  return error;
};

const redactSensitiveText = (value) => String(value || '')
  .replace(/(api[_-]?key|token|password|secret)\s*[:=]\s*\S+/gi, '$1=[REDACTED]')
  .slice(0, 2000);

const logChatInteraction = ({
  userMessage,
  botResponse,
  intent,
  source,
  model = null,
  success = true,
  error = null,
}) => {
  logger.info('AI chatbot interaction', {
    userMessage: redactSensitiveText(userMessage),
    botResponse: redactSensitiveText(botResponse),
    intent,
    source,
    model,
    success,
    error: error ? {
      message: redactSensitiveText(error.message || error),
      statusCode: error.statusCode || error.response?.status || null,
    } : null,
    timestamp: new Date().toISOString(),
  });
};

const buildChatResult = (reply, {
  intentResult,
  source,
  controlled = true,
  model = null,
  data = null,
} = {}) => ({
  reply: clampChatResponse(reply),
  controlled,
  source,
  intent: intentResult?.intent || CHAT_INTENTS.UNKNOWN,
  confidence: intentResult?.confidence || 0,
  requiresBackendData: Boolean(intentResult?.requiresBackendData),
  requiresAuthentication: Boolean(intentResult?.requiresAuthentication),
  ...(model ? { model } : {}),
  ...(data ? { data } : {}),
});

const formatRouteSummaryLine = (route = {}) => {
  const number = route.routeNumber || route.routeCode || route.routeId || 'N/A';
  const name = route.routeName || route.name || '';
  const endpoints = [route.origin, route.destination].filter(Boolean).join(' - ');
  const fare = route.fare ? `, giá vé tham khảo từ dữ liệu tuyến: ${Number(route.fare).toLocaleString('vi-VN')} VND` : '';
  return `- Tuyến ${number}${name ? ` (${name})` : ''}${endpoints ? `: ${endpoints}` : ''}${fare}`;
};

const summarizeRouteSearch = (result = {}) => {
  const routes = result.routes || [];
  if (!routes.length) return SAFE_DATA_FALLBACK;

  return [
    `Mình tìm thấy ${routes.length} tuyến BusDN phù hợp:`,
    ...routes.slice(0, 5).map(formatRouteSummaryLine),
    routes.length > 5 ? 'Bạn có thể nhập cụ thể hơn điểm đi/điểm đến để lọc kết quả.' : '',
  ].filter(Boolean).join('\n');
};

const summarizeRouteSuggestions = (result = {}) => {
  const suggestions = result.suggestions || [];
  if (!suggestions.length) return SAFE_DATA_FALLBACK;

  return [
    `Gợi ý tuyến từ ${result.departureLocation || 'điểm đi'} đến ${result.destinationLocation || 'điểm đến'}:`,
    ...suggestions.slice(0, 3).map((option, index) => {
      const route = option.route || {};
      const number = route.routeNumber || route.routeId || `#${index + 1}`;
      const fare = option.estimatedFare ? `, giá ước tính ${Number(option.estimatedFare).toLocaleString('vi-VN')} VND` : '';
      const duration = option.estimatedDurationMinutes ? `, khoảng ${option.estimatedDurationMinutes} phút` : '';
      return `- Tuyến ${number}${duration}${fare}`;
    }),
  ].join('\n');
};

const summarizeEta = (result = {}) => {
  const routeNumber = result.route?.routeNumber || result.route?.routeId || '';
  const stops = result.stopEtaSummary || [];
  if (!stops.length) return SAFE_DATA_FALLBACK;

  return [
    `ETA hiện có cho tuyến ${routeNumber}:`,
    ...stops.slice(0, 5).map((stop) => (
      `- ${stop.stopName || 'Điểm dừng'}: ${stop.estimatedArrivalTime || `${stop.etaMinutes ?? 'N/A'} phút`}`
    )),
    result.refreshedAt ? `Cập nhật: ${result.refreshedAt}` : '',
  ].filter(Boolean).join('\n');
};

const summarizeLiveRoute = (result = {}) => {
  const routeNumber = result.route?.routeNumber || result.route?.routeId || '';
  const buses = result.buses || [];
  if (!buses.length) return SAFE_DATA_FALLBACK;

  return [
    `Dữ liệu xe đang hoạt động cho tuyến ${routeNumber}:`,
    ...buses.slice(0, 5).map((bus) => {
      const status = bus.operationalStatus ? `, trạng thái ${bus.operationalStatus}` : '';
      const nextStop = bus.nextStop ? `, điểm tiếp theo ${bus.nextStop}` : '';
      const eta = bus.estimatedArrivalTime ? `, ETA ${bus.estimatedArrivalTime}` : '';
      return `- ${bus.publicBusId}${nextStop}${eta}${status}`;
    }),
    result.refreshedAt ? `Cập nhật: ${result.refreshedAt}` : '',
  ].filter(Boolean).join('\n');
};

const summarizeTickets = (tickets = []) => {
  if (!tickets.length) return 'Mình không tìm thấy vé nào trong tài khoản hiện tại.';

  return [
    `Bạn hiện có ${tickets.length} vé trong tài khoản:`,
    ...tickets.slice(0, 5).map((ticket) => (
      `- ${ticket.ticketCode || ticket._id}: ${ticket.routeCode || ticket.routeNumber || 'tuyến chưa rõ'}, trạng thái ${ticket.ticketStatus || ticket.status || 'N/A'}`
    )),
  ].join('\n');
};

const summarizeCases = (cases = [], emptyMessage) => {
  if (!cases.length) return emptyMessage;

  return [
    `Mình tìm thấy ${cases.length} hồ sơ:`,
    ...cases.slice(0, 5).map((item) => (
      `- ${item.referenceNumber || item._id}: ${item.title || item.category || 'Hồ sơ'}, trạng thái ${item.status || 'N/A'}`
    )),
  ].join('\n');
};

const routeSearchQueryFromText = (text) => {
  const routeMatch = String(text || '').match(/(?:tuyến|tuyen|route)\s+([A-Za-z0-9_-]{1,16})/i);
  return routeMatch?.[1] || text;
};

const resolveBackendDataResponse = async (intentResult, latestUserMessage, user) => {
  const userId = user?.userId;

  if (intentResult.requiresAuthentication && !userId && intentResult.intent !== CHAT_INTENTS.TICKET_PURCHASE) {
    return {
      reply: 'Bạn cần đăng nhập để mình có thể tra cứu dữ liệu cá nhân như vé, phản hồi hoặc hồ sơ thất lạc. Mình sẽ không giả vờ đã thực hiện thao tác khi chưa có xác thực.',
      source: RESPONSE_SOURCES.RULE,
      data: null,
    };
  }

  switch (intentResult.intent) {
    case CHAT_INTENTS.ROUTE_SUGGESTION: {
      const { from, to } = intentResult.entities || {};
      if (!from || !to) {
        return {
          reply: 'Bạn vui lòng gửi rõ điểm đi và điểm đến, ví dụ: "tìm tuyến từ A đến B".',
          source: RESPONSE_SOURCES.RULE,
        };
      }
      const result = await RouteService.suggestRouteOptions({ from, to, preference: 'fastest' });
      const sanitized = {
        ...result,
        departureLocation: from,
        destinationLocation: to,
        suggestions: (result.suggestions || []).map(sanitizeRouteOption),
      };
      return {
        reply: summarizeRouteSuggestions(sanitized),
        source: RESPONSE_SOURCES.BACKEND_DATA,
        data: sanitized,
      };
    }

    case CHAT_INTENTS.ROUTE_SEARCH: {
      const result = await RouteService.searchRoutes({
        q: escapeRegexText(routeSearchQueryFromText(latestUserMessage)),
      });
      const sanitized = { routes: result.map(sanitizeRoute), count: result.length };
      return {
        reply: summarizeRouteSearch(sanitized),
        source: RESPONSE_SOURCES.BACKEND_DATA,
        data: sanitized,
      };
    }

    case CHAT_INTENTS.ROUTE_ETA: {
      const routeId = intentResult.entities?.routeId;
      if (!routeId) return { reply: SAFE_DATA_FALLBACK, source: RESPONSE_SOURCES.FALLBACK };
      const result = await RouteService.getEstimatedArrivalTimes(routeId);
      const sanitized = {
        route: sanitizeRouteSummary(result.route),
        stopEtaSummary: (result.stopEtaSummary || []).map(sanitizeStopEta),
        tripProgress: (result.tripProgress || []).filter(Boolean).map(sanitizeTripProgress),
        refreshedAt: result.refreshedAt,
      };
      return {
        reply: summarizeEta(sanitized),
        source: RESPONSE_SOURCES.BACKEND_DATA,
        data: sanitized,
      };
    }

    case CHAT_INTENTS.ROUTE_LIVE: {
      const routeId = intentResult.entities?.routeId;
      if (!routeId) return { reply: SAFE_DATA_FALLBACK, source: RESPONSE_SOURCES.FALLBACK };
      const result = await RouteService.getLiveBusLocations(routeId);
      const sanitized = {
        route: sanitizeRouteSummary(result.route),
        buses: (result.buses || []).map(sanitizePublicBus),
        routeChange: sanitizeRouteChange(result.routeChange),
        refreshedAt: result.refreshedAt,
      };
      return {
        reply: summarizeLiveRoute(sanitized),
        source: RESPONSE_SOURCES.BACKEND_DATA,
        data: sanitized,
      };
    }

    case CHAT_INTENTS.TICKET_LOOKUP: {
      const tickets = await TicketService.listMyTickets(userId);
      return {
        reply: summarizeTickets(tickets),
        source: RESPONSE_SOURCES.BACKEND_DATA,
        data: { count: tickets.length },
      };
    }

    case CHAT_INTENTS.LOST_ITEM: {
      if (intentResult.requiresBackendData) {
        const cases = await CustomerSupportService.listMyLostItemCases(userId);
        return {
          reply: summarizeCases(cases, 'Mình không tìm thấy hồ sơ thất lạc nào trong tài khoản hiện tại.'),
          source: RESPONSE_SOURCES.BACKEND_DATA,
          data: { count: cases.length },
        };
      }
      break;
    }

    case CHAT_INTENTS.FEEDBACK: {
      if (intentResult.requiresBackendData) {
        const result = await CustomerSupportService.listMyFeedback(userId, { limit: 5 });
        const items = result.items || [];
        return {
          reply: summarizeCases(items, 'Mình không tìm thấy phản hồi nào trong tài khoản hiện tại.'),
          source: RESPONSE_SOURCES.BACKEND_DATA,
          data: { count: items.length },
        };
      }
      break;
    }

    case CHAT_INTENTS.NEARBY_ROUTE:
      return {
        reply: 'Để tìm tuyến gần bạn, backend cần tọa độ latitude/longitude. Bạn vui lòng dùng tính năng tìm tuyến gần đây trong ứng dụng hoặc chia sẻ vị trí qua giao diện hỗ trợ.',
        source: RESPONSE_SOURCES.RULE,
      };

    default:
      break;
  }

  return null;
};

const createKnowledgeResponse = (latestUserMessage) => {
  const entries = searchKnowledgeBase(latestUserMessage);
  if (!entries.length) return null;

  return {
    reply: entries.map((entry) => entry.answer).join('\n\n'),
    source: RESPONSE_SOURCES.KNOWLEDGE_BASE,
    data: {
      entries: entries.map(({ id, category }) => ({ id, category })),
    },
  };
};

const createVerifiedContext = (knowledgeResponse, backendResponse) => {
  const parts = [];
  if (backendResponse?.reply) parts.push(`Backend data answer:\n${backendResponse.reply}`);
  if (knowledgeResponse?.reply) parts.push(`Knowledge base answer:\n${knowledgeResponse.reply}`);
  return parts.join('\n\n');
};

export class AiService {
  static async chat(payload = {}, context = {}) {
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    const latestUserMessage = sanitizeChatInput(messages[messages.length - 1]?.text);
    const intentResult = detectChatIntent(latestUserMessage);
    const policyResult = evaluateChatPolicy(latestUserMessage);

    if (!policyResult.allowed || [
      CHAT_INTENTS.OUT_OF_SCOPE,
      CHAT_INTENTS.PROMPT_INJECTION,
    ].includes(intentResult.intent)) {
      const reply = policyResult.response || POLICY_CHAT_REFUSAL;
      const result = buildChatResult(reply, {
        intentResult,
        source: RESPONSE_SOURCES.RULE,
        controlled: true,
      });
      logChatInteraction({
        userMessage: latestUserMessage,
        botResponse: result.reply,
        intent: result.intent,
        source: result.source,
      });
      return result;
    }

    try {
      const backendResponse = await resolveBackendDataResponse(intentResult, latestUserMessage, context.user);
      if (backendResponse) {
        const result = buildChatResult(backendResponse.reply, {
          intentResult,
          source: backendResponse.source,
          controlled: true,
          data: backendResponse.data,
        });
        logChatInteraction({
          userMessage: latestUserMessage,
          botResponse: result.reply,
          intent: result.intent,
          source: result.source,
        });
        return result;
      }

      const knowledgeResponse = createKnowledgeResponse(latestUserMessage);
      if (knowledgeResponse && [CHAT_INTENTS.FAQ, CHAT_INTENTS.TICKET_PURCHASE, CHAT_INTENTS.LOST_ITEM, CHAT_INTENTS.FEEDBACK].includes(intentResult.intent)) {
        const result = buildChatResult(knowledgeResponse.reply, {
          intentResult,
          source: knowledgeResponse.source,
          controlled: true,
          data: knowledgeResponse.data,
        });
        logChatInteraction({
          userMessage: latestUserMessage,
          botResponse: result.reply,
          intent: result.intent,
          source: result.source,
        });
        return result;
      }

      if (!config.gemini.apiKey) {
        const result = buildChatResult('Chatbot chưa được cấu hình AI key ở backend.', {
          intentResult,
          source: RESPONSE_SOURCES.FALLBACK,
          controlled: true,
        });
        logChatInteraction({
          userMessage: latestUserMessage,
          botResponse: result.reply,
          intent: result.intent,
          source: result.source,
          success: false,
          error: new CustomError('AI chatbot is not configured', HTTP_STATUS.SERVICE_UNAVAILABLE),
        });
        return result;
      }

      const verifiedContext = createVerifiedContext(knowledgeResponse, null);
      const apiBaseUrl = config.gemini.apiBaseUrl.replace(/\/+$/, '');
      const geminiPayload = createGeminiPayload(messages, verifiedContext);
      const requestOptions = {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.gemini.apiKey,
        },
        timeout: config.gemini.requestTimeoutMs,
      };

      let lastError = null;
      for (const model of getGeminiModelCandidates()) {
        try {
          const response = await axios.post(
            `${apiBaseUrl}/models/${model}:generateContent`,
            geminiPayload,
            requestOptions
          );

          const reply = extractGeminiText(response.data);
          const moderation = validateModelResponse(reply, {
            hasVerifiedDynamicData: false,
            actionPerformed: false,
          });
          const result = buildChatResult(moderation.sanitizedResponse, {
            intentResult,
            source: moderation.allowed ? RESPONSE_SOURCES.GEMINI : RESPONSE_SOURCES.FALLBACK,
            controlled: !moderation.allowed,
            model,
          });
          logChatInteraction({
            userMessage: latestUserMessage,
            botResponse: result.reply,
            intent: result.intent,
            source: result.source,
            model,
            success: moderation.allowed,
            error: moderation.allowed ? null : new Error(moderation.reason),
          });
          return result;
        } catch (error) {
          lastError = error;
          if (!isRetryableGeminiError(error)) {
            throw error;
          }
        }
      }

      throw lastError;
    } catch (error) {
      const reply = isRetryableGeminiError(error)
        ? 'Dịch vụ AI đang bận. Bạn thử lại sau ít phút, hoặc hỏi các nội dung cơ bản như mua vé, tìm tuyến, phản hồi, thất lạc đồ.'
        : SAFE_DATA_FALLBACK;
      const result = buildChatResult(reply, {
        intentResult,
        source: RESPONSE_SOURCES.FALLBACK,
        controlled: true,
      });
      logChatInteraction({
        userMessage: latestUserMessage,
        botResponse: result.reply,
        intent: result.intent,
        source: result.source,
        success: false,
        error,
      });
      return result;
    }
  }

  static async searchRoutes(query = {}) {
    const params = {
      q: escapeRegexText(query.q),
      from: escapeRegexText(query.from),
      to: escapeRegexText(query.to),
    };
    const routes = await RouteService.searchRoutes(params);

    return {
      routes: routes.map(sanitizeRoute),
      count: routes.length,
      filters: {
        q: toStringOrEmpty(query.q).trim(),
        from: toStringOrEmpty(query.from).trim(),
        to: toStringOrEmpty(query.to).trim(),
      },
    };
  }

  static async suggestRoutes(query = {}) {
    const result = await RouteService.suggestRouteOptions({
      from: escapeRegexText(query.from),
      to: escapeRegexText(query.to),
      preference: query.preference || 'fastest',
    });
    const suggestions = (result.suggestions || []).map(sanitizeRouteOption);

    return {
      departureLocation: toStringOrEmpty(query.from).trim(),
      destinationLocation: toStringOrEmpty(query.to).trim(),
      transportationType: 'bus',
      suggestions,
      count: suggestions.length,
      totalMatches: result.totalMatches || result.count || 0,
      bestRoute: result.bestRoute ? sanitizeRouteOption({ ...result.bestRoute, isRecommended: true }) : null,
      alternatives: (result.alternatives || []).map((item) => sanitizeRouteOption({
        ...item,
        isRecommended: false,
      })),
      criteria: result.criteria ? {
        from: toStringOrEmpty(query.from).trim(),
        to: toStringOrEmpty(query.to).trim(),
        preference: result.criteria.preference,
        optimizedBy: result.criteria.optimizedBy,
      } : null,
    };
  }

  static async findNearbyRoutes(query = {}) {
    const result = await RouteService.findNearbyRoutes({
      latitude: query.latitude,
      longitude: query.longitude,
      radiusKm: query.radiusKm || 5,
    });

    return {
      userLocation: result.userLocation,
      radiusKm: result.radiusKm,
      nearbyStops: (result.nearbyStops || []).map(sanitizeNearbyStop),
      routes: (result.routes || []).map(sanitizeRoute),
      count: result.routes?.length || 0,
    };
  }

  static async getLiveRoute(routeId) {
    try {
      const result = await RouteService.getLiveBusLocations(routeId);

      return {
        route: sanitizeRouteSummary(result.route),
        buses: (result.buses || []).map(sanitizePublicBus),
        routeChange: sanitizeRouteChange(result.routeChange),
        count: result.buses?.length || 0,
        refreshedAt: result.refreshedAt,
      };
    } catch (error) {
      throw toRouteNotFound(error);
    }
  }

  static async getRouteEta(routeId) {
    try {
      const result = await RouteService.getEstimatedArrivalTimes(routeId);
      const tripProgress = (result.tripProgress || [])
        .filter(Boolean)
        .map(sanitizeTripProgress);

      return {
        route: sanitizeRouteSummary(result.route),
        stopEtaSummary: (result.stopEtaSummary || []).map(sanitizeStopEta),
        tripProgress,
        refreshedAt: result.refreshedAt,
      };
    } catch (error) {
      throw toRouteNotFound(error);
    }
  }
}

export default AiService;
