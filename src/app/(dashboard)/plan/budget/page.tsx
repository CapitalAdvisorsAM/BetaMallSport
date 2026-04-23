import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";

export default async function PlanBudgetPage(): Promise<JSX.Element> {
  await requireSession();
  await getProjectContext();

  return (
    <main className="space-y-4">
      <ModuleHeader
        overline="Expectativa · Presupuesto"
        title="Presupuesto en Plataforma"
        description="Motor de presupuesto versionado que reemplaza al Excel como herramienta de planificación."
        valueBadges={["teorico"]}
      />

      <section className="rounded-md border border-dashed border-surface-300 bg-white p-8 shadow-card">
        <p className="text-sm font-semibold uppercase tracking-wide text-gold-700">Próximamente</p>
        <h3 className="mt-2 font-serif text-2xl text-brand-700">Motor de presupuesto</h3>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">
          Esta sección alojará el motor que replica las 9 secciones del Excel (arriendo fijo, overage,
          reajustes, GGCC, recuperaciones, fondo promoción, opex, atípicos y resultado) con planes
          versionados, supuestos UF y contratos especulativos.
        </p>
        <ul className="mt-4 space-y-1 text-sm text-slate-600">
          <li>· Fase 1: modelo de datos + importador histórico Excel</li>
          <li>· Fase 2: motor de cálculo con tests de paridad vs Excel v24</li>
          <li>· Fase 3: UI de planificador (supuestos, contratos especulativos, opex)</li>
          <li>· Fase 4: Presupuesto vs Real automático</li>
        </ul>
      </section>
    </main>
  );
}
