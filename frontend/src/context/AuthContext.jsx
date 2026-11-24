import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { api, clearClientAuthState, fetchCSRFToken, setCSRFToken } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const inFlightMeRef = useRef(null);
  const userRef = useRef(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const fetchUser = useCallback(async () => {
    if (inFlightMeRef.current) {
      return inFlightMeRef.current;
    }

    const promise = (async () => {
      try {
        const data = await api.get("/api/auth/me/");
        if (data?.csrfToken) {
          setCSRFToken(data.csrfToken);
        }
        setUser(data);
        return data;
      } catch {
        setUser(null);
        return null;
      } finally {
        setLoading(false);
        inFlightMeRef.current = null;
      }
    })();

    inFlightMeRef.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Listen for unauthenticated API responses and tab focus changes to keep auth state strictly synced
  useEffect(() => {
    const handleUnauthenticated = () => {
      if (userRef.current !== null) {
        setUser(null);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && userRef.current !== null) {
        fetchUser();
      }
    };

    window.addEventListener("catopia:unauthenticated", handleUnauthenticated);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("catopia:unauthenticated", handleUnauthenticated);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchUser]);

  const login = useCallback(async (username, password) => {
    // Clear previous user drafts in storage without wiping the active CSRF cookie before POST
    clearClientAuthState({ clearCookies: false });
    const data = await api.post("/api/auth/login/", { username, password });
    if (data?.csrfToken) {
      setCSRFToken(data.csrfToken);
    }
    await fetchCSRFToken();
    setUser(data);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("catopia:auth-change", { detail: { user: data } }));
    }
    return data;
  }, []);

  const register = useCallback(async (userData) => {
    clearClientAuthState({ clearCookies: false });
    const data = await api.post("/api/auth/register/", userData);
    if (data?.csrfToken) {
      setCSRFToken(data.csrfToken);
    }
    await fetchCSRFToken();
    setUser(data);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("catopia:auth-change", { detail: { user: data } }));
    }
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout/");
    } catch (err) {
      console.warn("Logout error:", err);
    } finally {
      setUser(null);
      clearClientAuthState({ clearCookies: true });
      await fetchCSRFToken();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("catopia:auth-change", { detail: { user: null } }));
      }
    }
  }, []);

  const isCustomer = user?.role === "customer";
  const isStaff = user?.role === "staff";
  const isAdmin = user?.role === "admin";
  const isStaffOrAdmin = isStaff || isAdmin;

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      isCustomer,
      isStaff,
      isAdmin,
      isStaffOrAdmin,
      refetchUser: fetchUser,
    }),
    [user, loading, login, register, logout, isCustomer, isStaff, isAdmin, isStaffOrAdmin, fetchUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
