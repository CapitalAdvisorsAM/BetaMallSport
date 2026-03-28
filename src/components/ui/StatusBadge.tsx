import type { EstadoContrato } from "@prisma/client";
import { cn } from "@/lib/utils";

const statusColor: Record<EstadoContrato, string> = {
  VIGENTE: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  GRACIA: "border border-amber-200 bg-amber-50 text-amber-700",
  TERMINADO: "border border-slate-200 bg-slate-100 text-slate-500",
  TERMINADO_ANTICIPADO: "border border-rose-200 bg-rose-50 text-rose-700"
};

type StatusBadgeProps = {
  status: EstadoContrato;
};

export function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        statusColor[status]
      )}
    >
      {status}
    </span>
  );
}
