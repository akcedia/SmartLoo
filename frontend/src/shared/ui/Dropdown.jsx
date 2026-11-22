// Compact dropdown used instead of native <select> where the design needs it
// (radius next to "Yakınımda", settings). A button shows the current value and a
// chevron; the list opens below, the current option is focused, choosing one or
// Escape closes it and focus returns to the button. Arrow keys move between options.
import { useEffect, useId, useRef, useState } from "react";
import "./dropdown.css";

export default function Dropdown({ label, value, options, onChange, className = "", buttonClassName = "", align = "right" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listId = useId();
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return undefined;
    rootRef.current?.querySelector('.sl-dropdown-menu [aria-checked="true"]')?.focus();
    function onKey(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointer(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  function pick(next) {
    onChange(next);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onMenuKey(e) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...rootRef.current.querySelectorAll(".sl-dropdown-menu [role=radio]")];
    const index = items.indexOf(document.activeElement);
    items[(index + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
  }

  return (
    <div className={`sl-dropdown ${className}`} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`sl-dropdown-button ${buttonClassName}`}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${current.label}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sl-dropdown-value">{current.label}</span>
        <svg className="sl-dropdown-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div id={listId} className={`sl-dropdown-menu sl-dropdown-menu--${align}`} role="radiogroup" aria-label={label} onKeyDown={onMenuKey}>
          {options.map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => pick(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
