import { EstadoContrato, TipoTarifaContrato } from "@prisma/client";
import { redirect } from "next/navigation";
import { KpiCard } from "@/components/dashboard/KpiCard";
import {
  RentRollDashboardTable,
  type RentRollDashboardTableRow
} from "@/components/rent-roll/RentRollDashboardTable";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { ProjectSelector } from "@/components/ui/ProjectSelector";
import { auth } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";

type RentRollDashboardPageProps = {
  searchParams: {
    proyecto?: string;
    periodo?: string;
  };
};

function formatDecimal(value: number): string {
  return value.toLocaleString("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatPeriod(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function buildLastPeriods(totalMonths: number): string[] {
  const now = new Date();
  return Array.from({ length: totalMonths }, (_, index) => {
    const value = new Date(now.getFullYear(), now.getMonth() - index, 1);
    return formatPeriod(value);
  });
}

function isValidPeriod(value?: string): value is string {
  if (!value) {
    return false;
  }
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export default async function RentRollDashboardPage({
  searchParams
}: RentRollDashboardPageProps): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);
  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Dashboard Rent Roll"
        description="No hay proyectos activos. Crea uno para visualizar metricas por local."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  const currentPeriod = formatPeriod(new Date());
  const periodo = isValidPeriod(searchParams.periodo) ? searchParams.periodo : currentPeriod;

  if (searchParams.proyecto !== selectedProjectId || searchParams.periodo !== periodo) {
    const params = new URLSearchParams();
    params.set("proyecto", selectedProjectId);
    params.set("periodo", periodo);
    redirect(`/rent-roll/dashboard?${params.toString()}`);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [contracts, ventaLocales] = await Promise.all([
    prisma.contrato.findMany({
      where: {
        proyectoId: selectedProjectId,
        estado: EstadoContrato.VIGENTE
      },
      include: {
        local: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
            glam2: true,
            esGLA: true
          }
        },
        arrendatario: {
          select: {
            nombreComercial: true
          }
        },
        tarifas: {
          where: {
            tipo: TipoTarifaContrato.FIJO_UF_M2,
            vigenciaDesde: { lte: today },
            OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: today } }]
          },
          orderBy: [{ vigenciaDesde: "desc" }],
          take: 1,
          select: {
            valor: true
          }
        },
        ggcc: {
          where: {
            vigenciaDesde: { lte: today },
            OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: today } }]
          },
          orderBy: [{ vigenciaDesde: "desc" }],
          take: 1,
          select: {
            tarifaBaseUfM2: true,
            pctAdministracion: true
          }
        }
      },
      orderBy: [{ local: { codigo: "asc" } }]
    }),
    prisma.ventaLocal.findMany({
      where: {
        proyectoId: selectedProjectId,
        periodo
      },
      select: {
        localId: true,
        ventasUf: true,
        createdAt: true
      },
      orderBy: [{ createdAt: "desc" }]
    })
  ]);

  const ventasByLocalId = new Map<string, number>();
  for (const venta of ventaLocales) {
    if (!ventasByLocalId.has(venta.localId)) {
      ventasByLocalId.set(venta.localId, Number(venta.ventasUf));
    }
  }

  const rows: RentRollDashboardTableRow[] = contracts.map((contract) => {
    const glam2 = Number(contract.local.glam2);
    const tarifaUfM2 = contract.tarifas[0]?.valor ? Number(contract.tarifas[0].valor) : 0;
    const rentaFijaUf = glam2 * tarifaUfM2;

    const ggccActual = contract.ggcc[0];
    const ggccUf = ggccActual
      ? Number(ggccActual.tarifaBaseUfM2) * glam2 * (1 + Number(ggccActual.pctAdministracion) / 100)
      : 0;

    const ventasUf = ventasByLocalId.has(contract.localId)
      ? (ventasByLocalId.get(contract.localId) ?? null)
      : null;

    return {
      id: contract.id,
      local: `${contract.local.codigo} - ${contract.local.nombre}`,
      arrendatario: contract.arrendatario.nombreComercial,
      glam2,
      tarifaUfM2,
      rentaFijaUf,
      ggccUf,
      ventasUf
    };
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.glam2 += row.glam2;
      acc.rentaFijaUf += row.rentaFijaUf;
      acc.ggccUf += row.ggccUf;
      if (row.ventasUf != null) {
        acc.ventasUf += row.ventasUf;
      }
      return acc;
    },
    { glam2: 0, rentaFijaUf: 0, ggccUf: 0, ventasUf: 0 }
  );

  const periodOptions = buildLastPeriods(12);

  return (
    <main className="space-y-4">
      <header className="rounded-md bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gold-400" />
              <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">
                Rent Roll Dashboard
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Metricas clave por local para contratos vigentes del proyecto seleccionado.
            </p>
          </div>
          <ProjectSelector
            projects={projects}
            selectedProjectId={selectedProjectId}
            preserve={{ periodo }}
          />
        </div>
      </header>

      <section className="rounded-md bg-white p-4 shadow-sm">
        <form className="grid gap-3 md:grid-cols-[220px_auto]">
          <input type="hidden" name="proyecto" value={selectedProjectId} />
          <select
            name="periodo"
            defaultValue={periodo}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-brand-500 focus:ring-2"
          >
            {periodOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Aplicar periodo
          </button>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard
          title="Renta fija total (UF)"
          value={formatDecimal(totals.rentaFijaUf)}
          accent="slate"
        />
        <KpiCard title="GGCC total (UF)" value={formatDecimal(totals.ggccUf)} accent="slate" />
        <KpiCard
          title="Ventas periodo (UF)"
          value={formatDecimal(totals.ventasUf)}
          accent="slate"
        />
      </section>

      <RentRollDashboardTable rows={rows} totals={totals} />
    </main>
  );
}

