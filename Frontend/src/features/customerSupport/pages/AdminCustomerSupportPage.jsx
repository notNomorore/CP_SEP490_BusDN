import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Header from '../../../shared/components/navigation/Header.jsx';
import Footer from '../../../shared/components/common/Footer.jsx';
import customerSupportService, {
  CASE_STATUSES,
  CASE_TYPES,
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  PRIORITIES,
  RECOVERY_STATUSES,
} from '../services/customerSupportService.js';

const STATUS_BADGE = {
  PENDING: 'bg-blue-100 text-blue-800',
  OPEN: 'bg-blue-100 text-blue-800',
  SUBMITTED: 'bg-blue-100 text-blue-800',
  UNDER_REVIEW: 'bg-amber-100 text-amber-900',
  IN_PROGRESS: 'bg-amber-100 text-amber-900',
  WAITING_FOR_PASSENGER: 'bg-purple-100 text-purple-800',
  RESPONDED: 'bg-green-100 text-green-800',
  RESOLVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  CLOSED: 'bg-slate-100 text-slate-700',
};

const TYPE_BADGE = {
  COMPLAINT: 'bg-purple-100 text-purple-800',
  LOST_ITEM: 'bg-orange-100 text-orange-900',
  SERVICE_FEEDBACK: 'bg-emerald-100 text-emerald-800',
};

