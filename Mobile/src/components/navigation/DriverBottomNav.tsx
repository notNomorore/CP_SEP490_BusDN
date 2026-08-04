import { useDriverI18n } from '@/i18n/driver';

import type { BottomNavKey } from './BottomNavBase';
import { BottomNavBase, type BottomNavItemConfig } from './BottomNavBase';

export function DriverBottomNav({ active }: { active: BottomNavKey }) {
  const { t } = useDriverI18n();
  const driverItems: BottomNavItemConfig[] = [
    { key: 'home', label: t.nav.home, icon: 'home', href: '/driver-assistant' },
    { key: 'trips', label: t.nav.trips, icon: 'bus', href: '/driver-assistant/assigned-trips' },
    { key: 'schedule', label: t.nav.schedule, icon: 'calendar-month-outline', href: '/driver-assistant/shift-schedule' },
    { key: 'notifications', label: t.nav.notifications, icon: 'bell-ring-outline', href: '/driver-assistant/notifications' },
    { key: 'chat', label: t.nav.chat, icon: 'chat-outline', href: '/driver-assistant/group-chat' },
    { key: 'profile', label: t.nav.profile, icon: 'account-outline', href: '/profile' },
  ];

  return <BottomNavBase active={active} items={driverItems} />;
}
