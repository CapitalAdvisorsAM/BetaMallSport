import { EstadoContrato, EstadoMaestro, TipoTarifaContrato } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertBar } from "@/components/dashboard/AlertBar";
import { ContractExpiryTable } from "@/components/dashboard/ContractExpiryTable";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ProjectSelector } from "@/components/ui/ProjectSelector";
import {
  OCCUPANCY_HIGH_THRESHOLD,
  OCCUPANCY_LOW_THRESHOLD,
  UF_STALENESS_DAYS
} from "@/lib/constants";
import {
  buildAlertCounts,
  buildContractExpiryRows,
  buildFixedRentClpMetric,
  buildRentaEnRiesgo,
  buildRentaPotencialVacantes,
  calculateContractStateCounters,
  calculateEstimatedGgccUf,
  calculateFixedRentUf,
  calculateGlaMetrics,
  calculateOccupancy,
  formatPercent,
  formatSquareMeters,
  type KpiContractInput
} from "@/lib/kpi";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";

type DashboardPageProps = {
  searchParams: {
    proyecto?: string;
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const output = new Date(date);
  output.setHours(0, 0, 0, 0);
  return output;
}

function toNumber(value: number | string | { toString(): string }): number {
  return Number(value.toString());
}

function formatUfValue(value: number, fractionDigits: number): string {
  return value.toLocaleString("es-CL", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
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

  if (!searchParams.proyecto) {
    redirect(`/?proyecto=${selectedProjectId}`);
  }

  const today = startOfDay(new Date());

  const [activeLocales, activeContractsRaw, groupedStates, latestValorUf] = await Promise.all([
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
        glam2: true
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
  const localesSinContratoVigente = activeLocales.filter(
    (local) => !localesConContratoVigente.has(local.id)
  );

  const occupancy = calculateOccupancy(activeLocales, activeContracts);
  const gla = calculateGlaMetrics(activeLocales, activeContracts);
  const fixedRentUf = calculateFixedRentUf(vigenteContracts);
  const fixedRentClp = buildFixedRentClpMetric(fixedRentUf, latestValorUf);
  const ggccUf = calculateEstimatedGgccUf(vigenteContracts);
  const contractStates = calculateContractStateCounters(
    groupedStates.map((item) => ({ estado: item.estado, cantidad: item._count._all }))
  );

  const expiringContracts = buildContractExpiryRows(activeContracts, today, 90, Number.MAX_SAFE_INTEGER);
  const rentaEnRiesgo = buildRentaEnRiesgo(vigenteContracts, today, 90);

  const tarifaPromedio = vigenteContracts.reduce(
    (acc, contract) => {
      if (!contract.tarifa) {
        return acc;
      }

      const glam2 = toNumber(contract.localGlam2);
      if (glam2 <= 0) {
        return acc;
      }

      if (contract.tarifa.tipo === TipoTarifaContrato.FIJO_UF_M2) {
        const tarifaUfM2 = toNumber(contract.tarifa.valor);
        acc.ufTotal += tarifaUfM2 * glam2;
        acc.glaTotal += glam2;
      } else if (contract.tarifa.tipo === TipoTarifaContrato.FIJO_UF) {
        const tarifaUf = toNumber(contract.tarifa.valor);
        acc.ufTotal += tarifaUf;
        acc.glaTotal += glam2;
      }

      return acc;
    },
    { ufTotal: 0, glaTotal: 0 }
  );

  const promedioTarifaProyecto =
    tarifaPromedio.glaTotal > 0 ? tarifaPromedio.ufTotal / tarifaPromedio.glaTotal : 0;
  const rentaPotencialVacantes = buildRentaPotencialVacantes(localesVacantes, promedioTarifaProyecto);

  const alertCounts = {
    ...buildAlertCounts(
      contractsWithState.map((contract) => ({
        estado: contract.estado,
        fechaTermino: contract.data.fechaTermino
      })),
      localesSinContratoVigente,
      today,
      selectedProjectId
    )
  };

  const occupancyAccent =
    occupancy.porcentaje >= OCCUPANCY_HIGH_THRESHOLD
      ? "green"
      : occupancy.porcentaje >= OCCUPANCY_LOW_THRESHOLD
        ? "yellow"
        : "red";

  const pctLocalesVigentes =
    activeLocales.length > 0 ? (localesConContratoVigente.size / activeLocales.length) * 100 : 0;
  const pctLocalesGracia =
    activeLocales.length > 0 ? (localesEnGracia.size / activeLocales.length) * 100 : 0;

  const glaVacante = Math.max(gla.glaTotal - gla.glaArrendada, 0);
  const glaArrendadaPct = gla.glaTotal > 0 ? (gla.glaArrendada / gla.glaTotal) * 100 : 0;

  const contratosConRentaFija = vigenteContracts.filter(
    (contract) =>
      contract.tarifa?.tipo === TipoTarifaContrato.FIJO_UF ||
      contract.tarifa?.tipo === TipoTarifaContrato.FIJO_UF_M2
  ).length;

  const contratosConGgcc = vigenteContracts.filter((contract) => contract.ggcc !== null).length;
  const contratosSinGgcc = vigenteContracts.length - contratosConGgcc;

  const ufAgeDays =
    latestValorUf === null
      ? null
      : Math.floor((today.getTime() - startOfDay(latestValorUf.fecha).getTime()) / DAY_MS);
  const isUfStale = ufAgeDays !== null && ufAgeDays > UF_STALENESS_DAYS;

  const stateCardConfig: Record<
    EstadoContrato,
    { title: string; accent: "green" | "yellow" | "red" | "slate"; subtitle?: string }
  > = {
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
          <ProjectSelector projects={projects} selectedProjectId={selectedProjectId} preserve={{}} />
          <Link
            href={`/rent-roll/dashboard?proyecto=${selectedProjectId}`}
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
          <h3 className="text-base font-bold uppercase tracking-wide text-brand-700">
            Como esta el negocio?
          </h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Ocupacion del proyecto"
            value={formatPercent(occupancy.porcentaje)}
            subtitle={`${localesConContratoVigente.size} vigentes · ${localesEnGracia.size} en gracia · ${localesVacantes.length} vacantes`}
            accent={occupancyAccent}
            detail={
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  style={{ width: `${pctLocalesVigentes}%` }}
                  className="float-left h-full bg-emerald-500"
                />
                <div style={{ width: `${pctLocalesGracia}%` }} className="float-left h-full bg-amber-400" />
              </div>
            }
          />
          <KpiCard
            title="GLA arrendada"
            value={`${formatSquareMeters(gla.glaArrendada)} · ${formatPercent(glaArrendadaPct)} del total`}
            subtitle={`GLA vacante: ${formatSquareMeters(glaVacante)}`}
            subtitleClassName={glaVacante > 0 ? "text-rose-600" : "text-slate-500"}
            accent="slate"
          />
          <KpiCard
            title="Locales sin arrendatario"
            value={localesVacantes.length.toString()}
            subtitle={
              localesVacantes.length > 0
                ? `~${formatUfValue(rentaPotencialVacantes, 2)} UF/mes de ingreso potencial`
                : "Sin vacantes"
            }
            subtitleClassName={localesVacantes.length > 0 ? "text-rose-600" : "text-emerald-600"}
            accent={localesVacantes.length > 0 ? "red" : "green"}
          />
          <KpiCard
            title="Renta en riesgo (90 dias)"
            value={`${formatUfValue(rentaEnRiesgo.ufEnRiesgo, 2)} UF`}
            subtitle={`de ${rentaEnRiesgo.count} contratos proximos a vencer`}
            accent={rentaEnRiesgo.ufEnRiesgo > 0 ? "red" : "green"}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gold-400" />
          <h3 className="text-base font-bold uppercase tracking-wide text-brand-700">
            Ingresos comprometidos este mes
          </h3>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard
            title="Ingreso mensual (UF)"
            value={formatUfValue(fixedRentUf, 2)}
            subtitle={`Contratos con renta fija: ${contratosConRentaFija} de ${vigenteContracts.length} vigentes`}
            accent="slate"
          />
          <KpiCard
            title="Ingreso mensual (CLP)"
            value={fixedRentClp.value}
            subtitle={fixedRentClp.subtitle}
            accent="slate"
            detail={
              isUfStale ? (
                <p className="text-xs font-semibold text-amber-700">⚠️ Valor UF desactualizado</p>
              ) : null
            }
          />
          <KpiCard
            title="Gasto comun mensual (UF)"
            value={formatUfValue(ggccUf, 2)}
            subtitle={`${contratosConGgcc} contratos con datos · ${contratosSinGgcc} sin datos GGCC`}
            accent="slate"
            titleAttribute="Gastos de administracion de areas comunes (GGCC)"
          />
        </div>
      </section>

      <ContractExpiryTable rows={expiringContracts} proyectoId={selectedProjectId} />

      <section className="space-y-3">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gold-400" />
          <h3 className="text-base font-bold uppercase tracking-wide text-brand-700">
            Estado de la cartera
          </h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {contractStates.counters.map((counter) => {
            const config = stateCardConfig[counter.estado];
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
