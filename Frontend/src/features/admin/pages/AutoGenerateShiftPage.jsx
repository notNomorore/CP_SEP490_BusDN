import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarRange, Check, RefreshCw, Save, Sparkles, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Header from '../../../shared/components/navigation/Header.jsx';
import useTheme from '../../../shared/hooks/useTheme.js';
import adminService from '../services/adminService.js';

const dateInput = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const initialForm = {
  routeId: '',
  startDate: dateInput(),
  endDate: dateInput(),
  shiftType: 'MORNING',
  startTime: '05:30',
  endTime: '13:30',
  tripSelectionMode: 'NUMBER',
  numberOfTrips: 1,
  tripIds: [],
  autoAssignVehicle: true,
  autoAssignDriver: true,
  autoAssignAssistant: true,
};

const shiftTimes = {
  MORNING: ['05:30', '13:30'],
  AFTERNOON: ['13:30', '17:30'],
  EVENING: ['17:30', '22:00'],
  FULL_DAY: ['05:30', '17:30'],
};

const statusLabels = {
  VALID: 'Hợp lệ',
  NEED_MANUAL_ASSIGNMENT: 'Cần phân công thủ công',
  CONFLICT: 'Xung đột',
};

const statusClasses = {
  VALID: 'bg-emerald-100 text-emerald-800',
  NEED_MANUAL_ASSIGNMENT: 'bg-amber-100 text-amber-800',
  CONFLICT: 'bg-rose-100 text-rose-800',
};

const getErrorMessage = (error, fallback) => error?.message || error?.response?.data?.message || fallback;
const getId = (value) => String(value?._id || value || '');
const buildFormSignature = (form) => JSON.stringify({
  routeId: form.routeId,
  startDate: form.startDate,
  endDate: form.endDate,
  shiftType: form.shiftType,
  startTime: form.startTime,
  endTime: form.endTime,
  tripSelectionMode: form.tripSelectionMode,
  numberOfTrips: Number(form.numberOfTrips || 0),
  tripIds: [...(form.tripIds || [])].sort(),
  autoAssignVehicle: form.autoAssignVehicle,
  autoAssignDriver: form.autoAssignDriver,
  autoAssignAssistant: form.autoAssignAssistant,
});

const refreshRowState = (row) => {
  const hasConflict = (row.warnings || []).some((warning) => warning.level === 'ERROR');
  const complete = row.driverId && row.assistantId && row.vehicleId && row.tripIds?.length;
  return {
    ...row,
    status: hasConflict ? 'CONFLICT' : complete ? 'VALID' : 'NEED_MANUAL_ASSIGNMENT',
  };
};

const AssignmentToggle = ({ checked, label, onChange }) => (
  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800">
    <span>{label}</span>
    <input type="checkbox" checked={checked} onChange={onChange} className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
  </label>
);

