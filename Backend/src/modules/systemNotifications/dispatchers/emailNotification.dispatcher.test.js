import { beforeEach, describe, expect, it, vi } from 'vitest';

const emailServiceMock = {
  sendTemplatedNotificationEmail: vi.fn(async () => true),
};

vi.mock('../../../utils/emailService.js', () => ({
  default: emailServiceMock,
}));

vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const { default: EmailNotificationDispatcher } = await import('./emailNotification.dispatcher.js');

const notification = {
  _id: 'notification-1',
  title: 'Mua vé thành công',
  message: 'Vé TKT-1 đã được mua thành công.',
  notificationType: 'TICKET_PURCHASED',
  actionUrl: '/tickets/ticket-1',
  metadata: {
    ticketCode: 'TKT-1',
    passengerName: 'Nguyen Van A',
    routeName: 'Tuyến 01',
    boardingStop: 'Bến xe A',
    destinationStop: 'Bến xe B',
    amount: 12000,
    paymentStatus: 'PAID',
    paymentMethod: 'PAYOS',
    qrCodeImage: 'data:image/png;base64,aGVsbG8=',
  },
};

describe('EmailNotificationDispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders and sends a templated transactional email', async () => {
    const result = await EmailNotificationDispatcher.dispatch(notification, [{
      _id: 'user-1',
      email: 'passenger@example.com',
      fullName: 'Nguyen Van A',
      notificationEnabled: true,
      preferences: { emailNotifications: true },
    }]);

    expect(emailServiceMock.sendTemplatedNotificationEmail).toHaveBeenCalledWith(expect.objectContaining({
      email: 'passenger@example.com',
      subject: 'BusDN - Xác nhận mua vé thành công',
      html: expect.stringContaining('TKT-1'),
      text: expect.stringContaining('TKT-1'),
      attachments: [expect.objectContaining({
        filename: 'BusDN-TKT-1-QR.png',
        cid: 'busdn-ticket-qr',
        contentType: 'image/png',
      })],
    }));
    expect(result).toMatchObject({
      attemptedCount: 1,
      sentCount: 1,
      failedCount: 0,
      skippedCount: 0,
    });
  });

  it('skips missing emails without throwing', async () => {
    const result = await EmailNotificationDispatcher.dispatch(notification, [{
      _id: 'user-1',
      fullName: 'No Email',
      notificationEnabled: true,
      preferences: { emailNotifications: true },
    }]);

    expect(emailServiceMock.sendTemplatedNotificationEmail).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      attemptedCount: 0,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 1,
    });
  });

  it('isolates SMTP failures and reports failed delivery', async () => {
    emailServiceMock.sendTemplatedNotificationEmail.mockRejectedValueOnce(new Error('SMTP unavailable'));

    const result = await EmailNotificationDispatcher.dispatch(notification, [{
      _id: 'user-1',
      email: 'passenger@example.com',
      fullName: 'Passenger',
      notificationEnabled: true,
      preferences: { emailNotifications: true },
    }]);

    expect(result).toMatchObject({
      attemptedCount: 1,
      sentCount: 0,
      failedCount: 1,
      skippedCount: 0,
    });
    expect(result.results[0]).toMatchObject({
      status: 'FAILED',
      errorMessage: 'SMTP unavailable',
    });
  });

  it('does not send duplicate emails to the same address', async () => {
    const result = await EmailNotificationDispatcher.dispatch(notification, [
      {
        _id: 'user-1',
        email: 'passenger@example.com',
        fullName: 'Passenger 1',
        notificationEnabled: true,
        preferences: { emailNotifications: true },
      },
      {
        _id: 'user-2',
        email: 'PASSENGER@example.com',
        fullName: 'Passenger 2',
        notificationEnabled: true,
        preferences: { emailNotifications: true },
      },
    ]);

    expect(emailServiceMock.sendTemplatedNotificationEmail).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      attemptedCount: 1,
      sentCount: 1,
      failedCount: 0,
      skippedCount: 1,
    });
  });
});
