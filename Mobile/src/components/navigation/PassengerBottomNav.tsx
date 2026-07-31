import type { BottomNavKey } from './BottomNavBase';
import { BottomNavBase, type BottomNavItemConfig } from './BottomNavBase';

const passengerItems: BottomNavItemConfig[] = [
  { key: 'home', label: 'Home', icon: 'home', href: '/home' },
  { key: 'explore', label: 'Explore', icon: 'compass-outline', href: '/search-routes' },
  { key: 'tickets', label: 'Tickets', icon: 'ticket-confirmation-outline', href: '/my-tickets' },
  { key: 'history', label: 'History', icon: 'history', href: '/travel-history' },
  { key: 'profile', label: 'Profile', icon: 'account-outline', href: '/profile' },
];

export function PassengerBottomNav({ active }: { active: BottomNavKey }) {
  return <BottomNavBase active={active} items={passengerItems} />;
}
