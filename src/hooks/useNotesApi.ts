import { extractApiErrorMessage } from "@/lib/http/client-errors";
import type {
  AnalysisNoteListResponse,
  AnalysisNoteRow,
  AnalysisViewKey,
  NoteStatusKey
} from "@/types/notes";

export type ListNotesQuery = {
  projectId: string;
  view?: AnalysisViewKey;
  lineKey?: string;
  status?: NoteStatusKey;
};

export type CreateNoteInput = {
  projectId: string;
  view: AnalysisViewKey;
  lineKey: string;
  body: string;
};

export type UpdateNoteInput = {
  body?: string;
  status?: NoteStatusKey;
};

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function useNotesApi(): {
  listNotes: (query: ListNotesQuery) => Promise<AnalysisNoteRow[]>;
  createNote: (input: CreateNoteInput) => Promise<AnalysisNoteRow>;
  updateNote: (id: string, projectId: string, input: UpdateNoteInput) => Promise<AnalysisNoteRow>;
  deleteNote: (id: string, projectId: string) => Promise<void>;
} {
  async function listNotes(query: ListNotesQuery): Promise<AnalysisNoteRow[]> {
    const url = `/api/notes${buildQuery({
      projectId: query.projectId,
      view: query.view,
      lineKey: query.lineKey,
      status: query.status
    })}`;
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      throw new Error(await extractApiErrorMessage(response, "No se pudieron cargar las notas."));
    }
    const payload = (await response.json()) as AnalysisNoteListResponse;
    return payload.data;
  }

  async function createNote(input: CreateNoteInput): Promise<AnalysisNoteRow> {
    const response = await fetch(`/api/notes${buildQuery({ projectId: input.projectId })}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    if (!response.ok) {
      throw new Error(await extractApiErrorMessage(response, "No se pudo guardar la nota."));
    }
    return (await response.json()) as AnalysisNoteRow;
  }

  async function updateNote(
    id: string,
    projectId: string,
    input: UpdateNoteInput
  ): Promise<AnalysisNoteRow> {
    const response = await fetch(`/api/notes/${id}${buildQuery({ projectId })}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    if (!response.ok) {
      throw new Error(await extractApiErrorMessage(response, "No se pudo actualizar la nota."));
    }
    return (await response.json()) as AnalysisNoteRow;
  }

  async function deleteNote(id: string, projectId: string): Promise<void> {
    const response = await fetch(`/api/notes/${id}${buildQuery({ projectId })}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      throw new Error(await extractApiErrorMessage(response, "No se pudo eliminar la nota."));
    }
  }

  return { listNotes, createNote, updateNote, deleteNote };
}
