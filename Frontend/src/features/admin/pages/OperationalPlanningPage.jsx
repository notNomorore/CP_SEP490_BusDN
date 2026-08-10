import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Header from '../../../shared/components/navigation/Header.jsx';
import adminService from '../services/adminService.js';

const dateInput = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const getId = (value) => String(value?._id || value || '');

export default function OperationalPlanningPage({ embedded = false }) {
  const navigate = useNavigate();
  const [workDate, setWorkDate] = useState(dateInput());
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [cancelPending, setCancelPending] = useState(false);
  const rows = useMemo(() => plan?.rows || [], [plan?.rows]);
  const summary = plan?.summary || {};
  const groupedCoverage = useMemo(() => [...rows.reduce((map, row) => {
    const key = `${row.startTime}-${row.endTime}`;
    const current = map.get(key) || { key, total: 0, ready: 0 };
    current.total += 1;
    if (!row.hardErrors?.length) current.ready += 1;
    map.set(key, current);
    return map;
  }, new Map()).values()], [rows]);

  useEffect(() => {
    adminService.getSchedulingPlans({ workDate, status: 'DRAFT' }).then((response) => setDrafts(response.plans || [])).catch(() => setDrafts([]));
  }, [workDate]);

  const generate = async () => {
    setBusy(true);
    try {
      const response = await adminService.generateSchedulingPlan({ workDate });
      setPlan(response.plan);
      setDrafts((current) => [response.plan, ...current.filter((item) => item._id !== response.plan._id)]);
      toast.success(`Đã đề xuất ${response.plan.rows.length} tổ vận hành cần bố trí.`);
    } catch (error) { toast.error(error?.message || 'Không thể tính nhu cầu nguồn lực. Hãy tạo chuyến cho ngày đã chọn trước.'); }
    finally { setBusy(false); }
  };

  const updateRow = (previewId, patch) => setPlan((current) => ({
    ...current,
    rows: current.rows.map((row) => row.previewId === previewId ? { ...row, ...patch, status: 'CHANGED' } : row),
  }));

  const validate = async (showSuccess = true) => {
    const response = await adminService.validateSchedulingPlan({ planId: plan._id, rows: plan.rows });
    setPlan(response.plan);
    if (showSuccess) {
      if (response.plan.hardErrors.length) toast.error(`Còn ${response.plan.hardErrors.length} vấn đề cần xử lý.`);
      else toast.success('Phương án bố trí đã đủ điều kiện xác nhận.');
    }
    return response.plan;
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const checked = await validate(false);
      if (checked.hardErrors.length) return toast.error('Không thể xác nhận khi phương án vẫn còn thiếu nguồn lực hoặc xung đột.');
      const response = await adminService.confirmSchedulingPlan({ planId: checked._id, rows: checked.rows });
      toast.success(`Đã xác nhận ${response.plan.confirmedShiftIds.length} ca làm và tổ vận hành.`);
      if (embedded) {
        setPlan(null);
        setDrafts([]);
      } else {
        navigate('/admin/shifts');
      }
    } catch (error) { toast.error(error?.message || 'Không thể xác nhận kế hoạch.'); }
    finally { setBusy(false); }
  };

  const cancelDraft = async () => {
    setBusy(true);
    try {
      await adminService.cancelSchedulingPlan(plan._id);
      setDrafts((current) => current.filter((item) => item._id !== plan._id));
      setPlan(null);
      setCancelPending(false);
      toast.success('Đã hủy kế hoạch nháp.');
    } catch (error) { toast.error(error?.message || 'Không thể hủy kế hoạch nháp.'); }
    finally { setBusy(false); }
  };

  return <div className={embedded ? 'text-[#05231a]' : 'min-h-screen bg-[#eef9f4] text-[#05231a]'}>
    {!embedded ? <Header /> : null}
    <main className={embedded ? 'space-y-5' : 'mx-auto max-w-[1700px] space-y-5 px-4 pb-12 pt-28 lg:px-8'}>
      <section className="rounded-3xl bg-[#062819] p-6 text-white">
        {!embedded ? <button type="button" onClick={() => navigate('/admin/routes')} className="inline-flex items-center gap-2 text-sm font-bold text-emerald-200"><ArrowLeft size={17} /> Tuyến và lịch chạy</button> : null}
        <h1 className="mt-3 text-3xl font-black">Đề xuất và tạo ca theo nhu cầu chuyến</h1>
        <p className="mt-2 max-w-4xl text-sm text-emerald-50/80">Hệ thống đọc số chuyến đã lập trong ngày, tính số nhân sự tối thiểu cho ca sáng/chiều và đề xuất tài xế, phụ xe để Admin tạo ca.</p>
        <div className="mt-5 flex flex-wrap items-end gap-3"><label><span className="mb-2 block text-xs font-black uppercase text-emerald-200">Ngày cần phân ca</span><input type="date" value={workDate} onChange={(event) => { setWorkDate(event.target.value); setPlan(null); }} className="h-12 rounded-xl px-4 font-bold text-slate-900" /></label><button type="button" disabled={busy} onClick={generate} className="inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-300 px-5 font-black text-emerald-950 disabled:opacity-50">{busy ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} />} Phân tích chuyến & gợi ý ca</button></div>
      </section>

      {drafts.length && !plan ? <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-black text-amber-900">Phương án đang chờ Admin xác nhận</h2><div className="mt-3 flex flex-wrap gap-3">{drafts.map((draft) => <button key={draft._id} type="button" onClick={() => setPlan(draft)} className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-left text-sm"><b>{draft.planCode}</b><span className="mt-1 block text-slate-500">{draft.summary?.readySlots || 0}/{draft.summary?.totalSlots || 0} tổ đã đủ nguồn lực</span></button>)}</div></section> : null}

      {plan ? <>
        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[['Số ca cần tạo', summary.totalSlots], ['Ca đã đủ nhân sự', summary.readySlots], ['Thiếu tài xế', summary.missingDriverCount], ['Thiếu phụ xe', summary.missingAssistantCount], ['Xung đột nhân sự', summary.conflictCount]].map(([label, value]) => <div key={label} className="rounded-2xl border border-emerald-100 bg-white p-4"><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value || 0}</p></div>)}
        </section>

        {summary.demandByShift?.length ? <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5"><h2 className="text-xl font-black text-cyan-950">Nhu cầu nhân sự theo số chuyến đã lập</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{summary.demandByShift.map((item, index) => <div key={`${item.routeId}-${item.shiftType}-${index}`} className="rounded-2xl bg-white p-4 text-sm"><p className="font-black">{item.shiftType === 'MORNING' ? 'Ca sáng' : 'Ca chiều'} · {item.startTime}–{item.endTime}</p><p className="mt-2 text-slate-700">Có <strong>{item.tripCount} lượt chạy</strong>. Cần tối thiểu <strong>{item.requiredDrivers} tài xế và {item.requiredAssistants} phụ xe</strong> để đáp ứng các vòng chạy đồng thời.</p></div>)}</div></section> : null}

        <section className="rounded-3xl border border-emerald-100 bg-white p-5">
          <h2 className="text-xl font-black">Mức đáp ứng nguồn lực theo khung giờ</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">{groupedCoverage.map((item) => <div key={item.key} className="rounded-xl bg-slate-50 p-4"><p className="font-black">{item.key}</p><p className={`mt-1 text-sm font-bold ${item.ready === item.total ? 'text-emerald-700' : 'text-amber-700'}`}>{item.ready}/{item.total} vị trí sẵn sàng · {Math.round(item.ready / item.total * 100)}%</p></div>)}</div>
        </section>

        {(plan.hardErrors?.length || plan.warnings?.length) ? <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-center gap-2 text-amber-900"><AlertTriangle size={22} /><h2 className="text-xl font-black">Review lỗi và cảnh báo</h2></div><div className="mt-3 grid gap-2 lg:grid-cols-2">{plan.hardErrors?.map((message) => <p key={message} className="rounded-xl bg-white p-3 text-sm font-bold text-rose-700">HARD ERROR · {message}</p>)}{plan.warnings?.map((message) => <p key={message} className="rounded-xl bg-white p-3 text-sm font-bold text-amber-800">WARNING · {message}</p>)}</div></section> : null}

        <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-white">
          <div className="border-b border-slate-200 p-5"><h2 className="text-xl font-black">Sắp xếp nhân sự theo ca</h2><p className="text-sm text-slate-500">Danh sách chỉ hiển thị tài xế và phụ xe đủ điều kiện: không nghỉ phép, không trùng giờ, còn thời lượng làm việc và đủ thời gian nghỉ.</p></div>
          <div className="max-h-[620px] overflow-auto"><table className="min-w-[1250px] w-full text-left text-xs"><thead className="sticky top-0 z-10 bg-slate-100 text-slate-500"><tr>{['Tuyến', 'Khung giờ', 'Nhu cầu', 'Chuyến', 'Tài xế / điểm', 'Phụ xe', 'Trạng thái', 'Lỗi'].map((item) => <th key={item} className="px-4 py-3 font-black uppercase">{item}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.previewId} className="border-t border-slate-100 align-top"><td className="px-4 py-4 font-black">{row.route?.routeCode}<small className="block max-w-48 font-normal text-slate-500">{row.route?.routeName}</small></td><td className="px-4 py-4 font-bold">{row.startTime}-{row.endTime}</td><td className="px-4 py-4">{row.demandLevel}</td><td className="px-4 py-4 font-bold">{row.requiredTrips ? `${row.plannedTrips}/${row.requiredTrips}` : '-'}</td><td className="px-4 py-3"><select disabled={!row.requiresDriver} value={getId(row.driverId)} onChange={(event) => updateRow(row.previewId, { driverId: event.target.value })} className="h-11 min-w-64 rounded-lg border border-slate-200 px-3"><option value="">Chưa có tài xế</option>{row.availableDrivers?.map((item) => <option key={item._id} value={item._id}>{item.fullName} · {item.score}% · {Math.round((item.assignedMinutes || 0) / 6) / 10}/8h</option>)}</select>{row.driver?.reasons?.length ? <small className="mt-1 block max-w-64 text-emerald-700">{row.driver.reasons.join(' · ')}</small> : null}</td><td className="px-4 py-3"><select disabled={!row.requiresAssistant} value={getId(row.assistantId)} onChange={(event) => updateRow(row.previewId, { assistantId: event.target.value })} className="h-11 min-w-52 rounded-lg border border-slate-200 px-3"><option value="">Chưa có phụ xe</option>{row.availableAssistants?.map((item) => <option key={item._id} value={item._id}>{item.fullName}</option>)}</select></td><td className="px-4 py-4"><span className={`rounded-full px-3 py-1 font-black ${row.hardErrors?.length ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'}`}>{row.hardErrors?.length ? 'Cần bổ sung' : 'Đủ nhân sự'}</span></td><td className="max-w-64 px-4 py-4 font-bold text-rose-600">{row.hardErrors?.join(' ') || '-'}</td></tr>)}</tbody></table></div>
          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 p-5"><button type="button" disabled={busy} onClick={() => setCancelPending(true)} className="h-12 rounded-xl border border-rose-200 px-5 font-black text-rose-600">Hủy bản nháp</button><button type="button" disabled={busy} onClick={() => validate()} className="h-12 rounded-xl border border-emerald-300 px-5 font-black text-emerald-800">Kiểm tra lại</button><button type="button" disabled={busy || Boolean(plan.hardErrors?.length)} onClick={confirm} className="inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-600 px-6 font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 size={19} /> Confirm lịch vận hành</button></div>
        </section>
      </> : null}
      {cancelPending ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-3xl bg-white p-6"><h3 className="text-xl font-black text-rose-700">Hủy kế hoạch DRAFT?</h3><p className="mt-3 text-sm text-slate-600">Kế hoạch sẽ được đánh dấu CANCELLED; chưa có ca chính thức nào bị tạo.</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setCancelPending(false)} className="h-11 rounded-xl border border-slate-200 px-5 font-black">Giữ lại</button><button type="button" disabled={busy} onClick={cancelDraft} className="h-11 rounded-xl bg-rose-600 px-5 font-black text-white">Xác nhận hủy</button></div></div></div> : null}
    </main>
  </div>;
}
