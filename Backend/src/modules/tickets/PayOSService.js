import crypto from 'crypto';
import { config } from '../../config/environment.js';
import { CustomError } from '../../middleware/errorHandler.js';
import { HTTP_STATUS } from '../../constants/index.js';

const buildSignatureSource = (data) => Object.keys(data)
  .sort()
  .map((key) => `${key}=${data[key]}`)
  .join('&');

export class PayOSService {
  static assertConfigured() {
    if (!config.payos.clientId || !config.payos.apiKey || !config.payos.checksumKey) {
      throw new CustomError('PayOS is not configured', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static sign(data) {
    return crypto
      .createHmac('sha256', config.payos.checksumKey)
      .update(buildSignatureSource(data))
      .digest('hex');
  }

  static async request(path, options = {}) {
    this.assertConfigured();

    const response = await fetch(`${config.payos.apiBaseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': config.payos.clientId,
        'x-api-key': config.payos.apiKey,
        ...(options.headers || {}),
      },
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.code !== '00') {
      throw new CustomError(
        body.desc || body.message || 'Cannot connect to PayOS',
        HTTP_STATUS.BAD_GATEWAY,
        body
      );
    }

    return body.data;
  }

  static async createPaymentLink({ orderCode, amount, description, returnUrl, cancelUrl }) {
    const payload = {
      orderCode,
      amount,
      description: String(description || 'BusDN payment').slice(0, 25),
      returnUrl,
      cancelUrl,
    };

    return this.request('/v2/payment-requests', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        signature: this.sign(payload),
      }),
    });
  }

  static getPaymentLinkInformation(orderCode) {
    return this.request(`/v2/payment-requests/${orderCode}`);
  }
}

export default PayOSService;
