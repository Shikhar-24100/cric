import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { PlayCircle, Users, Clock, Trophy } from 'lucide-react';

const AppLayout: React.FC = () => {
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden relative" style={{ background: '#f2f0eb' }}>

      {/* ── Global Header ─────────────────────────────────── */}
      <header style={{ background: '#1a3a2a' }} className="shrink-0 z-10">
        <div className="flex items-center gap-2 px-4 py-3 max-w-md mx-auto">
          {/* Logo mark */}
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: '#6ee09e' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1a3a2a' }}>C</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>CricTrack</span>
        </div>
      </header>

      {/* ── Page content ──────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto w-full max-w-md mx-auto relative z-0 pb-20">
        <Outlet />
      </main>

      {/* ── Bottom Navigation ─────────────────────────────── */}
      <nav className="fixed bottom-0 w-full z-20 max-w-md left-1/2 -translate-x-1/2"
        style={{ background: '#ffffff', borderTop: '1px solid #e0ddd4' }}>
        <div className="flex justify-around items-center h-16">
          <NavItem to="/"       icon={<PlayCircle size={20} />} label="New Match" />
          <NavItem to="/teams"  icon={<Users size={20} />}      label="Teams"     />
          <NavItem to="/history" icon={<Clock size={20} />}     label="History"   />
          <NavItem to="/career" icon={<Trophy size={20} />}     label="Career"    />
        </div>
      </nav>
    </div>
  );
};

interface NavItemProps { to: string; icon: React.ReactNode; label: string; }

const NavItem: React.FC<NavItemProps> = ({ to, icon, label }) => (
  <NavLink
    to={to}
    end={to === '/'}
    className="flex flex-col items-center justify-center gap-1 w-full h-full relative"
  >
    {({ isActive }) => (
      <>
        {/* Pill highlight behind icon */}
        {isActive && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-7 rounded-full"
            style={{ background: '#d4f4e2' }} />
        )}
        <div className="relative z-10" style={{ color: isActive ? '#1a3a2a' : '#b0aba2' }}>
          {icon}
        </div>
        <span style={{
          fontSize: 9, fontWeight: isActive ? 600 : 400,
          color: isActive ? '#1a3a2a' : '#b0aba2',
        }}>{label}</span>
      </>
    )}
  </NavLink>
);

export default AppLayout;
