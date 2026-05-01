"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import {
  chartAxisProps,
  chartColors,
  chartGridProps,
  chartHeight,
  chartLegendProps,
  chartMargins,
  getSeriesColor,
} from "@/lib/charts/theme";
import { formatUf, formatPercent } from "@/lib/utils";
import type { Tenant360SalesPoint } from "@/types/tenant-360";

const MESES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

type SalesYoYChartProps = {
  data: Tenant360SalesPoint[];
};

type YoYRow = {
  monthLabel: string;
  [year: string]: string | number | null;
};

export function SalesYoYChart({ data }: SalesYoYChartProps): JSX.Element {
  if (data.length < 2) return <></>;

  // Collect unique years and build month → year map
  const yearSet = new Set<string>();
  const byYearMonth = new Map<string, number>();

  for (const point of data) {
    const year = point.period.slice(0, 4);
    const month = point.period.slice(5, 7);
    yearSet.add(year);
    byYearMonth.set(`${year}-${month}`, point.salesUf);
  }

  const years = Array.from(yearSet).sort();
  if (years.length < 2) return <></>;

  // Build rows indexed by month 01..12
  const rows: YoYRow[] = MESES_CORTO.map((label, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const row: YoYRow = { monthLabel: label };

    for (const year of years) {
      row[year] = byYearMonth.get(`${year}-${mm}`) ?? null;
    }

    // YoY % change between last two years for this month
    const lastYear = years[years.length - 1];
    const prevYear = years[years.length - 2];
    const last = byYearMonth.get(`${lastYear}-${mm}`);
    const prev = byYearMonth.get(`${prevYear}-${mm}`);
    row.yoyPct = last != null && prev != null && prev > 0
      ? ((last - prev) / prev) * 100
      : null;

    return row;
  });

  // Only keep months that have at least one year of data
  const activeRows = rows.filter((r) =>
    years.some((y) => r[y] != null)
  );

  if (activeRows.length === 0) return <></>;

  const lastYear = years[years.length - 1];
  const prevYear = years[years.length - 2];

  return (
    <ModuleSectionCard
      title="Comparacion Año a Año"
      description={`Ventas mensuales ${prevYear} vs ${lastYear} con variacion % interanual.`}
    >
      <div className="px-4 py-4">
        <ResponsiveContainer width="100%" height={chartHeight.md}>
          <ComposedChart data={activeRows} margin={chartMargins.withLegend}>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="monthLabel" {...chartAxisProps} />
            <YAxis
              yAxisId="left"
              {...chartAxisProps}
              tickFormatter={(v: number) => `${formatUf(v)}`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              {...chartAxisProps}
              tickFormatter={(v: number) => formatPercent(v, 0)}
            />
            <Tooltip
              content={
                <ChartTooltip
                  valueFormatter={(value, name) => {
                    const v = typeof value === "number" ? value : Number(value ?? 0);
                    if (String(name) === "Var. YoY %") return formatPercent(v, 1);
                    return `${formatUf(v)} UF`;
                  }}
                />
              }
            />
            <Legend verticalAlign="top" height={32} {...chartLegendProps} />
            <Bar
              yAxisId="left"
              dataKey={prevYear}
              name={prevYear}
              fill={chartColors.axisMuted}
              radius={[2, 2, 0, 0]}
              barSize={14}
              opacity={0.7}
            />
            <Bar
              yAxisId="left"
              dataKey={lastYear}
              name={lastYear}
              fill={getSeriesColor(0)}
              radius={[2, 2, 0, 0]}
              barSize={14}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="yoyPct"
              name="Var. YoY %"
              stroke={chartColors.gold}
              strokeWidth={2}
              dot={{ r: 3, fill: chartColors.gold }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ModuleSectionCard>
  );
}
