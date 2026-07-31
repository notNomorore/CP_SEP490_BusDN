import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  CalendarDays,
  Clock3,
  LoaderCircle,
  MapPin,
  PackageCheck,
  RefreshCcw,
  Search,
  X,
} from 'lucide-react';
import Header from '../../../shared/components/navigation/Header.jsx';
import customerSupportService, { LOST_ITEM_CATEGORIES } from '../services/customerSupportService.js';

const formatDate = (value, pattern = 'dd MMM yyyy HH:mm') => {
  if (!value) return 'Chưa có thông tin';
  try {
    return format(new Date(value), pattern);
  } catch {
    return 'Chưa có thông tin';
  }
};

const getCategoryLabel = (value) => (
  LOST_ITEM_CATEGORIES.find((category) => category.value === value)?.label || value || 'Vật dụng khác'
);

const CASE_STATUS_LABELS = {
  SUBMITTED: 'Đã gửi',
  UNDER_REVIEW: 'Đang xem xét',
  SEARCHING: 'Đang tìm kiếm',
  ITEM_FOUND: 'Đã tìm thấy',
  RESOLVED: 'Đã giải quyết',
  CLOSED: 'Đã đóng',
  OPEN: 'Đang mở',
  IN_PROGRESS: 'Đang xử lý',
  RESPONDED: 'Đã phản hồi',
  REJECTED: 'Đã từ chối',
  REPORTED: 'Đã báo cáo',
  RETURNED: 'Đã hoàn trả',
  UNRECOVERED: 'Không tìm thấy',
};

const statusLabel = (status) => CASE_STATUS_LABELS[status] || String(status || 'SUBMITTED').replace(/_/g, ' ');

const formatCaseCode = (code) => {
  const value = String(code || '');
  const parts = value.split('-').filter(Boolean);

  if (parts.length >= 3 && /^\d{10,}$/.test(parts[1])) {
    return `${parts[0]}-${parts[2]}`;
  }

  return value;
};

const statusClassName = (status) => {
  if (status === 'SUBMITTED') return 'bg-blue-50 text-blue-700';
  if (status === 'UNDER_REVIEW') return 'bg-amber-50 text-amber-700';
  if (status === 'SEARCHING') return 'bg-purple-50 text-purple-700';
  if (status === 'ITEM_FOUND') return 'bg-emerald-50 text-emerald-700';
  if (status === 'RESOLVED') return 'bg-green-50 text-green-700';
  if (status === 'CLOSED') return 'bg-slate-200 text-slate-700';
  return 'bg-slate-100 text-slate-700';
};

const DetailRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 border-b border-outline-variant/30 py-2 text-sm last:border-b-0">
    <span className="text-on-surface-variant">{label}</span>
    <span className="text-right font-bold text-primary">{value || 'Chưa có thông tin'}</span>
  </div>
);

