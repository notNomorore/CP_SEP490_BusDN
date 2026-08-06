import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowUpDown,
  BusFront,
  CalendarDays,
  Clock3,
  CreditCard,
  LoaderCircle,
  MapPin,
  Route,
  Search,
  Ticket,
  X,
} from 'lucide-react';
import Header from '../../../shared/components/navigation/Header.jsx';
import travelHistoryService from '../services/travelHistoryService.js';

const formatDate = (value, pattern = 'dd/MM/yyyy') => {
  if (!value) return 'Chưa có dữ liệu';
  try {
    return format(new Date(value), pattern);
  } catch {
    return 'Chưa có dữ liệu';
  }
};

const formatDuration = (minutes = 0) => {
  const value = Number(minutes) || 0;
  const hours = Math.floor(value / 60);
  const remainingMinutes = value % 60;
  return hours ? `${hours} giờ ${remainingMinutes} phút` : `${remainingMinutes} phút`;
};

const roundCurrency = (value) => {
  const amount = Number(value) || 0;
  if (amount <= 0) return 0;
  return Math.max(Math.round(amount / 1000) * 1000, 1000);
};

const formatCurrency = (value) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(roundCurrency(value));

const formatTicketCode = (code) => {
  const value = String(code || '').toUpperCase();
  if (!value) return '';
  if (value.length <= 10) return value;
  const compact = value.replace(/^TKT-?/, '').replace(/[^A-Z0-9]/g, '');
  return `TKT-${compact.slice(-6)}`;
};

const STATUS_LABELS = {
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  INTERRUPTED: 'Gián đoạn',
  MISSED_TRIP: 'Lỡ chuyến',
};

const formatStatus = (status) => STATUS_LABELS[status] || String(status || 'COMPLETED').replace(/_/g, ' ');

const statusClassName = (status) => {
  if (status === 'COMPLETED') return 'bg-emerald-50 text-emerald-700';
  if (status === 'CANCELLED') return 'bg-red-50 text-red-700';
  if (status === 'INTERRUPTED') return 'bg-amber-50 text-amber-700';
  if (status === 'MISSED_TRIP') return 'bg-slate-200 text-slate-700';
  return 'bg-blue-50 text-blue-700';
};

const DetailRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 border-b border-outline-variant/30 py-2 text-sm last:border-b-0">
    <span className="text-on-surface-variant">{label}</span>
    <span className="text-right font-bold text-primary">{value || 'Chưa có dữ liệu'}</span>
  </div>
);

const TravelDetailModal = ({ record, onClose }) => {
  if (!record) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-primary/40 px-4">
      <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant/40 px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-on-tertiary-container">Chi tiết chuyến đi</p>
            <h2 className="mt-2 text-2xl font-headline font-black text-primary">Chuyến {record.routeNumber}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">{record.boardingStop} đến {record.destinationStop}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-outline hover:bg-surface">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-5 px-6 py-5 lg:grid-cols-2">
          <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-black text-primary">
              <Route className="h-5 w-5" />
              Thông tin chuyến đi
            </h3>
            <DetailRow label="Mã lịch sử" value={record.travelHistoryId} />
            <DetailRow label="Mã chuyến" value={record.tripId} />
            <DetailRow label="Tuyến" value={`${record.routeNumber} - ${record.routeName}`} />
            <DetailRow label="Điểm lên xe" value={record.boardingStop} />
            <DetailRow label="Điểm đến" value={record.destinationStop} />
            <DetailRow label="Ngày đi" value={formatDate(record.travelDate)} />
            <DetailRow label="Giờ lên xe" value={formatDate(record.boardingTime, 'HH:mm dd/MM/yyyy')} />
            <DetailRow label="Giờ đến" value={formatDate(record.arrivalTime, 'HH:mm dd/MM/yyyy')} />
            <DetailRow label="Thời gian di chuyển" value={formatDuration(record.travelDurationMinutes)} />
            <DetailRow label="Trạng thái chuyến" value={formatStatus(record.travelStatus)} />
          </div>

          <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-black text-primary">
              <Ticket className="h-5 w-5" />
              Thông tin vé
            </h3>
            <DetailRow label="Loại vé" value={record.ticketType} />
            <DetailRow label="Mã vé" value={formatTicketCode(record.ticketId) || 'Bản ghi chưa đầy đủ'} />
            <DetailRow label="Giá vé" value={formatCurrency(record.fareAmount)} />
            <DetailRow label="Phương thức thanh toán" value={record.paymentMethod} />
            <DetailRow label="Phương tiện" value={record.vehicleLabel || 'Chưa phân xe'} />
            <DetailRow label="Trạng thái tham chiếu" value={record.detailStatus} />
          </div>
        </div>

        {!record.hasTicketReference ? (
          <div className="mx-6 mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
            Thiếu tham chiếu vé hoặc chuyến đi. Hệ thống chỉ hiển thị thông tin di chuyển hiện có.
          </div>
        ) : null}
      </section>
    </div>
  );
};

