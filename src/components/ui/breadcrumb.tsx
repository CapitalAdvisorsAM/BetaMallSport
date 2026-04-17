import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
  className?: string;
};

export function Breadcrumb({ items, className }: BreadcrumbProps): JSX.Element {
  return (
    <nav aria-label="Ruta de navegacion" className={cn("text-sm", className)}>
      <ol className="flex items-center gap-1.5 text-slate-500">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 ? (
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            ) : null}
            {item.href ? (
              <Link
                href={item.href}
                className="transition-colors hover:text-brand-600"
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-slate-900" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
