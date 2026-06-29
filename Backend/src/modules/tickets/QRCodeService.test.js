import { describe, expect, it } from 'vitest';
import QRCodeService from './QRCodeService.js';

describe('QRCodeService', () => {
  it('generates a readable signed BusDN ticket QR payload', async () => {
    const qr = await QRCodeService.buildTicketQRCode({
      type: 'BUS_TICKET',
      ticketCode: 'BUS-20260628-ABC123',
      ticketType: 'ONE_WAY',
      routeCode: 'R01',
      fromStop: 'Da Nang Central Bus Station',
      toStop: 'Hoi An Stop',
      validFrom: '2026-06-28T08:00:00+07:00',
      validUntil: '2026-06-28T10:00:00+07:00',
    });

    const scannedPayload = JSON.parse(qr.qrPayload);

    expect(scannedPayload).toMatchObject({
      app: 'BusDN',
      type: 'BUS_TICKET',
      ticketCode: 'BUS-20260628-ABC123',
      ticketType: 'ONE_WAY',
      routeCode: 'R01',
      validUntil: '2026-06-28T10:00:00+07:00',
    });
    expect(scannedPayload.sig).toEqual(expect.any(String));
    expect(qr.qrCodeImage.startsWith('data:image/png;base64,')).toBe(true);
    expect(QRCodeService.verifySignedPayload(QRCodeService.decodePayload(qr.qrPayload))).toBe(true);
  });

  it('rejects tampered readable QR payloads', async () => {
    const qr = await QRCodeService.buildTicketQRCode({
      type: 'BUS_TICKET',
      ticketCode: 'BUS-20260628-ABC123',
      ticketType: 'ONE_WAY',
      routeCode: 'R01',
      validFrom: '2026-06-28T08:00:00+07:00',
      validUntil: '2026-06-28T10:00:00+07:00',
    });
    const tamperedPayload = JSON.parse(qr.qrPayload);
    tamperedPayload.routeCode = 'R99';

    expect(QRCodeService.verifySignedPayload({
      data: tamperedPayload,
      legacy: false,
    })).toBe(false);
  });
});
