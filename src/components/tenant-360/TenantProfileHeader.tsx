"use client";

import { Badge } from "@/components/ui/badge";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { cn, formatClp, formatSquareMeters, formatUf } from "@/lib/utils";
import type { Tenant360Profile, Tenant360QuickStats } from "@/types/tenant-360";

type TenantProfileHeaderProps = {
  profile: Tenant360Profile;
  quickStats: Tenant360QuickStats;
};

export function TenantProfileHeader({ profile, quickStats }: TenantProfileHeaderProps): JSX.Element {
  return (
    <ModuleSectionCard>
      <div className="px-5 py-4">
        {/* Top row: name + status */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-brand-700">
              {profile.nombreComercial}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">{profile.razonSocial}</p>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span className="font-mono font-medium text-slate-600">{profile.rut}</span>
              {profile.email ? <span>{profile.email}</span> : null}
              {profile.telefono ? <span>{profile.telefono}</span> : null}
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "rounded px-3 py-1 text-xs font-bold uppercase tracking-wide",
              profile.vigente
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            )}
          >
            {profile.vigente ? "Activo" : "Inactivo"}
          </Badge>
        </div>

        {/* Quick stats row */}
        <div className="mt-4 flex flex-wrap gap-6 border-t border-slate-100 pt-4">
          <QuickStat label="GLA arrendada" value={formatSquareMeters(quickStats.totalLeasedM2)} />
          <QuickStat label="Contratos activos" value={String(quickStats.activeContractCount)} />
          <QuickStat
            label="Renta fija mensual"
            value={`${formatUf(quickStats.monthlyFixedRentUf)} UF`}
            sub={formatClp(quickStats.monthlyFixedRentClp)}
          />
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
