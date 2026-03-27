import { redirect } from "next/navigation";
import { ContractManager } from "@/components/contracts/ContractManager";
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
      <main className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Contratos</h2>
        <p className="mt-2 text-sm text-slate-600">
          No hay proyectos activos. Debes crear al menos uno para gestionar contratos.
        </p>
      </main>
    );
  }

  if (!searchParams.proyecto) {
    redirect(`/contratos?proyecto=${selectedProjectId}`);
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
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Gestion de Contratos</h2>
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
