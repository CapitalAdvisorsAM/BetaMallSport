import { EstadoContrato, EstadoMaestro, TipoTarifaContrato } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertBar } from "@/components/dashboard/AlertBar";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ProjectSelector } from "@/components/ui/ProjectSelector";
import {
  OCCUPANCY_HIGH_THRESHOLD,
  OCCUPANCY_LOW_THRESHOLD,
  UF_STALENESS_DAYS
} from "@/lib/constants";
import {
  buildAlertCounts,
  buildIngresoDesglosado,
  buildOcupacionDetalle,
  buildRentaEnRiesgo,
  buildRentaPotencialVacantes,
  buildVencimientosPorAnio,
  calculateContractStateCounters,
  calculateEstimatedGgccUf,
  formatPercent,
  formatSquareMeters,
  type KpiContractInput
} from "@/lib/kpi";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";
import { isPeriodoValido } from "@/lib/validators";
import { cn } from "@/lib/utils";

type DashboardPageProps = {
  searchParams: {
    proyecto?: string;
    periodo?: string;
  };
};

type CarteraCardConfig = {
  title: string;
  accent: "green" | "yellow" | "red" | "slate";
  subtitle?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const CARTERA_CARD_CONFIG: Record<EstadoContrato, CarteraCardConfig> = {
  VIGENTE: {
    title: "Vigentes",
    accent: "green"
  },
  GRACIA: {
    title: "En periodo de gracia",
    accent: "yellow",
    subtitle: "Sin ingreso hasta inicio efectivo"
  },
  TERMINADO_ANTICIPADO: {
    title: "Terminados anticipadamente",
    accent: "red",
    subtitle: "Rescision antes del plazo pactado"
  },
  TERMINADO: {
    title: "Terminados",
    accent: "slate"
  }
};

function startOfDay(date: Date): Date {
  const output = new Date(date);
  output.setHours(0, 0, 0, 0);
  return output;
}

function formatPeriodo(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatUfValue(value: number, fractionDigits = 2): string {
  return value.toLocaleString("es-CL", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
}

function formatClp(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(value);
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function urgencyClassForYear(year: number, currentYear: number): string {
  if (year === currentYear) {
    return "text-rose-700";
  }
  if (year === currentYear + 1) {
    return "text-amber-700";
  }
  return "text-slate-700";
}

export default async function DashboardPage({
  searchParams
}: DashboardPageProps): Promise<JSX.Element> {
  try {
    await requireSession();
  } catch {
    redirect("/login");
  }

  const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);
  if (!selectedProjectId) {
    return (
      <main className="rounded-md bg-white p-6 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gold-400" />
          <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">
            Control de Gestion
          </h2>
        </div>
        <p className="mt-2 text-sm text-slate-600">Selecciona un proyecto para ver el dashboard.</p>
      </main>
    );
  }

  const currentPeriodo = formatPeriodo(new Date());
  const periodo = isPeriodoValido(searchParams.periodo ?? "") ? (searchParams.periodo as string) : currentPeriodo;

  if (searchParams.proyecto !== selectedProjectId || searchParams.periodo !== periodo) {
    const params = new URLSearchParams();
    params.set("proyecto", selectedProjectId);
    params.set("periodo", periodo);
    redirect(`/?${params.toString()}`);
  }

  const today = startOfDay(new Date());
  const [activeLocales, activeContractsRaw, groupedStates, latestValorUf, ventasPeriodo, energiaPeriodo] =
    await Promise.all([
      prisma.local.findMany({
        where: {
          proyectoId: selectedProjectId,
          estado: EstadoMaestro.ACTIVO
        },
        orderBy: { codigo: "asc" },
        select: {
          id: true,
          codigo: true,
          esGLA: true,
          glam2: true,
          tipo: true,
          zona: true
        }
      }),
      prisma.contrato.findMany({
        where: {
          proyectoId: selectedProjectId,
          estado: {
            in: [EstadoContrato.VIGENTE, EstadoContrato.GRACIA]
          }
        },
        orderBy: { fechaTermino: "asc" },
        select: {
          id: true,
          estado: true,
          localId: true,
          numeroContrato: true,
          fechaTermino: true,
          pctRentaVariable: true,
          local: {
            select: {
              codigo: true,
              esGLA: true,
              glam2: true
            }
          },
          arrendatario: {
            select: {
              nombreComercial: true
            }
          },
          tarifas: {
            where: {
              vigenciaDesde: { lte: today },
              OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: today } }]
            },
            orderBy: { vigenciaDesde: "desc" },
            take: 1,
            select: {
              tipo: true,
              valor: true
            }
          },
          ggcc: {
            where: {
              vigenciaDesde: { lte: today }
            },
            orderBy: { vigenciaDesde: "desc" },
            take: 1,
            select: {
              tarifaBaseUfM2: true,
              pctAdministracion: true
            }
          }
        }
      }),
      prisma.contrato.groupBy({
        by: ["estado"],
        where: { proyectoId: selectedProjectId },
        _count: { _all: true }
      }),
      prisma.valorUF.findFirst({
        orderBy: { fecha: "desc" },
        select: { fecha: true, valor: true }
      }),
      prisma.ventaLocal.findMany({
        where: {
          proyectoId: selectedProjectId,
          periodo
        },
        select: {
          localId: true,
          periodo: true,
          ventasUf: true
        }
      }),
      prisma.ingresoEnergia.findMany({
        where: {
          proyectoId: selectedProjectId,
          periodo
        },
        select: {
          localId: true,
          periodo: true,
          valorUf: true
        }
      })
    ]);

  const contractsWithState = activeContractsRaw.map((contract) => ({
    estado: contract.estado,
    data: {
      id: contract.id,
      localId: contract.localId,
      localCodigo: contract.local.codigo,
      localEsGLA: contract.local.esGLA,
      localGlam2: contract.local.glam2,
      arrendatarioNombre: contract.arrendatario.nombreComercial,
      numeroContrato: contract.numeroContrato,
      fechaTermino: contract.fechaTermino,
      pctRentaVariable: contract.pctRentaVariable,
      tarifa: contract.tarifas[0] ?? null,
      ggcc: contract.ggcc[0] ?? null
    } satisfies KpiContractInput
  }));

  const vigenteContracts = contractsWithState
    .filter((contract) => contract.estado === EstadoContrato.VIGENTE)
    .map((contract) => contract.data);
  const graciaContracts = contractsWithState
    .filter((contract) => contract.estado === EstadoContrato.GRACIA)
    .map((contract) => contract.data);
  const activeContracts = [...vigenteContracts, ...graciaContracts];

  const localesConContratoVigente = new Set(vigenteContracts.map((contract) => contract.localId));
  const localesEnGracia = new Set(
    graciaContracts
      .map((contract) => contract.localId)
      .filter((localId) => !localesConContratoVigente.has(localId))
  );
  const localesConArrendatario = new Set([...localesConContratoVigente, ...localesEnGracia]);
  const localesVacantes = activeLocales.filter((local) => !localesConArrendatario.has(local.id));

  const ocupacion = buildOcupacionDetalle(activeLocales, activeContracts);
  const ingresos = buildIngresoDesglosado(
    vigenteContracts,
    activeLocales,
    ventasPeriodo,
    energiaPeriodo,
    periodo
  );
  const ggccUf = calculateEstimatedGgccUf(vigenteContracts);
  const rentaEnRiesgo = buildRentaEnRiesgo(vigenteContracts, today, 90);
  const vencimientosPorAnio = buildVencimientosPorAnio(activeContracts).filter((row) => {
    const currentYear = today.getFullYear();
    return row.anio >= currentYear && row.anio <= currentYear + 5;
  });
  const contractStates = calculateContractStateCounters(
    groupedStates.map((item) => ({ estado: item.estado, cantidad: item._count._all }))
  );

  const alertCounts = buildAlertCounts(
    contractsWithState.map((contract) => ({
      estado: contract.estado,
      fechaTermino: contract.data.fechaTermino
    })),
    localesVacantes,
    today,
    selectedProjectId
  );

  const pctOcupacion = ocupacion.glaTotal > 0 ? (ocupacion.glaArrendada / ocupacion.glaTotal) * 100 : 0;
  const occupancyAccent =
    pctOcupacion >= OCCUPANCY_HIGH_THRESHOLD
      ? "green"
      : pctOcupacion >= OCCUPANCY_LOW_THRESHOLD
        ? "yellow"
        : "red";

  const localesVacantesGla = localesVacantes.filter((local) => local.esGLA);
  const rentaPotencialVacantes = buildRentaPotencialVacantes(
    localesVacantesGla,
    ingresos.arriendoFijoUfM2
  );

  const contratosConGgcc = vigenteContracts.filter((contract) => contract.ggcc !== null).length;
  const contratosSinGgcc = vigenteContracts.length - contratosConGgcc;

  const salesByLocal = new Map(ventasPeriodo.map((venta) => [venta.localId, Number(venta.ventasUf)]));
  const contratosVariableConVentas = vigenteContracts.filter(
    (contract) =>
      contract.tarifa?.tipo === TipoTarifaContrato.PORCENTAJE && salesByLocal.has(contract.localId)
  ).length;
  const localById = new Map(activeLocales.map((local) => [local.id, local]));
  const simuladorModuloUnidades = new Set(
    vigenteContracts
      .map((contract) => localById.get(contract.localId))
      .filter((local): local is (typeof activeLocales)[number] => {
        if (!local) {
          return false;
        }
        return local.tipo === "SIMULADOR" || local.tipo === "MODULO";
      })
      .map((local) => local.id)
  ).size;

  const ufAgeDays =
    latestValorUf === null
      ? null
      : Math.floor((today.getTime() - startOfDay(latestValorUf.fecha).getTime()) / DAY_MS);
  const isUfStale = ufAgeDays !== null && ufAgeDays > UF_STALENESS_DAYS;
  const ingresoMensualClp = latestValorUf ? ingresos.totalUf * Number(latestValorUf.valor) : 0;

  const bodegaEspacioUf = ingresos.arriendoBodegaUf + ingresos.arriendoEspacioUf;
  const bodegaEspacioSubtitle =
    ingresos.arriendoBodegaUf > 0 || ingresos.arriendoEspacioUf > 0
      ? `Bodega: ${formatUfValue(ingresos.arriendoBodegaUf)} UF · Espacio: ${formatUfValue(
          ingresos.arriendoEspacioUf
        )} UF`
      : "Sin ingresos de bodega o espacio en el periodo";

  return (
    <main className="space-y-6">
      <header className="rounded-md bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mb-1 flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gold-400" />
            <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">
              Control de Gestion
            </h2>
          </div>
          <ProjectSelector
            projects={projects}
            selectedProjectId={selectedProjectId}
            preserve={{ periodo }}
          />
          <Link
            href={`/rent-roll/dashboard?proyecto=${selectedProjectId}&periodo=${periodo}`}
            className="ml-auto flex items-center gap-1 rounded-full border border-brand-300 px-4 py-1.5 text-sm font-medium text-brand-500 transition-colors hover:text-brand-700"
          >
            Ver Rent Roll -&gt;
          </Link>
        </div>
      </header>

      <AlertBar {...alertCounts} />

      <section className="space-y-3">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gold-400" />
          <h3 className="text-base font-bold uppercase tracking-wide text-brand-700">Ocupacion</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Ocupacion del proyecto"
            value={formatPercent(pctOcupacion)}
            subtitle={`${localesConContratoVigente.size} vigentes · ${localesEnGracia.size} en gracia · ${localesVacantes.length} vacantes`}
            accent={occupancyAccent}
          />
          <KpiCard
            title="GLA arrendada"
            value={formatSquareMeters(ocupacion.glaArrendada)}
            subtitle={`GLA vacante: ${formatSquareMeters(ocupacion.glaVacante)}`}
            subtitleClassName={ocupacion.glaVacante > 0 ? "text-rose-600" : "text-slate-500"}
            accent="slate"
          />
          <KpiCard
            title="Locales sin arrendatario"
            value={localesVacantes.length.toString()}
            subtitle={
              localesVacantes.length > 0
                ? `~${formatUfValue(rentaPotencialVacantes)} UF/mes de ingreso potencial`
                : "Sin vacantes"
            }
            subtitleClassName={localesVacantes.length > 0 ? "text-rose-600" : "text-emerald-600"}
            accent={localesVacantes.length > 0 ? "red" : "green"}
          />
          <KpiCard
            title="Renta en riesgo (90d)"
            value={`${formatUfValue(rentaEnRiesgo.ufEnRiesgo)} UF`}
            subtitle={`de ${rentaEnRiesgo.count} contratos proximos a vencer`}
            accent={rentaEnRiesgo.ufEnRiesgo > 0 ? "red" : "green"}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gold-400" />
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold uppercase tracking-wide text-brand-700">
              Ingresos del periodo - {periodo}
            </h3>
            {ingresos.ventaEnergiaUf > 0 ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                ⚡ Energia: {formatUfValue(ingresos.ventaEnergiaUf)} UF
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard
            title="Facturacion total (UF)"
            value={formatUfValue(ingresos.totalUf)}
            subtitle={`${formatUfValue(ingresos.facturacionUfM2, 3)} UF/m2`}
            accent="slate"
          />
          <KpiCard
            title="Arriendo fijo (UF)"
            value={formatUfValue(ingresos.arriendoFijoUf)}
            subtitle={`${formatUfValue(ingresos.arriendoFijoUfM2, 3)} UF/m2`}
            accent="slate"
          />
          <KpiCard
            title="Ingreso mensual (CLP)"
            value={latestValorUf ? formatClp(ingresoMensualClp) : "Sin valor UF"}
            subtitle={
              latestValorUf
                ? `UF ${formatUfValue(Number(latestValorUf.valor), 2)} al ${formatShortDate(latestValorUf.fecha)}`
                : "No hay valor UF registrado"
            }
            accent="slate"
            detail={
              isUfStale ? (
                <p className="text-xs font-semibold text-amber-700">⚠ Valor UF desactualizado</p>
              ) : null
            }
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-md border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Renta variable</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-brand-700">
              {formatUfValue(ingresos.arriendoVariableUf)} UF
            </p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              % sobre ventas de {contratosVariableConVentas} contratos
            </p>
          </article>
          <article className="rounded-md border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Simuladores/Mod.
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-brand-700">
              {formatUfValue(ingresos.simuladoresModulosUf)} UF
            </p>
            <p className="mt-1 text-xs font-medium text-slate-600">{simuladorModuloUnidades} unidades</p>
          </article>
          <article className="rounded-md border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Bodega + Espacio
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-brand-700">
              {formatUfValue(bodegaEspacioUf)} UF
            </p>
            <p className="mt-1 text-xs font-medium text-slate-600">{bodegaEspacioSubtitle}</p>
          </article>
        </div>
      </section>

      <section className="space-y-3">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gold-400" />
          <h3 className="text-base font-bold uppercase tracking-wide text-brand-700">GGCC</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard
            title="Gasto comun mensual (UF)"
            value={formatUfValue(ggccUf)}
            subtitle={`${contratosConGgcc} contratos con datos · ${contratosSinGgcc} sin datos`}
            accent="slate"
            titleAttribute="Gastos comunes de administracion de areas compartidas"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-md bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-base font-semibold text-brand-700">Vencimientos por ano</h3>
          <p className="mt-1 text-sm text-slate-600">Maximo 5 anos hacia adelante desde hoy.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-brand-700">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                  Ano
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                  Contratos
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                  m2
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                  % del total
                </th>
              </tr>
            </thead>
            <tbody className="text-slate-800">
              {vencimientosPorAnio.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No hay vencimientos en el horizonte de 5 anos.
                  </td>
                </tr>
              ) : (
                vencimientosPorAnio.map((row, index) => (
                  <tr
                    key={row.anio}
                    className={cn(
                      "transition-colors hover:bg-brand-50",
                      index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                    )}
                  >
                    <td className={cn("whitespace-nowrap px-4 py-3 font-semibold", urgencyClassForYear(row.anio, today.getFullYear()))}>
                      {row.anio}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{row.cantidadContratos}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{formatUfValue(row.m2)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{formatPercent(row.pctTotal)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 px-4 py-3 text-right text-sm">
          <Link
            href={`/rent-roll/dashboard?proyecto=${selectedProjectId}&periodo=${periodo}`}
            className="text-brand-500 underline hover:text-brand-700"
          >
            Ver detalle de vencimientos en Rent Roll -&gt;
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gold-400" />
          <h3 className="text-base font-bold uppercase tracking-wide text-brand-700">
            Estado de cartera
          </h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {contractStates.counters.map((counter) => {
            const config = CARTERA_CARD_CONFIG[counter.estado];
            return (
              <KpiCard
                key={counter.estado}
                title={config.title}
                value={counter.cantidad.toString()}
                subtitle={config.subtitle}
                accent={config.accent}
              />
            );
          })}
        </div>
      </section>
    </main>
  );
}
