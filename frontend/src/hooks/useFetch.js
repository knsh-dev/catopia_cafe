import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";

/**
 * Hook to fetch data from an API endpoint.
 * Returns { data, loading, error, refetch }.
 * Reacts dynamically to enabled status and custom dependency changes,
 * immediately clearing stale data on account switch or logout without cascading render loops.
 */
export function useFetch(path, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const { enabled = true, deps = [] } = options;
  const depsKey = JSON.stringify(deps);
  const isMountedRef = useRef(true);

  const refetch = useCallback(() => {
    setRefreshIndex((prev) => prev + 1);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled || !path) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let active = true;
    api
      .get(path)
      .then((result) => {
        if (active && isMountedRef.current) {
          setData(result);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active && isMountedRef.current) {
          setError(err);
          setData(null);
          setLoading(false);
        }
      });

    return () => {
      active = false;
      isMountedRef.current = false;
    };
  }, [path, enabled, depsKey, refreshIndex]);

  // Immediately wipe data on auth change (login / logout / account switch)
  useEffect(() => {
    const handleAuthChange = () => {
      setData(null);
      setError(null);
      setLoading(false);
    };

    window.addEventListener("catopia:auth-change", handleAuthChange);
    return () => window.removeEventListener("catopia:auth-change", handleAuthChange);
  }, []);

  return { data, loading, error, refetch };
}
