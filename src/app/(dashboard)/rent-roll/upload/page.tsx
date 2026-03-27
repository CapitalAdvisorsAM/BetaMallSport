import { redirect } from "next/navigation";
import { ProjectSelector } from "@/components/ui/ProjectSelector";
import { RentRollUploadPanel } from "@/components/rent-roll/RentRollUploadPanel";
import { auth } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";
import type { RentRollPreviewPayload } from "@/types";

type UploadPageProps = {
  searchParams: {
    proyecto?: string;
    cargaId?: string;
  };
};

export default async function RentRollUploadPage({
  searchParams
}: UploadPageProps): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);

  if (!selectedProjectId) {
    return (
      <main className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Carga de Rent Roll</h2>
        <p className="mt-2 text-sm text-slate-600">
          No hay proyectos activos. Debes crear al menos un proyecto para cargar datos.
        </p>
      </main>
    );
  }

  if (!searchParams.proyecto) {
    redirect(`/rent-roll/upload?proyecto=${selectedProjectId}`);
  }

  let payload: RentRollPreviewPayload | null = null;
  if (searchParams.cargaId) {
    const carga = await prisma.cargaDatos.findUnique({ where: { id: searchParams.cargaId } });
    if (carga?.errorDetalle) {
      payload = JSON.parse(carga.errorDetalle) as RentRollPreviewPayload;
    }
  }

  return (
    <main className="space-y-4">
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Rent Roll: Carga Masiva</h2>
            <p className="text-sm text-slate-600">Sube CSV/XLSX, revisa preview y aplica cambios.</p>
          </div>
          <ProjectSelector projects={projects} selectedProjectId={selectedProjectId} preserve={{}} />
        </div>
      </section>

      <RentRollUploadPanel
        proyectoId={selectedProjectId}
        initialCargaId={searchParams.cargaId}
        initialPayload={payload}
        canEdit={canWrite(session.user.role)}
      />
    </main>
  );
}
