import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ListChecks, RefreshCw, Route, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import adminService from '../../services/adminService.js';

const today = () => new Date().toISOString().slice(0, 10);
const id = (value) => String(value?._id || value || '');
const clockMinutes = (value) => { const [hour, minute] = String(value || '').split(':').map(Number); return (hour * 60) + minute; };
const cyclesOverlap = (left, right) => clockMinutes(left.startTime) < clockMinutes(right.endTime) && clockMinutes(right.startTime) < clockMinutes(left.endTime);

export default function TripAllocationPanel({ onSaved, routes }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ routeId: '', workDate: today(), shiftType: 'MORNING' });
  const [allocationMode, setAllocationMode] = useState('AUTO');
  const [cycles, setCycles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [tripFilter, setTripFilter] = useState('ALL');
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  const selectedCount = useMemo(() => cycles.filter((cycle) => cycle.driverAssignmentId && cycle.assistantAssignmentId && cycle.vehicleId).length, [cycles]);
  const draftProgress = useMemo(() => ({
    drivers: cycles.filter((cycle) => cycle.driverAssignmentId).length,
    assistants: cycles.filter((cycle) => cycle.assistantAssignmentId).length,
    vehicles: cycles.filter((cycle) => cycle.vehicleId).length,
  }), [cycles]);
  const visibleTrips = useMemo(() => tripFilter === 'UNASSIGNED' ? trips.filter((trip) => !trip.assigned) : trips, [tripFilter, trips]);

  const applyMode = (mode) => {
    setAllocationMode(mode);
    setCycles((items) => items.map((cycle) => ({
      ...cycle,
      driverAssignmentId: mode === 'AUTO' ? id(cycle.recommendedDriverAssignmentId) : '',
      assistantAssignmentId: mode === 'AUTO' ? id(cycle.recommendedAssistantAssignmentId) : '',
      vehicleId: mode === 'AUTO' ? id(cycle.recommendedVehicleId) : '',
    })));
  };

  const updateCycle = (operationCycleCode, patch) => setCycles((items) => items.map((item) => item.operationCycleCode === operationCycleCode ? { ...item, ...patch } : item));
  const selectVehicle = (cycle, vehicleId) => {
    if (vehicleId && cycles.some((other) => other.operationCycleCode !== cycle.operationCycleCode && id(other.vehicleId) === id(vehicleId) && cyclesOverlap(cycle, other))) {
      return toast.error('Xe này đã được chọn cho một vòng D–V trùng thời gian. Hãy chọn xe khác.');
    }
    updateCycle(cycle.operationCycleCode, { vehicleId });
  };
  const selectStaff = (cycle, field, assignmentId, candidateField, roleLabel) => {
    const candidate = cycle[candidateField].find((item) => id(item.assignmentId) === id(assignmentId));
    if (candidate && cycles.some((other) => {
      if (other.operationCycleCode === cycle.operationCycleCode || !cyclesOverlap(cycle, other)) return false;
      const otherCandidate = other[candidateField].find((item) => id(item.assignmentId) === id(other[field]));
      return otherCandidate && id(otherCandidate.person) === id(candidate.person);
    })) return toast.error(`${roleLabel} này đã được chọn cho một vòng D–V trùng thời gian.`);
    updateCycle(cycle.operationCycleCode, { [field]: assignmentId });
  };
  const staffOccupied = (cycle, candidate, field, candidateField) => cycles.some((other) => {
    if (other.operationCycleCode === cycle.operationCycleCode || !cyclesOverlap(cycle, other)) return false;
    const otherCandidate = other[candidateField].find((item) => id(item.assignmentId) === id(other[field]));
    return otherCandidate && id(otherCandidate.person) === id(candidate.person);
  });

  const load = async () => {
    if (!form.routeId || !form.workDate) return toast.error('Hãy chọn tuyến và ngày cần phân bổ.');
    setBusy(true);
    try {
      const response = await adminService.previewTripAllocation(form);
      setSummary(response.summary);
      setTrips(response.trips || []);
      setCycles((response.cycles || []).map((cycle) => ({
        ...cycle,
        driverAssignmentId: allocationMode === 'AUTO' ? id(cycle.recommendedDriverAssignmentId) : '',
        assistantAssignmentId: allocationMode === 'AUTO' ? id(cycle.recommendedAssistantAssignmentId) : '',
        vehicleId: allocationMode === 'AUTO' ? id(cycle.recommendedVehicleId) : '',
      })));
      if (!response.cycles?.length) toast('Không còn cặp D–V chưa phân công trong ca đã chọn.');
    } catch (error) { toast.error(error?.message || 'Không thể tải dữ liệu phân bổ chuyến.'); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    const rows = cycles.filter((cycle) => cycle.driverAssignmentId && cycle.assistantAssignmentId && cycle.vehicleId).map((cycle) => ({
      tripIds: cycle.tripIds,
      driverAssignmentId: cycle.driverAssignmentId,
      assistantAssignmentId: cycle.assistantAssignmentId,
      vehicleId: cycle.vehicleId,
    }));
    if (!rows.length) return toast.error('Chưa chọn đủ tài xế, phụ xe và xe cho vòng D–V nào.');
    if (!window.confirm(`Xác nhận phân bổ ${rows.length} vòng (${rows.reduce((total, row) => total + row.tripIds.length, 0)} lượt chạy)? Các lựa chọn hiện tại mới là bản nháp và chỉ được ghi vào danh sách chuyến sau bước này.`)) return;
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
      <h2 className="mt-2 text-3xl font-black">Chọn nhân sự riêng cho từng vòng D–V</h2>
      <p className="mt-2 max-w-4xl text-sm text-emerald-50/80">Ca làm chỉ xác định thời gian nhân viên có mặt. Tại đây Admin mới chọn tài xế, phụ xe và xe phù hợp cho từng vòng chạy.</p>
    </section>

    <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
      <div className="mb-5 grid gap-3 md:grid-cols-2">
        <button type="button" onClick={() => applyMode('AUTO')} className={`rounded-2xl border p-4 text-left ${allocationMode === 'AUTO' ? 'border-emerald-400 bg-emerald-50 text-emerald-950' : 'border-slate-200 text-slate-600'}`}><b className="block">Đề xuất tự động</b><span className="mt-1 block text-sm">Chọn riêng tài xế, phụ xe và xe có điểm phù hợp cao nhất.</span></button>
        <button type="button" onClick={() => applyMode('MANUAL')} className={`rounded-2xl border p-4 text-left ${allocationMode === 'MANUAL' ? 'border-emerald-400 bg-emerald-50 text-emerald-950' : 'border-slate-200 text-slate-600'}`}><b className="block">Phân bổ thủ công</b><span className="mt-1 block text-sm">Admin tự chọn từng nhân sự và xe cho mỗi vòng D–V.</span></button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
        <label><span className="mb-2 block text-xs font-black uppercase text-slate-500">Tuyến</span><select value={form.routeId} onChange={(event) => setForm((current) => ({ ...current, routeId: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold"><option value="">Chọn tuyến đã có chuyến</option>{routes.filter((routeItem) => routeItem.status === 'PUBLISHED').map((routeItem) => <option key={routeItem._id} value={routeItem._id}>{routeItem.routeCode} · {routeItem.routeName}</option>)}</select></label>
        <label><span className="mb-2 block text-xs font-black uppercase text-slate-500">Ngày chạy</span><input type="date" value={form.workDate} onChange={(event) => setForm((current) => ({ ...current, workDate: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold" /></label>
        <label><span className="mb-2 block text-xs font-black uppercase text-slate-500">Ca làm</span><select value={form.shiftType} onChange={(event) => setForm((current) => ({ ...current, shiftType: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 px-4 font-bold"><option value="MORNING">Ca sáng</option><option value="AFTERNOON">Ca chiều</option></select></label>
        <button type="button" disabled={busy} onClick={load} className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 font-black text-emerald-950 disabled:opacity-50">{busy ? <RefreshCw className="animate-spin" size={18} /> : <Route size={18} />} Tải chuyến</button>
      </div>
    </section>

    {summary ? <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">{[['Tổng chuyến', summary.totalTrips], ['Chuyến chưa giao', summary.unassignedTrips], ['Vòng D–V chờ giao', summary.totalCycles], ['Tài xế có ca', summary.availableDrivers], ['Phụ xe có ca', summary.availableAssistants], ['Vòng thiếu nhân sự', summary.unstaffedCycles]].map(([label, value]) => <div key={label} className={`rounded-2xl border bg-white p-4 ${label === 'Chuyến chưa giao' && value ? 'border-amber-200' : 'border-emerald-100'}`}><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className={`mt-2 text-2xl font-black ${label === 'Chuyến chưa giao' && value ? 'text-amber-700' : ''}`}>{value || 0}</p></div>)}</section> : null}

    {summary ? <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ListChecks size={20} /></span><div><h3 className="text-lg font-black">Danh sách chuyến</h3><p className="text-sm text-slate-500">Theo dõi chuyến đã giao và tài nguyên còn thiếu.</p></div></div><div className="flex rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => setTripFilter('ALL')} className={`rounded-lg px-4 py-2 text-xs font-black ${tripFilter === 'ALL' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500'}`}>Tất cả ({trips.length})</button><button type="button" onClick={() => setTripFilter('UNASSIGNED')} className={`rounded-lg px-4 py-2 text-xs font-black ${tripFilter === 'UNASSIGNED' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500'}`}>Chưa giao ({trips.filter((trip) => !trip.assigned).length})</button></div></div>
      <div className="max-h-[420px] overflow-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs font-black uppercase text-slate-500"><tr>{['Mã chuyến', 'Chiều', 'Thời gian', 'Vòng D–V', 'Tài xế', 'Phụ xe', 'Xe', 'Trạng thái'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{visibleTrips.map((trip) => <tr key={trip._id} className="border-t border-slate-100 hover:bg-emerald-50/30"><td className="px-4 py-3 font-black">{trip.scheduleCode}</td><td className="px-4 py-3">{trip.direction === 'OUTBOUND' ? 'Chiều đi' : 'Chiều về'}</td><td className="whitespace-nowrap px-4 py-3 font-bold">{trip.departureTime}–{trip.expectedArrivalTime}</td><td className="px-4 py-3 text-slate-500">{trip.operationCycleCode || '—'}</td><td className="px-4 py-3">{trip.driverName || <span className="font-bold text-rose-600">Chưa có</span>}</td><td className="px-4 py-3">{trip.assistantName || <span className="font-bold text-rose-600">Chưa có</span>}</td><td className="px-4 py-3">{trip.vehicleLabel || <span className="font-bold text-rose-600">Chưa có</span>}</td><td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-black ${trip.assigned ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{trip.assigned ? 'Đã giao' : `Thiếu ${trip.missing.join(', ') || 'phân công'}`}</span></td></tr>)}</tbody></table>{!visibleTrips.length ? <div className="p-8 text-center text-sm font-bold text-slate-500">{tripFilter === 'UNASSIGNED' ? 'Không còn chuyến chưa giao.' : 'Không có chuyến trong bộ lọc đã chọn.'}</div> : null}</div>
    </section> : null}

    {cycles.length ? <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-black">Các vòng đang chờ phân bổ</h3><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">Bản nháp · Chưa lưu</span></div><p className="mt-1 text-sm text-slate-500">Các ô bên dưới là đề xuất/lựa chọn tạm thời. Danh sách chuyến phía trên chỉ cập nhật sau khi bạn bấm “Xác nhận phân bổ”.</p></div><span className={`rounded-full px-4 py-2 text-sm font-black ${selectedCount === cycles.length ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{selectedCount}/{cycles.length} vòng sẵn sàng xác nhận</span></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3"><div className={`rounded-xl border px-3 py-2 text-sm font-bold ${draftProgress.drivers === cycles.length ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>Tài xế đã chọn: {draftProgress.drivers}/{cycles.length}</div><div className={`rounded-xl border px-3 py-2 text-sm font-bold ${draftProgress.assistants === cycles.length ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>Phụ xe đã chọn: {draftProgress.assistants}/{cycles.length}</div><div className={`rounded-xl border px-3 py-2 text-sm font-bold ${draftProgress.vehicles === cycles.length ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>Xe đã chọn: {draftProgress.vehicles}/{cycles.length}</div></div>
      </div>
      <div className="overflow-x-auto overscroll-x-contain"><table className="w-full min-w-[1640px] table-fixed text-left text-sm"><colgroup><col className="w-[170px]" /><col className="w-[120px]" /><col className="w-[250px]" /><col className="w-[300px]" /><col className="w-[300px]" /><col className="w-[230px]" /><col className="w-[270px]" /></colgroup><thead className="bg-slate-50 text-xs font-black uppercase text-slate-500"><tr>{['Vòng D–V', 'Thời gian', 'Hai lượt chạy', 'Tài xế', 'Phụ xe', 'Xe thực hiện', 'Đánh giá lựa chọn'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{cycles.map((cycle) => {
        const driver = cycle.candidateDrivers.find((item) => id(item.assignmentId) === id(cycle.driverAssignmentId));
        const assistant = cycle.candidateAssistants.find((item) => id(item.assignmentId) === id(cycle.assistantAssignmentId));
        const ready = Boolean(cycle.driverAssignmentId && cycle.assistantAssignmentId && cycle.vehicleId);
        return <tr key={cycle.operationCycleCode} className={`border-t align-top ${ready ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-100'}`}>
          <td className="break-words px-4 py-4 font-black">{cycle.operationCycleCode}</td><td className="whitespace-nowrap px-4 py-4 font-bold">{cycle.startTime}–{cycle.endTime}</td>
          <td className="px-4 py-4">{cycle.trips.map((trip) => <span key={trip._id} className="block whitespace-nowrap">{trip.direction === 'OUTBOUND' ? 'D' : 'V'} · {trip.scheduleCode} · {trip.departureTime}</span>)}</td>
          <td className="px-4 py-3"><select value={id(cycle.driverAssignmentId)} onChange={(event) => selectStaff(cycle, 'driverAssignmentId', event.target.value, 'candidateDrivers', 'Tài xế')} className="h-12 w-full min-w-0 rounded-xl border border-slate-200 px-3 font-bold"><option value="">Chọn tài xế</option>{cycle.candidateDrivers.map((item) => { const occupied = staffOccupied(cycle, item, 'driverAssignmentId', 'candidateDrivers'); return <option key={item.assignmentId} value={item.assignmentId} disabled={occupied}>{item.person?.fullName} · {item.score}% nghiệp vụ{occupied ? ' · Trùng giờ' : ' · Đang rảnh'}</option>; })}</select></td>
          <td className="px-4 py-3"><select value={id(cycle.assistantAssignmentId)} onChange={(event) => selectStaff(cycle, 'assistantAssignmentId', event.target.value, 'candidateAssistants', 'Phụ xe')} className="h-12 w-full min-w-0 rounded-xl border border-slate-200 px-3 font-bold"><option value="">Chọn phụ xe</option>{cycle.candidateAssistants.map((item) => { const occupied = staffOccupied(cycle, item, 'assistantAssignmentId', 'candidateAssistants'); return <option key={item.assignmentId} value={item.assignmentId} disabled={occupied}>{item.person?.fullName} · {item.score}% nghiệp vụ{occupied ? ' · Trùng giờ' : ' · Đang rảnh'}</option>; })}</select></td>
          <td className="px-4 py-3"><select value={id(cycle.vehicleId)} onChange={(event) => selectVehicle(cycle, event.target.value)} className="h-12 w-full min-w-0 rounded-xl border border-slate-200 px-3 font-bold"><option value="">Chọn xe</option>{cycle.candidateVehicles.map((vehicle) => { const occupied = cycles.some((other) => other.operationCycleCode !== cycle.operationCycleCode && id(other.vehicleId) === id(vehicle) && cyclesOverlap(cycle, other)); return <option key={vehicle._id} value={vehicle._id} disabled={occupied}>{vehicle.busCode} · {vehicle.plateNumber}{occupied ? ' · Trùng giờ' : ''}</option>; })}</select>{!cycle.vehicleId && cycle.candidateVehicles.length ? <small className="mt-1 block font-bold text-amber-700">Cần chọn một xe chưa bị trùng giờ</small> : null}</td>
          <td className="px-4 py-4">{ready ? <><span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800"><UsersRound size={14} /> Đủ nguồn lực · Chờ xác nhận</span><p className="mt-2 text-xs"><b>Tài xế:</b> {driver.score}% nghiệp vụ · đã đi tuyến {driver.routeExperienceCount} lượt · đang rảnh</p><p className="mt-1 text-xs"><b>Phụ xe:</b> {assistant.score}% nghiệp vụ · đã phục vụ tuyến {assistant.routeExperienceCount} lượt · đang rảnh</p></> : <><span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800"><AlertTriangle size={14} /> Chưa đủ nguồn lực</span><button type="button" onClick={() => navigate('/admin/shifts')} className="mt-2 block font-bold text-amber-700">Thiếu nhân sự phù hợp? Sang Phân ca</button></>}</td>
        </tr>;
      })}</tbody></table></div>
      <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-emerald-200 bg-white/95 p-5 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-slate-900">{selectedCount ? `${selectedCount} vòng đã đủ điều kiện để lưu` : 'Chưa có vòng nào đủ điều kiện để lưu'}</p><p className="text-xs text-slate-500">Chỉ các vòng đủ tài xế, phụ xe và xe mới được xác nhận; danh sách chuyến sẽ tự tải lại sau khi lưu.</p></div><button type="button" disabled={busy || !selectedCount} onClick={confirm} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 font-black text-white shadow-lg shadow-emerald-900/15 disabled:shadow-none disabled:opacity-40"><CheckCircle2 size={19} /> {busy ? 'Đang lưu phân bổ…' : `Xác nhận & lưu ${selectedCount} vòng`}</button></div>
    </section> : null}
  </div>;
}
