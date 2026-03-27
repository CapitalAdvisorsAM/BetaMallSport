import type { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";

const writeRoles: UserRole[] = ["ADMIN", "OPERACIONES"];

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export function canWrite(role: UserRole): boolean {
  return writeRoles.includes(role);
}

export async function requireWriteAccess() {
  const session = await requireSession();
  if (!canWrite(session.user.role)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}
