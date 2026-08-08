export const FEEDBACK_STATUS = {
  NEW: 'NEW',
  IN_REVIEW: 'IN_REVIEW',
  INVESTIGATING: 'INVESTIGATING',
  WAITING_FOR_INFORMATION: 'WAITING_FOR_INFORMATION',
  ACTION_REQUIRED: 'ACTION_REQUIRED',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  REOPENED: 'REOPENED',
  PENDING: 'NEW',
  IN_PROGRESS: 'INVESTIGATING',
  WAITING_FOR_PASSENGER: 'WAITING_FOR_INFORMATION',
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
  CHANGE_PRIORITY: 'CHANGE_PRIORITY',
  START_PROCESSING: 'START_PROCESSING',
  PUBLIC_REPLY: 'PUBLIC_REPLY',
  INTERNAL_NOTE: 'INTERNAL_NOTE',
  CORRECTIVE_ACTION: 'CORRECTIVE_ACTION',
  REQUEST_CUSTOMER_INFO: 'REQUEST_CUSTOMER_INFO',
  CUSTOMER_REPLY: 'CUSTOMER_REPLY',
  RESOLVE: 'RESOLVE',
  CLOSE: 'CLOSE',
  REOPEN: 'REOPEN',
  NOTIFY_PASSENGER: 'NOTIFY_PASSENGER',
};

export const SUPPORT_CASE_STATUS_ALIASES = {
  PENDING: FEEDBACK_STATUS.NEW,
  SUBMITTED: FEEDBACK_STATUS.NEW,
  OPEN: FEEDBACK_STATUS.NEW,
  UNDER_REVIEW: FEEDBACK_STATUS.IN_REVIEW,
  IN_PROGRESS: FEEDBACK_STATUS.INVESTIGATING,
  RESPONDED: FEEDBACK_STATUS.INVESTIGATING,
  WAITING_FOR_PASSENGER: FEEDBACK_STATUS.WAITING_FOR_INFORMATION,
};

const allowedTransitions = {
  [FEEDBACK_STATUS.NEW]: [
    FEEDBACK_STATUS.IN_REVIEW,
  ],
  [FEEDBACK_STATUS.IN_REVIEW]: [
    FEEDBACK_STATUS.INVESTIGATING,
  ],
  [FEEDBACK_STATUS.INVESTIGATING]: [
    FEEDBACK_STATUS.WAITING_FOR_INFORMATION,
    FEEDBACK_STATUS.ACTION_REQUIRED,
    FEEDBACK_STATUS.RESOLVED,
  ],
  [FEEDBACK_STATUS.WAITING_FOR_INFORMATION]: [
    FEEDBACK_STATUS.INVESTIGATING,
    FEEDBACK_STATUS.CLOSED,
  ],
  [FEEDBACK_STATUS.ACTION_REQUIRED]: [
    FEEDBACK_STATUS.INVESTIGATING,
    FEEDBACK_STATUS.RESOLVED,
  ],
  [FEEDBACK_STATUS.RESOLVED]: [
    FEEDBACK_STATUS.CLOSED,
    FEEDBACK_STATUS.REOPENED,
  ],
  [FEEDBACK_STATUS.REOPENED]: [
    FEEDBACK_STATUS.IN_REVIEW,
    FEEDBACK_STATUS.INVESTIGATING,
  ],
  [FEEDBACK_STATUS.CLOSED]: [],
};

export const normalizeFeedbackStatus = (status) => (
  SUPPORT_CASE_STATUS_ALIASES[status] || status || FEEDBACK_STATUS.PENDING
);

export const isTerminalFeedbackStatus = (status) => (
  [FEEDBACK_STATUS.CLOSED].includes(normalizeFeedbackStatus(status))
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

  if (hasMessage && next === FEEDBACK_STATUS.WAITING_FOR_INFORMATION) {
    return FEEDBACK_ACTION.REQUEST_CUSTOMER_INFO;
  }

  if (hasMessage) {
    return FEEDBACK_ACTION.PUBLIC_REPLY;
  }

  if (previous === FEEDBACK_STATUS.NEW && next === FEEDBACK_STATUS.IN_REVIEW) {
    return FEEDBACK_ACTION.START_PROCESSING;
  }

  if (next === FEEDBACK_STATUS.RESOLVED) {
    return FEEDBACK_ACTION.RESOLVE;
  }

  if (next === FEEDBACK_STATUS.CLOSED) {
    return FEEDBACK_ACTION.CLOSE;
  }

  if (next === FEEDBACK_STATUS.REOPENED) {
    return FEEDBACK_ACTION.REOPEN;
  }

  return 'STATUS_CHANGE';
};

export const getReplyStatusForAdminAction = ({ nextStatus, hasMessage, currentReplyStatus }) => {
  if (nextStatus === FEEDBACK_STATUS.WAITING_FOR_INFORMATION) {
    return FEEDBACK_REPLY_STATUS.WAITING_FOR_PASSENGER;
  }

  if (hasMessage) {
    return FEEDBACK_REPLY_STATUS.REPLIED;
  }

  return currentReplyStatus || FEEDBACK_REPLY_STATUS.UNREPLIED;
};
