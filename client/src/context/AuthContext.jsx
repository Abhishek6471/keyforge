import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('kf_token'));
  // restoring = we have a token but haven't decoded it yet (avoids redirect flicker on refresh)
  const [restoring, setRestoring] = useState(() => !!localStorage.getItem('kf_token'));

  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({ id: payload.id, email: payload.email, name: localStorage.getItem('kf_name') || payload.email, is_admin: payload.is_admin ? 1 : 0 });
      } catch {
        setUser(null);
      }
    } else {
      setUser(null);
    }
    setRestoring(false);
  }, [token]);

  function login(data) {
    localStorage.setItem('kf_token', data.token);
    localStorage.setItem('kf_name', data.user.name);
    setToken(data.token);
    setUser({ ...data.user, is_admin: data.user.is_admin ? 1 : 0 });
  }

  function logout() {
    localStorage.removeItem('kf_token');
    localStorage.removeItem('kf_name');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthCtx.Provider value={{ user, token, restoring, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);