"use client";

import { useMemo } from "react";
import { MetricChartCard } from "@/components/dashboard/MetricChartCard";
import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  RentRollCategoryConcentration,
  type RentRollCategoryConcentrationDatum
} from "@/components/plan/RentRollCategoryConcentration";
import { CustomWidgetChart } from "@/components/plan/CustomWidgetChart";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import {
  chartAxisProps,
  chartBarRadius,
  chartColors,
  chartGridProps,
  chartHeight,
  chartLegendProps,
  chartMargins,
} from "@/lib/charts/theme";
import { formatWaltValue } from "@/lib/plan/snapshot-date";
import { formatPercent, formatPeriodoCorto, formatSquareMeters, formatUf } from "@/lib/utils";
import type { PeriodoMetrica } from "@/types/rent-roll-timeline";
import type { FormulaConfig } from "@/lib/dashboard/custom-widget-engine";

type CustomWidgetRow = {
  id: string;
  title: string;
  chartType: string;
  enabled: boolean;
  position: number;
  formulaConfig: FormulaConfig;
};

export type GlaCategoryDatum = {
  category: string;
  totalM2: number;
};

type RentRollChartsSectionProps = {
  periodos: PeriodoMetrica[];
  categoryConcentration: RentRollCategoryConcentrationDatum[];
  glaTotalByCategory?: GlaCategoryDatum[];
  referencePeriodo?: string;
  enabledCharts?: Set<string>;
  waltVariant?: string;
  customWidgets?: CustomWidgetRow[];
};

// WALT line uses purple from the categorical palette so it is distinguishable
// from the brand-colored occupancy line. Kept explicit (not getSeriesColor(i))
// because the two lines aren't a series — they are separate metrics.
const chartSeriesPaletteWaltColor = "#7c3aed";


