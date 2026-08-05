import type { BottomNavKey } from './BottomNavBase';
import { BottomNavBase, type BottomNavItemConfig } from './BottomNavBase';

import { useDriverI18n } from '@/i18n/driver';

export function BusAssistantBottomNav({ active }: { active: BottomNavKey }) {
  const { t } = useDriverI18n();
  const busAssistantItems: BottomNavItemConfig[] = [
    { key: 'home', label: t.nav.home, icon: 'home', href: '/driver-assistant' },
    { key: 'sell', label: t.assistant.nav.sell, icon: 'ticket-confirmation-outline', href: '/driver-assistant/walkin-ticket' },
    { key: 'validate', label: t.assistant.nav.validate, icon: 'qrcode-scan', href: '/driver-assistant/validate-ticket' },
    { key: 'trips', label: t.nav.trips, icon: 'bus-clock', href: '/driver-assistant/assigned-trips' },
    { key: 'profile', label: t.nav.profile, icon: 'account-outline', href: '/profile' },
  ];
  return <BottomNavBase active={active} items={busAssistantItems} />;
}
