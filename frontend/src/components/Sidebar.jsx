import React, { useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  ChartBar, 
  Calendar, 
  DoorOpen, 
  CurrencyDollar, 
  SignOut,
  House,
  IdentificationCard,
  CalendarCheck
} from '@phosphor-icons/react';

export const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = useMemo(() => [
    { to: '/dashboard', icon: House, label: 'Dashboard', roles: ['admin', 'rezeption', 'buchhaltung'] },
    { to: '/bookings', icon: Calendar, label: 'Buchungen', roles: ['admin', 'rezeption'] },
    { to: '/availability', icon: CalendarCheck, label: 'Verfügbarkeit', roles: ['admin', 'rezeption'] },
    { to: '/calendar', icon: CalendarCheck, label: 'Kalender', roles: ['admin', 'rezeption'] },
    { to: '/check-in', icon: DoorOpen, label: 'Check-In', roles: ['admin', 'rezeption'] },
    { to: '/accounting', icon: CurrencyDollar, label: 'Buchhaltung', roles: ['admin', 'buchhaltung'] },
  ], []);

  const filteredNavItems = useMemo(
    () => navItems.filter(item => item.roles.includes(user?.role)),
    [navItems, user?.role]
  );

  return (
    <div className="bg-zinc-950 border-r border-zinc-800 text-amber-400 h-screen w-64 fixed left-0 top-0 flex flex-col" data-testid="sidebar">
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center gap-3 mb-2">
          <img 
            src="https://customer-assets.emergentagent.com/job_hotel-booking-table/artifacts/am7dxsds_Gemini_Generated_Image_btdxkwbtdxkwbtdx.png" 
            alt="VillenManagerExclusiv Logo" 
            className="w-12 h-12 object-contain"
          />
          <div>
            <h1 className="text-xl font-bold font-heading tracking-tight text-amber-500">VillenManager</h1>
            <p className="text-xs text-amber-600 uppercase tracking-widest font-semibold">Exclusiv</p>
          </div>
        </div>
        <p className="text-xs text-amber-700 uppercase tracking-wider font-medium">{user?.role}</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {filteredNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            data-testid={`nav-${label.toLowerCase().replace(' ', '-')}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 font-semibold shadow-lg shadow-amber-500/20'
                  : 'text-amber-400 hover:bg-zinc-900 hover:text-amber-300 hover:shadow-md'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} weight={isActive ? 'fill' : 'regular'} />
                <span className="text-sm">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <div className="flex items-center gap-3 px-4 py-3 mb-2 bg-zinc-900 rounded-md">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-sm font-bold text-zinc-950">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-amber-400">{user?.name}</p>
            <p className="text-xs text-amber-600 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          data-testid="logout-button"
          className="flex items-center gap-3 px-4 py-2 w-full text-amber-400 hover:bg-zinc-900 hover:text-amber-300 rounded-md transition-colors duration-200"
        >
          <SignOut size={20} />
          <span className="text-sm">Abmelden</span>
        </button>
      </div>
    </div>
  );
};
