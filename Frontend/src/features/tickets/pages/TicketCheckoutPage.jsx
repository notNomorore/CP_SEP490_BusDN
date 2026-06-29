import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, Check, CreditCard, Ticket } from 'lucide-react';
import Header from '../../../shared/components/navigation/Header.jsx';

const formatCurrency = (value) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(Number(value) || 0);

const ticketTypeLabel = (type) => ({
  ONE_WAY: 'Vé một lượt',
  MONTHLY_PASS: 'Vé tháng',
}[type] || 'Vé một lượt');

const paymentMethods = [
  { id: 'ONLINE_BANKING', label: 'Ví VNPay / Ngân hàng', icon: 'VN' },
  { id: 'E_WALLET', label: 'Ví MoMo', icon: 'MO' },
  { id: 'CREDIT_CARD', label: 'Thẻ ATM / VISA / Mastercard', icon: 'CC' },
  { id: 'DEMO', label: 'Thanh toán thử nghiệm (Demo)', icon: 'DM' },
];

const TicketCheckoutPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const order = location.state?.order;
  const [paymentMethod, setPaymentMethod] = useState(order?.paymentMethod || 'ONLINE_BANKING');

  useEffect(() => {
    if (!order) {
      navigate('/tickets/purchase', {
        replace: true,
        state: { checkoutMessage: 'Vui lòng chọn thông tin vé trước khi thanh toán.' },
      });
    }
  }, [navigate, order]);

  if (!order) return null;

  const resultState = {
    order: {
      ...order,
      paymentMethod,
      transactionCode: `BDN-${Date.now().toString().slice(-6)}-TRX`,
      ticketCode: `BUSDN-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
    },
  };

  return (
    <div className="min-h-screen bg-surface-container-low">
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-32 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-headline font-black text-primary">Xác nhận thanh toán</h1>
          <div className="mt-5 grid max-w-2xl grid-cols-3 gap-3">
            {[
              { label: 'Chọn vé', done: true },
              { label: 'Thanh toán', active: true },
              { label: 'Nhận vé' },
            ].map((step, index) => (
              <div key={step.label} className="flex items-center gap-2">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-black ${step.done ? 'bg-secondary text-white' : step.active ? 'bg-primary-container text-white' : 'bg-surface-container-high text-on-surface-variant'}`}>
                  {step.done ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span className={`text-sm font-black ${step.active ? 'text-primary' : 'text-on-surface-variant'}`}>{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <section className="rounded-[24px] bg-white p-6 shadow-xl shadow-primary/5">
            <div className="mb-6 flex items-center gap-3 border-b border-outline-variant/40 pb-4">
              <Ticket className="h-5 w-5 text-secondary" />
              <h2 className="text-xl font-black text-primary">Thông tin vé</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Info label="Loại vé" value={ticketTypeLabel(order.ticketType)} />
              <Info label="Tuyến đường" value={order.routeNumber} />
              <div className="sm:col-span-2">
                <div className="flex gap-4 rounded-2xl bg-surface p-4">
                  <div className="flex flex-col items-center py-1">
                    <span className="h-3 w-3 rounded-full border-2 border-secondary bg-white" />
                    <span className="my-1 h-full min-h-12 w-px bg-secondary-fixed" />
                    <span className="h-3 w-3 rounded-full bg-secondary" />
                  </div>
                  <div className="space-y-5">
                    <Info label="Điểm đi" value={order.departureLocation} />
                    <Info label="Điểm đến" value={order.destinationLocation} />
                  </div>
                </div>
              </div>
              <Info label={order.ticketType === 'MONTHLY_PASS' ? 'Ngày bắt đầu' : 'Ngày khởi hành'} value={order.serviceDate} icon={<CalendarDays className="h-4 w-4" />} />
              <Info label={order.ticketType === 'MONTHLY_PASS' ? 'Ngày hết hạn' : 'Giờ xuất bến'} value={order.ticketType === 'MONTHLY_PASS' ? order.expiryDate : order.departureTime} />
              <Info label="Đối tượng" value={order.passengerTypeLabel} />
              <Info label="Giá vé" value={formatCurrency(order.price)} icon={<CreditCard className="h-4 w-4" />} />
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[24px] bg-white p-6 shadow-xl shadow-primary/5">
              <h2 className="mb-5 text-xl font-black text-primary">Phương thức thanh toán</h2>
              <div className="space-y-3">
                {paymentMethods.map((method) => (
                  <label key={method.id} className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition ${paymentMethod === method.id ? 'border-secondary bg-surface-container' : 'border-outline-variant hover:bg-surface-container-low'}`}>
                    <span className="flex items-center gap-3">
                      <span className="flex h-9 w-12 items-center justify-center rounded border border-outline-variant bg-white text-xs font-black text-primary">{method.icon}</span>
                      <span className="font-bold text-primary">{method.label}</span>
                    </span>
                    <input type="radio" name="payment" checked={paymentMethod === method.id} onChange={() => setPaymentMethod(method.id)} className="h-5 w-5 text-secondary" />
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] bg-white p-6 shadow-xl shadow-primary/5">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-on-surface-variant"><span>Giá vé cơ bản</span><strong>{formatCurrency(order.price)}</strong></div>
                <div className="flex justify-between text-on-surface-variant"><span>Giảm giá</span><strong className="text-secondary">0 ₫</strong></div>
                <div className="flex items-center justify-between border-t border-outline-variant/40 pt-4 text-primary">
                  <span className="text-lg font-black">Tổng thanh toán</span>
                  <span className="rounded-lg bg-primary-container px-4 py-2 text-lg font-black text-secondary-container">{formatCurrency(order.price)}</span>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <button type="button" onClick={() => navigate('/payment/success', { state: resultState })} className="flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-5 py-4 font-black text-white hover:bg-secondary-fixed-dim">
                  Xác nhận thanh toán <ArrowRight className="h-5 w-5" />
                </button>
                {paymentMethod === 'DEMO' ? (
                  <button type="button" onClick={() => navigate('/payment/failed', { state: resultState })} className="w-full rounded-full border border-red-300 px-5 py-3 font-black text-red-700 hover:bg-red-50">
                    Demo thanh toán thất bại
                  </button>
                ) : null}
                <button type="button" onClick={() => navigate('/tickets/purchase', { state: { order } })} className="flex w-full items-center justify-center gap-2 rounded-full border border-secondary px-5 py-3 font-black text-secondary hover:bg-surface-container-low">
                  <ArrowLeft className="h-4 w-4" /> Quay lại chọn vé
                </button>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
};

const Info = ({ label, value, icon = null }) => (
  <div>
    <p className="text-xs font-black uppercase tracking-wide text-on-surface-variant">{label}</p>
    <p className="mt-1 flex items-center gap-2 font-bold text-primary">{icon}{value || 'Không có dữ liệu'}</p>
  </div>
);

export default TicketCheckoutPage;
