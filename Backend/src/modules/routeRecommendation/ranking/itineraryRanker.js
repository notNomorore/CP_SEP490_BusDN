import { buildItinerary } from '../utils/itineraryBuilder.js';

const walkingDistanceMeters = (path) => (
  (Number(path.originWalk?.walking?.distanceMeters) || 0)
  + (Number(path.destinationWalk?.walking?.distanceMeters) || 0)
  + (Number(path.transferLeg?.distanceMeters) || 0)
);

const waitMinutes = (path) => (
  (path.busLegs || []).reduce((total, leg) => total + (Number(leg.wait?.durationMinutes) || 0), 0)
);

const busMinutes = (path) => (
  (path.busLegs || []).reduce((total, leg) => total + (Number(leg.segment?.durationMinutes) || 0), 0)
);

const routeSequenceSignature = (path) => (
  (path.busLegs || [])
    .map((leg) => `${leg.fromNode.routeId || leg.fromNode.routeCode}:${leg.fromNode.direction}`)
    .join('>')
);

const scorePath = (path) => {
  const walkingKm = walkingDistanceMeters(path) / 1000;

  return (
    (Number(path.costMinutes) || 0)
    + walkingKm * 4
    + waitMinutes(path) * 0.35
    + (Number(path.transferCount) || 0) * 8
  );
};

const compareByScore = (left, right) => (
  scorePath(left) - scorePath(right)
  || (Number(left.costMinutes) || 0) - (Number(right.costMinutes) || 0)
  || walkingDistanceMeters(left) - walkingDistanceMeters(right)
  || waitMinutes(left) - waitMinutes(right)
  || busMinutes(left) - busMinutes(right)
  || (Number(left.transferCount) || 0) - (Number(right.transferCount) || 0)
);

const hasMeaningfulDifference = (candidate, selected) => {
  const candidateRouteSequence = routeSequenceSignature(candidate);
  const selectedRouteSequences = new Set(selected.map((item) => routeSequenceSignature(item.path)));

  if (!selectedRouteSequences.has(candidateRouteSequence)) {
    return true;
  }

  const bestSameSequence = selected.find((item) => routeSequenceSignature(item.path) === candidateRouteSequence)?.path;
  if (!bestSameSequence) {
    return true;
  }

  const timeDelta = Math.abs((Number(candidate.costMinutes) || 0) - (Number(bestSameSequence.costMinutes) || 0));
  const walkingDelta = Math.abs(walkingDistanceMeters(candidate) - walkingDistanceMeters(bestSameSequence));
  const waitDelta = Math.abs(waitMinutes(candidate) - waitMinutes(bestSameSequence));

  return timeDelta >= 10 || walkingDelta >= 800 || waitDelta >= 10;
};

const STRATEGIES = {
  FASTEST: {
    label: 'Fastest',
    compare: compareByScore,
  },
  FEWEST_TRANSFERS: {
    label: 'Fewer transfers',
    compare: (left, right) => left.transferCount - right.transferCount || compareByScore(left, right),
  },
  LEAST_WALKING: {
    label: 'Less walking',
    compare: (left, right) => {
      const leftWalking = walkingDistanceMeters(left);
      const rightWalking = walkingDistanceMeters(right);
      return leftWalking - rightWalking || compareByScore(left, right);
    },
  },
};

const normalizePreference = (preference) => (
  STRATEGIES[preference] ? preference : 'FASTEST'
);

export const rankItineraries = (paths, { preference = 'FASTEST', config }) => {
  const bestByRouteSequence = new Map();
  [...paths].sort(compareByScore).forEach((path) => {
    const sequence = routeSequenceSignature(path) || path.signature;
    if (!bestByRouteSequence.has(sequence)) {
      bestByRouteSequence.set(sequence, path);
    }
  });
  const dedupedPaths = [...bestByRouteSequence.values()];
  const bestPath = [...dedupedPaths].sort(STRATEGIES[normalizePreference(preference)].compare)[0];

  if (!bestPath || !config.SHOW_ALTERNATIVE_RECOMMENDATIONS) {
    return bestPath
      ? [buildItinerary(bestPath, { rank: 1, label: 'Tốt nhất', config })]
      : [];
  }

  const orderedStrategyKeys = [
    normalizePreference(preference),
    'FASTEST',
    'FEWEST_TRANSFERS',
    'LEAST_WALKING',
  ].filter((strategy, index, list) => list.indexOf(strategy) === index);

  const selected = [];
  const signatures = new Set();

  orderedStrategyKeys.forEach((strategyKey) => {
    const strategy = STRATEGIES[strategyKey];
    const candidate = [...dedupedPaths]
      .sort(strategy.compare)
      .find((path) => !signatures.has(path.signature) && hasMeaningfulDifference(path, selected));

    if (candidate) {
      signatures.add(candidate.signature);
      selected.push({ path: candidate, label: strategy.label });
    }
  });

  [...dedupedPaths]
    .sort(STRATEGIES.FASTEST.compare)
    .forEach((path) => {
      if (
        selected.length >= config.MAX_RECOMMENDATIONS
        || signatures.has(path.signature)
        || !hasMeaningfulDifference(path, selected)
      ) {
        return;
      }

      signatures.add(path.signature);
      selected.push({ path, label: 'Alternative' });
    });

  return selected
    .slice(0, config.MAX_RECOMMENDATIONS)
    .map((item, index) => buildItinerary(item.path, {
      rank: index + 1,
      label: item.label,
      config,
    }));
};

export default rankItineraries;
