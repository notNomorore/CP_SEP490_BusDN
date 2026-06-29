import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, BusFront, Clock3, CreditCard, LoaderCircle, Map, Ticket } from 'lucide-react';
import Header from '../../../shared/components/navigation/Header.jsx';
import routeService from '../../routes/services/routeService.js';

const getVietnamDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const formatCurrency = (value) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(Math.max(Math.round((Number(value) || 0) / 1000) * 1000, 0));

const passengerTypeLabel = (type) => ({
  STANDARD: 'Phổ thông',
  STUDENT: 'Học sinh / Sinh viên',
  PRIORITY: 'Đối tượng ưu tiên',
}[type] || 'Phổ thông');

const buildMonthBounds = (year, month) => {
  const start = new Date(Number(year), Number(month) - 1, 1);
  const end = new Date(Number(year), Number(month), 0);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
};

const TicketPurchasePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(location.state?.route || null);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true);
  const [mode, setMode] = useState('ONE_WAY');
  const [error, setError] = useState('');
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState({
    departureLocation: '',
    destinationLocation: '',
    serviceDate: getVietnamDate(),
    departureTime: '05:30',
    passengerType: 'STANDARD',
    paymentMethod: 'E_WALLET',
    month: currentMonth,
    year: currentYear,
  });

  useEffect(() => {
    let isMounted = true;

    const loadRoutes = async () => {
      setIsLoadingRoutes(true);
      setError('');
      try {
        const payload = await routeService.searchRoutes();
        if (!isMounted) return;

        const nextRoutes = payload.routes || [];
        setRoutes(nextRoutes);
        setSelectedRoute((current) => {
          if (current) return nextRoutes.find((route) => String(route.id) === String(current.id)) || current;
          const routeNumber = new URLSearchParams(location.search).get('route');
          return nextRoutes.find((route) => route.routeNumber === routeNumber) || nextRoutes[0] || null;
        });
      } catch (err) {
        if (isMounted) setError(err.message || 'Không thể tải danh sách tuyến xe.');
      } finally {
        if (isMounted) setIsLoadingRoutes(false);
      }
    };

    loadRoutes();
    return () => {
      isMounted = false;
    };
  }, [location.search]);

  useEffect(() => {
    if (!selectedRoute) return;
    const stops = selectedRoute.stops || [];
    setForm((current) => ({
      ...current,
      departureLocation: stops[0]?.name || selectedRoute.origin || '',
      destinationLocation: stops[stops.length - 1]?.name || selectedRoute.destination || '',
      departureTime: selectedRoute.operatingHours?.firstDeparture || current.departureTime || '05:30',
    }));
  }, [selectedRoute]);

  const monthlyBounds = useMemo(() => buildMonthBounds(form.year, form.month), [form.year, form.month]);
  const monthlyPrice = {
    STANDARD: 150000,
    STUDENT: 90000,
    PRIORITY: 0,
  }[form.passengerType] || 150000;
  const estimatedPrice = mode === 'MONTHLY_PASS' ? monthlyPrice : selectedRoute?.fare || 7000;

  const updateForm = (updates) => setForm((current) => ({ ...current, ...updates }));

  const handleSubmit = (event) => {
    event.preventDefault();
    if (mode === 'ONE_WAY' && !selectedRoute) {
      setError('Vui lòng chọn tuyến xe trước khi tiếp tục.');
      return;
    }
    if (mode === 'ONE_WAY' && form.departureLocation === form.destinationLocation) {
      setError('Điểm đi và điểm đến phải khác nhau.');
      return;
    }

    const order = {
      ticketType: mode,
      route: selectedRoute,
      routeNumber: selectedRoute?.routeNumber || 'BusDN',
      routeName: selectedRoute?.name || 'Vé tháng BusDN',
      departureLocation: mode === 'ONE_WAY' ? form.departureLocation : 'Toàn mạng BusDN',
      destinationLocation: mode === 'ONE_WAY' ? form.destinationLocation : 'Không giới hạn lượt',
      serviceDate: mode === 'ONE_WAY' ? form.serviceDate : monthlyBounds.startDate,
      expiryDate: mode === 'MONTHLY_PASS' ? monthlyBounds.endDate : form.serviceDate,
      departureTime: mode === 'ONE_WAY' ? form.departureTime : '',
      passengerType: form.passengerType,
      passengerTypeLabel: passengerTypeLabel(form.passengerType),
      paymentMethod: form.paymentMethod,
      price: estimatedPrice,
    };

    navigate('/tickets/checkout', { state: { order } });
  };

  return (
    <div className="min-h-screen bg-surface-container-low">
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-32 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-headline font-black text-primary">Mua vé xe buýt</h1>
          <p className="mt-2 text-sm text-on-surface-variant">Chọn thông tin vé và tiếp tục sang màn hình xác nhận thanh toán.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
          <section className="rounded-[24px] bg-white p-6 shadow-xl shadow-primary/5">
            <div className="mb-6 grid grid-cols-2 rounded-xl bg-surface-container-low p-1">
              {[
                { id: 'ONE_WAY', label: 'Vé một lượt' },
                { id: 'MONTHLY_PASS', label: 'Vé tháng' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setMode(tab.id);
                    setError('');
                  }}
                  className={`rounded-lg px-4 py-3 text-sm font-black transition ${mode === tab.id ? 'bg-primary-container text-white' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold sm:col-span-2">
                Tuyến xe
                <select
                  value={selectedRoute?.id || ''}
                  onChange={(event) => setSelectedRoute(routes.find((route) => String(route.id) === event.target.value) || null)}
                  disabled={isLoadingRoutes}
                  className="mt-2 w-full rounded-xl border border-outline-variant/50 px-4 py-3"
                >
                  <option value="">{isLoadingRoutes ? 'Đang tải tuyến xe...' : 'Chọn tuyến xe'}</option>
                  {routes.map((route) => (
                    <option key={route.id} value={route.id}>{route.routeNumber} - {route.name}</option>
                  ))}
                </select>
              </label>

              {mode === 'ONE_WAY' ? (
                <>
                  <label className="text-sm font-bold">
                    Điểm đi
                    <select value={form.departureLocation} onChange={(event) => updateForm({ departureLocation: event.target.value })} disabled={!selectedRoute} className="mt-2 w-full rounded-xl border border-outline-variant/50 px-4 py-3">
                      {(selectedRoute?.stops || []).map((stop) => <option key={`from-${stop.order}-${stop.name}`} value={stop.name}>{stop.name}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-bold">
                    Điểm đến
                    <select value={form.destinationLocation} onChange={(event) => updateForm({ destinationLocation: event.target.value })} disabled={!selectedRoute} className="mt-2 w-full rounded-xl border border-outline-variant/50 px-4 py-3">
                      {(selectedRoute?.stops || []).map((stop) => <option key={`to-${stop.order}-${stop.name}`} value={stop.name}>{stop.name}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-bold">
                    Ngày khởi hành
                    <input type="date" min={getVietnamDate()} value={form.serviceDate} onChange={(event) => updateForm({ serviceDate: event.target.value })} className="mt-2 w-full rounded-xl border border-outline-variant/50 px-4 py-3" />
                  </label>
                  <label className="text-sm font-bold">
                    Giờ khởi hành
                    <input type="time" value={form.departureTime} onChange={(event) => updateForm({ departureTime: event.target.value })} className="mt-2 w-full rounded-xl border border-outline-variant/50 px-4 py-3" />
                  </label>
                </>
              ) : (
                <>
                  <label className="text-sm font-bold">
                    Tháng áp dụng
                    <select value={form.month} onChange={(event) => updateForm({ month: event.target.value })} className="mt-2 w-full rounded-xl border border-outline-variant/50 px-4 py-3">
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>Tháng {month}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-bold">
                    Năm áp dụng
                    <select value={form.year} onChange={(event) => updateForm({ year: event.target.value })} className="mt-2 w-full rounded-xl border border-outline-variant/50 px-4 py-3">
                      {[currentYear, currentYear + 1].map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </label>
                  <div className="rounded-xl bg-surface-container-low px-4 py-3 text-sm font-bold">
                    Hiệu lực từ {monthlyBounds.startDate} đến {monthlyBounds.endDate}
                  </div>
                  <div className="rounded-xl bg-surface-container-low px-4 py-3 text-sm font-bold">
                    Số lượt đi: Không giới hạn trong tháng
                  </div>
                </>
              )}

              <label className="text-sm font-bold">
                Loại hình khách
                <select value={form.passengerType} onChange={(event) => updateForm({ passengerType: event.target.value })} className="mt-2 w-full rounded-xl border border-outline-variant/50 px-4 py-3">
                  <option value="STANDARD">Phổ thông</option>
                  <option value="STUDENT">Học sinh / Sinh viên</option>
                  <option value="PRIORITY">Đối tượng ưu tiên</option>
                </select>
              </label>
              <label className="text-sm font-bold">
                Phương thức thanh toán
                <select value={form.paymentMethod} onChange={(event) => updateForm({ paymentMethod: event.target.value })} className="mt-2 w-full rounded-xl border border-outline-variant/50 px-4 py-3">
                  <option value="E_WALLET">Ví điện tử</option>
                  <option value="ONLINE_BANKING">Ngân hàng trực tuyến</option>
                  <option value="CREDIT_CARD">Thẻ ATM / VISA / Mastercard</option>
                </select>
              </label>

              {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 sm:col-span-2">{error}</div> : null}

              <div className="flex flex-col gap-3 pt-2 sm:col-span-2 sm:flex-row">
                <button type="submit" disabled={isLoadingRoutes || !selectedRoute} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary-container px-5 py-4 font-black text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                  {isLoadingRoutes ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Ticket className="h-5 w-5" />}
                  Tiếp tục thanh toán
                </button>
                <button type="button" onClick={() => navigate('/search')} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-secondary px-5 py-4 font-black text-secondary hover:bg-surface-container">
                  <Map className="h-5 w-5" />
                  Tìm tuyến trên bản đồ
                </button>
              </div>
            </form>
          </section>

          <aside className="space-y-5">
            <section className="overflow-hidden rounded-[24px] bg-white shadow-xl shadow-primary/5">
              <div className="bg-primary-container p-6 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="rounded-full bg-secondary-container px-3 py-1 text-xs font-black text-on-secondary-container">{selectedRoute?.routeNumber || 'BusDN'}</span>
                    <h2 className="mt-4 text-xl font-black">{selectedRoute?.name || 'Chọn tuyến xe'}</h2>
                    <p className="mt-2 text-sm text-white/70">{mode === 'ONE_WAY' ? 'Tuyến chất lượng cao' : 'Vé tháng theo tuyến đã đăng ký'}</p>
                  </div>
                  <BusFront className="h-7 w-7 text-tertiary-fixed" />
                </div>
              </div>
              <div className="space-y-5 p-6">
                <div className="rounded-2xl bg-surface px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-wide text-outline">Hành trình</p>
                  <p className="mt-2 font-bold text-primary">{mode === 'ONE_WAY' ? `${form.departureLocation || '-'} → ${form.destinationLocation || '-'}` : `${monthlyBounds.startDate} → ${monthlyBounds.endDate}`}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-surface px-4 py-3">
                    <Clock3 className="h-5 w-5 text-secondary" />
                    <p className="mt-2 text-xs text-on-surface-variant">{mode === 'ONE_WAY' ? 'Giờ đi' : 'Lượt đi'}</p>
                    <p className="font-black text-primary">{mode === 'ONE_WAY' ? form.departureTime : 'Không giới hạn'}</p>
                  </div>
                  <div className="rounded-2xl bg-surface px-4 py-3">
                    <CreditCard className="h-5 w-5 text-secondary" />
                    <p className="mt-2 text-xs text-on-surface-variant">Giá dự kiến</p>
                    <p className="font-black text-primary">{formatCurrency(estimatedPrice)}</p>
                  </div>
                </div>
                <div className="rounded-2xl bg-primary-fixed p-4 text-sm text-on-primary-fixed">
                  Hành khách thuộc đối tượng ưu tiên vui lòng mang giấy tờ xác minh khi lên xe.
                </div>
              </div>
            </section>
            <button type="button" onClick={() => navigate('/my-tickets')} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-outline-variant bg-white px-5 py-3 text-sm font-black text-primary hover:bg-surface">
              Vé của tôi <ArrowRight className="h-4 w-4" />
            </button>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default TicketPurchasePage;
