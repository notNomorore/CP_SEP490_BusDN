import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Clock,
  LoaderCircle,
  MessageSquareReply,
  RefreshCcw,
  Search,
  Send,
  Star,
} from 'lucide-react';
import Header from '../../../shared/components/navigation/Header.jsx';
import Footer from '../../../shared/components/common/Footer.jsx';
import customerSupportService, {
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
} from '../services/customerSupportService.js';

const STATUS_BADGE = {
  PENDING: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-900',
  WAITING_FOR_PASSENGER: 'bg-purple-100 text-purple-800',
  RESOLVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
  CLOSED: 'bg-slate-100 text-slate-700',
};

const formatDateTime = (value) => (
  value
    ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
    : 'Chua co'
);

const getLabel = (items, value) => items.find((item) => item.value === value)?.label || value || 'Chua co';

const getErrorMessage = (error) => {
  if (!error) return 'Khong the xu ly yeu cau.';
  if (typeof error === 'string') return error;
  if (error.errors && typeof error.errors === 'object') return Object.values(error.errors).join(' ');
  return error.message || 'Khong the xu ly yeu cau.';
};

const MyFeedbackPage = () => {
  const [feedback, setFeedback] = useState([]);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [reply, setReply] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isReplying, setIsReplying] = useState(false);

  const sortedConversation = useMemo(() => (
    [...(selectedFeedback?.conversation || [])].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  ), [selectedFeedback?.conversation]);

  const loadFeedback = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await customerSupportService.listMyFeedback({ status, search, page });
      setFeedback(response.data || []);
      setMeta(response.meta || { page, totalPages: 1, total: 0 });

      if (!selectedFeedback && response.data?.length) {
        setSelectedFeedback(response.data[0]);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [page, search, selectedFeedback, status]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const loadDetail = async (caseId) => {
    setIsDetailLoading(true);

    try {
      const response = await customerSupportService.getMyFeedback(caseId);
      setSelectedFeedback(response.data);
      setReply('');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleReply = async (event) => {
    event.preventDefault();
    if (!selectedFeedback?.id || !reply.trim()) return;

    setIsReplying(true);

    try {
      const response = await customerSupportService.replyToFeedback(selectedFeedback.id, { message: reply.trim() });
      setSelectedFeedback(response.data);
      setReply('');
      toast.success('Da gui phan hoi bo sung.');
      await loadFeedback();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsReplying(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-container-low flex flex-col">
      <Header />
      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 pb-14 pt-28 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-2xl border border-outline-variant/40 bg-white p-5 shadow-xl shadow-primary/5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-on-tertiary-container">Passenger feedback</p>
              <h1 className="mt-1 text-2xl font-headline font-black text-primary">My Feedback</h1>
            </div>
            <button
              type="button"
              onClick={loadFeedback}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-outline-variant px-4 py-2 text-sm font-bold text-primary hover:bg-surface-container"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_180px]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-on-surface-variant" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                  setSelectedFeedback(null);
                }}
                className="w-full rounded-xl border border-outline-variant/60 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary"
                placeholder="Search title or content"
              />
            </label>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
                setSelectedFeedback(null);
              }}
              className="rounded-xl border border-outline-variant/60 px-3 py-2.5 text-sm outline-none focus:border-primary"
            >
              {FEEDBACK_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>

          <div className="mt-5 space-y-3">
            {isLoading ? (
              <div className="rounded-xl bg-surface-container p-6 text-center text-on-surface-variant">Loading feedback...</div>
            ) : feedback.length === 0 ? (
              <div className="rounded-xl bg-surface-container p-6 text-center text-on-surface-variant">No feedback found.</div>
            ) : feedback.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => loadDetail(item.id)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  selectedFeedback?.id === item.id
                    ? 'border-primary bg-primary-fixed/30'
                    : 'border-outline-variant/40 bg-white hover:bg-surface-container-low'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black text-primary">{item.title}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {getLabel(FEEDBACK_CATEGORIES, item.category)} - {item.routeName || item.tripCode || 'No route'}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${STATUS_BADGE[item.status] || STATUS_BADGE.PENDING}`}>
                    {getLabel(FEEDBACK_STATUSES, item.status)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-on-surface-variant">
                  <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5" /> {item.ratingScore || '-'}/5</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatDateTime(item.createdAt)}</span>
                  <span>Updated {formatDateTime(item.updatedAt)}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between text-sm">
            <span className="font-semibold text-on-surface-variant">{meta.total || 0} feedback</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-full border border-outline-variant px-3 py-1.5 font-bold disabled:opacity-50"
              >
                Prev
              </button>
              <span className="font-bold text-primary">{meta.page || page}/{meta.totalPages || 1}</span>
              <button
                type="button"
                disabled={page >= (meta.totalPages || 1)}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-full border border-outline-variant px-3 py-1.5 font-bold disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-outline-variant/40 bg-white p-5 shadow-xl shadow-primary/5">
          {isDetailLoading ? (
            <div className="rounded-xl bg-surface-container p-6 text-center text-on-surface-variant">Loading detail...</div>
          ) : !selectedFeedback ? (
            <div className="rounded-xl bg-surface-container p-6 text-center text-on-surface-variant">Select a feedback ticket.</div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">{selectedFeedback.referenceNumber}</p>
                  <h2 className="mt-1 text-2xl font-headline font-black text-primary">{selectedFeedback.title}</h2>
                </div>
                <span className={`w-fit rounded-full px-4 py-2 text-sm font-black ${STATUS_BADGE[selectedFeedback.status] || STATUS_BADGE.PENDING}`}>
                  {getLabel(FEEDBACK_STATUSES, selectedFeedback.status)}
                </span>
              </div>

              <dl className="grid gap-3 md:grid-cols-2">
                <InfoRow label="Rating" value={`${selectedFeedback.ratingScore || '-'} / 5`} />
                <InfoRow label="Category" value={getLabel(FEEDBACK_CATEGORIES, selectedFeedback.category)} />
                <InfoRow label="Route / trip" value={selectedFeedback.routeName || selectedFeedback.tripCode || 'No route'} />
                <InfoRow label="Assigned admin" value={selectedFeedback.assignedTo?.fullName || 'Not assigned'} />
                <InfoRow label="Submitted" value={formatDateTime(selectedFeedback.createdAt)} />
                <InfoRow label="Last updated" value={formatDateTime(selectedFeedback.updatedAt)} />
              </dl>

              <div className="rounded-xl bg-surface-container-low p-4">
                <p className="text-sm font-black text-primary">Submitted information</p>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">{selectedFeedback.description}</p>
              </div>

              {selectedFeedback.adminResponse || selectedFeedback.resolutionSummary ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  {selectedFeedback.adminResponse ? <p><strong>Admin response:</strong> {selectedFeedback.adminResponse}</p> : null}
                  {selectedFeedback.resolutionSummary ? <p className="mt-2"><strong>Resolution:</strong> {selectedFeedback.resolutionSummary}</p> : null}
                </div>
              ) : null}

              <section>
                <h3 className="flex items-center gap-2 text-lg font-headline font-black text-primary">
                  <MessageSquareReply className="h-5 w-5" />
                  Conversation
                </h3>
                <div className="mt-3 space-y-3">
                  {sortedConversation.length === 0 ? (
                    <p className="rounded-xl bg-surface-container p-4 text-sm text-on-surface-variant">No messages yet.</p>
                  ) : sortedConversation.map((message) => (
                    <div
                      key={message.id || `${message.createdAt}-${message.message}`}
                      className={`rounded-xl p-4 ${
                        message.senderRole === 'ADMIN'
                          ? 'bg-primary-fixed text-on-primary-fixed'
                          : 'bg-surface-container-low text-on-surface'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-black">{message.senderRole === 'ADMIN' ? 'Admin' : 'Passenger'}</p>
                        <span className="text-xs opacity-75">{formatDateTime(message.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6">{message.message}</p>
                    </div>
                  ))}
                </div>
              </section>

              {selectedFeedback.status === 'WAITING_FOR_PASSENGER' ? (
                <form onSubmit={handleReply} className="rounded-xl border border-outline-variant/50 bg-surface-container-low p-4">
                  <label className="block space-y-2">
                    <span className="text-sm font-black text-primary">Add follow-up information</span>
                    <textarea
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-outline-variant/60 px-4 py-3 text-sm outline-none focus:border-primary"
                      placeholder="Provide the requested trip number, boarding time, or extra details."
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={isReplying || !reply.trim()}
                    className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                  >
                    {isReplying ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send follow-up
                  </button>
                </form>
              ) : null}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

const InfoRow = ({ label, value }) => (
  <div className="rounded-xl bg-surface-container-low px-4 py-3">
    <dt className="text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">{label}</dt>
    <dd className="mt-1 font-black text-on-surface">{value}</dd>
  </div>
);

export default MyFeedbackPage;
