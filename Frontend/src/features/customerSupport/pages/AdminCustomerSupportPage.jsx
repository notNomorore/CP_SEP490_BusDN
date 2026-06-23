import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Header from '../../../shared/components/navigation/Header.jsx';
import Footer from '../../../shared/components/common/Footer.jsx';
import customerSupportService, {
  CASE_STATUSES,
  CASE_TYPES,
  RECOVERY_STATUSES,
} from '../services/customerSupportService.js';

const PRIORITY_FILTERS = [
  { value: 'ALL', label: 'Tất cả mức độ' },
  { value: 'LOW', label: 'Thấp' },
  { value: 'NORMAL', label: 'Bình thường' },
  { value: 'HIGH', label: 'Cao' },
  { value: 'URGENT', label: 'Khẩn cấp' },
];

const STATUS_BADGE = {
  OPEN: 'bg-blue-100 text-blue-800',
  SUBMITTED: 'bg-blue-100 text-blue-800',
  UNDER_REVIEW: 'bg-amber-100 text-amber-900',
  IN_PROGRESS: 'bg-amber-100 text-amber-900',
  RESPONDED: 'bg-green-100 text-green-800',
  RESOLVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-error-container text-on-error-container',
  CLOSED: 'bg-surface-container-high text-on-surface-variant',
};

const TYPE_BADGE = {
  COMPLAINT: 'bg-purple-100 text-purple-800',
  LOST_ITEM: 'bg-orange-100 text-orange-900',
  SERVICE_FEEDBACK: 'bg-emerald-100 text-emerald-800',
};

const formatDateTime = (value) => {
  if (!value) return 'Chưa có';

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
};

const getErrorMessage = (error) => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error.errors && typeof error.errors === 'object') {
    return Object.values(error.errors).join(' ');
  }
  return error.message || 'Không thể xử lý yêu cầu.';
};

const getLabel = (items, value) => items.find((item) => item.value === value)?.label || value || 'Chưa có';

