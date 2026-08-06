import authStorage from '@/api/authStorage';

const HISTORY_KEY = 'busdn.passenger.searchHistory.v1';
const MAX_HISTORY_ITEMS = 8;

export type PassengerSearchType = 'route' | 'stop' | 'destination';

export type PassengerSearchHistoryItem = {
  type: PassengerSearchType;
  id?: string;
  displayName: string;
  subtitle?: string;
  timestamp: string;
};

export async function getPassengerSearchHistory(): Promise<PassengerSearchHistoryItem[]> {
  try {
    const rawValue = await authStorage.getItem(HISTORY_KEY);
    if (!rawValue) return [];
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.filter((item) => item?.displayName && item?.type) : [];
  } catch {
    return [];
  }
}

export async function savePassengerSearchHistoryItem(item: Omit<PassengerSearchHistoryItem, 'timestamp'>) {
  const displayName = item.displayName.trim();
  if (!displayName) return [];

  const existingItems = await getPassengerSearchHistory();
  const nextItem: PassengerSearchHistoryItem = {
    ...item,
    displayName,
    subtitle: item.subtitle?.trim() || '',
    timestamp: new Date().toISOString(),
  };
  const deduped = existingItems.filter((existing) => (
    existing.type !== nextItem.type
    || existing.id !== nextItem.id
    || existing.displayName.toLowerCase() !== nextItem.displayName.toLowerCase()
  ));
  const nextItems = [nextItem, ...deduped].slice(0, MAX_HISTORY_ITEMS);
  await authStorage.setItem(HISTORY_KEY, JSON.stringify(nextItems));
  return nextItems;
}

export async function clearPassengerSearchHistory() {
  await authStorage.deleteItem(HISTORY_KEY);
}
