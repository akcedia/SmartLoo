// Minimal History API router: no extra dependency for five routes.
// Links keep the session in memory instead of reloading the page.

import { useEffect, useState } from "react";

const listeners = new Set();

export function currentLocation() {
  if (typeof window === "undefined") return { path: "/", search: "" };
  return { path: window.location.pathname || "/", search: window.location.search };
}

export function navigate(to, { replace = false } = {}) {
  if (replace) window.history.replaceState(null, "", to);
  else window.history.pushState(null, "", to);
  listeners.forEach((fn) => fn());
  window.scrollTo?.(0, 0);
}

export function useLocation() {
  const [location, setLocation] = useState(currentLocation);
  useEffect(() => {
    const update = () => setLocation(currentLocation());
    listeners.add(update);
    window.addEventListener("popstate", update);
    return () => {
      listeners.delete(update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  return location;
}

// Only same-app paths are accepted as a post-sign-in destination.
export function safeReturnPath(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function signInPath(returnTo) {
  return returnTo && returnTo !== "/" ? `/sign-in?next=${encodeURIComponent(returnTo)}` : "/sign-in";
}

export function Link({ to, children, onClick, ...rest }) {
  function handleClick(event) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  }
  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
