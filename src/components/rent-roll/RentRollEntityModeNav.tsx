"use client";

import Link from "next/link";
import type { RentRollEntity, RentRollMode } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type RentRollEntityModeNavProps = {
  entity: RentRollEntity;
  mode: RentRollMode;
  proyectoId: string;
  showConfigTab?: boolean;
};

function withParams(baseHref: string, proyectoId: string, extra: Record<string, string>): string {
  const query = new URLSearchParams({ proyecto: proyectoId });
  Object.entries(extra).forEach(([key, value]) => query.set(key, value));
  return `${baseHref}?${query.toString()}`;
}

export function RentRollEntityModeNav({
  entity,
  mode,
  proyectoId,
  showConfigTab = false
}: RentRollEntityModeNavProps): JSX.Element {
  const viewHref = withParams(`/rent-roll/${entity}`, proyectoId, { seccion: "ver" });
  const cargarHref = withParams(`/rent-roll/${entity}`, proyectoId, { seccion: "cargar" });
  const uploadHref = withParams(`/rent-roll/${entity}`, proyectoId, { seccion: "upload" });
  const configHref = withParams(`/rent-roll/${entity}`, proyectoId, { seccion: "config" });

  return (
    <section className="space-y-3 rounded-md border border-brand-200 bg-brand-50/60 p-4 shadow-sm">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">Modo</p>
        <nav className="flex flex-wrap gap-2" aria-label="Seleccionar modo de trabajo">
          <Link
            href={viewHref}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-semibold transition",
              mode === "ver"
                ? "bg-brand-500 text-white ring-2 ring-gold-400/70"
                : "bg-white text-slate-700 hover:bg-slate-100"
            )}
          >
            Ver datos
          </Link>
          <Link
            href={cargarHref}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-semibold transition",
              mode === "cargar"
                ? "bg-brand-500 text-white ring-2 ring-gold-400/70"
                : "bg-white text-slate-700 hover:bg-slate-100"
            )}
          >
            Cargar datos
          </Link>
          <Link
            href={uploadHref}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-semibold transition",
              mode === "upload"
                ? "bg-brand-500 text-white ring-2 ring-gold-400/70"
                : "bg-white text-slate-700 hover:bg-slate-100"
            )}
          >
            Carga masiva
          </Link>
          {showConfigTab ? (
            <Link
              href={configHref}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-semibold transition",
                mode === "config"
                  ? "bg-brand-500 text-white ring-2 ring-gold-400/70"
                  : "bg-white text-slate-700 hover:bg-slate-100"
              )}
            >
              Configuración
            </Link>
          ) : null}
        </nav>
      </div>
    </section>
  );
}
