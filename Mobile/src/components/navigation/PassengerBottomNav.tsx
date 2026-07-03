import type { BottomNavKey } from './BottomNavBase';
import { BottomNavBase, type BottomNavItemConfig } from './BottomNavBase';

const passengerItems: BottomNavItemConfig[] = [
  { key: 'home', label: 'Home', icon: 'home', href: '/home' },
  { key: 'explore', label: 'Explore', icon: 'compass-outline', unavailableTitle: 'Explore' },
  { key: 'tickets', label: 'Tickets', icon: 'ticket-confirmation-outline', unavailableTitle: 'Tickets' },
  { key: 'priority', label: 'Priority', icon: 'shield-star-outline', href: '/priority-passenger' },
  { key: 'profile', label: 'Profile', icon: 'account-outline', href: '/profile' },
];

export function PassengerBottomNav({ active }: { active: BottomNavKey }) {
  return <BottomNavBase active={active} items={passengerItems} />;
}
