import type { ReactNode } from "react";
import { getTableTheme, type TableDensity } from "@/components/ui/table-theme";
import { cn } from "@/lib/utils";

type UnifiedTableProps = {
  children?: ReactNode;
  density?: TableDensity;
  toolbar?: ReactNode;
  footer?: ReactNode;
  loading?: boolean;
  loadingMessage?: string;
  empty?: boolean;
  emptyContent?: ReactNode;
  emptyMessage?: string;
  className?: string;
  contentClassName?: string;
};

export function UnifiedTable({
  children,
  density = "default",
  toolbar,
  footer,
  loading = false,
  loadingMessage = "Cargando...",
  empty = false,
  emptyContent,
  emptyMessage = "No hay filas para mostrar.",
  className,
  contentClassName
}: UnifiedTableProps): JSX.Element {
  const theme = getTableTheme(density);

  return (
    <div className={cn(theme.surface, className)}>
      {toolbar ? <div className="border-b border-slate-200 px-4 py-3">{toolbar}</div> : null}
      <div className={cn(theme.scroll, contentClassName)}>
        {loading ? (
          <div className="px-4 py-6 text-sm text-slate-500">{loadingMessage}</div>
        ) : empty ? (
          emptyContent ?? <div className="px-4 py-6 text-center text-sm text-slate-500">{emptyMessage}</div>
        ) : (
          children
        )}
      </div>
      {footer ? <div className="border-t border-slate-200 px-4 py-3">{footer}</div> : null}
    </div>
  );
}
