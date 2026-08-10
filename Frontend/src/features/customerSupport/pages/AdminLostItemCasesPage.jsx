import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminPromotionShell from '../../admin/promotions/components/AdminPromotionShell.jsx';
import FileViewerModal, {
  getFileDisplayName,
  resolveFileUrl,
} from '../../../shared/components/common/FileViewerModal.jsx';
import customerSupportService, {
  LOST_ITEM_RECOVERY_STATUSES,
  OPERATION_INCIDENT_STATUSES,
} from '../services/customerSupportService.js';

const STATUS_BADGE = {
  OPEN: 'bg-blue-100 text-blue-800',
  ACKNOWLEDGED: 'bg-amber-100 text-amber-900',
  RESOLVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-slate-100 text-slate-700',
};

const RECOVERY_BADGE = {
  REPORTED: 'bg-blue-100 text-blue-800',
  SEARCHING: 'bg-indigo-100 text-indigo-800',
  POTENTIAL_MATCH: 'bg-cyan-100 text-cyan-800',
  MATCH_CONFIRMED: 'bg-emerald-100 text-emerald-800',
  MATCHED: 'bg-emerald-100 text-emerald-800',
  RETURN_IN_PROGRESS: 'bg-orange-100 text-orange-800',
  FOUND: 'bg-cyan-100 text-cyan-800',
  STORED: 'bg-amber-100 text-amber-900',
  RETURNED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-slate-100 text-slate-700',
  UNRECOVERED: 'bg-red-100 text-red-800',
};

const PASSENGER_LOST_ITEM_RECOVERY_STATUSES = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'REPORTED', label: 'Đã báo cáo' },
  { value: 'SEARCHING', label: 'Đang tìm kiếm' },
  { value: 'POTENTIAL_MATCH', label: 'Có khả năng trùng khớp' },
  { value: 'MATCH_CONFIRMED', label: 'Đã xác nhận trùng khớp' },
  { value: 'RETURN_IN_PROGRESS', label: 'Đang hoàn trả' },
  { value: 'FOUND', label: 'Đã tìm thấy' },
  { value: 'RETURNED', label: 'Đã hoàn trả' },
  { value: 'UNRECOVERED', label: 'Không tìm thấy' },
];

const LOST_ITEM_FILTER_STATUSES = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'REPORTED', label: 'Đã báo cáo' },
  { value: 'SEARCHING', label: 'Đang tìm kiếm' },
  { value: 'POTENTIAL_MATCH', label: 'Có khả năng trùng khớp' },
  { value: 'MATCH_CONFIRMED', label: 'Đã xác nhận trùng khớp' },
  { value: 'MATCHED', label: 'Đã ghép hồ sơ' },
  { value: 'RETURN_IN_PROGRESS', label: 'Đang hoàn trả' },
  { value: 'FOUND', label: 'Đã tìm thấy' },
  { value: 'STORED', label: 'Đã lưu giữ' },
  { value: 'RETURNED', label: 'Đã hoàn trả' },
  { value: 'CANCELLED', label: 'Đã hủy' },
  { value: 'UNRECOVERED', label: 'Không tìm thấy' },
];

const PASSENGER_RECOVERY_TO_CASE_STATUS = {
  REPORTED: 'SUBMITTED',
  SEARCHING: 'IN_PROGRESS',
  FOUND: 'IN_PROGRESS',
  RETURNED: 'RESOLVED',
  UNRECOVERED: 'CLOSED',
};

const CUSTOMER_VISIBLE_RECOVERY_STATUSES = new Set(['SEARCHING', 'FOUND', 'RETURN_IN_PROGRESS', 'RETURNED']);

const MATCH_STATUS_OPTIONS = [
  { value: 'PENDING_REVIEW', label: 'Chờ admin duyệt' },
  { value: 'CONFIRMED', label: 'Đã xác nhận' },
  { value: 'REJECTED', label: 'Đã từ chối' },
  { value: 'RETURN_IN_PROGRESS', label: 'Đang hoàn trả' },
  { value: 'COMPLETED', label: 'Đã hoàn tất' },
  { value: 'ALL', label: 'Tất cả' },
];

const RETURN_METHODS = [
  { value: 'PICKUP_AT_BUS_STATION', label: 'Nhận tại bến' },
  { value: 'HANDOVER_BY_STAFF', label: 'Nhân viên bàn giao' },
  { value: 'OTHER', label: 'Khác' },
];

