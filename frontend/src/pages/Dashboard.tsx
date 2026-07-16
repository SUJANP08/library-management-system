import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { DashboardStats } from "../types";

const quickActions = [
  { to: "/books?action=add", label: "Add Book", icon: "📖", color: "bg-brand-600 hover:bg-brand-700" },
  { to: "/taranga?action=add", label: "Add Taranga", icon: "📰", color: "bg-emerald-600 hover:bg-emerald-700" },
  { to: "/reports", label: "Generate Report", icon: "📄", color: "bg-gray-800 hover:bg-gray-900" },
];

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/dashboard/stats").then((res) => setStats(res.data)).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-16 text-gray-400 text-sm">Loading dashboard...</div>;
  }
  if (!stats) {
    return <div className="text-center py-16 text-red-500 text-sm">Could not load dashboard.</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-0.5">Welcome back — here's what's in your library.</p>
      </div>

      {/* Total Books - the single focal stat */}
      <div className="bg-gradient-to-br from-brand-700 to-brand-600 rounded-2xl shadow-md p-6 text-white flex items-center justify-between">
        <div>
          <p className="text-brand-100 text-sm font-medium">Total Books</p>
          <p className="text-4xl font-bold mt-1">{stats.total_books}</p>
        </div>
        <div className="text-5xl opacity-80">📚</div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.to)}
              className={`${action.color} text-white rounded-xl px-4 py-4 flex items-center gap-3 shadow-sm transition-colors text-left`}
            >
              <span className="text-2xl">{action.icon}</span>
              <span className="font-semibold text-sm">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recently Added Books */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 text-sm">Recently Added Books</h3>
          <Link to="/books" className="text-xs text-brand-600 font-medium hover:underline">View all →</Link>
        </div>
        <div className="divide-y divide-gray-100">
          {stats.recent_additions.map((b) => (
            <div key={b.id} className="py-3 flex justify-between items-center gap-3">
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">{b.title}</div>
                <div className="text-xs text-gray-400 mt-0.5">{b.author}</div>
              </div>
              <span className="text-xs font-mono bg-brand-50 text-brand-700 px-2.5 py-1 rounded-full shrink-0">
                {b.display_serial}
              </span>
            </div>
          ))}
          {stats.recent_additions.length === 0 && (
            <p className="text-sm text-gray-400 py-6 text-center">No books added yet. Tap "Add Book" to get started.</p>
          )}
        </div>
      </div>
    </div>
  );
}
