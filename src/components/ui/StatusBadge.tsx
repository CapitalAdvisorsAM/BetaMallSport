import type { ContractStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<ContractStatus, { label: string; className: string }> = {
  VIGENTE: {
    label: "Vigente",
    className: "border border-emerald-200 bg-emerald-50 text-emerald-700"
  },
  GRACIA: {
    label: "En Gracia",
    className: "border border-amber-200 bg-amber-50 text-amber-700"
  },
  TERMINADO: {
    label: "Terminado",
    className: "border border-slate-200 bg-slate-100 text-slate-500"
  },
  TERMINADO_ANTICIPADO: {
    label: "Term. Anticipado",
    className: "border border-rose-200 bg-rose-50 text-rose-700"
  }
};

type StatusBadgeProps = {
  status: ContractStatus;
};

export function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
  const cfg = statusConfig[status];
  return (
    <Badge
      variant="outline"
      className={cn("rounded px-2 py-0.5 text-xs font-semibold", cfg.className)}
    >
      {cfg.label}
    </Badge>
  );
}
