import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { DashboardStats } from "../types";
import { useAuth } from "../context/AuthContext";
import { IconBook, IconNewspaper, IconReport, IconArrowRight, IconSparkle } from "../components/Icons";
import HeroOrbScene from "../components/three/HeroOrbScene";
import TiltCard from "../components/TiltCard";

const quickActions = [
  { to: "/books?action=add", label: "Add Book", sub: "Add book to catalog", Icon: IconBook, gradient: "from-blue-500 to-indigo-600", adminOnly: true },
  { to: "/taranga?action=add", label: "Add Taranga", sub: "Register a new issue", Icon: IconNewspaper, gradient: "from-emerald-500 to-teal-600", adminOnly: true },
  { to: "/reports", label: "Generate Report", sub: "Export catalog data", Icon: IconReport, gradient: "from-brand-400 to-brand-600", adminOnly: true },
];

function StatSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3.5">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="card card-pad h-28 space-y-3">
          <div className="skeleton w-9 h-9 rounded-lg" />
          <div className="skeleton w-16 h-3 rounded" />
          <div className="skeleton w-10 h-5 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | false>(false);
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    api.get("/dashboard/stats")
      .then((res) => setStats(res.data))
      .catch((err) => {
        const detail = err?.response?.data?.detail;
        const status = err?.response?.status;
        setError(
          detail ? String(detail)
          : status ? `Server error (${status}). Please try again.`
          : "Could not reach the server. Check your connection or that the backend is running."
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  if (error) {
    return (
      <div className="empty-state text-red-500">
        <IconSparkle className="w-7 h-7 text-red-300" />
        {error}
      </div>
    );
  }

  const statCards = stats
    ? [
        { label: "Total Books", value: stats.total_books, sub: `+${stats.added_this_month} this month`, Icon: IconBook, gradient: "from-blue-500 to-indigo-600" },
        { label: "Taranga Titles", value: stats.total_taranga, sub: "Magazines tracked", Icon: IconNewspaper, gradient: "from-brand-400 to-brand-600" },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-ink-900 px-6 sm:px-9 py-9 sm:py-11 animate-rise">
        <div className="pointer-events-none absolute inset-0 bg-mesh-hero opacity-80" />
        <div className="pointer-events-none absolute inset-0 bg-grain mix-blend-overlay" />
        <div className="pointer-events-none absolute -top-20 -right-16 w-64 h-64 rounded-full bg-accent-400/25 blur-3xl animate-float-slow" />
        <div className="relative flex items-center justify-between gap-6">
          <div>
            <p className="text-cream-200/60 text-xs font-semibold uppercase tracking-[0.14em]">
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h2 className="font-display text-2xl sm:text-[32px] font-semibold text-white mt-2 tracking-tight flex items-center gap-2 flex-wrap">
              {timeGreeting}, {user?.username || "Admin"} <span>👋</span>
            </h2>
            <p className="text-cream-200/70 text-sm mt-2 max-w-md">
              Here's what's happening across the library today.
            </p>
          </div>
          {/* Living 3D emblem — purely decorative, hidden on small screens to keep the hero uncluttered */}
          <HeroOrbScene className="hidden sm:block w-40 h-40 lg:w-52 lg:h-52 shrink-0" />
        </div>
      </div>

      {/* Stat cards */}
      {loading ? (
        <StatSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-3.5">
          {statCards.map((s, i) => (
            <TiltCard
              key={s.label}
              strength={5}
              className="card card-hover card-pad group animate-rise"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className={`stat-icon bg-gradient-to-br ${s.gradient} text-white group-hover:scale-105 transition-transform duration-300`}>
                <s.Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
              </div>
              <p className="text-xs text-stone-500 mt-3.5">{s.label}</p>
              <p className="text-[26px] font-display font-semibold text-stone-900 mt-0.5 tracking-tight">{s.value}</p>
              <p className="text-[11px] text-stone-400 mt-0.5">{s.sub}</p>
            </TiltCard>
          ))}
        </div>
      )}

      {/* Quick Actions - admin only; viewers only browse/view, no catalog actions */}
      {isAdmin && (
        <div className="card card-pad">
          <h3 className="section-title mb-3.5">Quick Actions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <TiltCard key={action.label} strength={4} className="rounded-2xl">
                <button
                  onClick={() => navigate(action.to)}
                  className="group text-left bg-white border border-stone-100 hover:border-transparent rounded-2xl px-3.5 py-4 flex flex-col gap-3 transition-all duration-250 ease-out active:scale-[0.97] hover:shadow-cardHover hover:-translate-y-0.5 w-full h-full"
                >
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-soft bg-gradient-to-br ${action.gradient} group-hover:scale-110 transition-transform duration-300`}>
                    <action.Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
                  </span>
                  <span>
                    <span className="block font-semibold text-[13px] text-stone-800 leading-tight">{action.label}</span>
                    <span className="block text-[11px] text-stone-400 mt-1 leading-tight">{action.sub}</span>
                  </span>
                </button>
              </TiltCard>
            ))}
          </div>
        </div>
      )}

      {/* Recently Added Books */}
      <div className="card card-pad">
        <div className="flex items-center justify-between mb-2">
          <h3 className="section-title">Recently Added Books</h3>
          <Link to="/books" className="text-xs text-brand-600 font-semibold hover:underline flex items-center gap-1">
            View all <IconArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {loading ? (
          <div className="space-y-3 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center gap-3">
                <div className="space-y-2 flex-1">
                  <div className="skeleton h-3.5 w-1/2 rounded" />
                  <div className="skeleton h-3 w-1/3 rounded" />
                </div>
                <div className="skeleton h-5 w-12 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {stats?.recent_additions.map((b) => (
              <div key={b.id} className="py-3 flex justify-between items-center gap-3 hover:bg-brand-50/30 -mx-2 px-2 rounded-lg transition-colors duration-150">
                <div className="min-w-0">
                  <div className="font-medium text-stone-900 truncate">{b.title}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-stone-400">{b.author}</span>
                    {b.sub_series_name && <span className="badge-accent">{b.sub_series_name}</span>}
                  </div>
                </div>
                <span className="serial-chip shrink-0">{b.display_serial}</span>
              </div>
            ))}
            {stats?.recent_additions.length === 0 && (
              <div className="empty-state py-8">
                <IconSparkle className="w-7 h-7 text-stone-300" />
                No books added yet. Tap "Add Book" to get started.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
