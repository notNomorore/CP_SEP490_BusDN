import crypto from 'crypto';
import QRCode from 'qrcode';
import { config } from '../../config/environment.js';

const base64UrlDecode = (value) => Buffer.from(value, 'base64url').toString('utf8');
const SIGNATURE_FIELDS = ['ticketCode', 'passCode', 'ticketType', 'type', 'routeCode', 'validFrom', 'validUntil'];

const stableStringify = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableStringify(value[key])}`
    )).join(',')}}`;
  }

  return JSON.stringify(value);
};

export class QRCodeService {
  static getSecret() {
    return config.qr.secret;
  }

  static sign(data) {
    const importantFields = SIGNATURE_FIELDS.reduce((fields, key) => {
      if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
        fields[key] = data[key];
      }
      return fields;
    }, {});

    return crypto
      .createHmac('sha256', this.getSecret())
      .update(stableStringify(importantFields))
      .digest('base64url')
      .slice(0, 22);
  }

  static buildReadablePayload(data) {
    const payload = {
      app: 'BusDN',
      ...data,
    };
    payload.sig = this.sign(payload);
    return payload;
  }

  static decodePayload(qrPayload) {
    const rawInput = String(qrPayload || '').trim();
    if (!rawInput) {
      return null;
    }

    try {
      const decoded = JSON.parse(rawInput);
      if (decoded?.app === 'BusDN' && decoded?.sig) {
        return { data: decoded, legacy: false };
      }
      if (decoded?.data && decoded?.signature) {
        return { data: decoded.data, signature: decoded.signature, legacy: true };
      }
    } catch {
      // Continue and try the previous base64url payload format.
    }

    try {
      const decoded = JSON.parse(base64UrlDecode(rawInput));
      if (decoded?.data && decoded?.signature) {
        return { data: decoded.data, signature: decoded.signature, legacy: true };
      }
    } catch {
      return null;
    }

    return null;
  }

  static verifySignedPayload(signedPayload) {
    if (!signedPayload?.data) {
      return false;
    }

    const expected = signedPayload.legacy
      ? crypto.createHmac('sha256', this.getSecret()).update(stableStringify(signedPayload.data)).digest('base64url')
      : this.sign(signedPayload.data);
    const actual = String(signedPayload.legacy ? signedPayload.signature : signedPayload.data.sig);
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual);

    return expectedBuffer.length === actualBuffer.length
      && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  }

  static async buildTicketQRCode(data) {
    const readablePayload = this.buildReadablePayload(data);
    const qrPayload = JSON.stringify(readablePayload);
    const generatedAt = new Date().toISOString();
    const qrCodeImage = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: {
        dark: '#002f1b',
        light: '#ffffff',
      },
    });

    return {
      qrPayload,
      qrCodeData: qrPayload,
      qrCodeImage,
      qrSignature: readablePayload.sig,
      issuedAt: readablePayload.issuedAt || generatedAt,
      expiresAt: readablePayload.validUntil,
      readablePayload,
    };
  }
}

export default QRCodeService;
