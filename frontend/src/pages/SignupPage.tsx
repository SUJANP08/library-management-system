import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import TiltCard from "../components/TiltCard";

export default function SignupPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await register(fullName.trim(), password);
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Could not create account. Please try again.");
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
              Create a Viewer account to browse the catalog — see what's in the library and how many
              copies of each title are available.
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
              Create a Viewer account
            </h2>
            <p className="text-sm text-stone-400 mt-1.5">Browse the catalog — view only, no editing access</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="field-label">Name</label>
              <input
                autoFocus
                className="input-field"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
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
                autoComplete="new-password"
                minLength={4}
                required
              />
            </div>
            <div>
              <label className="field-label">Confirm password</label>
              <input
                type="password"
                className="input-field"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={4}
                required
              />
            </div>

            {error && <p className="text-red-600 text-sm bg-red-50 rounded-xl px-3.5 py-2.5">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-[15px]">
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <p className="text-xs text-stone-400 text-center md:text-left mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-brand-600 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </TiltCard>
      </div>
    </div>
  );
}
