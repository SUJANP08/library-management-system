/**
 * OPTIONAL latency optimisation. This is NOT part of the data-persistence
 * fix and is not imported anywhere by default.
 *
 * ---------------------------------------------------------------------
 * READ THIS FIRST
 * ---------------------------------------------------------------------
 * Pinging the backend does NOT protect your data. Data persistence comes
 * entirely from DATABASE_URL pointing at PostgreSQL. With Postgres
 * configured, the backend can sleep, restart, redeploy or be rebuilt from
 * scratch and every book, user and issue record survives, because the
 * data lives in the database server rather than in the web container.
 *
 * The only thing this file addresses is the ~30-60 second cold start a
 * free-tier Render instance has after idling out. It is a UX nicety.
 *
 * Do not enable this expecting it to prevent data loss. If you ever find
 * yourself relying on it for that, the real problem is that DATABASE_URL
 * is still set to SQLite - check GET /api/health/db, which reports
 * "persistent": false in that case.
 * ---------------------------------------------------------------------
 *
 * To enable, add one line to src/main.tsx:
 *
 *     import { startKeepAlive } from "./api/keepAlive";
 *     startKeepAlive();
 *
 * To disable again, delete that line. Nothing else depends on this file.
 */

const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

let timer: ReturnType<typeof setInterval> | null = null;

function healthUrl(): string {
  // Mirrors the resolution in client.ts: VITE_API_BASE_URL points at the
  // backend's /api prefix in production, or "/api" when proxied in dev.
  const base = import.meta.env.VITE_API_BASE_URL || "/api";
  return `${base.replace(/\/$/, "")}/health`;
}

async function ping(): Promise<void> {
  // Deliberately uses plain fetch rather than the shared axios client:
  // that client redirects to /login on any 401, and a background ping
  // should never be able to bounce someone out of the page they are
  // working on. /api/health needs no auth and touches no database.
  try {
    await fetch(healthUrl(), { method: "GET", cache: "no-store" });
  } catch {
    // Offline, backend down, or waking up. Silent by design - this is a
    // background nicety and must never surface an error to the user.
  }
}

export function startKeepAlive(intervalMs: number = KEEP_ALIVE_INTERVAL_MS): void {
  if (timer !== null) return; // already running

  // Only ping while the tab is actually being looked at. A backgrounded
  // tab pinging forever is wasted requests on a free tier.
  const tick = () => {
    if (document.visibilityState === "visible") void ping();
  };

  void ping();
  timer = setInterval(tick, intervalMs);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void ping();
  });
}

export function stopKeepAlive(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}
