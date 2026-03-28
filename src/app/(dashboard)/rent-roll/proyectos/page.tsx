import { redirect } from "next/navigation";
import { ProjectCrudPanel } from "@/components/rent-roll/ProjectCrudPanel";
import { auth } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function ProyectosPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

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
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Proyectos</h2>
        <p className="text-sm text-slate-600">
          Gestiona proyectos activos e inactivos para habilitar el resto de modulos.
        </p>
      </section>

      <ProjectCrudPanel canEdit={canWrite(session.user.role)} initialProjects={projects} />
    </main>
  );
}
