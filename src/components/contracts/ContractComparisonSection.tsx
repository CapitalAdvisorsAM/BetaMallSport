import Link from "next/link";
import { DeltaPill } from "@/components/ui/DeltaPill";
import { getStripedRowClass, tableTheme } from "@/components/ui/table-theme";
import { cn, formatDecimal, formatPercent, formatUf } from "@/lib/utils";
import type {
  ContractComparison,
  ContractComparisonMetric,
  ContractComparisonRow,
} from "@/types/contract-comparison";

type ContractComparisonSectionProps = {
  comparison: ContractComparison | null;
  compact?: boolean;
};

function formatNullable(value: number | null, formatter: (value: number) => string): string {
  return value === null || Number.isNaN(value) ? "-" : formatter(value);
}

function metricSubtitle(metric: ContractComparisonMetric, suffix: string, decimals = 2): string {
  if (metric.peerAverage === null) return "Sin promedio de pares";
  return `Prom. pares ${metric.peerAverage.toLocaleString("es-CL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${suffix}`;
}

function MetricTile({
  label,
  value,
  metric,
  suffix,
  decimals = 2,
  inverseDelta = false,
}: {
  label: string;
  value: string;
  metric: ContractComparisonMetric;
  suffix: string;
  decimals?: number;
  inverseDelta?: boolean;
}): JSX.Element {
  const delta = metric.deltaVsAverage;
  return (
    <div className="rounded-md border border-surface-200 bg-white p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-brand-700">{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>{metricSubtitle(metric, suffix, decimals)}</span>
        <DeltaPill
          value={delta === null ? null : inverseDelta ? -delta : delta}
          suffix={suffix}
          decimals={decimals}
          kind="ingreso"
          mode="variance"
        />
      </div>
      {metric.rankPosition && metric.rankTotal > 0 ? (
        <p className="mt-1 text-[11px] tabular-nums text-slate-400">
          Ranking {metric.rankPosition} / {metric.rankTotal}
        </p>
      ) : null}
    </div>
  );
}

function PeerRow({ row, index, compact }: { row: ContractComparisonRow; index: number; compact: boolean }): JSX.Element {
  return (
    <tr className={`${getStripedRowClass(index, "compact")} ${tableTheme.rowHover}`}>
      <td className="px-3 py-2 text-sm">
        <Link
          href={`/plan/contracts/${row.contractId}`}
          className="font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700"
        >
          {row.numeroContrato}
        </Link>
        <p className="text-xs text-slate-400">{row.arrendatario}</p>
      </td>
      <td className="px-3 py-2 text-sm text-slate-600">
        {row.localCodigo}
        <p className="text-xs text-slate-400">{formatDecimal(row.localGlam2)} m2</p>
      </td>
      <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">
        {formatNullable(row.fixedRentUfM2, (value) => `${formatUf(value)} UF/m2/mes`)}
      </td>
      <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">
        {formatNullable(row.ggccUfM2, (value) => `${formatUf(value)} UF/m2/mes`)}
      </td>
      <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">
        {formatNullable(row.variablePct, (value) => formatPercent(value, 1))}
      </td>
      {!compact ? (
        <>
          <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">
            {formatNullable(row.pisoMinimoUf, (value) => `${formatUf(value)} UF`)}
          </td>
          <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">
            {formatNullable(row.avgBillingUfM2, (value) => `${formatUf(value)} UF/m2/mes`)}
          </td>
          <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">
            {formatNullable(row.avgSalesUfM2, (value) => `${formatUf(value)} UF/m2/mes`)}
          </td>
          <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">
            {formatNullable(row.occupancyCostPct, (value) => formatPercent(value, 1))}
          </td>
        </>
      ) : null}
      <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">
        {row.diasRestantes}
      </td>
    </tr>
  );
}

export function ContractComparisonSection({
  comparison,
  compact = false,
}: ContractComparisonSectionProps): JSX.Element {
  if (!comparison || comparison.peerCount === 0) {
    return (
      <section className={cn("rounded-md border border-surface-200 bg-white", compact ? "p-3" : "p-5")}>
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Comparacion con contratos similares
        </h4>
        <p className="mt-2 text-sm text-slate-500">
          No hay contratos vigentes o en gracia con locales similares para comparar.
        </p>
      </section>
    );
  }

  const rows = compact ? comparison.peers.slice(0, 5) : comparison.peers;
  const { current, metrics } = comparison;

  return (
    <section className={cn("rounded-md border border-surface-200 bg-white", compact ? "p-3" : "p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Comparacion con contratos similares
          </h4>
          <p className="mt-1 text-sm text-slate-500">
            {comparison.peerCount} par{comparison.peerCount === 1 ? "" : "es"} - {comparison.cohortLabel}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Renta fija y GGCC: tarifa vigente del contrato · Fact. y Ventas: promedio mensual YTD
          </p>
        </div>
        <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-slate-500">
          Ranking renta {metrics.fixedRentUfM2.rankPosition ?? "-"} / {metrics.fixedRentUfM2.rankTotal}
        </span>
      </div>

      <div className={cn("mt-4 grid gap-3", compact ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-4")}>
        <MetricTile
          label="Renta fija UF/m2/mes"
          value={formatNullable(current.fixedRentUfM2, (value) => `${formatUf(value)} UF/m2/mes`)}
          metric={metrics.fixedRentUfM2}
          suffix=" UF/m2/mes"
        />
        <MetricTile
          label="GGCC UF/m2/mes"
          value={formatNullable(current.ggccUfM2, (value) => `${formatUf(value)} UF/m2/mes`)}
          metric={metrics.ggccUfM2}
          suffix=" UF/m2/mes"
        />
        <MetricTile
          label="Facturacion UF/m2/mes"
          value={formatNullable(current.avgBillingUfM2, (value) => `${formatUf(value)} UF/m2/mes`)}
          metric={metrics.avgBillingUfM2}
          suffix=" UF/m2/mes"
        />
        <MetricTile
          label="Costo ocupacion"
          value={formatNullable(current.occupancyCostPct, (value) => formatPercent(value, 1))}
          metric={metrics.occupancyCostPct}
          suffix="%"
          decimals={1}
          inverseDelta
        />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className={`${tableTheme.table} text-sm`}>
          <thead className={tableTheme.head}>
            <tr>
              <th className={tableTheme.compactHeadCell}>Contrato</th>
              <th className={tableTheme.compactHeadCell}>Local</th>
              <th className={`${tableTheme.compactHeadCell} text-right`}>Renta fija</th>
              <th className={`${tableTheme.compactHeadCell} text-right`}>GGCC</th>
              <th className={`${tableTheme.compactHeadCell} text-right`}>% Var.</th>
              {!compact ? (
                <>
                  <th className={`${tableTheme.compactHeadCell} text-right`}>Piso min.</th>
                  <th className={`${tableTheme.compactHeadCell} text-right`}>Fact.</th>
                  <th className={`${tableTheme.compactHeadCell} text-right`}>Ventas</th>
                  <th className={`${tableTheme.compactHeadCell} text-right`}>Costo</th>
                </>
              ) : null}
              <th className={`${tableTheme.compactHeadCell} text-right`}>Dias</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <PeerRow key={row.contractId} row={row} index={index} compact={compact} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
