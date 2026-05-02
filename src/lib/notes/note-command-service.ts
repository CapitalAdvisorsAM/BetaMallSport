import type { Session } from "next-auth";
import { ApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { assertCanManageNote } from "./permissions";
import {
  findNoteById,
  noteIncludeArgs,
  type NoteWithUsers
} from "./note-query-service";
import type { NoteCreatePayload, NoteUpdatePayload } from "./schema";

async function loadOwnedNote(input: { id: string; projectId: string }): Promise<NoteWithUsers> {
  const note = await findNoteById(input);
  if (!note) {
    throw new ApiError(404, "Nota no encontrada.");
  }
  return note;
}

export async function createNote(input: {
  payload: NoteCreatePayload;
  userId: string;
}): Promise<NoteWithUsers> {
  return prisma.analysisNote.create({
    data: {
      projectId: input.payload.projectId,
      lineKey: input.payload.lineKey,
      view: input.payload.view,
      body: input.payload.body,
      createdById: input.userId
    },
    ...noteIncludeArgs
  });
}

export async function updateNote(input: {
  id: string;
  projectId: string;
  payload: NoteUpdatePayload;
  session: Session;
}): Promise<NoteWithUsers> {
  const existing = await loadOwnedNote({ id: input.id, projectId: input.projectId });
  assertCanManageNote(input.session, existing);

  const userId = input.session.user.id;
  const data: Parameters<typeof prisma.analysisNote.update>[0]["data"] = {
    updatedById: userId
  };

  if (input.payload.body !== undefined) {
    data.body = input.payload.body;
  }

  if (input.payload.status !== undefined && input.payload.status !== existing.status) {
    data.status = input.payload.status;
    if (input.payload.status === "RESOLVED") {
      data.resolvedAt = new Date();
      data.resolvedById = userId;
    } else {
      data.resolvedAt = null;
      data.resolvedById = null;
    }
  }

  return prisma.analysisNote.update({
    where: { id: existing.id },
    data,
    ...noteIncludeArgs
  });
}

export async function softDeleteNote(input: {
  id: string;
  projectId: string;
  session: Session;
}): Promise<void> {
  const existing = await loadOwnedNote({ id: input.id, projectId: input.projectId });
  assertCanManageNote(input.session, existing);

  await prisma.analysisNote.update({
    where: { id: existing.id },
    data: {
      deletedAt: new Date(),
      updatedById: input.session.user.id
    }
  });
}
