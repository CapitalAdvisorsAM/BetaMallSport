"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileText, ImageIcon, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP"
};

const ACCEPT_ATTR = Object.keys(ACCEPTED_TYPES).join(",");
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

type ContractAttachmentZoneProps = {
  onFile: (file: File) => void;
  disabled?: boolean;
  loading?: boolean;
};

function getFileIcon(mimeType: string | null): React.ReactNode {
  if (!mimeType) {
    return <UploadCloud className="h-8 w-8 text-slate-400" />;
  }
  if (mimeType === "application/pdf") {
    return <FileText className="h-8 w-8 text-brand-500" />;
  }
  return <ImageIcon className="h-8 w-8 text-brand-500" />;
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES[file.type]) {
    return "Formato no soportado. Adjunta un PDF o imagen (JPG, PNG, WEBP).";
  }
  if (file.size > MAX_BYTES) {
    return "El archivo supera el límite de 10 MB.";
  }
  return null;
}

export function ContractAttachmentZone({
  onFile,
  disabled = false,
  loading = false
}: ContractAttachmentZoneProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [lastFileName, setLastFileName] = useState<string | null>(null);
  const [lastMime, setLastMime] = useState<string | null>(null);
  const [justSucceeded, setJustSucceeded] = useState(false);

  function handleFile(file: File): void {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    setLastFileName(file.name);
    setLastMime(file.type);
    setJustSucceeded(false);
    onFile(file);
  }

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      handleFile(file);
    }
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setDragOver(false);
    if (disabled || loading) {
      return;
    }
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }

  function onDragOver(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    if (!disabled && !loading) {
      setDragOver(true);
    }
  }

  function onDragLeave(): void {
    setDragOver(false);
  }

  const labelType = lastMime ? (ACCEPTED_TYPES[lastMime] ?? null) : null;

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
        dragOver && !disabled
          ? "border-brand-500 bg-brand-50"
          : "border-slate-200 bg-slate-50 hover:border-slate-300",
        (disabled || loading) && "pointer-events-none opacity-60"
      )}
    >
      {/* Overlay de carga */}
      {loading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-white/80">
          <Spinner className="h-6 w-6" />
          <span className="text-sm font-medium text-slate-600">Analizando archivo…</span>
        </div>
      ) : null}

      {/* Icono y estado */}
      {justSucceeded ? (
        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
      ) : (
        getFileIcon(lastMime)
      )}

      {/* Texto principal */}
      <div className="space-y-0.5">
        {lastFileName ? (
          <>
            <p className="text-sm font-medium text-slate-700">{lastFileName}</p>
            {labelType ? (
              <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-brand-700">
                {labelType}
              </span>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-700">
              Arrastra un PDF o screenshot aquí
            </p>
            <p className="text-xs text-slate-400">PDF · JPG · PNG · WEBP · máx 10 MB</p>
          </>
        )}
      </div>

      {/* Botón secundario */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || loading}
        onClick={() => inputRef.current?.click()}
        className="mt-1 rounded-full text-xs"
      >
        {lastFileName ? "Cambiar archivo" : "Seleccionar archivo"}
      </Button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  );
}
