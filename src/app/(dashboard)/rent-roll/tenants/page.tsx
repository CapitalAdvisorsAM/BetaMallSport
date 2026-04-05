import Link from "next/link";
import { TipoCargaDatos } from "@prisma/client";
import { redirect } from "next/navigation";
import { TenantsCrudPanel } from "@/components/rent-roll/TenantsCrudPanel";
import { TenantsViewTable } from "@/components/rent-roll/TenantsViewTable";
import { RentRollEntityModeNav } from "@/components/rent-roll/RentRollEntityModeNav";
import { CargaHistorial } from "@/components/upload/CargaHistorial";
import { UploadSection } from "@/components/upload/UploadSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { ProjectSelector } from "@/components/ui/ProjectSelector";
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
import {
  buildTenantsActiveContractWhere,
  buildTenantsWhere,
  parseTenantActiveFilter
} from "@/lib/rent-roll/tenants";
import { getUploadHistory } from "@/lib/rent-roll/upload-history";
import { prisma } from "@/lib/prisma";
import { getProjectContext, resolveProjectIdFromSearchParams } from "@/lib/project";

type TenantsPageProps = {
  searchParams: {
    project?: string;
    proyecto?: string;
    q?: string;
    vigente?: string;
    seccion?: string;
    page?: string;
    detalle?: string;
  };
};

const PAGE_SIZE = 50;

function resolveMode(value: string | undefined): RentRollMode {
  if (value === "cargar") {
    return "cargar";
  }
  if (value === "upload") {
    return "upload";
  }
  return "ver";
}

