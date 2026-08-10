import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Header from '../../../shared/components/navigation/Header.jsx';
import Footer from '../../../shared/components/common/Footer.jsx';
import customerSupportService, {
  ASSIGNED_TEAMS,
  CASE_STATUSES,
  CASE_TYPES,
  CORRECTIVE_ACTION_TYPES,
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  PRIORITIES,
  RECOVERY_STATUSES,
} from '../services/customerSupportService.js';
import { resolveBackendUrl } from '../../../shared/config/apiConfig.js';

const STATUS_BADGE = {
  NEW: 'bg-blue-100 text-blue-800',
  IN_REVIEW: 'bg-cyan-100 text-cyan-800',
  INVESTIGATING: 'bg-amber-100 text-amber-900',
  WAITING_FOR_INFORMATION: 'bg-purple-100 text-purple-800',
  ACTION_REQUIRED: 'bg-orange-100 text-orange-900',
  REOPENED: 'bg-indigo-100 text-indigo-800',
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

const ENTERPRISE_PRIORITIES = PRIORITIES.filter((item) => ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'].includes(item.value));
const CUSTOMER_VISIBLE_STATUSES = new Set([
  'IN_REVIEW',
  'INVESTIGATING',
  'WAITING_FOR_INFORMATION',
  'ACTION_REQUIRED',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
]);

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

const getAttachmentUrl = (attachment) => {
  const path = attachment?.path || attachment?.url;
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;

  return resolveBackendUrl(path);
};

const isImageAttachment = (attachment) => String(attachment?.mimeType || '').startsWith('image/');

const buildFeedbackPayload = ({
  message,
  status,
  resolutionSummary,
  priority,
  waitingForInformationReason,
  correctiveAction,
}) => {
  const payload = {};
  const trimmedMessage = message.trim();
  const trimmedResolution = resolutionSummary.trim();
  const trimmedWaitingReason = waitingForInformationReason.trim();

  if (status) {
    payload.status = status;
  }

  if (trimmedMessage) {
    payload.message = trimmedMessage;
  }

  if (trimmedResolution) {
    payload.resolutionSummary = trimmedResolution;
  }

  if (priority) {
    payload.priority = priority;
  }

  if (trimmedWaitingReason) {
    payload.waitingForInformationReason = trimmedWaitingReason;
  }

  if (correctiveAction?.description?.trim()) {
    payload.correctiveAction = {
      actionType: correctiveAction.actionType || 'OTHER',
      description: correctiveAction.description.trim(),
    };
  }

  return payload;
};

const getSlaDisplay = (supportCase) => {
  if (!supportCase?.slaDueAt) return { label: 'Chua co', tone: 'text-on-surface' };
  if (['RESOLVED', 'CLOSED'].includes(supportCase.status)) {
    return { label: 'Completed', tone: 'text-emerald-700' };
  }
  const remainingMs = new Date(supportCase.slaDueAt).getTime() - Date.now();
  if (remainingMs <= 0) return { label: 'SLA BREACHED', tone: 'text-red-700' };
  const hours = Math.floor(remainingMs / 36e5);
  const minutes = Math.floor((remainingMs % 36e5) / 60000);
  return {
    label: `SLA: ${hours}h ${minutes}m remaining`,
    tone: remainingMs <= 2 * 36e5 ? 'text-orange-700' : 'text-emerald-700',
  };
};

const getWorkflowHint = (supportCase) => {
  if (!supportCase) return '';
  if (!supportCase.assignedTo) return 'Gan ticket cho admin truoc khi xu ly de tranh trung viec.';
  if (supportCase.status === 'PENDING') return 'Bat dau xu ly bang cach doi trang thai sang Dang xu ly hoac hoi them thong tin.';
  if (['WAITING_FOR_INFORMATION', 'WAITING_FOR_PASSENGER'].includes(supportCase.status)) return 'Dang cho hanh khach bo sung thong tin. Khi khach tra loi, ticket se quay lai Dang dieu tra.';
  if (supportCase.status === 'RESOLVED') return 'Ticket da giai quyet. Co the dong ticket sau khi khong can trao doi them.';
  if (supportCase.status === 'CLOSED') return 'Ticket da dong.';
  return 'Cap nhat trang thai, gui phan hoi cho hanh khach, sau do giai quyet hoac dong ticket.';
};

const getReplyStatus = (supportCase) => (
  supportCase?.adminResponse
    ? `Da phan hoi ${formatDateTime(supportCase.adminResponseAt)}`
    : 'Chua phan hoi'
);

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
  const [feedbackPriority, setFeedbackPriority] = useState('NORMAL');
  const [waitingReason, setWaitingReason] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState({ actionType: 'OTHER', description: '' });
  const [assignedTeam, setAssignedTeam] = useState('ADMIN');
  const [responseMessage, setResponseMessage] = useState('');
  const [nextStatus, setNextStatus] = useState('IN_PROGRESS');
  const [lostItemNote, setLostItemNote] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState('SEARCHING');
  const [lostItemStatus, setLostItemStatus] = useState('IN_PROGRESS');
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState(null);
  const [notificationDraft, setNotificationDraft] = useState(null);
  const [notificationChannels, setNotificationChannels] = useState({ inApp: true, email: true });
  const [notificationMessage, setNotificationMessage] = useState('');

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

  const resetFilters = () => {
    setSelectedCase(null);
    setFilters({
      type: 'ALL',
      status: 'ALL',
      priority: 'ALL',
      category: 'ALL',
      rating: 'ALL',
      search: '',
      assignedOnly: false,
    });
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
      setFeedbackStatus(['PENDING', 'OPEN'].includes(response.data?.status) ? 'IN_REVIEW' : response.data?.status || 'IN_REVIEW');
      setFeedbackPriority(['LOW', 'NORMAL', 'HIGH', 'CRITICAL'].includes(response.data?.priority) ? response.data.priority : 'NORMAL');
      setWaitingReason(response.data?.waitingForInformationReason || '');
      setResolutionSummary(response.data?.resolutionSummary || '');
      setFeedbackMessage('');
      setInternalNote('');
      setCorrectiveAction({ actionType: 'OTHER', description: '' });
      setAssignedTeam(response.data?.assignedTeam || 'ADMIN');
      setPendingUpdate(null);
      setNotificationDraft(null);
      setNotificationMessage('');
      setNextStatus(response.data?.status === 'OPEN' ? 'IN_PROGRESS' : response.data?.status || 'IN_PROGRESS');
      setRecoveryStatus(response.data?.lostItem?.recoveryStatus || 'SEARCHING');
      setLostItemStatus(response.data?.status || 'IN_PROGRESS');
      setLostItemNote('');
      setResponseMessage('');
    } catch (error) {
      await handleMutationError(error);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const refreshAfterMutation = async (nextCase) => {
    setSelectedCase(nextCase);
    await Promise.all([loadCases(), loadAnalytics()]);
  };

  const handleMutationError = async (error) => {
    toast.error(getErrorMessage(error));

    if (error?.status === 409 || error?.statusCode === 409) {
      await Promise.all([
        selectedCase?.id ? loadCaseDetail(selectedCase.id) : Promise.resolve(),
        loadCases(),
        loadAnalytics(),
      ]);
    }
  };

  const handleAssignToSelf = async () => {
    if (!selectedCase?.id) return;
    setIsSubmitting(true);

    try {
      const response = await customerSupportService.assignFeedback(selectedCase.id, { assignedTeam });
      await refreshAfterMutation(response.data);
      toast.success('Feedback assignment updated.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateFeedback = async (event) => {
    event.preventDefault();
    if (!selectedCase?.id) return;
    const payload = buildFeedbackPayload({
      message: feedbackMessage,
      status: feedbackStatus,
      priority: feedbackPriority !== selectedCase.priority ? feedbackPriority : '',
      waitingForInformationReason: waitingReason,
      resolutionSummary,
      correctiveAction,
    });

    if (!payload.message && selectedCase.status === payload.status && !payload.resolutionSummary && !payload.priority && !payload.waitingForInformationReason && !payload.correctiveAction) {
      toast.error('Hay nhap cap nhat, doi trang thai, muc do uu tien, hoac them ket qua xu ly.');
      return;
    }

    if (payload.status === 'WAITING_FOR_INFORMATION' && !payload.message && !payload.waitingForInformationReason) {
      toast.error('Trang thai cho bo sung thong tin can ly do hoac noi dung gui khach.');
      return;
    }

    if (payload.status === 'RESOLVED' && !payload.resolutionSummary) {
      toast.error('Can nhap tom tat ket qua truoc khi danh dau da giai quyet.');
      return;
    }

    if (payload.status === 'RESOLVED' && !payload.correctiveAction && !(selectedCase.correctiveActions || []).length) {
      toast.error('Can ghi nhan hanh dong khac phuc hoac ket qua dieu tra truoc khi giai quyet.');
      return;
    }

    const customerVisible = CUSTOMER_VISIBLE_STATUSES.has(payload.status) || Boolean(payload.message) || Boolean(payload.resolutionSummary);

    if (customerVisible) {
      try {
        const response = await customerSupportService.previewCaseNotification(selectedCase.id, {
          status: payload.status,
        });
        const preview = response.data || {};
        setPendingUpdate(payload);
        setNotificationDraft(preview);
        setNotificationChannels({
          inApp: true,
          email: Boolean(preview.emailAvailable),
        });
        setNotificationMessage(preview.message || '');
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await customerSupportService.updateFeedback(selectedCase.id, payload);
      setFeedbackMessage('');
      setCorrectiveAction({ actionType: 'OTHER', description: '' });
      await refreshAfterMutation(response.data);
      toast.success('Feedback da duoc cap nhat.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmFeedbackUpdate = async () => {
    if (!selectedCase?.id || !pendingUpdate) return;
    if (!notificationChannels.inApp && !notificationChannels.email) {
      const confirmed = window.confirm('No notification will be sent to the passenger. Continue?');
      if (!confirmed) return;
    }

    setIsSubmitting(true);

    try {
      const response = await customerSupportService.updateFeedback(selectedCase.id, {
        ...pendingUpdate,
        notification: {
          confirmSend: notificationChannels.inApp || notificationChannels.email,
          channels: notificationChannels,
          title: notificationDraft?.title || 'Complaint update',
          message: notificationMessage,
        },
      });
      setFeedbackMessage('');
      setCorrectiveAction({ actionType: 'OTHER', description: '' });
      setPendingUpdate(null);
      setNotificationDraft(null);
      await refreshAfterMutation(response.data);
      const results = response.data?.notificationResults || [];
      const emailFailed = results.some((item) => item.channel === 'EMAIL' && item.status === 'FAILED');
      toast.success(emailFailed ? 'Complaint updated. Email notification failed.' : 'Complaint updated successfully.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddInternalNote = async (event) => {
    event.preventDefault();
    if (!selectedCase?.id || !internalNote.trim()) return;
    setIsSubmitting(true);

    try {
      const response = await customerSupportService.addInternalNote(selectedCase.id, {
        message: internalNote,
      });
      setInternalNote('');
      await refreshAfterMutation(response.data);
      toast.success('Internal note saved.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCorrectiveAction = async (event) => {
    event.preventDefault();
    if (!selectedCase?.id || !correctiveAction.description.trim()) return;
    setIsSubmitting(true);

    try {
      const response = await customerSupportService.addCorrectiveAction(selectedCase.id, correctiveAction);
      setCorrectiveAction({ actionType: 'OTHER', description: '' });
      await refreshAfterMutation(response.data);
      toast.success('Corrective action recorded.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFeedbackStatus = async (status, defaultMessage = '') => {
    setFeedbackStatus(status);
    if (defaultMessage) {
      setFeedbackMessage(defaultMessage);
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
      await handleMutationError(error);
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
      await handleMutationError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0fdf4] text-on-surface">
      <Header />
      <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-3 pb-6 pt-24 sm:px-4 lg:px-0 lg:pt-0">
        <section className="rounded-2xl border border-outline-variant/30 bg-white px-5 py-4 shadow-[0_4px_12px_rgba(51,65,85,0.08)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-on-tertiary-fixed-variant">Customer Support</p>
              <h1 className="mt-1 text-2xl font-headline font-black text-on-surface">Feedback Management</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-on-surface-variant">
                Theo dõi và xử lý phản hồi của hành khách từ lúc tiếp nhận đến khi phản hồi, giải quyết và đóng ticket.
              </p>
            </div>
            <button
              type="button"
              onClick={loadCases}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-white shadow-md shadow-primary/15 transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">refresh</span>
              Làm mới
            </button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon="forum" label="Total feedback" value={analytics?.totalFeedback ?? 0} tone="bg-blue-50 text-blue-600" />
          <Metric icon="star" label="Average rating" value={`${analytics?.averageRating ?? 0}/5`} tone="bg-yellow-50 text-yellow-600" />
          <Metric icon="task_alt" label="Resolution rate" value={`${analytics?.resolutionRate ?? 0}%`} tone="bg-emerald-50 text-emerald-600" />
          <Metric icon="timer" label="Average response" value={`${analytics?.averageResponseHours ?? 0}h`} tone="bg-purple-50 text-purple-600" />
        </section>

        <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.95fr)] 2xl:grid-cols-[minmax(0,1.75fr)_minmax(420px,0.95fr)]">
          <aside className="min-w-0 rounded-2xl border border-outline-variant/30 bg-white p-4 shadow-[0_4px_12px_rgba(51,65,85,0.08)]">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 rounded-2xl border border-outline-variant/25 bg-surface-container-low/70 p-3">
                <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(120px,0.38fr))]">
                  <label className="relative min-w-0">
                    <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">search</span>
                    <input
                      value={filters.search}
                      onChange={(event) => updateFilter('search', event.target.value)}
                      className="h-10 w-full rounded-xl border-0 bg-white py-2 pl-10 pr-3 text-sm outline-none ring-1 ring-outline-variant/40 focus:ring-2 focus:ring-primary"
                      placeholder="Tìm kiếm tiêu đề, nội dung, mã ticket"
                    />
                  </label>
                  <FilterSelect value={filters.type} onChange={(value) => updateFilter('type', value)} label="All types" items={CASE_TYPES} />
                  <FilterSelect value={filters.status} onChange={(value) => updateFilter('status', value)} items={CASE_STATUSES} />
                  <FilterSelect value={filters.priority} onChange={(value) => updateFilter('priority', value)} items={PRIORITIES} />
                </div>
                <div className="grid gap-2 md:grid-cols-[minmax(180px,0.8fr)_minmax(130px,0.45fr)_minmax(220px,0.7fr)_auto]">
                  <select
                    value={filters.category}
                    onChange={(event) => updateFilter('category', event.target.value)}
                    className="h-10 min-w-0 rounded-xl border-0 bg-white px-3 text-sm outline-none ring-1 ring-outline-variant/40 focus:ring-2 focus:ring-primary"
                  >
                    <option value="ALL">All feedback categories</option>
                    {FEEDBACK_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                  <select
                    value={filters.rating}
                    onChange={(event) => updateFilter('rating', event.target.value)}
                    className="h-10 min-w-0 rounded-xl border-0 bg-white px-3 text-sm outline-none ring-1 ring-outline-variant/40 focus:ring-2 focus:ring-primary"
                  >
                    <option value="ALL">All ratings</option>
                    {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} stars</option>)}
                  </select>
                  <label className="flex h-10 min-w-0 items-center gap-2 rounded-xl bg-white px-3 text-sm font-bold text-primary ring-1 ring-outline-variant/40">
                    <input
                      type="checkbox"
                      checked={filters.assignedOnly}
                      onChange={(event) => updateFilter('assignedOnly', event.target.checked)}
                      className="rounded border-outline-variant text-primary focus:ring-primary"
                    />
                    <span className="truncate">View assigned tickets only</span>
                  </label>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="h-10 rounded-xl px-3 text-xs font-black text-on-surface-variant transition hover:bg-white hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    Xóa bộ lọc
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 px-1">
                <div>
                  <h2 className="text-lg font-headline font-black text-primary">Feedback list</h2>
                  <p className="text-xs font-semibold text-on-surface-variant">{meta.total || 0} tickets</p>
                </div>
              </div>
            </div>

            <div className="mt-3 max-h-none space-y-3 overflow-visible pr-0 xl:max-h-[calc(100vh-306px)] xl:overflow-y-auto xl:pr-1">
              {isLoading ? (
                <div className="rounded-xl bg-surface-container p-6 text-center text-on-surface-variant">Loading tickets...</div>
              ) : cases.length === 0 ? (
                <div className="rounded-xl bg-surface-container p-6 text-center text-on-surface-variant">No matching tickets.</div>
              ) : cases.map((supportCase) => (
                <FeedbackListItem
                  key={supportCase.id}
                  supportCase={supportCase}
                  selected={selectedCase?.id === supportCase.id}
                  onSelect={() => loadCaseDetail(supportCase.id)}
                />
              ))}
            </div>
          </aside>

          <section className="min-w-0 rounded-2xl border border-outline-variant/30 bg-white shadow-[0_4px_12px_rgba(51,65,85,0.08)] xl:sticky xl:top-0 xl:max-h-[calc(100vh-112px)] xl:overflow-hidden">
            {isDetailLoading ? (
              <div className="rounded-xl bg-surface-container p-6 text-center text-on-surface-variant">Loading detail...</div>
            ) : !selectedCase ? (
              <div className="rounded-xl bg-surface-container p-6 text-center text-on-surface-variant">Select a ticket to start.</div>
            ) : (
              <div className="flex h-full min-h-0 flex-col">
                <div className="border-b border-outline-variant/25 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="inline-flex rounded-lg bg-emerald-50 px-2 py-1 text-xs font-black uppercase tracking-[0.14em] text-primary">{selectedCase.referenceNumber}</p>
                    <h2 className="mt-3 text-xl font-headline font-black leading-tight text-on-surface [overflow-wrap:anywhere]">{selectedCase.title}</h2>
                    <p className="mt-2 text-sm text-on-surface-variant [overflow-wrap:anywhere]">
                      {selectedCase.passenger?.fullName || 'Passenger'} - {selectedCase.passenger?.email || selectedCase.passenger?.phone || 'No contact'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1.5 text-xs font-black ${TYPE_BADGE[selectedType]}`}>{getLabel(CASE_TYPES, selectedType)}</span>
                    <span className={`rounded-full px-3 py-1.5 text-xs font-black ${STATUS_BADGE[selectedCase.status] || STATUS_BADGE.PENDING}`}>{getLabel(CASE_STATUSES, selectedCase.status)}</span>
                    <span className={`rounded-full px-3 py-1.5 text-xs font-black ${PRIORITY_BADGE[selectedCase.priority] || PRIORITY_BADGE.LOW}`}>{selectedCase.priority || 'LOW'}</span>
                  </div>
                </div>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-visible p-5 xl:overflow-y-auto">
                <dl className="grid gap-3 md:grid-cols-2">
                  <InfoRow label="Passenger email" value={selectedCase.passenger?.email || 'Chua co'} />
                  <InfoRow label="Passenger phone" value={selectedCase.passenger?.phone || 'Chua co'} />
                  <InfoRow label="Category" value={getLabel(FEEDBACK_CATEGORIES, selectedCase.category)} />
                  <InfoRow label="Rating" value={selectedCase.ratingScore ? `${selectedCase.ratingScore}/5` : 'Chua co'} />
                  <InfoRow label="Route / trip" value={selectedCase.routeName || selectedCase.tripCode || selectedCase.relatedTripId || 'Chua co'} />
                  <InfoRow label="Assigned admin" value={selectedCase.assignedTo?.fullName || 'Not assigned'} />
                  <InfoRow label="Assigned team" value={getLabel(ASSIGNED_TEAMS, selectedCase.assignedTeam || 'UNASSIGNED')} />
                  <InfoRow label="Reply status" value={getReplyStatus(selectedCase)} />
                  <InfoRow label="Priority" value={selectedCase.priority || 'LOW'} />
                  <InfoRow label="Priority reason" value={selectedCase.priorityReason || 'Chua co'} />
                  <InfoRow label="SLA" value={<span className={getSlaDisplay(selectedCase).tone}>{getSlaDisplay(selectedCase).label}</span>} />
                  <InfoRow label="Submitted" value={formatDateTime(selectedCase.createdAt)} />
                </dl>

                <div className="rounded-xl bg-surface-container-low p-4">
                  <p className="text-sm font-black text-primary">Passenger message</p>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant [overflow-wrap:anywhere]">{selectedCase.description}</p>
                </div>

                {selectedCase.attachments?.length ? (
                  <section className="rounded-xl border border-outline-variant/30 bg-white p-4">
                    <p className="text-sm font-black text-primary">Attachments</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {selectedCase.attachments.map((attachment) => {
                        const url = getAttachmentUrl(attachment);
                        return (
                          <a
                            key={attachment._id || attachment.fileName || attachment.path}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-low text-sm font-bold text-primary"
                          >
                            {isImageAttachment(attachment) ? (
                              <img src={url} alt={attachment.originalName || 'Feedback attachment'} className="h-36 w-full object-cover" />
                            ) : null}
                            <span className="block truncate px-3 py-2">{attachment.originalName || attachment.fileName || 'Attachment'}</span>
                          </a>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
                  <p className="text-sm font-black text-primary">Current admin response</p>
                  {selectedCase.adminResponse ? (
                    <div className="mt-2 text-sm leading-6 text-on-surface-variant">
                      <p>{selectedCase.adminResponse}</p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                        {selectedCase.adminResponseBy?.fullName || 'Admin'} - {formatDateTime(selectedCase.adminResponseAt)}
                      </p>
                      {selectedCase.resolutionSummary ? <p className="mt-2"><strong>Resolution:</strong> {selectedCase.resolutionSummary}</p> : null}
                      {isFeedback ? (
                        <button
                          type="button"
                          onClick={() => setFeedbackMessage(selectedCase.adminResponse || '')}
                          className="mt-3 rounded-full border border-outline-variant px-4 py-2 text-xs font-black text-primary hover:bg-white"
                        >
                          Edit response
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-on-surface-variant">No response from Admin yet.</p>
                  )}
                </section>

                {isFeedback ? (
                  <form onSubmit={handleUpdateFeedback} className="rounded-2xl border border-outline-variant/30 bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-lg font-headline font-black text-primary">Feedback workflow</h3>
                        <p className="mt-1 text-sm text-on-surface-variant">{getWorkflowHint(selectedCase)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={assignedTeam}
                          onChange={(event) => setAssignedTeam(event.target.value)}
                          className="h-10 rounded-xl border border-outline-variant/70 px-3 text-sm"
                        >
                          {ASSIGNED_TEAMS.filter((item) => item.value !== 'UNASSIGNED').map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleAssignToSelf}
                          disabled={isSubmitting}
                          className="rounded-full border border-outline-variant px-4 py-2 text-sm font-bold text-primary hover:bg-surface-container disabled:opacity-50"
                        >
                          {selectedCase.assignedTo ? 'Reassign to self' : 'Assign to self'}
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuickFeedbackStatus('IN_PROGRESS')}
                        disabled={isSubmitting || !selectedCase.assignedTo || selectedCase.status === 'IN_PROGRESS'}
                        className="min-h-10 rounded-xl bg-primary px-4 py-2 text-sm font-black text-white hover:opacity-90 disabled:opacity-50"
                      >
                        Start handling
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeedbackStatus('WAITING_FOR_INFORMATION')}
                        disabled={isSubmitting || !selectedCase.assignedTo || selectedCase.status === 'WAITING_FOR_INFORMATION'}
                        className="min-h-10 rounded-xl border border-outline-variant/60 px-4 py-2 text-sm font-black text-primary hover:bg-surface-container disabled:opacity-50"
                      >
                        Need passenger info
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeedbackStatus('RESOLVED')}
                        disabled={isSubmitting || !selectedCase.assignedTo || selectedCase.status === 'RESOLVED'}
                        className="min-h-10 rounded-xl border border-outline-variant/60 px-4 py-2 text-sm font-black text-primary hover:bg-surface-container disabled:opacity-50"
                      >
                        Mark resolved
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickFeedbackStatus('CLOSED')}
                        disabled={isSubmitting || !selectedCase.assignedTo || selectedCase.status !== 'RESOLVED'}
                        className="min-h-10 rounded-xl border border-outline-variant/60 px-4 py-2 text-sm font-black text-primary hover:bg-surface-container disabled:opacity-50"
                      >
                        Close ticket
                      </button>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-bold text-on-surface">Next status</span>
                        <select value={feedbackStatus} onChange={(event) => setFeedbackStatus(event.target.value)} className="w-full rounded-xl border border-outline-variant/70 px-3 py-2.5 text-sm">
                          {FEEDBACK_STATUSES.filter((item) => item.value !== 'ALL' && !['PENDING', 'IN_PROGRESS', 'WAITING_FOR_PASSENGER', 'REJECTED'].includes(item.value)).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-bold text-on-surface">Priority</span>
                        <select value={feedbackPriority} onChange={(event) => setFeedbackPriority(event.target.value)} className="w-full rounded-xl border border-outline-variant/70 px-3 py-2.5 text-sm">
                          {ENTERPRISE_PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-bold text-on-surface">Resolution summary</span>
                        <input value={resolutionSummary} onChange={(event) => setResolutionSummary(event.target.value)} maxLength={1000} className="w-full rounded-xl border border-outline-variant/70 px-3 py-2.5 text-sm" placeholder="Visible resolution note" />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-bold text-on-surface">Waiting reason</span>
                        <input value={waitingReason} onChange={(event) => setWaitingReason(event.target.value)} maxLength={1000} className="w-full rounded-xl border border-outline-variant/70 px-3 py-2.5 text-sm" placeholder="Required when waiting for information" />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-bold text-on-surface">Action type</span>
                        <select value={correctiveAction.actionType} onChange={(event) => setCorrectiveAction((current) => ({ ...current, actionType: event.target.value }))} className="w-full rounded-xl border border-outline-variant/70 px-3 py-2.5 text-sm">
                          {CORRECTIVE_ACTION_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-bold text-on-surface">Action description</span>
                        <input value={correctiveAction.description} onChange={(event) => setCorrectiveAction((current) => ({ ...current, description: event.target.value }))} maxLength={1000} className="w-full rounded-xl border border-outline-variant/70 px-3 py-2.5 text-sm" placeholder="Required for action required or resolution" />
                      </label>
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-sm font-bold text-on-surface">Reply to passenger</span>
                        <textarea value={feedbackMessage} onChange={(event) => setFeedbackMessage(event.target.value)} maxLength={2000} rows={4} className="w-full rounded-xl border border-outline-variant/70 px-4 py-3 text-sm" placeholder="Ask for more information, explain the decision, or confirm resolution." />
                        <span className="block text-right text-xs font-semibold text-on-surface-variant">{feedbackMessage.length}/2000</span>
                      </label>
                    </div>
                    <button type="submit" disabled={isSubmitting || !selectedCase.assignedTo} className="mt-4 rounded-full bg-primary px-6 py-3 text-sm font-black text-white disabled:opacity-50">
                      Update Complaint
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

                {(isFeedback || isComplaint) ? (
                  <section className="rounded-2xl border border-outline-variant/30 bg-white p-5">
                    <h3 className="text-lg font-headline font-black text-primary">Investigation</h3>
                    <form onSubmit={handleAddInternalNote} className="mt-4 space-y-3">
                      <textarea
                        value={internalNote}
                        onChange={(event) => setInternalNote(event.target.value)}
                        rows={3}
                        maxLength={2000}
                        className="w-full rounded-xl border border-outline-variant/70 px-4 py-3 text-sm"
                        placeholder="Internal note, not visible to passenger"
                      />
                      <button type="submit" disabled={isSubmitting || !internalNote.trim()} className="rounded-full bg-primary px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">
                        Add Note
                      </button>
                    </form>
                    <ul className="mt-4 space-y-3">
                      {(selectedCase.responses || []).filter((item) => item.responseType === 'INTERNAL_NOTE' || item.visibleToPassenger === false).map((note) => (
                        <li key={note._id || note.id || `${note.createdAt}-${note.message}`} className="rounded-xl bg-surface-container-low p-4">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-bold text-on-surface">{note.responder?.fullName || 'Admin'}</p>
                            <span className="text-xs text-on-surface-variant">{formatDateTime(note.createdAt)}</span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-on-surface-variant">{note.message}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {(isFeedback || isComplaint) ? (
                  <section className="rounded-2xl border border-outline-variant/30 bg-white p-5">
                    <h3 className="text-lg font-headline font-black text-primary">Corrective Action</h3>
                    <form onSubmit={handleAddCorrectiveAction} className="mt-4 grid gap-3 md:grid-cols-[0.6fr_1fr_auto]">
                      <select
                        value={correctiveAction.actionType}
                        onChange={(event) => setCorrectiveAction((current) => ({ ...current, actionType: event.target.value }))}
                        className="rounded-xl border border-outline-variant/70 px-3 py-2.5 text-sm"
                      >
                        {CORRECTIVE_ACTION_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                      <input
                        value={correctiveAction.description}
                        onChange={(event) => setCorrectiveAction((current) => ({ ...current, description: event.target.value }))}
                        className="rounded-xl border border-outline-variant/70 px-3 py-2.5 text-sm"
                        placeholder="Action description"
                      />
                      <button type="submit" disabled={isSubmitting || !correctiveAction.description.trim()} className="rounded-full bg-primary px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">
                        Save Action
                      </button>
                    </form>
                    <ul className="mt-4 space-y-3">
                      {(selectedCase.correctiveActions || []).map((action) => (
                        <li key={action.id || action._id || `${action.createdAt}-${action.description}`} className="rounded-xl bg-surface-container-low p-4">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-black text-on-surface">{getLabel(CORRECTIVE_ACTION_TYPES, action.actionType)}</p>
                            <span className="text-xs text-on-surface-variant">{formatDateTime(action.performedAt || action.createdAt)}</span>
                          </div>
                          <p className="mt-2 text-sm text-on-surface-variant">{action.description}</p>
                          <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                            {action.performedBy?.fullName || 'Admin'}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <section className="rounded-2xl border border-outline-variant/30 bg-white p-5">
                  <h3 className="text-lg font-headline font-black text-primary">Activity Timeline</h3>
                  {(selectedCase.activityTimeline || selectedCase.publicTimeline || []).length === 0 ? (
                    <p className="mt-3 rounded-xl bg-surface-container p-4 text-sm text-on-surface-variant">No activity yet.</p>
                  ) : (
                    <ol className="mt-3 space-y-3">
                      {(selectedCase.activityTimeline || selectedCase.publicTimeline || []).map((entry) => (
                        <li key={entry.id || `${entry.createdAt}-${entry.action}`} className="rounded-xl bg-surface-container-low p-4">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-black text-on-surface">{entry.action}</p>
                            <span className="text-xs text-on-surface-variant">{formatDateTime(entry.createdAt)}</span>
                          </div>
                          <p className="mt-2 text-sm text-on-surface-variant">
                            {entry.previousStatus && entry.newStatus ? `${entry.previousStatus} -> ${entry.newStatus}` : entry.message || 'Updated'}
                          </p>
                          {entry.message ? <p className="mt-1 text-xs text-on-surface-variant">{entry.message}</p> : null}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>

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
              </div>
            )}
          </section>
        </section>
      </main>
      {notificationDraft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <section className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-headline font-black text-on-surface">Send update to passenger?</h2>
                <p className="mt-2 text-sm text-on-surface-variant">
                  The complaint status has been changed to: <strong>{getLabel(FEEDBACK_STATUSES, pendingUpdate?.status)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNotificationDraft(null);
                  setPendingUpdate(null);
                }}
                className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container"
                aria-label="Close notification confirmation"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="mt-4 space-y-3 rounded-xl bg-surface-container-low p-4">
              <label className="flex items-center gap-3 text-sm font-bold text-on-surface">
                <input
                  type="checkbox"
                  checked={notificationChannels.inApp}
                  onChange={(event) => setNotificationChannels((current) => ({ ...current, inApp: event.target.checked }))}
                  className="rounded border-outline-variant text-primary focus:ring-primary"
                />
                In-app notification
              </label>
              <label className="flex items-center gap-3 text-sm font-bold text-on-surface">
                <input
                  type="checkbox"
                  checked={notificationChannels.email}
                  disabled={!notificationDraft.emailAvailable}
                  onChange={(event) => setNotificationChannels((current) => ({ ...current, email: event.target.checked }))}
                  className="rounded border-outline-variant text-primary focus:ring-primary disabled:opacity-50"
                />
                Email
              </label>
              {!notificationDraft.emailAvailable ? (
                <p className="text-xs font-semibold text-orange-700">{notificationDraft.emailUnavailableReason}</p>
              ) : null}
              {!notificationChannels.inApp && !notificationChannels.email ? (
                <p className="rounded-lg bg-orange-50 px-3 py-2 text-xs font-bold text-orange-800">
                  No notification will be sent to the passenger.
                </p>
              ) : null}
            </div>
            <label className="mt-4 block space-y-2">
              <span className="text-sm font-bold text-on-surface">Message</span>
              <textarea
                value={notificationMessage}
                onChange={(event) => setNotificationMessage(event.target.value)}
                rows={5}
                maxLength={1000}
                className="w-full rounded-xl border border-outline-variant/70 px-4 py-3 text-sm"
              />
            </label>
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setNotificationDraft(null);
                  setPendingUpdate(null);
                }}
                className="rounded-full border border-outline-variant px-5 py-2.5 text-sm font-black text-primary hover:bg-surface-container"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmFeedbackUpdate}
                disabled={isSubmitting || !notificationMessage.trim()}
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
              >
                Confirm Update & Send
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <Footer />
    </div>
  );
};

const FilterSelect = ({ value, onChange, items, label }) => (
  <select
    value={value}
    onChange={(event) => onChange(event.target.value)}
    className="h-10 min-w-0 rounded-xl border-0 bg-white px-3 text-sm outline-none ring-1 ring-outline-variant/40 focus:ring-2 focus:ring-primary"
  >
    {label ? <option value="ALL">{label}</option> : null}
    {items.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
  </select>
);

const RatingStars = ({ value }) => {
  const rating = Number(value || 0);

  return (
    <div className="flex items-center gap-0.5 text-yellow-400" aria-label={`${rating || '-'} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className="material-symbols-outlined text-[15px]"
          style={{ fontVariationSettings: star <= rating ? "'FILL' 1" : "'FILL' 0" }}
          aria-hidden="true"
        >
          star
        </span>
      ))}
    </div>
  );
};

const FeedbackListItem = ({ supportCase, selected, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    className={`w-full rounded-xl border bg-white p-4 text-left shadow-[0_4px_12px_rgba(51,65,85,0.08)] transition focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
      selected
        ? 'border-primary bg-emerald-50 ring-1 ring-primary/50'
        : 'border-outline-variant/30 hover:bg-surface-container-low hover:shadow-md'
    }`}
  >
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p
          className="text-sm font-black leading-5 text-on-surface [overflow-wrap:anywhere]"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {supportCase.title}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-on-surface-variant">
          <span className="max-w-[180px] truncate text-on-surface">{supportCase.passenger?.fullName || 'Passenger'}</span>
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">calendar_today</span>
            {formatDateTime(supportCase.createdAt)}
          </span>
          <span className="rounded-md bg-surface-container px-2 py-0.5">{getLabel(FEEDBACK_CATEGORIES, supportCase.category)}</span>
        </div>
      </div>
      <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase ${PRIORITY_BADGE[supportCase.priority] || PRIORITY_BADGE.LOW}`}>
        {supportCase.priority || 'LOW'}
      </span>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <RatingStars value={supportCase.ratingScore} />
        <span className="text-xs font-black text-on-surface-variant">{supportCase.ratingScore || '-'}/5</span>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${TYPE_BADGE[supportCase.type]}`}>
          {getLabel(CASE_TYPES, supportCase.type)}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${STATUS_BADGE[supportCase.status] || STATUS_BADGE.PENDING}`}>
          {getLabel(CASE_STATUSES, supportCase.status)}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${supportCase.adminResponse ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
          {supportCase.adminResponse ? 'Replied' : 'No reply'}
        </span>
      </div>
    </div>
  </button>
);

const Metric = ({ icon, label, value, tone }) => (
  <div className="min-h-[112px] rounded-2xl border border-outline-variant/30 bg-white p-4 shadow-[0_4px_12px_rgba(51,65,85,0.08)]">
    <div className="mb-2 flex items-start justify-between gap-3">
      <span className={`material-symbols-outlined rounded-xl p-2 text-[22px] ${tone}`} aria-hidden="true">{icon}</span>
    </div>
    <p className="text-sm font-bold text-on-surface-variant">{label}</p>
    <p className="mt-1 text-2xl font-headline font-black text-on-surface">{value}</p>
  </div>
);

const InfoRow = ({ label, value }) => (
  <div className="rounded-xl bg-surface-container-low px-4 py-3">
    <dt className="text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">{label}</dt>
    <dd className="mt-1 font-black text-on-surface [overflow-wrap:anywhere]">{value}</dd>
  </div>
);

export default AdminCustomerSupportPage;
