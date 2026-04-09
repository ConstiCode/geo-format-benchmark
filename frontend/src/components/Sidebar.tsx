import { NavLink } from 'react-router-dom';
import { BarChart3, FlaskConical, Search, Settings } from 'lucide-react';

const navItems = [
  { to: '/', icon: BarChart3, label: 'Overview' },
  { to: '/queries', icon: Search, label: 'Queries' },
  { to: '/experiments', icon: FlaskConical, label: 'Experiments' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-sidebar flex flex-col">
      <div className="px-5 py-6">
        <h1 className="text-white text-lg font-semibold tracking-tight">
          GEO Benchmark
        </h1>
        <p className="text-text-muted text-xs mt-0.5">Format Citation Analysis</p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-sidebar-active text-white'
                  : 'text-text-muted hover:bg-sidebar-hover hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-sidebar-hover">
        <p className="text-text-muted text-xs">v0.1.0</p>
      </div>
    </aside>
  );
}
