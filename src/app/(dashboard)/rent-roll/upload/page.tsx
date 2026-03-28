import type { Prisma } from "@prisma/client";
import { TipoCargaDatos } from "@prisma/client";
import { redirect } from "next/navigation";
import { CargaHistorial } from "@/components/upload/CargaHistorial";
import { UploadSection } from "@/components/upload/UploadSection";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { ProjectSelector } from "@/components/ui/ProjectSelector";
import { auth } from "@/lib/auth";
import { parseRentRollPreviewPayload } from "@/lib/carga-datos";
import { canWrite } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";
import { parseStoredUploadPayload } from "@/lib/upload/payload";

type UploadTab = "locales" | "arrendatarios" | "contratos";

type UploadPageProps = {
  searchParams: {
    proyecto?: string;
    tab?: string;
  };
};

type HistoryItem = {
  id: string;
  createdAt: Date;
  archivoNombre: string;
  estado: string;
  created: number;
  updated: number;
  rejected: number;
};

type TabConfig = {
  label: string;
  badge: string;
  tipo: "LOCALES" | "ARRENDATARIOS" | "CONTRATOS";
  previewEndpoint: string;
  applyEndpoint: string;
  templateEndpoint: string;
  columns: Array<{ key: string; label: string }>;
  history: HistoryItem[];
};

const validTabs: UploadTab[] = ["locales", "arrendatarios", "contratos"];

function isValidTab(tab: string | undefined): tab is UploadTab {
  return Boolean(tab && validTabs.includes(tab as UploadTab));
}

function extractHistoryCounts(errorDetalle: Prisma.JsonValue | null): {
  created: number;
  updated: number;
  rejected: number;
} {
  const modernPayload = parseStoredUploadPayload(errorDetalle);
  if (modernPayload?.report) {
    return {
      created: modernPayload.report.created,
      updated: modernPayload.report.updated,
      rejected: modernPayload.report.rejected
    };
  }
  if (modernPayload) {
    return {
      created: 0,
      updated: 0,
      rejected: modernPayload.summary.errores
    };
  }

  const legacyPayload = parseRentRollPreviewPayload(errorDetalle);
  if (legacyPayload?.report) {
    return {
      created: legacyPayload.report.created,
      updated: legacyPayload.report.updated,
      rejected: legacyPayload.report.rejected
    };
  }
  if (legacyPayload) {
    return {
      created: 0,
      updated: 0,
      rejected: legacyPayload.summary.errorRows
    };
  }

  return { created: 0, updated: 0, rejected: 0 };
}

function mapHistory(
  cargas: Array<{
    id: string;
    createdAt: Date;
    archivoNombre: string;
    estado: string;
    errorDetalle: Prisma.JsonValue | null;
  }>
): HistoryItem[] {
  return cargas.map((carga) => {
    const counts = extractHistoryCounts(carga.errorDetalle);
    return {
      id: carga.id,
      createdAt: carga.createdAt,
      archivoNombre: carga.archivoNombre,
      estado: carga.estado,
      created: counts.created,
      updated: counts.updated,
      rejected: counts.rejected
    };
  });
}

