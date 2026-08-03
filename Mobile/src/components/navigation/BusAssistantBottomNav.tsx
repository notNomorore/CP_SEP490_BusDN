import type { BottomNavKey } from './BottomNavBase';
import { BottomNavBase, type BottomNavItemConfig } from './BottomNavBase';

const busAssistantItems: BottomNavItemConfig[] = [
  { key: 'home', label: 'Trang chủ', icon: 'home', href: '/driver-assistant' },
  { key: 'sell', label: 'Bán vé', icon: 'ticket-confirmation-outline', href: '/driver-assistant/walkin-ticket' },
  { key: 'validate', label: 'Quét vé', icon: 'qrcode-scan', href: '/driver-assistant/validate-ticket' },
  { key: 'trips', label: 'Chuyến', icon: 'bus-clock', href: '/driver-assistant/assigned-trips' },
  { key: 'notifications', label: 'Thông báo', icon: 'bell-ring-outline', href: '/driver-assistant/notifications' },
  { key: 'profile', label: 'Cá nhân', icon: 'account-outline', href: '/profile' },
];

export function BusAssistantBottomNav({ active }: { active: BottomNavKey }) {
  return <BottomNavBase active={active} items={busAssistantItems} />;
}
