import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";

export default async function DashboardLayout({
  children
}: {
  children: ReactNode;
}): Promise<JSX.Element> {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto min-h-screen max-w-7xl p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Mall Sport Dashboard</h1>
          <p className="text-sm text-slate-600">{session.user.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-3 text-sm">
            <Link className="font-medium text-brand-700 hover:text-brand-500" href="/">
              Inicio
            </Link>
            <Link className="font-medium text-brand-700 hover:text-brand-500" href="/rent-roll">
              Rent Roll
            </Link>
          </nav>
          <a
            href="/api/auth/signout?callbackUrl=/login"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Cerrar sesion
          </a>
        </div>
      </header>
      {children}
    </div>
  );
}
