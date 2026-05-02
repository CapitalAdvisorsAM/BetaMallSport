import type { AnalysisView, NoteStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AnalysisNoteRow } from "@/types/notes";

export const noteIncludeArgs = {
  include: {
    createdBy: { select: { id: true, name: true, email: true } },
    updatedBy: { select: { id: true, name: true, email: true } },
    resolvedBy: { select: { id: true, name: true, email: true } }
  }
} satisfies Prisma.AnalysisNoteDefaultArgs;

export type NoteWithUsers = Prisma.AnalysisNoteGetPayload<typeof noteIncludeArgs>;

export type ListNotesInput = {
  projectId: string;
  view?: AnalysisView;
  lineKey?: string;
  status?: NoteStatus;
};

export async function listNotes(input: ListNotesInput): Promise<NoteWithUsers[]> {
  return prisma.analysisNote.findMany({
    where: {
      projectId: input.projectId,
      deletedAt: null,
      ...(input.view ? { view: input.view } : {}),
      ...(input.lineKey ? { lineKey: input.lineKey } : {}),
      ...(input.status ? { status: input.status } : {})
    },
    ...noteIncludeArgs,
    orderBy: { createdAt: "desc" }
  });
}

export async function findNoteById(input: {
  id: string;
  projectId: string;
}): Promise<NoteWithUsers | null> {
  return prisma.analysisNote.findFirst({
    where: {
      id: input.id,
      projectId: input.projectId,
      deletedAt: null
    },
    ...noteIncludeArgs
  });
}

export function serializeNote(note: NoteWithUsers): AnalysisNoteRow {
  return {
    id: note.id,
    projectId: note.projectId,
    lineKey: note.lineKey,
    view: note.view,
    body: note.body,
    status: note.status,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    resolvedAt: note.resolvedAt ? note.resolvedAt.toISOString() : null,
    createdBy: note.createdBy,
    updatedBy: note.updatedBy,
    resolvedBy: note.resolvedBy
  };
}
