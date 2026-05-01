"use client";

import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { chartColors, chartLegendProps, getSeriesColor } from "@/lib/charts/theme";
import { formatUf } from "@/lib/utils";
import type { Tenant360SalesPoint } from "@/types/tenant-360";

const MESES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

type SalesSeasonalityChartProps = {
  data: Tenant360SalesPoint[];
};

export function SalesSeasonalityChart({ data }: SalesSeasonalityChartProps): JSX.Element {
  if (data.length < 3) return <></>;

  const yearSet = new Set<string>();
  // month index 0..11 → year → total & count (for averaging)
  const byMonthYear = Array.from({ length: 12 }, () => new Map<string, { total: number; count: number }>());

  for (const point of data) {
    const year = point.period.slice(0, 4);
    const monthIdx = parseInt(point.period.slice(5, 7), 10) - 1;
    if (monthIdx < 0 || monthIdx > 11) continue;
    yearSet.add(year);
    const cell = byMonthYear[monthIdx];
    const existing = cell.get(year) ?? { total: 0, count: 0 };
    cell.set(year, { total: existing.total + point.salesUf, count: existing.count + 1 });
  }

  const years = Array.from(yearSet).sort();

  const radarData = MESES_CORTO.map((label, i) => {
    const row: Record<string, string | number | null> = { month: label };
    for (const year of years) {
      const cell = byMonthYear[i].get(year);
      row[year] = cell ? cell.total / cell.count : null;
    }
    return row;
  });

  // Only render if there's meaningful data
  const hasData = radarData.some((r) => years.some((y) => r[y] != null && (r[y] as number) > 0));
  if (!hasData) return <></>;

  const seriesColors = [chartColors.brandPrimary, chartColors.gold, getSeriesColor(2), getSeriesColor(3)];

  return (
    <ModuleSectionCard
      title="Estacionalidad de Ventas"
      description="Promedio mensual de ventas por mes del año — revela patrones estacionales."
    >
      <div className="flex justify-center px-4 py-4">
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
            <PolarGrid stroke={chartColors.grid} />
            <PolarAngleAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: chartColors.axis }}
            />
            <Tooltip
              formatter={(value: unknown) => {
                const v = typeof value === "number" ? value : Number(value ?? 0);
                return [`${formatUf(v)} UF`, ""];
              }}
              contentStyle={{
                fontSize: 11,
                borderRadius: 6,
                border: `1px solid ${chartColors.grid}`,
                background: "#fff",
              }}
            />
            <Legend {...chartLegendProps} />
            {years.map((year, idx) => (
              <Radar
                key={year}
                name={year}
                dataKey={year}
                stroke={seriesColors[idx % seriesColors.length]}
                fill={seriesColors[idx % seriesColors.length]}
                fillOpacity={0.12}
                strokeWidth={2}
                dot={{ r: 3, fill: seriesColors[idx % seriesColors.length] }}
                connectNulls
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </ModuleSectionCard>
  );
}
