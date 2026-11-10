import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from '../lib/api.js';

const AuthContext = createContext(null);
const USER_KEY = 'gt_user';

const readCachedUser = () => {
  try {
    return getToken() ? JSON.parse(localStorage.getItem(USER_KEY) || 'null') : null;
  } catch {
    return null;
  }
};
const cacheUser = (u) => {
  try {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
};

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(readCachedUser);
  const [ready, setReady] = useState(() => !getToken() || Boolean(readCachedUser()));
  const [meta, setMeta] = useState(null);

  const setUser = useCallback((u) => {
    cacheUser(u);
    setUserState(u);
  }, []);

  const signIn = useCallback(
    (token, u) => {
      setToken(token);
      setUser(u);
    },
    [setUser]
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, [setUser]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Restore the saved session (works across refreshes; log in on any device with the same account)
  useEffect(() => {
    if (!getToken()) return;
    let alive = true;
    api('/auth/me')
      .then((d) => alive && setUser(d.user))
      .catch((e) => {
        if (alive && e.status === 401) logout();
      })
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [setUser, logout]);

  // Public reference data (categories + emission factors). Retries while the server wakes up.
  useEffect(() => {
    let alive = true;
    let timer;
    const load = () =>
      api('/meta')
        .then((m) => alive && setMeta(m))
        .catch(() => {
          if (alive) timer = setTimeout(load, 4000);
        });
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  const value = useMemo(() => ({ user, setUser, signIn, logout, ready, meta }), [user, setUser, signIn, logout, ready, meta]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
