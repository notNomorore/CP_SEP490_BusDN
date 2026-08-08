import type { Href } from 'expo-router';
import type { BottomNavKey } from './BottomNavBase';
import { BottomNavBase, type BottomNavItemConfig } from './BottomNavBase';

const routeSearchRoute = '/search-routes' as Href;

const buildPassengerItems = (unreadCount = 0): BottomNavItemConfig[] => [
  { key: 'home', label: 'Trang chủ', icon: 'home', href: '/home' },
  { key: 'explore', label: 'Tuyến xe', icon: 'compass-outline', href: routeSearchRoute },
  { key: 'tickets', label: 'Vé của tôi', icon: 'ticket-confirmation-outline', href: '/my-tickets' },
  { key: 'activity', label: 'Thông báo', icon: unreadCount ? 'bell' : 'bell-outline', href: '/notifications', badgeCount: unreadCount },
  { key: 'profile', label: 'Cá nhân', icon: 'account-outline', href: '/profile' },
];

export function PassengerBottomNav({ active, unreadCount = 0 }: { active: BottomNavKey; unreadCount?: number }) {
  return <BottomNavBase active={active} items={buildPassengerItems(unreadCount)} />;
}
