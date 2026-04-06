"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

type EntityActionsCellProps = {
  canEdit: boolean;
  loading?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  editLabel?: string;
  deleteLabel?: string;
  configureHref?: string;
  configureLabel?: string;
};

export function EntityActionsCell({
  canEdit,
  loading = false,
  onEdit,
  onDelete,
  editLabel = "Editar",
  deleteLabel = "Eliminar",
  configureHref,
  configureLabel = "Configurar"
}: EntityActionsCellProps): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      {configureHref ? (
        <Button asChild type="button" variant="ghost" disabled={!canEdit} className="h-auto px-2 py-1 text-xs">
          <Link href={configureHref}>{configureLabel}</Link>
        </Button>
      ) : null}
      {onEdit ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onEdit}
          disabled={!canEdit || loading}
          className="h-auto px-2 py-1 text-xs"
        >
          {editLabel}
        </Button>
      ) : null}
      {onDelete ? (
        <Button
          type="button"
          variant="destructive"
          onClick={onDelete}
          disabled={!canEdit || loading}
          className="h-auto px-2 py-1 text-xs"
        >
          {deleteLabel}
        </Button>
      ) : null}
    </div>
  );
}
