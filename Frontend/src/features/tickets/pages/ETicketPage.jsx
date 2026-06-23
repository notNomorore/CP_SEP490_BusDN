import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  CalendarPlus,
  Clock3,
  Download,
  LoaderCircle,
  MapPin,
  QrCode,
  Share2,
  Ticket,
  XCircle,
} from 'lucide-react';
import Header from '../../../shared/components/navigation/Header.jsx';
import ticketService from '../services/ticketService.js';

const formatDate = (value, pattern = 'dd MMM yyyy') => {
  if (!value) return 'Not available';
  try {
    return format(new Date(value), pattern);
  } catch {
    return 'Not available';
  }
};

const formatCurrency = (value) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(value || 0);

const statusClassName = (status) => {
  if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (status === 'USED') return 'bg-blue-50 text-blue-700 border-blue-100';
  if (status === 'EXPIRED') return 'bg-amber-50 text-amber-700 border-amber-100';
  if (status === 'CANCELLED') return 'bg-red-50 text-red-700 border-red-100';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const hashText = (text) => {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const QRPreview = ({ payload }) => {
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

  return (
    <div className="rounded-[24px] border border-outline-variant/50 bg-white p-4">
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
      <p className="mt-3 text-center text-xs font-bold text-on-surface-variant">
        Scan this QR code when boarding.
      </p>
    </div>
  );
};

const InfoRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 border-b border-outline-variant/30 py-2 text-sm last:border-b-0">
    <span className="text-on-surface-variant">{label}</span>
    <span className="text-right font-bold text-primary">{value || 'Not available'}</span>
  </div>
);

const ETicketPage = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState('');

  const loadTicket = async () => {
    setIsLoading(true);
    setError('');

    try {
      const payload = await ticketService.getTicket(ticketId);
      setTicket(payload);
    } catch (err) {
      setError(err.message || 'Unable to load ticket details. Please try again later.');
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

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      await navigator.share({
        title: `E-Ticket ${ticket.ticketCode}`,
        text: `Route ${ticket.routeNumber}: ${ticket.departureLocation} to ${ticket.destinationLocation}`,
        url: shareUrl,
      });
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
    toast.success('Ticket link copied');
  };

  const handleAddToCalendar = () => {
    const serviceDate = new Date(ticket.serviceDate);
    const [hours = 0, minutes = 0] = String(ticket.departureTime || '00:00').split(':').map(Number);
    serviceDate.setHours(hours, minutes, 0, 0);
    const endDate = new Date(serviceDate.getTime() + 60 * 60 * 1000);
    const toIcsDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0];
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `UID:${ticket.ticketCode}@busdn`,
      `DTSTART:${toIcsDate(serviceDate)}Z`,
      `DTEND:${toIcsDate(endDate)}Z`,
      `SUMMARY:BusDN ${ticket.routeNumber} E-Ticket`,
      `DESCRIPTION:${ticket.departureLocation} to ${ticket.destinationLocation}. Seat ${ticket.seatNumber}.`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${ticket.ticketCode}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCancel = async () => {
    setIsCancelling(true);

    try {
      const updatedTicket = await ticketService.cancelTicket(ticket.id);
      setTicket(updatedTicket);
      toast.success('Ticket cancelled successfully');
    } catch (err) {
      toast.error(err.message || 'Unable to validate ticket. Please try again.');
    } finally {
      setIsCancelling(false);
    }
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
          Back to My Tickets
        </button>

        {isLoading ? (
          <div className="flex min-h-[420px] items-center justify-center gap-3 rounded-[28px] bg-white text-primary">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            Loading e-ticket...
          </div>
        ) : error ? (
          <div className="rounded-[28px] border border-red-200 bg-red-50 px-6 py-5 font-semibold text-red-700">
            {error}
          </div>
        ) : ticket ? (
          <section className="rounded-[28px] bg-white p-6 shadow-xl shadow-primary/5">
            <div className="flex flex-col gap-4 border-b border-outline-variant/40 pb-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-on-tertiary-container">E-Ticket</p>
                <h1 className="mt-2 text-3xl font-headline font-black text-primary">Electronic Ticket</h1>
                <p className="mt-2 text-sm text-on-surface-variant">
                  View your electronic ticket details and QR code.
                </p>
              </div>
              <span className={`w-fit rounded-full border px-4 py-2 text-sm font-black ${statusClassName(ticket.status)}`}>
                {ticket.status}
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
                      QR Ticket Display
                    </div>
                    <QRPreview payload={ticket.qrCode?.payload} />
                  </div>

                  <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
                    <div className="mb-3 flex items-center gap-2 text-lg font-black text-primary">
                      <Ticket className="h-5 w-5" />
                      Ticket Information
                    </div>
                    <InfoRow label="Ticket ID" value={ticket.ticketCode} />
                    <InfoRow label="Route" value={ticket.routeNumber} />
                    <InfoRow label="Departure Stop" value={ticket.departureLocation} />
                    <InfoRow label="Destination Stop" value={ticket.destinationLocation} />
                    <InfoRow label="Travel Date" value={formatDate(ticket.serviceDate)} />
                    <InfoRow label="Departure Time" value={ticket.departureTime} />
                    <InfoRow label="Seat Information" value={ticket.seatNumber} />
                    <InfoRow label="Passenger" value={ticket.passengerInfo?.fullName} />
                    <InfoRow label="Ticket Type" value={ticket.ticketType} />
                    <InfoRow label="Ticket Price" value={formatCurrency(ticket.ticketPrice)} />
                    <InfoRow label="Payment Method" value={ticket.paymentMethod} />
                    <InfoRow label="Purchase Time" value={formatDate(ticket.purchasedAt, 'dd MMM yyyy HH:mm')} />
                  </div>
                </div>

                <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
                  <div className="mb-4 flex items-center gap-2 text-lg font-black text-primary">
                    <MapPin className="h-5 w-5" />
                    Trip Information
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
                              {stop.isBoardingPoint ? 'Boarding point' : stop.isDestination ? 'Arrival point' : 'Bus stop'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-4 text-sm">
                      <div className="flex items-center gap-2 font-black text-primary">
                        <Clock3 className="h-4 w-4" />
                        Estimated Arrival
                      </div>
                      <p className="mt-3 text-on-surface-variant">{ticket.tripInfo?.estimatedArrivalTime}</p>
                      <p className="mt-3 text-on-surface-variant">
                        Progress: <strong className="text-primary">{ticket.tripInfo?.progressPercent || 0}%</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="space-y-6">
                <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
                  <h2 className="text-lg font-black text-primary">Ticket Status</h2>
                  <div className="mt-4 space-y-1">
                    <InfoRow label="Status" value={ticket.status} />
                    <InfoRow label="Valid From" value={`${formatDate(ticket.serviceDate)} ${ticket.departureTime}`} />
                    <InfoRow label="Valid Until" value={formatDate(ticket.serviceDate)} />
                    <InfoRow label="Used" value={ticket.usedAt ? formatDate(ticket.usedAt, 'dd MMM yyyy HH:mm') : 'No'} />
                    <InfoRow label="Trip Remaining" value={ticket.status === 'ACTIVE' ? '1 / 1' : '0 / 1'} />
                  </div>
                </div>

                <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
                  <h2 className="text-lg font-black text-primary">Action Panel</h2>
                  <div className="mt-4 space-y-3">
                    <button type="button" onClick={handleDownload} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white">
                      <Download className="h-4 w-4" />
                      Download Ticket
                    </button>
                    <button type="button" onClick={handleShare} className="flex w-full items-center justify-center gap-2 rounded-full border border-outline-variant px-4 py-3 text-sm font-bold text-primary">
                      <Share2 className="h-4 w-4" />
                      Share Ticket
                    </button>
                    <button
                      type="button"
                      onClick={handleAddToCalendar}
                      disabled={!ticket.actionAvailability?.addToCalendar}
                      className="flex w-full items-center justify-center gap-2 rounded-full border border-outline-variant px-4 py-3 text-sm font-bold text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CalendarPlus className="h-4 w-4" />
                      Add Trip to Calendar
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={!ticket.canCancel || isCancelling}
                      className="flex w-full items-center justify-center gap-2 rounded-full border border-red-200 px-4 py-3 text-sm font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isCancelling ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      Cancel Ticket
                    </button>
                  </div>
                </div>

                <div className="rounded-[24px] border border-outline-variant/40 bg-primary-fixed p-5 text-on-primary-fixed">
                  <h2 className="text-lg font-black">Important Notes</h2>
                  <div className="mt-4 space-y-3 text-sm">
                    {(ticket.importantNotes || []).map((note) => (
                      <p key={note}>{note}</p>
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
