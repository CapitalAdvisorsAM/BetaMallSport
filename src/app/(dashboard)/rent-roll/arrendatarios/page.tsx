import Link from "next/link";
import { TipoCargaDatos } from "@prisma/client";
import { redirect } from "next/navigation";
import { ArrendatariosCrudPanel } from "@/components/rent-roll/ArrendatariosCrudPanel";
import { RentRollEntityModeNav } from "@/components/rent-roll/RentRollEntityModeNav";
import { CargaHistorial } from "@/components/upload/CargaHistorial";
import { UploadSection } from "@/components/upload/UploadSection";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import type { RentRollMode } from "@/lib/navigation";
import { canWrite, requireSession } from "@/lib/permissions";
import {
  buildArrendatariosActiveContractWhere,
  buildArrendatariosWhere,
  parseVigenteFilter
} from "@/lib/rent-roll/arrendatarios";
import { getUploadHistory } from "@/lib/rent-roll/upload-history";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";
import { cn } from "@/lib/utils";

type ArrendatariosPageProps = {
  searchParams: {
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

export default async function ArrendatariosPage({
  searchParams
}: ArrendatariosPageProps): Promise<JSX.Element> {
  const session = await requireSession();

  const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);
  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Arrendatarios"
        description="No hay proyectos activos. Crea uno para habilitar el CRUD de arrendatarios."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  if (!searchParams.proyecto) {
    redirect(`/rent-roll/arrendatarios?proyecto=${selectedProjectId}`);
  }

  const q = searchParams.q?.trim() ?? "";
  const detalleId = searchParams.detalle?.trim() ?? "";
  const vigente = parseVigenteFilter(searchParams.vigente);
  const vigenteValue =
    searchParams.vigente === "vigente" || searchParams.vigente === "no-vigente"
      ? searchParams.vigente
      : "all";
  const mode = resolveMode(searchParams.seccion);
  const currentPage = parsePage(searchParams.page);
  const canEdit = canWrite(session.user.role);
  const today = new Date();
  const { start, nextMonthStart } = getMonthBounds(today);
  const activeContractWhere = buildArrendatariosActiveContractWhere({ start, nextMonthStart });
  const arrendatariosWhere = buildArrendatariosWhere(
    selectedProjectId,
    { start, nextMonthStart },
    { q, vigente }
  );

  let arrendatariosList: Array<{
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
  let totalArrendatarios = 0;
  let arrendatariosCrud: Array<{
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
    [arrendatariosList, totalArrendatarios] = await Promise.all([
      prisma.arrendatario.findMany({
        where: arrendatariosWhere,
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
      prisma.arrendatario.count({ where: arrendatariosWhere })
    ]);
  } else if (mode === "cargar") {
    arrendatariosCrud = await prisma.arrendatario.findMany({
      where: { proyectoId: selectedProjectId },
      orderBy: { nombreComercial: "asc" }
    });
  }

  const uploadHistory =
    mode === "upload" ? await getUploadHistory(selectedProjectId, TipoCargaDatos.ARRENDATARIOS) : [];
  const totalPages = Math.max(1, Math.ceil(totalArrendatarios / PAGE_SIZE));
  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  const buildPageHref = (page: number): string => {
    const params = new URLSearchParams();
    params.set("proyecto", selectedProjectId);
    params.set("seccion", "ver");
    if (q) {
      params.set("q", q);
    }
    if (searchParams.vigente === "vigente" || searchParams.vigente === "no-vigente") {
      params.set("vigente", searchParams.vigente);
    }
    params.set("page", String(page));
    return `/rent-roll/arrendatarios?${params.toString()}`;
  };

  const buildDetailHref = (id: string | null): string => {
    const params = new URLSearchParams();
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
    return `/rent-roll/arrendatarios?${params.toString()}`;
  };

  const selectedArrendatario =
    mode === "ver" && detalleId
      ? await prisma.arrendatario.findFirst({
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

      <RentRollEntityModeNav entity="arrendatarios" mode={mode} proyectoId={selectedProjectId} />

      {mode === "ver" ? (
        <>
          {selectedArrendatario ? (
            <section className="space-y-3 rounded-md border border-brand-200 bg-brand-50 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-brand-700">
                  Detalle arrendatario {selectedArrendatario.nombreComercial}
                </h3>
                <Button asChild type="button" variant="outline" size="sm">
                  <Link href={buildDetailHref(null)}>Cerrar detalle</Link>
                </Button>
              </div>
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <p>
                  <span className="font-semibold text-slate-700">RUT:</span> {selectedArrendatario.rut}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Vigente:</span>{" "}
                  {selectedArrendatario.vigente ? "Si" : "No"}
                </p>
                <p className="md:col-span-2">
                  <span className="font-semibold text-slate-700">Razon social:</span>{" "}
                  {selectedArrendatario.razonSocial}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Email:</span>{" "}
                  {selectedArrendatario.email ?? "-"}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Telefono:</span>{" "}
                  {selectedArrendatario.telefono ?? "-"}
                </p>
                <p className="md:col-span-2">
                  <span className="font-semibold text-slate-700">Contratos:</span>{" "}
                  {selectedArrendatario.contratos.length > 0
                    ? selectedArrendatario.contratos.map((item) => item.numeroContrato).join(", ")
                    : "-"}
                </p>
              </div>
            </section>
          ) : null}

          <section className="rounded-md bg-white p-4 shadow-sm">
            <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
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

          <section className="overflow-hidden rounded-md bg-white shadow-sm">
            <Table className="min-w-full divide-y divide-slate-200">
              <TableHeader className="bg-brand-700">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                      Arrendatario
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                      RUT
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                      Vigente
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                      Contratos asociados
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                      Contratos vigentes (periodo)
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                      N&deg; contrato vigente
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-sm">
                  {arrendatariosList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="px-4 py-6 text-center text-slate-500">
                        No se encontraron arrendatarios con contratos activos para los filtros aplicados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    arrendatariosList.map((arrendatario, index) => {
                      const activeContractNumbers = arrendatario.contratos.map(
                        (contract) => contract.numeroContrato
                      );
                      return (
                        <TableRow
                          key={arrendatario.id}
                          className={cn(
                            "text-slate-800 transition-colors hover:bg-brand-50",
                            index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                          )}
                        >
                          <TableCell className="px-4 py-3 font-medium">
                            <Link href={buildDetailHref(arrendatario.id)} className="text-brand-700 underline">
                              {arrendatario.nombreComercial}
                            </Link>
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-4 py-3">{arrendatario.rut}</TableCell>
                          <TableCell className="whitespace-nowrap px-4 py-3">
                            <Badge
                              variant="outline"
                              className={`rounded-full ${
                                arrendatario.vigente
                                  ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                                  : "border-slate-200 bg-slate-100 text-slate-700"
                              }`}
                            >
                              {arrendatario.vigente ? "Si" : "No"}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-4 py-3">
                            {arrendatario._count.contratos}
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-4 py-3">
                            {activeContractNumbers.length}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            {activeContractNumbers.length > 0
                              ? activeContractNumbers.join(", ")
                              : "\u2014"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
              <span>
                Pagina {currentPage} de {totalPages} ({totalArrendatarios} arrendatarios)
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
        <ArrendatariosCrudPanel
          proyectoId={selectedProjectId}
          canEdit={canEdit}
          initialArrendatarios={arrendatariosCrud.map((arrendatario) => ({
            id: arrendatario.id,
            proyectoId: arrendatario.proyectoId,
            rut: arrendatario.rut,
            razonSocial: arrendatario.razonSocial,
            nombreComercial: arrendatario.nombreComercial,
            vigente: arrendatario.vigente,
            email: arrendatario.email,
            telefono: arrendatario.telefono
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
