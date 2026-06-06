import React, { useState } from 'react';
import RouteMapEditor from '../../components/map-editor/RouteMapEditor.jsx';
import adminService from '../../services/adminService.js';
import {
  prepareRoutePayload,
  routeStatusLabels,
  validateRouteDraft,
} from './routeWorkflowUtils.js';
import { useRouteWorkflowStore } from './routeWorkflowStore.js';

const ReviewRouteStep = ({ panelClassName, isDarkMode, onSaved }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const draft = useRouteWorkflowStore((state) => state.draft);
  const selectedRouteId = useRouteWorkflowStore((state) => state.selectedRouteId);
  const loadRoute = useRouteWorkflowStore((state) => state.loadRoute);
  const setActiveStep = useRouteWorkflowStore((state) => state.setActiveStep);
  const addMapStop = useRouteWorkflowStore((state) => state.addMapStop);
  const addStationStop = useRouteWorkflowStore((state) => state.addStationStop);
  const updateStop = useRouteWorkflowStore((state) => state.updateStop);
  const validation = validateRouteDraft(draft);

  const saveRoute = async (status) => {
    setIsSaving(true);
    setMessage('');
    try {
      const payload = prepareRoutePayload(draft, status);
      const response = selectedRouteId
        ? await adminService.updateRoute(selectedRouteId, payload)
        : await adminService.createRoute(payload);
      loadRoute(response.route);
      onSaved?.();
      setMessage(status === 'PUBLISHED' ? 'Đã kích hoạt tuyến.' : 'Đã lưu bản nháp.');
    } catch (error) {
      setMessage(error?.message || 'Không thể lưu tuyến. Vui lòng kiểm tra lại dữ liệu.');
    } finally {
      setIsSaving(false);
    }
  };

  const suspendRoute = async () => {
    if (!selectedRouteId) return;
    setIsSaving(true);
    setMessage('');
    try {
      const response = await adminService.suspendRoute(selectedRouteId, { reason: 'Tạm dừng bởi quản trị viên' });
      loadRoute(response.route);
      onSaved?.();
      setMessage('Đã tạm dừng tuyến.');
    } catch (error) {
      setMessage(error?.message || 'Không thể tạm dừng tuyến.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className={`rounded-2xl border p-6 ${panelClassName}`}>
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-500">Bước 4</p>
        <h2 className="mt-3 text-3xl font-black">Rà soát và kích hoạt</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Kiểm tra cuối trước khi lưu nháp, gửi duyệt, công bố hoặc tạm dừng tuyến. Dữ liệu ở bước này là bản tổng hợp của toàn bộ quy trình.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {[
            ['Số trạm', validation.totalStops],
            ['Tổng quãng đường', `${validation.totalDistance} km`],
            ['Thời gian dự kiến', `${validation.totalDuration} phút`],
            ['Trạng thái', routeStatusLabels[draft.status] || draft.status],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</span>
              <strong className="mt-2 block text-2xl text-slate-950">{value}</strong>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <RouteMapEditor
            activeDirection="outboundRoute"
            direction={draft.outboundRoute}
            isDarkMode={isDarkMode}
            routeColor={draft.routeColor}
            stations={[]}
            showStationLayer={false}
            onAddMapStop={addMapStop}
            onAddStationStop={addStationStop}
            onSelectStop={() => {}}
            onUpdateStop={updateStop}
            selectedStopIndex={null}
          />
        </div>
      </div>

      <aside className={`rounded-2xl border p-5 ${panelClassName}`}>
        <h3 className="text-xl font-black">Danh sách kiểm tra</h3>
        <div className="mt-5 space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-black uppercase tracking-[0.18em] text-rose-500">Lỗi</span>
              <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-bold text-rose-600">{validation.errors.length}</span>
            </div>
            {validation.errors.length ? validation.errors.map((error) => (
              <div key={error} className="mb-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
            )) : (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">Không có lỗi bắt buộc.</div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-black uppercase tracking-[0.18em] text-amber-500">Cảnh báo</span>
              <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-600">{validation.warnings.length}</span>
            </div>
            {validation.warnings.length ? validation.warnings.slice(0, 5).map((warning) => (
              <div key={warning} className="mb-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">{warning}</div>
            )) : (
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-500">Không có cảnh báo lớn.</div>
            )}
          </div>

          {validation.canPublish ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="font-black">Phân tích vận hành</h4>
              <div className="mt-3 grid gap-3 text-sm">
                <div className="flex justify-between"><span>Chuyến/ngày</span><strong>{validation.dailyTrips}</strong></div>
                <div className="flex justify-between"><span>Sức chứa/ngày</span><strong>{validation.dailyTrips * Number(draft.vehicleAssignment.capacity || 0)}</strong></div>
                <div className="flex justify-between"><span>Phạm vi phủ tuyến</span><strong>{validation.totalDistance} km</strong></div>
              </div>
            </div>
          ) : null}
        </div>

        {message ? <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">{message}</div> : null}

        <div className="mt-6 grid gap-3">
          <button type="button" disabled={isSaving} onClick={() => saveRoute('DRAFT')} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold disabled:opacity-60">Lưu bản nháp</button>
          <button type="button" disabled={isSaving || !validation.canPublish} onClick={() => saveRoute('PENDING_APPROVAL')} className="rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50">Gửi duyệt tuyến</button>
          <button type="button" disabled={isSaving || !validation.canPublish} onClick={() => saveRoute('PUBLISHED')} className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50">Kích hoạt tuyến</button>
          <button type="button" disabled={isSaving || !selectedRouteId || draft.status === 'SUSPENDED'} onClick={suspendRoute} className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-600 disabled:opacity-50">Tạm dừng tuyến</button>
          <button type="button" onClick={() => setActiveStep(2)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">Quay lại lịch chạy</button>
        </div>
      </aside>
    </section>
  );
};

export default ReviewRouteStep;
