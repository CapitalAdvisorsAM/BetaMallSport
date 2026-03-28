import { redirect } from "next/navigation";
import { LocalesCrudPanel } from "@/components/rent-roll/LocalesCrudPanel";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { ProjectSelector } from "@/components/ui/ProjectSelector";
import { auth } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import { buildLocalesWhere, parseLocalesEstado } from "@/lib/rent-roll/locales";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";
import { cn } from "@/lib/utils";

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
      <ProjectCreationPanel
        title="Locales"
        description="No hay proyectos activos. Crea uno para habilitar el CRUD de locales."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  if (!searchParams.proyecto) {
    redirect(`/rent-roll/locales?proyecto=${selectedProjectId}`);
  }

  const q = searchParams.q?.trim() ?? "";
  const estado = parseLocalesEstado(searchParams.estado);

  const [locales, localesCrud] = await Promise.all([
    prisma.local.findMany({
      where: buildLocalesWhere(selectedProjectId, { q, estado }),
      orderBy: [{ piso: "asc" }, { codigo: "asc" }]
    }),
    prisma.local.findMany({
      where: { proyectoId: selectedProjectId },
      orderBy: [{ codigo: "asc" }]
    })
  ]);

  return (
    <main className="space-y-4">
      <section className="rounded-md bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gold-400" />
              <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">Locales</h2>
            </div>
            <p className="text-sm text-slate-600">Listado de locales del proyecto seleccionado.</p>
          </div>
          <ProjectSelector
            projects={projects}
            selectedProjectId={selectedProjectId}
            preserve={{ q, estado: estado ?? "" }}
          />
        </div>
      </section>

      <section className="rounded-md bg-white p-4 shadow-sm">
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
            className="rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Filtrar
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-md bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-brand-700">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                  {"C\u00f3digo"}
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                  Nombre
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                  Tipo
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                  Piso
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                  Zona
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                  {"GLA m\u00b2"}
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                  Es GLA
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {locales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    No se encontraron locales para los filtros aplicados.
                  </td>
                </tr>
              ) : (
                locales.map((local, index) => (
                  <tr
                    key={local.id}
                    className={cn(
                      "text-slate-800 transition-colors hover:bg-brand-50",
                      index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                    )}
                  >
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

      <LocalesCrudPanel
        proyectoId={selectedProjectId}
        canEdit={canWrite(session.user.role)}
        initialLocales={localesCrud.map((local) => ({
          id: local.id,
          proyectoId: local.proyectoId,
          codigo: local.codigo,
          nombre: local.nombre,
          glam2: local.glam2.toString(),
          piso: local.piso,
          tipo: local.tipo,
          zona: local.zona,
          esGLA: local.esGLA,
          estado: local.estado
        }))}
      />
    </main>
  );
}

