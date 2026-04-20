import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { UF_STALENESS_DAYS } from "@/lib/constants";
import { isUfStale } from "@/lib/utils";
import { UfSyncPanel } from "@/components/settings/UfSyncPanel";

export default async function SistemaConfigPage(): Promise<JSX.Element> {
  const session = await requireSession();
  const isAdmin = session.user.role === "ADMIN";

  const ufRows = await prisma.valorUF.findMany({
    orderBy: { fecha: "desc" },
    take: 60,
    select: { fecha: true, valor: true },
  });

  const ufValues = ufRows.map((r) => ({
    fecha: r.fecha.toISOString().slice(0, 10),
    valor: r.valor.toString(),
  }));

  const currentUf = ufValues[0] ?? null;

  const isStale = isUfStale(ufRows[0]?.fecha ?? null);

  return (
    <main className="space-y-6">
      <header className="rounded-md bg-white p-5 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gold-400" />
          <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">
            Sistema
          </h2>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Configuración global de integraciones y datos del sistema.
        </p>
      </header>

      <section className="rounded-md bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">Valor UF</h3>
        <p className="mb-4 text-sm text-slate-500">
          Sincroniza el valor diario de la UF desde la API oficial de la CMF. El dashboard muestra
          una alerta cuando el valor tiene más de {UF_STALENESS_DAYS} días.
        </p>
        <UfSyncPanel currentUf={currentUf} isStale={isStale} isAdmin={isAdmin} ufValues={ufValues} />
      </section>
    </main>
  );
}
