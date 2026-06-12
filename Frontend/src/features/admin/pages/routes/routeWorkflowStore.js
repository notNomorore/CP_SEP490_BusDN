import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  buildDefaultRouteName,
  buildStopSignature,
  computeDirection,
  createMapStop,
  emptyRouteDraft,
  normalizeBidirectionalStopOrder,
  normalizeSearch,
  normalizeRouteFromApi,
  stationToRef,
  stationToStop,
} from './routeWorkflowUtils.js';

const reorder = (items, fromIndex, toIndex) => {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next.map((item, index) => ({ ...item, stopOrder: index + 1 }));
};

const buildStationKeys = (station) => [
  station?._id || station?.stationId || '',
  Number.isFinite(Number(station?.latitude)) && Number.isFinite(Number(station?.longitude))
    ? `${Number(station.latitude).toFixed(5)}:${Number(station.longitude).toFixed(5)}`
    : '',
  normalizeSearch(station?.stationName || station?.stopName || ''),
].filter(Boolean);

export const useRouteWorkflowStore = create(
  persist(
    (set, get) => ({
      activeStep: 0,
      activeDirection: 'outboundRoute',
      selectedRouteId: '',
      draft: emptyRouteDraft(),
      setActiveStep: (activeStep) => set({ activeStep }),
      setActiveDirection: (activeDirection) => set({ activeDirection }),
      resetDraft: () => set({ draft: emptyRouteDraft(), selectedRouteId: '', activeStep: 0 }),
      loadRoute: (route) => set({
        draft: normalizeBidirectionalStopOrder(normalizeRouteFromApi(route)),
        selectedRouteId: route?._id || '',
        activeStep: 0,
      }),
      normalizeDirectionOrder: () => set((state) => {
        const normalizedDraft = normalizeBidirectionalStopOrder(state.draft);
        const currentInboundSignature = buildStopSignature(state.draft.inboundRoute.orderedStops);
        const normalizedInboundSignature = buildStopSignature(normalizedDraft.inboundRoute.orderedStops);

        if (currentInboundSignature === normalizedInboundSignature) {
          return state;
        }

        return { draft: normalizedDraft };
      }),
      updateDraft: (patch) => set((state) => ({
        draft: {
          ...state.draft,
          ...patch,
        },
      })),
      updateSchedule: (patch) => set((state) => ({
        draft: {
          ...state.draft,
          scheduleConfig: {
            ...state.draft.scheduleConfig,
            ...patch,
          },
        },
      })),
      updateVehicle: (patch) => set((state) => ({
        draft: {
          ...state.draft,
          vehicleAssignment: {
            ...state.draft.vehicleAssignment,
            ...patch,
          },
        },
      })),
      setTerminal: (role, station) => set((state) => {
        const previousDefaultName = buildDefaultRouteName(
          state.draft.outboundRoute.startStation,
          state.draft.outboundRoute.endStation
        );
        const outboundStart = role === 'start' ? stationToRef(station) : state.draft.outboundRoute.startStation;
        const outboundEnd = role === 'end' ? stationToRef(station) : state.draft.outboundRoute.endStation;
        const inboundStart = role === 'end' ? stationToRef(station) : state.draft.inboundRoute.startStation;
        const inboundEnd = role === 'start' ? stationToRef(station) : state.draft.inboundRoute.endStation;
        const nextDefaultName = buildDefaultRouteName(outboundStart, outboundEnd);
        const shouldUseDefaultName = !state.draft.routeName?.trim()
          || state.draft.routeName.trim() === previousDefaultName;

        return {
          draft: {
            ...state.draft,
            routeName: shouldUseDefaultName ? nextDefaultName : state.draft.routeName,
            outboundRoute: {
              ...state.draft.outboundRoute,
              startStation: outboundStart,
              endStation: outboundEnd,
            },
            inboundRoute: {
              ...state.draft.inboundRoute,
              startStation: inboundStart,
              endStation: inboundEnd,
            },
          },
        };
      }),
      addStationStop: (directionKey, station) => set((state) => {
        const direction = state.draft[directionKey];
        const stationKeys = buildStationKeys(station);
        if (direction.orderedStops.some((stop) => buildStationKeys(stop).some((key) => stationKeys.includes(key)))) {
          return state;
        }
        const nextStops = [
          ...direction.orderedStops,
          stationToStop(station, direction.orderedStops.length + 1),
        ];
        const nextDirection = computeDirection({
          ...direction,
          orderedStops: nextStops,
          polylinePath: [],
          estimatedDistanceKm: 0,
          estimatedDurationMinutes: 0,
          startStation: direction.startStation || stationToRef(station),
          endStation: direction.endStation || stationToRef(station),
        });
        return {
          draft: {
            ...state.draft,
            [directionKey]: nextDirection,
          },
        };
      }),
      replaceDirectionStations: (directionKey, stations) => set((state) => {
        const direction = state.draft[directionKey];
        const uniqueStations = [];
        const seen = new Set();

        stations.filter(Boolean).forEach((station) => {
          const key = station._id || station.stationId || `${Number(station.latitude).toFixed(6)}:${Number(station.longitude).toFixed(6)}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueStations.push(station);
          }
        });

        const nextStops = uniqueStations.map((station, index) => stationToStop({
          ...station,
          _id: station._id || station.stationId,
          stationName: station.stationName || station.stopName,
        }, index + 1));

        return {
          draft: {
            ...state.draft,
            [directionKey]: computeDirection({
              ...direction,
              startStation: stationToRef(uniqueStations[0]) || direction.startStation,
              endStation: stationToRef(uniqueStations[uniqueStations.length - 1]) || direction.endStation,
              orderedStops: nextStops,
              polylinePath: [],
              estimatedDistanceKm: 0,
              estimatedDurationMinutes: 0,
            }),
          },
        };
      }),
      addMapStop: (directionKey, latlng) => set((state) => {
        const direction = state.draft[directionKey];
        const nextStops = [
          ...direction.orderedStops,
          createMapStop({ latitude: latlng.lat, longitude: latlng.lng }, direction.orderedStops.length + 1),
        ];
        return {
          draft: {
            ...state.draft,
            [directionKey]: computeDirection({
              ...direction,
              orderedStops: nextStops,
              polylinePath: [],
              estimatedDistanceKm: 0,
              estimatedDurationMinutes: 0,
            }),
          },
        };
      }),
      updateStop: (directionKey, stopIndex, patch) => set((state) => {
        const direction = state.draft[directionKey];
        const nextStops = direction.orderedStops.map((stop, index) => (
          index === stopIndex ? { ...stop, ...patch } : stop
        ));
        return {
          draft: {
            ...state.draft,
            [directionKey]: computeDirection({
              ...direction,
              orderedStops: nextStops,
              polylinePath: [],
              estimatedDistanceKm: 0,
              estimatedDurationMinutes: 0,
            }),
          },
        };
      }),
      removeStop: (directionKey, stopIndex) => set((state) => {
        const direction = state.draft[directionKey];
        const nextStops = direction.orderedStops
          .filter((_, index) => index !== stopIndex)
          .map((stop, index) => ({ ...stop, stopOrder: index + 1 }));
        return {
          draft: {
            ...state.draft,
            [directionKey]: computeDirection({
              ...direction,
              orderedStops: nextStops,
              polylinePath: [],
              estimatedDistanceKm: 0,
              estimatedDurationMinutes: 0,
            }),
          },
        };
      }),
      reorderStops: (directionKey, fromIndex, toIndex) => set((state) => {
        const direction = state.draft[directionKey];
        return {
          draft: {
            ...state.draft,
            [directionKey]: computeDirection({
              ...direction,
              orderedStops: reorder(direction.orderedStops, fromIndex, toIndex),
              polylinePath: [],
              estimatedDistanceKm: 0,
              estimatedDurationMinutes: 0,
            }),
          },
        };
      }),
      duplicateReverseDirection: () => set((state) => {
        const sourceKey = state.activeDirection;
        const targetKey = sourceKey === 'outboundRoute' ? 'inboundRoute' : 'outboundRoute';
        const source = computeDirection(state.draft[sourceKey]);
        const reversedStops = source.orderedStops
          .slice()
          .reverse()
          .map((stop, index) => ({
            ...stop,
            stopOrder: index + 1,
            arrivalOffsetMinutes: index * 6,
            departureOffsetMinutes: (index * 6) + 1,
          }));
        return {
          draft: {
            ...state.draft,
            [targetKey]: computeDirection({
              ...state.draft[targetKey],
              startStation: source.endStation,
              endStation: source.startStation,
              orderedStops: reversedStops,
              polylinePath: [],
              estimatedDistanceKm: 0,
              estimatedDurationMinutes: 0,
            }),
          },
        };
      }),
      updateDirectionPath: (directionKey, pathUpdate) => set((state) => ({
        draft: {
          ...state.draft,
          [directionKey]: {
            ...state.draft[directionKey],
            polylinePath: pathUpdate.polylinePath || [],
            estimatedDistanceKm: pathUpdate.estimatedDistanceKm || 0,
            estimatedDurationMinutes: pathUpdate.estimatedDurationMinutes || 0,
          },
        },
      })),
      getDirection: () => get().draft[get().activeDirection],
    }),
    {
      name: 'veridian-route-workflow-draft',
      partialize: (state) => ({
        activeStep: state.activeStep,
        activeDirection: state.activeDirection,
        selectedRouteId: state.selectedRouteId,
        draft: state.draft,
      }),
    }
  )
);
