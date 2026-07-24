import React, { useEffect, useState } from "react";
import { api, downloadBlob } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  IconUsers, IconShield, IconDownload, IconUpload, IconTrash, IconSettings, IconMonitor,
} from "../components/Icons";

export default function SettingsPage() {
  const { isAdmin, user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [wipeExisting, setWipeExisting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);

  const [users, setUsers] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({ username: "", password: "", full_name: "", role: "staff" });

  const [loginHistory, setLoginHistory] = useState<any[]>([]);

  function loadHistory() {
    if (isAdmin) api.get("/backup/history").then((res) => setHistory(res.data));
  }
  function loadUsers() {
    if (isAdmin) api.get("/auth/users").then((res) => setUsers(res.data));
  }
  function loadLoginHistory() {
    if (isAdmin) api.get("/auth/login-history").then((res) => setLoginHistory(res.data));
  }
  useEffect(() => { loadHistory(); loadUsers(); loadLoginHistory(); }, [isAdmin]);

  async function handleExport() {
    const res = await api.get("/backup/export", { responseType: "blob" });
    downloadBlob(res.data, `library_backup_${new Date().toISOString().slice(0, 10)}.json`);
    loadHistory();
  }

  async function handleRestore(e: React.FormEvent) {
    e.preventDefault();
    if (!restoreFile) return;
    if (wipeExisting && !confirm("This will ERASE all current data before restoring. Continue?")) return;
    setRestoring(true);
    setRestoreMsg(null);
    const formData = new FormData();
    formData.append("file", restoreFile);
    try {
      const res = await api.post("/backup/import", formData, {
        params: { wipe_existing: wipeExisting },
        headers: { "Content-Type": "multipart/form-data" },
      });
      setRestoreMsg(
        `Restored: ${res.data.books_restored} books, ${res.data.magazines_restored} magazines, ` +
        `${res.data.series_restored} series, ${res.data.sub_series_restored ?? 0} sub-series.`
      );
    } catch (err: any) {
      setRestoreMsg(err?.response?.data?.detail || "Restore failed");
    } finally {
      setRestoring(false);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/auth/users", newUser);
    setNewUser({ username: "", password: "", full_name: "", role: "staff" });
    loadUsers();
  }

  async function handleDeleteUser(id: number) {
    if (!confirm("Remove this user?")) return;
    await api.delete(`/auth/users/${id}`);
    loadUsers();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <IconSettings className="w-5 h-5" />
          </span>
          Settings
        </h2>
      </div>

      <div className="card card-pad space-y-2">
        <h3 className="section-title">Account</h3>
        <p className="text-sm text-stone-600">
          Signed in as <strong className="text-stone-900">{user?.username}</strong>{" "}
          <span className="badge-brand capitalize">{user?.role}</span>
        </p>
        <p className="text-xs text-stone-400 pt-1">KAK Library Management System — v1.3.0</p>
      </div>

      {isAdmin && (
        <>
          <div className="card card-pad space-y-3">
            <h3 className="section-title">Backup</h3>
            <p className="text-xs text-stone-500">
              Download a full JSON snapshot of all series, sub-series, books, copies, magazines, and issues.
            </p>
            <button onClick={handleExport} className="btn-primary">
              <IconDownload className="w-4 h-4" /> Download Backup
            </button>
            {history.length > 0 && (
              <div className="text-xs text-stone-500 pt-2 space-y-1 border-t border-stone-100 mt-1">
                <p className="font-semibold text-stone-600 pt-2">Recent backups:</p>
                {history.slice(0, 5).map((h) => (
                  <p key={h.id}>{h.filename} — {h.record_count} records — {new Date(h.created_at).toLocaleString()}</p>
                ))}
              </div>
            )}
          </div>

          <div className="card card-pad space-y-3">
            <h3 className="section-title">Restore</h3>
            <p className="text-xs text-stone-500">Upload a previously downloaded backup JSON file to restore data.</p>
            <form onSubmit={handleRestore} className="space-y-3">
              <input
                type="file" accept=".json" onChange={(e) => setRestoreFile(e.target.files?.[0] || null)} required
                className="w-full text-sm text-stone-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 file:text-xs file:font-semibold hover:file:bg-brand-100"
              />
              <label className="flex items-center gap-2 text-xs text-stone-600">
                <input type="checkbox" checked={wipeExisting} onChange={(e) => setWipeExisting(e.target.checked)}
                       className="rounded border-stone-300 text-brand-600 focus:ring-brand-400" />
                Erase existing data before restoring (use with caution)
              </label>
              <button type="submit" disabled={restoring}
                      className="btn bg-amber-600 text-white shadow-soft hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-60">
                <IconUpload className="w-4 h-4" /> {restoring ? "Restoring..." : "Restore Backup"}
              </button>
            </form>
            {restoreMsg && <p className="text-sm bg-stone-50 rounded-lg p-2.5">{restoreMsg}</p>}
          </div>

          <div className="card card-pad space-y-3">
            <h3 className="section-title flex items-center gap-1.5">
              <IconUsers className="w-4 h-4" /> User Management
            </h3>
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex justify-between items-center text-sm bg-stone-50 rounded-lg px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    {u.username}
                    <span className="badge-gray capitalize flex items-center gap-1">
                      {u.role === "admin" && <IconShield className="w-3 h-3" />} {u.role}
                    </span>
                  </span>
                  {u.username !== user?.username && (
                    <button onClick={() => handleDeleteUser(u.id)} className="text-red-600 text-xs font-semibold flex items-center gap-1">
                      <IconTrash className="w-3.5 h-3.5" /> Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            <form onSubmit={handleCreateUser} className="grid sm:grid-cols-2 gap-2.5 pt-2 border-t border-stone-100">
              <input className="input-field mt-2.5" placeholder="Username"
                     value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} required />
              <input type="password" className="input-field mt-2.5" placeholder="Password"
                     value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required />
              <input className="input-field" placeholder="Full name"
                     value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} />
              <select className="select-field" value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
              <button type="submit" className="sm:col-span-2 btn-primary">
                <IconUsers className="w-4 h-4" /> Add User
              </button>
            </form>
          </div>

          <div className="card card-pad space-y-3">
            <h3 className="section-title flex items-center gap-1.5">
              <IconMonitor className="w-4 h-4" /> Login Activity
            </h3>
            <p className="text-xs text-stone-500">
              Who has logged into the system, from what device/browser, and when. Admin-only.
            </p>
            {loginHistory.length === 0 ? (
              <p className="text-sm text-stone-400">No login activity recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-stone-500 border-b border-stone-100">
                      <th className="py-1.5 pr-3 font-semibold">User</th>
                      <th className="py-1.5 pr-3 font-semibold">Device</th>
                      <th className="py-1.5 pr-3 font-semibold">IP Address</th>
                      <th className="py-1.5 pr-3 font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loginHistory.map((l) => (
                      <tr key={l.id} className="border-b border-stone-50">
                        <td className="py-1.5 pr-3">
                          {l.full_name || l.username}
                          {l.role && <span className="badge-gray capitalize ml-1.5">{l.role}</span>}
                        </td>
                        <td className="py-1.5 pr-3 text-stone-600" title={l.user_agent || ""}>
                          {l.device_summary || "Unknown device"}
                        </td>
                        <td className="py-1.5 pr-3 text-stone-600">{l.ip_address || "—"}</td>
                        <td className="py-1.5 pr-3 text-stone-500">{new Date(l.login_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