const CaseDetailModal = ({ supportCase, onClose }) => {
  if (!supportCase) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-primary/40 px-4">
      <section className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant/40 px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-on-tertiary-container">Hồ sơ đồ thất lạc</p>
            <h2 className="mt-2 text-2xl font-headline font-black text-primary">{formatCaseCode(supportCase.caseId)}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">{supportCase.lostItem?.itemName}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-outline hover:bg-surface">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
              <h3 className="mb-3 text-lg font-black text-primary">Tóm tắt hồ sơ</h3>
              <DetailRow label="Mã hồ sơ thất lạc" value={formatCaseCode(supportCase.caseId)} />
              <DetailRow label="Tên đồ vật" value={supportCase.lostItem?.itemName} />
              <DetailRow label="Loại đồ vật" value={getCategoryLabel(supportCase.lostItem?.itemCategory)} />
              <DetailRow label="Ngày gửi báo cáo" value={formatDate(supportCase.createdAt, 'dd/MM/yyyy HH:mm')} />
              <DetailRow label="Thời gian dự kiến bị mất" value={formatDate(supportCase.lostItem?.lostAt, 'dd/MM/yyyy HH:mm')} />
              <DetailRow label="Thông tin tuyến" value={supportCase.routeName} />
              <DetailRow label="Trạng thái hiện tại" value={statusLabel(supportCase.currentCaseStatus)} />
              <DetailRow label="Trạng thái tìm kiếm" value={statusLabel(supportCase.lostItem?.recoveryStatus)} />
              <DetailRow label="Cập nhật lần cuối" value={formatDate(supportCase.lastUpdatedAt, 'dd/MM/yyyy HH:mm')} />
            </div>

            <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
              <h3 className="mb-3 text-lg font-black text-primary">Mô tả hồ sơ</h3>
              <p className="text-sm leading-6 text-on-surface-variant">{supportCase.description}</p>
              <p className="mt-3 text-sm font-bold text-primary">
                Vị trí dự kiến bị mất: {supportCase.lostItem?.lastSeenLocation || 'Chưa có thông tin'}
              </p>
            </div>

            <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
              <h3 className="mb-4 text-lg font-black text-primary">Dòng thời gian cập nhật</h3>
              <div className="space-y-4">
                {(supportCase.timeline || []).map((item, index) => (
                  <div key={`${item.status}-${index}`} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-1 h-3 w-3 rounded-full bg-primary" />
                      {index < supportCase.timeline.length - 1 ? <span className="h-full min-h-10 w-px bg-outline-variant" /> : null}
                    </div>
                    <div>
                      <p className="font-bold text-primary">{statusLabel(item.status) || item.label}</p>
                      <p className="text-sm text-on-surface-variant">{item.message}</p>
                      <p className="mt-1 text-xs font-bold text-outline">{formatDate(item.timestamp, 'dd/MM/yyyy HH:mm')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-[24px] border border-outline-variant/40 bg-primary-fixed p-5 text-on-primary-fixed">
              <h3 className="text-lg font-black">Hướng dẫn nhận lại đồ</h3>
              <p className="mt-3 text-sm leading-6">
                {supportCase.collectionInstructions || 'Chưa có hướng dẫn nhận lại đồ.'}
              </p>
            </div>

            <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
              <h3 className="text-lg font-black text-primary">Ghi chú của quản trị viên</h3>
              {(supportCase.administratorNotes || []).length ? (
                <div className="mt-4 space-y-3">
                  {supportCase.administratorNotes.map((note) => (
                    <div key={`${note.createdAt}-${note.message}`} className="rounded-2xl bg-white px-4 py-3 text-sm">
                      <p className="font-semibold text-primary">{note.message}</p>
                      <p className="mt-1 text-xs text-outline">{formatDate(note.createdAt, 'dd/MM/yyyy HH:mm')}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-on-surface-variant">Chưa có phản hồi từ quản trị viên.</p>
              )}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
};

const LostItemCaseStatusPage = () => {
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadCases = async ({ quiet = false } = {}) => {
    if (quiet) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError('');

    try {
      const response = await customerSupportService.listMyLostItemCases();
      setCases(response.data || []);
    } catch (err) {
      setError(err.message || 'Không thể tải trạng thái đồ thất lạc. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

  const filterValidationError = useMemo(() => {
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      return 'Bộ lọc không hợp lệ: ngày bắt đầu phải trước hoặc bằng ngày kết thúc.';
    }
    return '';
  }, [dateFrom, dateTo]);

  const filteredCases = useMemo(() => {
    if (filterValidationError) return [];

    return cases.filter((supportCase) => {
      const keyword = query.trim().toLowerCase();
      const submittedAt = supportCase.createdAt ? new Date(supportCase.createdAt) : null;
      const matchesQuery = !keyword || [
        supportCase.caseId,
        supportCase.referenceNumber,
        supportCase.lostItem?.itemName,
        supportCase.lostItem?.itemCategory,
        supportCase.routeName,
      ].some((value) => String(value || '').toLowerCase().includes(keyword));
      const matchesStatus = statusFilter === 'ALL' || supportCase.currentCaseStatus === statusFilter;
      const matchesDateFrom = !dateFrom || (submittedAt && submittedAt >= new Date(dateFrom));
      const matchesDateTo = !dateTo || (submittedAt && submittedAt <= new Date(`${dateTo}T23:59:59`));

      return matchesQuery && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [cases, query, statusFilter, dateFrom, dateTo, filterValidationError]);

  const handleOpenCase = async (supportCase) => {
    try {
      const response = await customerSupportService.getMyLostItemCase(supportCase.caseId);
      setSelectedCase(response.data);
    } catch (err) {
      setError(err.message || 'Không thể tải chi tiết hồ sơ đồ thất lạc.');
    }
  };

  const resetFilters = () => {
    setQuery('');
    setStatusFilter('ALL');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="min-h-screen bg-surface-container-low">
      <Header />

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-32 sm:px-6 lg:px-8">
        <section className="rounded-[28px] bg-white p-6 shadow-xl shadow-primary/5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-on-tertiary-container">Chăm sóc khách hàng</p>
              <h1 className="mt-2 text-3xl font-headline font-black text-primary">Theo dõi đồ thất lạc</h1>
              <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
                Theo dõi báo cáo đồ thất lạc, tiến độ tìm kiếm, ghi chú của quản trị viên và hướng dẫn nhận lại.
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadCases({ quiet: true })}
              disabled={isRefreshing}
              className="inline-flex w-fit items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-black text-white hover:bg-primary-container disabled:opacity-60"
            >
              {isRefreshing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Làm mới trạng thái
            </button>
          </div>

          <div className="mt-6 grid gap-3 border-y border-outline-variant/40 py-5 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(150px,0.7fr))]">
            <label className="flex items-center gap-3 rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3">
              <Search className="h-5 w-5 text-outline" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm mã hồ sơ, đồ vật, tuyến..."
                className="w-full bg-transparent text-sm font-semibold text-primary outline-none placeholder:text-outline"
              />
            </label>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary" />
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary" />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary">
              <option value="ALL">Tất cả trạng thái</option>
              <option value="SUBMITTED">Đã gửi</option>
              <option value="UNDER_REVIEW">Đang xem xét</option>
              <option value="SEARCHING">Đang tìm kiếm</option>
              <option value="ITEM_FOUND">Đã tìm thấy</option>
              <option value="RESOLVED">Đã giải quyết</option>
              <option value="CLOSED">Đã đóng</option>
            </select>
            <button type="button" onClick={resetFilters} className="rounded-2xl border border-outline-variant/50 bg-white px-4 py-3 text-sm font-black text-primary hover:bg-surface">
              Đặt lại bộ lọc
            </button>
          </div>

          {filterValidationError ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
              {filterValidationError}
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex min-h-[260px] items-center justify-center gap-3 text-primary">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              Đang tải hồ sơ đồ thất lạc...
            </div>
          ) : error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : filteredCases.length ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {filteredCases.map((supportCase) => (
                <article
                  key={supportCase.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenCase(supportCase)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleOpenCase(supportCase);
                    }
                  }}
                  className="rounded-[24px] border border-outline-variant/35 bg-surface p-5 text-left transition hover:border-on-tertiary-container hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-xs font-black text-white">
                          <PackageCheck className="h-3.5 w-3.5" />
                          {formatCaseCode(supportCase.caseId)}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClassName(supportCase.currentCaseStatus)}`}>
                          {statusLabel(supportCase.currentCaseStatus)}
                        </span>
                      </div>
                      <h2 className="mt-3 text-lg font-black text-primary">{supportCase.lostItem?.itemName}</h2>
                      <p className="mt-1 text-sm text-on-surface-variant">{getCategoryLabel(supportCase.lostItem?.itemCategory)}</p>
                    </div>
                    <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-primary">Chi tiết</span>
                  </div>

                  <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-outline">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Ngày gửi
                      </p>
                      <p className="mt-1 font-bold text-primary">{formatDate(supportCase.createdAt, 'dd/MM/yyyy HH:mm')}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-outline">
                        <Clock3 className="h-3.5 w-3.5" />
                        Cập nhật lần cuối
                      </p>
                      <p className="mt-1 font-bold text-primary">{formatDate(supportCase.lastUpdatedAt, 'dd/MM/yyyy HH:mm')}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-wide text-outline">Thời gian dự kiến bị mất</p>
                      <p className="mt-1 font-bold text-primary">{formatDate(supportCase.lostItem?.lostAt, 'dd/MM/yyyy HH:mm')}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-outline">
                        <MapPin className="h-3.5 w-3.5" />
                        Tuyến
                      </p>
                      <p className="mt-1 font-bold text-primary">{supportCase.routeName || 'Chưa liên kết'}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[24px] border border-dashed border-outline-variant bg-surface-container-low px-5 py-12 text-center text-on-surface-variant">
              Không tìm thấy hồ sơ đồ thất lạc nào.
            </div>
          )}
        </section>
      </main>

      <CaseDetailModal supportCase={selectedCase} onClose={() => setSelectedCase(null)} />
    </div>
  );
};

export default LostItemCaseStatusPage;
