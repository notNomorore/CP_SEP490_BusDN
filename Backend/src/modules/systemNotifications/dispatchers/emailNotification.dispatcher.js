import emailService from '../../../utils/emailService.js';
import logger from '../../../utils/logger.js';
import renderNotificationEmail from '../templates/index.js';

const normalizeId = (value) => (value ? String(value) : '');
const EMAIL_REGEX = /^[^\s@.]+(?:\.[^\s@.]+)*@[^\s@.]+(?:\.[^\s@.]+)+$/;

const shouldReceiveEmail = (user) => (
  Boolean(user?._id)
  && EMAIL_REGEX.test(String(user.email || '').trim())
  && user.notificationEnabled !== false
  && user.preferences?.emailNotifications !== false
);

export class EmailNotificationDispatcher {
  static async dispatch(notification, recipients = []) {
    const seenEmails = new Set();
    const results = [];
    const emailRecipients = recipients.filter((recipient) => {
      if (!recipient?.email) {
        logger.warn('notification.email_missing_recipient_email', {
          notificationId: normalizeId(notification._id),
          userId: normalizeId(recipient?._id),
        });
        results.push({
          userId: normalizeId(recipient?._id),
          email: '',
          status: 'SKIPPED',
          reason: 'MISSING_EMAIL',
        });
        return false;
      }

      if (!shouldReceiveEmail(recipient)) {
        results.push({
          userId: normalizeId(recipient?._id),
          email: recipient.email,
          status: 'SKIPPED',
          reason: 'EMAIL_DISABLED_OR_INVALID',
        });
        return false;
      }

      const email = String(recipient.email).trim().toLowerCase();
      if (seenEmails.has(email)) {
        results.push({
          userId: normalizeId(recipient._id),
          email: recipient.email,
          status: 'SKIPPED',
          reason: 'DUPLICATE_EMAIL',
        });
        return false;
      }

      seenEmails.add(email);
      return true;
    });

    for (const recipient of emailRecipients) {
      try {
        const rendered = renderNotificationEmail({ notification, recipient });
        // eslint-disable-next-line no-await-in-loop
        await emailService.sendTemplatedNotificationEmail({
          email: recipient.email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        });
        results.push({
          userId: normalizeId(recipient._id),
          email: recipient.email,
          status: 'SENT',
        });
        logger.info('notification.email_sent', {
          notificationId: normalizeId(notification._id),
          userId: normalizeId(recipient._id),
        });
      } catch (error) {
        results.push({
          userId: normalizeId(recipient._id),
          email: recipient.email,
          status: 'FAILED',
          errorMessage: error.message,
        });
        logger.error('notification.email_dispatch_failed', {
          notificationId: normalizeId(notification._id),
          userId: normalizeId(recipient._id),
          message: error.message,
        });
      }
    }

    return {
      attemptedCount: emailRecipients.length,
      sentCount: results.filter((result) => result.status === 'SENT').length,
      failedCount: results.filter((result) => result.status === 'FAILED').length,
      skippedCount: results.filter((result) => result.status === 'SKIPPED').length,
      results,
    };
  }
}

export default EmailNotificationDispatcher;
