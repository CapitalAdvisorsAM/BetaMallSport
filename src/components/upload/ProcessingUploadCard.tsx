"use client";

import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { useRouter } from "next/navigation";
import type {
  BalanceUploadResult,
  BankUploadResult,
  ContableUploadResult,
  ExpenseBudgetUploadResult,
  VentasUploadResult
} from "@/types/finance";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { Button } from "@/components/ui/button";
import { cn, formatUf } from "@/lib/utils";

type UploadVariant = "contable" | "ventas" | "expense-budget" | "balances" | "bank";

type ProcessingUploadCardProps = {
  title: string;
  description: string;
  instruction: string;
  endpoint: string;
  projectId: string;
  variant: UploadVariant;
  templateHref?: string;
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

function isExpenseBudgetResult(value: unknown): value is ExpenseBudgetUploadResult {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ExpenseBudgetUploadResult).recordsInserted === "number" &&
    Array.isArray((value as ExpenseBudgetUploadResult).unrecognized)
  );
}

function isBalanceResult(value: unknown): value is BalanceUploadResult {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as BalanceUploadResult).recordsInserted === "number" &&
    Array.isArray((value as BalanceUploadResult).unrecognized)
  );
}

function isBankResult(value: unknown): value is BankUploadResult {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as BankUploadResult).recordsInserted === "number" &&
    Array.isArray((value as BankUploadResult).unrecognized)
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ProcessingUploadCard({
  title,
  description,
  instruction,
  endpoint,
  projectId,
  variant,
  templateHref
}: ProcessingUploadCardProps): JSX.Element {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState(false);
  const [result, setResult] = useState<
    ContableUploadResult | VentasUploadResult | ExpenseBudgetUploadResult | BalanceUploadResult | BankUploadResult | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [manualEditsWarning, setManualEditsWarning] = useState<{
    editedCount: number;
    periods: string[];
  } | null>(null);

  function selectFile(f: File | null): void {
    setFile(f);
    setError(null);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>): void {
    event.preventDefault();
    setDragOver(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) selectFile(dropped);
  }

  async function handleUpload(forceOverwrite = false): Promise<void> {
    if (!file || !projectId) return;

    setLoading(true);
    setResult(null);
    setError(null);
    if (!forceOverwrite) setManualEditsWarning(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);
      if (forceOverwrite) formData.append("forceOverwrite", "true");

      const response = await fetch(endpoint, { method: "POST", body: formData });
      const payload = (await response.json()) as unknown;

      // Handle 409 warning for manual edits (contable only)
      if (
        response.status === 409 &&
        variant === "contable" &&
        typeof payload === "object" &&
        payload !== null &&
        "warning" in payload &&
        (payload as { warning: boolean }).warning === true
      ) {
        const w = payload as unknown as { editedCount: number; periods: string[] };
        setManualEditsWarning({ editedCount: w.editedCount, periods: w.periods });
        return;
      }

      const validPayload =
        variant === "contable"
          ? isContableResult(payload)
          : variant === "ventas"
            ? isVentasResult(payload)
            : variant === "expense-budget"
              ? isExpenseBudgetResult(payload)
              : variant === "balances"
                ? isBalanceResult(payload)
                : isBankResult(payload);

      if (!response.ok || !validPayload) {
        throw new Error(
          typeof payload === "object" && payload !== null && "message" in payload
            ? String(payload.message)
            : "Error al procesar el archivo."
        );
      }

      setResult(payload as ContableUploadResult | VentasUploadResult | ExpenseBudgetUploadResult | BalanceUploadResult | BankUploadResult);
      setManualEditsWarning(null);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 500);
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Error desconocido.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset(): void {
    setFile(null);
    setResult(null);
    setError(null);
    setManualEditsWarning(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const resultSummary =
    variant === "contable" && result && isContableResult(result)
      ? [
          { label: "Filas leídas", value: result.totalFilas },
          { label: "Registros insertados", value: result.registrosInsertados },
          { label: "Matches automáticos", value: result.matchesAutomaticos }
        ]
      : variant === "ventas" && result && isVentasResult(result)
        ? [
            { label: "Filas leídas", value: result.totalFilas },
            { label: "Registros procesados", value: result.registrosUpserted },
            { label: "Matches automáticos", value: result.matchesAutomaticos }
          ]
        : variant === "expense-budget" && result && isExpenseBudgetResult(result)
          ? [
              { label: "Filas procesables", value: result.summary.total },
              { label: "Registros insertados", value: result.recordsInserted },
              { label: "Filas no reconocidas", value: result.unrecognized.length }
            ]
          : variant === "balances" && result && isBalanceResult(result)
            ? [
                { label: "Filas procesables", value: result.summary.total },
                { label: "Registros insertados", value: result.recordsInserted },
                { label: "Filas no reconocidas", value: result.unrecognized.length }
              ]
            : variant === "bank" && result && isBankResult(result)
              ? [
                  { label: "Filas procesables", value: result.summary.total },
                  { label: "Registros insertados", value: result.recordsInserted },
                  { label: "Filas no reconocidas", value: result.unrecognized.length }
                ]
          : [];

  const unmappedItems =
    variant === "contable" && result && isContableResult(result) ? result.sinMapeo : [];
  const unmappedSales =
    variant === "ventas" && result && isVentasResult(result) ? result.sinMapeo : [];
  const unrecognizedBudget =
    variant === "expense-budget" && result && isExpenseBudgetResult(result)
      ? result.unrecognized
      : [];
  const unrecognizedBalances =
    variant === "balances" && result && isBalanceResult(result)
      ? result.unrecognized
      : [];
  const unrecognizedBank =
    variant === "bank" && result && isBankResult(result)
      ? result.unrecognized
      : [];
  const displayPeriodos = result
    ? isExpenseBudgetResult(result) || isBalanceResult(result) || isBankResult(result)
      ? result.summary.periodos
      : result.periodos
    : [];

  const warningsTotal =
    unmappedItems.length +
    unmappedSales.length +
    unrecognizedBudget.length +
    unrecognizedBalances.length +
    unrecognizedBank.length;

  return (
    <ModuleSectionCard title={title} description={description}>
      <div className={cn("space-y-4 p-4 transition-colors", flash && "animate-success-flash")}>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center transition-colors",
            dragOver
              ? "border-brand-500 bg-brand-50/60"
              : "border-surface-200 hover:border-brand-300 hover:bg-surface-50/60"
          )}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
            className="sr-only"
          />
          {file ? (
            <div className="flex items-center gap-3 rounded-sm border border-surface-200 bg-white px-3 py-2">
              <span className="font-serif text-sm text-brand-700" style={{ fontVariationSettings: '"opsz" 18, "wght" 500' }}>
                {file.name}
              </span>
              <span className="font-mono text-[11px] text-slate-500 num">
                {formatBytes(file.size)}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleReset();
                }}
                className="text-[11px] text-slate-500 hover:text-negative-700"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <p className="font-serif text-sm text-brand-700" style={{ fontVariationSettings: '"opsz" 18, "wght" 500' }}>
                Arrastra un archivo aquí
              </p>
              <p className="text-caption text-slate-500">o haz clic para seleccionar (.xlsx, .xls)</p>
            </>
          )}
          <p className="mt-1 text-[11px] text-slate-400">{instruction}</p>
          {templateHref ? (
            <a
              href={templateHref}
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] text-brand-700 underline underline-offset-2 hover:text-brand-500"
            >
              Descargar plantilla
            </a>
          ) : null}
        </label>

        <div className="space-y-2">
          <Button
            type="button"
            onClick={() => void handleUpload()}
            disabled={loading || !projectId || !file}
            className="w-full"
          >
            {loading ? "Procesando..." : "Subir y procesar"}
          </Button>
          {loading ? (
            <div className="h-1 w-full overflow-hidden rounded-full bg-surface-200">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-brand-500" />
            </div>
          ) : null}
        </div>

        {result ? (
          <div className="rounded-md border border-surface-200 bg-surface-50/60 p-3">
            <div className="flex items-center justify-between">
              <span className="overline text-positive-700">✓ Procesado</span>
              <span className="font-mono text-[11px] text-slate-500 num">
                {displayPeriodos.join(", ") || "—"}
              </span>
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
              {resultSummary.map((item) => (
                <div key={item.label} className="rounded-sm border border-surface-200 bg-white p-2">
                  <dt className="overline text-slate-400">{item.label}</dt>
                  <dd
                    className="mt-0.5 font-serif text-base text-brand-700 num"
                    style={{ fontVariationSettings: '"opsz" 20, "wght" 500' }}
                  >
                    {formatUf(item.value, 0)}
                  </dd>
                </div>
              ))}
            </dl>

            {warningsTotal > 0 ? (
              <details className="group mt-3 rounded-sm border border-warning-600/30 bg-warning-100/40 p-2 text-xs">
                <summary className="flex cursor-pointer items-center justify-between text-warning-700">
                  <span className="font-semibold">⚠ {warningsTotal} advertencia(s)</span>
                  <span className="text-[11px] text-slate-500 transition-transform group-open:rotate-180">▾</span>
                </summary>
                <div className="mt-2 space-y-2 text-slate-600">
                  {unmappedItems.length > 0 ? (
                    <div>
                      <p className="font-semibold text-warning-700">
                        {unmappedItems.length} local(es) sin mapeo.{" "}
                        <a href="/settings/finance-mappings?tab=accounting" className="underline">Ir a Mapeos</a>
                      </p>
                      <ul className="mt-1 space-y-0.5 text-slate-500">
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
                    <div>
                      <p className="font-semibold text-warning-700">
                        {unmappedSales.length} tienda(s) sin mapeo.{" "}
                        <a href="/settings/finance-mappings?tab=sales" className="underline">Ir a Mapeos</a>
                      </p>
                      <ul className="mt-1 space-y-0.5 text-slate-500">
                        {unmappedSales.map((item) => (
                          <li key={item.idCa}>
                            <span className="font-mono">ID CA {item.idCa}</span>
                            {item.tienda ? <span className="ml-1">{item.tienda}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {unrecognizedBudget.length > 0 ? (
                    <div>
                      <p className="font-semibold text-warning-700">
                        {unrecognizedBudget.length} fila(s) no reconocidas.
                      </p>
                      <ul className="mt-1 space-y-0.5 text-slate-500">
                        {unrecognizedBudget.slice(0, 10).map((item) => (
                          <li key={`${item.rowNumber}-${item.grupo1}-${item.grupo3}`}>
                            <span className="font-mono">Fila {item.rowNumber}</span>
                            <span className="ml-1">{item.reason}</span>
                          </li>
                        ))}
                        {unrecognizedBudget.length > 10 ? (
                          <li className="text-slate-400">...y {unrecognizedBudget.length - 10} más.</li>
                        ) : null}
                      </ul>
                    </div>
                  ) : null}
                  {unrecognizedBalances.length > 0 ? (
                    <div>
                      <p className="font-semibold text-warning-700">
                        {unrecognizedBalances.length} fila(s) de balances no reconocidas.
                      </p>
                      <ul className="mt-1 space-y-0.5 text-slate-500">
                        {unrecognizedBalances.slice(0, 10).map((item) => (
                          <li key={`${item.rowNumber}-${item.accountCode}`}>
                            <span className="font-mono">Fila {item.rowNumber}</span>
                            <span className="ml-1">{item.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {unrecognizedBank.length > 0 ? (
                    <div>
                      <p className="font-semibold text-warning-700">
                        {unrecognizedBank.length} fila(s) de banco no reconocidas.
                      </p>
                      <ul className="mt-1 space-y-0.5 text-slate-500">
                        {unrecognizedBank.slice(0, 10).map((item) => (
                          <li key={`${item.rowNumber}-${item.operationNumber}`}>
                            <span className="font-mono">Fila {item.rowNumber}</span>
                            <span className="ml-1">{item.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </details>
            ) : null}
          </div>
        ) : null}

        {manualEditsWarning ? (
          <div className="rounded-md border border-amber-400/50 bg-amber-50 p-3 text-xs">
            <p className="font-semibold text-amber-800">
              ⚠ Este período tiene {manualEditsWarning.editedCount} corrección
              {manualEditsWarning.editedCount !== 1 ? "es" : ""} manual
              {manualEditsWarning.editedCount !== 1 ? "es" : ""} en la tabla de datos.
            </p>
            <p className="mt-1 text-amber-700">
              Períodos afectados: {manualEditsWarning.periods.join(", ")}
            </p>
            <p className="mt-1 text-amber-600">
              Si continúas, las correcciones manuales se perderán y se reemplazarán con los
              datos del archivo.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void handleUpload(true)}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
              >
                Sobrescribir de todas formas
              </button>
              <button
                type="button"
                onClick={() => setManualEditsWarning(null)}
                className="rounded-md border border-amber-300 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-negative-600/30 bg-negative-100 p-3 text-xs text-negative-700">
            {error}
          </div>
        ) : null}
      </div>
    </ModuleSectionCard>
  );
}
