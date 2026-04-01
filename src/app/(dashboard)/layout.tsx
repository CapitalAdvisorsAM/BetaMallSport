import Image from "next/image";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { TopNavbar } from "@/components/navigation/TopNavbar";
import { Button } from "@/components/ui/button";
import { HelpButton } from "@/components/ui/HelpButton";
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
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
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
                Control de Gestion
              </p>
              <h1 className="text-sm font-bold text-white">Mall Sport</h1>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center justify-between gap-3 md:w-auto md:flex-nowrap md:justify-end md:gap-6">
            <TopNavbar />
            <div className="hidden h-5 w-px bg-white/20 md:block" />
            <div className="flex items-center gap-3">
              <span className="max-w-[190px] truncate text-xs text-white/60 md:max-w-[220px]">
                {session.user.email}
              </span>
              <form method="POST" action="/api/auth/signout">
                <input type="hidden" name="callbackUrl" value="/login" />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="border-white/20 bg-transparent text-xs text-white/80 hover:border-white/40 hover:bg-white/10 hover:text-white"
                >
                  Salir
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
      <HelpButton />
    </div>
  );
}
