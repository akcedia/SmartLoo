import { useEffect } from "react";

// After a rejected submit, move focus to the form-level alert or the first invalid
// field, so keyboard and screen-reader users land on what needs fixing.
export function focusFirstError(form) {
  if (!form) return;
  const target = form.querySelector('[role="alert"]') ?? form.querySelector('[aria-invalid="true"]');
  if (!target) return;
  if (target.getAttribute("role") === "alert" && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus();
}

// `attempt` changes on every rejected submit, so the same error focuses again.
export function useFocusFirstError(formRef, attempt) {
  useEffect(() => {
    if (attempt > 0) focusFirstError(formRef.current);
  }, [formRef, attempt]);
}
