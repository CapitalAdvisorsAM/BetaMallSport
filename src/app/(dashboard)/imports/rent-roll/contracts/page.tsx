import { DataUploadType } from "@prisma/client";
import { redirect } from "next/navigation";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { UploadHistory } from "@/components/upload/UploadHistory";
import { UploadSection } from "@/components/upload/UploadSection";
import { canWrite, requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";
import { getUploadHistory } from "@/lib/plan/upload-history";

export default async function ImportsContractsPage(): Promise<JSX.Element> {
  const session = await requireSession();
  const { selectedProjectId } = await getProjectContext();
  if (!selectedProjectId) {
    redirect("/imports");
  }

  const canEdit = canWrite(session.user.role);

  const [units, tenants, uploadHistory] = await Promise.all([
    prisma.unit.findMany({
      where: { projectId: selectedProjectId },
      orderBy: { codigo: "asc" },
      select: { codigo: true }
    }),
    prisma.tenant.findMany({
      where: { projectId: selectedProjectId },
      orderBy: { nombreComercial: "asc" },
      select: { nombreComercial: true }
    }),
    getUploadHistory(selectedProjectId, DataUploadType.RENT_ROLL)
  ]);

  return (
    <main className="space-y-4">
      <ModuleHeader
        overline="Carga de Datos · Expectativa"
        title="Contratos"
        description="Sube contratos vigentes (plazos, tarifas y locales asociados): valida el preview y aplica los cambios en lote."
      />

      <section className="rounded-md border border-brand-200 bg-brand-50 p-4 text-sm text-brand-700 shadow-sm">
        Para cargar contratos por primera vez: sube Locales -&gt; Arrendatarios -&gt; Contratos en ese orden.
      </section>

      <UploadSection
        tipo="CONTRATOS"
        proyectoId={selectedProjectId}
        canEdit={canEdit}
        previewEndpoint="/api/plan/upload/contracts/preview"
        applyEndpoint="/api/plan/upload/contracts/apply"
        templateEndpoint="/api/plan/upload/contracts/template"
        contractReviewCatalogs={{
          localCodes: units.map((unit) => unit.codigo),
          arrendatarios: tenants.map((tenant) => ({
            id: tenant.nombreComercial,
            label: tenant.nombreComercial || "Arrendatario sin nombre"
          }))
        }}
        columns={[
          { key: "numeroContrato", label: "Contrato" },
          { key: "localCodigo", label: "Local" },
          { key: "arrendatarioNombre", label: "Arrendatario" },
          { key: "fechaInicio", label: "Inicio" },
          { key: "fechaTermino", label: "Termino" },
          { key: "tarifaTipo", label: "Tarifa tipo" },
          { key: "tarifaValor", label: "Tarifa valor" }
        ]}
      />

      <UploadHistory items={uploadHistory} />
    </main>
  );
}
