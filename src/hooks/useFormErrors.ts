import { useCallback, useMemo, useState } from "react";

type UseFormErrorsReturn = {
  errors: Record<string, string>;
  setFieldError: (field: string, message: string) => void;
  clearFieldError: (field: string) => void;
  clearAll: () => void;
  hasErrors: boolean;
};

export function useFormErrors(): UseFormErrorsReturn {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setFieldError = useCallback((field: string, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setErrors({});
  }, []);

  const hasErrors = useMemo(
    () => Object.keys(errors).length > 0,
    [errors],
  );

  return { errors, setFieldError, clearFieldError, clearAll, hasErrors };
}

/**
 * Focus the first element with aria-invalid="true" inside a container.
 * Call after setting validation errors so the DOM has updated.
 */
export function focusFirstInvalid(container: HTMLElement): void {
  const el = container.querySelector<HTMLElement>('[aria-invalid="true"]');
  el?.focus();
}
