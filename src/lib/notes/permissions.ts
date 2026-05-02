import type { Session } from "next-auth";
import { ApiError } from "@/lib/api-error";

type AuthorRef = { createdById: string };

export function isNoteAuthor(session: Session, note: AuthorRef): boolean {
  return note.createdById === session.user.id;
}

export function canManageNote(session: Session, note: AuthorRef): boolean {
  return isNoteAuthor(session, note) || session.user.role === "ADMIN";
}

export function assertCanManageNote(session: Session, note: AuthorRef): void {
  if (!canManageNote(session, note)) {
    throw new ApiError(403, "Solo el autor o un administrador puede modificar esta nota.");
  }
}
