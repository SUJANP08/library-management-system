import React, { createContext, useContext, useState, useCallback } from "react";
import { api } from "../api/client";
import type { AuthUser } from "../types";

interface AuthContextValue {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const username = localStorage.getItem("lms_username");
    const role = localStorage.getItem("lms_role") as "admin" | "staff" | null;
    return username && role ? { username, role } : null;
  });

  const login = useCallback(async (username: string, password: string) => {
    const form = new URLSearchParams();
    form.append("username", username);
    form.append("password", password);
    const res = await api.post("/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    localStorage.setItem("lms_token", res.data.access_token);
    localStorage.setItem("lms_role", res.data.role);
    localStorage.setItem("lms_username", res.data.username);
    setUser({ username: res.data.username, role: res.data.role });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("lms_token");
    localStorage.removeItem("lms_role");
    localStorage.removeItem("lms_username");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin: user?.role === "admin" }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
