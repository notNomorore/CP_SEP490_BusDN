import type { Href } from 'expo-router';
import type { BottomNavKey } from './BottomNavBase';
import { BottomNavBase, type BottomNavItemConfig } from './BottomNavBase';

const routeSearchRoute = '/route-search' as Href;

const buildPassengerItems = (unreadCount = 0): BottomNavItemConfig[] => [
  { key: 'home', label: 'Home', icon: 'home', href: '/home' },
  { key: 'explore', label: 'Explore', icon: 'compass-outline', href: routeSearchRoute },
  { key: 'tickets', label: 'Tickets', icon: 'ticket-confirmation-outline', unavailableTitle: 'Tickets' },
  { key: 'activity', label: 'Activity', icon: unreadCount ? 'bell' : 'bell-outline', href: '/notifications', badgeCount: unreadCount },
  { key: 'profile', label: 'Profile', icon: 'account-outline', href: '/profile' },
];

export function PassengerBottomNav({ active, unreadCount = 0 }: { active: BottomNavKey; unreadCount?: number }) {
  return <BottomNavBase active={active} items={buildPassengerItems(unreadCount)} />;
}