const AdminCustomerSupportPage = () => {
  const [type, setType] = useState('ALL');
  const [status, setStatus] = useState('OPEN');
  const [priority, setPriority] = useState('ALL');
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [nextStatus, setNextStatus] = useState('IN_PROGRESS');
  const [lostItemNote, setLostItemNote] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState('SEARCHING');
  const [lostItemStatus, setLostItemStatus] = useState('IN_PROGRESS');
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedType = selectedCase?.type;
  const selectedStatus = selectedCase?.status;
  const isComplaint = selectedType === 'COMPLAINT';
  const isLostItem = selectedType === 'LOST_ITEM';

  const responseHistory = useMemo(() => (
    [...(selectedCase?.responses || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  ), [selectedCase?.responses]);

  const loadCases = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await customerSupportService.listAdminCases({
        type,
        status,
        priority,
      });

      setCases(response.data || []);

      if (response.data?.length) {
        setSelectedCase((current) => current || response.data[0]);
      } else {
        setSelectedCase(null);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [priority, status, type]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const loadCaseDetail = async (caseId) => {
    setIsDetailLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await customerSupportService.getAdminCaseDetail(caseId);
      setSelectedCase(response.data);
      setNextStatus(response.data?.status === 'OPEN' ? 'IN_PROGRESS' : response.data?.status || 'IN_PROGRESS');
      setRecoveryStatus(response.data?.lostItem?.recoveryStatus || 'SEARCHING');
      setLostItemStatus(response.data?.status || 'IN_PROGRESS');
      setResponseMessage('');
      setLostItemNote('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleRespondToComplaint = async (event) => {
    event.preventDefault();
    if (!selectedCase?.id) return;

    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      const response = await customerSupportService.respondToComplaint(selectedCase.id, {
        message: responseMessage,
        status: nextStatus,
      });

      setSelectedCase(response.data);
      setResponseMessage('');
      setMessage('Phản hồi khiếu nại đã được lưu.');
      await loadCases();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateLostItem = async (event) => {
    event.preventDefault();
    if (!selectedCase?.id) return;

    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      const response = await customerSupportService.updateLostItemCase(selectedCase.id, {
        recoveryStatus,
        status: lostItemStatus,
        note: lostItemNote,
      });

      setSelectedCase(response.data);
      setLostItemNote('');
      setMessage('Trạng thái đồ thất lạc đã được cập nhật.');
      await loadCases();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 pt-24">
        <section className="bg-primary text-surface-bright">
          <div className="mx-auto max-w-7xl px-6 py-12">
            <span className="inline-flex rounded-full bg-white/10 px-4 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-tertiary-fixed">
              Customer Support
            </span>
            <h1 className="mt-4 text-4xl font-headline font-black md:text-5xl">
              Quản lý hỗ trợ khách hàng
            </h1>
            <p className="mt-3 max-w-3xl text-lg leading-8 text-surface-variant/85">
              Xử lý khiếu nại hành khách và theo dõi các trường hợp đồ thất lạc trong vận hành xe buýt.
            </p>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-6 py-10 lg:grid-cols-[0.85fr_1.15fr]">
          <aside className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-xl shadow-primary/5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-headline font-black text-primary">
                  Danh sách yêu cầu
                </h2>
                <p className="mt-2 text-sm text-on-surface-variant">
                  Lọc và chọn một hồ sơ hỗ trợ để xử lý.
                </p>
              </div>
              <button
                type="button"
                onClick={loadCases}
                className="rounded-full border border-outline-variant/60 p-3 text-primary hover:bg-surface-container"
                aria-label="Làm mới danh sách"
              >
                <span className="material-symbols-outlined">refresh</span>
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <select
                value={type}
                onChange={(event) => {
                  setType(event.target.value);
                  setSelectedCase(null);
                }}
                className="rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-sm text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
              >
                <option value="ALL">Tất cả loại</option>
                {CASE_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>

              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setSelectedCase(null);
                }}
                className="rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-sm text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
              >
                {CASE_STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>

              <select
                value={priority}
                onChange={(event) => {
                  setPriority(event.target.value);
                  setSelectedCase(null);
                }}
                className="rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-sm text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
              >
                {PRIORITY_FILTERS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
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
                  Không có yêu cầu phù hợp.
                </div>
              ) : (
                <div className="space-y-3">
                  {cases.map((supportCase) => {
                    const isSelected = selectedCase?.id === supportCase.id;

                    return (
                      <button
                        key={supportCase.id}
                        type="button"
                        onClick={() => loadCaseDetail(supportCase.id)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          isSelected
                            ? 'border-primary bg-primary-fixed/40'
                            : 'border-outline-variant/30 bg-white hover:bg-surface-container-low'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-bold text-on-surface">
                              {supportCase.title}
                            </p>
                            <p className="mt-1 text-xs text-on-surface-variant">
                              {supportCase.passenger?.fullName || 'Passenger'} • {formatDateTime(supportCase.createdAt)}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${TYPE_BADGE[supportCase.type]}`}>
                            {getLabel(CASE_TYPES, supportCase.type)}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_BADGE[supportCase.status]}`}>
                            {getLabel(CASE_STATUSES, supportCase.status)}
                          </span>
                          <span className="rounded-full bg-surface-container px-3 py-1 text-xs font-bold text-on-surface-variant">
                            {supportCase.priority}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <section className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-xl shadow-primary/5">
            <div className="mb-6">
              <h2 className="text-2xl font-headline font-black text-primary">
                Chi tiết xử lý
              </h2>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                Phản hồi khiếu nại hoặc cập nhật tiến độ đồ thất lạc theo từng hồ sơ.
              </p>
            </div>

            {message && (
              <div className="mb-4 rounded-2xl border border-on-tertiary-container/20 bg-on-tertiary-container/10 px-4 py-3 text-sm text-on-tertiary-fixed-variant">
                {message}
              </div>
            )}

            {isDetailLoading ? (
              <div className="rounded-2xl bg-surface-container p-6 text-center text-on-surface-variant">
                Đang tải chi tiết...
              </div>
            ) : !selectedCase ? (
              <div className="rounded-2xl bg-surface-container p-6 text-center text-on-surface-variant">
                Chọn một yêu cầu để bắt đầu xử lý.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-xl font-headline font-black text-primary">
                      {selectedCase.title}
                    </h3>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {selectedCase.passenger?.fullName || 'Passenger'} • {selectedCase.passenger?.phone || selectedCase.passenger?.email || 'Chưa có liên hệ'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-4 py-2 text-sm font-bold ${TYPE_BADGE[selectedType]}`}>
                      {getLabel(CASE_TYPES, selectedType)}
                    </span>
                    <span className={`rounded-full px-4 py-2 text-sm font-bold ${STATUS_BADGE[selectedStatus]}`}>
                      {getLabel(CASE_STATUSES, selectedStatus)}
                    </span>
                  </div>
                </div>

                <dl className="grid gap-3 md:grid-cols-2">
                  <InfoRow label="Tuyến/chuyến" value={selectedCase.routeName || selectedCase.tripCode || 'Chưa có'} />
                  <InfoRow label="Biển số xe" value={selectedCase.busPlate || 'Chưa có'} />
                  <InfoRow label="Thời điểm sự cố" value={formatDateTime(selectedCase.incidentAt)} />
                  <InfoRow label="Mức độ" value={selectedCase.priority} />
                </dl>

                <div className="rounded-2xl bg-surface-container-low p-4">
                  <p className="text-sm font-bold text-on-surface">Nội dung hành khách gửi</p>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                    {selectedCase.description}
                  </p>
                </div>

                {isLostItem && (
                  <div className="rounded-2xl border border-outline-variant/30 bg-white p-4">
                    <h3 className="text-lg font-headline font-black text-primary">
                      Thông tin đồ thất lạc
                    </h3>
                    <dl className="mt-3 grid gap-3 md:grid-cols-2">
                      <InfoRow label="Tên đồ vật" value={selectedCase.lostItem?.itemName || 'Chưa có'} />
                      <InfoRow label="Trạng thái tìm kiếm" value={getLabel(RECOVERY_STATUSES, selectedCase.lostItem?.recoveryStatus)} />
                      <InfoRow label="Vị trí thấy lần cuối" value={selectedCase.lostItem?.lastSeenLocation || 'Chưa có'} />
                      <InfoRow label="Thời điểm thất lạc" value={formatDateTime(selectedCase.lostItem?.lostAt)} />
                    </dl>
                    {selectedCase.lostItem?.itemDescription && (
                      <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                        {selectedCase.lostItem.itemDescription}
                      </p>
                    )}
                  </div>
                )}

                {isComplaint && (
                  <form
                    onSubmit={handleRespondToComplaint}
                    className="rounded-3xl border border-outline-variant/30 bg-surface-container-low p-5"
                  >
                    <h3 className="text-lg font-headline font-black text-primary">
                      Phản hồi khiếu nại
                    </h3>
                    <div className="mt-4 grid gap-4">
                      <label className="block space-y-2">
                        <span className="text-sm font-semibold text-on-surface">Nội dung phản hồi</span>
                        <textarea
                          rows={4}
                          value={responseMessage}
                          onChange={(event) => setResponseMessage(event.target.value)}
                          className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
                          placeholder="Nhập phản hồi gửi cho hành khách và ghi nhận nội bộ."
                        />
                      </label>
                      <label className="block max-w-sm space-y-2">
                        <span className="text-sm font-semibold text-on-surface">Trạng thái sau phản hồi</span>
                        <select
                          value={nextStatus}
                          onChange={(event) => setNextStatus(event.target.value)}
                          className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
                        >
                          {CASE_STATUSES.filter((item) => item.value !== 'ALL').map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting || !responseMessage.trim()}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 font-bold text-on-primary hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                    >
                      <span className="material-symbols-outlined">reply</span>
                      Lưu phản hồi
                    </button>
                  </form>
                )}

                {isLostItem && (
                  <form
                    onSubmit={handleUpdateLostItem}
                    className="rounded-3xl border border-outline-variant/30 bg-surface-container-low p-5"
                  >
                    <h3 className="text-lg font-headline font-black text-primary">
                      Cập nhật lost-and-found
                    </h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="block space-y-2">
                        <span className="text-sm font-semibold text-on-surface">Trạng thái tìm kiếm</span>
                        <select
                          value={recoveryStatus}
                          onChange={(event) => setRecoveryStatus(event.target.value)}
                          className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
                        >
                          {RECOVERY_STATUSES.map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-semibold text-on-surface">Trạng thái hồ sơ</span>
                        <select
                          value={lostItemStatus}
                          onChange={(event) => setLostItemStatus(event.target.value)}
                          className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
                        >
                          {CASE_STATUSES.filter((item) => item.value !== 'ALL').map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-2 md:col-span-2">
                        <span className="text-sm font-semibold text-on-surface">Ghi chú xử lý</span>
                        <textarea
                          rows={3}
                          value={lostItemNote}
                          onChange={(event) => setLostItemNote(event.target.value)}
                          className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
                          placeholder="Ví dụ: đã liên hệ tài xế, đã tìm tại trạm cuối, đã hẹn khách nhận lại..."
                        />
                      </label>
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-on-tertiary-fixed-variant px-6 py-4 font-bold text-on-tertiary-fixed hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                    >
                      <span className="material-symbols-outlined">inventory_2</span>
                      Cập nhật hồ sơ
                    </button>
                  </form>
                )}

                <section className="rounded-3xl border border-outline-variant/30 bg-white p-5">
                  <h3 className="text-lg font-headline font-black text-primary">
                    Lịch sử phản hồi / xử lý
                  </h3>
                  {responseHistory.length === 0 ? (
                    <p className="mt-3 rounded-2xl bg-surface-container p-4 text-sm text-on-surface-variant">
                      Chưa có phản hồi nào.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-3">
                      {responseHistory.map((response) => (
                        <li
                          key={response._id || `${response.createdAt}-${response.message}`}
                          className="rounded-2xl bg-surface-container-low p-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-sm font-bold text-on-surface">
                              {response.responder?.fullName || 'Admin'}
                            </p>
                            <span className="shrink-0 text-xs text-on-surface-variant">
                              {formatDateTime(response.createdAt)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                            {response.message}
                          </p>
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

const InfoRow = ({ label, value }) => (
  <div className="rounded-2xl bg-surface-container-low px-4 py-3">
    <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
      {label}
    </dt>
    <dd className="mt-1 font-bold text-on-surface">{value}</dd>
  </div>
);

export default AdminCustomerSupportPage;
