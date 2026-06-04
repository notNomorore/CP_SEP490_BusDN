import React from 'react';
import { operatingDayLabels, operatingDayOptions, validateRouteDraft } from './routeWorkflowUtils.js';
import { useRouteWorkflowStore } from './routeWorkflowStore.js';

const holidayModeOptions = [
  { value: 'NORMAL', label: 'Chạy như ngày thường' },
  { value: 'SUNDAY', label: 'Dùng lịch Chủ nhật' },
  { value: 'REDUCED', label: 'Giãn cách chuyến' },
  { value: 'SPECIAL', label: 'Khung giờ riêng' },
  { value: 'SUSPENDED', label: 'Tạm dừng tuyến' },
  { value: 'CUSTOM', label: 'Quy định riêng' },
];

const parseHolidaySchedule = (value = '') => {
  const text = String(value || '').trim();
  const frequency = text.match(/tần suất\s+(\d+)/i)?.[1] || text.match(/giãn cách\s+(\d+)/i)?.[1] || '20';
  const startTime = text.match(/từ\s+(\d{2}:\d{2})/i)?.[1] || '06:00';
  const endTime = text.match(/đến\s+(\d{2}:\d{2})/i)?.[1] || '20:00';
  const note = text.match(/Ghi chú:\s*(.+)$/i)?.[1] || '';

  if (!text) return { mode: 'NORMAL', frequency, startTime, endTime, note: '' };
  if (/tạm dừng|không chạy/i.test(text)) return { mode: 'SUSPENDED', frequency, startTime, endTime, note };
  if (/chủ nhật/i.test(text)) return { mode: 'SUNDAY', frequency, startTime, endTime, note };
  if (/khung giờ|từ\s+\d{2}:\d{2}/i.test(text)) return { mode: 'SPECIAL', frequency, startTime, endTime, note };
  if (/giãn cách|tần suất/i.test(text)) return { mode: 'REDUCED', frequency, startTime, endTime, note };
  if (/ngày thường/i.test(text)) return { mode: 'NORMAL', frequency, startTime, endTime, note };
  return { mode: 'CUSTOM', frequency, startTime, endTime, note: text };
};

const buildHolidaySchedule = ({ mode, frequency, startTime, endTime, note }) => {
  const cleanFrequency = Math.max(1, Number(frequency || 20));
  const cleanStartTime = startTime || '06:00';
  const cleanEndTime = endTime || '20:00';
  const cleanNote = String(note || '').trim();
  const baseText = {
    NORMAL: 'Ngày lễ chạy như lịch ngày thường.',
    SUNDAY: 'Ngày lễ dùng lịch Chủ nhật.',
    REDUCED: `Ngày lễ chạy giãn cách ${cleanFrequency} phút/chuyến.`,
    SPECIAL: `Ngày lễ chạy từ ${cleanStartTime} đến ${cleanEndTime}, tần suất ${cleanFrequency} phút/chuyến.`,
    SUSPENDED: 'Tạm dừng tuyến vào ngày lễ/Tết.',
    CUSTOM: cleanNote || 'Quy định riêng cho ngày lễ/ngày đặc biệt.',
  }[mode] || 'Ngày lễ chạy như lịch ngày thường.';

  return cleanNote && mode !== 'CUSTOM' ? `${baseText} Ghi chú: ${cleanNote}` : baseText;
};

