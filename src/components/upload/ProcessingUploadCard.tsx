"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ContableUploadResult, VentasUploadResult } from "@/types/finance";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type UploadVariant = "contable" | "ventas";

type ProcessingUploadCardProps = {
  title: string;
  description: string;
  instruction: string;
  endpoint: string;
  projectId: string;
  variant: UploadVariant;
};

function isContableResult(value: unknown): value is ContableUploadResult {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as ContableUploadResult).periodos) &&
    typeof (value as ContableUploadResult).registrosInsertados === "number"
  );
}

function isVentasResult(value: unknown): value is VentasUploadResult {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as VentasUploadResult).periodos) &&
    typeof (value as VentasUploadResult).registrosUpserted === "number"
  );
}

export function ProcessingUploadCard({
  title,
  description,
  instruction,
  endpoint,
  projectId,
  variant
}: ProcessingUploadCardProps): JSX.Element {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContableUploadResult | VentasUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(): Promise<void> {
    const file = fileRef.current?.files?.[0];
    if (!file || !projectId) {
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);

      const response = await fetch(endpoint, { method: "POST", body: formData });
      const payload = (await response.json()) as unknown;
      const validPayload =
        variant === "contable" ? isContableResult(payload) : isVentasResult(payload);

      if (!response.ok || !validPayload) {
        throw new Error(
          typeof payload === "object" && payload !== null && "message" in payload
            ? String(payload.message)
            : "Error al procesar el archivo."
        );
      }

      setResult(payload as ContableUploadResult | VentasUploadResult);
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Error desconocido.");
    } finally {
      setLoading(false);
    }
  }

  const resultSummary =
    variant === "contable" && result && isContableResult(result)
      ? [
          { label: "Filas leidas", value: result.totalFilas },
          { label: "Registros insertados", value: result.registrosInsertados },
          { label: "Matches automaticos", value: result.matchesAutomaticos }
        ]
      : variant === "ventas" && result && isVentasResult(result)
        ? [
            { label: "Filas leidas", value: result.totalFilas },
            { label: "Registros procesados", value: result.registrosUpserted },
            { label: "Matches automaticos", value: result.matchesAutomaticos }
          ]
        : [];

  const unmappedItems =
    variant === "contable" && result && isContableResult(result) ? result.sinMapeo : [];
  const unmappedSales =
    variant === "ventas" && result && isVentasResult(result) ? result.sinMapeo : [];

  return (
    <ModuleSectionCard title={title} description={description}>
      <div className="space-y-4 p-4">
        <div className="rounded-md border-2 border-dashed border-slate-200 p-6 text-center">
          <p className="mb-2 text-xs text-slate-500">{instruction}</p>
          <Input ref={fileRef} type="file" accept=".xlsx,.xls" className="mx-auto max-w-sm" />
        </div>

        <Button
          type="button"
          onClick={() => void handleUpload()}
          disabled={loading || !projectId}
          className="w-full"
        >
          {loading ? "Procesando..." : "Subir y procesar"}
        </Button>

        {result ? (
          <div className="rounded-md bg-slate-50 p-3 text-xs">
            <p className="font-semibold text-slate-700">
              Procesado. Periodos: {result.periodos.join(", ") || "-"}
            </p>
            <ul className="mt-1.5 space-y-0.5 text-slate-600">
              {resultSummary.map((item) => (
                <li key={item.label}>
                  {item.label}: <strong>{item.value}</strong>
                </li>
              ))}
            </ul>

            {unmappedItems.length > 0 ? (
              <div className="mt-2">
                <p className="font-semibold text-amber-600">
                  {unmappedItems.length} local(es) sin mapeo.{" "}
                  <a href={`/finance/mappings?project=${projectId}&tab=accounting`} className="underline">
                    Ir a Mapeos
                  </a>
                </p>
                <ul className="mt-1 space-y-0.5 text-slate-400">
                  {unmappedItems.map((item) => (
                    <li key={item.localCodigo}>
                      <span className="font-mono">[L{item.localCodigo}]</span>
                      {item.arrendatarioNombre ? <span className="ml-1">{item.arrendatarioNombre}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {unmappedSales.length > 0 ? (
              <div className="mt-2">
                <p className="font-semibold text-amber-600">
                  {unmappedSales.length} tienda(s) sin mapeo.{" "}
                  <a href={`/finance/mappings?project=${projectId}&tab=sales`} className="underline">
                    Ir a Mapeos
                  </a>
                </p>
                <ul className="mt-1 space-y-0.5 text-slate-400">
                  {unmappedSales.map((item) => (
                    <li key={item.idCa}>
                      <span className="font-mono">ID CA {item.idCa}</span>
                      {item.tienda ? <span className="ml-1">{item.tienda}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">{error}</div> : null}
      </div>
    </ModuleSectionCard>
  );
}



