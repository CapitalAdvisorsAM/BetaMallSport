import Link from "next/link";
import { TipoCargaDatos } from "@prisma/client";
import { redirect } from "next/navigation";
import { RentRollEntityModeNav } from "@/components/rent-roll/RentRollEntityModeNav";
import { LocalesCrudPanel } from "@/components/rent-roll/LocalesCrudPanel";
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
import { buildLocalesWhere, parseLocalesEstado } from "@/lib/rent-roll/locales";
import { getUploadHistory } from "@/lib/rent-roll/upload-history";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";
import { cn, formatDecimal } from "@/lib/utils";

type LocalesPageProps = {
  searchParams: {
    proyecto?: string;
    q?: string;
    estado?: string;
    seccion?: string;
    page?: string;
    detalle?: string;
  };
};

const PAGE_SIZE = 50;

type LocalesCrudRow = {
  id: string;
  proyectoId: string;
  codigo: string;
  nombre: string;
  glam2: import("@prisma/client").Prisma.Decimal;
  piso: string;
  tipo: import("@prisma/client").TipoLocal;
  zona: string | null;
  esGLA: boolean;
  estado: import("@prisma/client").EstadoMaestro;
};

function resolveMode(value: string | undefined): RentRollMode {
  if (value === "cargar") {
    return "cargar";
  }
  if (value === "upload") {
    return "upload";
  }
  return "ver";
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function LocalesPage({
  searchParams
}: LocalesPageProps): Promise<JSX.Element> {
  const session = await requireSession();

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
  const detalleId = searchParams.detalle?.trim() ?? "";
  const estado = parseLocalesEstado(searchParams.estado);
  const estadoValue = estado ?? "all";
  const mode = resolveMode(searchParams.seccion);
  const currentPage = parsePage(searchParams.page);
  const canEdit = canWrite(session.user.role);
  const localesWhere = buildLocalesWhere(selectedProjectId, { q, estado });

  let locales: Array<{
    id: string;
    codigo: string;
    nombre: string;
    tipo: import("@prisma/client").TipoLocal;
    piso: string;
    zona: string | null;
    glam2: import("@prisma/client").Prisma.Decimal;
    esGLA: boolean;
    estado: import("@prisma/client").EstadoMaestro;
  }> = [];
  let totalLocales = 0;
  let localesCrud: LocalesCrudRow[] = [];

  if (mode === "ver") {
    [locales, totalLocales] = await Promise.all([
      prisma.local.findMany({
        where: localesWhere,
        orderBy: [{ piso: "asc" }, { codigo: "asc" }],
        skip: (currentPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          codigo: true,
          nombre: true,
          tipo: true,
          piso: true,
          zona: true,
          glam2: true,
          esGLA: true,
          estado: true
        }
      }),
      prisma.local.count({ where: localesWhere })
    ]);
  } else if (mode === "cargar") {
    localesCrud = await prisma.local.findMany({
      where: { proyectoId: selectedProjectId },
      orderBy: [{ codigo: "asc" }],
      select: {
        id: true,
        proyectoId: true,
        codigo: true,
        nombre: true,
        glam2: true,
        piso: true,
        tipo: true,
        zona: true,
        esGLA: true,
        estado: true
      }
    });
  }

  const uploadHistory =
    mode === "upload" ? await getUploadHistory(selectedProjectId, TipoCargaDatos.LOCALES) : [];
  const totalPages = Math.max(1, Math.ceil(totalLocales / PAGE_SIZE));
  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  const buildPageHref = (page: number): string => {
    const params = new URLSearchParams();
    params.set("proyecto", selectedProjectId);
    params.set("seccion", "ver");
    if (q) {
      params.set("q", q);
    }
    if (estado) {
      params.set("estado", estado);
    }
    params.set("page", String(page));
    return `/rent-roll/locales?${params.toString()}`;
  };

  const buildDetailHref = (id: string | null): string => {
    const params = new URLSearchParams();
    params.set("proyecto", selectedProjectId);
    params.set("seccion", "ver");
    if (q) {
      params.set("q", q);
    }
    if (estado) {
      params.set("estado", estado);
    }
    params.set("page", String(currentPage));
    if (id) {
      params.set("detalle", id);
    }
    return `/rent-roll/locales?${params.toString()}`;
  };

  const selectedLocal =
    mode === "ver" && detalleId
      ? await prisma.local.findFirst({
          where: { id: detalleId, proyectoId: selectedProjectId },
          select: {
            id: true,
            codigo: true,
            nombre: true,
            tipo: true,
            piso: true,
            zona: true,
            glam2: true,
            esGLA: true,
            estado: true
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
          <ProjectSelector
            projects={projects}
            selectedProjectId={selectedProjectId}
            preserve={{ seccion: mode, q, estado: estado ?? "", page: String(currentPage) }}
          />
        </div>
      </section>

      <RentRollEntityModeNav entity="locales" mode={mode} proyectoId={selectedProjectId} />

      {mode === "ver" ? (
        <>
          {selectedLocal ? (
            <section className="space-y-3 rounded-md border border-brand-200 bg-brand-50 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-brand-700">
                  Detalle local {selectedLocal.codigo}
                </h3>
                <Button asChild type="button" variant="outline" size="sm">
                  <Link href={buildDetailHref(null)}>Cerrar detalle</Link>
                </Button>
              </div>
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <p>
                  <span className="font-semibold text-slate-700">Nombre:</span> {selectedLocal.nombre || "-"}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Tipo:</span> {selectedLocal.tipo}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Piso:</span> {selectedLocal.piso}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Zona:</span> {selectedLocal.zona ?? "-"}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">GLA m2:</span>{" "}
                  {formatDecimal(selectedLocal.glam2.toString())}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Estado:</span> {selectedLocal.estado}
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

          <section className="overflow-hidden rounded-md bg-white shadow-sm">
            <Table className="min-w-full divide-y divide-slate-200">
              <TableHeader className="bg-brand-700">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                      {"C\u00f3digo"}
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                      Tipo
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                      Piso
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                      Zona
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                      {"GLA m\u00b2"}
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                      Es GLA
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                      Estado
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-sm">
                  {locales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="px-4 py-6 text-center text-slate-500">
                        No se encontraron locales para los filtros aplicados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    locales.map((local, index) => (
                      <TableRow
                        key={local.id}
                        className={cn(
                          "text-slate-800 transition-colors hover:bg-brand-50",
                          index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                        )}
                      >
                        <TableCell className="whitespace-nowrap px-4 py-3 font-medium">
                          <Link href={buildDetailHref(local.id)} className="text-brand-700 underline">
                            {local.codigo}
                          </Link>
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-4 py-3">{local.tipo}</TableCell>
                        <TableCell className="whitespace-nowrap px-4 py-3">{local.piso}</TableCell>
                        <TableCell className="whitespace-nowrap px-4 py-3">{local.zona ?? "\u2014"}</TableCell>
                        <TableCell className="whitespace-nowrap px-4 py-3">
                          {formatDecimal(local.glam2.toString())}
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`rounded-full ${
                              local.esGLA
                                ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                                : "border-slate-200 bg-slate-100 text-slate-700"
                            }`}
                          >
                            {local.esGLA ? "S\u00ed" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`rounded-full ${
                              local.estado === "ACTIVO"
                                ? "border-brand-200 bg-brand-100 text-brand-700"
                                : "border-slate-300 bg-slate-200 text-slate-700"
                            }`}
                          >
                            {local.estado}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
              <span>
                Pagina {currentPage} de {totalPages} ({totalLocales} locales)
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
        <LocalesCrudPanel
          proyectoId={selectedProjectId}
          canEdit={canEdit}
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
      ) : (
        <>
          <section className="rounded-md border border-brand-200 bg-brand-50 p-4 text-sm text-brand-700 shadow-sm">
            Para cargar contratos por primera vez: sube Locales -&gt; Arrendatarios -&gt; Contratos en ese
            orden.
          </section>
          <UploadSection
            tipo="LOCALES"
            proyectoId={selectedProjectId}
            canEdit={canEdit}
            previewEndpoint="/api/rent-roll/upload/locales/preview"
            applyEndpoint="/api/rent-roll/upload/locales/apply"
            templateEndpoint="/api/rent-roll/upload/locales/template"
            columns={[
              { key: "codigo", label: "Codigo" },
              { key: "nombre", label: "Nombre" },
              { key: "glam2", label: "GLA m2" },
              { key: "piso", label: "Piso" },
              { key: "tipo", label: "Tipo" },
              { key: "estado", label: "Estado" }
            ]}
          />
          <CargaHistorial items={uploadHistory} />
        </>
      )}
    </main>
  );
}
