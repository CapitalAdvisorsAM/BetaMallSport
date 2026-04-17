import { redirect } from "next/navigation";
import { canWrite, requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getSelectedProjectCookie } from "@/lib/project-cookie";
import { selectProjectAction } from "./actions";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";

export const dynamic = "force-dynamic";

export default async function HomePage(): Promise<JSX.Element> {
  const session = await requireSession();

  const projects = await prisma.project.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, color: true }
  });

  const cookieProjectId = getSelectedProjectCookie();
  if (cookieProjectId && projects.some((project) => project.id === cookieProjectId)) {
    redirect("/dashboard");
  }

  if (projects.length === 0) {
    return (
      <main className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-md bg-white p-6 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gold-400" />
            <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">
              Bienvenido
            </h2>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            No hay proyectos activos. Crea el primero para comenzar.
          </p>
        </header>
        <ProjectCreationPanel
          title="Crear primer proyecto"
          description="Este sera el proyecto inicial de tu portafolio."
          canEdit={canWrite(session.user.role)}
        />
      </main>
    );
  }

  if (projects.length === 1) {
    await selectProjectAction(projects[0].id);
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <header className="rounded-md bg-white p-6 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gold-400" />
          <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">
            Selecciona un proyecto
          </h2>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Elige el proyecto con el que quieres trabajar. Podras cambiar volviendo al inicio.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const accentColor = project.color || "#0f766e";
          const action = selectProjectAction.bind(null, project.id);
          return (
            <form key={project.id} action={action}>
              <button
                type="submit"
                className="group flex w-full flex-col items-start gap-3 rounded-md border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
              >
                <div className="flex w-full items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="h-10 w-10 flex-shrink-0 rounded-md"
                    style={{ backgroundColor: accentColor }}
                  />
                  <div className="flex-1 truncate">
                    <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
                      Proyecto
                    </p>
                    <p className="truncate text-base font-bold text-brand-700">
                      {project.nombre}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-medium text-brand-500 group-hover:text-brand-700">
                  Entrar -&gt;
                </span>
              </button>
            </form>
          );
        })}
      </section>
    </main>
  );
}
