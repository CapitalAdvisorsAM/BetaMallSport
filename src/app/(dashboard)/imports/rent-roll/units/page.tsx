import { DataUploadType } from "@prisma/client";
import { redirect } from "next/navigation";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { UploadHistory } from "@/components/upload/UploadHistory";
import { UploadSection } from "@/components/upload/UploadSection";
import { canWrite, requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { getUploadHistory } from "@/lib/plan/upload-history";

export default async function ImportsUnitsPage(): Promise<JSX.Element> {
  const session = await requireSession();
  const { selectedProjectId } = await getProjectContext();
  if (!selectedProjectId) {
    redirect("/imports");
  }

  const canEdit = canWrite(session.user.role);
  const uploadHistory = await getUploadHistory(selectedProjectId, DataUploadType.UNITS);

  return (
    <main className="space-y-4">
      <ModuleHeader
        overline="Carga de Datos · Expectativa"
        title="Locales"
        description="Sube el maestro de unidades arrendables: valida el preview y aplica los cambios en lote."
      />

      <section className="rounded-md border border-brand-200 bg-brand-50 p-4 text-sm text-brand-700 shadow-sm">
        Para cargar contratos por primera vez: sube Locales -&gt; Arrendatarios -&gt; Contratos en ese orden.
      </section>

      <UploadSection
        tipo="LOCALES"
        proyectoId={selectedProjectId}
        canEdit={canEdit}
        previewEndpoint="/api/plan/upload/units/preview"
        applyEndpoint="/api/plan/upload/units/apply"
        templateEndpoint="/api/plan/upload/units/template"
        columns={[
          { key: "codigo", label: "Codigo" },
          { key: "nombre", label: "Nombre" },
          { key: "glam2", label: "GLA m2" },
          { key: "piso", label: "Piso" },
          { key: "tipo", label: "Tipo" },
          { key: "estado", label: "Estado" }
        ]}
      />

      <UploadHistory items={uploadHistory} />
    </main>
  );
}
