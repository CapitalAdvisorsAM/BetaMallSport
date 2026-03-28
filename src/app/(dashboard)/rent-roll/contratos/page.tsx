import { redirect } from "next/navigation";
import { ContractManager } from "@/components/contracts/ContractManager";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { ProjectSelector } from "@/components/ui/ProjectSelector";
import { auth } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";

type ContratosPageProps = {
  searchParams: {
    proyecto?: string;
  };
};

export default async function ContratosPage({
  searchParams
}: ContratosPageProps): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);

  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Contratos"
        description="No hay proyectos activos. Crea uno para habilitar el CRUD de contratos."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  if (!searchParams.proyecto) {
    redirect(`/rent-roll/contratos?proyecto=${selectedProjectId}`);
  }

  const [locals, arrendatarios, contracts] = await Promise.all([
    prisma.local.findMany({
      where: { proyectoId: selectedProjectId },
      orderBy: { codigo: "asc" },
      select: { id: true, codigo: true, nombre: true }
    }),
    prisma.arrendatario.findMany({
      where: { proyectoId: selectedProjectId },
      orderBy: { nombreComercial: "asc" },
      select: { id: true, nombreComercial: true }
    }),
    prisma.contrato.findMany({
      where: { proyectoId: selectedProjectId },
      include: {
        local: { select: { id: true, codigo: true, nombre: true } },
        arrendatario: { select: { id: true, nombreComercial: true, razonSocial: true } },
        tarifas: {
          orderBy: { vigenciaDesde: "desc" },
          select: {
            tipo: true,
            valor: true,
            vigenciaDesde: true,
            vigenciaHasta: true,
            esDiciembre: true
          }
        },
        ggcc: {
          orderBy: { vigenciaDesde: "desc" },
          select: {
            tarifaBaseUfM2: true,
            pctAdministracion: true,
            vigenciaDesde: true,
            vigenciaHasta: true,
            proximoReajuste: true
          }
        }
      },
      orderBy: { updatedAt: "desc" }
    })
  ]);

  return (
    <main className="space-y-4">
      <section className="rounded-md bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gold-400" />
              <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">
                Gestion de Contratos
              </h2>
            </div>
            <p className="text-sm text-slate-600">
              Crea y actualiza contratos, tarifas, GGCC y anexos.
            </p>
          </div>
          <ProjectSelector projects={projects} selectedProjectId={selectedProjectId} preserve={{}} />
        </div>
      </section>

      <ContractManager
        proyectoId={selectedProjectId}
        canEdit={canWrite(session.user.role)}
        locals={locals.map((local) => ({ id: local.id, label: `${local.codigo} - ${local.nombre}` }))}
        arrendatarios={arrendatarios.map((a) => ({ id: a.id, label: a.nombreComercial }))}
        contracts={contracts.map((contract) => ({
          id: contract.id,
          numeroContrato: contract.numeroContrato,
          estado: contract.estado,
          pdfUrl: contract.pdfUrl,
          fechaInicio: contract.fechaInicio.toISOString(),
          fechaTermino: contract.fechaTermino.toISOString(),
          local: contract.local,
          arrendatario: contract.arrendatario,
          tarifas: contract.tarifas.map((tarifa) => ({
            tipo: tarifa.tipo,
            valor: tarifa.valor.toString(),
            vigenciaDesde: tarifa.vigenciaDesde.toISOString().slice(0, 10),
            vigenciaHasta: tarifa.vigenciaHasta ? tarifa.vigenciaHasta.toISOString().slice(0, 10) : null,
            esDiciembre: tarifa.esDiciembre
          })),
          ggcc: contract.ggcc.map((item) => ({
            tarifaBaseUfM2: item.tarifaBaseUfM2.toString(),
            pctAdministracion: item.pctAdministracion.toString(),
            vigenciaDesde: item.vigenciaDesde.toISOString().slice(0, 10),
            vigenciaHasta: item.vigenciaHasta ? item.vigenciaHasta.toISOString().slice(0, 10) : null,
            proximoReajuste: item.proximoReajuste
              ? item.proximoReajuste.toISOString().slice(0, 10)
              : null
          }))
        }))}
      />
    </main>
  );
}
