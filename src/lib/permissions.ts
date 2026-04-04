import type { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

const writeRoles: UserRole[] = ["ADMIN", "OPERACIONES"];

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError();
  }
  return session;
}

export function canWrite(role: UserRole): boolean {
  return writeRoles.includes(role);
}

export async function requireWriteAccess() {
  const session = await requireSession();
  if (!canWrite(session.user.role)) {
    throw new ForbiddenError();
  }
  return session;
}
