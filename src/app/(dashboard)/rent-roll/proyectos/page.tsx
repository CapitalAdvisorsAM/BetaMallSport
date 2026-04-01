import { ProjectCrudPanel } from "@/components/rent-roll/ProjectCrudPanel";
import { canWrite, requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function ProyectosPage(): Promise<JSX.Element> {
  const session = await requireSession();

  const projects = await prisma.proyecto.findMany({
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    select: {
      id: true,
      nombre: true,
      slug: true,
      color: true,
      activo: true
    }
  });

  return (
    <main className="space-y-4">
      <section className="rounded-md bg-white p-5 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gold-400" />
          <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">Proyectos</h2>
        </div>
        <p className="text-sm text-slate-600">
          Gestiona proyectos activos e inactivos para habilitar el resto de modulos.
        </p>
      </section>

      <ProjectCrudPanel canEdit={canWrite(session.user.role)} initialProjects={projects} />
    </main>
  );
}
