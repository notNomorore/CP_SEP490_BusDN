import { beforeEach, describe, expect, it, vi } from 'vitest';

const notificationDocument = {
  _id: 'notification-1',
  title: 'Route delayed',
  message: 'Route 06 is delayed.',
  type: 'delay_alert',
  notificationType: 'TRIP_DELAYED',
  priority: 'high',
  targetAudience: 'passengers',
  targetType: 'ALL_PASSENGERS',
  metadata: {},
  channels: { inApp: true, email: true, push: false },
  recipientUserIds: [],
  deliverySummary: {},
  save: vi.fn(async function save() {
    return this;
  }),
};

const NotificationMock = {
  create: vi.fn(async (payload) => Object.assign(notificationDocument, payload)),
  findOne: vi.fn(async () => null),
  findById: vi.fn(),
};

const OperationNotificationMock = {
  create: vi.fn(),
  findOneAndUpdate: vi.fn(),
  updateMany: vi.fn(),
};

const recipients = [
  {
    _id: 'user-1',
    email: 'passenger@example.com',
    fullName: 'Passenger',
    role: 'PASSENGER',
    preferences: { emailNotifications: true },
  },
];

vi.mock('./Notification.js', () => ({ default: NotificationMock }));
vi.mock('../scheduleOperations/OperationNotification.js', () => ({ default: OperationNotificationMock }));
vi.mock('./notificationRecipientResolver.js', async () => {
  const actual = await vi.importActual('./notificationRecipientResolver.js');
  return {
    ...actual,
    resolveNotificationRecipients: vi.fn(async () => recipients),
  };
});
vi.mock('./dispatchers/websocketNotification.dispatcher.js', () => ({
  default: {
    dispatch: vi.fn(async () => ({ sent: true })),
  },
}));
vi.mock('./dispatchers/emailNotification.dispatcher.js', () => ({
  default: {
    dispatch: vi.fn(async () => ({
      attemptedCount: 1,
      sentCount: 1,
      failedCount: 0,
      results: [{ status: 'SENT' }],
    })),
  },
}));
vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const { default: notificationService } = await import('./notification.service.js');
const { resolveNotificationRecipients } = await import('./notificationRecipientResolver.js');
const { default: WebSocketNotificationDispatcher } = await import('./dispatchers/websocketNotification.dispatcher.js');
const { default: EmailNotificationDispatcher } = await import('./dispatchers/emailNotification.dispatcher.js');

describe('NotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationDocument.save.mockClear();
    NotificationMock.findOne.mockResolvedValue(null);
  });

  it('sends a semantic notification through persistence, resolver, websocket, and email dispatchers', async () => {
    const io = { emit: vi.fn() };

    const result = await notificationService.send({
      type: 'TRIP_DELAYED',
      title: 'Route delayed',
      message: 'Route 06 is delayed.',
      target: { type: 'ALL_PASSENGERS' },
      channels: { inApp: true, email: true },
      priority: 'high',
      data: { routeId: 'route-1' },
      deduplicationKey: 'trip-delayed:route-1',
    }, { createdBy: '64f0f0f0f0f0f0f0f0f0f0f0', io });

    expect(NotificationMock.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'delay_alert',
      notificationType: 'TRIP_DELAYED',
      targetAudience: 'passengers',
      targetType: 'ALL_PASSENGERS',
      deduplicationKey: 'trip-delayed:route-1',
    }));
    expect(resolveNotificationRecipients).toHaveBeenCalledWith({ type: 'ALL_PASSENGERS' });
    expect(WebSocketNotificationDispatcher.dispatch).toHaveBeenCalledWith(result, io);
    expect(EmailNotificationDispatcher.dispatch).toHaveBeenCalledWith(result, recipients);
    expect(result.deliverySummary).toMatchObject({
      resolvedCount: 1,
      sentCount: 2,
      failedCount: 0,
    });
  });

  it('returns an existing notification for duplicate deduplication keys', async () => {
    NotificationMock.findOne.mockResolvedValue({ _id: 'existing' });

    const result = await notificationService.send({
      type: 'SYSTEM_ALERT',
      title: 'System notice',
      message: 'Already sent.',
      target: { type: 'ALL_USERS' },
      deduplicationKey: 'system:notice',
    });

    expect(result).toEqual({ _id: 'existing' });
    expect(NotificationMock.create).not.toHaveBeenCalled();
  });

  it('applies email defaults for transactional notification types', async () => {
    const result = await notificationService.send({
      type: 'TICKET_PURCHASED',
      title: 'Mua vé thành công',
      message: 'Vé đã được mua thành công.',
      target: { type: 'USER', userId: '64f0f0f0f0f0f0f0f0f0f0f0' },
      data: { ticketCode: 'TKT-1' },
      deduplicationKey: 'ticket-purchased:1',
    });

    expect(NotificationMock.create).toHaveBeenCalledWith(expect.objectContaining({
      notificationType: 'TICKET_PURCHASED',
      channels: { inApp: true, email: true, push: false },
    }));
    expect(EmailNotificationDispatcher.dispatch).toHaveBeenCalledWith(result, recipients);
  });

  it('keeps realtime notifications in-app only by default', async () => {
    await notificationService.send({
      type: 'BUS_APPROACHING',
      title: 'Xe buýt sắp đến',
      message: 'Xe buýt của bạn sắp đến điểm dừng.',
      target: { type: 'USER', userId: '64f0f0f0f0f0f0f0f0f0f0f0' },
      data: { etaMinutes: 5 },
      deduplicationKey: 'bus-approaching:1',
    });

    expect(NotificationMock.create).toHaveBeenCalledWith(expect.objectContaining({
      notificationType: 'BUS_APPROACHING',
      channels: { inApp: true, email: false, push: false },
    }));
    expect(EmailNotificationDispatcher.dispatch).not.toHaveBeenCalled();
  });
});