const ConfigureScheduleStep = ({ inputClassName, panelClassName }) => {
  const draft = useRouteWorkflowStore((state) => state.draft);
  const updateSchedule = useRouteWorkflowStore((state) => state.updateSchedule);
  const updateVehicle = useRouteWorkflowStore((state) => state.updateVehicle);
  const setActiveStep = useRouteWorkflowStore((state) => state.setActiveStep);
  const validation = validateRouteDraft(draft);

  const toggleDay = (day) => {
    const exists = draft.scheduleConfig.operatingDays.includes(day);
    updateSchedule({
      operatingDays: exists
        ? draft.scheduleConfig.operatingDays.filter((item) => item !== day)
        : [...draft.scheduleConfig.operatingDays, day],
    });
  };

  const frequencyBlocks = [
    { label: 'Cao điểm', value: Number(draft.scheduleConfig.peakFrequencyMinutes || 0), color: 'bg-emerald-400' },
    { label: 'Thấp điểm', value: Number(draft.scheduleConfig.offPeakFrequencyMinutes || 0), color: 'bg-cyan-400' },
    { label: 'Nghỉ đầu cuối', value: Number(draft.scheduleConfig.layoverMinutes || 0), color: 'bg-amber-400' },
  ];

  const scheduleErrors = validation.errors.filter((error) => error.includes('Chuyến') || error.includes('Tần suất') || error.includes('ngày'));

  const holidayConfig = parseHolidaySchedule(draft.scheduleConfig.holidaySchedule);
  const holidayInputClassName = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-amber-300';
  const updateHolidayConfig = (patch) => {
    updateSchedule({
      holidaySchedule: buildHolidaySchedule({
        ...holidayConfig,
        ...patch,
      }),
    });
  };

  return (
    <section className={`rounded-2xl border p-6 ${panelClassName}`}>
      <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-500">Bước 3</p>
      <h2 className="mt-3 text-3xl font-black">Cấu hình lịch chạy</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
        Thiết lập ngày hoạt động, khung giờ khai thác, tần suất và nguồn lực tối thiểu cho tuyến.
      </p>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <span className="mb-3 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Ngày hoạt động</span>
            <div className="flex flex-wrap gap-2">
              {operatingDayOptions.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`rounded-xl px-4 py-3 text-sm font-black ${draft.scheduleConfig.operatingDays.includes(day) ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
                >
                  {operatingDayLabels[day]}
                </button>
              ))}
            </div>
          </div>
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Giờ chuyến đầu</span>
            <input type="time" className={inputClassName} value={draft.scheduleConfig.firstDepartureTime} onChange={(event) => updateSchedule({ firstDepartureTime: event.target.value })} />
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Giờ chuyến cuối</span>
            <input type="time" className={inputClassName} value={draft.scheduleConfig.lastDepartureTime} onChange={(event) => updateSchedule({ lastDepartureTime: event.target.value })} />
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Tần suất cao điểm</span>
            <input type="number" min="1" className={inputClassName} value={draft.scheduleConfig.peakFrequencyMinutes} onChange={(event) => updateSchedule({ peakFrequencyMinutes: event.target.value })} />
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Tần suất thấp điểm</span>
            <input type="number" min="1" className={inputClassName} value={draft.scheduleConfig.offPeakFrequencyMinutes} onChange={(event) => updateSchedule({ offPeakFrequencyMinutes: event.target.value })} />
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Thời gian nghỉ đầu cuối</span>
            <input type="number" min="0" className={inputClassName} value={draft.scheduleConfig.layoverMinutes} onChange={(event) => updateSchedule({ layoverMinutes: event.target.value })} />
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Số xe dự kiến</span>
            <input type="number" min="1" className={inputClassName} value={draft.vehicleAssignment.estimatedFleetSize} onChange={(event) => updateVehicle({ estimatedFleetSize: event.target.value, capacity: Number(event.target.value || 0) * 60 })} />
          </label>
          <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white/90 p-4 text-slate-900">
            <div className="grid gap-3 md:grid-cols-3">
              <label>
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Ngày lễ / đặc biệt</span>
                <select className={holidayInputClassName} value={holidayConfig.mode} onChange={(event) => updateHolidayConfig({ mode: event.target.value })}>
                  {holidayModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              {['REDUCED', 'SPECIAL'].includes(holidayConfig.mode) ? (
                <label>
                  <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Tần suất lễ</span>
                  <input type="number" min="1" className={holidayInputClassName} value={holidayConfig.frequency} onChange={(event) => updateHolidayConfig({ frequency: event.target.value })} />
                </label>
              ) : null}
              {holidayConfig.mode === 'SPECIAL' ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <label>
                    <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Từ</span>
                    <input type="time" className={holidayInputClassName} value={holidayConfig.startTime} onChange={(event) => updateHolidayConfig({ startTime: event.target.value })} />
                  </label>
                  <label>
                    <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Đến</span>
                    <input type="time" className={holidayInputClassName} value={holidayConfig.endTime} onChange={(event) => updateHolidayConfig({ endTime: event.target.value })} />
                  </label>
                </div>
              ) : null}
            </div>
            <label className="mt-3 block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Ghi chú áp dụng</span>
              <textarea rows={3} className={holidayInputClassName} value={holidayConfig.note} onChange={(event) => updateHolidayConfig({ note: event.target.value })} placeholder="VD: Áp dụng cho 30/4, 1/5, Tết Dương lịch hoặc theo thông báo điều hành." />
            </label>
            <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
              {draft.scheduleConfig.holidaySchedule || 'Ngày lễ chạy như lịch ngày thường.'}
            </div>
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-900">
          <h3 className="text-lg font-black">Biểu đồ tần suất</h3>
          <div className="mt-5 space-y-4">
            {frequencyBlocks.map((block) => (
              <div key={block.label}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-bold text-slate-700">{block.label}</span>
                  <span className="text-slate-500">{block.value || 0} phút</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white">
                  <div className={`h-full rounded-full ${block.color}`} style={{ width: `${Math.max(8, Math.min(100, 120 - (block.value || 0) * 3))}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-3 text-sm">
            <div className="rounded-xl bg-white p-4 text-slate-900">
              <span className="text-slate-500">Số chuyến/ngày dự kiến</span>
              <strong className="mt-1 block text-2xl text-slate-950">{validation.dailyTrips}</strong>
            </div>
            <div className="rounded-xl bg-white p-4 text-slate-900">
              <span className="text-slate-500">Sức chứa đội xe dự kiến</span>
              <strong className="mt-1 block text-2xl text-slate-950">{Number(draft.vehicleAssignment.capacity || 0)}</strong>
            </div>
          </div>
          {scheduleErrors.length ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {scheduleErrors[0]}
            </div>
          ) : null}
        </aside>
      </div>

      <div className="mt-8 flex justify-between">
        <button type="button" onClick={() => setActiveStep(1)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold">Quay lại</button>
        <button type="button" onClick={() => setActiveStep(3)} className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-slate-950">Rà soát tuyến</button>
      </div>
    </section>
  );
};

export default ConfigureScheduleStep;
