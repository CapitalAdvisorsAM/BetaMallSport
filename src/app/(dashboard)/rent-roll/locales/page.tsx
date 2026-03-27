import { redirect } from "next/navigation";
import { ProjectSelector } from "@/components/ui/ProjectSelector";
import { auth } from "@/lib/auth";
import { buildLocalesWhere, parseLocalesEstado } from "@/lib/rent-roll/locales";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";

type LocalesPageProps = {
  searchParams: {
    proyecto?: string;
    q?: string;
    estado?: string;
  };
};

function formatDecimal(value: string): string {
  return Number(value).toLocaleString("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export default async function LocalesPage({
  searchParams
}: LocalesPageProps): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);
  if (!selectedProjectId) {
    return (
      <main className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Locales</h2>
        <p className="mt-2 text-sm text-slate-600">
          No hay proyectos activos. Debes crear al menos uno para visualizar locales.
        </p>
      </main>
    );
  }

  if (!searchParams.proyecto) {
    redirect(`/rent-roll/locales?proyecto=${selectedProjectId}`);
  }

  const q = searchParams.q?.trim() ?? "";
  const estado = parseLocalesEstado(searchParams.estado);

  const locales = await prisma.local.findMany({
    where: buildLocalesWhere(selectedProjectId, { q, estado }),
    orderBy: [{ piso: "asc" }, { codigo: "asc" }]
  });

  return (
    <main className="space-y-4">
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Locales</h2>
            <p className="text-sm text-slate-600">Listado de locales del proyecto seleccionado.</p>
          </div>
          <ProjectSelector
            projects={projects}
            selectedProjectId={selectedProjectId}
            preserve={{ q, estado: estado ?? "" }}
          />
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <input type="hidden" name="proyecto" value={selectedProjectId} />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por codigo o nombre"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-brand-500 focus:ring-2"
          />
          <select
            name="estado"
            defaultValue={estado ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-brand-500 focus:ring-2"
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVO">ACTIVO</option>
            <option value="INACTIVO">INACTIVO</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Filtrar
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-600">
                <th className="px-4 py-3 font-semibold">{"C\u00f3digo"}</th>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Piso</th>
                <th className="px-4 py-3 font-semibold">Zona</th>
                <th className="px-4 py-3 font-semibold">{"GLA m\u00b2"}</th>
                <th className="px-4 py-3 font-semibold">Es GLA</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {locales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    No se encontraron locales para los filtros aplicados.
                  </td>
                </tr>
              ) : (
                locales.map((local) => (
                  <tr key={local.id} className="text-slate-800">
                    <td className="whitespace-nowrap px-4 py-3 font-medium">{local.codigo}</td>
                    <td className="px-4 py-3">{local.nombre}</td>
                    <td className="whitespace-nowrap px-4 py-3">{local.tipo}</td>
                    <td className="whitespace-nowrap px-4 py-3">{local.piso}</td>
                    <td className="whitespace-nowrap px-4 py-3">{local.zona ?? "\u2014"}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDecimal(local.glam2.toString())}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          local.esGLA ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {local.esGLA ? "S\u00ed" : "No"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          local.estado === "ACTIVO" ? "bg-brand-100 text-brand-700" : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {local.estado}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

