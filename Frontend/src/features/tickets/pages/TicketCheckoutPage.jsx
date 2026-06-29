import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CreditCard,
  LoaderCircle,
  QrCode,
  Ticket,
} from 'lucide-react';
import Header from '../../../shared/components/navigation/Header.jsx';
import toast from '../../../shared/utils/toast.js';
import ticketService from '../services/ticketService.js';

const formatCurrency = (value) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(Number(value) || 0);

const ticketTypeLabel = (type) => ({
  ONE_WAY: 'Vé một lượt',
  MONTHLY_PASS: 'Vé tháng',
}[type] || 'Vé một lượt');

const buildPaymentPayload = (order) => {
  if (order.ticketType === 'MONTHLY_PASS') {
    return {
      ticketType: 'MONTHLY_PASS',
      routeId: order.route?.id || order.route?._id,
      passType: order.passengerType,
      startDate: order.serviceDate,
      validityMonths: 1,
    };
  }

  return {
    ticketType: 'ONE_WAY',
    routeId: order.route?.id || order.route?._id,
    departureLocation: order.departureLocation,
    destinationLocation: order.destinationLocation,
    serviceDate: order.serviceDate,
    departureTime: order.departureTime,
    passengerType: order.passengerType,
  };
};

const TicketCheckoutPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const order = location.state?.order;
  const [payment, setPayment] = useState(location.state?.payment || null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!order) {
      navigate('/tickets/purchase', {
        replace: true,
        state: { checkoutMessage: 'Vui lòng chọn thông tin vé trước khi thanh toán.' },
      });
    }
  }, [navigate, order]);

  const paymentPayload = useMemo(() => (order ? buildPaymentPayload(order) : null), [order]);

  const checkPaymentStatus = useCallback(async (orderCode, { silent = false } = {}) => {
    if (!orderCode) return;

    if (!silent) setIsChecking(true);
    try {
      const status = await ticketService.getPaymentStatus(orderCode);
      if (status.status === 'PAID') {
        toast.success('Thanh toán thành công. Vé đã được kích hoạt.');
        navigate('/my-tickets', { replace: true });
        return;
      }

      if (status.status === 'CANCELLED' || status.status === 'FAILED') {
        setError('Giao dịch chưa hoàn tất hoặc đã bị hủy. Vui lòng tạo lại mã thanh toán.');
      }
    } catch (err) {
      if (!silent) {
        setError(err?.message || 'Không thể kiểm tra trạng thái thanh toán.');
      }
    } finally {
      if (!silent) setIsChecking(false);
    }
  }, [navigate]);

  const createPayment = useCallback(async () => {
    if (!paymentPayload) return;

    setIsCreatingPayment(true);
    setError('');
    try {
      const nextPayment = await ticketService.createPayment(paymentPayload);
      setPayment(nextPayment);

      if (nextPayment.status === 'PAID') {
        toast.success(nextPayment.message || 'Thanh toán thành công. Vé đã được kích hoạt.');
        navigate('/my-tickets', { replace: true });
      }
    } catch (err) {
      setError(err?.message || 'Không thể tạo mã QR thanh toán.');
    } finally {
      setIsCreatingPayment(false);
    }
  }, [navigate, paymentPayload]);

  useEffect(() => {
    if (payment || !paymentPayload) return;
    createPayment();
  }, [createPayment, payment, paymentPayload]);

  useEffect(() => {
    if (!payment?.orderCode || payment.status === 'PAID') return undefined;

    const intervalId = window.setInterval(() => {
      checkPaymentStatus(payment.orderCode, { silent: true });
    }, 3500);

    return () => window.clearInterval(intervalId);
  }, [checkPaymentStatus, payment?.orderCode, payment?.status]);

  if (!order) return null;

  return (
    <div className="min-h-screen bg-surface-container-low">
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-32 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-headline font-black text-primary">Thanh toán vé</h1>
          <div className="mt-5 grid max-w-2xl grid-cols-3 gap-3">
            {[
              { label: 'Chọn vé', done: true },
              { label: 'Quét QR', active: true },
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

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
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

          <aside className="rounded-[24px] bg-white p-6 shadow-xl shadow-primary/5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-primary">Quét mã QR để thanh toán</h2>
                <p className="mt-1 text-sm text-on-surface-variant">Mở app ngân hàng hoặc ví điện tử, quét mã rồi hoàn tất thanh toán.</p>
              </div>
              <QrCode className="h-7 w-7 text-secondary" />
            </div>

            <div className="rounded-2xl border border-outline-variant/40 bg-surface p-5 text-center">
              {isCreatingPayment ? (
                <div className="flex min-h-80 flex-col items-center justify-center gap-3">
                  <LoaderCircle className="h-10 w-10 animate-spin text-secondary" />
                  <p className="text-sm font-bold text-primary">Đang tạo mã QR PayOS...</p>
                </div>
              ) : payment?.qrCodeImage ? (
                <>
                  <img src={payment.qrCodeImage} alt="Mã QR thanh toán PayOS" className="mx-auto h-72 w-72 rounded-xl bg-white p-3 shadow-sm" />
                  <p className="mt-4 text-sm font-bold text-primary">Mã thanh toán: {payment.orderCode}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">Số tiền: <strong>{formatCurrency(payment.amount)}</strong></p>
                </>
              ) : (
                <div className="flex min-h-80 flex-col items-center justify-center gap-3">
                  <QrCode className="h-16 w-16 text-outline" />
                  <p className="text-sm font-bold text-on-surface-variant">Chưa có mã QR thanh toán.</p>
                </div>
              )}
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              <button type="button" onClick={() => checkPaymentStatus(payment?.orderCode)} disabled={!payment?.orderCode || isChecking} className="flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-5 py-4 font-black text-white hover:bg-secondary-fixed-dim disabled:cursor-not-allowed disabled:opacity-60">
                {isChecking ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                Tôi đã thanh toán
              </button>
              <button type="button" onClick={createPayment} disabled={isCreatingPayment} className="w-full rounded-full border border-outline-variant px-5 py-3 font-black text-primary hover:bg-surface-container-low disabled:opacity-60">
                Tạo lại mã QR
              </button>
              <button type="button" onClick={() => navigate('/tickets/purchase', { state: { order } })} className="flex w-full items-center justify-center gap-2 rounded-full border border-outline-variant px-5 py-3 font-black text-primary hover:bg-surface-container-low">
                <ArrowLeft className="h-4 w-4" /> Quay lại chọn vé
              </button>
            </div>
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
