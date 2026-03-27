import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

const allowedEmailDomain = process.env.ALLOWED_EMAIL_DOMAIN?.toLowerCase().trim();

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database"
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ""
    })
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email || !allowedEmailDomain) {
        return false;
      }

      const domain = user.email.split("@")[1]?.toLowerCase();
      return domain === allowedEmailDomain;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = user.role;
      }

      return session;
    }
  },
  pages: {
    signIn: "/login"
  }
};

export const auth = () => getServerSession(authOptions);
