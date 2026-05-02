"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { cn, formatPercent, formatSquareMeters, formatUf } from "@/lib/utils";
import type { Local360Profile, Local360QuickStats } from "@/types/local-360";

type LocalProfileHeaderProps = {
  profile: Local360Profile;
  quickStats: Local360QuickStats;
};

export function LocalProfileHeader({ profile, quickStats }: LocalProfileHeaderProps): JSX.Element {
  const isActive = profile.estado === "ACTIVO";

  return (
    <ModuleSectionCard>
      <div className="px-5 py-4">
        <nav className="mb-2 flex flex-wrap items-center gap-1 text-xs text-slate-500">
          <Link
            href="/plan/units"
            className="text-brand-500 underline underline-offset-2 transition-colors hover:text-brand-700"
          >
            Expectativa · Locales
          </Link>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-brand-700">{profile.codigo}</h1>
            <p className="mt-0.5 text-sm text-slate-500">{profile.nombre || "—"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span>Tipo: <span className="font-medium text-slate-700">{profile.tipo}</span></span>
              <span>Piso: <span className="font-medium text-slate-700">{profile.piso || "—"}</span></span>
              <span>Zona: <span className="font-medium text-slate-700">{profile.zonaNombre || "—"}</span></span>
              {profile.categoriaTamano ? (
                <span>Tamaño: <span className="font-medium text-slate-700">{profile.categoriaTamano}</span></span>
              ) : null}
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "rounded px-3 py-1 text-xs font-bold uppercase tracking-wide",
              isActive
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700",
            )}
          >
            {isActive ? "Activo" : "Inactivo"}
          </Badge>
        </div>

        <div className="mt-4 flex flex-wrap gap-6 border-t border-slate-100 pt-4">
          <QuickStat label="GLA" value={formatSquareMeters(profile.glam2)} />
          <QuickStat
            label="Arrendatario actual"
            value={quickStats.currentTenantName ?? "Vacante"}
          />
          {quickStats.currentRentUf !== null ? (
            <QuickStat
              label="Renta mensual actual"
              value={`${formatUf(quickStats.currentRentUf)} UF`}
            />
          ) : null}
          <QuickStat
            label="Ocupación (rango)"
            value={formatPercent(quickStats.occupancyPct, 1)}
            sub={`${quickStats.totalDaysOccupied} días ocupados`}
          />
          <QuickStat label="Arrendatarios distintos" value={String(quickStats.totalUniqueTenants)} />
        </div>
      </div>
    </ModuleSectionCard>
  );
}

function QuickStat({ label, value, sub }: { label: string; value: string; sub?: string }): JSX.Element {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-800">{value}</p>
      {sub ? <p className="text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}
