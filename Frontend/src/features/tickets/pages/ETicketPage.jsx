import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Clock3,
  Download,
  LoaderCircle,
  MapPin,
  QrCode,
  Ticket,
} from 'lucide-react';
import Header from '../../../shared/components/navigation/Header.jsx';
import ticketService from '../services/ticketService.js';

const formatDate = (value, pattern = 'dd/MM/yyyy') => {
  if (!value) return 'KhÃ´ng cÃ³ dá»¯ liá»‡u';
  try {
    return format(new Date(value), pattern);
  } catch {
    return 'KhÃ´ng cÃ³ dá»¯ liá»‡u';
  }
};

const roundCurrency = (value) => {
  const amount = Number(value) || 0;
  if (amount <= 0) return 0;
  return Math.max(Math.round(amount / 1000) * 1000, 1000);
};

const formatCurrency = (value) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(roundCurrency(value));

const formatTicketCode = (code) => {
  const value = String(code || '').toUpperCase();
  if (!value) return '';
  if (value.length <= 10) return value;
  const compact = value.replace(/^TKT-?/, '').replace(/[^A-Z0-9]/g, '');
  return `TKT-${compact.slice(-6)}`;
};

const statusClassName = (status) => {
  if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (status === 'USED') return 'bg-blue-50 text-blue-700 border-blue-100';
  if (status === 'EXPIRED') return 'bg-amber-50 text-amber-700 border-amber-100';
  if (status === 'CANCELLED') return 'bg-red-50 text-red-700 border-red-100';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const statusLabel = (status) => ({
  ACTIVE: 'CÃ²n hiá»‡u lá»±c',
  USED: 'ÄÃ£ sá»­ dá»¥ng',
  EXPIRED: 'ÄÃ£ háº¿t háº¡n',
  CANCELLED: 'ÄÃ£ há»§y',
  PENDING: 'Da dat ve',
  PAID: 'ÄÃ£ thanh toÃ¡n',
  FAILED: 'Tháº¥t báº¡i',
}[status] || status || 'KhÃ´ng xÃ¡c Ä‘á»‹nh');

const paymentStatusLabel = (status) => ({
  PENDING: 'Chua thanh toan',
  PAID: 'Da thanh toan',
  FAILED: 'Thanh toan that bai',
}[status] || status || 'Chua thanh toan');

const passengerTypeLabel = (type) => ({
  STANDARD: 'Phá»• thÃ´ng',
  STUDENT: 'Há»c sinh / Sinh viÃªn',
  PRIORITY: 'Äá»‘i tÆ°á»£ng Æ°u tiÃªn',
}[type] || 'Phá»• thÃ´ng');

const paymentMethodLabel = (method) => ({
  E_WALLET: 'VÃ­ Ä‘iá»‡n tá»­',
  CREDIT_CARD: 'Tháº» tÃ­n dá»¥ng',
  CASHLESS: 'QuÃ©t QR ngÃ¢n hÃ ng',
  ONLINE_BANKING: 'NgÃ¢n hÃ ng trá»±c tuyáº¿n',
}[method] || method || 'Chua chon phuong thuc');

const normalizeNote = (note) => ({
  'Please arrive at the boarding stop at least 5 minutes before departure.': 'Vui lÃ²ng cÃ³ máº·t táº¡i Ä‘iá»ƒm lÃªn xe Ã­t nháº¥t 5 phÃºt trÆ°á»›c giá» khá»Ÿi hÃ nh.',
  'Keep the QR code visible and present it when boarding.': 'Giá»¯ mÃ£ QR rÃµ rÃ ng vÃ  xuáº¥t trÃ¬nh khi lÃªn xe.',
  'Tickets are personal and non-transferable.': 'VÃ© chá»‰ dÃ nh cho cÃ¡ nhÃ¢n vÃ  khÃ´ng Ä‘Æ°á»£c chuyá»ƒn nhÆ°á»£ng.',
  'Expired or used tickets cannot be cancelled.': 'KhÃ´ng thá»ƒ há»§y vÃ© Ä‘Ã£ sá»­ dá»¥ng hoáº·c háº¿t háº¡n.',
}[note] || note);

const hashText = (text) => {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const QRPreview = ({ payload, image }) => {
  const matrix = useMemo(() => {
    const size = 25;
    const seed = hashText(payload || 'ticket');
    return Array.from({ length: size }, (_, row) => (
      Array.from({ length: size }, (_, col) => {
        const inTopLeft = row < 7 && col < 7;
        const inTopRight = row < 7 && col > size - 8;
        const inBottomLeft = row > size - 8 && col < 7;
        if (inTopLeft || inTopRight || inBottomLeft) {
          const localRow = row < 7 ? row : row - (size - 7);
          const localCol = col < 7 ? col : col - (size - 7);
          return localRow === 0 || localRow === 6 || localCol === 0 || localCol === 6
            || (localRow >= 2 && localRow <= 4 && localCol >= 2 && localCol <= 4);
        }
        return ((row * 31 + col * 17 + seed) % 7) < 3;
      })
    ));
  }, [payload]);

  const readablePayload = useMemo(() => {
    try {
      return payload ? JSON.parse(payload) : null;
    } catch {
      return null;
    }
  }, [payload]);

  return (
    <div className="rounded-[24px] border border-outline-variant/50 bg-white p-4">
      {image ? (
        <img src={image} alt="Ticket QR code" className="mx-auto h-56 w-56 object-contain" />
      ) : (
        <svg viewBox="0 0 25 25" className="mx-auto h-56 w-56" role="img" aria-label="Ticket QR code">
          <rect width="25" height="25" fill="white" />
          {matrix.flatMap((row, rowIndex) => row.map((filled, colIndex) => (
            filled ? (
              <rect
                key={`${rowIndex}-${colIndex}`}
                x={colIndex}
                y={rowIndex}
                width="1"
                height="1"
                fill="#002f1b"
              />
            ) : null
          )))}
        </svg>
      )}
      <p className="mt-3 text-center text-xs font-bold text-on-surface-variant">
        Show this QR code when boarding.
      </p>
      {readablePayload ? (
        <div className="mt-3 rounded-xl bg-surface px-3 py-2 text-xs text-primary">
          <p><strong>QR Info:</strong> {readablePayload.ticketCode || readablePayload.passCode}</p>
          <p>{readablePayload.type} - {readablePayload.routeCode}</p>
          <p>Valid until: {readablePayload.validUntil}</p>
        </div>
      ) : null}
    </div>
  );
};
const InfoRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 border-b border-outline-variant/30 py-2 text-sm last:border-b-0">
    <span className="text-on-surface-variant">{label}</span>
    <span className="text-right font-bold text-primary">{value || 'KhÃ´ng cÃ³ dá»¯ liá»‡u'}</span>
  </div>
);

const ETicketPage = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTicket = async () => {
    setIsLoading(true);
    setError('');

    try {
      const payload = await ticketService.getTicket(ticketId);
      setTicket(payload);
    } catch (err) {
      setError(err.message || 'KhÃ´ng thá»ƒ táº£i thÃ´ng tin vÃ©. Vui lÃ²ng thá»­ láº¡i sau.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  const handleDownload = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-surface-container-low">
      <Header />

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-32 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate('/my-tickets')}
          className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-primary shadow-sm hover:bg-surface"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại vé của tôi
        </button>

        {isLoading ? (
          <div className="flex min-h-[420px] items-center justify-center gap-3 rounded-[28px] bg-white text-primary">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            Äang táº£i vÃ© Ä‘iá»‡n tá»­...
          </div>
        ) : error ? (
          <div className="rounded-[28px] border border-red-200 bg-red-50 px-6 py-5 font-semibold text-red-700">
            {error}
          </div>
        ) : ticket ? (
          <section className="rounded-[28px] bg-white p-6 shadow-xl shadow-primary/5">
            <div className="flex flex-col gap-4 border-b border-outline-variant/40 pb-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-on-tertiary-container">VÃ© Ä‘iá»‡n tá»­</p>
                <h1 className="mt-2 text-3xl font-headline font-black text-primary">ThÃ´ng tin vÃ© Ä‘iá»‡n tá»­</h1>
                <p className="mt-2 text-sm text-on-surface-variant">
                  Xem thÃ´ng tin chi tiáº¿t vÃ  mÃ£ QR cá»§a vÃ©.
                </p>
              </div>
              <span className={`w-fit rounded-full border px-4 py-2 text-sm font-black ${statusClassName(ticket.status)}`}>
                {statusLabel(ticket.status)}
              </span>
            </div>

            {ticket.statusMessage ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800">
                {ticket.statusMessage}
              </div>
            ) : null}

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
              <div className="space-y-6">
                <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
                  <div>
                    <div className="mb-3 flex items-center gap-2 text-lg font-black text-primary">
                      <QrCode className="h-5 w-5" />
                      MÃ£ QR cá»§a vÃ©
                    </div>
                    {ticket.status === 'ACTIVE' ? (
                      <QRPreview payload={ticket.qrCode?.payload} image={ticket.qrCode?.image} />
                    ) : (
                      <div className="rounded-[24px] border border-outline-variant/50 bg-slate-50 p-6 text-center text-sm font-bold text-slate-600">
                        QR chua kha dung cho ve chua thanh toan.
                      </div>
                    )}
                  </div>

                  <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
                    <div className="mb-3 flex items-center gap-2 text-lg font-black text-primary">
                      <Ticket className="h-5 w-5" />
                      ThÃ´ng tin vÃ©
                    </div>
                    <InfoRow label="MÃ£ vÃ©" value={formatTicketCode(ticket.ticketCode)} />
                    <InfoRow label="Tuyáº¿n xe" value={ticket.routeNumber} />
                    <InfoRow label="Äiá»ƒm Ä‘i" value={ticket.departureLocation} />
                    <InfoRow label="Äiá»ƒm Ä‘áº¿n" value={ticket.destinationLocation} />
                    <InfoRow label="NgÃ y Ä‘i" value={formatDate(ticket.serviceDate)} />
                    <InfoRow label="Giá» khá»Ÿi hÃ nh" value={ticket.departureTime} />
                    <InfoRow label="Äá»‘i tÆ°á»£ng" value={passengerTypeLabel(ticket.passengerType)} />
                    <InfoRow label="HÃ nh khÃ¡ch" value={ticket.passengerInfo?.fullName} />
                    <InfoRow label="Loáº¡i vÃ©" value="VÃ© má»™t lÆ°á»£t" />
                    <InfoRow label="GiÃ¡ vÃ©" value={formatCurrency(ticket.ticketPrice)} />
                    <InfoRow label="Thanh toan" value={`${paymentStatusLabel(ticket.paymentStatus)} - ${paymentMethodLabel(ticket.paymentMethod)}`} />
                    <InfoRow label="Thá»i gian mua" value={formatDate(ticket.purchasedAt, 'dd/MM/yyyy HH:mm')} />
                  </div>
                </div>

                <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
                  <div className="mb-4 flex items-center gap-2 text-lg font-black text-primary">
                    <MapPin className="h-5 w-5" />
                    ThÃ´ng tin hÃ nh trÃ¬nh
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                    <div className="space-y-3">
                      {(ticket.tripInfo?.remainingStops || []).map((stop, index) => (
                        <div key={`${stop.name}-${index}`} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <span className={`mt-1 h-3 w-3 rounded-full ${
                              stop.isBoardingPoint ? 'bg-emerald-600' : stop.isDestination ? 'bg-primary' : 'bg-outline-variant'
                            }`} />
                            {index < (ticket.tripInfo?.remainingStops || []).length - 1 ? (
                              <span className="h-full min-h-8 w-px bg-outline-variant" />
                            ) : null}
                          </div>
                          <div>
                            <p className="font-bold text-primary">{stop.name}</p>
                            <p className="text-xs text-on-surface-variant">
                              {stop.isBoardingPoint ? 'Äiá»ƒm lÃªn xe' : stop.isDestination ? 'Äiá»ƒm xuá»‘ng xe' : 'Äiá»ƒm dá»«ng'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-4 text-sm">
                      <div className="flex items-center gap-2 font-black text-primary">
                        <Clock3 className="h-4 w-4" />
                        Thá»i gian Ä‘áº¿n dá»± kiáº¿n
                      </div>
                      <p className="mt-3 text-on-surface-variant">{ticket.tripInfo?.estimatedArrivalTime}</p>
                      <p className="mt-3 text-on-surface-variant">
                        Tiáº¿n Ä‘á»™: <strong className="text-primary">{ticket.tripInfo?.progressPercent || 0}%</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="space-y-6">
                <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
                  <h2 className="text-lg font-black text-primary">Tráº¡ng thÃ¡i vÃ©</h2>
                  <div className="mt-4 space-y-1">
                    <InfoRow label="Tráº¡ng thÃ¡i" value={statusLabel(ticket.status)} />
                    <InfoRow label="CÃ³ hiá»‡u lá»±c tá»«" value={`${formatDate(ticket.serviceDate)} ${ticket.departureTime}`} />
                    <InfoRow label="CÃ³ hiá»‡u lá»±c Ä‘áº¿n" value={formatDate(ticket.serviceDate)} />
                    <InfoRow label="ÄÃ£ sá»­ dá»¥ng" value={ticket.usedAt ? formatDate(ticket.usedAt, 'dd/MM/yyyy HH:mm') : 'ChÆ°a'} />
                    <InfoRow label="LÆ°á»£t Ä‘i cÃ²n láº¡i" value={ticket.status === 'ACTIVE' ? '1 / 1' : '0 / 1'} />
                  </div>
                </div>

                <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
                  <h2 className="text-lg font-black text-primary">Thao tÃ¡c</h2>
                  <div className="mt-4 space-y-3">
                    <button type="button" onClick={handleDownload} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white">
                      <Download className="h-4 w-4" />
                      Táº£i vÃ©
                    </button>
                  </div>
                </div>

                <div className="rounded-[24px] border border-outline-variant/40 bg-primary-fixed p-5 text-on-primary-fixed">
                  <h2 className="text-lg font-black">LÆ°u Ã½ quan trá»ng</h2>
                  <div className="mt-4 space-y-3 text-sm">
                    {(ticket.importantNotes || []).map((note) => (
                      <p key={note}>{normalizeNote(note)}</p>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
};

export default ETicketPage;
