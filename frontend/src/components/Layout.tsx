import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/", label: "Dashboard", icon: "🏠", end: true },
  { to: "/books", label: "Books", icon: "📚" },
  { to: "/taranga", label: "Taranga", icon: "📰" },
  { to: "/series", label: "Series", icon: "🗂️" },
  { to: "/reports", label: "Reports", icon: "📄" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-60 bg-brand-700 text-white shrink-0">
        <div className="px-5 py-5 border-b border-brand-600">
          <h1 className="text-lg font-bold leading-tight">Library<br />Management</h1>
        </div>
        <nav className="flex-1 py-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors ${
                  isActive ? "bg-brand-600 border-l-4 border-white" : "hover:bg-brand-600/60 border-l-4 border-transparent"
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-brand-600 text-sm">
          <div className="opacity-80">Signed in as</div>
          <div className="font-semibold">{user?.username} ({user?.role})</div>
          <button onClick={logout} className="mt-2 text-brand-100 underline text-xs">
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-20 bg-brand-700 text-white px-4 py-3 flex items-center justify-between shadow">
        <h1 className="font-bold text-base">📚 Library</h1>
        <button onClick={logout} className="text-xs bg-brand-600 px-3 py-1.5 rounded-full">
          Sign out
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-20 md:pb-6 px-3 md:px-6 py-4 max-w-6xl w-full mx-auto">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 flex justify-around shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 py-2 flex-1 text-[11px] font-medium ${
                isActive ? "text-brand-700" : "text-gray-500"
              }`
            }
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
