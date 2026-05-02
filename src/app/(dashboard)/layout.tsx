import Image from "next/image";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { TopNavbar } from "@/components/navigation/TopNavbar";
import { Button } from "@/components/ui/button";
import { HelpButton } from "@/components/ui/HelpButton";
import { auth } from "@/lib/auth";
import { getProjectContext } from "@/lib/project";

export default async function DashboardLayout({
  children
}: {
  children: ReactNode;
}): Promise<JSX.Element> {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { projects, selectedProjectId } = await getProjectContext();
  const selectedProject = selectedProjectId
    ? projects.find((project) => project.id === selectedProjectId) ?? null
    : null;

  return (
    <div className="min-h-screen bg-[#f1f4f9]">
      <header className="bg-gradient-to-r from-brand-900 to-brand-700 shadow-lg">
        {/* Row 1: brand + controls */}
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 pt-2.5 pb-1 md:px-6">
          <div className="flex items-center gap-3">
            <Image
              src="/MallSportLogo.jpg"
              alt="Mall Sport"
              width={28}
              height={28}
              className="h-7 w-7 rounded-md object-cover ring-1 ring-white/20"
            />
            <div className="shrink-0">
              <p className="overline whitespace-nowrap text-white/55">Control de Gestión</p>
              <h1
                className="font-serif text-title font-medium leading-tight text-white"
                style={{ fontVariationSettings: '"opsz" 28, "wght" 500' }}
              >
                Mall Sport
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {selectedProject ? (
              <span className="max-w-[200px] truncate rounded-sm border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/85">
                <span className="overline mr-1.5 text-white/50">Proyecto</span>
                <span className="font-medium">{selectedProject.nombre}</span>
              </span>
            ) : null}
            <span className="max-w-[160px] truncate text-xs text-white/60">
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
        {/* Row 2: nav */}
        <div className="mx-auto max-w-7xl border-t border-white/10 px-4 md:px-6">
          <TopNavbar />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
      <HelpButton />
    </div>
  );
}
