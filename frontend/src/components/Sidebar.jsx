import React, { useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Calendar, 
  DoorOpen, 
  CurrencyDollar, 
  SignOut,
  House,
  CalendarCheck,
  List,
  X,
  Buildings
} from '@phosphor-icons/react';

export const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = useMemo(() => [
    { to: '/dashboard', icon: House, label: 'Dashboard', roles: ['admin', 'rezeption', 'buchhaltung'] },
    { to: '/properties', icon: Buildings, label: 'Immobilien', roles: ['admin'] },
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
    <>
      {/* Mobile Header with Hamburger */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-zinc-950 border-b border-gold-500/30 z-50 flex items-center justify-between p-4" style={{ paddingTop: 'env(safe-area-inset-top, 1rem)' }}>
        <button
          onClick={() => setMobileOpen(true)}
          data-testid="mobile-menu-button"
          className="text-gold-500 p-2"
        >
          <List size={28} weight="bold" />
        </button>
        <img 
          src="https://customer-assets.emergentagent.com/wingman/359d1d25-501d-49ee-acdc-7ddd114c4b2b/attachments/abc94a5694cb4db0a3fad6a16ce20ec7_icon (1).png" 
          alt="Logo" 
          className="w-10 h-10 object-contain logo-no-bg"
        />
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-sm font-bold text-gold-400">
          {user?.name?.[0]?.toUpperCase()}
        </div>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 z-50"
          onClick={() => setMobileOpen(false)}
          data-testid="mobile-overlay"
        />
      )}

      {/* Sidebar - Desktop & Mobile Drawer */}
      <div 
        className={`bg-zinc-950 border-r border-gold-500/30 text-gold-400 h-screen w-64 fixed left-0 top-0 flex flex-col z-50 transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`} 
        style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}
        data-testid="sidebar"
      >
        {/* Mobile Close Button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden absolute top-4 right-4 text-gold-500 p-2"
          data-testid="mobile-close-button"
        >
          <X size={24} weight="bold" />
        </button>

        <div className="p-4 border-b border-gold-500/30">
          <div className="flex flex-col items-center">
            <img 
              src="https://customer-assets.emergentagent.com/wingman/359d1d25-501d-49ee-acdc-7ddd114c4b2b/attachments/abc94a5694cb4db0a3fad6a16ce20ec7_icon (1).png" 
              alt="Villen Manager Pro Logo" 
              className="w-32 h-32 lg:w-40 lg:h-40 object-contain logo-no-bg"
            />
            <p className="text-xs text-gold-500 uppercase tracking-wider font-medium text-center mt-3">{user?.role}</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredNavItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              data-testid={`nav-${label.toLowerCase().replace(' ', '-')}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-gold-500 to-gold-600 text-gold-400 font-semibold shadow-lg shadow-gold-500/20'
                    : 'text-gold-400 hover:bg-zinc-900 hover:text-gold-300 hover:shadow-md'
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

        <div className="p-4 border-t border-gold-500/30" style={{ paddingBottom: 'env(safe-area-inset-bottom, 1rem)' }}>
          <div className="flex items-center gap-3 px-4 py-3 mb-2 bg-zinc-900 rounded-md">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-sm font-bold text-gold-400">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-gold-400">{user?.name}</p>
              <p className="text-xs text-gold-600 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            data-testid="logout-button"
            className="flex items-center gap-3 px-4 py-2 w-full text-gold-400 hover:bg-zinc-900 hover:text-gold-300 rounded-md transition-colors duration-200"
          >
            <SignOut size={20} />
            <span className="text-sm">Abmelden</span>
          </button>
        </div>
      </div>
    </>
  );
};
