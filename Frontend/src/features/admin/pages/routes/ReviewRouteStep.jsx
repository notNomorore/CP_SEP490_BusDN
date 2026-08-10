import React, { useState } from 'react';
import RouteMapEditor from '../../components/map-editor/RouteMapEditor.jsx';
import adminService from '../../services/adminService.js';
import {
  prepareRoutePayload,
  routeStatusLabels,
  validateRouteDraft,
} from './routeWorkflowUtils.js';
import { useRouteWorkflowStore } from './routeWorkflowStore.js';

const ReviewRouteStep = ({ panelClassName, isDarkMode, onSaved, routes }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const draft = useRouteWorkflowStore((state) => state.draft);
  const selectedRouteId = useRouteWorkflowStore((state) => state.selectedRouteId);
  const selectedRouteCode = useRouteWorkflowStore((state) => state.selectedRouteCode);
  const loadRoute = useRouteWorkflowStore((state) => state.loadRoute);
  const resetDraft = useRouteWorkflowStore((state) => state.resetDraft);
  const setActiveStep = useRouteWorkflowStore((state) => state.setActiveStep);
  const addMapStop = useRouteWorkflowStore((state) => state.addMapStop);
  const addStationStop = useRouteWorkflowStore((state) => state.addStationStop);
  const updateStop = useRouteWorkflowStore((state) => state.updateStop);
  const baseValidation = validateRouteDraft(draft);
  const duplicateRoute = routes.find((route) => (
    String(route._id || '') !== String(selectedRouteId || '')
    && String(route.routeCode || '').trim().toUpperCase() === draft.routeCode.trim().toUpperCase()
  ));
  const validation = duplicateRoute
    ? { ...baseValidation, canPublish: false, errors: [`Mã tuyến ${draft.routeCode.trim().toUpperCase()} đã tồn tại.` , ...baseValidation.errors] }
    : baseValidation;

  const saveRoute = async (status) => {
    if (duplicateRoute) {
      setMessage(`Mã tuyến ${draft.routeCode.trim().toUpperCase()} đã tồn tại. Vui lòng nhập mã khác từ Bước 1.`);
      return;
    }
    if (selectedRouteId && !selectedRouteCode) {
      setMessage('Bản nháp cũ không xác định được tuyến gốc. Hãy mở lại tuyến cần sửa hoặc chọn "Tạo tuyến mới" để tránh ghi đè dữ liệu.');
      return;
    }
    if (selectedRouteId && selectedRouteCode && draft.routeCode.trim().toUpperCase() !== selectedRouteCode.trim().toUpperCase()) {
      setMessage(`Bạn đang sửa tuyến ${selectedRouteCode}. Không thể đổi mã thành ${draft.routeCode || 'mã trống'} vì sẽ ghi đè tuyến cũ. Hãy chọn "Tạo tuyến mới".`);
      return;
    }
    if (selectedRouteId && !window.confirm(`Xác nhận cập nhật tuyến ${selectedRouteCode || draft.routeCode}?`)) return;
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

  const statusLabel = routeStatusLabels[draft.status] || draft.status;

  return (
    <section className={`overflow-hidden rounded-2xl border ${panelClassName}`}>
      <header className="border-b border-slate-200 bg-white/80 px-5 py-4 text-slate-900 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-600">Bước 3 · Kiểm tra cuối</p>
            <h2 className="mt-1.5 text-2xl font-black">Rà soát tuyến trước khi công bố</h2>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-500">Kiểm tra lộ trình và điều kiện bắt buộc trước khi đưa tuyến vào vận hành.</p>
          </div>
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
            <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-2 text-xs font-black ${validation.canPublish ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              <span className="material-symbols-outlined text-base">{validation.canPublish ? 'check_circle' : 'error'}</span>
              {validation.canPublish ? 'Sẵn sàng công bố' : 'Cần hoàn thiện'}
            </span>
            {!validation.canPublish ? <small className="max-w-xs text-right text-xs font-semibold text-amber-700">Hãy xử lý các lỗi bắt buộc trước khi xác nhận công bố.</small> : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            ['pin_drop', 'Tổng số trạm', validation.totalStops],
            ['route', 'Quãng đường', `${validation.totalDistance} km`],
            ['schedule', 'Thời gian một vòng', `${validation.totalDuration} phút`],
            ['flag', 'Trạng thái hiện tại', statusLabel],
          ].map(([icon, label, value]) => (
            <div key={label} className="flex min-h-16 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <span className="material-symbols-outlined rounded-lg bg-white p-2 text-emerald-700">{icon}</span>
              <span><small className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</small><b className="mt-1 block text-base text-slate-950">{value}</b></span>
            </div>
          ))}
        </div>
      </header>

      <div className="grid gap-4 p-4 md:p-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <div><h3 className="font-black text-slate-950">Bản đồ lộ trình chiều đi</h3><p className="text-xs text-slate-500">Kiểm tra thứ tự trạm và đường đi trước khi lưu.</p></div>
            <button type="button" onClick={() => setActiveStep(1)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">Chỉnh sửa lộ trình</button>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200">
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
              compact
            />
          </div>
        </div>

        <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-slate-900">
            <div className="flex items-center justify-between"><h3 className="font-black">Kết quả kiểm tra</h3><span className="text-xs font-bold text-slate-500">{validation.errors.length + validation.warnings.length} vấn đề</span></div>
            <div className="mt-4 space-y-2">
              {validation.errors.map((error) => <div key={error} className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div>)}
              {validation.warnings.slice(0, 5).map((warning) => <div key={warning} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">{warning}</div>)}
              {!validation.errors.length && !validation.warnings.length ? <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"><span className="material-symbols-outlined text-base">verified</span><span>Dữ liệu tuyến hợp lệ, không có lỗi hoặc cảnh báo cần xử lý.</span></div> : null}
            </div>
          </div>

          <div className={`rounded-xl border p-4 text-xs leading-5 ${selectedRouteId ? 'border-sky-200 bg-sky-50 text-sky-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
            <b className="block text-sm">{selectedRouteId ? `Đang cập nhật tuyến ${selectedRouteCode || draft.routeCode}` : 'Đang tạo tuyến mới'}</b>
            <span>{selectedRouteId ? 'Các thay đổi sẽ được áp dụng lên tuyến hiện tại sau khi xác nhận.' : 'Một tuyến độc lập sẽ được tạo sau khi xác nhận.'}</span>
          </div>

          {validation.canPublish ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs leading-5 text-emerald-900"><b className="block text-sm">Bước tiếp theo</b>Sau khi công bố, hãy sang mục Phân chuyến để thiết lập số lượt chạy và tần suất theo ngày.</div> : null}
          {message ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-700">{message}</div> : null}

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-black text-slate-950">Hoàn tất rà soát</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Lưu để tiếp tục chỉnh sửa sau hoặc xác nhận đưa tuyến vào danh sách vận hành.</p>
            <div className="mt-4 grid gap-2">
              <button type="button" disabled={isSaving} onClick={() => saveRoute('DRAFT')} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 disabled:opacity-60">
                <span className="material-symbols-outlined text-lg">save</span>
                {selectedRouteId ? 'Lưu thay đổi' : 'Lưu bản nháp'}
              </button>
              <button type="button" disabled={isSaving || !validation.canPublish} onClick={() => saveRoute('PUBLISHED')} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-black text-emerald-950 shadow-sm disabled:cursor-not-allowed disabled:opacity-40">
                <span className="material-symbols-outlined text-lg">check_circle</span>
                {isSaving ? 'Đang xử lý...' : selectedRouteId ? 'Xác nhận cập nhật' : 'Xác nhận & công bố'}
              </button>
            </div>
            {!validation.canPublish ? <p className="mt-2 text-xs font-semibold text-amber-700">Cần xử lý hết lỗi bắt buộc trước khi công bố.</p> : null}
          </div>
        </aside>
      </div>

      <footer className="sticky bottom-0 z-20 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 px-5 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:flex-row sm:items-center sm:justify-between md:px-6">
        <div className="flex flex-wrap gap-2">
          {selectedRouteId ? <button type="button" onClick={resetDraft} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold">Tạo tuyến mới</button> : null}
          <button type="button" disabled={isSaving || !selectedRouteId || draft.status === 'SUSPENDED'} onClick={suspendRoute} className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-600 disabled:opacity-40">Tạm dừng</button>
        </div>
        <button type="button" onClick={() => setActiveStep(1)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold">Quay lại chỉnh lộ trình</button>
      </footer>
    </section>
  );
};

export default ReviewRouteStep;
