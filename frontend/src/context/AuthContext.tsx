import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type AuthConfig, type SessionUser } from "../lib/api";

interface AuthContextValue {
  user: SessionUser | null;
  config: AuthConfig | null;
  ready: boolean;
  refresh: () => Promise<SessionUser | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.me();
      setUser(user);
      return user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    Promise.all([refresh(), api.authConfig().then(setConfig).catch(() => setConfig(null))]).finally(() => setReady(true));
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await api.signOut();
    } finally {
      window.google?.accounts?.id?.disableAutoSelect();
      setUser(null);
    }
  }, []);

  return <AuthContext.Provider value={{ user, config, ready, refresh, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
