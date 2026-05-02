"use client";

import { useMemo } from "react";
import { MessageCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { AnalysisNoteRow, AnalysisViewKey } from "@/types/notes";
import { NotePopover } from "./NotePopover";

type NoteIndicatorProps = {
  projectId: string;
  view: AnalysisViewKey;
  lineKey: string;
  notes: AnalysisNoteRow[];
  canEdit: boolean;
  currentUserId: string;
  isAdmin: boolean;
  onChange: () => void;
  className?: string;
};

export function NoteIndicator({
  projectId,
  view,
  lineKey,
  notes,
  canEdit,
  currentUserId,
  isAdmin,
  onChange,
  className
}: NoteIndicatorProps) {
  const summary = useMemo(() => {
    const total = notes.length;
    const open = notes.filter((note) => note.status === "OPEN").length;
    return { total, open, allResolved: total > 0 && open === 0 };
  }, [notes]);

  const colorClass =
    summary.total === 0
      ? "text-slate-300 hover:text-slate-500"
      : summary.allResolved
        ? "text-emerald-600 hover:text-emerald-700"
        : "text-gold-400 hover:text-gold-500";

  const ariaLabel =
    summary.total === 0
      ? "Agregar nota"
      : `${summary.total} nota${summary.total === 1 ? "" : "s"}${summary.open > 0 ? `, ${summary.open} abierta${summary.open === 1 ? "" : "s"}` : ""}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "relative inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
            colorClass,
            className
          )}
        >
          <MessageCircle className="h-4 w-4" />
          {summary.open > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gold-400 px-1 text-[10px] font-semibold leading-none text-slate-900">
              {summary.open}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 max-w-[90vw]">
        <NotePopover
          projectId={projectId}
          view={view}
          lineKey={lineKey}
          notes={notes}
          canEdit={canEdit}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onChange={onChange}
        />
      </PopoverContent>
    </Popover>
  );
}
