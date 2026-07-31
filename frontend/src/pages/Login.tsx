import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { IconBook, IconLayers, IconNewspaper } from "../components/Icons";
import TiltCard from "../components/TiltCard";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-ink-900 px-4 py-10 overflow-hidden">
      {/* Ambient gradient mesh background */}
      <div className="pointer-events-none absolute inset-0 bg-mesh-hero opacity-90" />
      <div className="pointer-events-none absolute inset-0 bg-grain mix-blend-overlay" />
      <div className="pointer-events-none absolute -top-32 -right-24 w-[26rem] h-[26rem] rounded-full bg-accent-400/25 blur-3xl animate-float-slow" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 w-[30rem] h-[30rem] rounded-full bg-brand-500/30 blur-3xl animate-float" />

      <div className="relative w-full max-w-4xl grid md:grid-cols-2 gap-0 rounded-3xl overflow-hidden shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] animate-rise">
        {/* Left: brand story panel (hidden on small screens) */}
        <div className="hidden md:flex flex-col justify-between glass-panel !rounded-none p-10 relative">
          <div>
            <div className="w-16 h-16 rounded-2xl bg-white shadow-glow p-[3px] ring-1 ring-white/30">
              <img src="/brand/kak-logo.jpg" alt="KAK logo" className="w-full h-full object-cover rounded-[13px]" />
            </div>
            <h1 className="font-display text-3xl font-semibold mt-8 leading-tight">
              <span className="text-white">Sri Kutlaya</span><br /><span className="text-shimmer">Adhyayna Kendra(R)</span>
            </h1>
            <p className="text-cream-200/60 text-sm mt-3 leading-relaxed max-w-xs">
              ಶ್ರೀ ಕುಟ್ಲಯ್ಯ ಅಧ್ಯಯನ ಕೇಂದ್ರ (ರಿ) — A digital home for the library's books
            </p>
          </div>

          
        </div>

        {/* Right: form panel */}
        <TiltCard strength={2.5} className="bg-white/95 backdrop-blur-xl p-8 sm:p-10 flex flex-col justify-center">
          <div className="text-center md:text-left mb-8">
            <div className="w-14 h-14 mx-auto md:mx-0 rounded-2xl bg-white shadow-card border border-cream-200 overflow-hidden md:hidden">
              <img src="/brand/kak-logo.jpg" alt="KAK logo" className="w-full h-full object-cover" />
            </div>
            <h2 className="font-display text-2xl font-semibold text-stone-900 mt-4 md:mt-0 tracking-tight">
              Welcome back
            </h2>
            <p className="text-sm text-stone-400 mt-1.5">Sign in to manage the library</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="field-label">Username</label>
              <input
                autoFocus
                className="input-field"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="Viewers: use the name you signed up with"
                required
              />
            </div>
            <div>
              <label className="field-label">Password</label>
              <input
                type="password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {error && <p className="text-red-600 text-sm bg-red-50 rounded-xl px-3.5 py-2.5">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-[15px]">
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="text-xs text-stone-400 text-center md:text-left mt-6">
            New here?{" "}
            <Link to="/signup" className="text-brand-600 font-semibold hover:underline">
              Create a Viewer account
            </Link>
          </p>
        </TiltCard>
      </div>
    </div>
  );
}
