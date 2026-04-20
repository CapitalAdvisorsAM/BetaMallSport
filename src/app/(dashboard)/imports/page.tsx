import Link from "next/link";
import { redirect } from "next/navigation";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";

type UploadCard = {
  title: string;
  description: string;
  href: string;
};

const RENT_ROLL_UPLOADS: UploadCard[] = [
  {
    title: "Locales",
    description: "Maestro de unidades arrendables (GLA, categoría, estado).",
    href: "/rent-roll/units?seccion=upload",
  },
  {
    title: "Arrendatarios",
    description: "Maestro de tenants (RUT, razón social, contactos).",
    href: "/rent-roll/tenants?seccion=upload",
  },
  {
    title: "Contratos",
    description: "Contratos vigentes: plazos, tarifas y locales asociados.",
    href: "/rent-roll/contracts?seccion=upload",
  },
  {
    title: "Ventas Presupuestadas",
    description: "Ventas esperadas por arrendatario y período.",
    href: "/rent-roll/budgeted-sales",
  },
];

const FINANCE_UPLOADS: UploadCard[] = [
  {
    title: "Contabilidad",
    description: "Partidas contables por período (EE.RR y EE.FF).",
    href: "/finance/upload#accounting",
  },
  {
    title: "Ventas Reales",
    description: "Ventas efectivas por arrendatario y período.",
    href: "/finance/upload#sales",
  },
  {
    title: "Presupuesto Gastos",
    description: "Expense budget mensual por cuenta.",
    href: "/finance/upload#expense-budget",
  },
  {
    title: "Balances",
    description: "Balances de cuentas contables.",
    href: "/finance/upload#balances",
  },
  {
    title: "Bancos",
    description: "Cartolas y movimientos bancarios.",
    href: "/finance/upload#bank",
  },
];

function UploadGrid({ cards }: { cards: UploadCard[] }): JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="group block rounded-md border border-surface-200 bg-white p-4 shadow-sm transition-all hover:border-brand-500 hover:shadow-md"
        >
          <h4 className="font-medium text-brand-700 group-hover:text-brand-500">
            {card.title}
          </h4>
          <p className="mt-1 text-sm text-slate-500">{card.description}</p>
        </Link>
      ))}
    </div>
  );
}

export default async function ImportsHubPage(): Promise<JSX.Element> {
  await requireSession();
  const { selectedProjectId } = await getProjectContext();

  if (!selectedProjectId) {
    redirect("/settings/projects");
  }

  return (
    <main className="space-y-4">
      <ModuleHeader
        overline="Carga de Datos"
        title="Imports"
        description="Todos los flujos de carga de datos agrupados por dominio. Rent-roll define lo que debería pasar; Finance refleja lo que está pasando."
      />

      <ModuleSectionCard
        title="Rent Roll"
        description="Datos contractuales y expected revenue."
      >
        <UploadGrid cards={RENT_ROLL_UPLOADS} />
      </ModuleSectionCard>

      <ModuleSectionCard
        title="Finance"
        description="Datos efectivos y presupuesto de gastos."
      >
        <UploadGrid cards={FINANCE_UPLOADS} />
      </ModuleSectionCard>
    </main>
  );
}
