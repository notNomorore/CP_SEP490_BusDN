import React, { useEffect, useMemo, useState } from 'react';
import RouteMapEditor from '../../components/map-editor/RouteMapEditor.jsx';
import {
  buildStopSignature,
  buildSuggestedStops,
  normalizeSearch,
  routeStreetPath,
} from './routeWorkflowUtils.js';
import { useRouteWorkflowStore } from './routeWorkflowStore.js';

const directionTabs = [
  { key: 'outboundRoute', label: 'Chiều đi' },
  { key: 'inboundRoute', label: 'Chiều về' },
];

const isRealTransitStation = (station) => (
  station.source !== 'MANUAL'
  || Boolean(station.sourceId)
  || Boolean(station.googlePlaceId)
);

const DefinePathStep = ({ inputClassName, panelClassName, stations, isDarkMode }) => {
  const [stationQuery, setStationQuery] = useState('');
  const [selectedStopIndex, setSelectedStopIndex] = useState(null);
  const [terminalCorridors, setTerminalCorridors] = useState({
    outboundRoute: null,
    inboundRoute: null,
  });
  const [corridorStatus, setCorridorStatus] = useState({
    outboundRoute: 'idle',
    inboundRoute: 'idle',
  });
  const draft = useRouteWorkflowStore((state) => state.draft);
  const activeDirection = useRouteWorkflowStore((state) => state.activeDirection);
  const setActiveDirection = useRouteWorkflowStore((state) => state.setActiveDirection);
  const addStationStop = useRouteWorkflowStore((state) => state.addStationStop);
  const addMapStop = useRouteWorkflowStore((state) => state.addMapStop);
  const updateStop = useRouteWorkflowStore((state) => state.updateStop);
  const updateDirectionPath = useRouteWorkflowStore((state) => state.updateDirectionPath);
  const normalizeDirectionOrder = useRouteWorkflowStore((state) => state.normalizeDirectionOrder);
  const removeStop = useRouteWorkflowStore((state) => state.removeStop);
  const reorderStops = useRouteWorkflowStore((state) => state.reorderStops);
  const duplicateReverseDirection = useRouteWorkflowStore((state) => state.duplicateReverseDirection);
  const replaceDirectionStations = useRouteWorkflowStore((state) => state.replaceDirectionStations);
  const setActiveStep = useRouteWorkflowStore((state) => state.setActiveStep);
  const direction = draft[activeDirection];
  const [routingStatus, setRoutingStatus] = useState({
    outboundRoute: 'idle',
    inboundRoute: 'idle',
  });
  const outboundSignature = useMemo(
    () => buildStopSignature(draft.outboundRoute.orderedStops),
    [draft.outboundRoute.orderedStops]
  );
  const inboundSignature = useMemo(
    () => buildStopSignature(draft.inboundRoute.orderedStops),
    [draft.inboundRoute.orderedStops]
  );
  const terminalSignature = useMemo(() => ({
    outboundRoute: buildStopSignature([draft.outboundRoute.startStation, draft.outboundRoute.endStation].filter(Boolean)),
    inboundRoute: buildStopSignature([draft.inboundRoute.startStation, draft.inboundRoute.endStation].filter(Boolean)),
  }), [
    draft.outboundRoute.startStation,
    draft.outboundRoute.endStation,
    draft.inboundRoute.startStation,
    draft.inboundRoute.endStation,
  ]);

  const stationResults = useMemo(() => {
    const query = normalizeSearch(stationQuery);
    if (!query) return [];
    return stations
      .filter((station) => station.isActive !== false)
      .filter(isRealTransitStation)
      .filter((station) => [
        station.stationName,
        station.stationCode,
        station.address,
        station.district,
        station.ward,
      ].some((value) => normalizeSearch(value).includes(query)))
      .slice(0, 24);
  }, [stationQuery, stations]);

  useEffect(() => {
    normalizeDirectionOrder();
  }, [inboundSignature, normalizeDirectionOrder, outboundSignature]);

  const suggestedStops = useMemo(() => buildSuggestedStops({
    direction,
    stations,
    corridorPath: terminalCorridors[activeDirection]?.polylinePath,
  }), [activeDirection, direction, stations, terminalCorridors]);

  const addSuggestedRoute = () => {
    const startStation = stations.find((station) => station._id === direction.startStation?.stationId);
    const endStation = stations.find((station) => station._id === direction.endStation?.stationId);
    replaceDirectionStations(activeDirection, [startStation, ...suggestedStops, endStation]);
    setSelectedStopIndex(null);
  };

  useEffect(() => {
    const directionEntries = [
      ['outboundRoute', draft.outboundRoute, terminalSignature.outboundRoute],
      ['inboundRoute', draft.inboundRoute, terminalSignature.inboundRoute],
    ];
    const controllers = [];

    directionEntries.forEach(([directionKey, routeDirection, signature]) => {
      if (!signature || !routeDirection.startStation || !routeDirection.endStation) {
        setCorridorStatus((current) => ({ ...current, [directionKey]: 'idle' }));
        setTerminalCorridors((current) => ({ ...current, [directionKey]: null }));
        return;
      }

      const controller = new AbortController();
      controllers.push(controller);
      setCorridorStatus((current) => ({ ...current, [directionKey]: 'loading' }));

      routeStreetPath([routeDirection.startStation, routeDirection.endStation], {
        signal: controller.signal,
      }).then((pathUpdate) => {
        setTerminalCorridors((current) => ({ ...current, [directionKey]: pathUpdate }));
        setCorridorStatus((current) => ({ ...current, [directionKey]: 'ready' }));
      }).catch((error) => {
        if (error.name !== 'AbortError') {
          setTerminalCorridors((current) => ({ ...current, [directionKey]: null }));
          setCorridorStatus((current) => ({ ...current, [directionKey]: 'error' }));
        }
      });
    });

    return () => {
      controllers.forEach((controller) => controller.abort());
    };
  }, [
    draft.inboundRoute,
    draft.outboundRoute,
    terminalSignature.inboundRoute,
    terminalSignature.outboundRoute,
  ]);

  useEffect(() => {
    const directionEntries = [
      ['outboundRoute', draft.outboundRoute, outboundSignature],
      ['inboundRoute', draft.inboundRoute, inboundSignature],
    ];
    const controllers = [];
    const timeouts = [];

    directionEntries.forEach(([directionKey, routeDirection, signature]) => {
      if (!signature || routeDirection.orderedStops.length < 2) {
        setRoutingStatus((current) => ({ ...current, [directionKey]: 'idle' }));
        return;
      }

      const controller = new AbortController();
      controllers.push(controller);
      setRoutingStatus((current) => ({ ...current, [directionKey]: 'loading' }));

      const timeoutId = window.setTimeout(async () => {
        try {
          const pathUpdate = await routeStreetPath(routeDirection.orderedStops, {
            signal: controller.signal,
          });
          updateDirectionPath(directionKey, pathUpdate);
          setRoutingStatus((current) => ({ ...current, [directionKey]: 'ready' }));
        } catch (error) {
          if (error.name !== 'AbortError') {
            setRoutingStatus((current) => ({ ...current, [directionKey]: 'error' }));
          }
        }
      }, 450);
      timeouts.push(timeoutId);
    });

    return () => {
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      controllers.forEach((controller) => controller.abort());
    };
  }, [
    inboundSignature,
    outboundSignature,
    updateDirectionPath,
  ]);

  const activeCorridorStatus = corridorStatus[activeDirection];
  const suggestionHint = activeCorridorStatus === 'loading'
    ? 'Đang tính đường chạy thực tế giữa hai bến.'
    : activeCorridorStatus === 'ready'
      ? 'Gợi ý trạm thật nằm gần đường chạy thực tế, đã sắp theo thứ tự tuyến.'
      : 'Gợi ý trạm thật gần hành lang tuyến; có thể tìm thủ công nếu cần.';

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(320px,30%)_minmax(0,70%)]">
      <aside className={`rounded-2xl border p-5 ${panelClassName}`}>
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-500">Bước 2</p>
        <h2 className="mt-3 text-2xl font-black">Dựng lộ trình tuyến</h2>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {directionTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveDirection(tab.key);
                setSelectedStopIndex(null);
              }}
              className={`rounded-lg px-3 py-2 text-sm font-bold ${activeDirection === tab.key ? 'bg-slate-950 text-white' : 'text-slate-600'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <label className="mt-5 block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Tìm trạm</span>
          <input className={inputClassName} value={stationQuery} onChange={(event) => setStationQuery(event.target.value)} placeholder="Tên trạm, địa chỉ, phường..." />
        </label>

        {stationResults.length ? (
          <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
            {stationResults.map((station) => (
              <button
                key={station._id}
                type="button"
                onClick={() => addStationStop(activeDirection, station)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-cyan-300"
              >
                <span className="block font-bold">{station.stationName}</span>
                <span className="mt-1 block text-xs text-slate-500">{station.address}</span>
              </button>
            ))}
          </div>
        ) : stationQuery ? (
          <div className="mt-3 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Không tìm thấy trạm phù hợp.</div>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={duplicateReverseDirection} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
            Tạo chiều về đảo chiều
          </button>
          <button type="button" onClick={() => setStationQuery('')} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
            Xóa
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50/95 p-4 text-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.18em] text-cyan-700">Trạm gợi ý</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">{suggestionHint}</p>
            </div>
            <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-cyan-700">{suggestedStops.length}</span>
          </div>

          {direction.startStation && direction.endStation ? (
            suggestedStops.length ? (
              <>
                <button
                  type="button"
                  onClick={addSuggestedRoute}
                  className="mt-4 w-full rounded-xl bg-cyan-400 px-3 py-2 text-sm font-black text-slate-950"
                >
                  Thay bằng lộ trình gợi ý
                </button>
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {suggestedStops.map((station, index) => (
                    <button
                      key={station._id}
                      type="button"
                      onClick={() => addStationStop(activeDirection, station)}
                      className="w-full rounded-xl border border-cyan-100 bg-white px-3 py-2 text-left text-sm hover:border-cyan-300"
                    >
                      <span className="text-xs font-black text-cyan-600">#{index + 1}</span>
                      <span className="ml-2 font-bold text-slate-900">{station.stationName}</span>
                      <span className="mt-1 block text-xs text-slate-500">
                        Cách đường chạy {station.corridorDistanceKm.toFixed(2)} km - {station.address}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-cyan-200 bg-white/80 p-4 text-sm text-slate-600">
                Chưa tìm thấy trạm thật nằm gần đường chạy này. Hãy tìm trạm thủ công hoặc điều chỉnh bến đầu/cuối.
              </div>
            )
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-cyan-200 bg-white/80 p-4 text-sm text-slate-600">
              Cần chọn bến đầu và bến cuối ở bước 1 để có gợi ý trạm đi qua.
            </div>
          )}
        </div>

        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-[0.18em]">Danh sách trạm</h3>
            <span className="text-xs font-bold text-slate-500">{direction.orderedStops.length} trạm</span>
          </div>
          <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {direction.orderedStops.length ? direction.orderedStops.map((stop, index) => {
              const duplicate = direction.orderedStops.some((item, itemIndex) => itemIndex !== index && (
                (item.stationId && item.stationId === stop.stationId)
                || `${Number(item.latitude).toFixed(5)}:${Number(item.longitude).toFixed(5)}` === `${Number(stop.latitude).toFixed(5)}:${Number(stop.longitude).toFixed(5)}`
              ));
              return (
                <div key={`${stop.stopName}-${index}`} className={`rounded-xl border p-3 text-slate-900 ${duplicate ? 'border-amber-300 bg-amber-50' : selectedStopIndex === index ? 'border-cyan-300 bg-cyan-50' : 'border-slate-200 bg-white'}`}>
                  <button type="button" onClick={() => setSelectedStopIndex(index)} className="w-full text-left">
                    <span className="text-xs font-black text-slate-400">#{index + 1}</span>
                    <span className="ml-2 text-sm font-bold text-slate-900">{stop.stopName}</span>
                    <span className="mt-1 block text-xs text-slate-500">{Number(stop.latitude).toFixed(6)}, {Number(stop.longitude).toFixed(6)}</span>
                  </button>
                  <div className="mt-3 flex gap-2">
                    <button type="button" disabled={index === 0} onClick={() => reorderStops(activeDirection, index, index - 1)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold disabled:opacity-40">Lên</button>
                    <button type="button" disabled={index === direction.orderedStops.length - 1} onClick={() => reorderStops(activeDirection, index, index + 1)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold disabled:opacity-40">Xuống</button>
                    <button type="button" onClick={() => removeStop(activeDirection, index)} className="ml-auto rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-600">Xóa</button>
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Tìm trạm hoặc bấm trực tiếp lên bản đồ Đà Nẵng để bắt đầu.
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className={`rounded-2xl border p-5 ${panelClassName}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-black">Bản đồ chỉnh lộ trình</h3>
            <p className="mt-1 text-sm text-slate-500">Tự nối theo mạng lưới đường phố, kéo marker để chỉnh vị trí, lộ trình được tính theo đúng thứ tự trạm.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-right text-sm">
            <span className="rounded-xl border border-slate-200 px-3 py-2 font-bold">{direction.estimatedDistanceKm || 0} km</span>
            <span className="rounded-xl border border-slate-200 px-3 py-2 font-bold">{direction.estimatedDurationMinutes || 0} phút</span>
          </div>
        </div>
        <RouteMapEditor
          activeDirection={activeDirection}
          direction={direction}
          isDarkMode={isDarkMode}
          routeColor={draft.routeColor}
          stations={stationResults}
          showStationLayer={Boolean(stationQuery)}
          onAddMapStop={addMapStop}
          onAddStationStop={addStationStop}
          onSelectStop={setSelectedStopIndex}
          onUpdateStop={updateStop}
          routingStatus={routingStatus[activeDirection]}
          selectedStopIndex={selectedStopIndex}
        />
        <div className="mt-5 flex justify-between">
          <button type="button" onClick={() => setActiveStep(0)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold">Quay lại</button>
          <button type="button" onClick={() => setActiveStep(2)} className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950">Tiếp tục đến lịch chạy</button>
        </div>
      </div>
    </section>
  );
};

export default DefinePathStep;
