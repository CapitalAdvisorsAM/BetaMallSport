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
    <div className="min-h-screen bg-[#f1f4f9]">
      <header className="bg-brand-700 shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Image
              src="/MallSportLogo.jpg"
              alt="Mall Sport"
              width={32}
              height={32}
              className="h-8 w-8 rounded-md object-cover ring-1 ring-white/20"
            />
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-white/50">
                Control de Gestión
              </p>
              <h1 className="text-sm font-bold text-white">Mall Sport</h1>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <TopNavbar />
            <div className="h-5 w-px bg-white/20" />
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/60">{session.user.email}</span>
              <form method="POST" action="/api/auth/signout">
                <input type="hidden" name="callbackUrl" value="/login" />
                <button
                  type="submit"
                  className="rounded-md border border-white/20 px-3 py-1 text-xs font-medium text-white/80 transition-colors hover:border-white/40 hover:bg-white/10 hover:text-white"
                >
                  Salir
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
