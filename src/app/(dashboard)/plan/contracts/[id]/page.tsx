import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { type Prisma } from "@prisma/client";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { UnifiedTable } from "@/components/ui/UnifiedTable";
import { getStripedRowClass, getTableTheme } from "@/components/ui/table-theme";
import { Button } from "@/components/ui/button";
import { ContractDetailEditButton } from "@/components/contracts/ContractDetailEditButton";
import { ContractDetailDeleteButton } from "@/components/contracts/ContractDetailDeleteButton";
import { canWrite, requireSession } from "@/lib/permissions";
import { legacyDiscountFields } from "@/lib/contracts/rate-history";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";
import { cn, formatDate, formatDateString, formatUf } from "@/lib/utils";
import { MS_PER_DAY } from "@/lib/constants";
import type { ContractManagerListItem } from "@/types";

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
    tarifas: {
      where: { supersededAt: null },
      include: {
        discounts: { where: { supersededAt: null }, orderBy: { vigenciaDesde: "asc" as const } }
      },
      orderBy: { vigenciaDesde: "desc" as const }
    },
    ggcc: { where: { supersededAt: null }, orderBy: { vigenciaDesde: "desc" as const } },
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

  const [contract, allUnits, allTenants] = await Promise.all([
    prisma.contract.findFirst({
      where: { id: params.id, projectId: selectedProjectId },
      ...detailQueryArgs,
    }) as Promise<ContractDetailRow | null>,
    canEdit
      ? prisma.unit.findMany({
          where: { projectId: selectedProjectId },
          select: { id: true, codigo: true },
          orderBy: { codigo: "asc" }
        })
      : Promise.resolve([] as Array<{ id: string; codigo: string }>),
    canEdit
      ? prisma.tenant.findMany({
          where: { projectId: selectedProjectId },
          select: { id: true, nombreComercial: true },
          orderBy: { nombreComercial: "asc" }
        })
      : Promise.resolve([] as Array<{ id: string; nombreComercial: string }>)
  ]);

  if (!contract) notFound();

  const units = getAssociatedLocales(contract);
  const diasRestantes = getDiasRestantes(contract.fechaTermino);

  const editableContract: ContractManagerListItem = {
    id: contract.id,
    numeroContrato: contract.numeroContrato,
    diasGracia: contract.diasGracia,
    cuentaParaVacancia: contract.cuentaParaVacancia,
    estado: contract.estado,
    pdfUrl: contract.pdfUrl,
    fechaInicio: contract.fechaInicio.toISOString(),
    fechaTermino: contract.fechaTermino.toISOString(),
    fechaEntrega: contract.fechaEntrega?.toISOString().slice(0, 10) ?? null,
    fechaApertura: contract.fechaApertura?.toISOString().slice(0, 10) ?? null,
    pctFondoPromocion: contract.pctFondoPromocion?.toString() ?? null,
    pctAdministracionGgcc: contract.pctAdministracionGgcc?.toString() ?? null,
    multiplicadorDiciembre: contract.multiplicadorDiciembre?.toString() ?? null,
    multiplicadorJunio: contract.multiplicadorJunio?.toString() ?? null,
    multiplicadorJulio: contract.multiplicadorJulio?.toString() ?? null,
    multiplicadorAgosto: contract.multiplicadorAgosto?.toString() ?? null,
    codigoCC: contract.codigoCC,
    notas: contract.notas,
    local: { id: contract.local.id, codigo: contract.local.codigo, nombre: contract.local.nombre },
    locales: getAssociatedLocales(contract).map((l) => ({ id: l.id, codigo: l.codigo, nombre: l.nombre })),
    arrendatario: {
      id: contract.arrendatario.id,
      nombreComercial: contract.arrendatario.nombreComercial,
      razonSocial: contract.arrendatario.razonSocial ?? ""
    },
    tarifas: contract.tarifas.map((tarifa) => ({
      tipo: tarifa.tipo,
      valor: tarifa.valor.toString(),
      umbralVentasUf: tarifa.umbralVentasUf?.toString() ?? null,
      pisoMinimoUf: tarifa.pisoMinimoUf?.toString() ?? null,
      vigenciaDesde: tarifa.vigenciaDesde.toISOString().slice(0, 10),
      vigenciaHasta: tarifa.vigenciaHasta ? tarifa.vigenciaHasta.toISOString().slice(0, 10) : null,
      esDiciembre: tarifa.esDiciembre,
      ...legacyDiscountFields(tarifa.discounts)
    })),
    ggcc: contract.ggcc.map((item) => ({
      tarifaBaseUfM2: item.tarifaBaseUfM2.toString(),
      pctAdministracion: item.pctAdministracion.toString(),
      pctReajuste: item.pctReajuste?.toString() ?? null,
      vigenciaDesde: item.vigenciaDesde.toISOString().slice(0, 10),
      vigenciaHasta: item.vigenciaHasta ? item.vigenciaHasta.toISOString().slice(0, 10) : null,
      proximoReajuste: item.proximoReajuste ? item.proximoReajuste.toISOString().slice(0, 10) : null,
      mesesReajuste: item.mesesReajuste ?? null
    }))
  };

  return (
    <main className="space-y-4">
      <Breadcrumb items={[
        { label: "Rent Roll", href: "/plan/rent-roll" },
        { label: "Contratos", href: "/plan/contracts" },
        { label: `Contrato ${contract.numeroContrato}` },
      ]} />

      <section className="divide-y divide-brand-100 space-y-5 rounded-md border border-brand-200 bg-brand-50 p-5 shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-base font-semibold text-slate-900">
              Contrato {contract.numeroContrato}
            </h3>
            <StatusBadge status={contract.estado} />
            <span className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
              diasRestantes <= 30 && "bg-rose-100 text-rose-700",
              diasRestantes > 30 && diasRestantes <= 90 && "bg-amber-100 text-amber-700",
              diasRestantes > 90 && "bg-emerald-100 text-emerald-700"
            )}>
              {diasRestantes} días restantes
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
            {canEdit ? (
              <ContractDetailEditButton
                contract={editableContract}
                proyectoId={selectedProjectId}
                locals={allUnits.map((u) => ({ id: u.id, label: u.codigo }))}
                arrendatarios={allTenants.map((t) => ({ id: t.id, label: t.nombreComercial }))}
              />
            ) : null}
            {canEdit ? (
              <ContractDetailDeleteButton
                contractId={contract.id}
                proyectoId={selectedProjectId}
              />
            ) : null}
          </div>
        </div>

        {/* Informacion General */}
        <div>
          <h4 className="mb-2 border-l-2 border-brand-300 pl-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Informacion General</h4>
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
                <p className="text-sm font-medium text-slate-700">{contract.arrendatario.razonSocial}</p>
              </div>
            ) : null}
            <div>
              <p className="text-slate-400">RUT</p>
              <p className="text-sm font-medium tabular-nums text-slate-700">{contract.arrendatario.rut}</p>
            </div>
            <div>
              <p className="text-slate-400">Fecha inicio</p>
              <p className="text-sm font-medium tabular-nums text-slate-700">{formatDate(contract.fechaInicio)}</p>
            </div>
            <div>
              <p className="text-slate-400">Fecha termino</p>
              <p className="text-sm font-medium tabular-nums text-slate-700">{formatDate(contract.fechaTermino)}</p>
            </div>
            {contract.fechaEntrega ? (
              <div>
                <p className="text-slate-400">Fecha entrega</p>
                <p className="text-sm font-medium tabular-nums text-slate-700">{formatDate(contract.fechaEntrega)}</p>
              </div>
            ) : null}
            {contract.fechaApertura ? (
              <div>
                <p className="text-slate-400">Fecha apertura</p>
                <p className="text-sm font-medium tabular-nums text-slate-700">{formatDate(contract.fechaApertura)}</p>
              </div>
            ) : null}
            {contract.diasGracia > 0 ? (
              <div>
                <p className="text-slate-400">Dias de gracia</p>
                <p className="text-sm font-medium tabular-nums text-slate-700">{contract.diasGracia}</p>
              </div>
            ) : null}
            {contract.codigoCC ? (
              <div>
                <p className="text-slate-400">Codigo CC</p>
                <p className="text-sm font-medium text-slate-700">{contract.codigoCC}</p>
              </div>
            ) : null}
            {contract.pctFondoPromocion ? (
              <div>
                <p className="text-slate-400">Fondo promocion</p>
                <p className="text-sm font-medium tabular-nums text-slate-700">{contract.pctFondoPromocion.toString()}%</p>
              </div>
            ) : null}
            {contract.multiplicadorDiciembre ? (
              <div>
                <p className="text-slate-400">Multiplicador diciembre</p>
                <p className="text-sm font-medium tabular-nums text-slate-700">{contract.multiplicadorDiciembre.toString()}x</p>
              </div>
            ) : null}
            {contract.multiplicadorJunio ? (
              <div>
                <p className="text-slate-400">Multiplicador junio</p>
                <p className="text-sm font-medium tabular-nums text-slate-700">{contract.multiplicadorJunio.toString()}x</p>
              </div>
            ) : null}
            {contract.multiplicadorJulio ? (
              <div>
                <p className="text-slate-400">Multiplicador julio</p>
                <p className="text-sm font-medium tabular-nums text-slate-700">{contract.multiplicadorJulio.toString()}x</p>
              </div>
            ) : null}
            {contract.multiplicadorAgosto ? (
              <div>
                <p className="text-slate-400">Multiplicador agosto</p>
                <p className="text-sm font-medium tabular-nums text-slate-700">{contract.multiplicadorAgosto.toString()}x</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Contacto arrendatario */}
        {contract.arrendatario.email || contract.arrendatario.telefono ? (
          <div>
            <h4 className="mb-2 border-l-2 border-brand-300 pl-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Contacto Arrendatario</h4>
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
          <h4 className="mb-2 border-l-2 border-brand-300 pl-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Locales</h4>
          {units.length === 1 ? (
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div>
                <p className="text-slate-400">Codigo</p>
                <p className="text-sm font-medium text-slate-700">{units[0].codigo}</p>
              </div>
              <div>
                <p className="text-slate-400">Nombre</p>
                <p className="text-sm font-medium text-slate-700">{units[0].nombre}</p>
              </div>
              <div>
                <p className="text-slate-400">Superficie</p>
                <p className="text-sm font-medium tabular-nums text-slate-700">{Number(units[0].glam2).toFixed(2)} m{"\u00b2"}</p>
              </div>
              <div>
                <p className="text-slate-400">Piso</p>
                <p className="text-sm font-medium text-slate-700">{units[0].piso}</p>
              </div>
            </div>
          ) : (
            <UnifiedTable density="compact" className="[&_thead]:bg-brand-50 [&_thead_th]:text-brand-700">
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
        {contract.tarifas.length > 0 ? (() => {
          const tarifasWithLegacyDiscounts = contract.tarifas.map((tarifa) => ({
            ...tarifa,
            ...legacyDiscountFields(tarifa.discounts)
          }));
          const hasVariable = tarifasWithLegacyDiscounts.some((t) => t.tipo === "PORCENTAJE");
          const hasDescuento = tarifasWithLegacyDiscounts.some((t) => t.descuentoTipo !== null);
          return (
            <div>
              <h4 className="mb-2 border-l-2 border-brand-300 pl-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Tarifas</h4>
              <UnifiedTable density="compact" className="[&_thead]:bg-brand-50 [&_thead_th]:text-brand-700">
                <table className={`${compactTableTheme.table} text-xs`}>
                  <thead className={compactTableTheme.head}>
                    <tr>
                      <th className={compactTableTheme.compactHeadCell}>Tipo</th>
                      <th className={`${compactTableTheme.compactHeadCell} text-right`}>Valor</th>
                      {hasVariable ? (
                        <>
                          <th className={`${compactTableTheme.compactHeadCell} text-right`}>Umbral UF</th>
                          <th className={`${compactTableTheme.compactHeadCell} text-right`}>Piso UF</th>
                        </>
                      ) : null}
                      <th className={compactTableTheme.compactHeadCell}>Vigencia desde</th>
                      <th className={compactTableTheme.compactHeadCell}>Vigencia hasta</th>
                      <th className={`${compactTableTheme.compactHeadCell} text-center`}>Diciembre</th>
                      {hasDescuento ? (
                        <>
                          <th className={compactTableTheme.compactHeadCell}>Dto. tipo</th>
                          <th className={`${compactTableTheme.compactHeadCell} text-right`}>Dto. valor</th>
                          <th className={compactTableTheme.compactHeadCell}>Dto. desde</th>
                          <th className={compactTableTheme.compactHeadCell}>Dto. hasta</th>
                        </>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tarifasWithLegacyDiscounts.map((tarifa, index) => (
                      <tr
                        key={`${tarifa.tipo}-${tarifa.vigenciaDesde.toISOString()}-${index}`}
                        className={`${getStripedRowClass(index, "compact")} ${compactTableTheme.rowHover}`}
                      >
                        <td className={`${compactTableTheme.compactCell} font-medium text-slate-800`}>{rateLabel(tarifa.tipo)}</td>
                        <td className={`${compactTableTheme.compactCell} text-right tabular-nums`}>
                          {tarifa.tipo === "PORCENTAJE"
                            ? `${tarifa.valor.toString()}%`
                            : formatUf(Number(tarifa.valor))}
                        </td>
                        {hasVariable ? (
                          <>
                            <td className={`${compactTableTheme.compactCell} text-right tabular-nums`}>
                              {tarifa.umbralVentasUf ? formatUf(Number(tarifa.umbralVentasUf)) : "\u2014"}
                            </td>
                            <td className={`${compactTableTheme.compactCell} text-right tabular-nums`}>
                              {tarifa.pisoMinimoUf ? formatUf(Number(tarifa.pisoMinimoUf)) : "\u2014"}
                            </td>
                          </>
                        ) : null}
                        <td className={`${compactTableTheme.compactCell} tabular-nums`}>
                          {formatDate(tarifa.vigenciaDesde)}
                        </td>
                        <td className={`${compactTableTheme.compactCell} tabular-nums`}>
                          {tarifa.vigenciaHasta ? formatDate(tarifa.vigenciaHasta) : "\u2014"}
                        </td>
                        <td className={`${compactTableTheme.compactCell} text-center`}>
                          {tarifa.esDiciembre ? "Si" : "No"}
                        </td>
                        {hasDescuento ? (
                          <>
                            <td className={compactTableTheme.compactCell}>
                              {tarifa.descuentoTipo ?? "\u2014"}
                            </td>
                            <td className={`${compactTableTheme.compactCell} text-right tabular-nums`}>
                              {tarifa.descuentoValor
                                ? tarifa.descuentoTipo === "PORCENTAJE"
                                  ? `${tarifa.descuentoValor}%`
                                  : formatUf(Number(tarifa.descuentoValor))
                                : "\u2014"}
                            </td>
                            <td className={`${compactTableTheme.compactCell} tabular-nums`}>
                              {tarifa.descuentoDesde ? formatDateString(tarifa.descuentoDesde) : "\u2014"}
                            </td>
                            <td className={`${compactTableTheme.compactCell} tabular-nums`}>
                              {tarifa.descuentoHasta ? formatDateString(tarifa.descuentoHasta) : "\u2014"}
                            </td>
                          </>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </UnifiedTable>
            </div>
          );
        })() : null}

        {/* Gastos Comunes (GGCC) */}
        {contract.ggcc.length > 0 ? (
          <div>
            <h4 className="mb-2 border-l-2 border-brand-300 pl-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Gastos Comunes (GGCC)</h4>
            <UnifiedTable density="compact" className="[&_thead]:bg-brand-50 [&_thead_th]:text-brand-700">
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
            <h4 className="mb-2 border-l-2 border-brand-300 pl-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Anexos</h4>
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
            <h4 className="mb-2 border-l-2 border-brand-300 pl-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Notas</h4>
            <div className="rounded bg-slate-50 p-3">
              <p className="whitespace-pre-wrap text-xs text-slate-600">{contract.notas}</p>
            </div>
          </div>
        ) : null}

        {/* Meta */}
        <div className="flex flex-wrap gap-4 pt-2 text-[10px] text-slate-300">
          <span>Creado: {formatDate(contract.createdAt)}</span>
          <span>Actualizado: {formatDate(contract.updatedAt)}</span>
        </div>
      </section>
    </main>
  );
}
