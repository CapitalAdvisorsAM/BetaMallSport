import { EstadoContrato, TipoTarifaContrato } from "@prisma/client";
import { ContractTable } from "@/components/rent-roll/ContractTable";
import { prisma } from "@/lib/prisma";
import type { RentRollRow } from "@/types";

type RentRollPageProps = {
  searchParams: {
    q?: string;
    estado?: string;
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
  const q = searchParams.q?.trim() ?? "";
  const estado =
    searchParams.estado && allowedStates.has(searchParams.estado as EstadoContrato)
      ? (searchParams.estado as EstadoContrato)
      : undefined;
  const today = new Date();

  const contracts = await prisma.contrato.findMany({
    where: {
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
  });

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
        <h2 className="text-lg font-semibold text-slate-900">Rent Roll</h2>
        <p className="mt-1 text-sm text-slate-600">
          Contratos y tarifa vigente UF/m² por local y arrendatario.
        </p>
      </header>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
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
