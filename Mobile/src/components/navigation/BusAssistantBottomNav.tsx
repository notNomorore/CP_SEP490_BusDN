import type { BottomNavKey } from './BottomNavBase';
import { BottomNavBase, type BottomNavItemConfig } from './BottomNavBase';

const busAssistantItems: BottomNavItemConfig[] = [
  { key: 'home', label: 'Home', icon: 'home', href: '/driver-assistant' },
  { key: 'trips', label: 'Trips', icon: 'bus', href: '/driver-assistant/assigned-trips' },
  { key: 'schedule', label: 'Schedule', icon: 'calendar-month-outline', href: '/driver-assistant/shift-schedule' },
  { key: 'validate', label: 'Validate', icon: 'qrcode-scan', href: '/driver-assistant/validate-ticket' },
  { key: 'chat', label: 'Chat', icon: 'chat-outline', href: '/driver-assistant/group-chat' },
  { key: 'profile', label: 'Profile', icon: 'account-outline', href: '/profile' },
];

export function BusAssistantBottomNav({ active }: { active: BottomNavKey }) {
  return <BottomNavBase active={active} items={busAssistantItems} />;
}
