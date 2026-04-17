import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { type Prisma } from "@prisma/client";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { UnifiedTable } from "@/components/ui/UnifiedTable";
import { getStripedRowClass, getTableTheme } from "@/components/ui/table-theme";
import { Button } from "@/components/ui/button";
import { canWrite, requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";
import { cn, formatDate, formatUf } from "@/lib/utils";
import { MS_PER_DAY } from "@/lib/constants";

const detailQueryArgs = {
  include: {
    local: { select: { id: true, codigo: true, nombre: true, glam2: true, piso: true, tipo: true } },
    locales: {
      include: {
        local: { select: { id: true, codigo: true, nombre: true, glam2: true, piso: true, tipo: true } }
      },
      orderBy: { createdAt: "asc" as const }
    },
    arrendatario: {
      select: {
        id: true, nombreComercial: true, razonSocial: true,
        rut: true, email: true, telefono: true, vigente: true
      }
    },
    tarifas: { orderBy: { vigenciaDesde: "desc" as const } },
    ggcc: { orderBy: { vigenciaDesde: "desc" as const } },
    anexos: { orderBy: { fecha: "desc" as const } },
  }
} satisfies Prisma.ContractDefaultArgs;

type ContractDetailRow = Prisma.ContractGetPayload<typeof detailQueryArgs>;

const compactTableTheme = getTableTheme("compact");

function getAssociatedLocales(contract: ContractDetailRow) {
  if (contract.locales.length > 0) {
    return contract.locales.map((item) => item.local);
  }
  return [contract.local];
}

function getDiasRestantes(fechaTermino: Date): number {
  return Math.max(0, Math.round((fechaTermino.getTime() - Date.now()) / MS_PER_DAY));
}

function diasRestantesColor(dias: number): string {
  if (dias <= 30) return "text-rose-600";
  if (dias <= 90) return "text-amber-600";
  return "text-emerald-600";
}

function rateLabel(tipo: string): string {
  switch (tipo) {
    case "FIJO_UF_M2": return "UF/m\u00b2";
    case "FIJO_UF": return "UF fija";
    case "PORCENTAJE": return "% Variable";
    default: return tipo;
  }
}

export default async function ContractDetailPage({
  params,
}: {
  params: { id: string };
}): Promise<JSX.Element> {
  const session = await requireSession();
  const { selectedProjectId } = await getProjectContext();
  const canEdit = canWrite(session.user.role);

  if (!selectedProjectId) {
    redirect("/");
  }

  const contract = await prisma.contract.findFirst({
    where: { id: params.id, proyectoId: selectedProjectId },
    ...detailQueryArgs,
  }) as ContractDetailRow | null;

  if (!contract) notFound();

  const units = getAssociatedLocales(contract);
  const diasRestantes = getDiasRestantes(contract.fechaTermino);

  return (
    <main className="space-y-4">
      <Breadcrumb items={[
        { label: "Rent Roll", href: "/rent-roll" },
        { label: "Contratos", href: "/rent-roll/contracts" },
        { label: `Contrato ${contract.numeroContrato}` },
      ]} />

      <section className="space-y-5 rounded-md border border-brand-200 bg-brand-50 p-5 shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-bold text-brand-700">
              Contrato {contract.numeroContrato}
            </h3>
            <StatusBadge status={contract.estado} />
            <span className={cn(
              "text-xs font-semibold tabular-nums",
              diasRestantesColor(diasRestantes)
            )}>
              {diasRestantes} dias restantes
            </span>
          </div>
          <div className="flex items-center gap-2">
            {contract.pdfUrl ? (
              <Button asChild type="button" variant="outline" size="sm">
                <a href={contract.pdfUrl} target="_blank" rel="noreferrer">
                  Ver PDF
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        {/* Informacion General */}
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Informacion General</h4>
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            <div>
              <p className="text-slate-400">Arrendatario</p>
              <Link
                href={`/tenants/${contract.arrendatario.id}`}
                className="font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700"
              >
                {contract.arrendatario.nombreComercial}
              </Link>
            </div>
            {contract.arrendatario.razonSocial ? (
              <div>
                <p className="text-slate-400">Razon social</p>
                <p className="font-medium text-slate-700">{contract.arrendatario.razonSocial}</p>
              </div>
            ) : null}
            <div>
              <p className="text-slate-400">RUT</p>
              <p className="font-medium tabular-nums text-slate-700">{contract.arrendatario.rut}</p>
            </div>
            <div>
              <p className="text-slate-400">Fecha inicio</p>
              <p className="font-medium tabular-nums text-slate-700">{formatDate(contract.fechaInicio)}</p>
            </div>
            <div>
              <p className="text-slate-400">Fecha termino</p>
              <p className="font-medium tabular-nums text-slate-700">{formatDate(contract.fechaTermino)}</p>
            </div>
            {contract.fechaEntrega ? (
              <div>
                <p className="text-slate-400">Fecha entrega</p>
                <p className="font-medium tabular-nums text-slate-700">{formatDate(contract.fechaEntrega)}</p>
              </div>
            ) : null}
            {contract.fechaApertura ? (
              <div>
                <p className="text-slate-400">Fecha apertura</p>
                <p className="font-medium tabular-nums text-slate-700">{formatDate(contract.fechaApertura)}</p>
              </div>
            ) : null}
            {contract.diasGracia > 0 ? (
              <div>
                <p className="text-slate-400">Dias de gracia</p>
                <p className="font-medium tabular-nums text-slate-700">{contract.diasGracia}</p>
              </div>
            ) : null}
            {contract.codigoCC ? (
              <div>
                <p className="text-slate-400">Codigo CC</p>
                <p className="font-medium text-slate-700">{contract.codigoCC}</p>
              </div>
            ) : null}
            {contract.pctFondoPromocion ? (
              <div>
                <p className="text-slate-400">Fondo promocion</p>
                <p className="font-medium tabular-nums text-slate-700">{contract.pctFondoPromocion.toString()}%</p>
              </div>
            ) : null}
            {contract.multiplicadorDiciembre ? (
              <div>
                <p className="text-slate-400">Multiplicador diciembre</p>
                <p className="font-medium tabular-nums text-slate-700">{contract.multiplicadorDiciembre.toString()}x</p>
              </div>
            ) : null}
            {contract.multiplicadorJunio ? (
              <div>
                <p className="text-slate-400">Multiplicador junio</p>
                <p className="font-medium tabular-nums text-slate-700">{contract.multiplicadorJunio.toString()}x</p>
              </div>
            ) : null}
            {contract.multiplicadorAgosto ? (
              <div>
                <p className="text-slate-400">Multiplicador agosto</p>
                <p className="font-medium tabular-nums text-slate-700">{contract.multiplicadorAgosto.toString()}x</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Contacto arrendatario */}
        {contract.arrendatario.email || contract.arrendatario.telefono ? (
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Contacto Arrendatario</h4>
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              {contract.arrendatario.email ? (
                <div>
                  <p className="text-slate-400">Email</p>
                  <a href={`mailto:${contract.arrendatario.email}`} className="font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700">
                    {contract.arrendatario.email}
                  </a>
                </div>
              ) : null}
              {contract.arrendatario.telefono ? (
                <div>
                  <p className="text-slate-400">Telefono</p>
                  <a href={`tel:${contract.arrendatario.telefono}`} className="font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700">
                    {contract.arrendatario.telefono}
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Locales */}
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Locales</h4>
          {units.length === 1 ? (
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div>
                <p className="text-slate-400">Codigo</p>
                <p className="font-medium text-slate-700">{units[0].codigo}</p>
              </div>
              <div>
                <p className="text-slate-400">Nombre</p>
                <p className="font-medium text-slate-700">{units[0].nombre}</p>
              </div>
              <div>
                <p className="text-slate-400">Superficie</p>
                <p className="font-medium tabular-nums text-slate-700">{Number(units[0].glam2).toFixed(2)} m{"\u00b2"}</p>
              </div>
              <div>
                <p className="text-slate-400">Piso</p>
                <p className="font-medium text-slate-700">{units[0].piso}</p>
              </div>
            </div>
          ) : (
            <UnifiedTable density="compact">
              <table className={`${compactTableTheme.table} text-xs`}>
                <thead className={compactTableTheme.head}>
                  <tr>
                    <th className={compactTableTheme.compactHeadCell}>Codigo</th>
                    <th className={compactTableTheme.compactHeadCell}>Nombre</th>
                    <th className={`${compactTableTheme.compactHeadCell} text-right`}>m{"\u00b2"}</th>
                    <th className={compactTableTheme.compactHeadCell}>Piso</th>
                    <th className={compactTableTheme.compactHeadCell}>Tipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {units.map((loc, index) => (
                    <tr
                      key={loc.id}
                      className={`${getStripedRowClass(index, "compact")} ${compactTableTheme.rowHover}`}
                    >
                      <td className={`${compactTableTheme.compactCell} font-medium text-slate-800`}>{loc.codigo}</td>
                      <td className={compactTableTheme.compactCell}>{loc.nombre}</td>
                      <td className={`${compactTableTheme.compactCell} text-right tabular-nums`}>{Number(loc.glam2).toFixed(2)}</td>
                      <td className={compactTableTheme.compactCell}>{loc.piso}</td>
                      <td className={compactTableTheme.compactCell}>{loc.tipo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </UnifiedTable>
          )}
        </div>

        {/* Tarifas */}
        {contract.tarifas.length > 0 ? (
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Tarifas</h4>
            <UnifiedTable density="compact">
              <table className={`${compactTableTheme.table} text-xs`}>
                <thead className={compactTableTheme.head}>
                  <tr>
                    <th className={compactTableTheme.compactHeadCell}>Tipo</th>
                    <th className={`${compactTableTheme.compactHeadCell} text-right`}>Valor</th>
                    <th className={compactTableTheme.compactHeadCell}>Vigencia desde</th>
                    <th className={compactTableTheme.compactHeadCell}>Vigencia hasta</th>
                    <th className={`${compactTableTheme.compactHeadCell} text-center`}>Diciembre</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contract.tarifas.map((tarifa, index) => (
                    <tr
                      key={`${tarifa.tipo}-${tarifa.vigenciaDesde.toISOString()}-${index}`}
                      className={`${getStripedRowClass(index, "compact")} ${compactTableTheme.rowHover}`}
                    >
                      <td className={`${compactTableTheme.compactCell} font-medium text-slate-800`}>{rateLabel(tarifa.tipo)}</td>
                      <td className={`${compactTableTheme.compactCell} text-right tabular-nums`}>
                        {formatUf(Number(tarifa.valor))}
                      </td>
                      <td className={`${compactTableTheme.compactCell} tabular-nums`}>
                        {formatDate(tarifa.vigenciaDesde)}
                      </td>
                      <td className={`${compactTableTheme.compactCell} tabular-nums`}>
                        {tarifa.vigenciaHasta ? formatDate(tarifa.vigenciaHasta) : "\u2014"}
                      </td>
                      <td className={`${compactTableTheme.compactCell} text-center`}>
                        {tarifa.esDiciembre ? "Si" : "No"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </UnifiedTable>
          </div>
        ) : null}

        {/* Gastos Comunes (GGCC) */}
        {contract.ggcc.length > 0 ? (
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Gastos Comunes (GGCC)</h4>
            <UnifiedTable density="compact">
              <table className={`${compactTableTheme.table} text-xs`}>
                <thead className={compactTableTheme.head}>
                  <tr>
                    <th className={`${compactTableTheme.compactHeadCell} text-right`}>Tarifa base UF/m{"\u00b2"}</th>
                    <th className={`${compactTableTheme.compactHeadCell} text-right`}>% Admin.</th>
                    <th className={`${compactTableTheme.compactHeadCell} text-right`}>% Reajuste</th>
                    <th className={compactTableTheme.compactHeadCell}>Desde</th>
                    <th className={compactTableTheme.compactHeadCell}>Hasta</th>
                    <th className={compactTableTheme.compactHeadCell}>Prox. reajuste</th>
                    <th className={`${compactTableTheme.compactHeadCell} text-center`}>Meses</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contract.ggcc.map((item, index) => (
                    <tr
                      key={`${item.vigenciaDesde.toISOString()}-${index}`}
                      className={`${getStripedRowClass(index, "compact")} ${compactTableTheme.rowHover}`}
                    >
                      <td className={`${compactTableTheme.compactCell} text-right tabular-nums`}>
                        {formatUf(Number(item.tarifaBaseUfM2))}
                      </td>
                      <td className={`${compactTableTheme.compactCell} text-right tabular-nums`}>
                        {item.pctAdministracion.toString()}%
                      </td>
                      <td className={`${compactTableTheme.compactCell} text-right tabular-nums`}>
                        {item.pctReajuste ? `${item.pctReajuste.toString()}%` : "\u2014"}
                      </td>
                      <td className={`${compactTableTheme.compactCell} tabular-nums`}>
                        {formatDate(item.vigenciaDesde)}
                      </td>
                      <td className={`${compactTableTheme.compactCell} tabular-nums`}>
                        {item.vigenciaHasta ? formatDate(item.vigenciaHasta) : "\u2014"}
                      </td>
                      <td className={`${compactTableTheme.compactCell} tabular-nums`}>
                        {item.proximoReajuste ? formatDate(item.proximoReajuste) : "\u2014"}
                      </td>
                      <td className={`${compactTableTheme.compactCell} text-center tabular-nums`}>
                        {item.mesesReajuste ?? "\u2014"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </UnifiedTable>
          </div>
        ) : null}

        {/* Anexos */}
        {contract.anexos.length > 0 ? (
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Anexos</h4>
            <div className="space-y-1.5">
              {contract.anexos.map((anexo) => (
                <div key={anexo.id} className="flex items-start gap-3 text-xs">
                  <span className="shrink-0 tabular-nums text-slate-400">{formatDate(anexo.fecha)}</span>
                  <span className="text-slate-600">{anexo.descripcion}</span>
                  {Array.isArray(anexo.camposModificados) && (anexo.camposModificados as string[]).length > 0 ? (
                    <span className="text-slate-400">({(anexo.camposModificados as string[]).join(", ")})</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Notas */}
        {contract.notas ? (
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Notas</h4>
            <p className="whitespace-pre-wrap text-xs text-slate-600">{contract.notas}</p>
          </div>
        ) : null}

        {/* Meta */}
        <div className="flex flex-wrap gap-4 border-t border-brand-100 pt-2 text-[10px] text-slate-300">
          <span>Creado: {formatDate(contract.createdAt)}</span>
          <span>Actualizado: {formatDate(contract.updatedAt)}</span>
        </div>
      </section>
    </main>
  );
}
