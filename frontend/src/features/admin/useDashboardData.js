import { useCallback, useEffect, useRef, useState } from "react";

// Loads the summary for the current filters. A newer request aborts the
// previous one so a slow old response can never overwrite newer filters.
export function useDashboardData(adapter, filters, enabled) {
  const [state, setState] = useState({ status: "idle", data: null, error: null });
  const [reloadKey, setReloadKey] = useState(0);
  const controllerRef = useRef(null);
  const { district, from, to } = filters;

  useEffect(() => {
    if (!enabled) return undefined;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((s) => ({ status: "loading", data: s.data, error: null }));
    adapter
      .fetchSummary({ district, from, to }, { signal: controller.signal })
      .then((data) => setState({ status: "success", data, error: null }))
      .catch((error) => {
        if (error.name === "AbortError") return;
        setState({ status: "error", data: null, error });
      });
    return () => controller.abort();
  }, [adapter, district, from, to, enabled, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  return { ...state, reload };
}
