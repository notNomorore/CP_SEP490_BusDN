import React, { useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, Route, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import adminService from '../../services/adminService.js';

const today = () => new Date().toISOString().slice(0, 10);
const id = (value) => String(value?._id || value || '');

export default function TripAllocationPanel({ onSaved, routes }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ routeId: '', workDate: today(), shiftType: 'MORNING' });
  const [cycles, setCycles] = useState([]);
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  const selectedCount = useMemo(() => cycles.filter((cycle) => cycle.shiftId && cycle.vehicleId).length, [cycles]);

  const load = async () => {
    if (!form.routeId || !form.workDate) return toast.error('Hãy chọn tuyến và ngày cần phân bổ.');
    setBusy(true);
    try {
      const response = await adminService.previewTripAllocation(form);
      setSummary(response.summary);
      setCycles((response.cycles || []).map((cycle) => ({ ...cycle, shiftId: id(cycle.recommendedShiftId), vehicleId: id(cycle.recommendedVehicleId) })));
      if (!response.cycles?.length) toast('Không còn cặp D–V chưa phân công trong ca đã chọn.');
    } catch (error) { toast.error(error?.message || 'Không thể tải dữ liệu phân bổ chuyến.'); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    const rows = cycles.filter((cycle) => cycle.shiftId && cycle.vehicleId).map((cycle) => ({ tripIds: cycle.tripIds, shiftId: cycle.shiftId, vehicleId: cycle.vehicleId }));
    if (!rows.length) return toast.error('Chưa chọn tổ vận hành cho vòng D–V nào.');
    setBusy(true);
    try {
      const response = await adminService.confirmTripAllocation(rows);
      toast.success(`Đã phân công ${response.assignedTrips || 0} lượt chạy.`);
      await onSaved?.();
      await load();
    } catch (error) { toast.error(error?.message || 'Không thể xác nhận phân bổ chuyến.'); }
    finally { setBusy(false); }
  };

  return <div className="space-y-5">
    <section className="rounded-3xl bg-[#062819] p-6 text-white">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">Bước 3 · Phân bổ chuyến</p>
      <h2 className="mt-2 text-3xl font-black">Gán ca đã tạo vào các vòng D–V</h2>
      <p className="mt-2 max-w-4xl text-sm text-emerald-50/80">Chỉ các tổ đã được phân ca, đủ tài xế, phụ xe, xe và bao phủ toàn bộ giờ chạy mới xuất hiện. Kinh nghiệm tuyến được dùng để xếp hạng ưu tiên.</p>
    </section>

    <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
        <label><span className="mb-2 block text-xs font-black uppercase text-slate-500">Tuyến</span><select value={form.routeId} onChange={(event) => setForm((current) => ({ ...current, routeId: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold"><option value="">Chọn tuyến đã có chuyến</option>{routes.filter((route) => route.status === 'PUBLISHED').map((route) => <option key={route._id} value={route._id}>{route.routeCode} · {route.routeName}</option>)}</select></label>
        <label><span className="mb-2 block text-xs font-black uppercase text-slate-500">Ngày chạy</span><input type="date" value={form.workDate} onChange={(event) => setForm((current) => ({ ...current, workDate: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold" /></label>
        <label><span className="mb-2 block text-xs font-black uppercase text-slate-500">Ca làm</span><select value={form.shiftType} onChange={(event) => setForm((current) => ({ ...current, shiftType: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold"><option value="MORNING">Ca sáng</option><option value="AFTERNOON">Ca chiều</option></select></label>
        <button type="button" disabled={busy} onClick={load} className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 font-black text-emerald-950 disabled:opacity-50">{busy ? <RefreshCw className="animate-spin" size={18} /> : <Route size={18} />} Tải chuyến</button>
      </div>
    </section>

    {summary ? <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Số lượt chưa phân', summary.totalTrips], ['Số vòng D–V', summary.totalCycles], ['Tổ đủ điều kiện', summary.availableTeams], ['Vòng chưa có tổ phù hợp', summary.unstaffedCycles]].map(([label, value]) => <div key={label} className="rounded-2xl border border-emerald-100 bg-white p-4"><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value || 0}</p></div>)}</section> : null}

    {cycles.length ? <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5"><div><h3 className="text-xl font-black">Các vòng đang chờ phân bổ</h3><p className="text-sm text-slate-500">Đề xuất được xếp theo kinh nghiệm trên tuyến và khả năng bao phủ giờ chạy.</p></div><span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-800">{selectedCount}/{cycles.length} vòng đã chọn tổ</span></div>
      <div className="overflow-x-auto"><table className="min-w-[1250px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs font-black uppercase text-slate-500"><tr>{['Vòng D–V', 'Thời gian', 'Hai lượt chạy', 'Ca nhân sự được đề xuất', 'Xe thực hiện', 'Kinh nghiệm & ưu tiên'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{cycles.map((cycle) => { const team = cycle.candidateTeams.find((item) => id(item.shiftId) === id(cycle.shiftId)); return <tr key={cycle.operationCycleCode} className="border-t border-slate-100 align-top"><td className="px-4 py-4 font-black">{cycle.operationCycleCode}</td><td className="px-4 py-4 font-bold">{cycle.startTime}–{cycle.endTime}</td><td className="px-4 py-4">{cycle.trips.map((trip) => <span key={trip._id} className="block">{trip.direction === 'OUTBOUND' ? 'D' : 'V'} · {trip.scheduleCode} · {trip.departureTime}</span>)}</td><td className="px-4 py-3"><select value={id(cycle.shiftId)} onChange={(event) => setCycles((items) => items.map((item) => item.operationCycleCode === cycle.operationCycleCode ? { ...item, shiftId: event.target.value } : item))} className="h-12 min-w-80 rounded-xl border border-slate-200 px-3 font-bold"><option value="">Chưa chọn ca nhân sự</option>{cycle.candidateTeams.map((item) => <option key={item.shiftId} value={item.shiftId}>{item.shiftCode} · {item.driver?.fullName} · {item.assistant?.fullName}</option>)}</select>{!cycle.candidateTeams.length ? <button type="button" onClick={() => navigate('/admin/shifts')} className="mt-2 block text-xs font-black text-amber-700">Chưa có ca phù hợp · Sang Phân ca</button> : null}</td><td className="px-4 py-3"><select value={id(cycle.vehicleId)} onChange={(event) => setCycles((items) => items.map((item) => item.operationCycleCode === cycle.operationCycleCode ? { ...item, vehicleId: event.target.value } : item))} className="h-12 min-w-52 rounded-xl border border-slate-200 px-3 font-bold"><option value="">Chọn xe</option>{cycle.candidateVehicles.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.busCode} · {vehicle.plateNumber}</option>)}</select></td><td className="px-4 py-4">{team ? <><span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800"><UsersRound size={14} /> {team.score}% phù hợp</span><p className="mt-2 font-bold">{team.driver?.fullName} đã đi tuyến này {team.routeExperienceCount} lần</p><p className="mt-1 text-xs text-slate-500">{team.completedTrips} chuyến hoàn thành · {team.consecutiveWorkingDays} ngày làm liên tiếp</p><p className="mt-1 text-xs font-black text-emerald-700">Đánh giá: {team.productivityLabel}</p><p className="mt-1 text-xs text-slate-500">Ca {team.startTime}–{team.endTime} · {Math.round(team.assignedMinutes / 60)} giờ</p></> : <span className="font-bold text-amber-700">Cần tạo hoặc bổ sung ca trước</span>}</td></tr>; })}</tbody></table></div>
      <div className="flex justify-end border-t border-slate-200 p-5"><button type="button" disabled={busy || !selectedCount} onClick={confirm} className="inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-600 px-6 font-black text-white disabled:opacity-40"><CheckCircle2 size={19} /> Xác nhận phân bổ {selectedCount} vòng</button></div>
    </section> : null}
  </div>;
}
