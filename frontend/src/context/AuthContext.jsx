import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, setUnauthorizedHandler } from '../api/client.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);
export const authDisabled = import.meta.env.MODE === 'development';
const DEMO_USER = { name: 'Demo User', email: 'demo@fluento.local', role: 'user' };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(authDisabled ? DEMO_USER : null);
  const [loading, setLoading] = useState(!authDisabled);

  useEffect(() => {
    if (authDisabled) return undefined;
    let alive = true;
    authApi.me().then((u) => alive && setUser(u)).catch(() => alive && setUser(null)).finally(() => alive && setLoading(false));
    setUnauthorizedHandler(() => setUser(null));
    return () => { alive = false; };
  }, []);

  const login = useCallback(async (d) => { const u = await authApi.login(d); setUser(u); return u; }, []);
  const register = useCallback(async (d) => { const u = await authApi.register(d); setUser(u); return u; }, []);
  const logout = useCallback(async () => {
    if (authDisabled) return;
    try { await authApi.logout(); } finally { setUser(null); }
  }, []);

  const value = useMemo(() => ({ user, setUser, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