function getCurrentPeriodo(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function tickFormatter(value: string, index: number, total: number): string {
  if (total > 18) {
    return index % 6 === 0 ? formatPeriodoCorto(value) : "";
  }
  if (total > 9) {
    return index % 3 === 0 ? formatPeriodoCorto(value) : "";
  }
  return formatPeriodoCorto(value);
}

function formatWaltAxisTick(value: number): string {
  if (value <= 0) {
    return "0";
  }
  return value >= 12 ? `${Math.round(value / 12)}a` : `${Math.round(value)}m`;
}

export function RentRollChartsSection({
  periodos,
  categoryConcentration,
  glaTotalByCategory = [],
  referencePeriodo,
  enabledCharts,
  waltVariant = "con_walt",
  customWidgets = []
}: RentRollChartsSectionProps): JSX.Element {
  function chartEnabled(id: string): boolean {
    return enabledCharts ? enabledCharts.has(id) : true;
  }

  const currentPeriodo = referencePeriodo ?? getCurrentPeriodo();
  const total = periodos.length;

  const xAxisTickFormatter = (value: string, index: number): string =>
    tickFormatter(value, index, total);

  const tooltipLabelFormatter = (label: ReactNode): ReactNode =>
    typeof label === "string" ? formatPeriodoCorto(label) : label;

  const { chart1Data, waltAxisMax } = useMemo(() => {
    const data = periodos.map((p) => ({
      periodo: p.periodo,
      pctOcupacion: p.pctOcupacionGLA,
      waltMeses: p.waltMeses,
      esFuturo: p.esFuturo
    }));
    const maxWalt = Math.max(...data.map((item) => item.waltMeses), 0);
    return {
      chart1Data: data,
      waltAxisMax: Math.max(12, Math.ceil(maxWalt / 6) * 6)
    };
  }, [periodos]);

  const chart2Data = useMemo(
    () => periodos.map((p) => ({ periodo: p.periodo, rentaFijaUf: p.rentaFijaUf, esFuturo: p.esFuturo })),
    [periodos]
  );

  const chart3Data = useMemo(
    () => periodos.map((p) => ({ periodo: p.periodo, contratosActivos: p.contratosActivos, esFuturo: p.esFuturo })),
    [periodos]
  );

  const chart4Data = useMemo(
    () => periodos.map((p) => ({
      periodo: p.periodo,
      glaArrendada: p.glaArrendadaM2,
      glaVacante: p.glaVacanteM2
    })),
    [periodos]
  );

  const chart5Data = useMemo(
    () => periodos.map((p) => ({ periodo: p.periodo, vencimientos: p.contratosQueVencenEsteMes, esFuturo: p.esFuturo })),
    [periodos]
  );

  const chart6Data = useMemo(
    () => periodos.map((p) => ({
      periodo: p.periodo,
      regular: p.ingresosFijoUf,
      simuladorModulo: p.ingresosSimuladorModuloUf,
      bodegaEspacio: p.ingresosBodegaEspacioUf
    })),
    [periodos]
  );

  const threshold3Periodo = useMemo(() => {
    const now = new Date();
    const threshold3Months = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 1));
    return `${threshold3Months.getUTCFullYear()}-${String(threshold3Months.getUTCMonth() + 1).padStart(2, "0")}`;
  }, []);

  if (total === 0) {
    return (
      <section className="rounded-md bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">
          No hay datos de timeline disponibles para este proyecto.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {chartEnabled("chart_concentracion_gla") && (
        <RentRollCategoryConcentration data={categoryConcentration} />
      )}

      {/* chart4 — Distribución m² Totales por Categoría */}
      {glaTotalByCategory.length > 0 && (
        <MetricChartCard
          title="Distribución de m² Totales por Categoría"
          metricId="chart_gla_distribution_pie"
          description="Participación de cada categoría (tamaño) en el total de m² GLA del proyecto."
        >
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <ResponsiveContainer width="100%" height={chartHeight.md}>
              <PieChart>
                <Pie
                  data={glaTotalByCategory}
                  dataKey="totalM2"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  label={({ name, percent }: { name?: string; percent?: number }) =>
                    `${name ?? ""} ${((percent ?? 0) * 100).toFixed(1)}%`
                  }
                  labelLine={false}
                >
                  {glaTotalByCategory.map((_, i) => {
                    const palette = [chartColors.brandPrimary, chartColors.gold, chartColors.brandDark, chartColors.brandLight, chartColors.goldLight];
                    return <Cell key={`cell-${i}`} fill={palette[i % palette.length]} />;
                  })}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [
                    `${Number(value ?? 0).toLocaleString("es-CL", { maximumFractionDigits: 0 })} m²`,
                    String(name ?? "")
                  ]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </MetricChartCard>
      )}

      <header className="rounded-md bg-white p-4 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gold-400" />
          <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">
            Evolucion Historica y Proyectada
          </h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Series de tiempo mensuales: datos historicos de `ContratoDia` y proyeccion futura con
          contratos vigentes. La referencia vertical marca la fecha de reporte del proyecto.
        </p>
        <div className="mt-2 flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-5 bg-brand-700" />
            Historico
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-0.5 w-5 border-t-2 border-dashed border-blue-400"
              style={{ background: "none" }}
            />
            Proyectado
          </span>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-2">
        {chartEnabled("chart_ocupacion_walt") && (
          <MetricChartCard metricId="chart_rent_roll_ocupacion_walt" title="% Ocupacion GLA + WALT">
            <ResponsiveContainer width="100%" height={chartHeight.sm}>
              <LineChart data={chart1Data} margin={{ ...chartMargins.default, left: 0 }}>
                <CartesianGrid {...chartGridProps} />
                <XAxis
                  dataKey="periodo"
                  tickFormatter={xAxisTickFormatter}
                  {...chartAxisProps}
                />
                <YAxis
                  yAxisId="ocupacion"
                  domain={[0, 100]}
                  tickFormatter={(value: number) => `${value}%`}
                  {...chartAxisProps}
                  width={40}
                />
                {waltVariant !== "solo_ocupacion" && (
                  <YAxis
                    yAxisId="walt"
                    orientation="right"
                    domain={[0, waltAxisMax]}
                    tickFormatter={formatWaltAxisTick}
                    {...chartAxisProps}
                    tick={{ fontSize: 11, fill: chartSeriesPaletteWaltColor }}
                    width={36}
                  />
                )}
                <Tooltip
                  content={
                    <ChartTooltip
                      labelFormatter={(l) => {
                        const f = tooltipLabelFormatter(l as ReactNode);
                        return typeof f === "string" ? f : String(l);
                      }}
                      valueFormatter={(value, name) =>
                        String(name) === "WALT"
                          ? formatWaltValue(Number(value))
                          : formatPercent(Number(value))
                      }
                    />
                  }
                />
                <Legend {...chartLegendProps} />
                <ReferenceLine
                  x={currentPeriodo}
                  stroke={chartColors.warningLight}
                  strokeDasharray="4 2"
                  label={{ value: "Reporte", position: "top", fontSize: 10, fill: chartColors.warningLight }}
                />
                <Line
                  yAxisId="ocupacion"
                  type="monotone"
                  dataKey="pctOcupacion"
                  stroke={chartColors.brandPrimary}
                  strokeWidth={2}
                  dot={false}
                  name="Ocupacion GLA"
                  connectNulls={false}
                />
                {waltVariant !== "solo_ocupacion" && (
                  <Line
                    yAxisId="walt"
                    type="monotone"
                    dataKey="waltMeses"
                    stroke={chartSeriesPaletteWaltColor}
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={false}
                    name="WALT"
                    connectNulls={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
            <p className="mt-1 text-right text-xs text-slate-400">
              Azul = ocupacion GLA. Morado = WALT ponderado por m2.
            </p>
          </MetricChartCard>
        )}

        {chartEnabled("chart_renta_fija_serie") && (
          <MetricChartCard metricId="chart_rent_roll_renta_fija_total_uf" title="Renta Fija Total (UF)">
          <ResponsiveContainer width="100%" height={chartHeight.sm}>
            <BarChart data={chart2Data} margin={{ ...chartMargins.default, left: 0 }}>
              <CartesianGrid {...chartGridProps} />
              <XAxis
                dataKey="periodo"
                tickFormatter={xAxisTickFormatter}
                {...chartAxisProps}
              />
              <YAxis
                tickFormatter={(value: number) => formatUf(value, 0)}
                {...chartAxisProps}
                width={52}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    labelFormatter={(l) => {
                      const f = tooltipLabelFormatter(l as ReactNode);
                      return typeof f === "string" ? f : String(l);
                    }}
                    valueFormatter={(value) => formatUf(Number(value))}
                  />
                }
              />
              <ReferenceLine
                x={currentPeriodo}
                stroke={chartColors.warningLight}
                strokeDasharray="4 2"
                label={{ value: "Reporte", position: "top", fontSize: 10, fill: chartColors.warningLight }}
              />
              <Bar dataKey="rentaFijaUf" name="Renta Fija UF" radius={chartBarRadius}>
                {chart2Data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.esFuturo ? chartColors.brandLight : chartColors.brandPrimary} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </MetricChartCard>
        )}

        {chartEnabled("chart_contratos_activos") && (
          <MetricChartCard metricId="chart_rent_roll_contratos_activos" title="Contratos Activos">
          <ResponsiveContainer width="100%" height={chartHeight.sm}>
            <LineChart data={chart3Data} margin={{ ...chartMargins.default, left: 0 }}>
              <CartesianGrid {...chartGridProps} />
              <XAxis
                dataKey="periodo"
                tickFormatter={xAxisTickFormatter}
                {...chartAxisProps}
              />
              <YAxis
                allowDecimals={false}
                {...chartAxisProps}
                width={32}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    labelFormatter={(l) => {
                      const f = tooltipLabelFormatter(l as ReactNode);
                      return typeof f === "string" ? f : String(l);
                    }}
                    valueFormatter={(value) => String(value)}
                  />
                }
              />
              <ReferenceLine
                x={currentPeriodo}
                stroke={chartColors.warningLight}
                strokeDasharray="4 2"
                label={{ value: "Reporte", position: "top", fontSize: 10, fill: chartColors.warningLight }}
              />
              <Line
                type="monotone"
                dataKey="contratosActivos"
                stroke={chartColors.brandPrimary}
                strokeWidth={2}
                dot={false}
                name="Contratos activos"
              />
            </LineChart>
          </ResponsiveContainer>
        </MetricChartCard>
        )}

        {chartEnabled("chart_gla_arrendada_vacante") && (
          <MetricChartCard metricId="chart_rent_roll_gla_arrendada_vacante_m2" title="GLA Arrendada vs Vacante (m2)">
          <ResponsiveContainer width="100%" height={chartHeight.sm}>
            <AreaChart data={chart4Data} margin={{ ...chartMargins.default, left: 0 }}>
              <defs>
                <linearGradient id="colorArrendada" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors.brandPrimary} stopOpacity={0.7} />
                  <stop offset="95%" stopColor={chartColors.brandPrimary} stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="colorVacante" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors.grid} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={chartColors.grid} stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid {...chartGridProps} />
              <XAxis
                dataKey="periodo"
                tickFormatter={xAxisTickFormatter}
                {...chartAxisProps}
              />
              <YAxis
                tickFormatter={(value: number) => formatUf(value, 0)}
                {...chartAxisProps}
                width={52}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    labelFormatter={(l) => {
                      const f = tooltipLabelFormatter(l as ReactNode);
                      return typeof f === "string" ? f : String(l);
                    }}
                    valueFormatter={(value) => formatSquareMeters(Number(value))}
                  />
                }
              />
              <Legend
                formatter={(value: string) =>
                  value === "glaArrendada" ? "GLA Arrendada" : "GLA Vacante"
                }
                {...chartLegendProps}
              />
              <ReferenceLine
                x={currentPeriodo}
                stroke={chartColors.warningLight}
                strokeDasharray="4 2"
                label={{ value: "Reporte", position: "top", fontSize: 10, fill: chartColors.warningLight }}
              />
              <Area
                type="monotone"
                dataKey="glaArrendada"
                stackId="1"
                stroke={chartColors.brandPrimary}
                strokeWidth={1.5}
                fill="url(#colorArrendada)"
                name="glaArrendada"
              />
              <Area
                type="monotone"
                dataKey="glaVacante"
                stackId="1"
                stroke={chartColors.axisMuted}
                strokeWidth={1.5}
                fill="url(#colorVacante)"
                name="glaVacante"
              />
            </AreaChart>
          </ResponsiveContainer>
        </MetricChartCard>
        )}

        {chartEnabled("chart_vencimientos_mes") && (
          <MetricChartCard metricId="chart_rent_roll_vencimientos_por_mes" title="Vencimientos de Contratos por Mes">
          <ResponsiveContainer width="100%" height={chartHeight.sm}>
            <BarChart data={chart5Data} margin={{ ...chartMargins.default, left: 0 }}>
              <CartesianGrid {...chartGridProps} />
              <XAxis
                dataKey="periodo"
                tickFormatter={xAxisTickFormatter}
                {...chartAxisProps}
              />
              <YAxis
                allowDecimals={false}
                {...chartAxisProps}
                width={32}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    labelFormatter={(l) => {
                      const f = tooltipLabelFormatter(l as ReactNode);
                      return typeof f === "string" ? f : String(l);
                    }}
                    valueFormatter={(value) => String(value)}
                  />
                }
              />
              <ReferenceLine
                x={currentPeriodo}
                stroke={chartColors.warningLight}
                strokeDasharray="4 2"
                label={{ value: "Reporte", position: "top", fontSize: 10, fill: chartColors.warningLight }}
              />
              <Bar dataKey="vencimientos" name="Contratos que vencen" radius={chartBarRadius}>
                {chart5Data.map((entry, index) => {
                  const isNearTerm =
                    entry.periodo <= threshold3Periodo && entry.periodo >= currentPeriodo;
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={isNearTerm ? chartColors.negativeLight : chartColors.warningLight}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-1 flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-3 rounded-sm"
                style={{ backgroundColor: chartColors.negativeLight }}
              />
              Proximos 3 meses
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-3 rounded-sm"
                style={{ backgroundColor: chartColors.warningLight }}
              />
              Mas de 3 meses
            </span>
          </div>
        </MetricChartCard>
        )}

        {chartEnabled("chart_ingresos_tipo_local") && (
          <MetricChartCard metricId="chart_rent_roll_ingresos_tipo_local_uf" title="Ingresos por Tipo de Local (UF)">
          <ResponsiveContainer width="100%" height={chartHeight.sm}>
            <BarChart data={chart6Data} margin={{ ...chartMargins.default, left: 0 }}>
              <CartesianGrid {...chartGridProps} />
              <XAxis
                dataKey="periodo"
                tickFormatter={xAxisTickFormatter}
                {...chartAxisProps}
              />
              <YAxis
                tickFormatter={(value: number) => formatUf(value, 0)}
                {...chartAxisProps}
                width={52}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    labelFormatter={(l) => {
                      const f = tooltipLabelFormatter(l as ReactNode);
                      return typeof f === "string" ? f : String(l);
                    }}
                    valueFormatter={(value, name) => {
                      const labels: Record<string, string> = {
                        regular: "Local Comercial",
                        simuladorModulo: "Simulador / Modulo",
                        bodegaEspacio: "Bodega / Espacio"
                      };
                      const prefix = labels[String(name)] ?? String(name);
                      return `${prefix}: ${formatUf(Number(value))}`;
                    }}
                  />
                }
              />
              <Legend
                formatter={(value: string) => {
                  const labels: Record<string, string> = {
                    regular: "Local Comercial",
                    simuladorModulo: "Simulador / Modulo",
                    bodegaEspacio: "Bodega / Espacio"
                  };
                  return labels[value] ?? value;
                }}
                {...chartLegendProps}
              />
              <ReferenceLine
                x={currentPeriodo}
                stroke={chartColors.warningLight}
                strokeDasharray="4 2"
                label={{ value: "Reporte", position: "top", fontSize: 10, fill: chartColors.warningLight }}
              />
              <Bar
                dataKey="regular"
                stackId="ingresos"
                fill={chartColors.brandDark}
                name="regular"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="simuladorModulo"
                stackId="ingresos"
                fill={chartColors.brandPrimary}
                name="simuladorModulo"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="bodegaEspacio"
                stackId="ingresos"
                fill={chartColors.brandLight}
                name="bodegaEspacio"
                radius={chartBarRadius}
              />
            </BarChart>
          </ResponsiveContainer>
        </MetricChartCard>
        )}

        {customWidgets.filter((w) => w.enabled && w.chartType !== "kpi").map((widget) => (
          <CustomWidgetChart
            key={widget.id}
            widget={widget}
            periodos={periodos}
            currentPeriodo={currentPeriodo}
            xAxisTickFormatter={xAxisTickFormatter}
            tooltipLabelFormatter={tooltipLabelFormatter}
          />
        ))}
      </div>
    </section>
  );
}
