import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Header from '../../../shared/components/navigation/Header.jsx';
import Footer from '../../../shared/components/common/Footer.jsx';
import customerSupportService, {
  CASE_STATUSES,
  COMPLAINT_RESPONSE_STATUSES,
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
  IN_PROGRESS: 'bg-amber-100 text-amber-900',
  RESOLVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  CLOSED: 'bg-slate-100 text-slate-700',
};

const TYPE_BADGE = {
  COMPLAINT: 'bg-purple-100 text-purple-800',
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

const AdminCustomerSupportPage = () => {
  const [status, setStatus] = useState('OPEN');
  const [priority, setPriority] = useState('ALL');
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [nextStatus, setNextStatus] = useState('IN_PROGRESS');
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isComplaint = selectedCase?.type === 'COMPLAINT';
  const isClosed = selectedCase?.status === 'CLOSED';

  const responseHistory = useMemo(() => (
    [...(selectedCase?.responses || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  ), [selectedCase?.responses]);

  const loadCases = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await customerSupportService.listAdminCases({ type: 'COMPLAINT', status, priority });
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
  }, [priority, status]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const loadCaseDetail = async (caseId) => {
    setIsDetailLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await customerSupportService.getAdminCaseDetail(caseId);
      const supportCase = response.data;
      setSelectedCase(supportCase);
      setNextStatus(supportCase?.status === 'OPEN' ? 'IN_PROGRESS' : supportCase?.status || 'IN_PROGRESS');
      setResponseMessage('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleRespondToComplaint = async (event) => {
    event.preventDefault();
    if (!selectedCase?.id || isClosed) return;

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
      setMessage('Phản hồi khiếu nại đã được lưu và ghi vào lịch sử xử lý.');
      await loadCases();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1 pt-24">
        <section className="bg-primary text-surface-bright">
          <div className="mx-auto max-w-7xl px-6 py-12">
            <span className="inline-flex rounded-full bg-white/10 px-4 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-tertiary-fixed">
              Customer Support Management
            </span>
            <h1 className="mt-4 font-headline text-4xl font-black md:text-5xl">
              Quản lý hỗ trợ khách hàng
            </h1>
            <p className="mt-3 max-w-3xl text-lg leading-8 text-surface-variant/85">
              Admin xem khiếu nại, phản hồi hành khách và lưu lại lịch sử xử lý để quản lý chất lượng dịch vụ.
            </p>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-6 py-10 lg:grid-cols-[0.85fr_1.15fr]">
          <aside className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-xl shadow-primary/5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-headline text-2xl font-black text-primary">
                  Danh sách yêu cầu
                </h2>
                <p className="mt-2 text-sm text-on-surface-variant">
                  Lọc hồ sơ theo loại, trạng thái và mức độ ưu tiên.
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

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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
                              {supportCase.passenger?.fullName || 'Hành khách'} - {formatDateTime(supportCase.createdAt)}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${TYPE_BADGE[supportCase.type]}`}>
                            Khi?u n?i
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
              <h2 className="font-headline text-2xl font-black text-primary">
                Chi tiết xử lý
              </h2>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                UC101 tập trung vào khiếu nại: admin xem nội dung, phản hồi và cập nhật trạng thái hồ sơ.
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
                Chọn một yêu cầu để bắt đầu xử lý.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="font-headline text-xl font-black text-primary">
                      {selectedCase.title}
                    </h3>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {selectedCase.passenger?.fullName || 'Hành khách'} - {selectedCase.passenger?.phone || selectedCase.passenger?.email || 'Chưa có liên hệ'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-4 py-2 text-sm font-bold ${TYPE_BADGE[selectedCase.type]}`}>
                      Khi?u n?i
                    </span>
                    <span className={`rounded-full px-4 py-2 text-sm font-bold ${STATUS_BADGE[selectedCase.status]}`}>
                      {getLabel(CASE_STATUSES, selectedCase.status)}
                    </span>
                  </div>
                </div>

                <dl className="grid gap-3 md:grid-cols-2">
                  <InfoRow label="Tuyến/chuyến" value={selectedCase.routeName || selectedCase.tripCode || 'Chưa có'} />
                  <InfoRow label="Biển số xe" value={selectedCase.busPlate || 'Chưa có'} />
                  <InfoRow label="Thời điểm sự việc" value={formatDateTime(selectedCase.incidentAt)} />
                  <InfoRow label="Mức độ" value={selectedCase.priority} />
                </dl>

                <div className="rounded-2xl bg-surface-container-low p-4">
                  <p className="text-sm font-bold text-on-surface">Nội dung hành khách gửi</p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-on-surface-variant">
                    {selectedCase.description}
                  </p>
                </div>

                {isComplaint && (
                  <form
                    onSubmit={handleRespondToComplaint}
                    className="rounded-3xl border border-outline-variant/30 bg-surface-container-low p-5"
                  >
                    <h3 className="font-headline text-lg font-black text-primary">
                      UC101 - Phản hồi khiếu nại
                    </h3>
                    {isClosed && (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        Hồ sơ đã đóng. Admin chỉ có thể xem lịch sử xử lý, không phản hồi thêm.
                      </div>
                    )}
                    <div className="mt-4 grid gap-4">
                      <label className="block space-y-2">
                        <span className="text-sm font-semibold text-on-surface">Nội dung phản hồi</span>
                        <textarea
                          rows={4}
                          value={responseMessage}
                          onChange={(event) => setResponseMessage(event.target.value)}
                          disabled={isClosed}
                          className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container disabled:cursor-not-allowed disabled:opacity-60"
                          placeholder="Nhập nội dung phản hồi cho hành khách và ghi nhận hướng xử lý."
                        />
                      </label>
                      <label className="block max-w-sm space-y-2">
                        <span className="text-sm font-semibold text-on-surface">Trạng thái sau phản hồi</span>
                        <select
                          value={nextStatus}
                          onChange={(event) => setNextStatus(event.target.value)}
                          disabled={isClosed}
                          className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {COMPLAINT_RESPONSE_STATUSES.map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting || isClosed || responseMessage.trim().length < 10}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 font-bold text-on-primary hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                    >
                      <span className="material-symbols-outlined">reply</span>
                      Lưu phản hồi
                    </button>
                  </form>
                )}


                <section className="rounded-3xl border border-outline-variant/30 bg-white p-5">
                  <h3 className="font-headline text-lg font-black text-primary">
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
                            <div>
                              <p className="text-sm font-bold text-on-surface">
                                {response.responder?.fullName || 'Admin'}
                              </p>
                              {response.statusAfter && (
                                <p className="mt-1 text-xs text-on-surface-variant">
                                  {getLabel(CASE_STATUSES, response.statusBefore)} {'->'} {getLabel(CASE_STATUSES, response.statusAfter)}
                                </p>
                              )}
                            </div>
                            <span className="shrink-0 text-xs text-on-surface-variant">
                              {formatDateTime(response.createdAt)}
                            </span>
                          </div>
                          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-on-surface-variant">
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

export default AdminCustomerSupportPage;
