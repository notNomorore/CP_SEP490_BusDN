import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, RefreshCw, Send, Wand2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import adminService from '../../services/adminService.js';

const id = (value) => String(value?._id || value || '');
const dateKey = (value) => { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const dayLabel = (value) => new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date(value));
const roleOf = (person) => person.role === 'DRIVER' ? 'DRIVER' : 'ASSISTANT';
const coverageText = (label, assigned, required) => {
  const difference = assigned - required;
  return <p className="mt-1 text-xs"><b>{label}:</b> Đã xếp <strong>{assigned}</strong> · Cần <strong>{required}</strong> <span className={`font-black ${difference < 0 ? 'text-rose-600' : difference > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{difference < 0 ? `· Thiếu ${Math.abs(difference)}` : difference > 0 ? `· Dư ${difference}` : '· Đủ'}</span></p>;
};

export default function WeeklyRosterPanel({ weekStartDate }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [roleFilter, setRoleFilter] = useState('DRIVER');
  const [shiftFilter, setShiftFilter] = useState('ALL');
  const [routeFilter, setRouteFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [validation, setValidation] = useState(null);
  const [editing, setEditing] = useState(null);
  const [availableStaff, setAvailableStaff] = useState([]);
  const [requirementsOpen, setRequirementsOpen] = useState(false);
  const [requirementDraft, setRequirementDraft] = useState([]);
  const [shortages, setShortages] = useState([]);

  const load = useCallback(async () => {
    if (!weekStartDate) return;
    setBusy(true);
    try { const response = await adminService.getWeeklyRoster(weekStartDate); setData(response); setValidation(response.roster?.validation || null); }
    catch (error) { toast.error(error?.message || 'Không thể tải lịch phân ca tuần.'); }
    finally { setBusy(false); }
  }, [weekStartDate]);

  useEffect(() => { load(); }, [load]);

  const assignments = useMemo(() => {
    if (!data) return [];
    return data.rows.flatMap((row) => {
      const source = roleFilter === 'DRIVER' ? row.driverAssignment : row.assistantAssignment;
      if (!source) return [];
      return [{ ...source, shiftId: row, person: roleFilter === 'DRIVER' ? source.driverId : source.assistantId }];
    });
  }, [data, roleFilter]);

  const workloads = useMemo(() => new Map(((roleFilter === 'DRIVER' ? data?.workloads?.drivers : data?.workloads?.assistants) || []).map((item) => [item.staffId, item])), [data, roleFilter]);
  const people = useMemo(() => (data?.staff || [])
    .filter((person) => roleOf(person) === roleFilter && person.fullName.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((left, right) => Number(workloads.get(id(left))?.totalMinutes || 0) - Number(workloads.get(id(right))?.totalMinutes || 0) || left.fullName.localeCompare(right.fullName, 'vi')), [data, roleFilter, search, workloads]);
  const visibleAssignment = (person, day) => assignments.find((assignment) => id(assignment.person) === id(person) && dateKey(assignment.workDate) === dateKey(day) && (shiftFilter === 'ALL' || assignment.shiftId.shiftType === shiftFilter));
  const routes = useMemo(() => [...new Map((data?.rows || []).filter((row) => row.routeId).map((row) => [id(row.routeId), row.routeId])).values()], [data]);
  const visibleForFilters = (assignment) => assignment && (routeFilter === 'ALL' || id(assignment.shiftId.routeId) === routeFilter);
  const groupedIssues = useMemo(() => [...[...(validation?.errors || []), ...(validation?.warnings || [])].reduce((map, item) => {
    const message = item.message || item.type;
    const current = map.get(message) || { message, count: 0 };
    current.count += 1;
    map.set(message, current);
    return map;
  }, new Map()).values()], [validation]);

  const workloadOverview = useMemo(() => {
    const staff = [...(data?.workloads?.drivers || []), ...(data?.workloads?.assistants || [])];
    const totalShifts = staff.reduce((sum, item) => sum + Number(item.totalShifts || 0), 0);
    const totalHours = staff.reduce((sum, item) => sum + Number(item.totalHours || 0), 0);
    const balanced = staff.filter((item) => Math.abs(Number(item.morningShifts || 0) - Number(item.afternoonShifts || 0)) <= 1).length;
    const nearLimit = staff.filter((item) => Number(item.remainingCapacity || 0) <= 1 && Number(item.totalShifts || 0) > 0).length;
    return { staff: staff.length, totalShifts, totalHours, balanced, nearLimit };
  }, [data]);

  const coverage = useMemo(() => (data?.days || []).map((day) => {
    const shifts = data.rows.filter((row) => dateKey(row.workDate) === dateKey(day));
    const requirements = (data.requirements || []).filter((row) => dateKey(row.date) === dateKey(day));
    const count = (type, field) => shifts.filter((row) => row.shiftType === type && row[field]).length;
    const requirementField = roleFilter === 'DRIVER' ? 'drivers' : 'assistants';
    return { day, morningRequired: requirements.reduce((sum, row) => sum + Number(row.morning?.[requirementField] || 0), 0), afternoonRequired: requirements.reduce((sum, row) => sum + Number(row.afternoon?.[requirementField] || 0), 0), morningAssigned: count('MORNING', roleFilter === 'DRIVER' ? 'driverAssignment' : 'assistantAssignment'), afternoonAssigned: count('AFTERNOON', roleFilter === 'DRIVER' ? 'driverAssignment' : 'assistantAssignment') };
  }), [data, roleFilter]);

  const run = async (action, success) => {
    setBusy(true);
    try { const result = await action(); setValidation(result.validation || result); toast.success(success); await load(); }
    catch (error) { toast.error(error?.message || 'Không thể xử lý lịch tuần.'); if (error?.errors) setValidation({ valid: false, errors: error.errors, warnings: [] }); }
    finally { setBusy(false); }
  };

  const openEdit = async (assignment) => {
    setEditing(assignment); setAvailableStaff([]);
    try { const response = await adminService.getRosterAvailableStaff({ date: dateKey(assignment.workDate), shiftType: assignment.shiftId.shiftType, role: roleFilter, excludeShiftId: id(assignment.shiftId) }); setAvailableStaff(response.staff || []); }
    catch (error) { toast.error(error?.message || 'Không thể tải nhân sự khả dụng.'); }
  };

  const replaceStaff = async (staffId) => {
    try {
      if (roleFilter === 'DRIVER') await adminService.assignDriverToSelectedShift(id(editing.shiftId), { driverId: staffId });
      else await adminService.assignAssistantToSelectedShift(id(editing.shiftId), { assistantId: staffId });
      toast.success('Đã cập nhật nhân sự và đánh dấu điều chỉnh thủ công.'); setEditing(null); await load();
    } catch (error) { toast.error(error?.message || 'Không thể thay đổi nhân sự.'); }
  };

  const changeShiftType = async (shiftType) => {
    const shift = editing?.shiftId;
    if (!shift || shift.shiftType === shiftType) return;
    const startTime = shiftType === 'MORNING' ? '05:30' : '12:00';
    const endTime = shiftType === 'MORNING' ? '12:00' : '18:30';
    setBusy(true);
    try {
      await adminService.updateShift(id(shift), {
        shiftCode: shift.shiftCode,
        shiftName: `${shiftType === 'MORNING' ? 'Ca sáng' : 'Ca chiều'} · ${shift.routeId?.routeCode || ''}`,
        routeId: id(shift.routeId),
        workDate: dateKey(editing.workDate),
        startTime,
        endTime,
        shiftType,
        status: shift.status,
        approvalStatus: shift.approvalStatus,
        requiresAssistant: shift.requiresAssistant,
        breakMinutes: shift.breakMinutes || 0,
        description: 'Admin điều chỉnh loại ca trực tiếp từ lịch tuần',
      });
      toast.success(`Đã chuyển sang ${shiftType === 'MORNING' ? 'ca sáng' : 'ca chiều'}.`);
      setEditing(null);
      await load();
    } catch (error) { toast.error(error?.message || 'Không thể đổi loại ca. Vui lòng kiểm tra trùng lịch.'); }
    finally { setBusy(false); }
  };

  const openRequirements = () => {
    setRequirementDraft((data.requirements || []).map((row) => ({ ...row, routeId: id(row.routeId), route: row.route || row.routeId })));
    setRequirementsOpen(true);
  };
  const updateRequirement = (index, shift, field, value) => setRequirementDraft((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [shift]: { ...row[shift], [field]: Math.max(0, Number(value || 0)) } } : row));
  const saveRequirements = async () => {
    setBusy(true);
    try { await adminService.saveWeeklyRosterRequirements(weekStartDate, requirementDraft.map((row) => ({ routeId: row.routeId, date: row.date, morning: row.morning, afternoon: row.afternoon }))); toast.success('Đã lưu nhu cầu riêng cho tuần.'); setRequirementsOpen(false); await load(); }
    catch (error) { toast.error(error?.message || 'Không thể lưu nhu cầu tuần.'); }
    finally { setBusy(false); }
  };
  const resetRequirements = async () => {
    setBusy(true);
    try { await adminService.resetWeeklyRosterRequirements(weekStartDate); toast.success('Đã dùng lại cấu hình mặc định của tuyến.'); setRequirementsOpen(false); await load(); }
    catch (error) { toast.error(error?.message || 'Không thể khôi phục cấu hình mặc định.'); }
    finally { setBusy(false); }
  };
  const applyMondayToWeekdays = () => setRequirementDraft((rows) => rows.map((row) => {
    const current = new Date(row.date);
    if (current.getDay() === 0 || current.getDay() === 6) return row;
    const monday = rows.find((candidate) => id(candidate.routeId) === id(row.routeId) && new Date(candidate.date).getDay() === 1);
    return monday ? { ...row, morning: { ...monday.morning }, afternoon: { ...monday.afternoon } } : row;
  }));

  const autoGenerate = async () => {
    setBusy(true);
    try { const result = await adminService.autoGenerateWeeklyRoster(weekStartDate); setShortages(result.shortages || []); setValidation(result.validation); toast.success(result.shortages?.length ? `Đã sinh lịch, còn ${result.shortages.length} thiếu hụt.` : 'Đã sinh lịch tuần đủ nguồn lực.'); await load(); }
    catch (error) { toast.error(error?.message || 'Không thể sinh lịch tuần.'); }
    finally { setBusy(false); }
  };

  const publishRoster = () => {
    if (!window.confirm(`Công bố lịch phân ca tuần ${dateKey(data.days[0])} – ${dateKey(data.days[6])}? Sau khi công bố, các ca sẽ bị khóa để tránh chỉnh sửa ngoài ý muốn.`)) return;
    run(() => adminService.publishWeeklyRoster(weekStartDate), 'Đã công bố lịch tuần.');
  };

  if (!data) return <div className="rounded-2xl border border-emerald-100 bg-white p-8 text-center font-bold text-slate-500">{busy ? 'Đang tải lịch tuần…' : 'Chưa có dữ liệu lịch tuần.'}</div>;

  return <div className="space-y-5">
    <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><CalendarDays className="text-emerald-700" /><h2 className="text-xl font-black">Lịch phân ca tuần · {dateKey(data.days[0])} – {dateKey(data.days[6])}</h2></div><p className="mt-1 text-sm text-slate-500">Mỗi hàng là một nhân viên, mỗi cột là một ngày. Ô “Nghỉ” nghĩa là nhân viên không có ca trong ngày đó.</p><div className="mt-3 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-sky-100 px-3 py-1 text-sky-800">Ca sáng · 05:30–12:00</span><span className="rounded-full bg-orange-100 px-3 py-1 text-orange-800">Ca chiều · 12:00–18:30</span><span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">Nghỉ</span></div></div><span className={`rounded-full px-4 py-2 text-xs font-black ${data.roster?.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{data.roster?.status === 'PUBLISHED' ? 'Đã công bố' : 'Bản nháp'}</span></div>
      <div className="mt-5 flex flex-wrap gap-2"><button disabled={busy || data.roster?.status === 'PUBLISHED'} onClick={openRequirements} className="h-10 rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-black text-emerald-800">Configure Requirements</button><button disabled={busy || data.roster?.status === 'PUBLISHED'} onClick={autoGenerate} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white disabled:opacity-40"><Wand2 size={17} /> Auto Generate</button><button disabled={busy} onClick={() => run(() => adminService.validateWeeklyRoster(weekStartDate), 'Đã kiểm tra lịch tuần.')} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-black"><CheckCircle2 size={17} /> Validate</button><button disabled={busy || validation?.valid !== true || data.roster?.status === 'PUBLISHED'} onClick={publishRoster} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#062819] px-4 text-sm font-black text-white disabled:opacity-40"><Send size={17} /> Publish</button>{data.roster?.status === 'PUBLISHED' ? <button disabled={busy} onClick={() => run(() => adminService.reopenWeeklyRoster(weekStartDate), 'Đã mở lịch để chỉnh sửa có kiểm soát.')} className="h-10 rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-black text-amber-800">Mở chỉnh sửa</button> : null}<button disabled={busy} onClick={load} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200"><RefreshCw className={busy ? 'animate-spin' : ''} size={17} /></button></div>
    </section>

    <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h3 className="font-black text-slate-900">Tổng quan giờ làm &amp; cân bằng ca</h3><p className="text-xs text-slate-500">Đã gộp từ mục “Ca làm &amp; hiệu suất” để theo dõi ngay trên lịch tuần.</p></div>
        <span className="text-xs font-bold text-slate-500">Số liệu của cả tài xế và phụ xe</span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl bg-slate-50 px-4 py-3"><p className="text-xs font-bold text-slate-500">Nhân sự trong tuần</p><p className="mt-1 text-2xl font-black">{workloadOverview.staff}</p></div>
        <div className="rounded-2xl bg-sky-50 px-4 py-3"><p className="text-xs font-bold text-sky-700">Tổng số ca</p><p className="mt-1 text-2xl font-black text-sky-900">{workloadOverview.totalShifts}</p></div>
        <div className="rounded-2xl bg-emerald-50 px-4 py-3"><p className="text-xs font-bold text-emerald-700">Tổng giờ làm</p><p className="mt-1 text-2xl font-black text-emerald-900">{workloadOverview.totalHours} giờ</p></div>
        <div className="rounded-2xl bg-violet-50 px-4 py-3"><p className="text-xs font-bold text-violet-700">Cân bằng sáng/chiều</p><p className="mt-1 text-2xl font-black text-violet-900">{workloadOverview.balanced}/{workloadOverview.staff}</p></div>
        <div className={`rounded-2xl px-4 py-3 ${workloadOverview.nearLimit ? 'bg-amber-50' : 'bg-emerald-50'}`}><p className={`text-xs font-bold ${workloadOverview.nearLimit ? 'text-amber-700' : 'text-emerald-700'}`}>Gần giới hạn ca</p><p className={`mt-1 text-2xl font-black ${workloadOverview.nearLimit ? 'text-amber-900' : 'text-emerald-900'}`}>{workloadOverview.nearLimit}</p></div>
      </div>
    </section>

    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">{coverage.map((item) => { const hasMissing = item.morningAssigned < item.morningRequired || item.afternoonAssigned < item.afternoonRequired; const hasSurplus = item.morningAssigned > item.morningRequired || item.afternoonAssigned > item.afternoonRequired; return <div key={dateKey(item.day)} className={`rounded-2xl border p-3 ${hasMissing ? 'border-rose-200 bg-rose-50' : hasSurplus ? 'border-amber-200 bg-amber-50' : 'border-emerald-100 bg-emerald-50'}`}><b className="text-sm">{dayLabel(item.day)}</b><div className="mt-2">{coverageText('Sáng', item.morningAssigned, item.morningRequired)}{coverageText('Chiều', item.afternoonAssigned, item.afternoonRequired)}</div></div>; })}</section>

    {shortages.length ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><div className="flex items-center gap-2 font-black text-rose-800"><AlertTriangle size={18} /> Thiếu nguồn lực sau Auto Generate</div><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{shortages.map((item, index) => <div key={`${item.date}-${item.routeId}-${item.shift}-${item.type}-${index}`} className="rounded-xl bg-white p-3 text-sm"><b>{item.routeCode || item.routeId} · {item.date} · {item.shift === 'MORNING' ? 'Ca sáng' : 'Ca chiều'}</b><p className="mt-1 text-rose-700">{item.type === 'DRIVER' ? 'Tài xế' : item.type === 'ASSISTANT' ? 'Phụ xe' : 'Xe'}: {item.assigned}/{item.required} ⚠ · thiếu {item.shortage}</p></div>)}</div></section> : null}

    {validation && (!validation.valid || validation.warnings?.length) ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 font-black text-amber-900"><AlertTriangle size={18} /> Lịch chưa sẵn sàng để công bố · {validation.errors?.length || 0} lỗi, {validation.warnings?.length || 0} cảnh báo</div><p className="mt-1 text-xs text-amber-800">Hệ thống đã gom các lỗi giống nhau để dễ theo dõi.</p><div className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm text-amber-900">{groupedIssues.map((item) => <p key={item.message}>• {item.message}{item.count > 1 ? <strong> · {item.count} ca</strong> : null}</p>)}</div></section> : null}

    <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm"><div className="flex flex-wrap gap-3 border-b border-slate-200 p-4"><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="h-10 rounded-xl border-slate-200 text-sm font-bold"><option value="DRIVER">Tài xế</option><option value="ASSISTANT">Phụ xe</option></select><select value={shiftFilter} onChange={(event) => setShiftFilter(event.target.value)} className="h-10 rounded-xl border-slate-200 text-sm font-bold"><option value="ALL">Cả hai ca</option><option value="MORNING">Ca sáng</option><option value="AFTERNOON">Ca chiều</option></select><select value={routeFilter} onChange={(event) => setRouteFilter(event.target.value)} className="h-10 rounded-xl border-slate-200 text-sm font-bold"><option value="ALL">Tất cả tuyến</option>{routes.map((route) => <option key={id(route)} value={id(route)}>{route.routeCode} · {route.routeName}</option>)}</select><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm nhân sự…" className="h-10 min-w-64 rounded-xl border-slate-200 text-sm" /><span className="self-center text-xs font-bold text-emerald-700">Đang xếp người thiếu giờ nhiều lên trước</span></div><div className="overflow-x-auto"><table className="min-w-[1250px] w-full table-fixed text-left text-sm"><thead className="bg-slate-50 text-xs font-black uppercase text-slate-500"><tr><th className="w-64 px-4 py-3">Nhân sự / Mức ưu tiên</th>{data.days.map((item) => <th key={dateKey(item)} className="px-3 py-3">{dayLabel(item)}</th>)}</tr></thead><tbody>{people.map((person) => { const workload = workloads.get(id(person)) || {}; const missingHours = Math.max(0, 40 - Number(workload.totalHours || 0)); return <tr key={id(person)} className="border-t border-slate-100"><td className="px-4 py-3"><b>{person.fullName}</b><small className="mt-1 block text-slate-500">{workload.totalShifts || 0} ca · {workload.totalHours || 0}/40 giờ</small><small className={`block font-bold ${missingHours >= 16 ? 'text-rose-600' : missingHours >= 8 ? 'text-amber-600' : 'text-emerald-700'}`}>Còn thiếu {missingHours.toFixed(1)} giờ · {missingHours >= 16 ? 'Ưu tiên cao' : missingHours >= 8 ? 'Ưu tiên vừa' : 'Ưu tiên thấp'}</small><small className="block text-slate-500">Ca sáng: {workload.morningShifts || 0} · Ca chiều: {workload.afternoonShifts || 0}</small></td>{data.days.map((item) => { const rawAssignment = visibleAssignment(person, item); const assignment = visibleForFilters(rawAssignment) ? rawAssignment : null; const type = assignment?.shiftId?.shiftType; return <td key={dateKey(item)} className="px-2 py-3"><button type="button" disabled={!assignment || data.roster?.status === 'PUBLISHED'} onClick={() => assignment && openEdit(assignment)} className={`w-full rounded-xl px-2 py-3 text-xs font-black ${type === 'MORNING' ? 'bg-sky-100 text-sky-800' : type === 'AFTERNOON' ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-500'}`}>{type === 'MORNING' ? 'Ca sáng' : type === 'AFTERNOON' ? 'Ca chiều' : 'Nghỉ'}{assignment ? <small className="mt-1 block font-semibold">{assignment.shiftId.startTime}–{assignment.shiftId.endTime}</small> : null}{assignment?.shiftId?.routeId ? <small className="block font-semibold">Tuyến {assignment.shiftId.routeId.routeCode}</small> : assignment ? <small className="block font-semibold text-rose-600">Chưa gán tuyến</small> : null}</button></td>; })}</tr>; })}</tbody></table></div></section>

    {requirementsOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"><div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-200 p-5"><div><h3 className="text-xl font-black">Configure Weekly Route Requirements</h3><p className="text-sm text-slate-500">Weekly override được ưu tiên trước cấu hình mặc định của tuyến.</p></div><button onClick={() => setRequirementsOpen(false)}><X /></button></div><div className="flex flex-wrap gap-2 border-b border-slate-200 p-4"><button onClick={applyMondayToWeekdays} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-black">Áp dụng Thứ Hai cho ngày thường</button><button onClick={resetRequirements} className="h-10 rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-black text-amber-800">Use Route Defaults</button></div><div className="overflow-auto p-4"><table className="min-w-[1050px] w-full text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs font-black uppercase text-slate-500"><tr><th className="px-3 py-3">Tuyến / Ngày</th><th className="px-3 py-3">Sáng · Xe</th><th className="px-3 py-3">Sáng · TX</th><th className="px-3 py-3">Sáng · PX</th><th className="px-3 py-3">Chiều · Xe</th><th className="px-3 py-3">Chiều · TX</th><th className="px-3 py-3">Chiều · PX</th><th className="px-3 py-3">Nguồn</th></tr></thead><tbody>{requirementDraft.map((row, index) => <tr key={`${id(row.routeId)}-${dateKey(row.date)}`} className="border-t border-slate-100"><td className="px-3 py-3"><b>{row.route?.routeCode || id(row.routeId).slice(-6)}</b><small className="block text-slate-500">{dayLabel(row.date)}</small></td>{['vehicles', 'drivers', 'assistants'].map((field) => <td key={`morning-${field}`} className="px-2 py-2"><input type="number" min="0" value={row.morning?.[field] || 0} onChange={(event) => updateRequirement(index, 'morning', field, event.target.value)} className="h-10 w-20 rounded-xl border-slate-200 text-center font-bold" /></td>)}{['vehicles', 'drivers', 'assistants'].map((field) => <td key={`afternoon-${field}`} className="px-2 py-2"><input type="number" min="0" value={row.afternoon?.[field] || 0} onChange={(event) => updateRequirement(index, 'afternoon', field, event.target.value)} className="h-10 w-20 rounded-xl border-slate-200 text-center font-bold" /></td>)}<td className="px-3 py-3 text-xs font-bold text-slate-500">{row.source === 'WEEKLY_OVERRIDE' ? 'Tuần' : row.source === 'ROUTE_DEFAULT' ? 'Mặc định tuyến' : 'Hệ thống'}</td></tr>)}</tbody></table></div><div className="flex justify-end gap-2 border-t border-slate-200 p-4"><button onClick={() => setRequirementsOpen(false)} className="h-10 rounded-xl border border-slate-200 px-4 font-black">Hủy</button><button disabled={busy} onClick={saveRequirements} className="h-10 rounded-xl bg-emerald-600 px-5 font-black text-white disabled:opacity-50">Lưu nhu cầu tuần</button></div></div></div> : null}

    {editing ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"><div className="w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><h3 className="text-xl font-black">Chỉnh ca và nhân sự</h3><p className="text-sm text-slate-500">{dateKey(editing.workDate)} · {editing.shiftId.startTime}–{editing.shiftId.endTime}</p></div><button onClick={() => setEditing(null)}><X /></button></div><div className="mt-4 rounded-2xl bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">Loại ca</p><div className="mt-2 grid grid-cols-2 gap-2"><button disabled={busy || data.roster?.status === 'PUBLISHED'} onClick={() => changeShiftType('MORNING')} className={`rounded-xl border px-3 py-3 text-sm font-black ${editing.shiftId.shiftType === 'MORNING' ? 'border-sky-300 bg-sky-100 text-sky-800' : 'border-slate-200 bg-white'}`}>Ca sáng<br /><small>05:30–12:00</small></button><button disabled={busy || data.roster?.status === 'PUBLISHED'} onClick={() => changeShiftType('AFTERNOON')} className={`rounded-xl border px-3 py-3 text-sm font-black ${editing.shiftId.shiftType === 'AFTERNOON' ? 'border-orange-300 bg-orange-100 text-orange-800' : 'border-slate-200 bg-white'}`}>Ca chiều<br /><small>12:00–18:30</small></button></div><p className="mt-2 text-xs text-slate-500">Đổi loại ca sẽ áp dụng cho cả tài xế, phụ xe và xe đang thuộc ca này. Hệ thống sẽ từ chối nếu phát sinh trùng lịch hoặc vượt giới hạn giờ.</p></div><p className="mb-2 mt-4 text-xs font-black uppercase text-slate-500">Đổi {roleFilter === 'DRIVER' ? 'tài xế' : 'phụ xe'}</p><div className="max-h-72 space-y-2 overflow-y-auto">{availableStaff.map((person) => <button key={id(person.id)} disabled={!person.available} onClick={() => replaceStaff(person.id)} className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-200 p-3 text-left disabled:bg-slate-50 disabled:opacity-70"><span><b className="block">{person.name}</b><small className="text-slate-500">{person.totalShifts} ca · {person.totalHours}h · S:{person.morningShifts} / C:{person.afternoonShifts}</small>{person.available ? <small className="mt-1 block font-semibold text-emerald-700">{(person.priorityReasons || []).join(' · ')}</small> : <small className="mt-1 block font-semibold text-rose-600">{(person.unavailableDetails || []).map((detail) => detail.message).join(' ') || person.unavailableReasons.join(', ')}</small>}</span><span className={`shrink-0 rounded-full px-2 py-1 text-xs font-black ${person.available ? person.priorityLevel === 'HIGH' ? 'bg-rose-100 text-rose-700' : person.priorityLevel === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-rose-600'}`}>{person.available ? `${person.score} điểm · ${person.priorityLevel === 'HIGH' ? 'Ưu tiên cao' : person.priorityLevel === 'MEDIUM' ? 'Ưu tiên vừa' : 'Ưu tiên thấp'}` : 'Không khả dụng'}</span></button>)}</div></div></div> : null}
  </div>;
}
