"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/Spinner";

type EntityFormSectionProps = {
  mode: "create" | "edit";
  canEdit: boolean;
  isLoading?: boolean;
  onSubmit: () => void;
  submitCreateLabel: string;
  submitEditLabel: string;
  submittingLabel?: string;
  children?: ReactNode;
  actions?: ReactNode;
};

export function EntityFormSection({
  mode,
  canEdit,
  isLoading = false,
  onSubmit,
  submitCreateLabel,
  submitEditLabel,
  submittingLabel = "Guardando...",
  children,
  actions
}: EntityFormSectionProps): JSX.Element {
  return (
    <>
      {children}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="default"
          onClick={onSubmit}
          disabled={!canEdit || isLoading}
          className="rounded-full"
        >
          {isLoading ? (
            <>
              <Spinner className="mr-1.5" />
              {submittingLabel}
            </>
          ) : mode === "edit" ? (
            submitEditLabel
          ) : (
            submitCreateLabel
          )}
        </Button>
        {actions}
      </div>
    </>
  );
}
