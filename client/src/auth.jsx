import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const loadMe = useCallback(() => {
    if (!getToken()) { setUser(null); setReady(true); return; }
    api.get('/auth/me')
      .then(setUser)
      .catch(() => { setToken(null); setUser(null); })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  // A 401 anywhere in the app forces us back to the login screen.
  useEffect(() => {
    const onUnauth = () => setUser(null);
    window.addEventListener('osb-unauthorized', onUnauth);
    return () => window.removeEventListener('osb-unauthorized', onUnauth);
  }, []);

  const login = useCallback(async (username, password) => {
    const { token, user } = await api.post('/auth/login', { username, password });
    setToken(token);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout', {}); } catch { /* ignore */ }
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, ready, login, logout, refresh: loadMe }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

/** Role helpers. */
export const isAdmin = (u) => u?.role === 'admin';
export const isStaff = (u) => u?.role === 'admin' || u?.role === 'storekeeper'; // can receive/manage stock
export const isManager = (u) => u?.role === 'manager';

export const ROLE_LABEL = { admin: 'Administrator', storekeeper: 'Store Keeper', manager: 'Project Manager' };
