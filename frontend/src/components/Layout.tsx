import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  IconDashboard, IconBook, IconNewspaper, IconLayers, IconWand, IconReport, IconSettings, IconLogout,
} from "./Icons";

const navItems = [
  { to: "/", label: "Dashboard", Icon: IconDashboard, end: true },
  { to: "/books", label: "Books", Icon: IconBook },
  { to: "/taranga", label: "Taranga", Icon: IconNewspaper },
  { to: "/series", label: "Series", Icon: IconLayers },
  { to: "/category-finder", label: "Category Finder", Icon: IconWand },
  { to: "/reports", label: "Reports", Icon: IconReport },
  { to: "/settings", label: "Settings", Icon: IconSettings },
];

// Mobile bottom nav shows a curated subset so it doesn't overcrowd small screens.
const mobileNavItems = navItems.filter((i) => i.to !== "/settings");

function BrandMark({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <div className={`${className} rounded-xl bg-white shrink-0 shadow-glow overflow-hidden ring-1 ring-white/40 p-[3px]`}>
      <img src="/brand/kak-logo.jpg" alt="KAK logo" className="w-full h-full object-cover rounded-[9px]" />
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen app-bg flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-72 shrink-0 relative bg-ink-900 text-cream-50 overflow-hidden">
        {/* ambient gradient glow */}
        <div className="pointer-events-none absolute inset-0 bg-mesh-hero opacity-70" />
        <div className="pointer-events-none absolute inset-0 bg-grain mix-blend-overlay" />
        <div className="pointer-events-none absolute -top-16 -right-20 w-64 h-64 rounded-full bg-brand-500/30 blur-3xl animate-float-slow" />
        <div className="pointer-events-none absolute bottom-24 -left-16 w-56 h-56 rounded-full bg-accent-400/20 blur-3xl animate-float" />

        <div className="relative px-6 py-7 flex items-center gap-3.5 border-b border-white/10">
          <BrandMark className="w-12 h-12" />
          <div className="min-w-0">
            <h1 className="text-[16px] font-display font-semibold leading-tight tracking-tight text-white truncate">
              KAK Library
            </h1>
            <p className="text-[10.5px] text-cream-200/60 font-medium tracking-wide truncate mt-0.5">
              ಶ್ರೀ ಕುಟ್ಲಯ್ಯ ಅಧ್ಯಯನ ಕೇಂದ್ರ
            </p>
          </div>
        </div>

        <nav className="relative flex-1 px-3.5 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `nav-pill group ${
                  isActive
                    ? "text-white shadow-glow"
                    : "text-cream-200/70 hover:text-white hover:bg-white/[0.06]"
                }`
              }
              style={({ isActive }) =>
                isActive
                  ? { backgroundImage: "linear-gradient(135deg, #f38b3c 0%, #e8722a 55%, #c85a1e 100%)" }
                  : undefined
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-colors duration-200 ${
                      isActive ? "bg-white/15" : "bg-white/5 group-hover:bg-white/10"
                    }`}
                  >
                    <Icon className="w-[17px] h-[17px]" strokeWidth={2} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="relative mx-3.5 mb-4 px-3.5 py-3.5 rounded-2xl glass-panel">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-soft"
                 style={{ backgroundImage: "linear-gradient(135deg, #f3c858 0%, #e8722a 100%)" }}>
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-semibold truncate text-white text-sm">{user?.username}</div>
              <div className="text-[11px] text-cream-200/50 capitalize">{user?.role}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-3 w-full flex items-center justify-center gap-1.5 text-cream-200/70 hover:text-white hover:bg-white/10 text-xs font-semibold py-2 rounded-lg transition-colors duration-200"
          >
            <IconLogout className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
        <p className="relative text-center text-[10px] text-cream-200/40 pb-3">v1.3.0</p>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-white/60 px-4 py-3 flex items-center justify-between shadow-soft">
        <h1 className="font-display font-semibold text-base flex items-center gap-2.5 text-stone-900">
          <BrandMark className="w-9 h-9" /> KAK Library
        </h1>
        <div className="flex items-center gap-2">
          <NavLink to="/settings" className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center text-stone-600">
            <IconSettings className="w-4 h-4" />
          </NavLink>
          <button onClick={logout} className="text-xs text-white px-3 py-1.5 rounded-full font-medium shadow-soft"
                  style={{ backgroundImage: "linear-gradient(135deg, #f38b3c 0%, #c85a1e 100%)" }}>
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-24 md:pb-10 px-3.5 md:px-10 py-5 md:py-9 max-w-7xl w-full mx-auto">
        <div key={location.pathname} className="page-transition">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white/85 backdrop-blur-xl border-t border-white/60 flex justify-around shadow-[0_-8px_30px_-8px_rgba(22,17,13,0.18)] pb-[env(safe-area-inset-bottom)]">
        {mobileNavItems.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 py-2 flex-1 text-[10.5px] font-semibold transition-colors duration-200 ${
                isActive ? "text-brand-700" : "text-stone-400"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.8} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
