const DEFAULT_CHANNELS = Object.freeze({
  inApp: true,
  email: false,
  push: false,
});

export const NOTIFICATION_CHANNEL_POLICY = Object.freeze({
  TICKET_PURCHASED: { inApp: true, email: true, push: false },
  PAYMENT_SUCCESS: { inApp: true, email: true, push: false },
  TICKET_EXPIRING: { inApp: true, email: true, push: false },
  MONTHLY_PASS_EXPIRING: { inApp: true, email: true, push: false },
  INCIDENT_ALERT: { inApp: true, email: true, push: false },
  TRIP_DELAYED: { inApp: true, email: true, push: false },
  TRIP_CANCELLED: { inApp: true, email: true, push: false },
  FEEDBACK_RESPONSE: { inApp: true, email: true, push: false },
  VEHICLE_REASSIGNED: { inApp: true, email: true, push: false },
  BUS_APPROACHING: { inApp: true, email: false, push: false },
  ETA_UPDATE: { inApp: true, email: false, push: false },
  PROMOTION: { inApp: true, email: false, push: false },
});

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

export const getDefaultChannelsForNotificationType = (notificationType) => (
  NOTIFICATION_CHANNEL_POLICY[String(notificationType || '').trim().toUpperCase()] || DEFAULT_CHANNELS
);

export const resolveNotificationChannels = (notificationType, requestedChannels = {}) => {
  const defaults = getDefaultChannelsForNotificationType(notificationType);

  return {
    inApp: hasOwn(requestedChannels, 'inApp') ? requestedChannels.inApp !== false : defaults.inApp,
    email: hasOwn(requestedChannels, 'email') ? requestedChannels.email === true : defaults.email,
    push: hasOwn(requestedChannels, 'push') ? requestedChannels.push === true : defaults.push,
  };
};

export default {
  NOTIFICATION_CHANNEL_POLICY,
  getDefaultChannelsForNotificationType,
  resolveNotificationChannels,
};
