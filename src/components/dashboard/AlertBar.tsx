import Link from "next/link";
import { AlertCircle, AlertTriangle, Building2, CalendarClock, Clock, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AlertCounts } from "@/lib/kpi";

type AlertItem = {
  key: string;
  visible: boolean;
  label: string;
  className: string;
  Icon: LucideIcon;
  href: string;
};

export function AlertBar({
  vencen30,
  vencen90,
  enGracia,
  noIniciados,
  vacantes,
  brechaFacturacion
}: AlertCounts): JSX.Element | null {
  const href = "/rent-roll/dashboard";
  const rentRollHref = "/rent-roll";

  const items: AlertItem[] = [
    {
      key: "vencen30",
      visible: vencen30 > 0,
      label: `${vencen30} contratos vencen en ≤30 días`,
      className: "bg-rose-100 text-rose-800",
      Icon: AlertCircle,
      href
    },
    {
      key: "brechaFacturacion",
      visible: (brechaFacturacion ?? 0) > 0,
      label: `${brechaFacturacion} locales con brecha >10%`,
      className: "bg-rose-100 text-rose-700",
      Icon: TrendingDown,
      href: rentRollHref
    },
    {
      key: "enGracia",
      visible: enGracia > 0,
      label: `${enGracia} en período de gracia`,
      className: "bg-amber-100 text-amber-800",
      Icon: Clock,
      href
    },
    {
      key: "noIniciados",
      visible: noIniciados > 0,
      label: `${noIniciados} contratos no iniciados`,
      className: "bg-sky-100 text-sky-800",
      Icon: CalendarClock,
      href
    },
    {
      key: "vacantes",
      visible: vacantes > 0,
      label: `${vacantes} locales sin arrendatario`,
      className: "bg-slate-100 text-slate-700",
      Icon: Building2,
      href
    },
    {
      key: "vencen90",
      visible: vencen90 > 0,
      label: `${vencen90} vencen en 31–90 días`,
      className: "bg-orange-100 text-orange-800",
      Icon: AlertTriangle,
      href
    }
  ].filter((item) => item.visible);

  if (items.length === 0) return null;

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow">
      <div className="flex flex-wrap gap-2">
        {items.map(({ key, href: itemHref, className, Icon, label }) => (
          <Link
            key={key}
            href={itemHref}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80 ${className}`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {label}
          </Link>
        ))}
      </div>
    </section>
  );
}
