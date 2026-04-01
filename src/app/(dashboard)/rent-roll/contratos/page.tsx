import Link from "next/link";
import { TipoCargaDatos } from "@prisma/client";
import { redirect } from "next/navigation";
import { ContractManager } from "@/components/contracts/ContractManager";
import { RentRollEntityModeNav } from "@/components/rent-roll/RentRollEntityModeNav";
import { CargaHistorial } from "@/components/upload/CargaHistorial";
import { UploadSection } from "@/components/upload/UploadSection";
import { Badge } from "@/components/ui/badge";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { ProjectSelector } from "@/components/ui/ProjectSelector";
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
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";
import { getUploadHistory } from "@/lib/rent-roll/upload-history";
import { cn, formatDate } from "@/lib/utils";

type ContratosPageProps = {
  searchParams: {
    proyecto?: string | string[];
    seccion?: string | string[];
    cursor?: string | string[];
    detalle?: string | string[];
  };
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

function getSingleValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value[0];
  }
  return undefined;
}

export default async function ContratosPage({
  searchParams
}: ContratosPageProps): Promise<JSX.Element> {
  const session = await requireSession();
  const proyectoParam = getSingleValue(searchParams.proyecto);
  const seccionParam = getSingleValue(searchParams.seccion);
  const cursor = getSingleValue(searchParams.cursor);
  const detalleId = getSingleValue(searchParams.detalle);
  const { projects, selectedProjectId } = await getProjectContext(proyectoParam);
  const canEdit = canWrite(session.user.role);

  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Contratos"
        description="No hay proyectos activos. Crea uno para habilitar el CRUD de contratos."
        canEdit={canEdit}
      />
    );
  }

  if (!proyectoParam) {
    redirect(`/rent-roll/contratos?proyecto=${selectedProjectId}`);
  }
  const mode = resolveMode(seccionParam);

  const [locals, arrendatarios, contracts] = await Promise.all([
    prisma.local.findMany({
      where: { proyectoId: selectedProjectId },
      orderBy: { codigo: "asc" },
      select: { id: true, codigo: true, nombre: true }
    }),
    prisma.arrendatario.findMany({
      where: { proyectoId: selectedProjectId },
      orderBy: { nombreComercial: "asc" },
      select: { id: true, nombreComercial: true }
    }),
    prisma.contrato.findMany({
      where: { proyectoId: selectedProjectId },
      include: {
        local: { select: { id: true, codigo: true, nombre: true } },
        locales: {
          include: {
            local: { select: { id: true, codigo: true, nombre: true } }
          },
          orderBy: { createdAt: "asc" }
        },
        arrendatario: { select: { id: true, nombreComercial: true, razonSocial: true } },
        tarifas: {
          orderBy: { vigenciaDesde: "desc" },
          take: 10,
          select: {
            tipo: true,
            valor: true,
            vigenciaDesde: true,
            vigenciaHasta: true,
            esDiciembre: true
          }
        },
        ggcc: {
          orderBy: { vigenciaDesde: "desc" },
          take: 10,
          select: {
            tarifaBaseUfM2: true,
            pctAdministracion: true,
            vigenciaDesde: true,
            vigenciaHasta: true,
            proximoReajuste: true
          }
        }
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 50,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0
    })
  ]);
  const nextCursor = contracts.length === 50 ? contracts[contracts.length - 1]?.id : undefined;

  const uploadHistory =
    mode === "upload" ? await getUploadHistory(selectedProjectId, TipoCargaDatos.RENT_ROLL) : [];

  const buildDetailHref = (id: string | null): string => {
    const params = new URLSearchParams();
    params.set("proyecto", selectedProjectId);
    params.set("seccion", mode);
    if (cursor) {
      params.set("cursor", cursor);
    }
    if (id) {
      params.set("detalle", id);
    }
    return `/rent-roll/contratos?${params.toString()}`;
  };

  return (
    <main className="space-y-4">
      <section className="rounded-md bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gold-400" />
              <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">
                {mode === "ver"
                  ? "Contratos: Vista"
                  : mode === "cargar"
                    ? "Contratos: Carga"
                    : "Contratos: Carga Masiva"}
              </h2>
            </div>
            <p className="text-sm text-slate-600">
              {mode === "ver"
                ? "Consulta contratos y su vigencia del proyecto seleccionado."
                : mode === "cargar"
                  ? "Crea y actualiza contratos, tarifas, GGCC y anexos."
                  : "Sube archivo, valida el preview y aplica los cambios en lote."}
            </p>
          </div>
          <ProjectSelector
            projects={projects}
            selectedProjectId={selectedProjectId}
            preserve={{ seccion: mode }}
          />
        </div>
      </section>

      <RentRollEntityModeNav entity="contratos" mode={mode} proyectoId={selectedProjectId} />

      {mode === "ver" ? (
        <>
          <section className="overflow-hidden rounded-md bg-white shadow-sm">
            <Table className="min-w-full divide-y divide-slate-200">
            <TableHeader className="bg-brand-700">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                    N&deg; contrato
                </TableHead>
                <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                    Locales
                </TableHead>
                <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                    Arrendatario
                </TableHead>
                <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                    Estado
                </TableHead>
                <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                    Inicio
                </TableHead>
                <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                    Termino
                </TableHead>
                <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                    PDF
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-sm">
                {contracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="px-4 py-6 text-center text-slate-500">
                      Aun no hay contratos en este proyecto.
                    </TableCell>
                  </TableRow>
                ) : (
                  contracts.map((contract, index) => {
                    const isExpanded = detalleId === contract.id;
                    const rowHref = buildDetailHref(isExpanded ? null : contract.id);
                    const localesAsociados = (contract.locales.length > 0
                      ? contract.locales.map((item) => item.local)
                      : [contract.local]
                    )
                      .map((local) => local.codigo)
                      .join(", ");

                    return [
                      <TableRow
                        key={contract.id}
                        className={cn(
                          "text-slate-800 transition-colors hover:bg-brand-50",
                          index % 2 === 0 ? "bg-white" : "bg-slate-50/60",
                          isExpanded ? "bg-brand-50" : null
                        )}
                      >
                        <TableCell className="p-0 whitespace-nowrap font-medium">
                          <Link
                            href={rowHref}
                            className="block px-4 py-3 text-brand-700"
                            aria-expanded={isExpanded}
                          >
                            {contract.numeroContrato}
                          </Link>
                        </TableCell>
                        <TableCell className="p-0">
                          <Link href={rowHref} className="block px-4 py-3 text-brand-700">
                            {localesAsociados}
                          </Link>
                        </TableCell>
                        <TableCell className="p-0 whitespace-nowrap">
                          <Link href={rowHref} className="block px-4 py-3 text-brand-700">
                            {contract.arrendatario.nombreComercial}
                          </Link>
                        </TableCell>
                        <TableCell className="p-0 whitespace-nowrap">
                          <Link href={rowHref} className="block px-4 py-3">
                            <Badge
                              variant="outline"
                              className="rounded-full border-brand-200 bg-brand-100 text-brand-700"
                            >
                              {contract.estado}
                            </Badge>
                          </Link>
                        </TableCell>
                        <TableCell className="p-0 whitespace-nowrap">
                          <Link href={rowHref} className="block px-4 py-3 text-brand-700">
                            {formatDate(contract.fechaInicio)}
                          </Link>
                        </TableCell>
                        <TableCell className="p-0 whitespace-nowrap">
                          <Link href={rowHref} className="block px-4 py-3 text-brand-700">
                            {formatDate(contract.fechaTermino)}
                          </Link>
                        </TableCell>
                        <TableCell className="p-0 whitespace-nowrap">
                          <Link href={rowHref} className="block px-4 py-3 text-brand-700">
                            {contract.pdfUrl ? "Disponible" : "Sin PDF"}
                          </Link>
                        </TableCell>
                      </TableRow>,
                      isExpanded ? (
                        <TableRow key={`${contract.id}-detalle`} className="bg-brand-50/70">
                          <TableCell colSpan={7} className="px-4 py-4">
                            <div className="grid gap-2 text-sm md:grid-cols-2">
                              <p>
                                <span className="font-semibold text-slate-700">Arrendatario:</span>{" "}
                                {contract.arrendatario.nombreComercial}
                              </p>
                              <p>
                                <span className="font-semibold text-slate-700">Estado:</span>{" "}
                                {contract.estado}
                              </p>
                              <p className="md:col-span-2">
                                <span className="font-semibold text-slate-700">Locales asociados:</span>{" "}
                                {localesAsociados}
                              </p>
                              <p>
                                <span className="font-semibold text-slate-700">Fecha inicio:</span>{" "}
                                {formatDate(contract.fechaInicio)}
                              </p>
                              <p>
                                <span className="font-semibold text-slate-700">Fecha termino:</span>{" "}
                                {formatDate(contract.fechaTermino)}
                              </p>
                              <p className="md:col-span-2">
                                <span className="font-semibold text-slate-700">PDF:</span>{" "}
                                {contract.pdfUrl ? (
                                  <a
                                    href={contract.pdfUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-medium text-brand-700 underline"
                                  >
                                    Ver PDF
                                  </a>
                                ) : (
                                  <span className="text-slate-500">Sin PDF</span>
                                )}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null
                    ];
                  })
                )}
            </TableBody>
            </Table>
          </section>
        </>
      ) : mode === "cargar" ? (
        <ContractManager
          proyectoId={selectedProjectId}
          canEdit={canEdit}
          locals={locals.map((local) => ({ id: local.id, label: local.codigo }))}
          arrendatarios={arrendatarios.map((a) => ({ id: a.id, label: a.nombreComercial }))}
          nextCursor={nextCursor}
          contracts={contracts.map((contract) => ({
            id: contract.id,
            numeroContrato: contract.numeroContrato,
            estado: contract.estado,
            pdfUrl: contract.pdfUrl,
            fechaInicio: contract.fechaInicio.toISOString(),
            fechaTermino: contract.fechaTermino.toISOString(),
            local: contract.local,
            locales:
              contract.locales.length > 0
                ? contract.locales.map((item) => item.local)
                : [contract.local],
            arrendatario: contract.arrendatario,
            tarifas: contract.tarifas.map((tarifa) => ({
              tipo: tarifa.tipo,
              valor: tarifa.valor.toString(),
              vigenciaDesde: tarifa.vigenciaDesde.toISOString().slice(0, 10),
              vigenciaHasta: tarifa.vigenciaHasta ? tarifa.vigenciaHasta.toISOString().slice(0, 10) : null,
              esDiciembre: tarifa.esDiciembre
            })),
            ggcc: contract.ggcc.map((item) => ({
              tarifaBaseUfM2: item.tarifaBaseUfM2.toString(),
              pctAdministracion: item.pctAdministracion.toString(),
              vigenciaDesde: item.vigenciaDesde.toISOString().slice(0, 10),
              vigenciaHasta: item.vigenciaHasta ? item.vigenciaHasta.toISOString().slice(0, 10) : null,
              proximoReajuste: item.proximoReajuste
                ? item.proximoReajuste.toISOString().slice(0, 10)
                : null
            }))
          }))}
        />
      ) : (
        <>
          <section className="rounded-md border border-brand-200 bg-brand-50 p-4 text-sm text-brand-700 shadow-sm">
            Para cargar contratos por primera vez: sube Locales -&gt; Arrendatarios -&gt; Contratos en ese
            orden.
          </section>
          <UploadSection
            tipo="CONTRATOS"
            proyectoId={selectedProjectId}
            canEdit={canEdit}
            previewEndpoint="/api/rent-roll/upload/contratos/preview"
            applyEndpoint="/api/rent-roll/upload/contratos/apply"
            templateEndpoint="/api/rent-roll/upload/contratos/template"
            columns={[
              { key: "numeroContrato", label: "Contrato" },
              { key: "localCodigo", label: "Local" },
              { key: "arrendatarioRut", label: "Arrendatario RUT" },
              { key: "estado", label: "Estado" },
              { key: "fechaInicio", label: "Inicio" },
              { key: "fechaTermino", label: "Termino" },
              { key: "tarifaTipo", label: "Tarifa tipo" },
              { key: "tarifaValor", label: "Tarifa valor" }
            ]}
          />
          <CargaHistorial items={uploadHistory} />
        </>
      )}
    </main>
  );
}
