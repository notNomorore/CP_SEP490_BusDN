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

const FEEDBACK_STATUS_ALIASES = {
  PENDING: 'NEW',
  SUBMITTED: 'NEW',
  OPEN: 'NEW',
  UNDER_REVIEW: 'IN_REVIEW',
  IN_PROGRESS: 'INVESTIGATING',
  RESPONDED: 'INVESTIGATING',
  WAITING_FOR_PASSENGER: 'WAITING_FOR_INFORMATION',
};

const FEEDBACK_STATUS_TRANSITIONS = {
  NEW: ['IN_REVIEW'],
  IN_REVIEW: ['INVESTIGATING'],
  INVESTIGATING: ['WAITING_FOR_INFORMATION', 'ACTION_REQUIRED', 'RESOLVED'],
  WAITING_FOR_INFORMATION: ['INVESTIGATING', 'CLOSED'],
  ACTION_REQUIRED: ['INVESTIGATING', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  REOPENED: ['IN_REVIEW', 'INVESTIGATING'],
  CLOSED: [],
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
    : 'Chưa có'
);

const getErrorMessage = (error) => {
  if (!error) return 'Không thể xử lý yêu cầu.';
  if (typeof error === 'string') return error;
  if (error.errors && typeof error.errors === 'object') return Object.values(error.errors).join(' ');
  return error.message || 'Không thể xử lý yêu cầu.';
};

const getLabel = (items, value) => items.find((item) => item.value === value)?.label || value || 'Chưa có';

const normalizeFeedbackStatus = (status) => FEEDBACK_STATUS_ALIASES[status] || status || 'NEW';

const getAllowedFeedbackStatuses = (status) => {
  const currentStatus = normalizeFeedbackStatus(status);
  return [currentStatus, ...(FEEDBACK_STATUS_TRANSITIONS[currentStatus] || [])];
};

const getStartProcessingStatus = (status) => {
  const currentStatus = normalizeFeedbackStatus(status);
  if (currentStatus === 'NEW') return 'IN_REVIEW';
  if (currentStatus === 'IN_REVIEW') return 'INVESTIGATING';
  return '';
};

const getAttachmentUrl = (attachment) => {
  const path = attachment?.path || attachment?.url;
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;

  const apiBase = import.meta.env.VITE_API_BASE_URL || '';
  const apiOrigin = apiBase.replace(/\/api\/?$/, '') || import.meta.env.VITE_API_URL || 'https://cp-sep490-busdn.onrender.com';
  return `${apiOrigin.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
};

const isImageAttachment = (attachment) => String(attachment?.mimeType || '').startsWith('image/');

const buildFeedbackPayload = ({
  message,
  status,
  priority,
  waitingForInformationReason,
}) => {
  const payload = {};
  const trimmedMessage = message.trim();
  const trimmedWaitingReason = waitingForInformationReason.trim();

  if (status) {
    payload.status = status;
  }

  if (trimmedMessage) {
    payload.message = trimmedMessage;
  }

  if (priority) {
    payload.priority = priority;
  }

  if (trimmedWaitingReason) {
    payload.waitingForInformationReason = trimmedWaitingReason;
  }

  return payload;
};

const getWorkflowHint = (supportCase) => {
  if (!supportCase) return '';
  if (!supportCase.assignedTo) return 'Nhận yêu cầu trước khi xử lý để tránh trùng việc.';
  if (supportCase.status === 'PENDING') return 'Bắt đầu xử lý hoặc yêu cầu hành khách bổ sung thông tin.';
  if (['WAITING_FOR_INFORMATION', 'WAITING_FOR_PASSENGER'].includes(supportCase.status)) return 'Đang chờ hành khách bổ sung thông tin.';
  if (supportCase.status === 'RESOLVED') return 'Yêu cầu đã giải quyết. Có thể đóng nếu không cần trao đổi thêm.';
  if (supportCase.status === 'CLOSED') return 'Yêu cầu đã đóng.';
  return 'Cập nhật trạng thái và gửi phản hồi cho hành khách.';
};

const getReplyStatus = (supportCase) => (
  supportCase?.adminResponse
    ? `Đã phản hồi ${formatDateTime(supportCase.adminResponseAt)}`
    : 'Chưa phản hồi'
);

const AdminCustomerSupportPage = () => {
  const [filters, setFilters] = useState({
    type: 'SERVICE_FEEDBACK',
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
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState(null);
  const [notificationDraft, setNotificationDraft] = useState(null);
  const [notificationChannels, setNotificationChannels] = useState({ inApp: true, email: true });
  const [notificationMessage, setNotificationMessage] = useState('');

  const selectedType = selectedCase?.type;
  const isFeedback = selectedType === 'SERVICE_FEEDBACK';
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
      type: 'SERVICE_FEEDBACK',
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
        type: 'SERVICE_FEEDBACK',
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
      setFeedbackMessage('');
      setPendingUpdate(null);
      setNotificationDraft(null);
      setNotificationMessage('');
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
      const response = await customerSupportService.assignFeedback(selectedCase.id);
      await refreshAfterMutation(response.data);
      toast.success('Đã nhận xử lý góp ý.');
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
    });

    if (!payload.message && selectedCase.status === payload.status && !payload.priority && !payload.waitingForInformationReason) {
      toast.error('Hãy nhập phản hồi, đổi trạng thái hoặc mức ưu tiên.');
      return;
    }

    if (payload.status === 'WAITING_FOR_INFORMATION' && !payload.message && !payload.waitingForInformationReason) {
      toast.error('Trạng thái chờ bổ sung thông tin cần lý do hoặc nội dung gửi khách.');
      return;
    }

    if (payload.status === 'RESOLVED' && !payload.message) {
      toast.error('Cần nhập phản hồi gửi khách trước khi đánh dấu đã giải quyết.');
      return;
    }

    const customerVisible = CUSTOMER_VISIBLE_STATUSES.has(payload.status) || Boolean(payload.message);

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
      await refreshAfterMutation(response.data);
      toast.success('Đã cập nhật góp ý.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmFeedbackUpdate = async () => {
    if (!selectedCase?.id || !pendingUpdate) return;
    if (!notificationChannels.inApp && !notificationChannels.email) {
      const confirmed = window.confirm('Không gửi thông báo cho hành khách. Bạn vẫn muốn tiếp tục?');
      if (!confirmed) return;
    }

    setIsSubmitting(true);

    try {
      const response = await customerSupportService.updateFeedback(selectedCase.id, {
        ...pendingUpdate,
        notification: {
          confirmSend: notificationChannels.inApp || notificationChannels.email,
          channels: notificationChannels,
          title: notificationDraft?.title || 'Cập nhật góp ý',
          message: notificationMessage,
        },
      });
      setFeedbackMessage('');
      setPendingUpdate(null);
      setNotificationDraft(null);
      await refreshAfterMutation(response.data);
      const results = response.data?.notificationResults || [];
      const emailFailed = results.some((item) => item.channel === 'EMAIL' && item.status === 'FAILED');
      toast.success(emailFailed ? 'Đã cập nhật góp ý, nhưng gửi email thất bại.' : 'Đã cập nhật và gửi thông báo cho hành khách.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFeedbackStatus = async (status, defaultMessage = '') => {
    if (!getAllowedFeedbackStatuses(selectedCase?.status).includes(status)) return;
    setFeedbackStatus(status);
    if (defaultMessage) {
      setFeedbackMessage(defaultMessage);
    }
  };

  const allowedFeedbackStatuses = getAllowedFeedbackStatuses(selectedCase?.status);
  const startProcessingStatus = getStartProcessingStatus(selectedCase?.status);

  return (
    <div className="min-h-screen bg-[#f0fdf4] text-on-surface">
      <Header />
      <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-3 pb-6 pt-24 sm:px-4 lg:px-0 lg:pt-0">
        <section className="rounded-2xl border border-outline-variant/30 bg-white px-5 py-4 shadow-[0_4px_12px_rgba(51,65,85,0.08)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-on-tertiary-fixed-variant">Chăm sóc khách hàng</p>
              <h1 className="mt-1 text-2xl font-headline font-black text-on-surface">Quản lý góp ý</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-on-surface-variant">
                Theo dõi và xử lý góp ý của hành khách từ lúc tiếp nhận đến khi phản hồi, giải quyết và đóng yêu cầu.
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
          <Metric icon="forum" label="Tổng góp ý" value={analytics?.totalFeedback ?? 0} tone="bg-blue-50 text-blue-600" />
          <Metric icon="star" label="Điểm trung bình" value={`${analytics?.averageRating ?? 0}/5`} tone="bg-yellow-50 text-yellow-600" />
          <Metric icon="task_alt" label="Tỷ lệ xử lý" value={`${analytics?.resolutionRate ?? 0}%`} tone="bg-emerald-50 text-emerald-600" />
          <Metric icon="timer" label="Thời gian phản hồi" value={`${analytics?.averageResponseHours ?? 0}h`} tone="bg-purple-50 text-purple-600" />
        </section>

        <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.95fr)] 2xl:grid-cols-[minmax(0,1.75fr)_minmax(420px,0.95fr)]">
          <aside className="min-w-0 rounded-2xl border border-outline-variant/30 bg-white p-4 shadow-[0_4px_12px_rgba(51,65,85,0.08)]">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 rounded-2xl border border-outline-variant/25 bg-surface-container-low/70 p-3">
                <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_repeat(2,minmax(120px,0.38fr))]">
                  <label className="relative min-w-0">
                    <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">search</span>
                    <input
                      value={filters.search}
                      onChange={(event) => updateFilter('search', event.target.value)}
                      className="h-10 w-full rounded-xl border-0 bg-white py-2 pl-10 pr-3 text-sm outline-none ring-1 ring-outline-variant/40 focus:ring-2 focus:ring-primary"
                      placeholder="Tìm kiếm tiêu đề, nội dung, mã yêu cầu"
                    />
                  </label>
                  <FilterSelect value={filters.status} onChange={(value) => updateFilter('status', value)} items={CASE_STATUSES} />
                  <FilterSelect value={filters.priority} onChange={(value) => updateFilter('priority', value)} items={PRIORITIES} />
                </div>
                <div className="grid gap-2 md:grid-cols-[minmax(180px,0.8fr)_minmax(130px,0.45fr)_minmax(220px,0.7fr)_auto]">
                  <select
                    value={filters.category}
                    onChange={(event) => updateFilter('category', event.target.value)}
                    className="h-10 min-w-0 rounded-xl border-0 bg-white px-3 text-sm outline-none ring-1 ring-outline-variant/40 focus:ring-2 focus:ring-primary"
                  >
                    <option value="ALL">Tất cả danh mục</option>
                    {FEEDBACK_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                  <select
                    value={filters.rating}
                    onChange={(event) => updateFilter('rating', event.target.value)}
                    className="h-10 min-w-0 rounded-xl border-0 bg-white px-3 text-sm outline-none ring-1 ring-outline-variant/40 focus:ring-2 focus:ring-primary"
                  >
                    <option value="ALL">Tất cả đánh giá</option>
                    {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} sao</option>)}
                  </select>
                  <label className="flex h-10 min-w-0 items-center gap-2 rounded-xl bg-white px-3 text-sm font-bold text-primary ring-1 ring-outline-variant/40">
                    <input
                      type="checkbox"
                      checked={filters.assignedOnly}
                      onChange={(event) => updateFilter('assignedOnly', event.target.checked)}
                      className="rounded border-outline-variant text-primary focus:ring-primary"
                    />
                    <span className="truncate">Chỉ xem yêu cầu của tôi</span>
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
                  <h2 className="text-lg font-headline font-black text-primary">Danh sách góp ý</h2>
                  <p className="text-xs font-semibold text-on-surface-variant">{meta.total || 0} yêu cầu</p>
                </div>
              </div>
            </div>

            <div className="mt-3 max-h-none space-y-3 overflow-visible pr-0 xl:max-h-[calc(100vh-306px)] xl:overflow-y-auto xl:pr-1">
              {isLoading ? (
                <div className="rounded-xl bg-surface-container p-6 text-center text-on-surface-variant">Đang tải yêu cầu...</div>
              ) : cases.length === 0 ? (
                <div className="rounded-xl bg-surface-container p-6 text-center text-on-surface-variant">Không có yêu cầu phù hợp.</div>
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
              <div className="rounded-xl bg-surface-container p-6 text-center text-on-surface-variant">Đang tải chi tiết...</div>
            ) : !selectedCase ? (
              <div className="rounded-xl bg-surface-container p-6 text-center text-on-surface-variant">Chọn một yêu cầu để xử lý.</div>
            ) : (
              <div className="flex h-full min-h-0 flex-col">
                <div className="border-b border-outline-variant/25 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="inline-flex rounded-lg bg-emerald-50 px-2 py-1 text-xs font-black uppercase tracking-[0.14em] text-primary">{selectedCase.referenceNumber}</p>
                    <h2 className="mt-3 text-xl font-headline font-black leading-tight text-on-surface [overflow-wrap:anywhere]">{selectedCase.title}</h2>
                    <p className="mt-2 text-sm text-on-surface-variant [overflow-wrap:anywhere]">
                      {selectedCase.passenger?.fullName || 'Hành khách'} - {selectedCase.passenger?.email || selectedCase.passenger?.phone || 'Chưa có liên hệ'}
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
                  <InfoRow label="Email hành khách" value={selectedCase.passenger?.email || 'Chưa có'} />
                  <InfoRow label="Số điện thoại" value={selectedCase.passenger?.phone || 'Chưa có'} />
                  <InfoRow label="Đánh giá" value={selectedCase.ratingScore ? `${selectedCase.ratingScore}/5` : 'Chưa có'} />
                  <InfoRow label="Tuyến / chuyến" value={selectedCase.routeName || selectedCase.tripCode || selectedCase.relatedTripId || 'Chưa có'} />
                  <InfoRow label="Admin xử lý" value={selectedCase.assignedTo?.fullName || 'Chưa phân công'} />
                  <InfoRow label="Trạng thái phản hồi" value={getReplyStatus(selectedCase)} />
                  <InfoRow label="Mức ưu tiên" value={getLabel(PRIORITIES, selectedCase.priority || 'LOW')} />
                  <InfoRow label="Ngày gửi" value={formatDateTime(selectedCase.createdAt)} />
                </dl>

                <div className="rounded-xl bg-surface-container-low p-4">
                  <p className="text-sm font-black text-primary">Nội dung hành khách gửi</p>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant [overflow-wrap:anywhere]">{selectedCase.description}</p>
                </div>

                {selectedCase.attachments?.length ? (
                  <section className="rounded-xl border border-outline-variant/30 bg-white p-4">
                    <p className="text-sm font-black text-primary">Tệp đính kèm</p>
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
                              <img src={url} alt={attachment.originalName || 'Tệp đính kèm góp ý'} className="h-36 w-full object-cover" />
                            ) : null}
                            <span className="block truncate px-3 py-2">{attachment.originalName || attachment.fileName || 'Tệp đính kèm'}</span>
                          </a>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
                  <p className="text-sm font-black text-primary">Phản hồi hiện tại của admin</p>
                  {selectedCase.adminResponse ? (
                    <div className="mt-2 text-sm leading-6 text-on-surface-variant">
                      <p>{selectedCase.adminResponse}</p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                        {selectedCase.adminResponseBy?.fullName || 'Admin'} - {formatDateTime(selectedCase.adminResponseAt)}
                      </p>
                      {isFeedback ? (
                        <button
                          type="button"
                          onClick={() => setFeedbackMessage(selectedCase.adminResponse || '')}
                          className="mt-3 rounded-full border border-outline-variant px-4 py-2 text-xs font-black text-primary hover:bg-white"
                        >
                          Sửa phản hồi
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-on-surface-variant">Admin chưa phản hồi.</p>
                  )}
                </section>

                {isFeedback ? (
                  <form onSubmit={handleUpdateFeedback} className="rounded-2xl border border-outline-variant/30 bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-lg font-headline font-black text-primary">Xử lý góp ý</h3>
                        <p className="mt-1 text-sm text-on-surface-variant">{getWorkflowHint(selectedCase)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAssignToSelf}
                        disabled={isSubmitting}
                        className="rounded-full border border-outline-variant px-4 py-2 text-sm font-bold text-primary hover:bg-surface-container disabled:opacity-50"
                      >
                        {selectedCase.assignedTo ? 'Nhận lại xử lý' : 'Nhận xử lý'}
                      </button>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuickFeedbackStatus(startProcessingStatus)}
                        disabled={isSubmitting || !selectedCase.assignedTo || !startProcessingStatus}
                        className="min-h-10 rounded-xl bg-primary px-4 py-2 text-sm font-black text-white hover:opacity-90 disabled:opacity-50"
                      >
                        Bắt đầu xử lý
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeedbackStatus('WAITING_FOR_INFORMATION')}
                        disabled={isSubmitting || !selectedCase.assignedTo || !allowedFeedbackStatuses.includes('WAITING_FOR_INFORMATION')}
                        className="min-h-10 rounded-xl border border-outline-variant/60 px-4 py-2 text-sm font-black text-primary hover:bg-surface-container disabled:opacity-50"
                      >
                        Cần khách bổ sung
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeedbackStatus('RESOLVED')}
                        disabled={isSubmitting || !selectedCase.assignedTo || !allowedFeedbackStatuses.includes('RESOLVED')}
                        className="min-h-10 rounded-xl border border-outline-variant/60 px-4 py-2 text-sm font-black text-primary hover:bg-surface-container disabled:opacity-50"
                      >
                        Đánh dấu đã xử lý
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickFeedbackStatus('CLOSED')}
                        disabled={isSubmitting || !selectedCase.assignedTo || !allowedFeedbackStatuses.includes('CLOSED')}
                        className="min-h-10 rounded-xl border border-outline-variant/60 px-4 py-2 text-sm font-black text-primary hover:bg-surface-container disabled:opacity-50"
                      >
                        Đóng yêu cầu
                      </button>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-bold text-on-surface">Trạng thái tiếp theo</span>
                        <select value={feedbackStatus} onChange={(event) => setFeedbackStatus(event.target.value)} className="w-full rounded-xl border border-outline-variant/70 px-3 py-2.5 text-sm">
                          {FEEDBACK_STATUSES.filter((item) => allowedFeedbackStatuses.includes(item.value)).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-bold text-on-surface">Mức ưu tiên</span>
                        <select value={feedbackPriority} onChange={(event) => setFeedbackPriority(event.target.value)} className="w-full rounded-xl border border-outline-variant/70 px-3 py-2.5 text-sm">
                          {ENTERPRISE_PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                      </label>
                      {feedbackStatus === 'WAITING_FOR_INFORMATION' ? (
                        <label className="space-y-2">
                          <span className="text-sm font-bold text-on-surface">Lý do cần bổ sung</span>
                          <input value={waitingReason} onChange={(event) => setWaitingReason(event.target.value)} maxLength={1000} className="w-full rounded-xl border border-outline-variant/70 px-3 py-2.5 text-sm" placeholder="Ví dụ: Cần thêm hình ảnh hoặc thông tin chuyến" />
                        </label>
                      ) : null}
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-sm font-bold text-on-surface">Phản hồi cho hành khách</span>
                        <textarea value={feedbackMessage} onChange={(event) => setFeedbackMessage(event.target.value)} maxLength={2000} rows={4} className="w-full rounded-xl border border-outline-variant/70 px-4 py-3 text-sm" placeholder="Nhập nội dung phản hồi, yêu cầu bổ sung thông tin hoặc thông báo kết quả xử lý." />
                        <span className="block text-right text-xs font-semibold text-on-surface-variant">{feedbackMessage.length}/2000</span>
                      </label>
                    </div>
                    <button type="submit" disabled={isSubmitting || !selectedCase.assignedTo} className="mt-4 rounded-full bg-primary px-6 py-3 text-sm font-black text-white disabled:opacity-50">
                      Cập nhật góp ý
                    </button>
                  </form>
                ) : null}

                <section className="rounded-2xl border border-outline-variant/30 bg-white p-5">
                  <h3 className="text-lg font-headline font-black text-primary">Lịch sử trao đổi</h3>
                  {conversation.length === 0 ? (
                    <p className="mt-3 rounded-xl bg-surface-container p-4 text-sm text-on-surface-variant">Chưa có tin nhắn.</p>
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
                <h2 className="text-xl font-headline font-black text-on-surface">Gửi cập nhật cho hành khách?</h2>
                <p className="mt-2 text-sm text-on-surface-variant">
                  Trạng thái góp ý sẽ được đổi thành: <strong>{getLabel(FEEDBACK_STATUSES, pendingUpdate?.status)}</strong>
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
                Thông báo trong ứng dụng
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
                  Sẽ không gửi thông báo cho hành khách.
                </p>
              ) : null}
            </div>
            <label className="mt-4 block space-y-2">
              <span className="text-sm font-bold text-on-surface">Nội dung thông báo</span>
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
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmFeedbackUpdate}
                disabled={isSubmitting || !notificationMessage.trim()}
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
              >
                Cập nhật và gửi
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
    <div className="flex items-center gap-0.5 text-yellow-400" aria-label={`${rating || '-'} trên 5 sao`}>
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
          <span className="max-w-[180px] truncate text-on-surface">{supportCase.passenger?.fullName || 'Hành khách'}</span>
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
          {supportCase.adminResponse ? 'Đã phản hồi' : 'Chưa phản hồi'}
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