function getMonthBounds(date: Date): { start: Date; nextMonthStart: Date } {
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();

  return {
    start: new Date(Date.UTC(year, monthIndex, 1)),
    nextMonthStart: new Date(Date.UTC(year, monthIndex + 1, 1))
  };
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function TenantsPage({
  searchParams
}: TenantsPageProps): Promise<JSX.Element> {
  const session = await requireSession();
  const projectParam = resolveProjectIdFromSearchParams(searchParams);

  const { projects, selectedProjectId } = await getProjectContext(projectParam);
  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Arrendatarios"
        description="No hay proyectos activos. Crea uno para habilitar el CRUD de arrendatarios."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  if (!projectParam) {
    redirect(`/rent-roll/tenants?project=${selectedProjectId}&proyecto=${selectedProjectId}`);
  }

  const q = searchParams.q?.trim() ?? "";
  const detalleId = searchParams.detalle?.trim() ?? "";
  const vigente = parseTenantActiveFilter(searchParams.vigente);
  const vigenteValue =
    searchParams.vigente === "vigente" || searchParams.vigente === "no-vigente"
      ? searchParams.vigente
      : "all";
  const mode = resolveMode(searchParams.seccion);
  const currentPage = parsePage(searchParams.page);
  const canEdit = canWrite(session.user.role);
  const today = new Date();
  const { start, nextMonthStart } = getMonthBounds(today);
  const activeContractWhere = buildTenantsActiveContractWhere({ start, nextMonthStart });
  const tenantsWhere = buildTenantsWhere(
    selectedProjectId,
    { start, nextMonthStart },
    { q, vigente }
  );

  let tenantsList: Array<{
    id: string;
    rut: string;
    nombreComercial: string;
    vigente: boolean;
    _count: {
      contratos: number;
    };
    contratos: Array<{
      id: string;
      numeroContrato: string;
    }>;
  }> = [];
  let totalTenants = 0;
  let tenantsCrud: Array<{
    id: string;
    proyectoId: string;
    rut: string;
    razonSocial: string;
    nombreComercial: string;
    vigente: boolean;
    email: string | null;
    telefono: string | null;
  }> = [];

  if (mode === "ver") {
    [tenantsList, totalTenants] = await Promise.all([
      prisma.tenant.findMany({
        where: tenantsWhere,
        include: {
          _count: {
            select: {
              contratos: true
            }
          },
          contratos: {
            where: activeContractWhere,
            orderBy: { fechaInicio: "desc" },
            select: {
              id: true,
              numeroContrato: true
            }
          }
        },
        orderBy: { nombreComercial: "asc" },
        skip: (currentPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE
      }),
      prisma.tenant.count({ where: tenantsWhere })
    ]);
  } else if (mode === "cargar") {
    tenantsCrud = await prisma.tenant.findMany({
      where: { proyectoId: selectedProjectId },
      orderBy: { nombreComercial: "asc" }
    });
  }

  const uploadHistory =
    mode === "upload" ? await getUploadHistory(selectedProjectId, TipoCargaDatos.ARRENDATARIOS) : [];
  const totalPages = Math.max(1, Math.ceil(totalTenants / PAGE_SIZE));
  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  const buildPageHref = (page: number): string => {
    const params = new URLSearchParams();
    params.set("project", selectedProjectId);
    params.set("proyecto", selectedProjectId);
    params.set("seccion", "ver");
    if (q) {
      params.set("q", q);
    }
    if (searchParams.vigente === "vigente" || searchParams.vigente === "no-vigente") {
      params.set("vigente", searchParams.vigente);
    }
    params.set("page", String(page));
    return `/rent-roll/tenants?${params.toString()}`;
  };

  const buildDetailHref = (id: string | null): string => {
    const params = new URLSearchParams();
    params.set("project", selectedProjectId);
    params.set("proyecto", selectedProjectId);
    params.set("seccion", "ver");
    if (q) {
      params.set("q", q);
    }
    if (searchParams.vigente === "vigente" || searchParams.vigente === "no-vigente") {
      params.set("vigente", searchParams.vigente);
    }
    params.set("page", String(currentPage));
    if (id) {
      params.set("detalle", id);
    }
    return `/rent-roll/tenants?${params.toString()}`;
  };

  const selectedTenant =
    mode === "ver" && detalleId
      ? await prisma.tenant.findFirst({
          where: { id: detalleId, proyectoId: selectedProjectId },
          include: {
            _count: { select: { contratos: true } },
            contratos: {
              orderBy: { fechaInicio: "desc" },
              take: 10,
              select: { id: true, numeroContrato: true }
            }
          }
        })
      : null;

  const filteredExportHref = buildExportExcelUrl({
    dataset: "arrendatarios",
    scope: "filtered",
    proyectoId: selectedProjectId,
    q: q || undefined,
    vigente: searchParams.vigente === "vigente" || searchParams.vigente === "no-vigente"
      ? searchParams.vigente
      : undefined
  });
  const allExportHref = buildExportExcelUrl({
    dataset: "arrendatarios",
    scope: "all",
    proyectoId: selectedProjectId
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
                  ? "Arrendatarios: Vista"
                  : mode === "cargar"
                    ? "Arrendatarios: Carga"
                    : "Arrendatarios: Carga Masiva"}
              </h2>
            </div>
            <p className="text-sm text-slate-600">
              {mode === "ver"
                ? "Arrendatarios con contratos en estado OCUPADO o GRACIA del periodo actual. La informacion de local, fechas y tarifas se administra en Contratos."
                : mode === "cargar"
                  ? "Alta y mantenimiento manual de arrendatarios."
                  : "Sube archivo, valida el preview y aplica los cambios en lote."}
            </p>
          </div>
          <ProjectSelector
            projects={projects}
            selectedProjectId={selectedProjectId}
            preserve={{ seccion: mode, q, vigente: searchParams.vigente ?? "", page: String(currentPage) }}
          />
        </div>
      </section>

      <RentRollEntityModeNav entity="tenants" mode={mode} projectId={selectedProjectId} />

      {mode === "ver" ? (
        <>
          <section className="rounded-md bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800">Exportar arrendatarios</p>
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

          {selectedTenant ? (
            <section className="space-y-3 rounded-md border border-brand-200 bg-brand-50 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-brand-700">
                  Detalle arrendatario {selectedTenant.nombreComercial}
                </h3>
                <Button asChild type="button" variant="outline" size="sm">
                  <Link href={buildDetailHref(null)}>Cerrar detalle</Link>
                </Button>
              </div>
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <p>
                  <span className="font-semibold text-slate-700">RUT:</span> {selectedTenant.rut}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Vigente:</span>{" "}
                  {selectedTenant.vigente ? "Si" : "No"}
                </p>
                <p className="md:col-span-2">
                  <span className="font-semibold text-slate-700">Razon social:</span>{" "}
                  {selectedTenant.razonSocial}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Email:</span>{" "}
                  {selectedTenant.email ?? "-"}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Telefono:</span>{" "}
                  {selectedTenant.telefono ?? "-"}
                </p>
                <p className="md:col-span-2">
                  <span className="font-semibold text-slate-700">Contratos:</span>{" "}
                  {selectedTenant.contratos.length > 0
                    ? selectedTenant.contratos.map((item) => item.numeroContrato).join(", ")
                    : "-"}
                </p>
              </div>
            </section>
          ) : null}

          <section className="rounded-md bg-white p-4 shadow-sm">
            <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
              <input type="hidden" name="project" value={selectedProjectId} />
              <input type="hidden" name="proyecto" value={selectedProjectId} />
              <input type="hidden" name="seccion" value="ver" />
              <input type="hidden" name="page" value="1" />
              <Input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Buscar por nombre comercial o RUT"
                className="w-full"
              />
              <Select
                name="vigente"
                defaultValue={vigenteValue}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="vigente">Vigente</SelectItem>
                    <SelectItem value="no-vigente">No vigente</SelectItem>
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
            <TenantsViewTable
              rows={tenantsList.map((tenant) => {
                const contratosVigentes = tenant.contratos.map((contract) => contract.numeroContrato);
                return {
                  id: tenant.id,
                  rut: tenant.rut,
                  nombreComercial: tenant.nombreComercial,
                  vigente: tenant.vigente,
                  contratosAsociados: tenant._count.contratos,
                  contratosVigentes: contratosVigentes.length,
                  contratosVigentesNumeros: contratosVigentes.join(", ")
                };
              })}
              buildDetailHref={buildDetailHref}
            />
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
              <span>
                Pagina {currentPage} de {totalPages} ({totalTenants} arrendatarios)
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
        <TenantsCrudPanel
          projectId={selectedProjectId}
          canEdit={canEdit}
          initialArrendatarios={tenantsCrud.map((tenant) => ({
            id: tenant.id,
            proyectoId: tenant.proyectoId,
            rut: tenant.rut,
            razonSocial: tenant.razonSocial,
            nombreComercial: tenant.nombreComercial,
            vigente: tenant.vigente,
            email: tenant.email,
            telefono: tenant.telefono
          }))}
        />
      ) : (
        <>
          <section className="rounded-md border border-brand-200 bg-brand-50 p-4 text-sm text-brand-700 shadow-sm">
            Para cargar contratos por primera vez: sube Locales -&gt; Arrendatarios -&gt; Contratos en ese
            orden.
          </section>
          <UploadSection
            tipo="ARRENDATARIOS"
            proyectoId={selectedProjectId}
            canEdit={canEdit}
            previewEndpoint="/api/rent-roll/upload/arrendatarios/preview"
            applyEndpoint="/api/rent-roll/upload/arrendatarios/apply"
            templateEndpoint="/api/rent-roll/upload/arrendatarios/template"
            columns={[
              { key: "rut", label: "RUT" },
              { key: "razonSocial", label: "Razon social" },
              { key: "nombreComercial", label: "Nombre comercial" },
              { key: "vigente", label: "Vigente" },
              { key: "email", label: "Email" },
              { key: "telefono", label: "Telefono" }
            ]}
          />
          <CargaHistorial items={uploadHistory} />
        </>
      )}
    </main>
  );
}