const TravelHistoryPage = () => {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [query, setQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [routeFilter, setRouteFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortOption, setSortOption] = useState('DATE_DESC');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadTravelHistory = async () => {
      setIsLoading(true);
      setError('');

      try {
        const payload = await travelHistoryService.getTravelHistory();
        setRecords(payload.records || []);
        setSummary(payload.summary || null);
      } catch (err) {
        setError(err.message || 'Không thể tải lịch sử chuyến đi. Vui lòng thử lại sau.');
      } finally {
        setIsLoading(false);
      }
    };

    loadTravelHistory();
  }, []);

  const routeOptions = useMemo(() => Array.from(new Set(
    records.map((record) => record.routeNumber).filter(Boolean)
  )).sort(), [records]);

  const filterValidationError = useMemo(() => {
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      return 'Bộ lọc không hợp lệ: ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.';
    }
    return '';
  }, [dateFrom, dateTo]);

  const filteredRecords = useMemo(() => {
    if (filterValidationError) return [];

    return records.filter((record) => {
      const travelDate = record.travelDate ? new Date(record.travelDate) : null;
      const matchesDateFrom = !dateFrom || (travelDate && travelDate >= new Date(dateFrom));
      const matchesDateTo = !dateTo || (travelDate && travelDate <= new Date(`${dateTo}T23:59:59`));
      const matchesRoute = routeFilter === 'ALL' || record.routeNumber === routeFilter;
      const matchesStatus = statusFilter === 'ALL' || record.travelStatus === statusFilter;
      const keyword = query.trim().toLowerCase();
      const matchesQuery = !keyword || [
        record.travelHistoryId,
        record.tripId,
        record.routeNumber,
        record.routeName,
        record.boardingStop,
        record.destinationStop,
        record.ticketId,
      ].some((value) => String(value || '').toLowerCase().includes(keyword));

      return matchesDateFrom && matchesDateTo && matchesRoute && matchesStatus && matchesQuery;
    }).sort((left, right) => {
      const dateLeft = new Date(left.boardingTime || 0).getTime();
      const dateRight = new Date(right.boardingTime || 0).getTime();
      const fareLeft = Number(left.fareAmount || 0);
      const fareRight = Number(right.fareAmount || 0);
      const durationLeft = Number(left.travelDurationMinutes || 0);
      const durationRight = Number(right.travelDurationMinutes || 0);

      if (sortOption === 'DATE_ASC') return dateLeft - dateRight;
      if (sortOption === 'FARE_DESC') return fareRight - fareLeft;
      if (sortOption === 'FARE_ASC') return fareLeft - fareRight;
      if (sortOption === 'DURATION_DESC') return durationRight - durationLeft;
      if (sortOption === 'DURATION_ASC') return durationLeft - durationRight;
      return dateRight - dateLeft;
    });
  }, [records, query, dateFrom, dateTo, routeFilter, statusFilter, sortOption, filterValidationError]);

  const resetFilters = () => {
    setQuery('');
    setDateFrom('');
    setDateTo('');
    setRouteFilter('ALL');
    setStatusFilter('ALL');
    setSortOption('DATE_DESC');
  };

  const statCards = [
    { label: 'Tổng bản ghi', value: summary?.totalTrips || 0, detail: 'Hoạt động di chuyển' },
    { label: 'Hoàn thành', value: summary?.statusCounts?.COMPLETED || 0, detail: 'Chuyến đã hoàn tất' },
    { label: 'Thời gian', value: formatDuration(summary?.totalDurationMinutes || 0), detail: 'Tổng thời gian ghi nhận' },
    { label: 'Tổng tiền vé', value: formatCurrency(summary?.totalFare || 0), detail: 'Giá vé đã liên kết' },
  ];

  return (
    <div className="min-h-screen bg-surface-container-low">
      <Header />

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-32 sm:px-6 lg:px-8">
        <section className="rounded-[28px] bg-white p-6 shadow-xl shadow-primary/5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-on-tertiary-container">Hoạt động hành khách</p>
              <h1 className="mt-2 text-3xl font-headline font-black text-primary">Lịch sử chuyến đi</h1>
              <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
                Xem lại các chuyến đã hoàn thành, hoạt động tuyến, vé đã liên kết, giá vé và lịch sử sử dụng dịch vụ.
              </p>
            </div>
            <div className="rounded-full bg-primary-fixed px-4 py-2 text-sm font-black text-on-primary-fixed">
              {filteredRecords.length} / {records.length} bản ghi
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => (
              <div key={card.label} className="rounded-[24px] border border-outline-variant/35 bg-surface px-5 py-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-outline">{card.label}</p>
                <p className="mt-3 text-2xl font-headline font-black text-primary">{card.value}</p>
                <p className="mt-2 text-sm text-on-surface-variant">{card.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-3 border-y border-outline-variant/40 py-5 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(150px,0.7fr))]">
            <label className="flex items-center gap-3 rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3">
              <Search className="h-5 w-5 text-outline" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm chuyến, tuyến, trạm hoặc mã vé..."
                className="w-full bg-transparent text-sm font-semibold text-primary outline-none placeholder:text-outline"
              />
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary"
              aria-label="Lọc từ ngày đi"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary"
              aria-label="Lọc đến ngày đi"
            />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary">
              <option value="ALL">Tất cả trạng thái</option>
              <option value="COMPLETED">Hoàn thành</option>
              <option value="CANCELLED">Đã hủy</option>
              <option value="INTERRUPTED">Gián đoạn</option>
              <option value="MISSED_TRIP">Lỡ chuyến</option>
            </select>
            <select value={routeFilter} onChange={(event) => setRouteFilter(event.target.value)} className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary">
              <option value="ALL">Tất cả tuyến</option>
              {routeOptions.map((routeNumber) => (
                <option key={routeNumber} value={routeNumber}>{routeNumber}</option>
              ))}
            </select>
            <select value={sortOption} onChange={(event) => setSortOption(event.target.value)} className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary">
              <option value="DATE_DESC">Chuyến mới nhất</option>
              <option value="DATE_ASC">Chuyến cũ nhất</option>
              <option value="FARE_DESC">Giá vé cao nhất</option>
              <option value="FARE_ASC">Giá vé thấp nhất</option>
              <option value="DURATION_DESC">Thời gian dài nhất</option>
              <option value="DURATION_ASC">Thời gian ngắn nhất</option>
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
              Đang tải lịch sử chuyến đi...
            </div>
          ) : error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : filteredRecords.length ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {filteredRecords.map((record) => (
                <article
                  key={record.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedRecord(record)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedRecord(record);
                    }
                  }}
                  className="rounded-[24px] border border-outline-variant/35 bg-surface p-5 text-left transition hover:border-on-tertiary-container hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-xs font-black text-white">
                          <BusFront className="h-3.5 w-3.5" />
                          {record.routeNumber}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClassName(record.travelStatus)}`}>
                          {formatStatus(record.travelStatus)}
                        </span>
                      </div>
                      <h2 className="mt-3 font-mono text-sm font-black text-primary">{record.tripId}</h2>
                      <p className="mt-1 text-sm text-on-surface-variant">{record.routeName}</p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-primary">
                      <ArrowUpDown className="h-4 w-4" />
                      Chi tiết
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-outline">
                        <MapPin className="h-3.5 w-3.5" />
                        Điểm lên xe
                      </p>
                      <p className="mt-1 font-bold text-primary">{record.boardingStop}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-wide text-outline">Điểm đến</p>
                      <p className="mt-1 font-bold text-primary">{record.destinationStop}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-outline">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Ngày đi
                      </p>
                      <p className="mt-1 font-bold text-primary">{formatDate(record.travelDate)}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-outline">
                        <Clock3 className="h-3.5 w-3.5" />
                        Thời gian
                      </p>
                      <p className="mt-1 font-bold text-primary">{formatDuration(record.travelDurationMinutes)}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-outline">
                        <Ticket className="h-3.5 w-3.5" />
                        Mã vé
                      </p>
                      <p className="mt-1 font-bold text-primary">{formatTicketCode(record.ticketId) || 'Bản ghi chưa đầy đủ'}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-outline">
                        <CreditCard className="h-3.5 w-3.5" />
                        Giá vé
                      </p>
                      <p className="mt-1 font-bold text-primary">{formatCurrency(record.fareAmount)}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[24px] border border-dashed border-outline-variant bg-surface-container-low px-5 py-12 text-center text-on-surface-variant">
              Không tìm thấy lịch sử chuyến đi nào.
            </div>
          )}
        </section>
      </main>

      <TravelDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </div>
  );
};

export default TravelHistoryPage;