const AutoGenerateShiftPage = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const [form, setForm] = useState(initialForm);
  const [routes, setRoutes] = useState([]);
  const [trips, setTrips] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [generatedFormSignature, setGeneratedFormSignature] = useState('');

  const shellClass = isDarkMode ? 'bg-[#071516] text-slate-100' : 'bg-[#f7fbfc] text-slate-900';
  const panelClass = isDarkMode ? 'border-white/10 bg-[#111d20]' : 'border-slate-200 bg-white';
  const inputClass = `h-11 w-full rounded-lg border px-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 ${
    isDarkMode ? 'border-white/10 bg-white/[0.05] text-white' : 'border-slate-200 bg-white text-slate-900'
  }`;
  const mutedClass = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  useEffect(() => {
    const loadRoutes = async () => {
      try {
        const response = await adminService.getRoutes({ limit: 100 });
        setRoutes((response.routes || response.data || []).filter((route) => route.status !== 'SUSPENDED'));
      } catch (error) {
        toast.error(getErrorMessage(error, 'Không thể tải danh sách tuyến.'));
      } finally {
        setIsLoading(false);
      }
    };
    loadRoutes();
  }, []);

  useEffect(() => {
    if (!form.routeId || form.tripSelectionMode !== 'TRIPS') {
      setTrips([]);
      return;
    }
    adminService.getTripSchedules({
      routeId: form.routeId,
      startDate: form.startDate,
      endDate: form.endDate,
      limit: 100,
    }).then((response) => {
      setTrips(response.schedules || response.tripSchedules || []);
    }).catch((error) => toast.error(getErrorMessage(error, 'Không thể tải danh sách chuyến.')));
  }, [form.endDate, form.routeId, form.startDate, form.tripSelectionMode]);

  const summary = useMemo(() => ({
    total: previewRows.length,
    valid: previewRows.filter((row) => row.status === 'VALID').length,
    manual: previewRows.filter((row) => row.status === 'NEED_MANUAL_ASSIGNMENT').length,
    conflict: previewRows.filter((row) => row.status === 'CONFLICT').length,
  }), [previewRows]);
  const currentFormSignature = useMemo(() => buildFormSignature(form), [form]);
  const isPreviewStale = Boolean(previewRows.length && generatedFormSignature && generatedFormSignature !== currentFormSignature);
  const blockingReasons = useMemo(() => {
    const reasons = [];
    if (isPreviewStale) reasons.push('Điều kiện phía trên đã thay đổi. Hãy bấm Sinh lại để cập nhật danh sách ca.');
    previewRows.forEach((row, index) => {
      const missing = [];
      if (!row.vehicleId) missing.push('xe');
      if (!row.driverId) missing.push('tài xế');
      if (!row.assistantId) missing.push('phụ xe');
      if (!row.tripIds?.length) missing.push('chuyến');
      if (missing.length) reasons.push(`Dòng ${index + 1} chưa có ${missing.join(', ')}.`);
      if (row.status === 'CONFLICT') reasons.push(`Dòng ${index + 1} đang có xung đột: ${row.warningMessage || 'hãy kiểm tra dữ liệu ca'}.`);
    });
    return reasons;
  }, [isPreviewStale, previewRows]);

  const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));

  const validateForm = () => {
    if (!form.routeId) return 'Tuyến xe là bắt buộc.';
    if (!form.startDate || !form.endDate) return 'Ngày hoặc khoảng ngày là bắt buộc.';
    if (form.startDate > form.endDate) return 'Ngày bắt đầu phải trước ngày kết thúc.';
    if (!form.startTime || !form.endTime || form.startTime >= form.endTime) return 'Giờ bắt đầu phải nhỏ hơn giờ kết thúc.';
    if (form.tripSelectionMode === 'NUMBER' && Number(form.numberOfTrips) < 1) return 'Số chuyến phải lớn hơn 0.';
    if (form.tripSelectionMode === 'TRIPS' && !form.tripIds.length) return 'Hãy chọn ít nhất một chuyến.';
    return '';
  };

  const generate = async () => {
    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }
    setIsGenerating(true);
    try {
      const response = await adminService.autoGenerateShiftSchedule({
        ...form,
        generationMode: 'PREVIEW',
        workDate: form.startDate,
        numberOfTrips: form.tripSelectionMode === 'NUMBER' ? Number(form.numberOfTrips) : 0,
        tripIds: form.tripSelectionMode === 'TRIPS' ? form.tripIds : [],
        vehicleAssignmentMode: form.autoAssignVehicle ? 'AUTO' : 'MANUAL',
        driverAssignmentMode: form.autoAssignDriver ? 'AUTO' : 'MANUAL',
        assistantAssignmentMode: form.autoAssignAssistant ? 'AUTO' : 'MANUAL',
      });
      if (response.generationMode !== 'PREVIEW' || !Array.isArray(response.rows)) {
        throw new Error('Backend chưa cập nhật chức năng sinh ca xem trước. Vui lòng khởi động lại backend.');
      }
      if (!response.rows.length) {
        throw new Error('Không tạo được ca nào. Hãy kiểm tra tuyến, khoảng ngày và khung giờ đã chọn.');
      }
      setPreviewRows(response.rows.map(refreshRowState));
      setGeneratedFormSignature(buildFormSignature(form));
      toast.success(`Đã tạo ${response.rows.length} ca tạm thời. Chưa có dữ liệu nào được lưu.`);
    } catch (generateError) {
      toast.error(getErrorMessage(generateError, 'Không thể sinh danh sách ca.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const updateRow = (previewId, patch) => {
    setPreviewRows((current) => current.map((row) => (
      row.previewId === previewId ? refreshRowState({ ...row, ...patch }) : row
    )));
  };

  const selectTrip = (row, tripId) => {
    const exists = row.tripIds.some((id) => getId(id) === String(tripId));
    updateRow(row.previewId, {
      tripIds: exists ? row.tripIds.filter((id) => getId(id) !== String(tripId)) : [...row.tripIds, tripId],
    });
  };

  const confirm = async () => {
    if (isPreviewStale) {
      toast.error('Điều kiện sinh ca đã thay đổi. Hãy bấm Sinh lại trước khi xác nhận lưu.');
      return;
    }
    if (previewRows.some((row) => row.status !== 'VALID')) {
      toast.error('Hãy xử lý toàn bộ xung đột và gán đủ tài xế, phụ xe, xe, chuyến trước khi xác nhận.');
      return;
    }
    setIsConfirming(true);
    try {
      const response = await adminService.confirmGeneratedShifts(previewRows.map((row) => ({
        shiftCode: row.shiftCode,
        shiftName: row.shiftName,
        routeId: row.routeId,
        workDate: row.workDate,
        startTime: row.startTime,
        endTime: row.endTime,
        shiftType: row.shiftType,
        vehicleId: row.vehicleId,
        driverId: row.driverId,
        assistantId: row.assistantId,
        tripIds: row.tripIds,
      })));
      toast.success(`Đã lưu ${response.shifts?.length || 0} ca chính thức.`);
      navigate('/admin/shifts');
    } catch (confirmError) {
      toast.error(getErrorMessage(confirmError, 'Không thể xác nhận lưu ca.'));
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className={`min-h-screen ${shellClass}`}>
      <Header />
      <main className="mx-auto max-w-[1680px] px-4 pb-12 pt-28 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <button type="button" onClick={() => navigate('/admin/shifts')} className={`mb-3 inline-flex items-center gap-2 text-sm font-bold ${mutedClass}`}>
              <ArrowLeft size={16} /> Quản lý ca làm
            </button>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-500">Điều phối nhân sự và chuyến</p>
            <h1 className="mt-2 text-3xl font-black">Sinh ca làm việc tự động</h1>
            <p className={`mt-2 text-sm ${mutedClass}`}>Hệ thống chỉ tạo bản xem trước. Dữ liệu được lưu khi quản trị viên bấm Xác nhận lưu.</p>
          </div>
          <CalendarRange className="text-cyan-500" size={32} />
        </div>

        <section className={`border p-5 ${panelClass}`}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="xl:col-span-2">
              <span className={`mb-2 block text-xs font-bold uppercase ${mutedClass}`}>Tuyến xe *</span>
              <select className={inputClass} value={form.routeId} onChange={(event) => updateForm({ routeId: event.target.value, tripIds: [] })} disabled={isLoading}>
                <option value="">Chọn tuyến</option>
                {routes.map((route) => <option key={route._id} value={route._id}>{route.routeCode} - {route.routeName}</option>)}
              </select>
            </label>
            <label>
              <span className={`mb-2 block text-xs font-bold uppercase ${mutedClass}`}>Từ ngày *</span>
              <input type="date" className={inputClass} value={form.startDate} onChange={(event) => updateForm({ startDate: event.target.value, tripIds: [] })} />
            </label>
            <label>
              <span className={`mb-2 block text-xs font-bold uppercase ${mutedClass}`}>Đến ngày *</span>
              <input type="date" className={inputClass} value={form.endDate} min={form.startDate} onChange={(event) => updateForm({ endDate: event.target.value, tripIds: [] })} />
            </label>
            <label>
              <span className={`mb-2 block text-xs font-bold uppercase ${mutedClass}`}>Loại ca</span>
              <select className={inputClass} value={form.shiftType} onChange={(event) => {
                const shiftType = event.target.value;
                const times = shiftTimes[shiftType];
                updateForm({ shiftType, ...(times ? { startTime: times[0], endTime: times[1] } : {}) });
              }}>
                <option value="MORNING">Ca sáng</option>
                <option value="AFTERNOON">Ca chiều</option>
                <option value="EVENING">Ca tối</option>
                <option value="FULL_DAY">Cả ngày</option>
                <option value="CUSTOM">Tùy chỉnh</option>
              </select>
            </label>
            <label>
              <span className={`mb-2 block text-xs font-bold uppercase ${mutedClass}`}>Giờ bắt đầu *</span>
              <input type="time" className={inputClass} value={form.startTime} onChange={(event) => updateForm({ startTime: event.target.value })} />
            </label>
            <label>
              <span className={`mb-2 block text-xs font-bold uppercase ${mutedClass}`}>Giờ kết thúc *</span>
              <input type="time" className={inputClass} value={form.endTime} onChange={(event) => updateForm({ endTime: event.target.value })} />
            </label>
            <div className="xl:col-span-3">
              <span className={`mb-2 block text-xs font-bold uppercase ${mutedClass}`}>Phân công chuyến</span>
              <div className="flex min-h-11 items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-bold"><input type="radio" checked={form.tripSelectionMode === 'NUMBER'} onChange={() => updateForm({ tripSelectionMode: 'NUMBER', tripIds: [] })} /> Theo số chuyến</label>
                <label className="flex items-center gap-2 text-sm font-bold"><input type="radio" checked={form.tripSelectionMode === 'TRIPS'} onChange={() => updateForm({ tripSelectionMode: 'TRIPS' })} /> Chọn chuyến cụ thể</label>
                {form.tripSelectionMode === 'NUMBER' ? <input type="number" min="1" className={`${inputClass} max-w-28`} value={form.numberOfTrips} onChange={(event) => updateForm({ numberOfTrips: event.target.value })} /> : null}
              </div>
            </div>
          </div>

          {form.tripSelectionMode === 'TRIPS' ? (
            <div className="mt-4 grid max-h-44 gap-2 overflow-y-auto border-t border-slate-200 pt-4 md:grid-cols-2 xl:grid-cols-4">
              {trips.map((trip) => (
                <label key={trip._id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800">
                  <input type="checkbox" checked={form.tripIds.includes(trip._id)} onChange={() => updateForm({ tripIds: form.tripIds.includes(trip._id) ? form.tripIds.filter((id) => id !== trip._id) : [...form.tripIds, trip._id] })} />
                  <span><strong className="block">{trip.scheduleCode}</strong>{dateInput(new Date(trip.serviceDate))} · {trip.departureTime}-{trip.expectedArrivalTime}</span>
                </label>
              ))}
              {!trips.length ? <p className={`text-sm ${mutedClass}`}>Không có chuyến phù hợp với tuyến và khoảng ngày đã chọn.</p> : null}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <AssignmentToggle label="Tự động phân công xe" checked={form.autoAssignVehicle} onChange={(event) => updateForm({ autoAssignVehicle: event.target.checked })} />
            <AssignmentToggle label="Tự động phân công tài xế" checked={form.autoAssignDriver} onChange={(event) => updateForm({ autoAssignDriver: event.target.checked })} />
            <AssignmentToggle label="Tự động phân công phụ xe" checked={form.autoAssignAssistant} onChange={(event) => updateForm({ autoAssignAssistant: event.target.checked })} />
          </div>

          <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-200 pt-5">
            <button type="button" onClick={generate} disabled={isGenerating} className="inline-flex h-11 items-center gap-2 rounded-lg bg-emerald-500 px-5 text-sm font-black text-emerald-950 disabled:opacity-50">
              {previewRows.length ? <RefreshCw size={18} /> : <Sparkles size={18} />} {isGenerating ? 'Đang sinh ca...' : previewRows.length ? 'Sinh lại' : 'Sinh ca'}
            </button>
            <button type="button" onClick={() => navigate('/admin/shifts')} className={`inline-flex h-11 items-center gap-2 rounded-lg border px-5 text-sm font-black ${panelClass}`}><X size={18} /> Hủy</button>
          </div>
        </section>

        {previewRows.length ? (
          <section className={`mt-5 border ${panelClass}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
              <div>
                <h2 className="text-lg font-black">Danh sách ca xem trước</h2>
                <p className={`mt-1 text-xs ${mutedClass}`}>Chỉnh trực tiếp từng dòng trước khi lưu.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-700">{summary.total} ca</span>
                <span className="rounded-md bg-emerald-100 px-3 py-2 text-emerald-800">{summary.valid} hợp lệ</span>
                <span className="rounded-md bg-amber-100 px-3 py-2 text-amber-800">{summary.manual} cần phân công</span>
                <span className="rounded-md bg-rose-100 px-3 py-2 text-rose-800">{summary.conflict} xung đột</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1600px] w-full border-collapse text-left text-xs">
                <thead className={isDarkMode ? 'bg-white/[0.05]' : 'bg-slate-50'}>
                  <tr>{['Mã ca', 'Tuyến', 'Ngày', 'Bắt đầu', 'Kết thúc', 'Xe', 'Tài xế', 'Phụ xe', 'Chuyến', 'Trạng thái', 'Cảnh báo', 'Thao tác'].map((label) => <th key={label} className="border-b border-slate-200 px-3 py-3 font-black uppercase text-slate-500">{label}</th>)}</tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr key={row.previewId} className="border-b border-slate-200 align-top">
                      <td className="px-3 py-3"><input className={`${inputClass} min-w-48`} value={row.shiftCode} onChange={(event) => updateRow(row.previewId, { shiftCode: event.target.value })} /></td>
                      <td className="min-w-48 px-3 py-4 font-bold">{row.route?.routeCode}<span className={`mt-1 block font-normal ${mutedClass}`}>{row.route?.routeName}</span></td>
                      <td className="px-3 py-3"><input type="date" className={`${inputClass} min-w-36`} value={row.workDate} onChange={(event) => updateRow(row.previewId, { workDate: event.target.value })} /></td>
                      <td className="px-3 py-3"><input type="time" className={`${inputClass} min-w-28`} value={row.startTime} onChange={(event) => updateRow(row.previewId, { startTime: event.target.value })} /></td>
                      <td className="px-3 py-3"><input type="time" className={`${inputClass} min-w-28`} value={row.endTime} onChange={(event) => updateRow(row.previewId, { endTime: event.target.value })} /></td>
                      <td className="px-3 py-3"><select className={`${inputClass} min-w-44`} value={getId(row.vehicleId)} onChange={(event) => updateRow(row.previewId, { vehicleId: event.target.value })}><option value="">Chọn xe</option>{(row.availableVehicles || []).map((item) => <option key={item._id} value={item._id}>{item.busCode} · {item.plateNumber}</option>)}</select></td>
                      <td className="px-3 py-3"><select className={`${inputClass} min-w-44`} value={getId(row.driverId)} onChange={(event) => updateRow(row.previewId, { driverId: event.target.value })}><option value="">Chọn tài xế</option>{(row.availableDrivers || []).map((item) => <option key={item._id} value={item._id}>{item.fullName}</option>)}</select></td>
                      <td className="px-3 py-3"><select className={`${inputClass} min-w-44`} value={getId(row.assistantId)} onChange={(event) => updateRow(row.previewId, { assistantId: event.target.value })}><option value="">Chọn phụ xe</option>{(row.availableAssistants || []).map((item) => <option key={item._id} value={item._id}>{item.fullName}</option>)}</select></td>
                      <td className="min-w-56 px-3 py-3"><div className="max-h-32 space-y-2 overflow-y-auto">{(row.availableTrips || []).map((trip) => <label key={trip._id} className="flex items-start gap-2"><input type="checkbox" checked={row.tripIds.some((id) => getId(id) === getId(trip))} onChange={() => selectTrip(row, trip._id)} /><span>{trip.scheduleCode}<small className={`block ${mutedClass}`}>{trip.departureTime}-{trip.expectedArrivalTime}</small></span></label>)}</div></td>
                      <td className="px-3 py-4"><span className={`inline-block rounded-md px-2 py-1 font-black ${statusClasses[row.status]}`}>{statusLabels[row.status]}</span></td>
                      <td className="min-w-56 px-3 py-4 text-rose-500">{row.warningMessage || (row.status === 'VALID' ? 'Không có cảnh báo.' : 'Cần hoàn tất phân công.')}</td>
                      <td className="px-3 py-3"><button type="button" onClick={() => setPreviewRows((current) => current.filter((item) => item.previewId !== row.previewId))} className="h-11 rounded-lg border border-rose-200 px-3 font-bold text-rose-600">Xóa</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {blockingReasons.length ? (
              <div className="mx-4 mt-4 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-black">Chưa thể lưu vì:</p>
                <ul className="mt-2 space-y-1">
                  {blockingReasons.map((reason) => <li key={reason}>- {reason}</li>)}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-wrap justify-end gap-3 p-4">
              <button type="button" onClick={() => setPreviewRows([])} className={`inline-flex h-11 items-center gap-2 rounded-lg border px-5 text-sm font-black ${panelClass}`}><X size={18} /> Hủy bản xem trước</button>
              <button type="button" onClick={confirm} disabled={isConfirming || isPreviewStale || summary.conflict > 0 || summary.manual > 0} className="inline-flex h-11 items-center gap-2 rounded-lg bg-cyan-400 px-5 text-sm font-black text-cyan-950 disabled:cursor-not-allowed disabled:opacity-40">
                {isConfirming ? <RefreshCw className="animate-spin" size={18} /> : summary.valid === previewRows.length ? <Check size={18} /> : <Save size={18} />} Xác nhận lưu
              </button>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
};

export default AutoGenerateShiftPage;
