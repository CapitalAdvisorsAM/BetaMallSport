import Link from "next/link";
import { redirect } from "next/navigation";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";

type ReconciliationLink = {
  title: string;
  href: string;
  description: string;
  category: "ingresos" | "facturacion" | "ventas" | "cobranza" | "agregado";
};

const RECONCILIATION_LINKS: ReconciliationLink[] = [
  {
    title: "Ppto vs Real",
    href: "/reconciliation/budget-vs-actual",
    description:
      "Δ Ingresos mensuales: ingreso esperado por arrendatario vs facturación contable registrada.",
    category: "ingresos",
  },
  {
    title: "Facturación Esperada vs Emitida",
    href: "/reconciliation/billing-gap",
    description:
      "Gap entre lo que debería facturarse según rent roll y lo efectivamente emitido en SAP por local.",
    category: "facturacion",
  },
  {
    title: "Ventas Ppto vs Real",
    href: "/reconciliation/sales-gap",
    description:
      "Δ Ventas: ventas presupuestadas por locatario vs ventas reales reportadas mensualmente.",
    category: "ventas",
  },
  {
    title: "Cobranza",
    href: "/reconciliation/collection",
    description:
      "Δ Cobranza: monto emitido vs monto efectivamente recibido. DSO y morosidad por locatario.",
    category: "cobranza",
  },
  {
    title: "Waterfall",
    href: "/reconciliation/waterfall",
    description:
      "Descomposición de variaciones entre presupuesto y real por línea contable. De dónde viene el delta.",
    category: "agregado",
  },
  {
    title: "Costo Ocupación",
    href: "/reconciliation/occupancy-cost",
    description:
      "Gasto real del locatario (arriendo + GGCC) sobre ventas reales reportadas. Ratio por local.",
    category: "agregado",
  },
  {
    title: "Análisis",
    href: "/reconciliation/analysis",
    description:
      "Vista analítica cruzada por categoría, zona y período. Tendencias y concentración de deltas.",
    category: "agregado",
  },
];

const CATEGORY_META: Record<
  ReconciliationLink["category"],
  { label: string; description: string }
> = {
  ingresos: {
    label: "Δ Ingresos",
    description: "Presupuesto aprobado vs contabilidad observada.",
  },
  facturacion: {
    label: "Δ Facturación",
    description: "Rent roll esperado vs SAP emitido.",
  },
  ventas: {
    label: "Δ Ventas",
    description: "Ventas presupuestadas vs ventas reportadas.",
  },
  cobranza: {
    label: "Δ Cobranza",
    description: "Emitido vs recibido.",
  },
  agregado: {
    label: "Vistas agregadas",
    description: "Análisis transversales que combinan múltiples dimensiones.",
  },
};

const CATEGORY_ORDER: ReconciliationLink["category"][] = [
  "ingresos",
  "facturacion",
  "ventas",
  "cobranza",
  "agregado",
];

export default async function ReconciliationDashboardPage(): Promise<JSX.Element> {
  await requireSession();
  const { selectedProjectId } = await getProjectContext();

  if (!selectedProjectId) {
    redirect("/");
  }

  const linksByCategory = CATEGORY_ORDER.map((category) => ({
    category,
    meta: CATEGORY_META[category],
    items: RECONCILIATION_LINKS.filter((link) => link.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <main className="space-y-4">
      <ModuleHeader
        overline="Reconciliación"
        title="Puente Plan · Real"
        description="Deltas entre lo proyectado y lo observado. Este dashboard no muestra valores absolutos aislados: cada sección es una diferencia entre el mundo Plan y el mundo Real."
      />

      <section className="rounded-md border border-surface-200 bg-white p-5 shadow-card">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-5 w-1 rounded-full bg-gold-400" />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-brand-700">
              Cómo leer esta sección
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Cada tarjeta abre una vista específica de reconciliación. Los deltas se calculan siempre
              como <span className="font-semibold">Real menos Plan</span>: valores positivos indican
              exceso frente a lo esperado; negativos indican déficit.
            </p>
          </div>
        </div>
      </section>

      {linksByCategory.map((group) => (
        <ModuleSectionCard
          key={group.category}
          title={group.meta.label}
          description={group.meta.description}
        >
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group block rounded-md border border-surface-200 bg-white p-4 shadow-sm transition-all hover:border-brand-500 hover:shadow-md"
              >
                <h4 className="font-medium text-brand-700 group-hover:text-brand-500">
                  {link.title}
                </h4>
                <p className="mt-1 text-sm text-slate-500">{link.description}</p>
              </Link>
            ))}
          </div>
        </ModuleSectionCard>
      ))}
    </main>
  );
}
