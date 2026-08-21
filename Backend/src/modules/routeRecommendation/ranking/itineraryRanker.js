import { buildItinerary } from '../utils/itineraryBuilder.js';

const STRATEGIES = {
  FASTEST: {
    label: 'Fastest',
    compare: (left, right) => left.costMinutes - right.costMinutes,
  },
  FEWEST_TRANSFERS: {
    label: 'Fewer transfers',
    compare: (left, right) => left.transferCount - right.transferCount || left.costMinutes - right.costMinutes,
  },
  LEAST_WALKING: {
    label: 'Less walking',
    compare: (left, right) => {
      const leftWalking = left.originWalk.walking.distanceMeters + left.destinationWalk.walking.distanceMeters + (left.transferLeg?.distanceMeters || 0);
      const rightWalking = right.originWalk.walking.distanceMeters + right.destinationWalk.walking.distanceMeters + (right.transferLeg?.distanceMeters || 0);
      return leftWalking - rightWalking || left.costMinutes - right.costMinutes;
    },
  },
};

const normalizePreference = (preference) => (
  STRATEGIES[preference] ? preference : 'FASTEST'
);

export const rankItineraries = (paths, { preference = 'FASTEST', config }) => {
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
    const candidate = [...paths]
      .sort(strategy.compare)
      .find((path) => !signatures.has(path.signature));

    if (candidate) {
      signatures.add(candidate.signature);
      selected.push({ path: candidate, label: strategy.label });
    }
  });

  [...paths]
    .sort(STRATEGIES.FASTEST.compare)
    .forEach((path) => {
      if (selected.length >= config.MAX_RECOMMENDATIONS || signatures.has(path.signature)) {
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
