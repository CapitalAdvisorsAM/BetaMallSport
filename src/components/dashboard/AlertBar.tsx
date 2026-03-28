import Link from "next/link";
import type { AlertCounts } from "@/lib/kpi";

export function AlertBar({
  vencen30,
  vencen90,
  enGracia,
  vacantes,
  proyectoId
}: AlertCounts): JSX.Element | null {
  const href = `/rent-roll/dashboard?proyecto=${proyectoId}`;

  const items = [
    {
      key: "vencen30",
      visible: vencen30 > 0,
      label: `🔴 ${vencen30} contratos vencen en <=30 dias`,
      className: "bg-rose-100 text-rose-800"
    },
    {
      key: "enGracia",
      visible: enGracia > 0,
      label: `🟡 ${enGracia} en periodo de gracia`,
      className: "bg-amber-100 text-amber-800"
    },
    {
      key: "vacantes",
      visible: vacantes > 0,
      label: `⬜ ${vacantes} locales sin arrendatario`,
      className: "bg-slate-100 text-slate-700"
    },
    {
      key: "vencen90",
      visible: vencen90 > 0,
      label: `🟠 ${vencen90} vencen en 31-90 dias`,
      className: "bg-orange-100 text-orange-800"
    }
  ].filter((item) => item.visible);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-md bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Link
            key={item.key}
            href={href}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors hover:opacity-90 ${item.className}`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
