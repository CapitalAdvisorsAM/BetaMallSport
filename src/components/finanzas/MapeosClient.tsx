"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectSelector } from "@/components/ui/ProjectSelector";

type Project = { id: string; nombre: string; slug: string };
type Local = { id: string; codigo: string; nombre: string };
type MapeoContable = { id: string; localExterno: string; localId: string; local: { codigo: string; nombre: string } };
type MapeoVentas = { id: string; idCa: number; tiendaNombre: string; localId: string; local: { codigo: string; nombre: string } };

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={active
        ? "rounded-md bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white"
        : "rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"}
    >
      {children}
    </button>
  );
}

export function MapeosClient({
  projects,
  selectedProjectId,
  mapeosContable,
  mapeosVentas,
  locales,
  defaultTab
}: {
  projects: Project[];
  selectedProjectId: string;
  mapeosContable: MapeoContable[];
  mapeosVentas: MapeoVentas[];
  locales: Local[];
  defaultTab: "contable" | "ventas";
}): JSX.Element {
  const router = useRouter();
  const [tab, setTab] = useState<"contable" | "ventas">(defaultTab);

  // Contable form state
  const [externo, setExterno] = useState("");
  const [localIdC, setLocalIdC] = useState("");
  const [savingC, setSavingC] = useState(false);
  const [errorC, setErrorC] = useState<string | null>(null);

  // Ventas form state
  const [idCa, setIdCa] = useState("");
  const [tiendaNombre, setTiendaNombre] = useState("");
  const [localIdV, setLocalIdV] = useState("");
  const [savingV, setSavingV] = useState(false);
  const [errorV, setErrorV] = useState<string | null>(null);

  async function saveContable() {
    if (!externo.trim() || !localIdC) return;
    setSavingC(true); setErrorC(null);
    try {
      const res = await fetch("/api/finanzas/mapeos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proyectoId: selectedProjectId, localExterno: externo.trim().toUpperCase(), localId: localIdC })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      setExterno(""); setLocalIdC("");
      router.refresh();
    } catch (e) { setErrorC(e instanceof Error ? e.message : "Error"); }
    finally { setSavingC(false); }
  }

  async function saveVentas() {
    const idCaNum = parseInt(idCa, 10);
    if (isNaN(idCaNum) || !tiendaNombre.trim() || !localIdV) return;
    setSavingV(true); setErrorV(null);
    try {
      const res = await fetch("/api/finanzas/mapeos-ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proyectoId: selectedProjectId, idCa: idCaNum, tiendaNombre: tiendaNombre.trim(), localId: localIdV })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      setIdCa(""); setTiendaNombre(""); setLocalIdV("");
      router.refresh();
    } catch (e) { setErrorV(e instanceof Error ? e.message : "Error"); }
    finally { setSavingV(false); }
  }

  async function deleteMapeo(id: string, tipo: "contable" | "ventas") {
    const endpoint = tipo === "contable" ? `/api/finanzas/mapeos?id=${id}` : `/api/finanzas/mapeos-ventas?id=${id}`;
    await fetch(endpoint, { method: "DELETE" });
    router.refresh();
  }

  async function updateLocalContable(mapeo: MapeoContable, newLocalId: string) {
    await fetch("/api/finanzas/mapeos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proyectoId: selectedProjectId, localExterno: mapeo.localExterno, localId: newLocalId })
    });
    router.refresh();
  }

  async function updateLocalVentas(mapeo: MapeoVentas, newLocalId: string) {
    await fetch("/api/finanzas/mapeos-ventas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proyectoId: selectedProjectId, idCa: mapeo.idCa, tiendaNombre: mapeo.tiendaNombre, localId: newLocalId })
    });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Mapeos de Locales</h2>
          <p className="text-sm text-slate-500">Vincula los identificadores externos con los locales del Rent Roll.</p>
        </div>
        <ProjectSelector projects={projects} selectedProjectId={selectedProjectId} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <TabButton active={tab === "contable"} onClick={() => setTab("contable")}>
          Contabilidad ({mapeosContable.length})
        </TabButton>
        <TabButton active={tab === "ventas"} onClick={() => setTab("ventas")}>
          Ventas ({mapeosVentas.length})
        </TabButton>
      </div>

      {/* Tab: Contable */}
      {tab === "contable" && (
        <div className="space-y-4">
          <div className="rounded-md bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Agregar mapeo contable manual</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Código local contabilidad (ej: 102)</label>
                <input value={externo} onChange={(e) => setExterno(e.target.value)} placeholder="102"
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Local Rent Roll</label>
                <select value={localIdC} onChange={(e) => setLocalIdC(e.target.value)}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500">
                  <option value="">Seleccionar...</option>
                  {locales.map((l) => <option key={l.id} value={l.id}>{l.codigo} — {l.nombre}</option>)}
                </select>
              </div>
              <button onClick={saveContable} disabled={savingC || !externo.trim() || !localIdC}
                className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50">
                {savingC ? "Guardando..." : "Guardar"}
              </button>
            </div>
            {errorC && <p className="mt-2 text-xs text-red-600">{errorC}</p>}
          </div>

          <div className="rounded-md bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-700">Mapeos contables ({mapeosContable.length})</p>
            </div>
            {mapeosContable.length === 0
              ? <div className="flex h-20 items-center justify-center text-sm text-slate-400">Sin mapeos. Sube un archivo o agrega uno manualmente.</div>
              : <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-2.5 text-left">Código externo</th>
                      <th className="px-4 py-2.5 text-left">Local Rent Roll</th>
                      <th className="px-4 py-2.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {mapeosContable.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{m.localExterno}</td>
                        <td className="px-4 py-2.5">
                          <select defaultValue={m.localId} onChange={(e) => updateLocalContable(m, e.target.value)}
                            className="rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500">
                            {locales.map((l) => <option key={l.id} value={l.id}>{l.codigo} — {l.nombre}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={() => deleteMapeo(m.id, "contable")} className="text-xs text-red-400 hover:text-red-600">Eliminar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
        </div>
      )}

      {/* Tab: Ventas */}
      {tab === "ventas" && (
        <div className="space-y-4">
          <div className="rounded-md bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Agregar mapeo de ventas manual</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">ID CA (número)</label>
                <input value={idCa} onChange={(e) => setIdCa(e.target.value)} placeholder="217" type="number"
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Nombre tienda (en el archivo)</label>
                <input value={tiendaNombre} onChange={(e) => setTiendaNombre(e.target.value)} placeholder="Mountain Hardwear"
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Local Rent Roll</label>
                <select value={localIdV} onChange={(e) => setLocalIdV(e.target.value)}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500">
                  <option value="">Seleccionar...</option>
                  {locales.map((l) => <option key={l.id} value={l.id}>{l.codigo} — {l.nombre}</option>)}
                </select>
              </div>
              <button onClick={saveVentas} disabled={savingV || !idCa || !tiendaNombre.trim() || !localIdV}
                className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50">
                {savingV ? "Guardando..." : "Guardar"}
              </button>
            </div>
            {errorV && <p className="mt-2 text-xs text-red-600">{errorV}</p>}
          </div>

          <div className="rounded-md bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-700">Mapeos de ventas ({mapeosVentas.length})</p>
            </div>
            {mapeosVentas.length === 0
              ? <div className="flex h-20 items-center justify-center text-sm text-slate-400">Sin mapeos. Sube un archivo de ventas o agrega uno manualmente.</div>
              : <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-2.5 text-left">ID CA</th>
                      <th className="px-4 py-2.5 text-left">Tienda (archivo)</th>
                      <th className="px-4 py-2.5 text-left">Local Rent Roll</th>
                      <th className="px-4 py-2.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {mapeosVentas.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{m.idCa}</td>
                        <td className="px-4 py-2.5 text-slate-600">{m.tiendaNombre}</td>
                        <td className="px-4 py-2.5">
                          <select defaultValue={m.localId} onChange={(e) => updateLocalVentas(m, e.target.value)}
                            className="rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500">
                            {locales.map((l) => <option key={l.id} value={l.id}>{l.codigo} — {l.nombre}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={() => deleteMapeo(m.id, "ventas")} className="text-xs text-red-400 hover:text-red-600">Eliminar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
        </div>
      )}
    </div>
  );
}
