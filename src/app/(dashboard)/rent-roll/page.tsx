import Link from "next/link";
import { EstadoContrato, TipoCargaDatos, TipoTarifaContrato } from "@prisma/client";
import { redirect } from "next/navigation";
import { ContractTable } from "@/components/rent-roll/ContractTable";
import { ProjectSelector } from "@/components/ui/ProjectSelector";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";
import type { RentRollRow } from "@/types";

type RentRollPageProps = {
  searchParams: {
    q?: string;
    estado?: string;
    proyecto?: string;
  };
};

const allowedStates = new Set<EstadoContrato>([
  "VIGENTE",
  "TERMINADO",
  "TERMINADO_ANTICIPADO",
  "GRACIA"
]);

function formatDecimal(value: string): string {
  return Number(value).toLocaleString("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export default async function RentRollPage({
  searchParams
}: RentRollPageProps): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);
  if (!selectedProjectId) {
    return (
      <main className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Rent Roll</h2>
        <p className="mt-2 text-sm text-slate-600">
          No hay proyectos activos. Debes crear al menos uno para visualizar rent roll.
        </p>
      </main>
    );
  }

  if (!searchParams.proyecto) {
    redirect(`/rent-roll?proyecto=${selectedProjectId}`);
  }

  const q = searchParams.q?.trim() ?? "";
  const estado =
    searchParams.estado && allowedStates.has(searchParams.estado as EstadoContrato)
      ? (searchParams.estado as EstadoContrato)
      : undefined;
  const today = new Date();

  const [contracts, latestCarga] = await Promise.all([
    prisma.contrato.findMany({
      where: {
        proyectoId: selectedProjectId,
        ...(estado ? { estado } : {}),
        ...(q
          ? {
              OR: [
                { numeroContrato: { contains: q, mode: "insensitive" } },
                { local: { codigo: { contains: q, mode: "insensitive" } } },
                { local: { nombre: { contains: q, mode: "insensitive" } } },
                { arrendatario: { nombreComercial: { contains: q, mode: "insensitive" } } },
                { arrendatario: { razonSocial: { contains: q, mode: "insensitive" } } }
              ]
            }
          : {})
      },
      include: {
        local: true,
        arrendatario: true,
        tarifas: {
          where: {
            tipo: TipoTarifaContrato.FIJO_UF_M2,
            vigenciaDesde: { lte: today },
            OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: today } }]
          },
          orderBy: [{ vigenciaDesde: "desc" }],
          take: 1
        }
      },
      orderBy: [{ estado: "asc" }, { fechaInicio: "desc" }]
    }),
    prisma.cargaDatos.findFirst({
      where: { proyectoId: selectedProjectId, tipo: TipoCargaDatos.RENT_ROLL },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const rows: RentRollRow[] = contracts.map((contract) => ({
    id: contract.id,
    local: `${contract.local.codigo} - ${contract.local.nombre}`,
    arrendatario: contract.arrendatario.nombreComercial,
    estado: contract.estado,
    fechaInicio: contract.fechaInicio,
    fechaTermino: contract.fechaTermino,
    tarifaVigenteUfM2:
      contract.tarifas[0]?.valor != null ? formatDecimal(contract.tarifas[0].valor.toString()) : "-",
    m2: formatDecimal(contract.local.glam2.toString())
  }));

  return (
    <main className="space-y-4">
      <header className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Rent Roll</h2>
            <p className="mt-1 text-sm text-slate-600">
              Contratos y tarifa vigente UF/m² por local y arrendatario.
            </p>
          </div>
          <Link
            href={`/rent-roll/upload?proyecto=${selectedProjectId}`}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Cargar archivo
          </Link>
        </div>
        <div className="mt-4">
          <ProjectSelector
            projects={projects}
            selectedProjectId={selectedProjectId}
            preserve={{ q, estado: estado ?? "" }}
          />
        </div>
      </header>

      {latestCarga ? (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-700">
            Ultima carga: <span className="font-semibold">{latestCarga.estado}</span> | Registros aplicados:{" "}
            {latestCarga.registrosCargados}
          </p>
          <Link
            className="mt-2 inline-block text-sm font-medium text-brand-700 underline"
            href={`/rent-roll/upload?proyecto=${selectedProjectId}&cargaId=${latestCarga.id}`}
          >
            Ver detalle de carga
          </Link>
        </section>
      ) : null}

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <input type="hidden" name="proyecto" value={selectedProjectId} />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por local, contrato o arrendatario"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-brand-500 focus:ring-2"
          />
          <select
            name="estado"
            defaultValue={estado ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-brand-500 focus:ring-2"
          >
            <option value="">Todos los estados</option>
            {Array.from(allowedStates).map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Filtrar
          </button>
        </form>
      </section>

      <ContractTable rows={rows} />
    </main>
  );
}
