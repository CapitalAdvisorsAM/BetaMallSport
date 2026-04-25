import { DataUploadType } from "@prisma/client";
import { redirect } from "next/navigation";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { UploadHistory } from "@/components/upload/UploadHistory";
import { UploadSection } from "@/components/upload/UploadSection";
import { canWrite, requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { getUploadHistory } from "@/lib/plan/upload-history";

export default async function ImportsTenantsPage(): Promise<JSX.Element> {
  const session = await requireSession();
  const { selectedProjectId } = await getProjectContext();
  if (!selectedProjectId) {
    redirect("/imports");
  }

  const canEdit = canWrite(session.user.role);
  const uploadHistory = await getUploadHistory(selectedProjectId, DataUploadType.TENANTS);

  return (
    <main className="space-y-4">
      <ModuleHeader
        overline="Carga de Datos · Expectativa"
        title="Arrendatarios"
        description="Sube el maestro de tenants: valida el preview y aplica los cambios en lote."
      />

      <section className="rounded-md border border-brand-200 bg-brand-50 p-4 text-sm text-brand-700 shadow-sm">
        Para cargar contratos por primera vez: sube Locales -&gt; Arrendatarios -&gt; Contratos en ese orden.
      </section>

      <UploadSection
        tipo="ARRENDATARIOS"
        proyectoId={selectedProjectId}
        canEdit={canEdit}
        previewEndpoint="/api/plan/upload/tenants/preview"
        applyEndpoint="/api/plan/upload/tenants/apply"
        templateEndpoint="/api/plan/upload/tenants/template"
        columns={[
          { key: "rut", label: "RUT" },
          { key: "razonSocial", label: "Razon social" },
          { key: "nombreComercial", label: "Nombre comercial" },
          { key: "vigente", label: "Vigente" },
          { key: "email", label: "Email" },
          { key: "telefono", label: "Telefono" }
        ]}
      />

      <UploadHistory items={uploadHistory} />
    </main>
  );
}
