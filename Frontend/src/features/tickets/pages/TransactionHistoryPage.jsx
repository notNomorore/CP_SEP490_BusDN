import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CreditCard, History, Ticket } from 'lucide-react';
import Header from '../../../shared/components/navigation/Header.jsx';

const mockTransactions = [
  {
    id: 'BDN-2026-001',
    type: 'Vé một lượt',
    route: 'DN-1',
    amount: 7000,
    method: 'Ví VNPay / Ngân hàng',
    status: 'Thành công',
    date: '2026-06-29 08:30',
  },
  {
    id: 'BDN-2026-002',
    type: 'Vé tháng',
    route: 'DN-2',
    amount: 150000,
    method: 'Ví MoMo',
    status: 'Thành công',
    date: '2026-06-28 17:10',
  },
  {
    id: 'BDN-2026-003',
    type: 'Vé một lượt',
    route: 'DN-5',
    amount: 7000,
    method: 'Thẻ ATM',
    status: 'Thất bại',
    date: '2026-06-27 09:05',
  },
];

const formatCurrency = (value) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(value);

const TransactionHistoryPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface-container-low">
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-32 sm:px-6 lg:px-8">
        <section className="rounded-[28px] bg-white p-6 shadow-xl shadow-primary/5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-on-tertiary-container">Thanh toán</p>
              <h1 className="mt-2 text-3xl font-headline font-black text-primary">Lịch sử giao dịch</h1>
              <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
                Màn hình lịch sử giao dịch tĩnh theo UI đã cung cấp. Chưa kết nối backend giao dịch.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/tickets/purchase')}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-secondary-container px-5 py-3 text-sm font-black text-on-secondary-container hover:bg-secondary-fixed"
            >
              <Ticket className="h-4 w-4" />
              Mua vé mới
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Summary label="Tất cả giao dịch" value={mockTransactions.length} icon={<History className="h-5 w-5" />} />
            <Summary label="Thành công" value={mockTransactions.filter((item) => item.status === 'Thành công').length} icon={<CreditCard className="h-5 w-5" />} active />
            <Summary label="Tổng chi tiêu demo" value={formatCurrency(mockTransactions.filter((item) => item.status === 'Thành công').reduce((sum, item) => sum + item.amount, 0))} icon={<Ticket className="h-5 w-5" />} />
          </div>

          <div className="mt-6 overflow-hidden rounded-[24px] border border-outline-variant/40">
            <div className="hidden grid-cols-[1fr_0.8fr_0.7fr_0.9fr_0.7fr_auto] gap-4 bg-surface px-5 py-3 text-xs font-black uppercase tracking-wide text-outline md:grid">
              <span>Mã giao dịch</span>
              <span>Loại vé</span>
              <span>Tuyến</span>
              <span>Thanh toán</span>
              <span>Trạng thái</span>
              <span />
            </div>
            <div className="divide-y divide-outline-variant/30">
              {mockTransactions.map((transaction) => (
                <article key={transaction.id} className="grid gap-3 bg-white px-5 py-4 text-sm md:grid-cols-[1fr_0.8fr_0.7fr_0.9fr_0.7fr_auto] md:items-center">
                  <div>
                    <p className="font-mono font-black text-primary">{transaction.id}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">{transaction.date}</p>
                  </div>
                  <p className="font-bold text-primary">{transaction.type}</p>
                  <p className="font-bold text-primary">{transaction.route}</p>
                  <div>
                    <p className="font-black text-primary">{formatCurrency(transaction.amount)}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">{transaction.method}</p>
                  </div>
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${transaction.status === 'Thành công' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {transaction.status}
                  </span>
                  <button type="button" onClick={() => navigate('/my-tickets')} className="inline-flex items-center gap-1 font-black text-secondary">
                    Vé <ArrowRight className="h-4 w-4" />
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

const Summary = ({ label, value, icon, active = false }) => (
  <div className={`rounded-[24px] p-5 ${active ? 'bg-secondary-container text-on-secondary-container' : 'border border-outline-variant/35 bg-surface text-primary'}`}>
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-black uppercase tracking-wide opacity-75">{label}</p>
      {icon}
    </div>
    <p className="mt-4 text-2xl font-black">{value}</p>
  </div>
);

export default TransactionHistoryPage;
