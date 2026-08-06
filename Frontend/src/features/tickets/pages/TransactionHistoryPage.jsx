import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  History,
  Loader2,
  ReceiptText,
  Ticket,
} from 'lucide-react';
import Header from '../../../shared/components/navigation/Header.jsx';
import ticketService from '../services/ticketService.js';

const formatCurrency = (value) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

const getDateParts = (value) => {
  if (!value) {
    return {
      date: 'Chưa có ngày',
      time: 'Chưa có giờ',
    };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return {
      date: 'Chưa có ngày',
      time: 'Chưa có giờ',
    };
  }

  return {
    date: new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(parsed),
    time: new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed),
  };
};

const getTicketLabel = (transaction) => (
  transaction.ticketType === 'MONTHLY_PASS' ? 'Vé tháng' : 'Vé một lượt'
);

const getPaymentMethodLabel = (method) => {
  const normalized = String(method || '').trim().toUpperCase();
  if (normalized === 'PAYOS') return 'PayOS / Ngân hàng';
  if (normalized === 'CASH') return 'Tiền mặt';
  return method || 'Thanh toán online';
};

const getRouteLabel = (transaction) => {
  const parts = [transaction.routeCode, transaction.routeName]
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index);
  return parts.join(' - ') || 'Chưa có tuyến';
};

const getTripLabel = (transaction) => {
  if (transaction.fromStop && transaction.toStop) {
    return `${transaction.fromStop} - ${transaction.toStop}`;
  }
  if (transaction.ticketCode) {
    return `Mã vé: ${transaction.ticketCode}`;
  }
  return 'Thông tin vé đã thanh toán';
};

