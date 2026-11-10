import { useEffect } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Gauge, Users, Sparkles, LogOut, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { cx, initials } from '../lib/utils.js';
import { Logo } from './ui.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, end: true },
  { to: '/tracker', label: 'Carbon Tracker', short: 'Tracker', icon: ClipboardList },
  { to: '/resources', label: 'Resources', short: 'Resources', icon: Gauge },
  { to: '/challenges', label: 'Challenges', short: 'Community', icon: Users },
  { to: '/insights', label: 'AI Insights', short: 'AI Coach', icon: Sparkles },
];

export function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute -left-24 -top-24 h-80 w-80 animate-float rounded-full bg-emerald-200/50 blur-3xl" />
      <div className="absolute -right-20 top-1/4 h-96 w-96 animate-float rounded-full bg-sky-200/40 blur-3xl" style={{ animationDelay: '-3s' }} />
      <div className="absolute bottom-0 left-1/3 h-80 w-80 animate-float rounded-full bg-lime-200/40 blur-3xl" style={{ animationDelay: '-6s' }} />
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-[100dvh]">
      <Backdrop />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col p-4 lg:flex">
        <div className="glass flex h-full flex-col rounded-[28px] p-4">
          <Link to="/" className="rounded-2xl px-2 py-2">
            <Logo />
          </Link>
          <nav className="mt-6 flex flex-1 flex-col gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[15px] font-semibold transition',
                    isActive ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-glow' : 'text-slate-600 hover:bg-white hover:text-emerald-700'
                  )
                }
              >
                <n.icon size={19} />
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="rounded-2xl border border-white bg-white/70 p-2">
            <NavLink
              to="/profile"
              className={({ isActive }) => cx('flex items-center gap-3 rounded-xl p-2 transition hover:bg-emerald-50', isActive && 'bg-emerald-50')}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-bold text-white">
                {initials(user.full_name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-slate-800">{user.full_name || 'My profile'}</span>
                <span className="block truncate text-xs text-slate-500">{user.email}</span>
              </span>
            </NavLink>
            <button
              onClick={logout}
              className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
            >
              <LogOut size={16} /> Log out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="glass sticky top-0 z-30 flex items-center justify-between border-x-0 border-t-0 px-4 py-2.5 lg:hidden">
        <Link to="/">
          <Logo size={34} />
        </Link>
        <Link
          to="/profile"
          aria-label="Profile"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-xs font-bold text-white shadow-glow"
        >
          {initials(user.full_name) || <UserRound size={16} />}
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-10 lg:pl-[17.5rem] lg:pr-8 lg:pt-8 xl:max-w-7xl">
        <div key={pathname} className="animate-fade-up">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="glass pb-safe fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 rounded-t-3xl border-x-0 border-b-0 px-1.5 pt-1.5 lg:hidden">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              cx('flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[10.5px] font-semibold transition', isActive ? 'text-emerald-600' : 'text-slate-400')
            }
          >
            {({ isActive }) => (
              <>
                <span className={cx('flex h-8 w-12 items-center justify-center rounded-full transition', isActive && 'bg-emerald-100')}>
                  <n.icon size={19} />
                </span>
                {n.short}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
