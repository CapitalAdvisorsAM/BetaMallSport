import Link from "next/link";
import { type Prisma, TipoCargaDatos } from "@prisma/client";
import { redirect } from "next/navigation";
import { ContractManager } from "@/components/contracts/ContractManager";
import { RentRollEntityModeNav } from "@/components/rent-roll/RentRollEntityModeNav";
import { CargaHistorial } from "@/components/upload/CargaHistorial";
import { UploadSection } from "@/components/upload/UploadSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { buildExportExcelUrl } from "@/lib/export/shared";
import { canWrite, requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getProjectContext, resolveProjectIdFromSearchParams } from "@/lib/project";
import { getUploadHistory } from "@/lib/rent-roll/upload-history";
import { cn, formatDate } from "@/lib/utils";

type ContractsPageProps = {
  searchParams: {
    project?: string | string[];
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

const contractQueryArgs = {
  include: {
    local: { select: { id: true, codigo: true, nombre: true } },
    locales: {
      include: {
        local: { select: { id: true, codigo: true, nombre: true } }
      },
      orderBy: { createdAt: "asc" as const }
    },
    arrendatario: { select: { id: true, nombreComercial: true, razonSocial: true } },
    tarifas: {
      orderBy: { vigenciaDesde: "desc" as const },
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
      orderBy: { vigenciaDesde: "desc" as const },
      take: 10,
      select: {
        tarifaBaseUfM2: true,
        pctAdministracion: true,
        pctReajuste: true,
        vigenciaDesde: true,
        vigenciaHasta: true,
        proximoReajuste: true,
        mesesReajuste: true
      }
    }
  }
} satisfies Prisma.ContractDefaultArgs;

type ContractRow = Prisma.ContractGetPayload<typeof contractQueryArgs>;

function getDecemberMultiplier(contract: ContractRow): string | null {
  const value = (contract as Record<string, unknown>)["multiplicadorDiciembre"];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "object" && value !== null && "toString" in value) {
    return (value as { toString: () => string }).toString();
  }
  return null;
}

export default async function ContractsPage({
  searchParams
}: ContractsPageProps): Promise<JSX.Element> {
  const session = await requireSession();
  const projectParam = resolveProjectIdFromSearchParams(searchParams);
  const seccionParam = getSingleValue(searchParams.seccion);
  const cursor = getSingleValue(searchParams.cursor);
  const detalleId = getSingleValue(searchParams.detalle);
  const { projects, selectedProjectId } = await getProjectContext(projectParam);
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

  if (!projectParam) {
    redirect(`/rent-roll/contracts?project=${selectedProjectId}&proyecto=${selectedProjectId}`);
  }
  const mode = resolveMode(seccionParam);

  const [units, tenants, contracts] = await Promise.all([
    prisma.unit.findMany({
      where: { proyectoId: selectedProjectId },
      orderBy: { codigo: "asc" },
      select: { id: true, codigo: true, nombre: true }
    }),
    prisma.tenant.findMany({
      where: { proyectoId: selectedProjectId },
      orderBy: { nombreComercial: "asc" },
      select: { id: true, nombreComercial: true }
    }),
    prisma.contract.findMany({
      where: { proyectoId: selectedProjectId },
      ...contractQueryArgs,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 50,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0
    }) as Promise<ContractRow[]>
  ]);
  const nextCursor = contracts.length === 50 ? contracts[contracts.length - 1]?.id : undefined;

  const uploadHistory =
    mode === "upload" ? await getUploadHistory(selectedProjectId, TipoCargaDatos.RENT_ROLL) : [];

  const filteredExportHref = buildExportExcelUrl({
    dataset: "contratos",
    scope: "filtered",
    proyectoId: selectedProjectId
  });
  const allExportHref = buildExportExcelUrl({
    dataset: "contratos",
    scope: "all",
    proyectoId: selectedProjectId
  });

  const buildDetailHref = (id: string | null): string => {
    const params = new URLSearchParams();
    params.set("project", selectedProjectId);
    params.set("proyecto", selectedProjectId);
    params.set("seccion", mode);
    if (cursor) {
      params.set("cursor", cursor);
    }
    if (id) {
      params.set("detalle", id);
    }
    return `/rent-roll/contracts?${params.toString()}`;
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

      <RentRollEntityModeNav entity="contracts" mode={mode} projectId={selectedProjectId} />

      {mode === "ver" ? (
        <>
          <section className="rounded-md bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800">Exportar contratos</p>
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
                    const multiplicadorDiciembre = getDecemberMultiplier(contract);
                    const localesAsociados = (contract.locales.length > 0
                      ? contract.locales.map((item) => item.local)
                      : [contract.local]
                    )
                      .map((unit) => unit.codigo)
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
                          <TableCell colSpan={7} className="px-4 py-5">
                            <div className="space-y-4 text-sm">

                              {/* ── Datos generales ── */}
                              <div className="grid gap-x-6 gap-y-2 md:grid-cols-2 lg:grid-cols-3">
                                <p>
                                  <span className="font-semibold text-slate-700">N° Contrato:</span>{" "}
                                  {contract.numeroContrato}
                                </p>
                                <p>
                                  <span className="font-semibold text-slate-700">Estado:</span>{" "}
                                  <span className="inline-flex rounded-full border border-brand-200 bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                                    {contract.estado}
                                  </span>
                                </p>
                                <p>
                                  <span className="font-semibold text-slate-700">Locales:</span>{" "}
                                  {localesAsociados}
                                </p>
                                <p>
                                  <span className="font-semibold text-slate-700">Arrendatario:</span>{" "}
                                  {contract.arrendatario.nombreComercial}
                                </p>
                                {contract.arrendatario.razonSocial && (
                                  <p>
                                    <span className="font-semibold text-slate-700">Razón social:</span>{" "}
                                    {contract.arrendatario.razonSocial}
                                  </p>
                                )}
                                <p>
                                  <span className="font-semibold text-slate-700">Fecha inicio:</span>{" "}
                                  {formatDate(contract.fechaInicio)}
                                </p>
                                <p>
                                  <span className="font-semibold text-slate-700">Fecha término:</span>{" "}
                                  {formatDate(contract.fechaTermino)}
                                </p>
                                {multiplicadorDiciembre && (
                                  <p>
                                    <span className="font-semibold text-slate-700">
                                      Multiplicador diciembre:
                                    </span>{" "}
                                    {multiplicadorDiciembre}
                                  </p>
                                )}
                                {contract.fechaEntrega && (
                                  <p>
                                    <span className="font-semibold text-slate-700">Fecha entrega:</span>{" "}
                                    {formatDate(contract.fechaEntrega)}
                                  </p>
                                )}
                                {contract.fechaApertura && (
                                  <p>
                                    <span className="font-semibold text-slate-700">Fecha apertura:</span>{" "}
                                    {formatDate(contract.fechaApertura)}
                                  </p>
                                )}
                                <p>
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

                              {/* ── Tarifas ── */}
                              {contract.tarifas.length > 0 && (
                                <div>
                                  <p className="mb-1.5 font-semibold text-slate-700">Tarifas</p>
                                  <div className="overflow-hidden rounded-md border border-slate-200">
                                    <table className="min-w-full text-xs">
                                      <thead className="bg-slate-100 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                        <tr>
                                          <th className="px-3 py-2">Tipo</th>
                                          <th className="px-3 py-2 text-right">Valor UF/m²</th>
                                          <th className="px-3 py-2 text-right">% Reajuste</th>
                                          <th className="px-3 py-2">Vigencia desde</th>
                                          <th className="px-3 py-2">Vigencia hasta</th>
                                          <th className="px-3 py-2 text-center">Es Diciembre</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {contract.tarifas.map((tarifa, i) => (
                                          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                                            <td className="px-3 py-2 font-medium text-slate-800">{tarifa.tipo}</td>
                                            <td className="px-3 py-2 text-right text-slate-700">{tarifa.valor.toString()}</td>
                                            <td className="px-3 py-2 text-slate-700">{formatDate(tarifa.vigenciaDesde)}</td>
                                            <td className="px-3 py-2 text-slate-700">{tarifa.vigenciaHasta ? formatDate(tarifa.vigenciaHasta) : "—"}</td>
                                            <td className="px-3 py-2 text-center text-slate-700">{tarifa.esDiciembre ? "Sí" : "No"}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* ── GGCC ── */}
                              {contract.ggcc.length > 0 && (
                                <div>
                                  <p className="mb-1.5 font-semibold text-slate-700">Gastos Comunes (GGCC)</p>
                                  <div className="overflow-hidden rounded-md border border-slate-200">
                                    <table className="min-w-full text-xs">
                                      <thead className="bg-slate-100 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                        <tr>
                                          <th className="px-3 py-2 text-right">Tarifa base UF/m²</th>
                                          <th className="px-3 py-2 text-right">% Administración</th>
                                          <th className="px-3 py-2">Vigencia desde</th>
                                          <th className="px-3 py-2">Vigencia hasta</th>
                                          <th className="px-3 py-2">Próximo reajuste</th>
                                          <th className="px-3 py-2 text-center">Meses reajuste</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {contract.ggcc.map((item, i) => (
                                          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                                            <td className="px-3 py-2 text-right text-slate-700">{item.tarifaBaseUfM2.toString()}</td>
                                            <td className="px-3 py-2 text-right text-slate-700">{item.pctAdministracion.toString()}%</td>
                                            <td className="px-3 py-2 text-right text-slate-700">{item.pctReajuste ? `${item.pctReajuste.toString()}%` : "â€”"}</td>
                                            <td className="px-3 py-2 text-slate-700">{formatDate(item.vigenciaDesde)}</td>
                                            <td className="px-3 py-2 text-slate-700">{item.vigenciaHasta ? formatDate(item.vigenciaHasta) : "—"}</td>
                                            <td className="px-3 py-2 text-slate-700">{item.proximoReajuste ? formatDate(item.proximoReajuste) : "—"}</td>
                                            <td className="px-3 py-2 text-center text-slate-700">{item.mesesReajuste ?? "—"}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

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
          locals={units.map((unit) => ({ id: unit.id, label: unit.codigo }))}
          arrendatarios={tenants.map((tenant) => ({ id: tenant.id, label: tenant.nombreComercial }))}
          nextCursor={nextCursor}
          contracts={contracts.map((contract) => ({
            id: contract.id,
            numeroContrato: contract.numeroContrato,
            estado: contract.estado,
            pdfUrl: contract.pdfUrl,
            fechaInicio: contract.fechaInicio.toISOString(),
            fechaTermino: contract.fechaTermino.toISOString(),
            pctFondoPromocion: contract.pctFondoPromocion?.toString() ?? null,
            pctAdministracionGgcc: contract.pctAdministracionGgcc?.toString() ?? null,
            multiplicadorDiciembre: getDecemberMultiplier(contract),
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
              pctReajuste: item.pctReajuste?.toString() ?? null,
              vigenciaDesde: item.vigenciaDesde.toISOString().slice(0, 10),
              vigenciaHasta: item.vigenciaHasta ? item.vigenciaHasta.toISOString().slice(0, 10) : null,
              proximoReajuste: item.proximoReajuste
                ? item.proximoReajuste.toISOString().slice(0, 10)
                : null,
              mesesReajuste: item.mesesReajuste ?? null
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
            contractReviewCatalogs={{
              localCodes: units.map((unit) => unit.codigo),
              arrendatarios: tenants.map((tenant) => ({
                id: tenant.nombreComercial,
                label: tenant.nombreComercial || "Arrendatario sin nombre"
              }))
            }}
            columns={[
              { key: "numeroContrato", label: "Contrato" },
              { key: "localCodigo", label: "Local" },
              { key: "arrendatarioNombre", label: "Arrendatario" },
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


