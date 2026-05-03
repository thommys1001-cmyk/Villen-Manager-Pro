import React from 'react';
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

  const navItems = [
    { to: '/dashboard', icon: House, label: 'Dashboard', roles: ['admin', 'rezeption', 'buchhaltung'] },
    { to: '/bookings', icon: Calendar, label: 'Buchungen', roles: ['admin', 'rezeption'] },
    { to: '/availability', icon: CalendarCheck, label: 'Verfügbarkeit', roles: ['admin', 'rezeption'] },
    { to: '/calendar', icon: CalendarCheck, label: 'Kalender (D&D)', roles: ['admin', 'rezeption'] },
    { to: '/check-in', icon: DoorOpen, label: 'Check-In', roles: ['admin', 'rezeption'] },
    { to: '/accounting', icon: CurrencyDollar, label: 'Buchhaltung', roles: ['admin', 'buchhaltung'] },
  ];

  return (
    <div className="bg-zinc-950 text-white h-screen w-64 fixed left-0 top-0 flex flex-col border-r border-zinc-800" data-testid="sidebar">
      <div className="p-6 border-b border-zinc-800">
        <h1 className="text-2xl font-bold font-heading tracking-tight">Hotel Manager</h1>
        <p className="text-xs text-zinc-400 mt-1 uppercase tracking-wider">{user?.role}</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems
          .filter(item => item.roles.includes(user?.role))
          .map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={`nav-${label.toLowerCase().replace(' ', '-')}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-md transition-colors duration-200 ${
                  isActive
                    ? 'bg-white text-zinc-950 font-semibold'
                    : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
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
        <div className="flex items-center gap-3 px-4 py-3 mb-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-semibold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-zinc-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          data-testid="logout-button"
          className="flex items-center gap-3 px-4 py-2 w-full text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-md transition-colors duration-200"
        >
          <SignOut size={20} />
          <span className="text-sm">Abmelden</span>
        </button>
      </div>
    </div>
  );
};