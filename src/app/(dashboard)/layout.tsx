import Image from "next/image";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { TopNavbar } from "@/components/navigation/TopNavbar";
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
          <div className="flex items-center gap-3">
            <Image
              src="/MallSportLogo.jpg"
              alt="Mall Sport"
              width={36}
              height={36}
              className="h-9 w-9 rounded-lg"
            />
            <h1 className="text-xl font-semibold text-slate-900">Mall Sport Dashboard</h1>
          </div>
          <p className="text-sm text-slate-600">{session.user.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <TopNavbar />
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