export default async function RentRollUploadPage({
  searchParams
}: UploadPageProps): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const activeTab: UploadTab = isValidTab(searchParams.tab) ? searchParams.tab : "locales";
  const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);

  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Carga de Datos"
        description="No hay proyectos activos. Crea uno para poder cargar datos."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  if (!searchParams.proyecto || !isValidTab(searchParams.tab)) {
    redirect(`/rent-roll/upload?proyecto=${selectedProjectId}&tab=${activeTab}`);
  }

  const [localesRaw, arrendatariosRaw, contratosRaw] = await Promise.all([
    prisma.cargaDatos.findMany({
      where: { proyectoId: selectedProjectId, tipo: TipoCargaDatos.LOCALES },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        archivoNombre: true,
        estado: true,
        errorDetalle: true
      }
    }),
    prisma.cargaDatos.findMany({
      where: { proyectoId: selectedProjectId, tipo: TipoCargaDatos.ARRENDATARIOS },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        archivoNombre: true,
        estado: true,
        errorDetalle: true
      }
    }),
    prisma.cargaDatos.findMany({
      where: { proyectoId: selectedProjectId, tipo: TipoCargaDatos.RENT_ROLL },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        archivoNombre: true,
        estado: true,
        errorDetalle: true
      }
    })
  ]);

  const tabConfig: Record<UploadTab, TabConfig> = {
    locales: {
      label: "1. Locales",
      badge: "Primero",
      tipo: "LOCALES",
      previewEndpoint: "/api/rent-roll/upload/locales/preview",
      applyEndpoint: "/api/rent-roll/upload/locales/apply",
      templateEndpoint: "/api/rent-roll/upload/locales/template",
      columns: [
        { key: "codigo", label: "Codigo" },
        { key: "nombre", label: "Nombre" },
        { key: "glam2", label: "GLA m2" },
        { key: "piso", label: "Piso" },
        { key: "tipo", label: "Tipo" },
        { key: "estado", label: "Estado" }
      ],
      history: mapHistory(localesRaw)
    },
    arrendatarios: {
      label: "2. Arrendatarios",
      badge: "Segundo",
      tipo: "ARRENDATARIOS",
      previewEndpoint: "/api/rent-roll/upload/arrendatarios/preview",
      applyEndpoint: "/api/rent-roll/upload/arrendatarios/apply",
      templateEndpoint: "/api/rent-roll/upload/arrendatarios/template",
      columns: [
        { key: "rut", label: "RUT" },
        { key: "razonSocial", label: "Razon social" },
        { key: "nombreComercial", label: "Nombre comercial" },
        { key: "vigente", label: "Vigente" },
        { key: "email", label: "Email" },
        { key: "telefono", label: "Telefono" }
      ],
      history: mapHistory(arrendatariosRaw)
    },
    contratos: {
      label: "3. Contratos",
      badge: "Tercero",
      tipo: "CONTRATOS",
      previewEndpoint: "/api/rent-roll/upload/contratos/preview",
      applyEndpoint: "/api/rent-roll/upload/contratos/apply",
      templateEndpoint: "/api/rent-roll/upload/contratos/template",
      columns: [
        { key: "numeroContrato", label: "Contrato" },
        { key: "localCodigo", label: "Local" },
        { key: "arrendatarioRut", label: "Arrendatario RUT" },
        { key: "estado", label: "Estado" },
        { key: "fechaInicio", label: "Inicio" },
        { key: "fechaTermino", label: "Termino" },
        { key: "tarifaTipo", label: "Tarifa tipo" },
        { key: "tarifaValor", label: "Tarifa valor" }
      ],
      history: mapHistory(contratosRaw)
    }
  };

  const activeConfig = tabConfig[activeTab];
  const canEdit = canWrite(session.user.role);

  return (
    <main className="space-y-4">
      <section className="rounded-md bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gold-400" />
              <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">
                Rent Roll: Carga Masiva
              </h2>
            </div>
            <p className="text-sm text-slate-600">
              Confirmacion primero: sube archivo, revisa cada fila y luego aplica.
            </p>
          </div>
          <ProjectSelector projects={projects} selectedProjectId={selectedProjectId} preserve={{ tab: activeTab }} />
        </div>
      </section>

      <section className="rounded-md border border-brand-200 bg-brand-50 p-4 text-sm text-brand-700 shadow-sm">
        Para cargar contratos por primera vez: sube Locales → Arrendatarios → Contratos en ese orden.
      </section>

      <section className="rounded-md bg-white p-3 shadow-sm">
        <nav className="flex flex-wrap gap-2">
          {validTabs.map((tab) => {
            const config = tabConfig[tab];
            const isActive = tab === activeTab;
            return (
              <a
                key={tab}
                href={`/rent-roll/upload?proyecto=${selectedProjectId}&tab=${tab}`}
                className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                  isActive ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {config.label}
              </a>
            );
          })}
        </nav>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-700">{activeConfig.label}</h3>
          <span className="rounded-md bg-gold-100 px-2 py-1 text-xs font-semibold text-amber-800">
            {activeConfig.badge}
          </span>
        </div>

        <UploadSection
          tipo={activeConfig.tipo}
          proyectoId={selectedProjectId}
          canEdit={canEdit}
          previewEndpoint={activeConfig.previewEndpoint}
          applyEndpoint={activeConfig.applyEndpoint}
          templateEndpoint={activeConfig.templateEndpoint}
          columns={activeConfig.columns}
        />

        <CargaHistorial items={activeConfig.history} />
      </section>
    </main>
  );
}
