import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

const PaymentFailedPage = () => {
  const navigate = useNavigate();
  const order = useLocation().state?.order;

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <section className="w-full max-w-3xl text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-error-container text-error shadow-sm">
          <AlertCircle className="h-12 w-12" />
        </div>
        <h1 className="mt-6 text-3xl font-headline font-black text-primary">Thanh toán thất bại</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-on-surface-variant">
          Giao dịch chưa được hoàn tất. Vui lòng thử lại hoặc chọn phương thức khác.
        </p>

        <div className="mt-8 rounded-[24px] border border-red-100 bg-white p-6 text-left shadow-xl shadow-primary/5">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-red-50 p-3 text-error">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-black uppercase tracking-wide text-on-surface-variant">Lý do từ chối</p>
              <p className="mt-1 text-xl font-black text-primary">Tài khoản không đủ số dư</p>
              <div className="mt-4 flex justify-between border-t border-outline-variant/40 pt-4 text-sm">
                <span className="text-on-surface-variant">Mã giao dịch:</span>
                <strong className="text-primary">{order?.transactionCode || '#BDN-98231-TRX'}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => navigate('/tickets/checkout', { state: { order } })} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-4 font-black text-white hover:opacity-90">
            <RefreshCw className="h-5 w-5" />
            Thử lại thanh toán
          </button>
          <button type="button" onClick={() => navigate('/tickets/purchase')} className="flex items-center justify-center gap-2 rounded-full border border-secondary px-5 py-4 font-black text-secondary hover:bg-secondary-container">
            <ArrowLeft className="h-5 w-5" />
            Quay lại chọn vé
          </button>
        </div>
      </section>
    </main>
  );
};

export default PaymentFailedPage;
