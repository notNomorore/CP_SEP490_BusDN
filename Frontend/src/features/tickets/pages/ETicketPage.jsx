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

const NO_DATA = 'Không có dữ liệu';

const formatDate = (value, pattern = 'dd/MM/yyyy') => {
  if (!value) return NO_DATA;
  try {
    return format(new Date(value), pattern);
  } catch {
    return NO_DATA;
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
  ACTIVE: 'Còn hiệu lực',
  USED: 'Đã sử dụng',
  EXPIRED: 'Đã hết hạn',
  CANCELLED: 'Đã hủy',
  PENDING: 'Đã đặt vé',
  PAID: 'Đã thanh toán',
  FAILED: 'Thất bại',
}[status] || status || 'Không xác định');

const paymentStatusLabel = (status) => ({
  PENDING: 'Chưa thanh toán',
  PAID: 'Đã thanh toán',
  FAILED: 'Thanh toán thất bại',
}[status] || status || 'Chưa thanh toán');

const passengerTypeLabel = (type) => ({
  STANDARD: 'Phổ thông',
  STUDENT: 'Học sinh / Sinh viên',
  PRIORITY: 'Đối tượng ưu tiên',
}[type] || 'Phổ thông');

const paymentMethodLabel = (method) => ({
  E_WALLET: 'Ví điện tử',
  CREDIT_CARD: 'Thẻ tín dụng',
  CASHLESS: 'Quét QR ngân hàng',
  ONLINE_BANKING: 'Ngân hàng trực tuyến',
  PAYOS: 'PayOS',
}[method] || method || 'Chưa chọn phương thức');

const normalizeNote = (note) => ({
  'Please arrive at the boarding stop at least 5 minutes before departure.': 'Vui lòng có mặt tại điểm lên xe ít nhất 5 phút trước giờ khởi hành.',
  'Keep the QR code visible and present it when boarding.': 'Giữ mã QR rõ ràng và xuất trình khi lên xe.',
  'Tickets are personal and non-transferable.': 'Vé chỉ dành cho cá nhân và không được chuyển nhượng.',
  'Expired or used tickets cannot be cancelled.': 'Không thể hủy vé đã sử dụng hoặc hết hạn.',
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
        <img src={image} alt="Mã QR vé xe buýt" className="mx-auto h-56 w-56 object-contain" />
      ) : (
        <svg viewBox="0 0 25 25" className="mx-auto h-56 w-56" role="img" aria-label="Mã QR vé xe buýt">
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
        Xuất trình mã QR này khi lên xe.
      </p>
      {readablePayload ? (
        <div className="mt-3 rounded-xl bg-surface px-3 py-2 text-xs text-primary">
          <p><strong>Thông tin QR:</strong> {readablePayload.ticketCode || readablePayload.passCode}</p>
          <p>{readablePayload.type} - {readablePayload.routeCode}</p>
          <p>Hiệu lực đến: {readablePayload.validUntil}</p>
        </div>
      ) : null}
    </div>
  );
};

const InfoRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 border-b border-outline-variant/30 py-2 text-sm last:border-b-0">
    <span className="text-on-surface-variant">{label}</span>
    <span className="text-right font-bold text-primary">{value || NO_DATA}</span>
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
      setError(err.message || 'Không thể tải thông tin vé. Vui lòng thử lại sau.');
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
            Đang tải vé điện tử...
          </div>
        ) : error ? (
          <div className="rounded-[28px] border border-red-200 bg-red-50 px-6 py-5 font-semibold text-red-700">
            {error}
          </div>
        ) : ticket ? (
          <section className="rounded-[28px] bg-white p-6 shadow-xl shadow-primary/5">
            <div className="flex flex-col gap-4 border-b border-outline-variant/40 pb-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-on-tertiary-container">Vé điện tử</p>
                <h1 className="mt-2 text-3xl font-headline font-black text-primary">Thông tin vé điện tử</h1>
                <p className="mt-2 text-sm text-on-surface-variant">
                  Xem thông tin chi tiết và mã QR của vé.
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
                      Mã QR của vé
                    </div>
                    {ticket.status === 'ACTIVE' ? (
                      <QRPreview payload={ticket.qrCode?.payload} image={ticket.qrCode?.image} />
                    ) : (
                      <div className="rounded-[24px] border border-outline-variant/50 bg-slate-50 p-6 text-center text-sm font-bold text-slate-600">
                        QR chưa khả dụng cho vé chưa thanh toán hoặc không còn hiệu lực.
                      </div>
                    )}
                  </div>

                  <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
                    <div className="mb-3 flex items-center gap-2 text-lg font-black text-primary">
                      <Ticket className="h-5 w-5" />
                      Thông tin vé
                    </div>
                    <InfoRow label="Mã vé" value={formatTicketCode(ticket.ticketCode)} />
                    <InfoRow label="Tuyến xe" value={ticket.routeNumber} />
                    <InfoRow label="Điểm đi" value={ticket.departureLocation} />
                    <InfoRow label="Điểm đến" value={ticket.destinationLocation} />
                    <InfoRow label="Ngày đi" value={formatDate(ticket.serviceDate)} />
                    <InfoRow label="Giờ khởi hành" value={ticket.departureTime} />
                    <InfoRow label="Đối tượng" value={passengerTypeLabel(ticket.passengerType)} />
                    <InfoRow label="Hành khách" value={ticket.passengerInfo?.fullName} />
                    <InfoRow label="Loại vé" value="Vé một lượt" />
                    <InfoRow label="Giá vé" value={formatCurrency(ticket.ticketPrice)} />
                    <InfoRow label="Thanh toán" value={`${paymentStatusLabel(ticket.paymentStatus)} - ${paymentMethodLabel(ticket.paymentMethod)}`} />
                    <InfoRow label="Thời gian mua" value={formatDate(ticket.purchasedAt, 'dd/MM/yyyy HH:mm')} />
                  </div>
                </div>

                <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
                  <div className="mb-4 flex items-center gap-2 text-lg font-black text-primary">
                    <MapPin className="h-5 w-5" />
                    Thông tin hành trình
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
                              {stop.isBoardingPoint ? 'Điểm lên xe' : stop.isDestination ? 'Điểm xuống xe' : 'Điểm dừng'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-4 text-sm">
                      <div className="flex items-center gap-2 font-black text-primary">
                        <Clock3 className="h-4 w-4" />
                        Thời gian đến dự kiến
                      </div>
                      <p className="mt-3 text-on-surface-variant">{ticket.tripInfo?.estimatedArrivalTime}</p>
                      <p className="mt-3 text-on-surface-variant">
                        Tiến độ: <strong className="text-primary">{ticket.tripInfo?.progressPercent || 0}%</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="space-y-6">
                <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
                  <h2 className="text-lg font-black text-primary">Trạng thái vé</h2>
                  <div className="mt-4 space-y-1">
                    <InfoRow label="Trạng thái" value={statusLabel(ticket.status)} />
                    <InfoRow label="Có hiệu lực từ" value={`${formatDate(ticket.serviceDate)} ${ticket.departureTime}`} />
                    <InfoRow label="Có hiệu lực đến" value={formatDate(ticket.serviceDate)} />
                    <InfoRow label="Đã sử dụng" value={ticket.usedAt ? formatDate(ticket.usedAt, 'dd/MM/yyyy HH:mm') : 'Chưa'} />
                    <InfoRow label="Lượt đi còn lại" value={ticket.status === 'ACTIVE' ? '1 / 1' : '0 / 1'} />
                  </div>
                </div>

                <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
                  <h2 className="text-lg font-black text-primary">Thao tác</h2>
                  <div className="mt-4 space-y-3">
                    <button type="button" onClick={handleDownload} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white">
                      <Download className="h-4 w-4" />
                      Tải vé
                    </button>
                  </div>
                </div>

                <div className="rounded-[24px] border border-outline-variant/40 bg-primary-fixed p-5 text-on-primary-fixed">
                  <h2 className="text-lg font-black">Lưu ý quan trọng</h2>
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
