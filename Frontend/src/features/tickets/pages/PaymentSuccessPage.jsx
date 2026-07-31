import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, QrCode, Ticket } from 'lucide-react';

const formatCurrency = (value) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(Number(value) || 0);

const fallbackOrder = {
  ticketCode: 'BUSDN-2026-000124',
  routeNumber: 'DN-1',
  serviceDate: '2026-11-01',
  departureTime: '05:30',
  price: 7000,
  paymentMethod: 'ONLINE_BANKING',
};

const PaymentSuccessPage = () => {
  const navigate = useNavigate();
  const order = locationSafe(useLocation().state?.order);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <section className="w-full max-w-md text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-secondary text-white shadow-lg">
          <CheckCircle className="h-11 w-11" />
        </div>
        <h1 className="mt-6 text-3xl font-headline font-black text-primary">Thanh toán thành công</h1>
        <p className="mt-2 text-sm text-on-surface-variant">Vé của bạn đã được tạo trong luồng demo và sẵn sàng hiển thị.</p>

        <div className="mt-8 overflow-hidden rounded-[24px] border border-surface-container bg-white text-left shadow-xl shadow-primary/5">
          <div className="relative flex items-start justify-between border-b border-dashed border-outline-variant p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-on-surface-variant">Mã vé</p>
              <p className="mt-2 font-mono text-lg font-black text-primary">{order.ticketCode}</p>
            </div>
            <span className="rounded-lg bg-secondary-container px-3 py-1 text-sm font-black text-on-secondary-container">{order.routeNumber}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 p-6 text-sm">
            <Info label="Ngày hiệu lực" value={`${order.serviceDate}${order.departureTime ? ` ${order.departureTime}` : ''}`} />
            <Info label="Thanh toán" value={formatCurrency(order.price)} />
            <Info label="Phương thức" value={order.paymentMethod} />
            <Info label="Trạng thái" value="Đã thanh toán" />
          </div>
          <div className="bg-surface-container-low p-6 text-center">
            <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-xl bg-white shadow-sm">
              <QrCode className="h-24 w-24 text-primary" />
            </div>
            <p className="mt-3 text-xs font-bold text-on-surface-variant">Quét mã này khi lên xe</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          <button type="button" onClick={() => navigate('/my-tickets')} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-container px-5 py-4 font-black text-white hover:opacity-90">
            <Ticket className="h-5 w-5" />
            Xem vé của tôi
          </button>
          <button type="button" onClick={() => navigate('/tickets/purchase')} className="rounded-full border border-secondary px-5 py-3 font-black text-secondary hover:bg-secondary-container">
            Mua vé mới
          </button>
        </div>
      </section>
    </main>
  );
};

const locationSafe = (order) => order || fallbackOrder;

const Info = ({ label, value }) => (
  <div>
    <p className="text-xs font-black uppercase tracking-wide text-on-surface-variant">{label}</p>
    <p className="mt-1 font-bold text-primary">{value}</p>
  </div>
);

export default PaymentSuccessPage;
