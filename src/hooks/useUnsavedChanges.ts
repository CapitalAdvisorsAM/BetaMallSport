"use client";

import { useCallback, useEffect, useState } from "react";

type UseUnsavedChangesOptions = {
  isDirty: boolean;
  message?: string;
};

type UseUnsavedChangesReturn = {
  showConfirm: boolean;
  confirmNavigation: (callback: () => void) => void;
  cancelNavigation: () => void;
  proceedNavigation: () => void;
};

const DEFAULT_MESSAGE = "Tienes cambios sin guardar. ¿Seguro que deseas salir?";

export function useUnsavedChanges({
  isDirty,
  message = DEFAULT_MESSAGE,
}: UseUnsavedChangesOptions): UseUnsavedChangesReturn {
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!isDirty) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = message;
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, message]);

  const confirmNavigation = useCallback(
    (callback: () => void) => {
      if (!isDirty) {
        callback();
        return;
      }
      setPendingCallback(() => callback);
      setShowConfirm(true);
    },
    [isDirty]
  );

  const cancelNavigation = useCallback(() => {
    setShowConfirm(false);
    setPendingCallback(null);
  }, []);

  const proceedNavigation = useCallback(() => {
    setShowConfirm(false);
    if (pendingCallback) {
      pendingCallback();
      setPendingCallback(null);
    }
  }, [pendingCallback]);

  return { showConfirm, confirmNavigation, cancelNavigation, proceedNavigation };
}
