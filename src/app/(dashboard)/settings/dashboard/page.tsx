import { redirect } from "next/navigation";
import { requireSession, canWrite } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { resolveWidgetConfigs } from "@/lib/dashboard/widget-registry";
import { DashboardConfigEditor } from "@/components/settings/DashboardConfigEditor";

export default async function DashboardConfigPage(): Promise<JSX.Element> {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  const canEdit = canWrite(session.user.role);

  const [dbRows, customWidgets] = await Promise.all([
    prisma.dashboardConfig.findMany({ orderBy: { position: "asc" } }),
    prisma.customWidget.findMany({ orderBy: { position: "asc" } })
  ]);

  const configs = resolveWidgetConfigs(dbRows);

  return (
    <main className="space-y-6">
      <header className="rounded-md bg-white p-5 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gold-400" />
          <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">
            Configuracion del Dashboard
          </h2>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Activa o desactiva widgets, reordenalos y ajusta las variantes de formulas y parametros.
          La configuracion aplica globalmente para todos los proyectos.
        </p>
      </header>

      <DashboardConfigEditor
        initialConfigs={configs}
        initialCustomWidgets={customWidgets.map((w) => ({
          id: w.id,
          title: w.title,
          chartType: w.chartType,
          enabled: w.enabled,
          position: w.position,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formulaConfig: w.formulaConfig as any
        }))}
        canEdit={canEdit}
      />
    </main>
  );
}
