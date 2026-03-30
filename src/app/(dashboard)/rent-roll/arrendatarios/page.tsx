import { TipoTarifaContrato } from "@prisma/client";
import { redirect } from "next/navigation";
import { ArrendatariosCrudPanel } from "@/components/rent-roll/ArrendatariosCrudPanel";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { ProjectSelector } from "@/components/ui/ProjectSelector";
import { auth } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import {
  buildArrendatariosContractsWhere,
  parseVigenteFilter
} from "@/lib/rent-roll/arrendatarios";
import { formatUf } from "@/lib/kpi";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";

type ArrendatariosPageProps = {
  searchParams: {
    proyecto?: string;
    q?: string;
    vigente?: string;
  };
};

function getMonthBounds(date: Date): { start: Date; nextMonthStart: Date } {
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();

  return {
    start: new Date(Date.UTC(year, monthIndex, 1)),
    nextMonthStart: new Date(Date.UTC(year, monthIndex + 1, 1))
  };
}

function formatRentRollUf(value: { toString(): string } | null | undefined): string {
  const normalized = formatUf(value);
  if (normalized === "\u2014") {
    return normalized;
  }
  return Number(normalized).toLocaleString("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatContractDates(fechaInicio: Date, fechaTermino: Date): string {
  const formatter = new Intl.DateTimeFormat("es-CL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC"
  });
  return `${formatter.format(fechaInicio)} - ${formatter.format(fechaTermino)}`;
}

export default async function ArrendatariosPage({
  searchParams
}: ArrendatariosPageProps): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);
  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Arrendatarios"
        description="No hay proyectos activos. Crea uno para habilitar el CRUD de arrendatarios."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  if (!searchParams.proyecto) {
    redirect(`/rent-roll/arrendatarios?proyecto=${selectedProjectId}`);
  }

  const q = searchParams.q?.trim() ?? "";
  const vigente = parseVigenteFilter(searchParams.vigente);
  const today = new Date();
  const { start, nextMonthStart } = getMonthBounds(today);

  const [activeContracts, arrendatariosCrud] = await Promise.all([
    prisma.contrato.findMany({
      where: buildArrendatariosContractsWhere(
        selectedProjectId,
        { start, nextMonthStart },
        { q, vigente }
      ),
      include: {
        arrendatario: {
          select: {
            nombreComercial: true,
            rut: true,
            vigente: true
          }
        },
        local: {
          select: { codigo: true, nombre: true }
        },
        tarifas: {
          where: {
            tipo: TipoTarifaContrato.FIJO_UF_M2,
            vigenciaDesde: { lte: today },
            OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: today } }]
          },
          orderBy: { vigenciaDesde: "desc" },
          take: 1,
          select: { valor: true }
        },
        ggcc: {
          where: {
            vigenciaDesde: { lte: today },
            OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: today } }]
          },
          orderBy: { vigenciaDesde: "desc" },
          take: 1,
          select: { tarifaBaseUfM2: true, pctAdministracion: true }
        }
      },
      orderBy: [{ arrendatario: { nombreComercial: "asc" } }, { fechaInicio: "desc" }]
    }),
    prisma.arrendatario.findMany({
      where: { proyectoId: selectedProjectId },
      orderBy: { nombreComercial: "asc" }
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
                Arrendatarios
              </h2>
            </div>
            <p className="text-sm text-slate-600">
              Contratos en estado OCUPADO o GRACIA del periodo actual. Un arrendatario puede
              aparecer m&aacute;s de una vez si tiene varios locales.
            </p>
          </div>
          <ProjectSelector
            projects={projects}
            selectedProjectId={selectedProjectId}
            preserve={{ q, vigente: searchParams.vigente ?? "" }}
          />
        </div>
      </section>

      <section className="rounded-md bg-white p-4 shadow-sm">
        <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <input type="hidden" name="proyecto" value={selectedProjectId} />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre comercial o RUT"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-brand-500 focus:ring-2"
          />
          <select
            name="vigente"
            defaultValue={searchParams.vigente ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-brand-500 focus:ring-2"
          >
            <option value="">Todos</option>
            <option value="vigente">Vigente</option>
            <option value="no-vigente">No vigente</option>
          </select>
          <button
            type="submit"
            className="rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Filtrar
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-md bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-brand-700">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                  Arrendatario
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                  RUT
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                  Vigente
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                  N&deg; contrato
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                  Local
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                  Fechas contrato
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                  {"Tarifa UF/m\u00b2"}
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                  {"GGCC base UF/m\u00b2"}
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                  GGCC % Admin
                </th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {activeContracts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                    No se encontraron contratos activos para los filtros aplicados.
                  </td>
                </tr>
              ) : (
                activeContracts.map((contract, index) => {
                  const ggccRecord = contract.ggcc[0];
                  const localDisplay = contract.local
                    ? `${contract.local.codigo} - ${contract.local.nombre}`
                    : "\u2014";
                  return (
                    <tr
                      key={contract.id}
                      className={cn(
                        "text-slate-800 transition-colors hover:bg-brand-50",
                        index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                      )}
                    >
                      <td className="px-4 py-3 font-medium">{contract.arrendatario.nombreComercial}</td>
                      <td className="whitespace-nowrap px-4 py-3">{contract.arrendatario.rut}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            contract.arrendatario.vigente
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {contract.arrendatario.vigente ? "S\u00ed" : "No"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{contract.numeroContrato}</td>
                      <td className="whitespace-nowrap px-4 py-3">{localDisplay}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatContractDates(contract.fechaInicio, contract.fechaTermino)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatRentRollUf(contract.tarifas[0]?.valor)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatRentRollUf(ggccRecord?.tarifaBaseUfM2)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatRentRollUf(ggccRecord?.pctAdministracion)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ArrendatariosCrudPanel
        proyectoId={selectedProjectId}
        canEdit={canWrite(session.user.role)}
        initialArrendatarios={arrendatariosCrud.map((arrendatario) => ({
          id: arrendatario.id,
          proyectoId: arrendatario.proyectoId,
          rut: arrendatario.rut,
          razonSocial: arrendatario.razonSocial,
          nombreComercial: arrendatario.nombreComercial,
          vigente: arrendatario.vigente,
          email: arrendatario.email,
          telefono: arrendatario.telefono
        }))}
      />
    </main>
  );
}