const isPassengerLostItemCase = (lostItemCase) => lostItemCase?.sourceType === 'PASSENGER_LOST_ITEM';

const formatDateTime = (value) => {
  if (!value) return 'Chưa có';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
};

const getLabel = (items, value) => items.find((item) => item.value === value)?.label || value || 'Chưa có';

const getErrorMessage = (error) => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error.errors && typeof error.errors === 'object') {
    return Object.values(error.errors).join(' ');
  }
  return error.message || 'Không thể xử lý yêu cầu.';
};

const InfoRow = ({ label, value }) => (
  <div className="rounded-2xl bg-surface-container-low px-4 py-3">
    <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
      {label}
    </dt>
    <dd className="mt-1 font-bold text-on-surface">{value}</dd>
  </div>
);

const CompactRow = ({ label, value }) => (
  <div className="flex justify-between gap-3 border-b border-outline-variant/20 py-2 text-sm last:border-0">
    <span className="text-on-surface-variant">{label}</span>
    <span className="text-right font-bold text-on-surface">{value || 'Chưa có'}</span>
  </div>
);

const AdminLostItemCasesPage = () => {
  const [status, setStatus] = useState('ALL');
  const [recoveryStatus, setRecoveryStatus] = useState('ALL');
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [matchStatus, setMatchStatus] = useState('PENDING_REVIEW');
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [matchNote, setMatchNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [returnForm, setReturnForm] = useState({
    method: 'PICKUP_AT_BUS_STATION',
    location: '',
    scheduledAt: '',
    note: '',
  });
  const [handoverForm, setHandoverForm] = useState({
    receiverName: '',
    proofReference: '',
    handoverNote: '',
  });
  const [nextRecoveryStatus, setNextRecoveryStatus] = useState('STORED');
  const [handedTo, setHandedTo] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isMatchLoading, setIsMatchLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isMatchSubmitting, setIsMatchSubmitting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewerFile, setViewerFile] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pendingLostItemUpdate, setPendingLostItemUpdate] = useState(null);
  const [notificationDraft, setNotificationDraft] = useState(null);
  const [notificationChannels, setNotificationChannels] = useState({ inApp: true, email: true });
  const [notificationMessage, setNotificationMessage] = useState('');

  const caseCount = useMemo(() => cases.length, [cases]);

  const loadCases = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await customerSupportService.listAdminLostItems({ status, recoveryStatus });
      const items = response.data || [];
      setCases(items);
      setSelectedCase((current) => {
        if (!items.length) return null;
        return items.some((item) => item.id === current?.id) ? current : items[0];
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [recoveryStatus, status]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const loadMatches = useCallback(async () => {
    setIsMatchLoading(true);
    setError('');

    try {
      const response = await customerSupportService.listLostFoundMatches({ status: matchStatus });
      const items = response.data || [];
      setMatches(items);
      setSelectedMatch((current) => {
        if (!items.length) return null;
        return items.some((item) => item.id === current?.id) ? current : items[0];
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsMatchLoading(false);
    }
  }, [matchStatus]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const loadMatchDetail = async (matchId) => {
    setIsMatchSubmitting(true);
    setMessage('');
    setError('');

    try {
      const response = await customerSupportService.getLostFoundMatch(matchId);
      setSelectedMatch(response.data);
      setMatchNote(response.data?.adminNote || '');
      setRejectReason(response.data?.rejectionReason || '');
      setReturnForm({
        method: response.data?.returnProcess?.method || 'PICKUP_AT_BUS_STATION',
        location: response.data?.returnProcess?.location || '',
        scheduledAt: response.data?.returnProcess?.scheduledAt
          ? new Date(response.data.returnProcess.scheduledAt).toISOString().slice(0, 16)
          : '',
        note: response.data?.returnProcess?.note || '',
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsMatchSubmitting(false);
    }
  };

  const refreshWorkflow = async (matchId = selectedMatch?.id) => {
    await Promise.all([loadCases(), loadMatches()]);
    if (matchId) await loadMatchDetail(matchId);
  };

  const syncForm = (lostItemCase) => {
    setNextRecoveryStatus(lostItemCase?.recoveryStatus === 'RETURNED'
      ? 'RETURNED'
      : lostItemCase?.recoveryStatus || (isPassengerLostItemCase(lostItemCase) ? 'SEARCHING' : 'STORED'));
    setHandedTo(lostItemCase?.handedTo || '');
    setAdminNote(lostItemCase?.adminNote || '');
  };

  const loadCaseDetail = async (caseId) => {
    setIsDetailLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await customerSupportService.getAdminLostItemDetail(caseId);
      setSelectedCase(response.data);
      syncForm(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsDetailLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCase) syncForm(selectedCase);
  }, [selectedCase]);

  const handleUpdateLostItem = async (event) => {
    event.preventDefault();
    if (!selectedCase?.id) return;

    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      if (isPassengerLostItemCase(selectedCase)) {
        const payload = {
          recoveryStatus: nextRecoveryStatus,
          status: PASSENGER_RECOVERY_TO_CASE_STATUS[nextRecoveryStatus] || selectedCase.caseStatus,
          note: adminNote.trim() || undefined,
        };

        if (CUSTOMER_VISIBLE_RECOVERY_STATUSES.has(nextRecoveryStatus)) {
          const response = await customerSupportService.previewCaseNotification(selectedCase.id, {
            status: nextRecoveryStatus,
          });
          const preview = response.data || {};
          setPendingLostItemUpdate(payload);
          setNotificationDraft(preview);
          setNotificationChannels({ inApp: true, email: Boolean(preview.emailAvailable) });
          setNotificationMessage(preview.message || '');
          return;
        }

        await customerSupportService.updateLostItemCase(selectedCase.id, payload);
      } else {
        await customerSupportService.updateAdminLostItem(selectedCase.id, {
          recoveryStatus: nextRecoveryStatus,
          handedTo,
          adminNote: adminNote.trim() || undefined,
        });
      }

      setMessage('Hồ sơ đồ thất lạc đã được cập nhật.');
      await loadCases();
      await loadCaseDetail(selectedCase.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmLostItemUpdate = async () => {
    if (!selectedCase?.id || !pendingLostItemUpdate) return;
    if (!notificationChannels.inApp && !notificationChannels.email) {
      const confirmed = window.confirm('No notification will be sent to the passenger. Continue?');
      if (!confirmed) return;
    }

    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      await customerSupportService.updateLostItemCase(selectedCase.id, {
        ...pendingLostItemUpdate,
        notification: {
          confirmSend: notificationChannels.inApp || notificationChannels.email,
          channels: notificationChannels,
          title: notificationDraft?.title || 'Lost item update',
          message: notificationMessage,
        },
      });
      setPendingLostItemUpdate(null);
      setNotificationDraft(null);
      setMessage('Ho so do that lac da duoc cap nhat va xu ly thong bao.');
      await loadCases();
      await loadCaseDetail(selectedCase.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmMatch = async () => {
    if (!selectedMatch?.id) return;
    setIsMatchSubmitting(true);
    setError('');
    setMessage('');

    try {
      await customerSupportService.confirmLostFoundMatch(selectedMatch.id, { adminNote: matchNote.trim() });
      setMessage('Đã xác nhận cặp báo mất / báo tìm thấy.');
      await refreshWorkflow(selectedMatch.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsMatchSubmitting(false);
    }
  };

  const handleRejectMatch = async () => {
    if (!selectedMatch?.id) return;
    setIsMatchSubmitting(true);
    setError('');
    setMessage('');

    try {
      await customerSupportService.rejectLostFoundMatch(selectedMatch.id, {
        rejectionReason: rejectReason.trim(),
        adminNote: matchNote.trim(),
      });
      setMessage('Đã từ chối cặp đối chiếu.');
      await refreshWorkflow(selectedMatch.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsMatchSubmitting(false);
    }
  };

  const handleStartReturn = async () => {
    if (!selectedMatch?.id) return;
    setIsMatchSubmitting(true);
    setError('');
    setMessage('');

    try {
      await customerSupportService.startLostFoundReturn(selectedMatch.id, {
        ...returnForm,
        scheduledAt: returnForm.scheduledAt || undefined,
      });
      setMessage('Đã bắt đầu quy trình hoàn trả.');
      await refreshWorkflow(selectedMatch.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsMatchSubmitting(false);
    }
  };

  const handleCompleteReturn = async () => {
    if (!selectedMatch?.id) return;
    setIsMatchSubmitting(true);
    setError('');
    setMessage('');

    try {
      await customerSupportService.completeLostFoundReturn(selectedMatch.id, handoverForm);
      setMessage('Đã ghi nhận bàn giao và đóng hồ sơ.');
      await refreshWorkflow(selectedMatch.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsMatchSubmitting(false);
    }
  };

  return (
    <>
    <AdminPromotionShell
      title="Handle Lost Item Cases"
      subtitle="Quản lý hồ sơ khách báo mất đồ và báo cáo đồ vật tìm thấy từ tài xế/phụ xe, theo dõi quá trình tìm kiếm, lưu giữ và hoàn trả."
      action={(
        <button
          type="button"
          onClick={loadCases}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-bold text-on-primary hover:bg-primary-container"
        >
          <span className="material-symbols-outlined">refresh</span>
          Làm mới
        </button>
      )}
    >
      <section className="mb-6 rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-xl shadow-primary/5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-headline text-2xl font-black text-primary">Potential Matches</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Hệ thống chỉ đề xuất cặp đối chiếu. Admin phải xác nhận trước khi hoàn trả.
            </p>
          </div>
          <select
            value={matchStatus}
            onChange={(event) => {
              setMatchStatus(event.target.value);
              setSelectedMatch(null);
            }}
            className="rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-sm text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
          >
            {MATCH_STATUS_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
          <div className="space-y-3">
            {isMatchLoading ? (
              <div className="rounded-2xl bg-surface-container p-5 text-center text-on-surface-variant">Đang tải cặp đối chiếu...</div>
            ) : matches.length === 0 ? (
              <div className="rounded-2xl bg-surface-container p-5 text-center text-on-surface-variant">Chưa có cặp đối chiếu phù hợp.</div>
            ) : matches.map((match) => (
              <button
                key={match.id}
                type="button"
                onClick={() => loadMatchDetail(match.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  selectedMatch?.id === match.id
                    ? 'border-primary bg-primary-fixed/40'
                    : 'border-outline-variant/30 bg-white hover:bg-surface-container-low'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-on-surface">{match.lostReport?.referenceNumber || 'Lost report'}</p>
                    <p className="mt-1 text-sm text-on-surface-variant">{match.lostReport?.itemName} ⇄ {match.foundReport?.itemName}</p>
                  </div>
                  <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-black text-cyan-800">
                    {match.matchScore}%
                  </span>
                </div>
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-primary">
                  {getLabel(MATCH_STATUS_OPTIONS, match.status)}
                </p>
              </button>
            ))}
          </div>

          {!selectedMatch ? (
            <div className="rounded-2xl bg-surface-container p-6 text-center text-on-surface-variant">
              Chọn một cặp đối chiếu để xem báo mất và báo tìm thấy song song.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-headline text-xl font-black text-primary">
                    {selectedMatch.lostReport?.referenceNumber} / {selectedMatch.foundReport?.incidentCode}
                  </h3>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Điểm đối chiếu {selectedMatch.matchScore}% - {getLabel(MATCH_STATUS_OPTIONS, selectedMatch.status)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadMatchDetail(selectedMatch.id)}
                  disabled={isMatchSubmitting}
                  className="inline-flex items-center gap-2 rounded-full border border-outline-variant px-4 py-2 text-sm font-bold text-primary hover:bg-surface"
                >
                  <span className="material-symbols-outlined text-base">refresh</span>
                  Tải lại
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-outline-variant/30 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Lost Report</p>
                  <h4 className="mt-2 text-lg font-black text-on-surface">{selectedMatch.lostReport?.itemName}</h4>
                  <div className="mt-3">
                    <CompactRow label="Passenger" value={selectedMatch.lostReport?.passenger?.fullName} />
                    <CompactRow label="Category" value={selectedMatch.lostReport?.itemCategory} />
                    <CompactRow label="Color" value={selectedMatch.lostReport?.color} />
                    <CompactRow label="Brand" value={selectedMatch.lostReport?.brand} />
                    <CompactRow label="Trip" value={selectedMatch.lostReport?.tripCode} />
                    <CompactRow label="Vehicle" value={selectedMatch.lostReport?.busPlate} />
                    <CompactRow label="Lost time" value={formatDateTime(selectedMatch.lostReport?.lostAt)} />
                    <CompactRow label="Location" value={selectedMatch.lostReport?.lastSeenLocation} />
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-on-surface-variant">
                    {selectedMatch.lostReport?.itemDescription}
                  </p>
                </div>

                <div className="rounded-2xl border border-outline-variant/30 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Found Report</p>
                  <h4 className="mt-2 text-lg font-black text-on-surface">{selectedMatch.foundReport?.itemName}</h4>
                  <div className="mt-3">
                    <CompactRow label="Reporter" value={selectedMatch.foundReport?.reporter?.fullName} />
                    <CompactRow label="Category" value={selectedMatch.foundReport?.itemCategory} />
                    <CompactRow label="Color" value={selectedMatch.foundReport?.color} />
                    <CompactRow label="Brand" value={selectedMatch.foundReport?.brand} />
                    <CompactRow label="Trip" value={selectedMatch.foundReport?.trip?.scheduleCode} />
                    <CompactRow label="Vehicle" value={selectedMatch.foundReport?.vehicle?.plateNumber || selectedMatch.foundReport?.vehicle?.busCode} />
                    <CompactRow label="Found time" value={formatDateTime(selectedMatch.foundReport?.reportedAt)} />
                    <CompactRow label="Location" value={selectedMatch.foundReport?.foundLocation} />
                    <CompactRow label="Storage" value={selectedMatch.foundReport?.storageLocation} />
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-on-surface-variant">
                    {selectedMatch.foundReport?.itemDescription}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-surface-container-low p-4">
                <p className="text-sm font-black text-primary">Matching factors</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(selectedMatch.matchingFactors || {}).map(([key, value]) => (
                    <span key={key} className={`rounded-full px-3 py-1 text-xs font-bold ${value === true ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                      {key}: {value === true ? 'yes' : value === false ? 'no' : value}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-on-surface">Admin note</span>
                  <textarea
                    rows={3}
                    value={matchNote}
                    onChange={(event) => setMatchNote(event.target.value)}
                    className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-on-surface">Rejection reason</span>
                  <input
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
                    placeholder="Different item, trip, time, or identifying details"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={handleConfirmMatch} disabled={isMatchSubmitting || selectedMatch.status !== 'PENDING_REVIEW'} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-black text-on-primary disabled:opacity-50">
                  <span className="material-symbols-outlined text-base">verified</span>
                  Confirm match
                </button>
                <button type="button" onClick={handleRejectMatch} disabled={isMatchSubmitting || selectedMatch.status !== 'PENDING_REVIEW'} className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 disabled:opacity-50">
                  <span className="material-symbols-outlined text-base">block</span>
                  Reject
                </button>
              </div>

              {['CONFIRMED', 'RETURN_IN_PROGRESS'].includes(selectedMatch.status) ? (
                <div className="grid gap-4 rounded-2xl border border-outline-variant/30 bg-white p-4 lg:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-on-surface">Return method</span>
                    <select value={returnForm.method} onChange={(event) => setReturnForm((current) => ({ ...current, method: event.target.value }))} className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface">
                      {RETURN_METHODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-on-surface">Return location</span>
                    <input value={returnForm.location} onChange={(event) => setReturnForm((current) => ({ ...current, location: event.target.value }))} className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface" />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-on-surface">Scheduled time</span>
                    <input type="datetime-local" value={returnForm.scheduledAt} onChange={(event) => setReturnForm((current) => ({ ...current, scheduledAt: event.target.value }))} className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface" />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-on-surface">Return note</span>
                    <input value={returnForm.note} onChange={(event) => setReturnForm((current) => ({ ...current, note: event.target.value }))} className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface" />
                  </label>
                  <button type="button" onClick={handleStartReturn} disabled={isMatchSubmitting || selectedMatch.status !== 'CONFIRMED'} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-black text-on-primary disabled:opacity-50 lg:col-span-2">
                    <span className="material-symbols-outlined text-base">local_shipping</span>
                    Start return process
                  </button>
                </div>
              ) : null}

              {selectedMatch.status === 'RETURN_IN_PROGRESS' ? (
                <div className="grid gap-4 rounded-2xl border border-outline-variant/30 bg-white p-4 lg:grid-cols-3">
                  <input value={handoverForm.receiverName} onChange={(event) => setHandoverForm((current) => ({ ...current, receiverName: event.target.value }))} className="rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface" placeholder="Receiver name" />
                  <input value={handoverForm.proofReference} onChange={(event) => setHandoverForm((current) => ({ ...current, proofReference: event.target.value }))} className="rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface" placeholder="Proof/reference" />
                  <input value={handoverForm.handoverNote} onChange={(event) => setHandoverForm((current) => ({ ...current, handoverNote: event.target.value }))} className="rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface" placeholder="Handover note" />
                  <button type="button" onClick={handleCompleteReturn} disabled={isMatchSubmitting} className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50 lg:col-span-3">
                    <span className="material-symbols-outlined text-base">done_all</span>
                    Mark returned and resolve
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <aside className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-xl shadow-primary/5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-headline text-2xl font-black text-primary">
                Danh sách đồ thất lạc
              </h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                {caseCount} báo cáo phù hợp bộ lọc hiện tại.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setSelectedCase(null);
              }}
              className="rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-sm text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
            >
              {OPERATION_INCIDENT_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <select
              value={recoveryStatus}
              onChange={(event) => {
                setRecoveryStatus(event.target.value);
                setSelectedCase(null);
              }}
              className="rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-sm text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
            >
              {LOST_ITEM_FILTER_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-5">
            {isLoading ? (
              <div className="rounded-2xl bg-surface-container p-6 text-center text-on-surface-variant">
                Đang tải danh sách...
              </div>
            ) : cases.length === 0 ? (
              <div className="rounded-2xl bg-surface-container p-6 text-center text-on-surface-variant">
                Chưa có báo cáo đồ thất lạc phù hợp.
              </div>
            ) : (
              <div className="space-y-3">
                {cases.map((lostItemCase) => {
                  const isSelected = selectedCase?.id === lostItemCase.id;

                  return (
                    <button
                      key={lostItemCase.id}
                      type="button"
                      onClick={() => loadCaseDetail(lostItemCase.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? 'border-primary bg-primary-fixed/40'
                          : 'border-outline-variant/30 bg-white hover:bg-surface-container-low'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-on-surface">
                            {lostItemCase.itemName || 'Đồ vật chưa đặt tên'}
                          </p>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            {lostItemCase.trip?.scheduleCode || lostItemCase.incidentCode} - {formatDateTime(lostItemCase.reportedAt)}
                          </p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-primary">
                            {isPassengerLostItemCase(lostItemCase) ? 'Khách báo mất' : 'Nhân viên báo tìm thấy'}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${RECOVERY_BADGE[lostItemCase.recoveryStatus]}`}>
                          {getLabel(LOST_ITEM_FILTER_STATUSES, lostItemCase.recoveryStatus)}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm text-on-surface-variant">
                        {lostItemCase.foundLocation || 'Chưa có vị trí tìm thấy'}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <section className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-xl shadow-primary/5">
          <div className="mb-6">
            <h2 className="font-headline text-2xl font-black text-primary">
              Chi tiết xử lý
            </h2>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Cập nhật nơi lưu giữ, ghi chú xử lý và trạng thái hoàn trả đồ thất lạc.
            </p>
          </div>

          {message && (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {message}
            </div>
          )}

          {isDetailLoading ? (
            <div className="rounded-2xl bg-surface-container p-6 text-center text-on-surface-variant">
              Đang tải chi tiết...
            </div>
          ) : !selectedCase ? (
            <div className="rounded-2xl bg-surface-container p-6 text-center text-on-surface-variant">
              Chọn một báo cáo đồ thất lạc để xử lý.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="font-headline text-xl font-black text-primary">
                    {selectedCase.itemName || 'Đồ vật chưa đặt tên'}
                  </h3>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    {selectedCase.incidentCode} - báo bởi {selectedCase.reporter?.fullName || (isPassengerLostItemCase(selectedCase) ? 'Hành khách' : 'Nhân sự vận hành')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-4 py-2 text-sm font-bold ${STATUS_BADGE[selectedCase.status]}`}>
                    {getLabel(OPERATION_INCIDENT_STATUSES, selectedCase.status)}
                  </span>
                  <span className={`rounded-full px-4 py-2 text-sm font-bold ${RECOVERY_BADGE[selectedCase.recoveryStatus]}`}>
                    {getLabel(LOST_ITEM_FILTER_STATUSES, selectedCase.recoveryStatus)}
                  </span>
                </div>
              </div>

              <dl className="grid gap-3 md:grid-cols-2">
                <InfoRow label="Tuyến/chuyến" value={selectedCase.trip?.scheduleCode || selectedCase.route?.name || 'Chưa có'} />
                <InfoRow label="Xe" value={selectedCase.vehicle?.plateNumber || selectedCase.vehicle?.busCode || 'Chưa có'} />
                <InfoRow label={isPassengerLostItemCase(selectedCase) ? 'Vị trí dự kiến bị mất' : 'Vị trí tìm thấy'} value={selectedCase.foundLocation || 'Chưa có'} />
                <InfoRow label="Thời điểm báo cáo" value={formatDateTime(selectedCase.reportedAt)} />
              </dl>

              <div className="rounded-2xl bg-surface-container-low p-4">
                <p className="text-sm font-bold text-on-surface">Mô tả đồ thất lạc</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-on-surface-variant">
                  {selectedCase.itemDescription || 'Chưa có mô tả.'}
                </p>
              </div>

              {selectedCase.evidenceFiles?.length > 0 && (
                <div className="rounded-2xl border border-outline-variant/30 bg-white p-4">
                  <p className="text-sm font-bold text-on-surface">Ảnh minh chứng</p>
                  <div className="mt-3 grid gap-3">
                    {selectedCase.evidenceFiles.map((file) => (
                      <div
                        key={file.url || file.filename}
                        className="flex flex-col gap-3 rounded-2xl border border-outline-variant/30 px-4 py-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-on-surface">
                            {getFileDisplayName(file)}
                          </p>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            Minh chứng đồ thất lạc
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setViewerFile({
                            ...file,
                            name: getFileDisplayName(file),
                            url: resolveFileUrl(file.url),
                          })}
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary-container hover:text-on-primary-container"
                        >
                          <span className="material-symbols-outlined text-base">visibility</span>
                          Xem file
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <form
                onSubmit={handleUpdateLostItem}
                className="rounded-3xl border border-outline-variant/30 bg-surface-container-low p-5"
              >
                <h3 className="font-headline text-lg font-black text-primary">
                  Cập nhật trạng thái lost-and-found
                </h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-on-surface">Trạng thái xử lý</span>
                    <select
                      value={nextRecoveryStatus}
                      onChange={(event) => setNextRecoveryStatus(event.target.value)}
                      className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
                    >
                      {(isPassengerLostItemCase(selectedCase)
                        ? PASSENGER_LOST_ITEM_RECOVERY_STATUSES
                        : LOST_ITEM_RECOVERY_STATUSES
                      ).filter((item) => item.value !== 'ALL').map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  {!isPassengerLostItemCase(selectedCase) ? (
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-on-surface">Bàn giao / lưu tại</span>
                    <input
                      value={handedTo}
                      onChange={(event) => setHandedTo(event.target.value)}
                      className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
                      placeholder="Ví dụ: Quầy điều hành bến trung tâm"
                    />
                  </label>
                  ) : null}
                  <label className="block space-y-2 md:col-span-2">
                    <span className="text-sm font-semibold text-on-surface">Ghi chú admin</span>
                    <textarea
                      rows={4}
                      value={adminNote}
                      onChange={(event) => setAdminNote(event.target.value)}
                      className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
                      placeholder="Ví dụ: đã gọi cho khách, chờ khách đối chiếu giấy tờ và nhận lại."
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 font-bold text-on-primary hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                >
                  <span className="material-symbols-outlined">inventory_2</span>
                  Lưu xử lý
                </button>
              </form>
            </div>
          )}
        </section>
      </section>
    </AdminPromotionShell>
    {viewerFile && (
      <FileViewerModal
        file={viewerFile}
        title="Xem trước ảnh minh chứng"
        onClose={() => setViewerFile(null)}
      />
    )}
    {notificationDraft && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
        <section className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-headline text-xl font-black text-primary">Send update to passenger?</h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                Lost item status: <strong>{getLabel(PASSENGER_LOST_ITEM_RECOVERY_STATUSES, pendingLostItemUpdate?.recoveryStatus)}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setNotificationDraft(null);
                setPendingLostItemUpdate(null);
              }}
              className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container"
              aria-label="Close notification confirmation"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="mt-4 space-y-3 rounded-2xl bg-surface-container-low p-4">
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
              className="w-full rounded-2xl border-outline-variant/70 px-4 py-3 text-sm"
            />
          </label>
          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setNotificationDraft(null);
                setPendingLostItemUpdate(null);
              }}
              className="rounded-full border border-outline-variant px-5 py-2.5 text-sm font-black text-primary hover:bg-surface-container"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmLostItemUpdate}
              disabled={isSubmitting || !notificationMessage.trim()}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
            >
              Confirm & Send
            </button>
          </div>
        </section>
      </div>
    )}
    </>
  );
};

export default AdminLostItemCasesPage;
