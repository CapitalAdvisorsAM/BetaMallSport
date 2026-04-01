"use client";

import type { ReactNode } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from "recharts";
import type { PeriodoMetrica } from "@/types/timeline";
import {
  RentRollCategoryConcentration,
  type RentRollCategoryConcentrationDatum
} from "@/components/rent-roll/RentRollCategoryConcentration";

type RentRollChartsSectionProps = {
  periodos: PeriodoMetrica[];
  categoryConcentration: RentRollCategoryConcentrationDatum[];
};

const MESES_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

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
  // Show every 3rd label if many data points
  if (total > 18) {
    return index % 6 === 0 ? formatPeriodoLabel(value) : "";
  }
  if (total > 9) {
    return index % 3 === 0 ? formatPeriodoLabel(value) : "";
  }
  return formatPeriodoLabel(value);
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

  // Chart 1: % Ocupacion GLA
  const chart1Data = periodos.map((p) => ({
    periodo: p.periodo,
    pctOcupacion: p.pctOcupacionGLA,
    esFuturo: p.esFuturo
  }));

  // Chart 2: Renta Fija Total UF
  const chart2Data = periodos.map((p) => ({
    periodo: p.periodo,
    rentaFijaUf: p.rentaFijaUf,
    esFuturo: p.esFuturo
  }));

  // Chart 3: Contratos Activos
  const chart3Data = periodos.map((p) => ({
    periodo: p.periodo,
    contratosActivos: p.contratosActivos,
    esFuturo: p.esFuturo
  }));

  // Chart 4: GLA Arrendada vs GLA Total
  const chart4Data = periodos.map((p) => ({
    periodo: p.periodo,
    glaArrendada: p.glaArrendadaM2,
    glaVacante: Math.max(0, p.glaTotalM2 - p.glaArrendadaM2)
  }));

  // Chart 5: Vencimientos por mes
  const chart5Data = periodos.map((p) => ({
    periodo: p.periodo,
    vencimientos: p.contratosQueVencenEsteMes,
    esFuturo: p.esFuturo
  }));

  // Chart 6: Ingresos por tipo (stacked bar)
  const chart6Data = periodos.map((p) => ({
    periodo: p.periodo,
    regular: p.ingresosFijoUf,
    simuladorModulo: p.ingresosSimuladorModuloUf,
    bodegaEspacio: p.ingresosBodegaEspacioUf
  }));

  // Get month index 3 from now for vencimientos color threshold
  const now = new Date();
  const threshold3Months = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 1));
  function toPeriodoKeyLocal(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }
  const threshold3Periodo = toPeriodoKeyLocal(threshold3Months);

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
          Series de tiempo mensuales: datos historicos (ContratoDia) y proyeccion futura (contratos
          vigentes). La linea vertical marca el mes actual.
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
        {/* Chart 1: % Ocupacion GLA */}
        <ChartCard title="% Ocupacion GLA">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chart1Data} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="periodo"
                tickFormatter={xAxisTickFormatter}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                labelFormatter={tooltipLabelFormatter}
                formatter={(value) => [`${Number(value).toFixed(1)}%`, "Ocupacion GLA"]}
              />
              <ReferenceLine
                x={currentPeriodo}
                stroke="#f59e0b"
                strokeDasharray="4 2"
                label={{ value: "Hoy", position: "top", fontSize: 10, fill: "#f59e0b" }}
              />
              {/* Past line */}
              <Line
                type="monotone"
                dataKey="pctOcupacion"
                stroke="#1e40af"
                strokeWidth={2}
                dot={false}
                name="Ocupacion GLA"
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-1 text-right text-xs text-slate-400">
            Linea solida = historico · Proyeccion marcada con referencia vertical
          </p>
        </ChartCard>

        {/* Chart 2: Renta Fija Total UF */}
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
                tickFormatter={(v: number) => v.toLocaleString("es-CL", { maximumFractionDigits: 0 })}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip
                labelFormatter={tooltipLabelFormatter}
                formatter={(value) => [
                  Number(value).toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
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

        {/* Chart 3: Contratos Activos */}
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

        {/* Chart 4: GLA Arrendada vs GLA Total */}
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
                tickFormatter={(v: number) => v.toLocaleString("es-CL", { maximumFractionDigits: 0 })}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip
                labelFormatter={tooltipLabelFormatter}
                formatter={(value, name) => [
                  `${Number(value).toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m2`,
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

        {/* Chart 5: Vencimientos por mes */}
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
                  const isNearTerm = entry.periodo <= threshold3Periodo && entry.periodo >= currentPeriodo;
                  const fill = isNearTerm ? "#f43f5e" : "#fbbf24";
                  return <Cell key={`cell-${index}`} fill={fill} />;
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

        {/* Chart 6: Ingresos por tipo (stacked) */}
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
                tickFormatter={(v: number) => v.toLocaleString("es-CL", { maximumFractionDigits: 0 })}
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
                    Number(value).toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
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
