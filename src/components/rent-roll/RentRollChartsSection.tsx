"use client";

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
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  RentRollCategoryConcentration,
  type RentRollCategoryConcentrationDatum
} from "@/components/rent-roll/RentRollCategoryConcentration";
import { formatWaltValue } from "@/lib/rent-roll/snapshot-date";
import type { PeriodoMetrica } from "@/types/timeline";

type RentRollChartsSectionProps = {
  periodos: PeriodoMetrica[];
  categoryConcentration: RentRollCategoryConcentrationDatum[];
};

const MESES_ES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic"
];

function formatPeriodoLabel(periodo: string): string {
  const [yearStr, monthStr] = periodo.split("-");
  const monthIndex = Number(monthStr) - 1;
  const year = String(Number(yearStr)).slice(-2);
  return `${MESES_ES[monthIndex] ?? monthStr} ${year}`;
}

function getCurrentPeriodo(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function tickFormatter(value: string, index: number, total: number): string {
  if (total > 18) {
    return index % 6 === 0 ? formatPeriodoLabel(value) : "";
  }
  if (total > 9) {
    return index % 3 === 0 ? formatPeriodoLabel(value) : "";
  }
  return formatPeriodoLabel(value);
}

function formatWaltAxisTick(value: number): string {
  if (value <= 0) {
    return "0";
  }
  return value >= 12 ? `${Math.round(value / 12)}a` : `${Math.round(value)}m`;
}

type ChartCardProps = {
  title: string;
  children: React.ReactNode;
};

function ChartCard({ title, children }: ChartCardProps): JSX.Element {
  return (
    <article className="overflow-hidden rounded-md bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-brand-700">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </article>
  );
}

export function RentRollChartsSection({
  periodos,
  categoryConcentration
}: RentRollChartsSectionProps): JSX.Element {
  const currentPeriodo = getCurrentPeriodo();
  const total = periodos.length;

  if (total === 0) {
    return (
      <section className="rounded-md bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">
          No hay datos de timeline disponibles para este proyecto.
        </p>
      </section>
    );
  }

  const xAxisTickFormatter = (value: string, index: number): string =>
    tickFormatter(value, index, total);

  const tooltipLabelFormatter = (label: ReactNode): ReactNode =>
    typeof label === "string" ? formatPeriodoLabel(label) : label;

  const chart1Data = periodos.map((p) => ({
    periodo: p.periodo,
    pctOcupacion: p.pctOcupacionGLA,
    waltMeses: p.waltMeses,
    esFuturo: p.esFuturo
  }));
  const maxWaltMeses = Math.max(...chart1Data.map((item) => item.waltMeses), 0);
  const waltAxisMax = Math.max(12, Math.ceil(maxWaltMeses / 6) * 6);

  const chart2Data = periodos.map((p) => ({
    periodo: p.periodo,
    rentaFijaUf: p.rentaFijaUf,
    esFuturo: p.esFuturo
  }));

  const chart3Data = periodos.map((p) => ({
    periodo: p.periodo,
    contratosActivos: p.contratosActivos,
    esFuturo: p.esFuturo
  }));

  const chart4Data = periodos.map((p) => ({
    periodo: p.periodo,
    glaArrendada: p.glaArrendadaM2,
    glaVacante: Math.max(0, p.glaTotalM2 - p.glaArrendadaM2)
  }));

  const chart5Data = periodos.map((p) => ({
    periodo: p.periodo,
    vencimientos: p.contratosQueVencenEsteMes,
    esFuturo: p.esFuturo
  }));

  const chart6Data = periodos.map((p) => ({
    periodo: p.periodo,
    regular: p.ingresosFijoUf,
    simuladorModulo: p.ingresosSimuladorModuloUf,
    bodegaEspacio: p.ingresosBodegaEspacioUf
  }));

  const now = new Date();
  const threshold3Months = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 1));
  const threshold3Periodo = `${threshold3Months.getUTCFullYear()}-${String(
    threshold3Months.getUTCMonth() + 1
  ).padStart(2, "0")}`;

  return (
    <section className="space-y-4">
      <RentRollCategoryConcentration data={categoryConcentration} />

      <header className="rounded-md bg-white p-4 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gold-400" />
          <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">
            Evolucion Historica y Proyectada
          </h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Series de tiempo mensuales: datos historicos de `ContratoDia` y proyeccion futura con
          contratos vigentes. La referencia vertical marca el mes actual.
        </p>
        <div className="mt-2 flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-5 bg-brand-700" />
            Historico
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-0.5 w-5 border-t-2 border-dashed border-[#60a5fa]"
              style={{ background: "none" }}
            />
            Proyectado
          </span>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="% Ocupacion GLA + WALT">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chart1Data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="periodo"
                tickFormatter={xAxisTickFormatter}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
              />
              <YAxis
                yAxisId="ocupacion"
                domain={[0, 100]}
                tickFormatter={(value: number) => `${value}%`}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <YAxis
                yAxisId="walt"
                orientation="right"
                domain={[0, waltAxisMax]}
                tickFormatter={formatWaltAxisTick}
                tick={{ fontSize: 11, fill: "#7c3aed" }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip
                labelFormatter={tooltipLabelFormatter}
                formatter={(value, name) => {
                  if (name === "WALT") {
                    return [formatWaltValue(Number(value)), "WALT"];
                  }
                  return [`${Number(value).toFixed(1)}%`, "Ocupacion GLA"];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine
                x={currentPeriodo}
                stroke="#f59e0b"
                strokeDasharray="4 2"
                label={{ value: "Hoy", position: "top", fontSize: 10, fill: "#f59e0b" }}
              />
              <Line
                yAxisId="ocupacion"
                type="monotone"
                dataKey="pctOcupacion"
                stroke="#1e40af"
                strokeWidth={2}
                dot={false}
                name="Ocupacion GLA"
                connectNulls={false}
              />
              <Line
                yAxisId="walt"
                type="monotone"
                dataKey="waltMeses"
                stroke="#7c3aed"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                name="WALT"
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-1 text-right text-xs text-slate-400">
            Azul = ocupacion GLA. Morado = WALT ponderado por m2.
          </p>
        </ChartCard>

        <ChartCard title="Renta Fija Total (UF)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chart2Data} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="periodo"
                tickFormatter={xAxisTickFormatter}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(value: number) =>
                  value.toLocaleString("es-CL", { maximumFractionDigits: 0 })
                }
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip
                labelFormatter={tooltipLabelFormatter}
                formatter={(value) => [
                  Number(value).toLocaleString("es-CL", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  }),
                  "Renta Fija UF"
                ]}
              />
              <ReferenceLine
                x={currentPeriodo}
                stroke="#f59e0b"
                strokeDasharray="4 2"
                label={{ value: "Hoy", position: "top", fontSize: 10, fill: "#f59e0b" }}
              />
              <Bar dataKey="rentaFijaUf" name="Renta Fija UF" radius={[2, 2, 0, 0]}>
                {chart2Data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.esFuturo ? "#93c5fd" : "#1e40af"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Contratos Activos">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chart3Data} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="periodo"
                tickFormatter={xAxisTickFormatter}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <Tooltip
                labelFormatter={tooltipLabelFormatter}
                formatter={(value) => [value, "Contratos activos"]}
              />
              <ReferenceLine
                x={currentPeriodo}
                stroke="#f59e0b"
                strokeDasharray="4 2"
                label={{ value: "Hoy", position: "top", fontSize: 10, fill: "#f59e0b" }}
              />
              <Line
                type="monotone"
                dataKey="contratosActivos"
                stroke="#1e40af"
                strokeWidth={2}
                dot={false}
                name="Contratos activos"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="GLA Arrendada vs Vacante (m2)">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chart4Data} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorArrendada" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1e40af" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#1e40af" stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="colorVacante" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e2e8f0" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#e2e8f0" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="periodo"
                tickFormatter={xAxisTickFormatter}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(value: number) =>
                  value.toLocaleString("es-CL", { maximumFractionDigits: 0 })
                }
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip
                labelFormatter={tooltipLabelFormatter}
                formatter={(value, name) => [
                  `${Number(value).toLocaleString("es-CL", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })} m2`,
                  name === "glaArrendada" ? "GLA Arrendada" : "GLA Vacante"
                ]}
              />
              <Legend
                formatter={(value: string) =>
                  value === "glaArrendada" ? "GLA Arrendada" : "GLA Vacante"
                }
                wrapperStyle={{ fontSize: 11 }}
              />
              <ReferenceLine
                x={currentPeriodo}
                stroke="#f59e0b"
                strokeDasharray="4 2"
                label={{ value: "Hoy", position: "top", fontSize: 10, fill: "#f59e0b" }}
              />
              <Area
                type="monotone"
                dataKey="glaArrendada"
                stackId="1"
                stroke="#1e40af"
                strokeWidth={1.5}
                fill="url(#colorArrendada)"
                name="glaArrendada"
              />
              <Area
                type="monotone"
                dataKey="glaVacante"
                stackId="1"
                stroke="#cbd5e1"
                strokeWidth={1.5}
                fill="url(#colorVacante)"
                name="glaVacante"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Vencimientos de Contratos por Mes">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chart5Data} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="periodo"
                tickFormatter={xAxisTickFormatter}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <Tooltip
                labelFormatter={tooltipLabelFormatter}
                formatter={(value) => [value, "Contratos que vencen"]}
              />
              <ReferenceLine
                x={currentPeriodo}
                stroke="#f59e0b"
                strokeDasharray="4 2"
                label={{ value: "Hoy", position: "top", fontSize: 10, fill: "#f59e0b" }}
              />
              <Bar dataKey="vencimientos" name="Contratos que vencen" radius={[2, 2, 0, 0]}>
                {chart5Data.map((entry, index) => {
                  const isNearTerm =
                    entry.periodo <= threshold3Periodo && entry.periodo >= currentPeriodo;
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={isNearTerm ? "#f43f5e" : "#fbbf24"}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-1 flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm bg-[#f43f5e]" />
              Proximos 3 meses
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm bg-[#fbbf24]" />
              Mas de 3 meses
            </span>
          </div>
        </ChartCard>

        <ChartCard title="Ingresos por Tipo de Local (UF)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chart6Data} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="periodo"
                tickFormatter={xAxisTickFormatter}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(value: number) =>
                  value.toLocaleString("es-CL", { maximumFractionDigits: 0 })
                }
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip
                labelFormatter={tooltipLabelFormatter}
                formatter={(value, name) => {
                  const labels: Record<string, string> = {
                    regular: "Local Comercial",
                    simuladorModulo: "Simulador / Modulo",
                    bodegaEspacio: "Bodega / Espacio"
                  };
                  const nameStr = String(name);
                  return [
                    Number(value).toLocaleString("es-CL", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    }),
                    labels[nameStr] ?? nameStr
                  ];
                }}
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
                wrapperStyle={{ fontSize: 11 }}
              />
              <ReferenceLine
                x={currentPeriodo}
                stroke="#f59e0b"
                strokeDasharray="4 2"
                label={{ value: "Hoy", position: "top", fontSize: 10, fill: "#f59e0b" }}
              />
              <Bar
                dataKey="regular"
                stackId="ingresos"
                fill="#1e40af"
                name="regular"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="simuladorModulo"
                stackId="ingresos"
                fill="#3b82f6"
                name="simuladorModulo"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="bodegaEspacio"
                stackId="ingresos"
                fill="#93c5fd"
                name="bodegaEspacio"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </section>
  );
}
