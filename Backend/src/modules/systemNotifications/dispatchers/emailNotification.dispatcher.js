import emailService from '../../../utils/emailService.js';

const normalizeId = (value) => (value ? String(value) : '');

const shouldReceiveEmail = (user) => (
  Boolean(user?.email)
  && user.notificationEnabled !== false
  && user.preferences?.emailNotifications !== false
);

export class EmailNotificationDispatcher {
  static async dispatch(notification, recipients = []) {
    const seenEmails = new Set();
    const emailRecipients = recipients.filter((recipient) => {
      if (!shouldReceiveEmail(recipient)) return false;
      const email = String(recipient.email).trim().toLowerCase();
      if (seenEmails.has(email)) return false;
      seenEmails.add(email);
      return true;
    });
    const results = [];

    for (const recipient of emailRecipients) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await emailService.sendNotificationEmail({
          email: recipient.email,
          fullName: recipient.fullName || 'User',
          title: notification.title,
          message: notification.message,
          actionUrl: notification.actionUrl || '',
        });
        results.push({
          userId: normalizeId(recipient._id),
          email: recipient.email,
          status: 'SENT',
        });
      } catch (error) {
        results.push({
          userId: normalizeId(recipient._id),
          email: recipient.email,
          status: 'FAILED',
          errorMessage: error.message,
        });
      }
    }

    return {
      attemptedCount: emailRecipients.length,
      sentCount: results.filter((result) => result.status === 'SENT').length,
      failedCount: results.filter((result) => result.status === 'FAILED').length,
      results,
    };
  }
}

export default EmailNotificationDispatcher;
