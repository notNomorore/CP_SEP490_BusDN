import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Route, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import adminService from '../../services/adminService.js';

const today = () => new Date().toISOString().slice(0, 10);
const id = (value) => String(value?._id || value || '');

export default function TripAllocationPanel({ onSaved, routes }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ routeId: '', workDate: today(), shiftType: 'ALL' });
  const [cycles, setCycles] = useState([]);
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);

  const selectedCount = useMemo(() => cycles.filter((cycle) => cycle.shiftId && cycle.vehicleId).length, [cycles]);
  const tripCount = useMemo(() => cycles.reduce((sum, cycle) => sum + cycle.trips.length, 0), [cycles]);

  async function load(showEmptyToast = true) {
    if (!form.workDate) return toast.error('Hãy chọn ngày cần phân bổ.');
    setBusy(true);
    try {
      const response = await adminService.previewTripAllocation(form);
      setSummary(response.summary);
      setCycles((response.cycles || []).map((cycle) => ({
        ...cycle,
        shiftId: id(cycle.recommendedShiftId),
        vehicleId: id(cycle.recommendedVehicleId),
      })));
      if (showEmptyToast && !response.cycles?.length) toast('Không còn chuyến chưa phân bổ trong bộ lọc đã chọn.');
    } catch (error) {
      toast.error(error?.message || 'Không thể tải dữ liệu phân bổ chuyến.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(false); }, []); // Tải toàn bộ chuyến của ngày hiện tại khi mở màn hình.

  const updateCycle = (operationCycleCode, values) => {
    setCycles((items) => items.map((item) => item.operationCycleCode === operationCycleCode ? { ...item, ...values } : item));
  };

  const confirm = async () => {
    const rows = cycles
      .filter((cycle) => cycle.shiftId && cycle.vehicleId)
      .map((cycle) => ({ tripIds: cycle.tripIds, shiftId: cycle.shiftId, vehicleId: cycle.vehicleId }));
    if (!rows.length) return toast.error('Chưa có chuyến nào đủ tài xế, phụ xe và xe để xác nhận.');
    setBusy(true);
    try {
      const response = await adminService.confirmTripAllocation(rows);
      toast.success(`Đã phân công đầy đủ nguồn lực cho ${response.assignedTrips || 0} chuyến.`);
      await onSaved?.();
      await load(false);
    } catch (error) {
      toast.error(error?.message || 'Không thể xác nhận phân bổ chuyến.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="space-y-5">
    <section className="rounded-3xl bg-[#062819] p-6 text-white">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">Bước 3 · Phân bổ chuyến</p>
      <h2 className="mt-2 text-3xl font-black">Gắn tài xế, phụ xe và xe vào từng chuyến</h2>
      <p className="mt-2 max-w-4xl text-sm text-emerald-50/80">Hiển thị toàn bộ chuyến còn chờ. Nhân sự chỉ được đề xuất khi ca đã tạo đúng tuyến, bao phủ giờ chạy và không trùng lịch; kinh nghiệm tuyến và hiệu suất được dùng để xếp hạng ưu tiên.</p>
    </section>

    <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
        <label><span className="mb-2 block text-xs font-black uppercase text-slate-500">Tuyến</span><select value={form.routeId} onChange={(event) => setForm((current) => ({ ...current, routeId: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold"><option value="">Tất cả tuyến có chuyến chờ</option>{routes.filter((route) => route.status === 'PUBLISHED').map((route) => <option key={route._id} value={route._id}>{route.routeCode} · {route.routeName}</option>)}</select></label>
        <label><span className="mb-2 block text-xs font-black uppercase text-slate-500">Ngày chạy</span><input type="date" value={form.workDate} onChange={(event) => setForm((current) => ({ ...current, workDate: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold" /></label>
        <label><span className="mb-2 block text-xs font-black uppercase text-slate-500">Ca làm</span><select value={form.shiftType} onChange={(event) => setForm((current) => ({ ...current, shiftType: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold"><option value="ALL">Tất cả ca</option><option value="MORNING">Ca sáng · 05:30–10:30</option><option value="MIDDAY">Ca trưa · 10:30–13:30</option><option value="AFTERNOON">Ca chiều · 13:30–18:30</option></select></label>
        <button type="button" disabled={busy} onClick={() => load()} className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 font-black text-emerald-950 disabled:opacity-50">{busy ? <RefreshCw className="animate-spin" size={18} /> : <Route size={18} />} Tải chuyến</button>
      </div>
    </section>

    {summary ? <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Chuyến chưa phân', summary.totalTrips], ['Nhóm chuyến/vòng D–V', summary.totalCycles], ['Tổ nhân sự khả dụng', summary.availableTeams], ['Nhóm chưa có tổ phù hợp', summary.unstaffedCycles]].map(([label, value]) => <div key={label} className="rounded-2xl border border-emerald-100 bg-white p-4"><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value || 0}</p></div>)}</section> : null}

    {cycles.length ? <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-black">Toàn bộ chuyến cần phân bổ</h3><p className="text-sm text-slate-500">Mỗi thẻ phải có đủ tổ tài xế–phụ xe và xe trước khi được xác nhận.</p></div><span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-800">{selectedCount}/{cycles.length} nhóm · {tripCount} chuyến</span></div>
      <div className="mt-5 grid gap-4">
        {cycles.map((cycle) => {
          const team = cycle.candidateTeams.find((item) => id(item.shiftId) === id(cycle.shiftId));
          const ready = Boolean(team && cycle.vehicleId);
          return <article key={cycle.operationCycleCode} className={`rounded-2xl border p-4 ${ready ? 'border-emerald-300 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/30'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h4 className="font-black">{cycle.routeCode || 'Tuyến'} · {cycle.operationCycleCode}</h4><span className={`rounded-full px-2 py-1 text-[11px] font-black ${cycle.isCompleteCycle ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'}`}>{cycle.isCompleteCycle ? 'Đủ vòng D–V' : 'Chuyến lẻ'}</span></div><p className="mt-1 text-sm text-slate-500">{cycle.startTime}–{cycle.endTime} · {cycle.trips.length} chuyến</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${ready ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}>{ready ? 'Đủ điều kiện xuất bến' : 'Còn thiếu nguồn lực'}</span></div>
            <div className="mt-3 rounded-xl bg-white px-3 py-2 text-sm">{cycle.trips.map((trip) => <span key={trip._id} className="block py-1"><b>{trip.direction === 'OUTBOUND' ? 'D' : 'V'} · {trip.scheduleCode}</b> · {trip.departureTime}–{trip.expectedArrivalTime}</span>)}</div>
            <div className="mt-4 grid gap-3 xl:grid-cols-3">
              <label><span className="mb-2 block text-xs font-black uppercase text-slate-500">Tài xế ưu tiên</span><select value={id(cycle.shiftId)} onChange={(event) => updateCycle(cycle.operationCycleCode, { shiftId: event.target.value })} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 font-bold"><option value="">Chọn tài xế đủ điều kiện</option>{cycle.candidateTeams.map((item, index) => <option key={item.shiftId} value={item.shiftId}>#{index + 1} · {item.driver?.fullName} · {item.driverScore}% · {item.routeExperienceCount} chuyến tuyến</option>)}</select>{team ? <p className="mt-2 text-xs font-bold text-emerald-700">#{cycle.candidateTeams.indexOf(team) + 1} · {team.driverScore}% phù hợp · {team.completedTrips} chuyến hoàn thành</p> : null}</label>
              <label><span className="mb-2 block text-xs font-black uppercase text-slate-500">Phụ xe đi cùng ca</span><select value={id(cycle.shiftId)} onChange={(event) => updateCycle(cycle.operationCycleCode, { shiftId: event.target.value })} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 font-bold"><option value="">Chọn phụ xe đủ điều kiện</option>{cycle.candidateTeams.map((item, index) => <option key={item.shiftId} value={item.shiftId}>#{index + 1} · {item.assistant?.fullName} · {item.assistantScore}% · {item.assistantRouteExperienceCount} chuyến tuyến</option>)}</select>{team ? <p className="mt-2 text-xs font-bold text-sky-700">{team.assistantScore}% phù hợp · {team.assistantCompletedTrips} chuyến hoàn thành</p> : null}</label>
              <label><span className="mb-2 block text-xs font-black uppercase text-slate-500">Xe khả dụng</span><select value={id(cycle.vehicleId)} onChange={(event) => updateCycle(cycle.operationCycleCode, { vehicleId: event.target.value })} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 font-bold"><option value="">Chọn xe không trùng lịch</option>{cycle.candidateVehicles.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.busCode} · {vehicle.plateNumber} · {vehicle.status}</option>)}</select></label>
            </div>
            {team ? <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 font-black text-emerald-800"><UsersRound size={14} /> Tổ {team.score}% phù hợp</span><span className="rounded-full bg-slate-100 px-3 py-1 font-bold">Ca {team.startTime}–{team.endTime}</span><span className="rounded-full bg-slate-100 px-3 py-1 font-bold">{team.productivityLabel}</span></div> : <div className="mt-3 flex items-center gap-2 text-sm font-bold text-amber-700"><AlertTriangle size={17} /> Chưa có ca cùng tuyến bao phủ đủ giờ chuyến. <button type="button" onClick={() => navigate('/admin/shifts')} className="underline">Sang Phân ca</button></div>}
          </article>;
        })}
      </div>
      <div className="mt-5 flex justify-end border-t border-slate-200 pt-5"><button type="button" disabled={busy || !selectedCount} onClick={confirm} className="inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-600 px-6 font-black text-white disabled:opacity-40"><CheckCircle2 size={19} /> Xác nhận {selectedCount} nhóm đủ nguồn lực</button></div>
    </section> : summary ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">Không còn chuyến PLANNED cần phân bổ trong bộ lọc này.</section> : null}
  </div>;
}
