import React from 'react';
import {
  BellRing,
  Bus,
  ChartColumn,
  Clock3,
  ShieldCheck,
  Star,
  UserRound,
} from 'lucide-react';

const sidebarItems = [
  { id: 'overview', label: 'Overview', icon: UserRound },
  { id: 'favorites', label: 'Favorites', icon: Star },
  { id: 'pass', label: 'Monthly Pass', icon: Bus },
  { id: 'statistics', label: 'Statistics', icon: ChartColumn },
  { id: 'history', label: 'Travel History', icon: Clock3 },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'notifications', label: 'Notifications', icon: BellRing },
];

const ProfileSidebar = ({ user, onNavigate, currentSection }) => {
  return (
    <aside className="glass-card soft-panel sticky top-24 hidden h-fit w-80 shrink-0 rounded-[30px] p-6 lg:block">
      <div className="rounded-[26px] bg-primary p-5 text-white">
        <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-primary-fixed-dim">
          BusDN Passenger
        </p>
        <h1 className="mt-3 text-2xl font-headline font-extrabold tracking-tight">
          Personal Profile
        </h1>
        <p className="mt-2 text-sm leading-6 text-surface-container-highest/80">
          Manage your rider identity, saved transit shortcuts, travel history, and pass access in one place.
        </p>
      </div>

      <div className="mt-6 rounded-[26px] bg-surface-container-low px-4 py-5">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-outline">
          Logged in as
        </p>
        <p className="mt-2 truncate text-lg font-bold text-primary">{user?.fullName}</p>
        <p className="truncate text-sm text-on-surface-variant">{user?.email}</p>
      </div>

      <nav className="mt-6 space-y-2">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentSection === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                isActive
                  ? 'bg-primary text-white shadow-lg shadow-primary/15'
                  : 'bg-transparent text-on-surface-variant hover:bg-surface-container-low hover:text-primary'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="font-semibold">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default ProfileSidebar;
