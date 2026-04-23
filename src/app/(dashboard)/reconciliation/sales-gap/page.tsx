import { redirect } from "next/navigation";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";

export default async function SalesGapPage(): Promise<JSX.Element> {
  await requireSession();
  const { selectedProjectId } = await getProjectContext();

  if (!selectedProjectId) {
    redirect("/");
  }

  return (
    <main className="space-y-4">
      <ModuleHeader
        overline="Reconciliación · Ventas"
        title="Ventas Presupuestadas vs Reales"
        description="Gap entre las ventas comprometidas por locatario en el presupuesto y las ventas reales reportadas mensualmente."
      />

      <section className="rounded-md border border-dashed border-surface-300 bg-white p-8 shadow-card">
        <p className="text-sm font-semibold uppercase tracking-wide text-gold-700">Próximamente</p>
        <h3 className="mt-2 font-serif text-2xl text-brand-700">
          Delta de ventas por locatario
        </h3>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">
          Esta vista cruzará los datos de <strong>Ventas Presupuestadas</strong> (mundo Plan) con las{" "}
          <strong>Ventas Reales reportadas</strong> (mundo Real) para mostrar el gap mensual por
          locatario y categoría.
        </p>
        <ul className="mt-4 space-y-1 text-sm text-slate-600">
          <li>· Δ Ventas mensual por locatario (CLP y % vs presupuesto)</li>
          <li>· Concentración del gap por categoría y zona</li>
          <li>· Impacto estimado en overage y renta variable</li>
          <li>· Tendencia YoY y ranking de desviaciones</li>
        </ul>
      </section>
    </main>
  );
}
