import Link from "next/link";
import { redirect } from "next/navigation";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";

type ChartLink = {
  title: string;
  description: string;
  href: string;
};

const CHART_LINKS: ChartLink[] = [
  {
    title: "Ocupación",
    description:
      "Vacancia por tamaño, tipo y piso, evolución mensual y vencimientos por año.",
    href: "/plan/occupancy"
  },
  {
    title: "Rent Roll",
    description: "Ocupación, WALT y concentración por categoría.",
    href: "/plan/rent-roll"
  },
  {
    title: "Vencimiento de contratos",
    description: "Perfil de expiraciones por año, próximos contratos a vencer.",
    href: "/plan/dashboard"
  },
  {
    title: "Facturación",
    description: "Facturación mensual y All-In (12 meses) por dimensión y concepto.",
    href: "/real/billing"
  },
  {
    title: "Ventas",
    description: "Ventas mensuales en UF y UF/m² por tamaño/tipo/piso.",
    href: "/real/sales"
  },
  {
    title: "Ventas Diarias",
    description: "UF y UF/m² por día del mes en curso.",
    href: "/real/sales-daily"
  },
  {
    title: "EE.RR.",
    description: "Ingresos y costos del Estado de Resultados con drill por grupo.",
    href: "/real/accounting"
  },
  {
    title: "Flujo de Caja",
    description: "BoP, Operación, Inversión, Financiamiento, EoP.",
    href: "/real/cash-flow"
  },
  {
    title: "Costo de Ocupación",
    description: "Matriz por arrendatario agrupada por tamaño con subtotales.",
    href: "/real/occupancy-cost"
  }
];

export default async function ChartsHubPage(): Promise<JSX.Element> {
  await requireSession();
  const { selectedProjectId } = await getProjectContext();
  if (!selectedProjectId) redirect("/");

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Gráficos"
        description="Acceso rápido a las vistas que reproducen las pestañas de gráficos del CDG."
      />
      <ModuleSectionCard>
        <ul className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">
          {CHART_LINKS.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                className="block h-full rounded-md border border-slate-200 bg-white p-4 transition-colors hover:border-brand-500 hover:bg-brand-50"
              >
                <p className="text-sm font-semibold text-slate-800">{c.title}</p>
                <p className="mt-1 text-xs text-slate-500">{c.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </ModuleSectionCard>
    </main>
  );
}
