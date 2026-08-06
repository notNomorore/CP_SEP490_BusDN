import React, { useState } from 'react';
import {
  CheckCircle2,
  LoaderCircle,
  QrCode,
  ShieldAlert,
  TicketCheck,
  XCircle,
} from 'lucide-react';
import Header from '../../../shared/components/navigation/Header.jsx';
import ticketService from '../services/ticketService.js';

const normalizeError = (message) => ({
  'Already used': 'Ve da duoc su dung',
  ALREADY_USED: 'Ve da duoc su dung',
  'Expired ticket': 'Ve da het han',
  EXPIRED: 'Ve da het han',
  'Invalid QR': 'QR khong hop le',
  INVALID_QR: 'QR khong hop le',
  'Cancelled ticket': 'Ve da bi huy',
  CANCELLED: 'Ve da bi huy',
  NOT_FOUND: 'Khong tim thay ve',
  WRONG_ROUTE: 'Sai tuyen hoac sai chuyen',
  'Ticket is not active': 'Ve chua san sang de su dung',
}[message] || message || 'Khong the xac thuc ve');

const ValidateTicketPage = () => {
  const [input, setInput] = useState('');
  const [tripId, setTripId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const qrPayload = input.trim();
    if (!qrPayload) {
      setResult({ ok: false, message: 'QR khong hop le' });
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const payload = await ticketService.validateQRCode({
        qrPayload,
        tripId: tripId.trim() || undefined,
      });
      setResult(payload);
    } catch (error) {
      setResult({ ok: false, message: normalizeError(error.message) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = Boolean(result?.ok);

  return (
    <div className="min-h-screen bg-surface-container-low">
      <Header />

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-32 sm:px-6 lg:px-8">
        <section className="rounded-[28px] bg-white p-6 shadow-xl shadow-primary/5">
          <div className="flex items-start gap-4 border-b border-outline-variant/40 pb-5">
            <div className="rounded-2xl bg-primary px-4 py-4 text-white">
              <QrCode className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-on-tertiary-container">Bus Assistant</p>
              <h1 className="mt-2 text-3xl font-headline font-black text-primary">Xac thuc ve QR</h1>
              <p className="mt-2 text-sm text-on-surface-variant">
                Dan payload QR hoac nhap ma ve de kiem tra va ghi nhan len xe.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block text-sm font-bold text-primary">
              Payload QR hoac ma ve
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={5}
                placeholder="Dan QR payload hoac nhap TKT-..."
                className="mt-2 w-full resize-none rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 font-mono text-sm outline-none focus:border-primary"
              />
            </label>

            <label className="block text-sm font-bold text-primary">
              Trip ID / Schedule ID neu can doi chieu
              <input
                value={tripId}
                onChange={(event) => setTripId(event.target.value)}
                placeholder="VD: DN01-2026-07-01-08:00"
                className="mt-2 w-full rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 font-mono text-sm outline-none focus:border-primary"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 font-black text-white disabled:opacity-60"
            >
              {isSubmitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <TicketCheck className="h-5 w-5" />}
              {isSubmitting ? 'Dang xac thuc...' : 'Xac thuc ve'}
            </button>
          </form>

          {result ? (
            <div className={`mt-6 rounded-[24px] border px-5 py-5 ${
              isValid ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
            }`}
            >
              <div className="flex items-start gap-3">
                {isValid ? <CheckCircle2 className="mt-0.5 h-6 w-6" /> : <XCircle className="mt-0.5 h-6 w-6" />}
                <div>
                  <h2 className="text-lg font-black">{isValid ? 'Valid ticket' : normalizeError(result.result || result.message)}</h2>
                  <p className="mt-1 text-sm font-semibold">
                    {isValid ? 'Ve hop le va da duoc ghi nhan.' : normalizeError(result.message || result.result)}
                  </p>
                </div>
              </div>

              {isValid ? (
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-wide text-outline">Hanh khach</p>
                    <p className="mt-1 font-bold text-primary">{result.passengerName}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-wide text-outline">Loai ve</p>
                    <p className="mt-1 font-bold text-primary">{result.ticketType}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-wide text-outline">Ma ve</p>
                    <p className="mt-1 font-mono font-bold text-primary">{result.ticketCode || result.passCode}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-wide text-outline">Tuyen / chuyen</p>
                    <p className="mt-1 font-bold text-primary">{result.routeCode || result.routeNumber || result.tripId || 'Ve thang'}</p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold">
                  <ShieldAlert className="h-4 w-4" />
                  Khong cho khach len xe bang ma nay.
                </div>
              )}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
};

export default ValidateTicketPage;
