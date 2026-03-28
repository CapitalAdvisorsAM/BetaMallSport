import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { RentRollKpiHeader } from "@/components/rent-roll/RentRollKpiHeader";
import { RentRollTable } from "@/components/rent-roll/RentRollTable";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { ProjectSelector } from "@/components/ui/ProjectSelector";
import { canWrite, requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";
import type { EstadoLocal, RentRollKpis, RentRollRow } from "@/types/rent-roll";

type RentRollPageProps = {
  searchParams: {
    proyecto?: string | string[];
    periodo?: string | string[];
  };
};

type MetricaApiRow = {
  localId?: string;
  localCodigo: string;
  localNombre: string;
  glam2: number;
  arrendatario: string | null;
  estado: string;
  tarifaUfM2: number | null;
  rentaFijaUf: number | null;
  ggccUf: number | null;
  ventasUf: number | null;
  fechaTermino: string | null;
};

function getSingleValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value[0];
  }
  return undefined;
}

function toPeriodo(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function isPeriodoValido(value?: string): value is string {
  if (!value) {
    return false;
  }
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function getPeriodoBounds(periodo: string): { start: Date; nextMonthStart: Date } {
  const [yearRaw, monthRaw] = periodo.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;

  return {
    start: new Date(Date.UTC(year, monthIndex, 1)),
    nextMonthStart: new Date(Date.UTC(year, monthIndex + 1, 1))
  };
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  return toNullableNumber(value) ?? fallback;
}

function toEstadoLocal(value: string): EstadoLocal | null {
  if (value === "VIGENTE" || value === "GRACIA" || value === "TERMINADO_ANTICIPADO") {
    return value;
  }
  return null;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function calculateDiasParaVencimiento(fechaTermino: string | null, now: Date): number | null {
  if (!fechaTermino) {
    return null;
  }

  const target = new Date(fechaTermino);
  if (Number.isNaN(target.getTime())) {
    return null;
  }

  const diffMs = startOfUtcDay(target).getTime() - startOfUtcDay(now).getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  return diffDays >= 0 ? diffDays : null;
}

function toIsoDate(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function getEstadoRank(estado: EstadoLocal): number {
  if (estado === "VIGENTE") {
    return 3;
  }
  if (estado === "GRACIA") {
    return 2;
  }
  if (estado === "TERMINADO_ANTICIPADO") {
    return 1;
  }
  return 0;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMetricaApiRow(value: unknown): value is MetricaApiRow {
  if (!isObjectRecord(value)) {
    return false;
  }

  if (typeof value.localCodigo !== "string" || typeof value.localNombre !== "string") {
    return false;
  }

  if (typeof value.estado !== "string") {
    return false;
  }

  if (value.localId !== undefined && value.localId !== null && typeof value.localId !== "string") {
    return false;
  }

  if (
    value.arrendatario !== null &&
    value.arrendatario !== undefined &&
    typeof value.arrendatario !== "string"
  ) {
    return false;
  }

  if (
    value.fechaTermino !== null &&
    value.fechaTermino !== undefined &&
    typeof value.fechaTermino !== "string"
  ) {
    return false;
  }

  return true;
}

function parseMetricasRows(payload: unknown): MetricaApiRow[] {
  if (!isObjectRecord(payload) || !Array.isArray(payload.filas)) {
    throw new Error("Respuesta de metricas invalida.");
  }

  const rows = payload.filas.filter(isMetricaApiRow);
  if (rows.length !== payload.filas.length) {
    throw new Error("Respuesta de metricas invalida.");
  }

  return rows;
}

function buildKpis(rows: RentRollRow[]): RentRollKpis {
  const glaTotal = rows.reduce((acc, row) => acc + row.glam2, 0);
  const glaCupado = rows
    .filter((row) => row.estado === "VIGENTE" || row.estado === "GRACIA")
    .reduce((acc, row) => acc + row.glam2, 0);
  const pctOcupacion = glaTotal > 0 ? (glaCupado / glaTotal) * 100 : 0;
  const rentaFijaTotalUf = rows
    .filter((row) => row.estado === "VIGENTE")
    .reduce((acc, row) => acc + (row.rentaFijaUf ?? 0), 0);
  const ggccTotalUf = rows.reduce((acc, row) => acc + (row.ggccUf ?? 0), 0);

  return {
    glaTotal,
    glaCupado,
    pctOcupacion,
    rentaFijaTotalUf,
    ggccTotalUf
  };
}

async function fetchMetricas(params: {
  proyectoId: string;
  periodo: string;
}): Promise<MetricaApiRow[]> {
  const requestHeaders = headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const cookie = requestHeaders.get("cookie");

  if (!host) {
    throw new Error("No se pudo resolver host para obtener metricas.");
  }

  const query = new URLSearchParams({
    proyecto: params.proyectoId,
    proyectoId: params.proyectoId,
    periodo: params.periodo,
    estado: "TODOS"
  });

  const response = await fetch(`${protocol}://${host}/api/rent-roll/metricas?${query.toString()}`, {
    method: "GET",
    headers: cookie ? { cookie } : undefined,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("No se pudo cargar metricas de rent roll.");
  }

  const payload = await response.json();
  return parseMetricasRows(payload);
}

export default async function RentRollPage({
  searchParams
}: RentRollPageProps): Promise<JSX.Element> {
  const session = await requireSession();
  const proyectoParam = getSingleValue(searchParams.proyecto);
  const periodoParam = getSingleValue(searchParams.periodo);

  const { projects, selectedProjectId } = await getProjectContext(proyectoParam);
  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Rent Roll"
        description="No hay proyectos activos. Crea uno para visualizar el estado contractual y financiero."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  const periodoActual = toPeriodo(new Date());
  const periodo = isPeriodoValido(periodoParam) ? periodoParam : periodoActual;

  if (proyectoParam !== selectedProjectId || periodoParam !== periodo) {
    const redirectParams = new URLSearchParams();
    redirectParams.set("proyecto", selectedProjectId);
    redirectParams.set("periodo", periodo);
    redirect(`/rent-roll?${redirectParams.toString()}`);
  }

  const { start, nextMonthStart } = getPeriodoBounds(periodo);

  let metricas: MetricaApiRow[];
  let localesActivos: Array<{
    id: string;
    codigo: string;
    nombre: string;
    glam2: unknown;
  }>;
  let valorUfPeriodo: { valor: unknown } | null;

  try {
    [metricas, localesActivos, valorUfPeriodo] = await Promise.all([
      fetchMetricas({ proyectoId: selectedProjectId, periodo }),
      prisma.local.findMany({
        where: { proyectoId: selectedProjectId, estado: "ACTIVO", esGLA: true },
        select: {
          id: true,
          codigo: true,
          nombre: true,
          glam2: true
        },
        orderBy: [{ codigo: "asc" }]
      }),
      prisma.valorUF.findFirst({
        where: {
          fecha: {
            gte: start,
            lt: nextMonthStart
          }
        },
        select: {
          valor: true
        },
        orderBy: { fecha: "desc" }
      })
    ]);
  } catch (error) {
    throw error instanceof Error ? error : new Error("No se pudieron cargar datos de Rent Roll.");
  }

  if (localesActivos.length === 0) {
    return (
      <main className="space-y-4">
        <header className="rounded-md bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <div className="h-5 w-1 rounded-full bg-gold-400" />
                <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">Rent Roll</h2>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Vista operacional de lo que deberia ocurrir contractualmente y financieramente.
              </p>
            </div>
            <ProjectSelector
              projects={projects}
              selectedProjectId={selectedProjectId}
              preserve={{ periodo }}
            />
          </div>
        </header>

        <section className="rounded-md bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <svg
              className="h-7 w-7 text-slate-500"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M4 20H20M6 20V6H18V20M9 9H11M13 9H15M9 12H11M13 12H15M9 15H11M13 15H15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Sin locales configurados</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
            Este proyecto no tiene locales activos. Agregalos en la seccion Locales antes de usar
            el Rent Roll.
          </p>
          <Link
            href="/rent-roll/locales"
            className="mt-5 inline-flex rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Ir a Locales
          </Link>
        </section>
      </main>
    );
  }

  const now = new Date();
  const localesById = new Map(localesActivos.map((local) => [local.id, local]));
  const localesByCodigo = new Map(localesActivos.map((local) => [local.codigo, local]));
  const metricasByLocalId = new Map<string, RentRollRow>();

  for (const metrica of metricas) {
    const matchedLocal = metrica.localId
      ? (localesById.get(metrica.localId) ?? localesByCodigo.get(metrica.localCodigo))
      : localesByCodigo.get(metrica.localCodigo);
    if (!matchedLocal) {
      continue;
    }

    const estado = toEstadoLocal(metrica.estado);
    if (!estado) {
      continue;
    }

    const row: RentRollRow = {
      localId: matchedLocal.id,
      localCodigo: matchedLocal.codigo,
      localNombre: matchedLocal.nombre,
      glam2: toFiniteNumber(matchedLocal.glam2),
      estado,
      arrendatario: metrica.arrendatario ?? null,
      tarifaUfM2: toNullableNumber(metrica.tarifaUfM2),
      rentaFijaUf: toNullableNumber(metrica.rentaFijaUf),
      ggccUf: toNullableNumber(metrica.ggccUf),
      ventasUf: toNullableNumber(metrica.ventasUf),
      fechaTermino: toIsoDate(metrica.fechaTermino),
      diasParaVencimiento: calculateDiasParaVencimiento(metrica.fechaTermino, now)
    };

    const existing = metricasByLocalId.get(matchedLocal.id);
    if (!existing || getEstadoRank(row.estado) > getEstadoRank(existing.estado)) {
      metricasByLocalId.set(matchedLocal.id, row);
    }
  }

  const rows: RentRollRow[] = localesActivos.map((local) => {
    const metrica = metricasByLocalId.get(local.id);
    if (metrica) {
      return metrica;
    }

    return {
      localId: local.id,
      localCodigo: local.codigo,
      localNombre: local.nombre,
      glam2: toFiniteNumber(local.glam2),
      estado: "VACANTE",
      arrendatario: null,
      tarifaUfM2: null,
      rentaFijaUf: null,
      ggccUf: null,
      ventasUf: null,
      fechaTermino: null,
      diasParaVencimiento: null
    };
  });

  const kpis = buildKpis(rows);
  const valorUf = toNullableNumber(valorUfPeriodo?.valor) ?? null;

  return (
    <main className="space-y-4">
      <header className="rounded-md bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gold-400" />
              <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">Rent Roll</h2>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Vista operacional de lo que deberia ocurrir contractualmente y financieramente.
            </p>
          </div>
          <ProjectSelector
            projects={projects}
            selectedProjectId={selectedProjectId}
            preserve={{ periodo }}
          />
        </div>
      </header>

      {valorUf !== null ? (
        <div className="flex justify-end">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500">
            UF {periodo}: ${valorUf.toFixed(2)}
          </span>
        </div>
      ) : null}

      <RentRollKpiHeader kpis={kpis} rows={rows} />
      <RentRollTable rows={rows} proyectoId={selectedProjectId} periodo={periodo} />
    </main>
  );
}
