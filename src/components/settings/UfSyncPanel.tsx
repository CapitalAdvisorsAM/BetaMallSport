"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatUf } from "@/lib/utils";

type UfRow = { fecha: string; valor: string };

type UfSyncPanelProps = {
  currentUf: UfRow | null;
  isStale: boolean;
  isAdmin: boolean;
  ufValues: UfRow[];
};

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return fallback;
  try {
    const data = (await response.json()) as { message?: string };
    return data.message ?? fallback;
  } catch {
    return fallback;
  }
}

function TrendBadge({ current, previous }: { current: string; previous?: string }): JSX.Element | null {
  if (!previous) return null;
  const diff = Number(current) - Number(previous);
  if (Math.abs(diff) < 0.001) return null;
  const up = diff > 0;
  return (
    <span className={`ml-1.5 text-[10px] font-bold tabular-nums ${up ? "text-emerald-500" : "text-rose-500"}`}>
      {up ? "▲" : "▼"} {formatUf(Math.abs(diff))}
    </span>
  );
}

export function UfSyncPanel({ currentUf, isStale, isAdmin, ufValues }: UfSyncPanelProps): JSX.Element {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [showBackfill, setShowBackfill] = useState(false);
  const [backfillDesde, setBackfillDesde] = useState("");
  const [backfillHasta, setBackfillHasta] = useState("");

  // Table filter state (independent from backfill)
  const [filterDesde, setFilterDesde] = useState("");
  const [filterHasta, setFilterHasta] = useState("");

  const filteredValues = useMemo(() => {
    return ufValues.filter((row) => {
      if (filterDesde && row.fecha < filterDesde) return false;
      if (filterHasta && row.fecha > filterHasta) return false;
      return true;
    });
  }, [ufValues, filterDesde, filterHasta]);

  const hasFilter = filterDesde !== "" || filterHasta !== "";

  async function handleSyncHoy(): Promise<void> {
    setSyncing(true);
    try {
      const response = await fetch("/api/admin/uf-sync", { method: "POST" });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Error al sincronizar UF."));
      }
      const data = (await response.json()) as { synced: number; skipped: number };
      if (data.synced === 0) {
        toast.info("CMF no publicó valor UF para hoy aún. Intenta más tarde.");
      } else {
        toast.success(`UF sincronizada correctamente (${data.synced} registro).`);
      }
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleBackfill(): Promise<void> {
    if (!backfillDesde || !backfillHasta) {
      toast.error("Ingresa ambas fechas para el backfill.");
      return;
    }
    setSyncing(true);
    try {
      const response = await fetch("/api/admin/uf-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desde: backfillDesde, hasta: backfillHasta }),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Error al sincronizar rango UF."));
      }
      const data = (await response.json()) as { synced: number; skipped: number };
      toast.success(`Backfill completado: ${data.synced} registros sincronizados, ${data.skipped} omitidos.`);
      setBackfillDesde("");
      setBackfillHasta("");
      setShowBackfill(false);
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Estado actual */}
      <div className="flex items-center gap-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Último valor registrado</p>
          {currentUf ? (
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-slate-900">
                {formatUf(Number(currentUf.valor))}
              </span>
              <span className="text-sm text-slate-400">UF · {currentUf.fecha}</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-rose-600">Sin registros en base de datos</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {isStale && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
              ⚠ Desactualizado
            </span>
          )}
          {currentUf && !isStale && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              ✓ Al día
            </span>
          )}
          <span className="text-xs text-slate-400">{ufValues.length} registros en DB</span>
        </div>
      </div>

      {/* Acciones de sync */}
      {isAdmin ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button onClick={handleSyncHoy} disabled={syncing} size="sm">
              {syncing ? "Sincronizando..." : "Sincronizar hoy"}
            </Button>
            <button
              type="button"
              onClick={() => setShowBackfill((prev) => !prev)}
              className="text-sm text-brand-500 underline underline-offset-2 hover:text-brand-700"
            >
              {showBackfill ? "Cancelar" : "Backfill por rango"}
            </button>
          </div>

          {showBackfill && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-sm text-slate-600">
                Descarga valores UF históricos desde la CMF (máx. 365 días por request).
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label htmlFor="bf-desde" className="text-xs text-slate-500">Desde</Label>
                  <Input
                    id="bf-desde"
                    type="date"
                    value={backfillDesde}
                    onChange={(e) => setBackfillDesde(e.target.value)}
                    className="h-8 w-36 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bf-hasta" className="text-xs text-slate-500">Hasta</Label>
                  <Input
                    id="bf-hasta"
                    type="date"
                    value={backfillHasta}
                    onChange={(e) => setBackfillHasta(e.target.value)}
                    className="h-8 w-36 text-sm"
                  />
                </div>
                <Button onClick={handleBackfill} disabled={syncing} size="sm" variant="outline">
                  {syncing ? "Procesando..." : "Ejecutar backfill"}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Solo administradores pueden sincronizar el valor UF.</p>
      )}

      <p className="text-xs text-slate-400">
        Fuente: API oficial CMF Chile (api.cmfchile.cl) · Publicación diaria ~8:00 AM hora Santiago.
      </p>

      {/* Tabla de registros */}
      {ufValues.length > 0 && (
        <div className="overflow-hidden rounded-md border border-slate-200">
          {/* Barra de filtro */}
          <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-1.5">
              <div className="h-3.5 w-0.5 rounded-full bg-gold-400" />
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Registros almacenados
              </span>
            </div>
            <div className="ml-auto flex flex-wrap items-end gap-2">
              <div className="space-y-0.5">
                <Label htmlFor="tbl-desde" className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  Desde
                </Label>
                <Input
                  id="tbl-desde"
                  type="date"
                  value={filterDesde}
                  onChange={(e) => setFilterDesde(e.target.value)}
                  className="h-7 w-32 text-xs"
                />
              </div>
              <div className="space-y-0.5">
                <Label htmlFor="tbl-hasta" className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  Hasta
                </Label>
                <Input
                  id="tbl-hasta"
                  type="date"
                  value={filterHasta}
                  onChange={(e) => setFilterHasta(e.target.value)}
                  className="h-7 w-32 text-xs"
                />
              </div>
              {hasFilter && (
                <button
                  type="button"
                  onClick={() => { setFilterDesde(""); setFilterHasta(""); }}
                  className="h-7 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-500 hover:border-slate-300 hover:text-slate-700"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Tabla */}
          {filteredValues.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              Sin registros para el rango seleccionado.
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-700 text-[11px] font-semibold uppercase tracking-wider text-white">
                <tr>
                  <th className="px-4 py-2.5">Fecha</th>
                  <th className="px-4 py-2.5 text-right">Valor UF</th>
                  <th className="px-4 py-2.5 text-right">Variación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredValues.map((row, i) => {
                  const prev = filteredValues[i + 1];
                  return (
                    <tr key={row.fecha} className="group transition-colors hover:bg-brand-50">
                      <td className="px-4 py-2 tabular-nums text-slate-500">{row.fecha}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-800">
                        {formatUf(Number(row.valor))}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <TrendBadge current={row.valor} previous={prev?.valor} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2">
            <span className="text-xs text-slate-400">
              {hasFilter
                ? `${filteredValues.length} de ${ufValues.length} registros`
                : `${ufValues.length} registros · mostrando últimos 60 días`}
            </span>
            {filteredValues.length > 0 && (
              <span className="text-xs text-slate-400">
                {filteredValues[filteredValues.length - 1]?.fecha} → {filteredValues[0]?.fecha}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
