import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminPromotionShell from '../../admin/promotions/components/AdminPromotionShell.jsx';
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
  STORED: 'bg-amber-100 text-amber-900',
  RETURNED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-slate-100 text-slate-700',
};

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

const AdminLostItemCasesPage = () => {
  const [status, setStatus] = useState('ALL');
  const [recoveryStatus, setRecoveryStatus] = useState('ALL');
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [nextRecoveryStatus, setNextRecoveryStatus] = useState('STORED');
  const [handedTo, setHandedTo] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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

  const syncForm = (lostItemCase) => {
    setNextRecoveryStatus(lostItemCase?.recoveryStatus === 'RETURNED'
      ? 'RETURNED'
      : lostItemCase?.recoveryStatus || 'STORED');
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
  }, [selectedCase?.id]);

  const handleUpdateLostItem = async (event) => {
    event.preventDefault();
    if (!selectedCase?.id) return;

    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      const response = await customerSupportService.updateAdminLostItem(selectedCase.id, {
        recoveryStatus: nextRecoveryStatus,
        handedTo,
        adminNote,
      });

      setSelectedCase(response.data);
      setMessage('Hồ sơ đồ thất lạc đã được cập nhật.');
      await loadCases();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminPromotionShell
      title="Handle Lost Item Cases"
      subtitle="Quản lý báo cáo đồ thất lạc từ tài xế/phụ xe, theo dõi quá trình lưu giữ và hoàn trả cho hành khách."
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
              {LOST_ITEM_RECOVERY_STATUSES.map((item) => (
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
                        </div>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${RECOVERY_BADGE[lostItemCase.recoveryStatus]}`}>
                          {getLabel(LOST_ITEM_RECOVERY_STATUSES, lostItemCase.recoveryStatus)}
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
                    {selectedCase.incidentCode} - báo bởi {selectedCase.reporter?.fullName || 'Nhân sự vận hành'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-4 py-2 text-sm font-bold ${STATUS_BADGE[selectedCase.status]}`}>
                    {getLabel(OPERATION_INCIDENT_STATUSES, selectedCase.status)}
                  </span>
                  <span className={`rounded-full px-4 py-2 text-sm font-bold ${RECOVERY_BADGE[selectedCase.recoveryStatus]}`}>
                    {getLabel(LOST_ITEM_RECOVERY_STATUSES, selectedCase.recoveryStatus)}
                  </span>
                </div>
              </div>

              <dl className="grid gap-3 md:grid-cols-2">
                <InfoRow label="Tuyến/chuyến" value={selectedCase.trip?.scheduleCode || selectedCase.route?.name || 'Chưa có'} />
                <InfoRow label="Xe" value={selectedCase.vehicle?.plateNumber || selectedCase.vehicle?.busCode || 'Chưa có'} />
                <InfoRow label="Vị trí tìm thấy" value={selectedCase.foundLocation || 'Chưa có'} />
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
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {selectedCase.evidenceFiles.map((file) => (
                      <a
                        key={file.url || file.filename}
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl border border-outline-variant/30 px-4 py-3 text-sm font-bold text-primary hover:bg-surface-container-low"
                      >
                        {file.originalName || file.filename || 'Xem file'}
                      </a>
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
                      {LOST_ITEM_RECOVERY_STATUSES.filter((item) => item.value !== 'ALL').map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-on-surface">Bàn giao / lưu tại</span>
                    <input
                      value={handedTo}
                      onChange={(event) => setHandedTo(event.target.value)}
                      className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
                      placeholder="Ví dụ: Quầy điều hành bến trung tâm"
                    />
                  </label>
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
  );
};

export default AdminLostItemCasesPage;
