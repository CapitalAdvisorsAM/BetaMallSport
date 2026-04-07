"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RecordDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  recordData: Record<string, any> | null;
  title?: string;
};

export function RecordDetailModal({
  isOpen,
  onClose,
  recordData,
  title = "Detalles del Registro",
}: RecordDetailModalProps) {
  if (!recordData) return null;

  const entries = Object.entries(recordData).filter(
    ([key, value]) => {
      if (key.startsWith("_")) return false;
      if (value === null || value === undefined) return true;
      if (typeof value === "object" && !Array.isArray(value)) return false;
      return true;
    }
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-white border-slate-200 shadow-lg">
        <DialogHeader className="border-b border-slate-100 pb-4">
          <DialogTitle className="text-brand-700 font-bold text-lg uppercase tracking-wide">
            {title}
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Información detallada del registro seleccionado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-6 px-1">
          <div className="grid grid-cols-1 gap-0 divide-y divide-slate-100">
            {entries.map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between gap-4 py-3 px-2 hover:bg-slate-50 transition-colors"
              >
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </span>
                <span className="text-sm text-slate-900 text-right font-medium">
                  {Array.isArray(value)
                    ? JSON.stringify(value)
                    : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
          <Button variant="outline" onClick={onClose} className="rounded-md">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
