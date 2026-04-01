"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatDecimal } from "@/lib/utils";
import type { RentRollRow } from "@/types/rent-roll";

type RentRollAnalyticsDashboardProps = {
  rows: RentRollRow[];
};

const COLORS = {
  OCUPADO: "#10b981", // emerald-500
  GRACIA: "#f59e0b", // amber-500
  VACANTE: "#94a3b8" // slate-400
};

export function RentRollAnalyticsDashboard({ rows }: RentRollAnalyticsDashboardProps) {
  const { ocupacionData, vencimientosData } = useMemo(() => {
    // 1. Distribución Ocupacional en m2
    let m2Ocupado = 0;
    let m2Gracia = 0;
    let m2Vacante = 0;

    // 2. Vencimientos Próximos en m2 (apilados por estado)
    const vencimientos = {
      "<= 30": { name: "≤ 30 días", OCUPADO: 0, GRACIA: 0 },
      "31-60": { name: "31-60 días", OCUPADO: 0, GRACIA: 0 },
      "61-90": { name: "61-90 días", OCUPADO: 0, GRACIA: 0 },
      "> 90": { name: "> 90 días", OCUPADO: 0, GRACIA: 0 }
    };

    for (const row of rows) {
      const m2 = row.glam2 || 0;

      // Ocupación
      if (row.estado === "OCUPADO") m2Ocupado += m2;
      else if (row.estado === "GRACIA") m2Gracia += m2;
      else m2Vacante += m2;

      // Vencimientos (sólo para ocupados o en gracia)
      if (row.estado !== "VACANTE" && row.diasParaVencimiento !== null) {
        let bucket: keyof typeof vencimientos = "> 90";
        if (row.diasParaVencimiento <= 30) bucket = "<= 30";
        else if (row.diasParaVencimiento <= 60) bucket = "31-60";
        else if (row.diasParaVencimiento <= 90) bucket = "61-90";

        if (row.estado === "OCUPADO" || row.estado === "GRACIA") {
          vencimientos[bucket][row.estado] += m2;
        }
      }
    }

    return {
      ocupacionData: [
        { name: "Ocupado", value: m2Ocupado, fill: COLORS.OCUPADO },
        { name: "Gracia", value: m2Gracia, fill: COLORS.GRACIA },
        { name: "Vacante", value: m2Vacante, fill: COLORS.VACANTE }
      ].filter((d) => d.value > 0),
      vencimientosData: [
        vencimientos["<= 30"],
        vencimientos["31-60"],
        vencimientos["61-90"],
        vencimientos["> 90"]
      ]
    };
  }, [rows]);

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; fill?: string; color?: string; }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-md border border-slate-200 bg-white p-3 shadow-md">
          <p className="mb-2 font-semibold text-slate-800">{label || payload[0].name}</p>
          {payload.map((entry: { name: string; value: number; fill?: string; color?: string; }, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm text-slate-600">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
              <span className="capitalize">{entry.name}:</span>
              <span className="font-medium">{formatDecimal(entry.value)} m²</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Gráfico 1: Ocupación */}
      <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-800">Distribución Contractual (m²)</h3>
          <p className="text-xs text-slate-500">Superficie actual segmentada por estado</p>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={ocupacionData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {ocupacionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfico 2: Vencimientos apilados */}
      <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-800">Próximos Vencimientos (m²)</h3>
          <p className="text-xs text-slate-500">Superficie comprometida en el tiempo</p>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={vencimientosData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}m²`} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f1f5f9" }} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
              <Bar dataKey="OCUPADO" name="Ocupado" stackId="a" fill={COLORS.OCUPADO} radius={[0, 0, 4, 4]} />
              <Bar dataKey="GRACIA" name="Gracia" stackId="a" fill={COLORS.GRACIA} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
