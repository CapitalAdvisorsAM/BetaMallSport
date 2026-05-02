import Link from "next/link";
import { DataUploadType } from "@prisma/client";
import { redirect } from "next/navigation";
import { UnitsViewTable } from "@/components/plan/UnitsViewTable";
import { RentRollEntityModeNav } from "@/components/plan/RentRollEntityModeNav";
import { UnitsCrudPanel } from "@/components/plan/UnitsCrudPanel";
import { ZonesConfigPanel } from "@/components/plan/ZonesConfigPanel";
import { UploadHistory } from "@/components/upload/UploadHistory";
import { UploadSection } from "@/components/upload/UploadSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UnifiedTable } from "@/components/ui/UnifiedTable";
import { getStripedRowClass, tableTheme } from "@/components/ui/table-theme";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import type { RentRollMode } from "@/lib/navigation";
import { buildExportExcelUrl } from "@/lib/export/shared";
import { canWrite, requireSession } from "@/lib/permissions";
import { buildUnitsWhere, parseUnitsStatus } from "@/lib/plan/units";
import { getUploadHistory } from "@/lib/plan/upload-history";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";
import { DEFAULT_COMMERCIAL_SIZE_RULES } from "@/lib/units/size";
import { formatDecimal } from "@/lib/utils";

type UnitsPageProps = {
  searchParams: {
    q?: string;
    estado?: string;
    seccion?: string;
    page?: string;
    detalle?: string;
  };
};

const PAGE_SIZE = 50;

type UnitsCrudRow = {
  id: string;
  projectId: string;
  codigo: string;
  nombre: string;
  glam2: import("@prisma/client").Prisma.Decimal;
  piso: string;
  tipo: import("@prisma/client").UnitType;
  zonaId: string | null;
  esGLA: boolean;
  estado: import("@prisma/client").MasterStatus;
};

