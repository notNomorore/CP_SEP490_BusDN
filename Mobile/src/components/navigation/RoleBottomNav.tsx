import { normalizeRole } from '@/utils/roleNavigation';

import { BusAssistantBottomNav } from './BusAssistantBottomNav';
import type { BottomNavKey } from './BottomNavBase';
import { DriverBottomNav } from './DriverBottomNav';
import { PassengerBottomNav } from './PassengerBottomNav';

type RoleBottomNavProps = {
  active: BottomNavKey;
  role?: string | null;
};

export function RoleBottomNav({ active, role }: RoleBottomNavProps) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === 'DRIVER') {
    return <DriverBottomNav active={active} />;
  }

  if (normalizedRole === 'BUS_ASSISTANT' || normalizedRole === 'BUS ASSISTANT' || normalizedRole === 'CONDUCTOR') {
    return <BusAssistantBottomNav active={active} />;
  }

  return <PassengerBottomNav active={active} />;
}

export type { BottomNavKey } from './BottomNavBase';
