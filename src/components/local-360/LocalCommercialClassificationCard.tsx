"use client";

import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { formatDateString } from "@/lib/utils";
import type { Local360Profile, TenantSelectorEntry } from "@/types/local-360";

type Props = {
  profile: Local360Profile;
  tenants: TenantSelectorEntry[];
  selectedTenantId: string | null;
  onTenantChange: (tenantId: string) => void;
  selectedTenantName: string | null;
  selectedDataContableId: string | null;
  selectedVentasId: string | null;
};

export function LocalCommercialClassificationCard({
  profile,
  tenants,
  selectedTenantId,
  onTenantChange,
  selectedTenantName,
  selectedDataContableId,
  selectedVentasId,
}: Props): JSX.Element {
  return (
    <ModuleSectionCard title="Análisis por Cliente" description="Clasificación e identificadores del local + selector de arrendatario.">
      <div className="grid grid-cols-1 gap-6 px-5 py-4 lg:grid-cols-2">
        <div>
          <div className="mb-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Arrendatario
            </label>
            <select
              value={selectedTenantId ?? ""}
              onChange={(event) => onTenantChange(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={tenants.length === 0}
            >
              {tenants.length === 0 ? (
                <option value="">Sin arrendatarios</option>
              ) : null}
              {tenants.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>
                  {t.tenantName}
                  {t.isCurrent ? " · vigente" : ""} ({formatDateString(t.fechaInicio)} → {formatDateString(t.fechaTermino)})
                </option>
              ))}
            </select>
          </div>
          <KeyValue label="ID Local" value={profile.codigo} />
          <KeyValue label="ID Data Contable" value={selectedDataContableId ?? "—"} />
          <KeyValue label="ID Ventas" value={selectedVentasId ?? selectedTenantName ?? "—"} />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Clasificación</p>
          <KeyValue label="Categoría (Tamaño)" value={profile.categoriaTamano ?? "—"} />
          <KeyValue label="Categoría (Tipo)" value={String(profile.tipo)} />
          <KeyValue label="Piso" value={profile.piso ?? "—"} />
          <KeyValue label="GLA / NO GLA" value={profile.esGLA ? "GLA" : "NO GLA"} />
        </div>
      </div>
    </ModuleSectionCard>
  );
}

function KeyValue({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="mt-2 flex items-baseline gap-3">
      <span className="min-w-[140px] text-xs text-slate-500">{label}</span>
      <span className="text-sm font-medium tabular-nums text-slate-800">{value}</span>
    </div>
  );
}
