import { redirect } from "next/navigation";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";

export default async function CollectionPage(): Promise<JSX.Element> {
  await requireSession();
  const { selectedProjectId } = await getProjectContext();

  if (!selectedProjectId) {
    redirect("/");
  }

  return (
    <main className="space-y-4">
      <ModuleHeader
        overline="Reconciliación · Cobranza"
        title="Emitido vs Recibido"
        description="Diferencias entre facturación emitida y cobranza efectivamente percibida. DSO y morosidad por locatario."
      />

      <section className="rounded-md border border-dashed border-surface-300 bg-white p-8 shadow-card">
        <p className="text-sm font-semibold uppercase tracking-wide text-gold-700">Próximamente</p>
        <h3 className="mt-2 font-serif text-2xl text-brand-700">
          Delta de cobranza y morosidad
        </h3>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">
          Esta vista conciliará la <strong>facturación emitida en SAP</strong> con la{" "}
          <strong>cobranza efectiva registrada en contabilidad</strong> para identificar morosidad,
          atrasos y su impacto en flujo de caja.
        </p>
        <ul className="mt-4 space-y-1 text-sm text-slate-600">
          <li>· Δ Emitido vs cobrado mensual (CLP y %)</li>
          <li>· DSO (Days Sales Outstanding) real por locatario</li>
          <li>· Aging de cuentas por cobrar (0-30, 31-60, 61-90, +90 días)</li>
          <li>· Ranking de locatarios con mayor atraso acumulado</li>
        </ul>
      </section>
    </main>
  );
}
