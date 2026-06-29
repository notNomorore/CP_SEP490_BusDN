import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  CalendarDays,
  CreditCard,
  LoaderCircle,
  QrCode,
  RefreshCw,
  Route,
  Search,
  Ticket,
  Trash2,
  WalletCards,
} from 'lucide-react';
import Header from '../../../shared/components/navigation/Header.jsx';
import toast from '../../../shared/utils/toast.js';
import ticketService from '../services/ticketService.js';

const formatDate = (value) => {
  if (!value) return 'Không có dữ liệu';
  try {
    return format(new Date(value), 'dd/MM/yyyy');
  } catch {
    return 'Không có dữ liệu';
  }
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

const statusClassName = (status) => {
  if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-700';
  if (status === 'UPCOMING') return 'bg-cyan-50 text-cyan-700';
  if (status === 'USED') return 'bg-blue-50 text-blue-700';
  if (status === 'EXPIRED') return 'bg-amber-50 text-amber-700';
  if (status === 'CANCELLED') return 'bg-red-50 text-red-700';
  return 'bg-slate-100 text-slate-700';
};

const statusLabel = (status) => ({
  ACTIVE: 'Còn hiệu lực',
  UPCOMING: 'Sắp kích hoạt',
  USED: 'Đã sử dụng',
  EXPIRED: 'Đã hết hạn',
  CANCELLED: 'Đã hủy',
  REFUNDED: 'Đã hoàn tiền',
  PENDING: 'Da dat ve',
  PAID: 'Đã thanh toán',
  FAILED: 'Thất bại',
}[status] || status || 'Không xác định');

const paymentStatusLabel = (status) => ({
  PENDING: 'Chua thanh toan',
  PAID: 'Da thanh toan',
  FAILED: 'Thanh toan that bai',
}[status] || status || 'Chua thanh toan');

const passengerTypeLabel = (type) => ({
  STANDARD: 'Vé phổ thông',
  STUDENT: 'Vé học sinh / sinh viên',
  PRIORITY: 'Vé ưu tiên',
}[type] || 'Vé phổ thông');

const paymentMethodLabel = (method) => ({
  E_WALLET: 'Ví điện tử',
  CREDIT_CARD: 'Thẻ tín dụng',
  CASHLESS: 'Quét QR ngân hàng',
  ONLINE_BANKING: 'Ngân hàng trực tuyến',
}[method] || method || 'Chua chon phuong thuc');

const ticketTypeLabel = (type) => ({
  ONE_WAY: 'Vé một lượt',
  MONTHLY_PASS: 'Vé tháng',
}[type] || type || 'Vé một lượt');

const isPendingPaymentTicket = (ticket) => (
  ticket?.status === 'PENDING'
  && ticket?.paymentStatus === 'PENDING'
  && ticket?.bookingStatus !== 'CANCELLED'
  && ticket?.ticketStatus !== 'CANCELLED'
);

const buildCheckoutOrderFromTicket = (ticket) => ({
  ticketType: 'ONE_WAY',
  route: {
    id: ticket.routeId?._id || ticket.routeId || ticket.route?.id || ticket.route?._id,
    _id: ticket.routeId?._id || ticket.routeId || ticket.route?.id || ticket.route?._id,
    routeNumber: ticket.routeNumber,
    name: ticket.tripInfo?.routeName || ticket.routeNumber,
  },
  routeNumber: ticket.routeNumber,
  routeName: ticket.tripInfo?.routeName || ticket.routeNumber,
  departureLocation: ticket.departureLocation,
  destinationLocation: ticket.destinationLocation,
  serviceDate: ticket.serviceDate ? String(ticket.serviceDate).slice(0, 10) : '',
  expiryDate: ticket.serviceDate ? String(ticket.serviceDate).slice(0, 10) : '',
  departureTime: ticket.departureTime,
  passengerType: ticket.passengerType || 'STANDARD',
  passengerTypeLabel: passengerTypeLabel(ticket.passengerType),
  price: ticket.ticketPrice,
});

const getPassDisplayStatus = (pass) => {
  if (pass.passStatus === 'CANCELLED') return 'CANCELLED';
  if (pass.passStatus === 'REFUNDED') return 'REFUNDED';

  const now = Date.now();
  const startDate = pass.startDate ? new Date(pass.startDate).getTime() : 0;
  const expiryDate = pass.expiryDate ? new Date(pass.expiryDate).getTime() : 0;

  if (startDate && startDate > now) return 'UPCOMING';
  if (expiryDate && expiryDate < now) return 'EXPIRED';
  return pass.passStatus || 'ACTIVE';
};

const MyTicketsPage = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [monthlyPasses, setMonthlyPasses] = useState([]);
  const [query, setQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [ticketTypeFilter, setTicketTypeFilter] = useState('ALL');
  const [routeFilter, setRouteFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortOption, setSortOption] = useState('PURCHASE_DESC');
  const [isLoading, setIsLoading] = useState(true);
  const [processingTicketId, setProcessingTicketId] = useState('');
  const [error, setError] = useState('');

  const loadTickets = async () => {
    setIsLoading(true);
    setError('');

    try {
      const [ticketPayload, passPayload] = await Promise.all([
        ticketService.getMyTickets(),
        ticketService.getMyMonthlyPasses(),
      ]);
      setTickets(ticketPayload.tickets || []);
      setMonthlyPasses(passPayload.passes || []);
    } catch (err) {
      setError(err.message || 'Không thể tải lịch sử vé. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handlePayPendingTicket = async (event, ticket) => {
    event.stopPropagation();
    setProcessingTicketId(ticket.id);
    setError('');

    try {
      const payment = await ticketService.createPendingTicketPayment(ticket.id);
      if (payment.status === 'PAID') {
        toast.success(payment.message || 'Thanh toán thành công. Vé đã được kích hoạt.');
        await loadTickets();
        return;
      }

      navigate('/tickets/checkout', {
        state: {
          order: buildCheckoutOrderFromTicket(ticket),
          payment,
        },
      });
    } catch (err) {
      const message = err?.message || 'Không thể tạo mã thanh toán cho vé này.';
      setError(message);
      toast.error(message);
    } finally {
      setProcessingTicketId('');
    }
  };

  const handleDeletePendingTicket = async (event, ticket) => {
    event.stopPropagation();

    if (!window.confirm('Xóa vé chưa thanh toán này?')) {
      return;
    }

    setProcessingTicketId(ticket.id);
    setError('');
    try {
      await ticketService.cancelTicket(ticket.id);
      toast.success('Đã xóa vé chưa thanh toán.');
      await loadTickets();
    } catch (err) {
      const message = err?.message || 'Không thể xóa vé này.';
      setError(message);
      toast.error(message);
    } finally {
      setProcessingTicketId('');
    }
  };

  const handleCancelPendingTicket = async (event, ticket) => {
    event.stopPropagation();

    if (!window.confirm('Huy ve chua thanh toan nay?')) {
      return;
    }

    setProcessingTicketId(ticket.id);
    setError('');
    try {
      await ticketService.cancelTicket(ticket.id);
      toast.success('Da huy ve chua thanh toan.');
      await loadTickets();
    } catch (err) {
      const message = err?.message || 'Khong the huy ve nay.';
      setError(message);
      toast.error(message);
    } finally {
      setProcessingTicketId('');
    }
  };

  const routeOptions = useMemo(() => Array.from(new Set(
    tickets.map((ticket) => ticket.routeNumber).filter(Boolean)
  )).sort(), [tickets]);

  const ticketTypeOptions = ['STANDARD', 'STUDENT', 'PRIORITY'];

  const dashboardStats = useMemo(() => {
    const passItems = monthlyPasses.map((pass) => ({ status: getPassDisplayStatus(pass) }));
    const allItems = [
      ...tickets.map((ticket) => ({ status: ticket.status })),
      ...passItems,
    ];
    const countStatus = (statuses) => allItems.filter((item) => statuses.includes(item.status)).length;

    return [
      { label: 'Tất cả vé', value: allItems.length, detail: 'Vé một lượt và vé tháng' },
      { label: 'Còn hiệu lực', value: countStatus(['ACTIVE']), detail: 'Có thể dùng để lên xe' },
      { label: 'Sắp dùng', value: countStatus(['UPCOMING', 'PENDING']), detail: 'Chờ kích hoạt hoặc xử lý' },
      { label: 'Lịch sử', value: countStatus(['USED', 'EXPIRED', 'CANCELLED', 'REFUNDED']), detail: 'Đã dùng, hết hạn hoặc hủy' },
    ];
  }, [tickets, monthlyPasses]);

  const filterValidationError = useMemo(() => {
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      return 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.';
    }
    return '';
  }, [dateFrom, dateTo]);

  const filteredTickets = useMemo(() => {
    if (filterValidationError) return [];

    return tickets.filter((ticket) => {
      const matchesStatus = statusFilter === 'ALL' || ticket.status === statusFilter;
      const matchesType = ticketTypeFilter === 'ALL' || (ticket.passengerType || 'STANDARD') === ticketTypeFilter;
      const matchesRoute = routeFilter === 'ALL' || ticket.routeNumber === routeFilter;
      const travelDate = ticket.serviceDate ? new Date(ticket.serviceDate) : null;
      const matchesDateFrom = !dateFrom || (travelDate && travelDate >= new Date(dateFrom));
      const matchesDateTo = !dateTo || (travelDate && travelDate <= new Date(`${dateTo}T23:59:59`));
      const keyword = query.trim().toLowerCase();
      const matchesQuery = !keyword || [
        ticket.ticketCode,
        ticket.routeNumber,
        ticket.tripInfo?.routeName,
        ticket.departureLocation,
        ticket.destinationLocation,
        passengerTypeLabel(ticket.passengerType),
        ticket.paymentMethod,
        ticket.paymentStatus,
      ].some((value) => String(value || '').toLowerCase().includes(keyword));

      return matchesStatus && matchesType && matchesRoute && matchesDateFrom && matchesDateTo && matchesQuery;
    }).sort((left, right) => {
      const purchaseLeft = new Date(left.purchasedAt || 0).getTime();
      const purchaseRight = new Date(right.purchasedAt || 0).getTime();
      const travelLeft = new Date(left.serviceDate || 0).getTime();
      const travelRight = new Date(right.serviceDate || 0).getTime();
      const priceLeft = Number(left.ticketPrice || 0);
      const priceRight = Number(right.ticketPrice || 0);

      if (sortOption === 'PURCHASE_ASC') return purchaseLeft - purchaseRight;
      if (sortOption === 'TRAVEL_DESC') return travelRight - travelLeft;
      if (sortOption === 'TRAVEL_ASC') return travelLeft - travelRight;
      if (sortOption === 'PRICE_DESC') return priceRight - priceLeft;
      if (sortOption === 'PRICE_ASC') return priceLeft - priceRight;
      return purchaseRight - purchaseLeft;
    });
  }, [
    tickets,
    query,
    dateFrom,
    dateTo,
    ticketTypeFilter,
    routeFilter,
    statusFilter,
    sortOption,
    filterValidationError,
  ]);

  const resetFilters = () => {
    setQuery('');
    setDateFrom('');
    setDateTo('');
    setTicketTypeFilter('ALL');
    setRouteFilter('ALL');
    setStatusFilter('ALL');
    setSortOption('PURCHASE_DESC');
  };

  return (
    <div className="min-h-screen bg-surface-container-low">
      <Header />

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-32 sm:px-6 lg:px-8">
        <section className="rounded-[28px] bg-white p-6 shadow-xl shadow-primary/5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-on-tertiary-container">Hoạt động hành khách</p>
              <h1 className="mt-2 text-3xl font-headline font-black text-primary">Tất cả vé của tôi</h1>
              <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
                Xem và quản lý vé đang hiệu lực, vé sắp dùng, vé đã sử dụng, vé hết hạn và vé tháng.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/tickets/purchase')}
                className="inline-flex items-center gap-2 rounded-full bg-secondary-container px-4 py-2 text-sm font-black text-on-secondary-container hover:bg-secondary-fixed"
              >
                <Ticket className="h-4 w-4" />
                Mua vé mới
              </button>
              <button
                type="button"
                onClick={loadTickets}
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-white px-4 py-2 text-sm font-black text-primary hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
              <div className="rounded-full bg-primary-fixed px-4 py-2 text-sm font-black text-on-primary-fixed">
                {filteredTickets.length} / {tickets.length} vé một lượt · {monthlyPasses.length} vé tháng
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {dashboardStats.map((card) => (
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
                placeholder="Tìm mã vé, tuyến xe hoặc điểm dừng..."
                className="w-full bg-transparent text-sm font-semibold text-primary outline-none placeholder:text-outline"
              />
            </label>
            <label className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-2">
              <span className="block text-[11px] font-black uppercase tracking-wide text-outline">Từ ngày</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="mt-1 w-full bg-transparent text-sm font-bold text-primary outline-none"
                aria-label="Lọc từ ngày đi"
              />
            </label>
            <label className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-2">
              <span className="block text-[11px] font-black uppercase tracking-wide text-outline">Đến ngày</span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="mt-1 w-full bg-transparent text-sm font-bold text-primary outline-none"
                aria-label="Lọc đến ngày đi"
              />
            </label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary">
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Còn hiệu lực</option>
              <option value="PENDING">Da dat ve</option>
              <option value="USED">Đã sử dụng</option>
              <option value="EXPIRED">Đã hết hạn</option>
              <option value="CANCELLED">Đã hủy</option>
              <option value="REFUNDED">Đã hoàn tiền</option>
            </select>
            <select value={ticketTypeFilter} onChange={(event) => setTicketTypeFilter(event.target.value)} className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary">
              <option value="ALL">Tất cả loại hành khách</option>
              {ticketTypeOptions.map((type) => (
                <option key={type} value={type}>{passengerTypeLabel(type)}</option>
              ))}
            </select>
            <select value={routeFilter} onChange={(event) => setRouteFilter(event.target.value)} className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary">
              <option value="ALL">Tất cả tuyến xe</option>
              {routeOptions.map((routeNumber) => (
                <option key={routeNumber} value={routeNumber}>{routeNumber}</option>
              ))}
            </select>
            <select value={sortOption} onChange={(event) => setSortOption(event.target.value)} className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary">
              <option value="PURCHASE_DESC">Mua gần đây nhất</option>
              <option value="PURCHASE_ASC">Mua lâu nhất</option>
              <option value="TRAVEL_DESC">Ngày đi gần nhất</option>
              <option value="TRAVEL_ASC">Ngày đi xa nhất</option>
              <option value="PRICE_DESC">Giá cao nhất</option>
              <option value="PRICE_ASC">Giá thấp nhất</option>
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
              Đang tải lịch sử vé...
            </div>
          ) : error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : filteredTickets.length ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {filteredTickets.map((ticket) => (
                <article
                  key={ticket.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/my-tickets/${ticket.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/my-tickets/${ticket.id}`);
                    }
                  }}
                  className="rounded-[24px] border border-outline-variant/35 bg-surface p-5 text-left transition hover:border-on-tertiary-container hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-xs font-black text-white">
                          <Ticket className="h-3.5 w-3.5" />
                          {ticketTypeLabel(ticket.ticketType)}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClassName(ticket.status)}`}>
                          {statusLabel(ticket.status)}
                        </span>
                      </div>
                      <h2 className="mt-3 font-mono text-sm font-black text-primary">{formatTicketCode(ticket.ticketCode)}</h2>
                    </div>
                    {ticket.status === 'ACTIVE' ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/my-tickets/${ticket.id}`);
                        }}
                        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-container"
                      >
                        <QrCode className="h-4 w-4" />
                        Xem ma QR
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600">
                        <QrCode className="h-4 w-4" />
                        QR chua kha dung
                      </span>
                    )}
                  </div>

                  <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-outline">
                        <Route className="h-3.5 w-3.5" />
                        Tuyến xe
                      </p>
                      <p className="mt-1 font-bold text-primary">{ticket.routeNumber}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{ticket.tripInfo?.routeName || 'Thông tin tuyến xe'}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-outline">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Hành trình
                      </p>
                      <p className="mt-1 font-bold text-primary">{formatDate(ticket.serviceDate)} lúc {ticket.departureTime}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-wide text-outline">Điểm đi</p>
                      <p className="mt-1 font-bold text-primary">{ticket.departureLocation}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-wide text-outline">Điểm đến</p>
                      <p className="mt-1 font-bold text-primary">{ticket.destinationLocation}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-wide text-outline">Đối tượng</p>
                      <p className="mt-1 font-bold text-primary">{passengerTypeLabel(ticket.passengerType)}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-outline">
                        <CreditCard className="h-3.5 w-3.5" />
                        Giá vé
                      </p>
                      <p className="mt-1 font-bold text-primary">{formatCurrency(ticket.ticketPrice)}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-wide text-outline">Ngày mua</p>
                      <p className="mt-1 font-bold text-primary">{formatDate(ticket.purchasedAt)}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-wide text-outline">Thanh toán</p>
                      <p className="mt-1 font-bold text-primary">
                        {paymentStatusLabel(ticket.paymentStatus)} - {paymentMethodLabel(ticket.paymentMethod)}
                      </p>
                    </div>
                  </div>
                  {isPendingPaymentTicket(ticket) ? (
                    <div className="mt-4 grid gap-3 border-t border-outline-variant/40 pt-4 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={(event) => handlePayPendingTicket(event, ticket)}
                        disabled={processingTicketId === ticket.id}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-secondary px-4 py-3 text-sm font-black text-white hover:bg-secondary-fixed-dim disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {processingTicketId === ticket.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <WalletCards className="h-4 w-4" />}
                        Thanh toan
                      </button>
                      <button
                        type="button"
                        onClick={(event) => handleCancelPendingTicket(event, ticket)}
                        disabled={processingTicketId === ticket.id}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-4 py-3 text-sm font-black text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        Huy ve
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[24px] border border-dashed border-outline-variant bg-surface-container-low px-5 py-12 text-center text-on-surface-variant">
              Chưa có vé một lượt phù hợp.
            </div>
          )}

          <div className="mt-10 border-t border-outline-variant/40 pt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-on-tertiary-container">Đi lại không giới hạn</p>
                <h2 className="mt-2 text-2xl font-black text-primary">Vé tháng của tôi</h2>
              </div>
              <span className="rounded-full bg-primary-fixed px-4 py-2 text-sm font-black text-on-primary-fixed">
                {monthlyPasses.length} vé tháng
              </span>
            </div>

            {monthlyPasses.length ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {monthlyPasses.map((pass) => {
                  const passStatus = getPassDisplayStatus(pass);

                  return (
                    <article key={pass._id || pass.passCode} className="rounded-[24px] border border-outline-variant/35 bg-surface p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-xs font-black text-white">
                            <Ticket className="h-3.5 w-3.5" />
                            Vé tháng
                          </span>
                          <h3 className="mt-3 font-mono text-sm font-black text-primary">{pass.passCode}</h3>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClassName(passStatus)}`}>
                          {statusLabel(passStatus)}
                        </span>
                      </div>
                      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                        {pass.digitalPass?.qrCodeImage ? (
                          <div className="rounded-2xl bg-white px-4 py-3 sm:col-span-2">
                            <p className="text-xs font-black uppercase tracking-wide text-outline">Mã QR vé tháng</p>
                            <img src={pass.digitalPass.qrCodeImage} alt="Monthly pass QR code" className="mx-auto mt-3 h-44 w-44 object-contain" />
                            <p className="mt-2 break-all text-center font-mono text-[11px] font-bold text-outline">
                              {pass.digitalPass.qrPayload?.slice(0, 32)}...
                            </p>
                          </div>
                        ) : null}
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-xs font-black uppercase tracking-wide text-outline">Đối tượng</p>
                          <p className="mt-1 font-bold text-primary">{passengerTypeLabel(pass.passType)}</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-xs font-black uppercase tracking-wide text-outline">Thời hạn</p>
                          <p className="mt-1 font-bold text-primary">{formatDate(pass.startDate)} - {formatDate(pass.expiryDate)}</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-xs font-black uppercase tracking-wide text-outline">Giá vé</p>
                          <p className="mt-1 font-bold text-primary">{formatCurrency(pass.passPrice)}</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-xs font-black uppercase tracking-wide text-outline">Thanh toán</p>
                          <p className="mt-1 font-bold text-primary">
                            {paymentStatusLabel(pass.paymentStatus)} - {paymentMethodLabel(pass.paymentMethod)}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-dashed border-outline-variant bg-surface-container-low px-5 py-10 text-center text-on-surface-variant">
                Bạn chưa mua vé tháng.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default MyTicketsPage;
