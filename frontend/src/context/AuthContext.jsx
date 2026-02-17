import { createContext, useEffect, useMemo, useState } from "react";
import API from "../api/api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [apiKey, setApiKey] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchMe(token);
      return;
    }
    setLoading(false);
  }, [token]);

  const fetchMe = async (activeToken) => {
    try {
      const res = await API.get("/auth/me", {
        headers: {
          Authorization: `Bearer ${activeToken}`,
        },
      });
      setUser(res.data.user);
      setApiKey(res.data.apiKey);
    } catch {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
      setApiKey(null);
    } finally {
      setLoading(false);
    }
  };

  const login = (nextToken) => {
    localStorage.setItem("token", nextToken);
    setToken(nextToken);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setApiKey(null);
  };

  const value = useMemo(
    () => ({
      token,
      user,
      apiKey,
      loading,
      login,
      logout,
      refreshUser: () => (token ? fetchMe(token) : Promise.resolve()),
    }),
    [token, user, apiKey, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
