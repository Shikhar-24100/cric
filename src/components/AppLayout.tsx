import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { PlayCircle, Users, Clock, Trophy } from 'lucide-react';

const AppLayout: React.FC = () => {
  return (
    <div className="flex flex-col h-screen w-full bg-cricket-bg overflow-hidden relative">
      {/* Top Header */}
      <header className="bg-cricket-green text-white p-4 shadow-md z-10 shrink-0">
        <h1 className="text-xl font-bold text-center">CricTrack</h1>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto w-full max-w-md mx-auto relative z-0 pb-16">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-gray-200 fixed bottom-0 w-full z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] pb-safe-area">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto">
          <NavItem to="/" icon={<PlayCircle size={24} />} label="New Match" />
          <NavItem to="/teams" icon={<Users size={24} />} label="Teams" />
          <NavItem to="/history" icon={<Clock size={24} />} label="History" />
          <NavItem to="/career" icon={<Trophy size={24} />} label="Career" />
        </div>
      </nav>
    </div>
  );
};

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
          isActive ? 'text-cricket-green' : 'text-gray-400 hover:text-gray-600'
        }`
      }
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </NavLink>
  );
};

export default AppLayout;
