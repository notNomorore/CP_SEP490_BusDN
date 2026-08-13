import React from 'react';
import { buildDefaultRouteName, normalizeSearch } from './routeWorkflowUtils.js';
import { useRouteWorkflowStore } from './routeWorkflowStore.js';

const isTerminalStation = (station) => {
  if (station.isMainStation) {
    return true;
  }

  const terminalText = normalizeSearch([
    station.stationName,
    station.address,
    station.zone,
  ].filter(Boolean).join(' '));

  return terminalText.includes('ben xe')
    || terminalText.includes('terminal')
    || terminalText.includes('bus station');
};

const TerminalPicker = ({
  label,
  placeholder,
  stations,
  selectedStation,
  onSelect,
}) => {
  const [query, setQuery] = React.useState(selectedStation?.stopName || '');
  const [isFocused, setIsFocused] = React.useState(false);
  const searchText = normalizeSearch(query);
  const options = stations
    .filter((station) => !searchText || [
      station.stationName,
      station.stationCode,
      station.address,
      station.district,
    ].some((value) => normalizeSearch(value).includes(searchText)))
    .slice(0, 50);

  React.useEffect(() => {
    if (!isFocused) {
      setQuery(selectedStation?.stopName || '');
    }
  }, [isFocused, selectedStation]);

  return (
    <div>
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{label}</span>
      <div className="relative">
        <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
        <input
          value={query}
          onFocus={() => setIsFocused(true)}
          onBlur={() => window.setTimeout(() => setIsFocused(false), 140)}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-white px-12 py-3 text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
        />
        {selectedStation && isFocused ? (
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(null);
              setQuery('');
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100"
          >
            Xóa
          </button>
        ) : null}
      </div>

      {isFocused ? (
        <div className="mt-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
          {options.length ? options.map((station) => (
            <button
              key={station._id}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(station);
                setQuery(station.stationName);
                setIsFocused(false);
              }}
              className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-emerald-50"
            >
              <span className="block font-bold text-slate-900">{station.stationName}</span>
              <span className="mt-1 block text-xs text-slate-500">{station.address}</span>
            </button>
          )) : (
            <div className="p-4 text-sm text-slate-500">
              Không tìm thấy trạm đầu/cuối phù hợp.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

const CreateRouteStep = ({ inputClassName, panelClassName, routes, stations }) => {
  const draft = useRouteWorkflowStore((state) => state.draft);
  const selectedRouteId = useRouteWorkflowStore((state) => state.selectedRouteId);
  const updateDraft = useRouteWorkflowStore((state) => state.updateDraft);
  const setTerminal = useRouteWorkflowStore((state) => state.setTerminal);
  const setActiveStep = useRouteWorkflowStore((state) => state.setActiveStep);

  const terminalOptions = stations
    .filter((station) => station.isActive !== false)
    .filter(isTerminalStation)
    .slice()
    .sort((left, right) => {
      const updatedDifference = new Date(right.updatedAt || right.createdAt || 0).getTime()
        - new Date(left.updatedAt || left.createdAt || 0).getTime();
      return updatedDifference || (left.stationName || '').localeCompare(right.stationName || '');
    });
  const suggestedRouteCode = React.useMemo(() => {
    const highestRouteNumber = routes.reduce((highest, route) => {
      const match = String(route.routeCode || '').trim().toUpperCase().match(/^DN-?(\d+)$/);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);
    return `DN-${String(highestRouteNumber + 1).padStart(2, '0')}`;
  }, [routes]);

  React.useEffect(() => {
    if (draft.outboundRoute.orderedStops.length >= 2 || !draft.outboundRoute.startStation || !draft.outboundRoute.endStation) return;
    const startId = draft.outboundRoute.startStation.stationId;
    const endId = draft.outboundRoute.endStation.stationId;
    const startStation = stations.find((item) => String(item._id) === String(startId));
    const endStation = stations.find((item) => String(item._id) === String(endId));
    if (startStation) setTerminal('start', startStation);
    if (endStation) setTerminal('end', endStation);
  }, [draft.outboundRoute.endStation, draft.outboundRoute.orderedStops.length, draft.outboundRoute.startStation, setTerminal, stations]);

  React.useEffect(() => {
    if (
      !draft.routeCode.trim()
      && draft.outboundRoute.startStation
      && draft.outboundRoute.endStation
    ) {
      updateDraft({ routeCode: suggestedRouteCode });
    }
  }, [draft.outboundRoute.endStation, draft.outboundRoute.startStation, draft.routeCode, suggestedRouteCode, updateDraft]);

  const defaultRouteName = buildDefaultRouteName(
    draft.outboundRoute.startStation,
    draft.outboundRoute.endStation
  );
  const normalizedRouteCode = draft.routeCode.trim().toUpperCase();
  const duplicateRoute = normalizedRouteCode
    ? routes.find((route) => (
      String(route._id || '') !== String(selectedRouteId || '')
      && String(route.routeCode || '').trim().toUpperCase() === normalizedRouteCode
    ))
    : null;

  return (
    <section className={`rounded-2xl border p-5 shadow-sm ${panelClassName}`}>
      <div className="max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-500">Bước 1</p>
        <h2 className="mt-1 text-2xl font-black">Tạo tuyến</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Nhập mã tuyến, chọn bến đầu và bến cuối. Nếu tên tuyến để trống, hệ thống tự đặt theo bến đầu - bến cuối.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label>
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Mã tuyến</span>
          <input
            className={`${inputClassName} ${duplicateRoute ? 'border-rose-400 focus:border-rose-500' : ''}`}
            value={draft.routeCode}
            onChange={(event) => updateDraft({ routeCode: event.target.value.toUpperCase() })}
            placeholder="VD: DN-01"
          />
          {!duplicateRoute && normalizedRouteCode ? <span className="mt-2 block text-xs font-semibold text-emerald-700">Mã tuyến có thể chỉnh sửa trước khi tiếp tục.</span> : null}
          {duplicateRoute ? <span className="mt-2 block text-xs font-bold text-rose-600">Mã tuyến {normalizedRouteCode} đã được sử dụng bởi tuyến {duplicateRoute.routeName}.</span> : null}
        </label>
        <label>
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Tên tuyến</span>
          <input className={inputClassName} value={draft.routeName} onChange={(event) => updateDraft({ routeName: event.target.value })} placeholder={defaultRouteName || 'Bến đầu - Bến cuối'} />
        </label>
        <TerminalPicker
          label="Bến đầu"
          placeholder="Chọn bến đầu"
          stations={terminalOptions}
          selectedStation={draft.outboundRoute.startStation}
          onSelect={(station) => setTerminal('start', station)}
        />
        <TerminalPicker
          label="Bến cuối"
          placeholder="Chọn bến cuối"
          stations={terminalOptions}
          selectedStation={draft.outboundRoute.endStation}
          onSelect={(station) => setTerminal('end', station)}
        />
      </div>

      <div className="mt-5 flex justify-end">
        <button type="button" title={!normalizedRouteCode ? 'Cần nhập mã tuyến' : duplicateRoute ? 'Mã tuyến đã tồn tại' : 'Sang bước dựng lộ trình'} disabled={!normalizedRouteCode || Boolean(duplicateRoute)} onClick={() => setActiveStep(1)} className="h-10 rounded-xl bg-emerald-500 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
          Lưu và tiếp tục
        </button>
      </div>
    </section>
  );
};

export default CreateRouteStep;