function resolveMode(value: string | undefined): RentRollMode {
  if (value === "cargar") {
    return "cargar";
  }
  if (value === "upload") {
    return "upload";
  }
  if (value === "config") {
    return "config";
  }
  return "ver";
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function UnitsPage({
  searchParams
}: UnitsPageProps): Promise<JSX.Element> {
  const session = await requireSession();

  const { selectedProjectId } = await getProjectContext();
  if (!selectedProjectId) {
    redirect("/");
  }

  const q = searchParams.q?.trim() ?? "";
  const estado = parseUnitsStatus(searchParams.estado);
  const estadoValue = estado ?? "all";
  const mode = resolveMode(searchParams.seccion);
  const currentPage = parsePage(searchParams.page);
  const canEdit = canWrite(session.user.role);
  const unitsWhere = buildUnitsWhere(selectedProjectId, { q, estado });


  let units: Array<{
    id: string;
    codigo: string;
    nombre: string;
    tipo: import("@prisma/client").UnitType;
    piso: string;
    zonaId: string | null;
    glam2: import("@prisma/client").Prisma.Decimal;
    esGLA: boolean;
    estado: import("@prisma/client").MasterStatus;
  }> = [];
  let totalUnits = 0;
  let unitsCrud: UnitsCrudRow[] = [];

  const zones = await prisma.zone.findMany({
    where: { projectId: selectedProjectId },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true }
  });

  if (mode === "ver") {
    [units, totalUnits] = await Promise.all([
      prisma.unit.findMany({
        where: unitsWhere,
        orderBy: [{ piso: "asc" }, { codigo: "asc" }],
        skip: (currentPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          codigo: true,
          nombre: true,
          tipo: true,
          piso: true,
          zonaId: true,
          glam2: true,
          esGLA: true,
          estado: true
        }
      }),
      prisma.unit.count({ where: unitsWhere })
    ]);
  } else if (mode === "cargar") {
    unitsCrud = await prisma.unit.findMany({
      where: { projectId: selectedProjectId },
      orderBy: [{ codigo: "asc" }],
      select: {
        id: true,
        projectId: true,
        codigo: true,
        nombre: true,
        glam2: true,
        piso: true,
        tipo: true,
        zonaId: true,
        esGLA: true,
        estado: true
      }
    });
  }

  const uploadHistory =
    mode === "upload" ? await getUploadHistory(selectedProjectId, DataUploadType.UNITS) : [];
  const totalPages = Math.max(1, Math.ceil(totalUnits / PAGE_SIZE));
  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  const buildPageHref = (page: number): string => {
    const params = new URLSearchParams();
    params.set("seccion", "ver");
    if (q) {
      params.set("q", q);
    }
    if (estado) {
      params.set("estado", estado);
    }
    params.set("page", String(page));
    return `/plan/units?${params.toString()}`;
  };

  const filteredExportHref = buildExportExcelUrl({
    dataset: "locales",
    scope: "filtered",
    projectId: selectedProjectId,
    q: q || undefined,
    estado: estado ?? undefined
  });
  const allExportHref = buildExportExcelUrl({
    dataset: "locales",
    scope: "all",
    projectId: selectedProjectId
  });

  return (
    <main className="space-y-4">
      <section className="rounded-md bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gold-400" />
              <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">
                {mode === "ver"
                  ? "Locales: Vista"
                  : mode === "cargar"
                    ? "Locales: Carga"
                    : "Locales: Carga Masiva"}
              </h2>
            </div>
            <p className="text-sm text-slate-600">
              {mode === "ver"
                ? "Listado de locales del proyecto seleccionado."
                : mode === "cargar"
                  ? "Alta y mantenimiento manual de locales."
                  : "Sube archivo, valida el preview y aplica los cambios en lote."}
            </p>
          </div>
        </div>
      </section>

      <RentRollEntityModeNav entity="units" mode={mode} projectId={selectedProjectId} showConfigTab />

      {mode === "ver" ? (
        <>
          <section className="rounded-md bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800">Exportar locales</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild type="button" variant="outline" size="sm">
                  <Link href={filteredExportHref}>Descargar filtrado</Link>
                </Button>
                <Button asChild type="button" size="sm">
                  <Link href={allExportHref}>Descargar todo</Link>
                </Button>
              </div>
            </div>
          </section>

          <section className="rounded-md bg-white p-4 shadow-sm">
            <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
              <input type="hidden" name="seccion" value="ver" />
              <input type="hidden" name="page" value="1" />
              <Input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Buscar por codigo o nombre"
                className="w-full"
              />
              <Select
                name="estado"
                defaultValue={estadoValue}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="ACTIVO">ACTIVO</SelectItem>
                    <SelectItem value="INACTIVO">INACTIVO</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button
                type="submit"
                className="rounded-full"
              >
                Filtrar
              </Button>
            </form>
          </section>

          <section className="rounded-md bg-white shadow-sm">
            <UnitsViewTable
              projectId={selectedProjectId}
              rows={units.map((unit) => ({
                id: unit.id,
                codigo: unit.codigo,
                tipo: unit.tipo,
                piso: unit.piso,
                zona: zones.find((z) => z.id === unit.zonaId)?.nombre ?? null,
                glam2: unit.glam2.toString(),
                esGLA: unit.esGLA,
                estado: unit.estado
              }))}
            />
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
              <span>
                Pagina {currentPage} de {totalPages} ({totalUnits} locales)
              </span>
              <div className="flex items-center gap-2">
                {currentPage <= 1 ? (
                  <Button type="button" variant="outline" size="sm" disabled>
                    Anterior
                  </Button>
                ) : (
                  <Button asChild type="button" variant="outline" size="sm">
                    <Link href={buildPageHref(prevPage)}>Anterior</Link>
                  </Button>
                )}
                {currentPage >= totalPages ? (
                  <Button type="button" variant="outline" size="sm" disabled>
                    Siguiente
                  </Button>
                ) : (
                  <Button asChild type="button" variant="outline" size="sm">
                    <Link href={buildPageHref(nextPage)}>Siguiente</Link>
                  </Button>
                )}
              </div>
            </div>
          </section>
        </>
      ) : mode === "cargar" ? (
        <UnitsCrudPanel
          projectId={selectedProjectId}
          canEdit={canEdit}
          zones={zones}
          initialLocales={unitsCrud.map((unit) => ({
            id: unit.id,
            proyectoId: unit.projectId,
            codigo: unit.codigo,
            nombre: unit.nombre,
            glam2: unit.glam2.toString(),
            piso: unit.piso,
            tipo: unit.tipo,
            zonaId: unit.zonaId,
            esGLA: unit.esGLA,
            estado: unit.estado
          }))}
        />
      ) : mode === "upload" ? (
        <>
          <section className="rounded-md border border-brand-200 bg-brand-50 p-4 text-sm text-brand-700 shadow-sm">
            Para cargar contratos por primera vez: sube Locales -&gt; Arrendatarios -&gt; Contratos en ese
            orden.
          </section>
          <UploadSection
            tipo="LOCALES"
            proyectoId={selectedProjectId}
            canEdit={canEdit}
            previewEndpoint="/api/plan/upload/units/preview"
            applyEndpoint="/api/plan/upload/units/apply"
            templateEndpoint="/api/plan/upload/units/template"
            columns={[
              { key: "codigo", label: "Codigo" },
              { key: "nombre", label: "Nombre" },
              { key: "glam2", label: "GLA m2" },
              { key: "piso", label: "Piso" },
              { key: "tipo", label: "Tipo" },
              { key: "estado", label: "Estado" }
            ]}
          />
          <UploadHistory items={uploadHistory} />
        </>
      ) : mode === "config" ? (
        <>
        <ZonesConfigPanel
          projectId={selectedProjectId}
          canEdit={canEdit}
          initialZones={zones.map((z) => ({ id: z.id, proyectoId: selectedProjectId, nombre: z.nombre }))}
        />
        <UnifiedTable
          className="shadow-sm"
          toolbar={
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Tabla de tamaño por local</h3>
              <p className="mt-0.5 text-xs text-slate-600">
                Bodega, Módulo y Espacio respetan el tipo del local. El resto se calcula por metros cuadrados.
              </p>
            </div>
          }
        >
          <table className={tableTheme.table}>
            <thead className={tableTheme.head}>
              <tr className="text-left">
                <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">Categoría</th>
                <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">Regla aplicada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {DEFAULT_COMMERCIAL_SIZE_RULES.map((rule, index) => (
                <tr key={rule.key} className={`${getStripedRowClass(index)} ${tableTheme.rowHover}`}>
                  <td className="px-5 py-3 font-medium text-slate-800">{rule.label}</td>
                  <td className="px-5 py-3 text-slate-600">
                    {rule.max === null
                      ? `${formatDecimal(rule.min)} m2 o más`
                      : `${formatDecimal(rule.min)} a ${formatDecimal(rule.max)} m2`}
                  </td>
                </tr>
              ))}
              {[
                { label: "Bodega", description: "Se asigna cuando el tipo del local es BODEGA." },
                { label: "Módulo", description: "Se asigna cuando el tipo del local es MODULO." },
                { label: "Espacio", description: "Se asigna cuando el tipo del local es ESPACIO." }
              ].map((item, index) => (
                <tr
                  key={item.label}
                  className={`${getStripedRowClass(DEFAULT_COMMERCIAL_SIZE_RULES.length + index)} ${tableTheme.rowHover}`}
                >
                  <td className="px-5 py-3 font-medium text-slate-800">{item.label}</td>
                  <td className="px-5 py-3 text-brand-700">{item.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </UnifiedTable>
        </>
      ) : null}
    </main>
  );
}




