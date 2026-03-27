import { EstadoContrato, TipoTarifaContrato } from "@prisma/client";
import { redirect } from "next/navigation";
import { ProjectSelector } from "@/components/ui/ProjectSelector";
import { auth } from "@/lib/auth";
import {
  buildArrendatariosWhere,
  parseVigenteFilter,
  toContractMetrics
} from "@/lib/rent-roll/arrendatarios";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";

type ArrendatariosPageProps = {
  searchParams: {
    proyecto?: string;
    q?: string;
    vigente?: string;
  };
};

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
      <main className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Arrendatarios</h2>
        <p className="mt-2 text-sm text-slate-600">
          No hay proyectos activos. Debes crear al menos uno para visualizar arrendatarios.
        </p>
      </main>
    );
  }

  if (!searchParams.proyecto) {
    redirect(`/rent-roll/arrendatarios?proyecto=${selectedProjectId}`);
  }

  const q = searchParams.q?.trim() ?? "";
  const vigente = parseVigenteFilter(searchParams.vigente);
  const today = new Date();

  const arrendatarios = await prisma.arrendatario.findMany({
    where: buildArrendatariosWhere(selectedProjectId, { q, vigente }),
    include: {
      contratos: {
        where: { estado: EstadoContrato.VIGENTE },
        include: {
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
              vigenciaDesde: { lte: today }
            },
            orderBy: { vigenciaDesde: "desc" },
            take: 1,
            select: { tarifaBaseUfM2: true, pctAdministracion: true }
          }
        },
        orderBy: [{ fechaInicio: "desc" }]
      }
    },
    orderBy: { nombreComercial: "asc" }
  });

  return (
    <main className="space-y-4">
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Arrendatarios</h2>
            <p className="text-sm text-slate-600">Vista consolidada con contrato, tarifa y GGCC vigentes.</p>
          </div>
          <ProjectSelector
            projects={projects}
            selectedProjectId={selectedProjectId}
            preserve={{ q, vigente: searchParams.vigente ?? "" }}
          />
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
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
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Filtrar
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-600">
                <th className="px-4 py-3 font-semibold">Nombre comercial</th>
                <th className="px-4 py-3 font-semibold">{"Raz\u00f3n social"}</th>
                <th className="px-4 py-3 font-semibold">RUT</th>
                <th className="px-4 py-3 font-semibold">Vigente</th>
                <th className="px-4 py-3 font-semibold">Local actual</th>
                <th className="px-4 py-3 font-semibold">{"Tarifa vigente UF/m\u00b2"}</th>
                <th className="px-4 py-3 font-semibold">{"GGCC tarifa base UF/m\u00b2"}</th>
                <th className="px-4 py-3 font-semibold">{"GGCC % administraci\u00f3n"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {arrendatarios.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    No se encontraron arrendatarios para los filtros aplicados.
                  </td>
                </tr>
              ) : (
                arrendatarios.map((arrendatario) => {
                  const metrics = toContractMetrics(arrendatario.contratos[0] ?? null);
                  return (
                    <tr key={arrendatario.id} className="text-slate-800">
                      <td className="px-4 py-3 font-medium">{arrendatario.nombreComercial}</td>
                      <td className="px-4 py-3">{arrendatario.razonSocial}</td>
                      <td className="whitespace-nowrap px-4 py-3">{arrendatario.rut}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            arrendatario.vigente
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {arrendatario.vigente ? "S\u00ed" : "No"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{metrics.localActual}</td>
                      <td className="whitespace-nowrap px-4 py-3">{metrics.tarifaVigenteUfM2}</td>
                      <td className="whitespace-nowrap px-4 py-3">{metrics.ggccTarifaBaseUfM2}</td>
                      <td className="whitespace-nowrap px-4 py-3">{metrics.ggccPctAdministracion}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
