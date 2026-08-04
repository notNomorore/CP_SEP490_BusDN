export const FEEDBACK_STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_FOR_PASSENGER: 'WAITING_FOR_PASSENGER',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
  CLOSED: 'CLOSED',
};

export const FEEDBACK_REPLY_STATUS = {
  UNREPLIED: 'UNREPLIED',
  REPLIED: 'REPLIED',
  WAITING_FOR_PASSENGER: 'WAITING_FOR_PASSENGER',
  CUSTOMER_REPLIED: 'CUSTOMER_REPLIED',
};

export const FEEDBACK_ACTION = {
  CREATE: 'CREATE',
  ASSIGN: 'ASSIGN',
  START_PROCESSING: 'START_PROCESSING',
  PUBLIC_REPLY: 'PUBLIC_REPLY',
  REQUEST_CUSTOMER_INFO: 'REQUEST_CUSTOMER_INFO',
  CUSTOMER_REPLY: 'CUSTOMER_REPLY',
  RESOLVE: 'RESOLVE',
  REJECT: 'REJECT',
  CLOSE: 'CLOSE',
};

export const SUPPORT_CASE_STATUS_ALIASES = {
  SUBMITTED: FEEDBACK_STATUS.PENDING,
  OPEN: FEEDBACK_STATUS.PENDING,
  UNDER_REVIEW: FEEDBACK_STATUS.IN_PROGRESS,
  RESPONDED: FEEDBACK_STATUS.IN_PROGRESS,
};

const allowedTransitions = {
  [FEEDBACK_STATUS.PENDING]: [
    FEEDBACK_STATUS.IN_PROGRESS,
    FEEDBACK_STATUS.REJECTED,
  ],
  [FEEDBACK_STATUS.IN_PROGRESS]: [
    FEEDBACK_STATUS.WAITING_FOR_PASSENGER,
    FEEDBACK_STATUS.RESOLVED,
    FEEDBACK_STATUS.REJECTED,
  ],
  [FEEDBACK_STATUS.WAITING_FOR_PASSENGER]: [
    FEEDBACK_STATUS.IN_PROGRESS,
  ],
  [FEEDBACK_STATUS.RESOLVED]: [
    FEEDBACK_STATUS.CLOSED,
  ],
  [FEEDBACK_STATUS.REJECTED]: [
    FEEDBACK_STATUS.CLOSED,
  ],
  [FEEDBACK_STATUS.CLOSED]: [],
};

export const normalizeFeedbackStatus = (status) => (
  SUPPORT_CASE_STATUS_ALIASES[status] || status || FEEDBACK_STATUS.PENDING
);

export const isTerminalFeedbackStatus = (status) => (
  [FEEDBACK_STATUS.CLOSED, FEEDBACK_STATUS.REJECTED].includes(normalizeFeedbackStatus(status))
);

export const createBusinessError = (message, statusCode = 422) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const assertFeedbackTransition = (currentStatus, nextStatus) => {
  const current = normalizeFeedbackStatus(currentStatus);
  const next = normalizeFeedbackStatus(nextStatus);

  if (current === next) {
    return next;
  }

  if (!allowedTransitions[current]?.includes(next)) {
    throw createBusinessError(`Invalid feedback status transition from ${current} to ${next}`, 409);
  }

  return next;
};

export const resolveFeedbackAction = ({ previousStatus, nextStatus, hasMessage }) => {
  const previous = normalizeFeedbackStatus(previousStatus);
  const next = normalizeFeedbackStatus(nextStatus);

  if (hasMessage && next === FEEDBACK_STATUS.WAITING_FOR_PASSENGER) {
    return FEEDBACK_ACTION.REQUEST_CUSTOMER_INFO;
  }

  if (hasMessage) {
    return FEEDBACK_ACTION.PUBLIC_REPLY;
  }

  if (previous === FEEDBACK_STATUS.PENDING && next === FEEDBACK_STATUS.IN_PROGRESS) {
    return FEEDBACK_ACTION.START_PROCESSING;
  }

  if (next === FEEDBACK_STATUS.RESOLVED) {
    return FEEDBACK_ACTION.RESOLVE;
  }

  if (next === FEEDBACK_STATUS.REJECTED) {
    return FEEDBACK_ACTION.REJECT;
  }

  if (next === FEEDBACK_STATUS.CLOSED) {
    return FEEDBACK_ACTION.CLOSE;
  }

  return 'STATUS_CHANGE';
};

export const getReplyStatusForAdminAction = ({ nextStatus, hasMessage, currentReplyStatus }) => {
  if (nextStatus === FEEDBACK_STATUS.WAITING_FOR_PASSENGER) {
    return FEEDBACK_REPLY_STATUS.WAITING_FOR_PASSENGER;
  }

  if (hasMessage) {
    return FEEDBACK_REPLY_STATUS.REPLIED;
  }

  return currentReplyStatus || FEEDBACK_REPLY_STATUS.UNREPLIED;
};
