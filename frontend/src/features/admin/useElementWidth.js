import { useEffect, useRef, useState } from "react";

// Measures an element's content width and follows resizes/rotations.
// Falls back to `initial` where ResizeObserver is unavailable (SSR, old browsers).
export function useElementWidth(initial) {
  const ref = useRef(null);
  const [width, setWidth] = useState(initial);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
