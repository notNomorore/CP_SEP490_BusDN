import React from 'react';
import { operatingDayLabels, operatingDayOptions, validateRouteDraft } from './routeWorkflowUtils.js';
import { useRouteWorkflowStore } from './routeWorkflowStore.js';

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
