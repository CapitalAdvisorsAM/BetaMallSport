import type { EstadoContrato } from "@prisma/client";
import { cn } from "@/lib/utils";

const statusColor: Record<EstadoContrato, string> = {
  VIGENTE: "bg-emerald-100 text-emerald-800",
  GRACIA: "bg-amber-100 text-amber-900",
  TERMINADO: "bg-rose-100 text-rose-800",
  TERMINADO_ANTICIPADO: "bg-rose-200 text-rose-900"
};

type StatusBadgeProps = {
  status: EstadoContrato;
};

export function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide",
        statusColor[status]
      )}
    >
      {status}
    </span>
  );
}
