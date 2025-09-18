// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  getToken,
  setToken as setTokenLS,
  clearAuth,
  loginRequest,
  meRequest,
} from "../lib/auth";

const AuthContext = createContext();

/**
 * AuthProvider
 * - Exposes: { user, token, loading, authError, login, logout }
 * - Persists token via your lib/auth localStorage helpers.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // user object returned from /me
  const [token, setTokenState] = useState(() => getToken()); // JWT string or null
  const [loading, setLoading] = useState(true); // initial auth check
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const saved = getToken();
      if (!saved) {
        if (mounted) setLoading(false);
        return;
      }
      try {
        const me = await meRequest();
        if (mounted) {
          setUser(me || null);
          setTokenState(saved);
        }
      } catch (err) {
        // invalid token or network error: clear
        clearAuth();
        if (mounted) {
          setUser(null);
          setTokenState(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  async function login(email, password) {
    setAuthError(null);
    try {
      const data = await loginRequest(email, password);
      if (!data || !data.access_token) {
        throw new Error("No token returned from login");
      }
      // persist token in localStorage (lib/auth)
      setTokenLS(data.access_token);
      setTokenState(data.access_token);

      // fetch user info
      const me = await meRequest();
      setUser(me || null);
      return me;
    } catch (err) {
      // clear anything stale
      clearAuth();
      setTokenState(null);
      setUser(null);
      setAuthError(err);
      throw err;
    }
  }

  function logout() {
    clearAuth();
    setTokenState(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        authError,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// custom hook for easy consumption
export function useAuth() {
  return useContext(AuthContext);
}
