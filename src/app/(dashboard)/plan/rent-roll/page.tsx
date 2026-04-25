import Link from "next/link";
import { redirect } from "next/navigation";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { RentRollDashboardTable } from "@/components/plan/RentRollDashboardTable";
import { OccupancyBySizeTable } from "@/components/plan/OccupancyBySizeTable";
import { OcupacionTipoTable } from "@/components/plan/OcupacionTipoTable";
import { RentRollSnapshotDatePicker } from "@/components/plan/RentRollSnapshotDatePicker";
import { Button } from "@/components/ui/button";
import { buildExportExcelUrl } from "@/lib/export/shared";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { buildRentRollSnapshotRows } from "@/lib/plan/rent-roll-snapshot";
import {
  formatWaltValue,
  resolveSnapshotDate
} from "@/lib/plan/snapshot-date";
import { formatDecimal } from "@/lib/utils";

type RentRollPageProps = {
  searchParams: {
    periodo?: string;
    fecha?: string;
  };
};

export default async function RentRollPage({
  searchParams
}: RentRollPageProps): Promise<JSX.Element> {
  await requireSession();

  const { selectedProjectId } = await getProjectContext();
  if (!selectedProjectId) {
    redirect("/");
  }

  const fecha = resolveSnapshotDate(searchParams.fecha, searchParams.periodo);

  if (
    searchParams.fecha !== fecha ||
    searchParams.periodo
  ) {
    const params = new URLSearchParams();
    params.set("fecha", fecha);
    redirect(`/plan/rent-roll?${params.toString()}`);
  }

  const snapshot = await buildRentRollSnapshotRows(selectedProjectId, fecha);
  const {
    rows,
    contractCount,
    vacantCount,
    totals,
    walt,
    ocupacionDetalle,
    periodoVentasVariable
  } = snapshot;

  const tamanoRows = [
    { key: "Tienda Mayor", label: "Tienda Mayor" },
    { key: "Tienda Mediana", label: "Tienda Mediana" },
    { key: "Tienda Menor", label: "Tienda Menor" },
    { key: "Modulo", label: "Modulo" },
    { key: "Bodega", label: "Bodega" }
  ] as const;
  const ocupacionRows = tamanoRows.map((row) => {
    const data = ocupacionDetalle.porTamano[row.key] ?? {
      gla: 0,
      glaArrendada: 0,
      pctVacancia: 0
    };

    return {
      tipo: row.label,
      glaTotal: data.gla,
      glaArrendada: data.glaArrendada,
      vacante: Math.max(data.gla - data.glaArrendada, 0),
      pctVacancia: data.pctVacancia
    };
  });

  const categoriaRows = Object.entries(ocupacionDetalle.porCategoria)
    .filter(([, data]) => data.gla > 0)
    .map(([categoria, data]) => ({
      categoria,
      glaTotal: data.gla,
      glaArrendada: data.glaArrendada,
      vacante: Math.max(data.gla - data.glaArrendada, 0),
      pctDelTotal: data.pct,
      pctVacancia: data.pctVacancia
    }));

  return (
    <main className="space-y-4">
      <header className="rounded-md bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gold-400" />
              <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">
                Rent Roll
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Vista operacional snapshot: estado contractual actual y metricas en una fecha exacta.
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-md bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <RentRollSnapshotDatePicker projectId={selectedProjectId} selectedDate={fecha} />
          <div className="flex flex-wrap items-end gap-3">
            <div className="rounded-md border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700">
              <div><span className="font-semibold">Snapshot:</span> {fecha}</div>
              <div><span className="font-semibold">Presupuesto (renta variable):</span> {periodoVentasVariable}</div>
            </div>
            <Button asChild type="button" size="sm">
              <Link
                href={buildExportExcelUrl({
                  dataset: "rent_roll_snapshot",
                  scope: "all",
                  projectId: selectedProjectId,
                  fecha
                })}
              >
                Descargar Excel
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
        <KpiCard
          metricId="kpi_rent_roll_snapshot_renta_fija_total_uf"
          title="Renta fija total (UF)"
          value={formatDecimal(totals.rentaFijaUf)}
          subtitle={`${contractCount} contratos activos`}
          accent="slate"
        />
        <KpiCard
          metricId="kpi_rent_roll_snapshot_ggcc_total_uf"
          title="GGCC total (UF)"
          value={formatDecimal(totals.ggccUf)}
          accent="slate"
        />
        <KpiCard
          title="Locales vacantes"
          value={vacantCount.toString()}
          subtitle={vacantCount === 0 ? "Sin vacantes al snapshot" : "Locales activos sin contrato vigente"}
          accent={vacantCount === 0 ? "green" : "red"}
        />
        <KpiCard
          metricId="kpi_rent_roll_snapshot_walt_global"
          title="WALT global"
          value={formatWaltValue(walt)}
          subtitle={walt > 0 ? `Promedio ponderado al ${fecha}` : "Sin contratos activos"}
          accent="yellow"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="overflow-hidden rounded-md bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-brand-700">Ocupacion por tamano</h3>
          </div>
          <OccupancyBySizeTable rows={ocupacionRows} />
        </article>
        <article className="overflow-hidden rounded-md bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-brand-700">Ocupacion por categoria</h3>
          </div>
          <OcupacionTipoTable rows={categoriaRows} />
        </article>
      </section>

      <RentRollDashboardTable rows={rows} snapshotDate={fecha} />
    </main>
  );
}
