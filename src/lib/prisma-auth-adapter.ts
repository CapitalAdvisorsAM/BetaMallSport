import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { randomUUID } from "crypto";
import type { Adapter } from "next-auth/adapters";
import type { PrismaClient } from "@prisma/client";

/**
 * NextAuth + Prisma con columnas @db.Uuid: el cliente de Prisma puede enviar
 * un id por defecto que no es un UUID válido para Postgres. Forzamos UUID v4
 * en los creates que lo requieren.
 */
export function prismaAuthAdapter(prisma: PrismaClient): Adapter {
  const base = PrismaAdapter(prisma);

  return {
    ...base,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createUser: async (data: any) =>
      prisma.user.create({
        data: {
          id: randomUUID(),
          name: data.name,
          email: data.email,
          emailVerified: data.emailVerified,
          image: data.image,
        },
      }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createSession: async (session: any) =>
      prisma.session.create({
        data: {
          id: randomUUID(),
          sessionToken: session.sessionToken,
          userId: session.userId,
          expires: session.expires,
        },
      }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    linkAccount: async (account: any) =>
      prisma.account.create({
        data: {
          id: randomUUID(),
          userId: account.userId,
          type: account.type,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          refresh_token: account.refresh_token ?? null,
          access_token: account.access_token ?? null,
          expires_at: account.expires_at ?? null,
          token_type: account.token_type ?? null,
          scope: account.scope ?? null,
          id_token: account.id_token ?? null,
          session_state: account.session_state ?? null,
        },
      }),
  };
}
