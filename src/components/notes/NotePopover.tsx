"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNotesApi } from "@/hooks/useNotesApi";
import { cn } from "@/lib/utils";
import type {
  AnalysisNoteRow,
  AnalysisViewKey,
  NoteStatusKey
} from "@/types/notes";

type NotePopoverProps = {
  projectId: string;
  view: AnalysisViewKey;
  lineKey: string;
  notes: AnalysisNoteRow[];
  canEdit: boolean;
  currentUserId: string;
  isAdmin: boolean;
  onChange: () => void;
};

type FilterTab = "all" | "open" | "resolved";

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function NoteStatusBadge({ status }: { status: NoteStatusKey }) {
  if (status === "RESOLVED") {
    return (
      <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
        Resuelta
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
      Abierta
    </span>
  );
}

export function NotePopover({
  projectId,
  view,
  lineKey,
  notes,
  canEdit,
  currentUserId,
  isAdmin,
  onChange
}: NotePopoverProps) {
  const router = useRouter();
  const api = useNotesApi();
  const [, startTransition] = useTransition();

  const [filter, setFilter] = useState<FilterTab>("all");
  const [draftBody, setDraftBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const filteredNotes = useMemo(() => {
    if (filter === "open") return notes.filter((note) => note.status === "OPEN");
    if (filter === "resolved") return notes.filter((note) => note.status === "RESOLVED");
    return notes;
  }, [notes, filter]);

  function refresh() {
    onChange();
    startTransition(() => router.refresh());
  }

  async function handleCreate() {
    const body = draftBody.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    try {
      await api.createNote({ projectId, view, lineKey, body });
      setDraftBody("");
      toast.success("Nota guardada.");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar la nota.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEdit(id: string) {
    const body = editingBody.trim();
    if (!body) return;
    setPendingId(id);
    try {
      await api.updateNote(id, projectId, { body });
      setEditingId(null);
      setEditingBody("");
      toast.success("Nota actualizada.");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar la nota.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleToggleStatus(note: AnalysisNoteRow) {
    setPendingId(note.id);
    const nextStatus: NoteStatusKey = note.status === "OPEN" ? "RESOLVED" : "OPEN";
    try {
      await api.updateNote(note.id, projectId, { status: nextStatus });
      toast.success(nextStatus === "RESOLVED" ? "Nota resuelta." : "Nota reabierta.");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al cambiar el estado.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(id: string) {
    setPendingId(id);
    try {
      await api.deleteNote(id, projectId);
      toast.success("Nota eliminada.");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al eliminar la nota.");
    } finally {
      setPendingId(null);
    }
  }

  function canManageNote(note: AnalysisNoteRow): boolean {
    return isAdmin || note.createdBy.id === currentUserId;
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-1 border-b border-slate-200 pb-2">
        {(["all", "open", "resolved"] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors",
              filter === tab ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {tab === "all" ? "Todas" : tab === "open" ? "Abiertas" : "Resueltas"}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500">{filteredNotes.length}</span>
      </div>

      <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
        {filteredNotes.length === 0 ? (
          <p className="text-xs text-slate-500">Sin notas en este filtro.</p>
        ) : (
          filteredNotes.map((note) => {
            const isEditing = editingId === note.id;
            const manageable = canManageNote(note);
            const busy = pendingId === note.id;
            return (
              <article
                key={note.id}
                className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3 shadow-sm"
              >
                <header className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-700">
                      {note.createdBy.name ?? note.createdBy.email ?? "Usuario"}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {formatTimestamp(note.createdAt)}
                    </span>
                  </div>
                  <NoteStatusBadge status={note.status} />
                </header>

                {isEditing ? (
                  <textarea
                    value={editingBody}
                    onChange={(event) => setEditingBody(event.target.value)}
                    className="min-h-[64px] w-full rounded-md border border-slate-300 p-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{note.body}</p>
                )}

                {canEdit && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isEditing ? (
                      <>
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          disabled={busy || editingBody.trim().length === 0}
                          onClick={() => handleSaveEdit(note.id)}
                        >
                          <Check className="mr-1 h-3.5 w-3.5" /> Guardar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            setEditingId(null);
                            setEditingBody("");
                          }}
                        >
                          <X className="mr-1 h-3.5 w-3.5" /> Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        {manageable && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                              setEditingId(note.id);
                              setEditingBody(note.body);
                            }}
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => handleToggleStatus(note)}
                        >
                          {note.status === "OPEN" ? (
                            <>
                              <Check className="mr-1 h-3.5 w-3.5" /> Resolver
                            </>
                          ) : (
                            <>
                              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reabrir
                            </>
                          )}
                        </Button>
                        {manageable && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => handleDelete(note.id)}
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" /> Eliminar
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {canEdit && (
        <div className="flex flex-col gap-2 border-t border-slate-200 pt-3">
          <textarea
            value={draftBody}
            onChange={(event) => setDraftBody(event.target.value)}
            placeholder="Escribe una nueva nota…"
            className="min-h-[72px] w-full rounded-md border border-slate-300 p-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            maxLength={5000}
          />
          <div className="flex items-center justify-end">
            <Button
              type="button"
              size="sm"
              disabled={submitting || draftBody.trim().length === 0}
              onClick={handleCreate}
            >
              Guardar nota
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