const PRIORITY_BADGE = {
  LOW: 'bg-slate-100 text-slate-700',
  NORMAL: 'bg-slate-100 text-slate-700',
  MEDIUM: 'bg-amber-100 text-amber-900',
  HIGH: 'bg-orange-100 text-orange-900',
  URGENT: 'bg-red-100 text-red-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

const formatDateTime = (value) => (
  value
    ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
    : 'Chua co'
);

const getErrorMessage = (error) => {
  if (!error) return 'Khong the xu ly yeu cau.';
  if (typeof error === 'string') return error;
  if (error.errors && typeof error.errors === 'object') return Object.values(error.errors).join(' ');
  return error.message || 'Khong the xu ly yeu cau.';
};

const getLabel = (items, value) => items.find((item) => item.value === value)?.label || value || 'Chua co';

const AdminCustomerSupportPage = () => {
  const [filters, setFilters] = useState({
    type: 'ALL',
    status: 'ALL',
    priority: 'ALL',
    category: 'ALL',
    rating: 'ALL',
    search: '',
    assignedOnly: false,
  });
  const [cases, setCases] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [selectedCase, setSelectedCase] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('IN_PROGRESS');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [responseMessage, setResponseMessage] = useState('');
  const [nextStatus, setNextStatus] = useState('IN_PROGRESS');
  const [lostItemNote, setLostItemNote] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState('SEARCHING');
  const [lostItemStatus, setLostItemStatus] = useState('IN_PROGRESS');
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedType = selectedCase?.type;
  const isFeedback = selectedType === 'SERVICE_FEEDBACK';
  const isComplaint = selectedType === 'COMPLAINT';
  const isLostItem = selectedType === 'LOST_ITEM';

  const conversation = useMemo(() => (
    [...(selectedCase?.conversation?.length ? selectedCase.conversation : selectedCase?.responses || [])]
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  ), [selectedCase?.conversation, selectedCase?.responses]);

  const updateFilter = (key, value) => {
    setSelectedCase(null);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const loadCases = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await customerSupportService.listAdminCases({
        ...filters,
        assignedOnly: String(filters.assignedOnly),
      });
      setCases(response.data || []);
      setMeta(response.meta || { page: 1, totalPages: 1, total: 0 });
      if (!selectedCase && response.data?.length) {
        setSelectedCase(response.data[0]);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [filters, selectedCase]);

  const loadAnalytics = useCallback(async () => {
    try {
      const response = await customerSupportService.getFeedbackAnalytics();
      setAnalytics(response.data);
    } catch {
      setAnalytics(null);
    }
  }, []);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const loadCaseDetail = async (caseId) => {
    setIsDetailLoading(true);

    try {
      const response = await customerSupportService.getAdminCaseDetail(caseId);
      setSelectedCase(response.data);
      setFeedbackStatus(response.data?.status === 'PENDING' ? 'IN_PROGRESS' : response.data?.status || 'IN_PROGRESS');
      setResolutionSummary(response.data?.resolutionSummary || '');
      setFeedbackMessage('');
      setNextStatus(response.data?.status === 'OPEN' ? 'IN_PROGRESS' : response.data?.status || 'IN_PROGRESS');
      setRecoveryStatus(response.data?.lostItem?.recoveryStatus || 'SEARCHING');
      setLostItemStatus(response.data?.status || 'IN_PROGRESS');
      setLostItemNote('');
      setResponseMessage('');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDetailLoading(false);
    }
  };

  const refreshAfterMutation = async (nextCase) => {
    setSelectedCase(nextCase);
    await Promise.all([loadCases(), loadAnalytics()]);
  };

  const handleAssignToSelf = async () => {
    if (!selectedCase?.id) return;
    setIsSubmitting(true);

    try {
      const response = await customerSupportService.assignFeedback(selectedCase.id);
      await refreshAfterMutation(response.data);
      toast.success('Feedback da duoc gan cho ban.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateFeedback = async (event) => {
    event.preventDefault();
    if (!selectedCase?.id) return;
    setIsSubmitting(true);

    try {
      const response = await customerSupportService.updateFeedback(selectedCase.id, {
        message: feedbackMessage,
        status: feedbackStatus,
        resolutionSummary,
      });
      setFeedbackMessage('');
      await refreshAfterMutation(response.data);
      toast.success('Feedback da duoc cap nhat.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRespondToComplaint = async (event) => {
    event.preventDefault();
    if (!selectedCase?.id) return;
    setIsSubmitting(true);

    try {
      const response = await customerSupportService.respondToComplaint(selectedCase.id, {
        message: responseMessage,
        status: nextStatus,
      });
      setResponseMessage('');
      await refreshAfterMutation(response.data);
      toast.success('Complaint response saved.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateLostItem = async (event) => {
    event.preventDefault();
    if (!selectedCase?.id) return;
    setIsSubmitting(true);

    try {
      const response = await customerSupportService.updateLostItemCase(selectedCase.id, {
        recoveryStatus,
        status: lostItemStatus,
        note: lostItemNote,
      });
      setLostItemNote('');
      await refreshAfterMutation(response.data);
      toast.success('Lost item case updated.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pt-24">
        <section className="bg-primary text-surface-bright">
          <div className="mx-auto max-w-7xl px-6 py-10">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-tertiary-fixed">Customer Support</p>
            <h1 className="mt-3 text-4xl font-headline font-black">Feedback Management</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-surface-variant/85">
              Manage passenger feedback from submission to assignment, response, resolution, and closure.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 pt-8">
          <div className="grid gap-4 md:grid-cols-4">
            <Metric label="Total feedback" value={analytics?.totalFeedback ?? 0} />
            <Metric label="Average rating" value={`${analytics?.averageRating ?? 0}/5`} />
            <Metric label="Resolution rate" value={`${analytics?.resolutionRate ?? 0}%`} />
            <Metric label="Avg response" value={`${analytics?.averageResponseHours ?? 0}h`} />
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-xl shadow-primary/5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-headline font-black text-primary">Tickets</h2>
                <p className="mt-1 text-sm text-on-surface-variant">Search, filter, assign, and process support cases.</p>
              </div>
              <button
                type="button"
                onClick={loadCases}
                className="rounded-full border border-outline-variant px-4 py-2 text-sm font-bold text-primary hover:bg-surface-container"
              >
                Refresh
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <input
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
                className="rounded-xl border border-outline-variant/70 px-3 py-2.5 text-sm outline-none focus:border-primary"
                placeholder="Search title, content, reference"
              />
              <select value={filters.type} onChange={(event) => updateFilter('type', event.target.value)} className="rounded-xl border border-outline-variant/70 px-3 py-2.5 text-sm">
                <option value="ALL">All types</option>
                {CASE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className="rounded-xl border border-outline-variant/70 px-3 py-2.5 text-sm">
                {CASE_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <select value={filters.priority} onChange={(event) => updateFilter('priority', event.target.value)} className="rounded-xl border border-outline-variant/70 px-3 py-2.5 text-sm">
                {PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <select value={filters.category} onChange={(event) => updateFilter('category', event.target.value)} className="rounded-xl border border-outline-variant/70 px-3 py-2.5 text-sm">
                <option value="ALL">All feedback categories</option>
                {FEEDBACK_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <select value={filters.rating} onChange={(event) => updateFilter('rating', event.target.value)} className="rounded-xl border border-outline-variant/70 px-3 py-2.5 text-sm">
                <option value="ALL">All ratings</option>
                {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} stars</option>)}
              </select>
              <label className="flex items-center gap-2 rounded-xl border border-outline-variant/70 px-3 py-2.5 text-sm font-bold text-primary md:col-span-2">
                <input
                  type="checkbox"
                  checked={filters.assignedOnly}
                  onChange={(event) => updateFilter('assignedOnly', event.target.checked)}
                />
                View assigned tickets only
              </label>
            </div>

            <div className="mt-5 space-y-3">
              {isLoading ? (
                <div className="rounded-xl bg-surface-container p-6 text-center text-on-surface-variant">Loading tickets...</div>
              ) : cases.length === 0 ? (
                <div className="rounded-xl bg-surface-container p-6 text-center text-on-surface-variant">No matching tickets.</div>
              ) : cases.map((supportCase) => (
                <button
                  key={supportCase.id}
                  type="button"
                  onClick={() => loadCaseDetail(supportCase.id)}
                  className={`w-full rounded-xl border p-4 text-left transition ${selectedCase?.id === supportCase.id ? 'border-primary bg-primary-fixed/30' : 'border-outline-variant/30 bg-white hover:bg-surface-container-low'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-black text-primary">{supportCase.title}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {supportCase.passenger?.fullName || 'Passenger'} - {formatDateTime(supportCase.createdAt)}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${TYPE_BADGE[supportCase.type]}`}>
                      {getLabel(CASE_TYPES, supportCase.type)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_BADGE[supportCase.status] || STATUS_BADGE.PENDING}`}>
                      {getLabel(CASE_STATUSES, supportCase.status)}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${PRIORITY_BADGE[supportCase.priority] || PRIORITY_BADGE.LOW}`}>
                      {supportCase.priority || 'LOW'}
                    </span>
                    {supportCase.assignedTo ? <span className="rounded-full bg-surface-container px-3 py-1 text-xs font-bold text-on-surface-variant">Assigned</span> : null}
                  </div>
                </button>
              ))}
            </div>
            <p className="mt-4 text-sm font-semibold text-on-surface-variant">{meta.total || 0} tickets</p>
          </aside>

          <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-xl shadow-primary/5">
            {isDetailLoading ? (
              <div className="rounded-xl bg-surface-container p-6 text-center text-on-surface-variant">Loading detail...</div>
            ) : !selectedCase ? (
              <div className="rounded-xl bg-surface-container p-6 text-center text-on-surface-variant">Select a ticket to start.</div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">{selectedCase.referenceNumber}</p>
                    <h2 className="mt-1 text-2xl font-headline font-black text-primary">{selectedCase.title}</h2>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {selectedCase.passenger?.fullName || 'Passenger'} - {selectedCase.passenger?.email || selectedCase.passenger?.phone || 'No contact'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-4 py-2 text-sm font-bold ${TYPE_BADGE[selectedType]}`}>{getLabel(CASE_TYPES, selectedType)}</span>
                    <span className={`rounded-full px-4 py-2 text-sm font-bold ${STATUS_BADGE[selectedCase.status] || STATUS_BADGE.PENDING}`}>{getLabel(CASE_STATUSES, selectedCase.status)}</span>
                  </div>
                </div>

                <dl className="grid gap-3 md:grid-cols-2">
                  <InfoRow label="Passenger email" value={selectedCase.passenger?.email || 'Chua co'} />
                  <InfoRow label="Passenger phone" value={selectedCase.passenger?.phone || 'Chua co'} />
                  <InfoRow label="Category" value={getLabel(FEEDBACK_CATEGORIES, selectedCase.category)} />
                  <InfoRow label="Rating" value={selectedCase.ratingScore ? `${selectedCase.ratingScore}/5` : 'Chua co'} />
                  <InfoRow label="Route / trip" value={selectedCase.routeName || selectedCase.tripCode || selectedCase.relatedTripId || 'Chua co'} />
                  <InfoRow label="Assigned admin" value={selectedCase.assignedTo?.fullName || 'Not assigned'} />
                  <InfoRow label="Priority" value={selectedCase.priority || 'LOW'} />
                  <InfoRow label="Submitted" value={formatDateTime(selectedCase.createdAt)} />
                </dl>

                <div className="rounded-xl bg-surface-container-low p-4">
                  <p className="text-sm font-black text-primary">Passenger message</p>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">{selectedCase.description}</p>
                </div>

                {isFeedback ? (
                  <form onSubmit={handleUpdateFeedback} className="rounded-2xl border border-outline-variant/30 bg-white p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <h3 className="text-lg font-headline font-black text-primary">Feedback workflow</h3>
                      <button
                        type="button"
                        onClick={handleAssignToSelf}
                        disabled={isSubmitting}
                        className="rounded-full border border-outline-variant px-4 py-2 text-sm font-bold text-primary hover:bg-surface-container disabled:opacity-50"
                      >
                        Assign to self
                      </button>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-bold text-on-surface">Next status</span>
                        <select value={feedbackStatus} onChange={(event) => setFeedbackStatus(event.target.value)} className="w-full rounded-xl border border-outline-variant/70 px-3 py-2.5 text-sm">
                          {FEEDBACK_STATUSES.filter((item) => item.value !== 'ALL').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-bold text-on-surface">Resolution summary</span>
                        <input value={resolutionSummary} onChange={(event) => setResolutionSummary(event.target.value)} className="w-full rounded-xl border border-outline-variant/70 px-3 py-2.5 text-sm" placeholder="Visible resolution note" />
                      </label>
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-sm font-bold text-on-surface">Reply to passenger</span>
                        <textarea value={feedbackMessage} onChange={(event) => setFeedbackMessage(event.target.value)} rows={4} className="w-full rounded-xl border border-outline-variant/70 px-4 py-3 text-sm" placeholder="Ask for more information, explain the decision, or confirm resolution." />
                      </label>
                    </div>
                    <button type="submit" disabled={isSubmitting} className="mt-4 rounded-full bg-primary px-6 py-3 text-sm font-black text-white disabled:opacity-50">
                      Save feedback update
                    </button>
                  </form>
                ) : null}

                {isComplaint ? (
                  <form onSubmit={handleRespondToComplaint} className="rounded-2xl border border-outline-variant/30 bg-white p-5">
                    <h3 className="text-lg font-headline font-black text-primary">Complaint response</h3>
                    <textarea value={responseMessage} onChange={(event) => setResponseMessage(event.target.value)} rows={4} className="mt-4 w-full rounded-xl border border-outline-variant/70 px-4 py-3 text-sm" placeholder="Response message" />
                    <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className="mt-3 rounded-xl border border-outline-variant/70 px-3 py-2.5 text-sm">
                      {CASE_STATUSES.filter((item) => item.value !== 'ALL').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                    <button type="submit" disabled={isSubmitting || !responseMessage.trim()} className="mt-4 rounded-full bg-primary px-6 py-3 text-sm font-black text-white disabled:opacity-50">Save response</button>
                  </form>
                ) : null}

                {isLostItem ? (
                  <form onSubmit={handleUpdateLostItem} className="rounded-2xl border border-outline-variant/30 bg-white p-5">
                    <h3 className="text-lg font-headline font-black text-primary">Lost item workflow</h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <select value={recoveryStatus} onChange={(event) => setRecoveryStatus(event.target.value)} className="rounded-xl border border-outline-variant/70 px-3 py-2.5 text-sm">
                        {RECOVERY_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                      <select value={lostItemStatus} onChange={(event) => setLostItemStatus(event.target.value)} className="rounded-xl border border-outline-variant/70 px-3 py-2.5 text-sm">
                        {CASE_STATUSES.filter((item) => item.value !== 'ALL').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                      <textarea value={lostItemNote} onChange={(event) => setLostItemNote(event.target.value)} rows={3} className="rounded-xl border border-outline-variant/70 px-4 py-3 text-sm md:col-span-2" placeholder="Processing note" />
                    </div>
                    <button type="submit" disabled={isSubmitting} className="mt-4 rounded-full bg-primary px-6 py-3 text-sm font-black text-white disabled:opacity-50">Update lost item</button>
                  </form>
                ) : null}

                <section className="rounded-2xl border border-outline-variant/30 bg-white p-5">
                  <h3 className="text-lg font-headline font-black text-primary">Conversation history</h3>
                  {conversation.length === 0 ? (
                    <p className="mt-3 rounded-xl bg-surface-container p-4 text-sm text-on-surface-variant">No messages yet.</p>
                  ) : (
                    <ul className="mt-3 space-y-3">
                      {conversation.map((message) => (
                        <li key={message.id || message._id || `${message.createdAt}-${message.message}`} className="rounded-xl bg-surface-container-low p-4">
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-sm font-bold text-on-surface">{message.senderRole || message.responder?.role || 'ADMIN'}</p>
                            <span className="shrink-0 text-xs text-on-surface-variant">{formatDateTime(message.createdAt)}</span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-on-surface-variant">{message.message}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}
          </section>
        </section>
      </main>
      <Footer />
    </div>
  );
};

const Metric = ({ label, value }) => (
  <div className="rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-lg shadow-primary/5">
    <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">{label}</p>
    <p className="mt-2 text-2xl font-headline font-black text-primary">{value}</p>
  </div>
);

const InfoRow = ({ label, value }) => (
  <div className="rounded-xl bg-surface-container-low px-4 py-3">
    <dt className="text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">{label}</dt>
    <dd className="mt-1 font-black text-on-surface">{value}</dd>
  </div>
);

export default AdminCustomerSupportPage;