const TransactionHistoryPage = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadTransactions = async () => {
      setIsLoading(true);
      setError('');

      try {
        const result = await ticketService.getMyTransactions();
        if (!isMounted) return;

        const paidTransactions = Array.isArray(result?.transactions) ? result.transactions : [];
        setTransactions(paidTransactions);
        setTotalPaid(Number(result?.totalPaid || paidTransactions.reduce((sum, item) => sum + Number(item.amount || 0), 0)));
      } catch (err) {
        if (!isMounted) return;
        setError(err?.message || 'Không thể tải lịch sử giao dịch.');
        setTransactions([]);
        setTotalPaid(0);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadTransactions();

    return () => {
      isMounted = false;
    };
  }, []);

  const successfulCount = useMemo(
    () => transactions.filter((item) => item.status === 'PAID').length,
    [transactions]
  );

  const latestTransaction = transactions[0];
  const latestDate = latestTransaction
    ? getDateParts(latestTransaction.paidAt || latestTransaction.completedAt || latestTransaction.createdAt).date
    : 'Chưa có giao dịch';

  const openTicket = (transaction) => {
    if (transaction.ticketId) {
      navigate(`/my-tickets/${transaction.ticketId}`);
      return;
    }
    navigate('/my-tickets');
  };

  return (
    <div className="min-h-screen bg-surface-container-low">
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-32 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[28px] border border-outline-variant/40 bg-white shadow-xl shadow-primary/5">
          <section className="bg-gradient-to-r from-primary to-primary-container px-6 py-7 text-white sm:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-primary-fixed">Thanh toán</p>
                <h1 className="mt-2 text-3xl font-headline font-black">Lịch sử giao dịch</h1>
                <p className="mt-2 max-w-2xl text-sm text-white/78">
                  Theo dõi các lần mua vé đã thanh toán thành công của tài khoản đang đăng nhập.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/tickets/purchase')}
                className="inline-flex w-fit items-center justify-center gap-2 rounded-full bg-primary-fixed px-5 py-3 text-sm font-black text-on-primary-fixed hover:bg-primary-fixed-dim"
              >
                <Ticket className="h-4 w-4" />
                Mua vé mới
              </button>
            </div>
          </section>

          <section className="px-6 py-6 sm:px-8">
            <div className="grid gap-4 lg:grid-cols-3">
              <SummaryCard
                label="Tổng giao dịch"
                value={transactions.length}
                detail="Đã thanh toán"
                icon={<History className="h-5 w-5" />}
              />
              <SummaryCard
                label="Thành công"
                value={successfulCount}
                detail="Không hiển thị đơn thất bại"
                icon={<CheckCircle2 className="h-5 w-5" />}
                active
              />
              <SummaryCard
                label="Tổng chi tiêu"
                value={formatCurrency(totalPaid)}
                detail={`Gần nhất: ${latestDate}`}
                icon={<CreditCard className="h-5 w-5" />}
              />
            </div>

            <div className="mt-7 flex flex-col gap-3 border-b border-outline-variant/50 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-secondary">Danh sách giao dịch</p>
                <h2 className="mt-1 text-xl font-black text-primary">Vé đã mua thành công</h2>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-surface px-4 py-2 text-xs font-bold text-on-surface-variant">
                <ReceiptText className="h-4 w-4" />
                {transactions.length} giao dịch
              </div>
            </div>

            <div className="mt-4">
              {isLoading ? (
                <StateMessage
                  icon={<Loader2 className="h-5 w-5 animate-spin" />}
                  title="Đang tải giao dịch"
                  description="Hệ thống đang lấy các đơn mua vé đã thanh toán thành công."
                />
              ) : error ? (
                <StateMessage
                  title="Không thể tải lịch sử"
                  description={error}
                />
              ) : transactions.length === 0 ? (
                <StateMessage
                  title="Chưa có giao dịch thành công"
                  description="Khi bạn thanh toán mua vé thành công, giao dịch sẽ xuất hiện tại đây."
                />
              ) : (
                <div className="space-y-3">
                  {transactions.map((transaction) => (
                    <TransactionCard
                      key={transaction.id || transaction.orderCode}
                      transaction={transaction}
                      onOpenTicket={() => openTicket(transaction)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

const SummaryCard = ({ label, value, detail, icon, active = false }) => (
  <article className={`rounded-2xl border p-5 ${active ? 'border-secondary-container bg-secondary-container text-on-secondary-container' : 'border-outline-variant/40 bg-surface text-primary'}`}>
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-wide opacity-75">{label}</p>
        <p className="mt-3 text-2xl font-black">{value}</p>
      </div>
      <div className={`rounded-xl p-2 ${active ? 'bg-white/45' : 'bg-white'}`}>
        {icon}
      </div>
    </div>
    <p className="mt-3 text-xs font-bold opacity-70">{detail}</p>
  </article>
);

const TransactionCard = ({ transaction, onOpenTicket }) => {
  const paidAt = getDateParts(transaction.paidAt || transaction.completedAt || transaction.createdAt);
  const transactionCode = transaction.transactionCode || `PAY-${transaction.orderCode}`;

  return (
    <article className="rounded-2xl border border-outline-variant/45 bg-white p-4 shadow-sm transition hover:border-secondary-container hover:shadow-md sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-secondary">
            <ReceiptText className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                Thành công
              </span>
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-black text-primary">
                {getTicketLabel(transaction)}
              </span>
            </div>
            <p className="mt-3 break-all font-mono text-sm font-black text-primary">{transactionCode}</p>
            <p className="mt-2 text-base font-black text-primary">{getRouteLabel(transaction)}</p>
            <p className="mt-1 text-sm font-medium text-on-surface-variant">{getTripLabel(transaction)}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center lg:min-w-[330px]">
          <div className="grid gap-2 rounded-2xl bg-surface px-4 py-3 text-sm text-on-surface-variant">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-secondary" />
              <span>{paidAt.time} - {paidAt.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-secondary" />
              <span>{getPaymentMethodLabel(transaction.paymentMethod)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
            <p className="text-xl font-black text-primary">{formatCurrency(transaction.amount)}</p>
            <button
              type="button"
              onClick={onOpenTicket}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-black text-white hover:bg-primary-container"
            >
              Xem vé
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

const StateMessage = ({ icon = null, title, description }) => (
  <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-outline-variant/70 bg-surface px-6 py-10 text-center">
    {icon ? <div className="text-secondary">{icon}</div> : null}
    <p className="font-black text-primary">{title}</p>
    <p className="max-w-md text-sm text-on-surface-variant">{description}</p>
  </div>
);

export default TransactionHistoryPage;
