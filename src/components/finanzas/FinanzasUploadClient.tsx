"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { ProjectSelector } from "@/components/ui/ProjectSelector";

type Project = { id: string; nombre: string; slug: string };
type HistorialItem = {
  id: string;
  archivoNombre: string;
  registrosCargados: number;
  estado: string;
  createdAt: Date;
};

type SinMapeoContable = { localCodigo: string; arrendatarioNombre: string; sugerencias: { codigo: string; nombre: string; score: number }[] };
type SinMapeoVentas = { idCa: number; tienda: string; sugerencias: { codigo: string; nombre: string; score: number }[] };

type ResultadoContable = {
  periodos: string[];
  totalFilas: number;
  registrosInsertados: number;
  matchesAutomaticos: number;
  sinMapeo: SinMapeoContable[];
};

type ResultadoVentas = {
  periodos: string[];
  totalFilas: number;
  registrosUpserted: number;
  matchesAutomaticos: number;
  sinMapeo: SinMapeoVentas[];
};

function UploadSection({
  titulo,
  descripcion,
  instruccion,
  endpoint,
  proyectoId,
  historial,
  tipo
}: {
  titulo: string;
  descripcion: string;
  instruccion: string;
  endpoint: string;
  proyectoId: string;
  historial: HistorialItem[];
  tipo: "contable" | "ventas";
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [resultContable, setResultContable] = useState<ResultadoContable | null>(null);
  const [resultVentas, setResultVentas] = useState<ResultadoVentas | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file || !proyectoId) return;
    setLoading(true);
    setResultContable(null);
    setResultVentas(null);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("proyectoId", proyectoId);
      const res = await fetch(endpoint, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Error al procesar el archivo.");
      if (tipo === "contable") setResultContable(data as ResultadoContable);
      else setResultVentas(data as ResultadoVentas);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido.");
    } finally {
      setLoading(false);
    }
  }

  const resultado = tipo === "contable" ? resultContable : resultVentas;
  const sinMapeoCount = tipo === "contable"
    ? (resultContable?.sinMapeo.length ?? 0)
    : (resultVentas?.sinMapeo.length ?? 0);

  return (
    <div className="rounded-md bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">{titulo}</h3>
      <p className="mt-0.5 text-xs text-slate-500">{descripcion}</p>

      <div className="mt-4 rounded-md border-2 border-dashed border-slate-200 p-6 text-center">
        <p className="mb-2 text-xs text-slate-500">{instruccion}</p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="mx-auto block text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-700"
        />
      </div>

      <button
        onClick={handleUpload}
        disabled={loading || !proyectoId}
        className="mt-3 w-full rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Procesando..." : "Subir y Procesar"}
      </button>

      {resultado && (
        <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs">
          <p className="font-semibold text-slate-700">
            ✓ Procesado — Periodos: {
              tipo === "contable"
                ? (resultContable?.periodos.join(", ") ?? "—")
                : (resultVentas?.periodos.join(", ") ?? "—")
            }
          </p>
          <ul className="mt-1.5 space-y-0.5 text-slate-600">
            <li>Filas leídas: <strong>{tipo === "contable" ? resultContable?.totalFilas : resultVentas?.totalFilas}</strong></li>
            <li>{tipo === "contable" ? "Registros insertados" : "Registros actualizados"}: <strong>{tipo === "contable" ? resultContable?.registrosInsertados : resultVentas?.registrosUpserted}</strong></li>
            <li>Matches automáticos nuevos: <strong>{tipo === "contable" ? resultContable?.matchesAutomaticos : resultVentas?.matchesAutomaticos}</strong></li>
          </ul>
          {sinMapeoCount > 0 && (
            <div className="mt-2">
              <p className="font-semibold text-amber-600">
                ⚠ {sinMapeoCount} {tipo === "contable" ? "local(es)" : "tienda(s)"} sin mapeo →{" "}
                <a
                  href={`/finanzas/mapeos?proyecto=${proyectoId}&tab=${tipo}`}
                  className="underline"
                >
                  Ir a Mapeos
                </a>
              </p>
              <ul className="mt-1 space-y-0.5 text-slate-400">
                {tipo === "contable"
                  ? resultContable?.sinMapeo.map((s) => (
                      <li key={s.localCodigo}>
                        <span className="font-mono">[L{s.localCodigo}]</span>
                        {s.arrendatarioNombre && <span className="ml-1">{s.arrendatarioNombre}</span>}
                        {s.sugerencias[0] && (
                          <span className="ml-2 text-slate-300">
                            sugerencia: {s.sugerencias[0].codigo} ({Math.round(s.sugerencias[0].score * 100)}%)
                          </span>
                        )}
                      </li>
                    ))
                  : resultVentas?.sinMapeo.map((s) => (
                      <li key={s.idCa}>
                        <span className="font-mono">ID CA {s.idCa}</span>
                        {s.tienda && <span className="ml-1">{s.tienda}</span>}
                        {s.sugerencias[0] && (
                          <span className="ml-2 text-slate-300">
                            sugerencia: {s.sugerencias[0].nombre} ({Math.round(s.sugerencias[0].score * 100)}%)
                          </span>
                        )}
                      </li>
                    ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md bg-red-50 p-3 text-xs text-red-700">{error}</div>
      )}

      {historial.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Historial reciente</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400">
                <th className="pb-1 text-left font-medium">Archivo</th>
                <th className="pb-1 text-right font-medium">Registros</th>
                <th className="pb-1 text-right font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {historial.map((h) => (
                <tr key={h.id}>
                  <td className="py-1 text-slate-600 truncate max-w-[200px]">{h.archivoNombre}</td>
                  <td className="py-1 text-right text-slate-500">{h.registrosCargados}</td>
                  <td className="py-1 text-right text-slate-400">{formatDate(h.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function FinanzasUploadClient({
  projects,
  selectedProjectId,
  historialContable,
  historialVentas
}: {
  projects: Project[];
  selectedProjectId: string;
  historialContable: HistorialItem[];
  historialVentas: HistorialItem[];
}): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Cargar Datos</h2>
          <p className="text-sm text-slate-500">
            Sube el archivo CDG (.xlsx) — contiene las hojas &quot;Data Contable&quot; y &quot;Data Ventas&quot;.
          </p>
        </div>
        <ProjectSelector projects={projects} selectedProjectId={selectedProjectId} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <UploadSection
          titulo="Datos Contables"
          descripcion="Lee la hoja 'Data Contable' del archivo CDG. Filtra Ce.coste = 'Real'."
          instruccion="CDG Mall Sport .xlsx → hoja 'Data Contable'"
          endpoint="/api/finanzas/upload/contable"
          proyectoId={selectedProjectId}
          historial={historialContable}
          tipo="contable"
        />

        <UploadSection
          titulo="Datos de Ventas"
          descripcion="Lee la hoja 'Data Ventas' del archivo CDG. Agrega ventas diarias por local y mes."
          instruccion="CDG Mall Sport .xlsx → hoja 'Data Ventas'"
          endpoint="/api/finanzas/upload/ventas"
          proyectoId={selectedProjectId}
          historial={historialVentas}
          tipo="ventas"
        />
      </div>
    </div>
  );
}
