import Link from "next/link";
import { type Prisma, DataUploadType } from "@prisma/client";
import { redirect } from "next/navigation";
import { ContractManager } from "@/components/contracts/ContractManager";
import { ContractsViewTable } from "@/components/rent-roll/ContractsViewTable";
import { RentRollEntityModeNav } from "@/components/rent-roll/RentRollEntityModeNav";
import { UploadHistory } from "@/components/upload/UploadHistory";
import { UploadSection } from "@/components/upload/UploadSection";
import { Button } from "@/components/ui/button";
import type { RentRollMode } from "@/lib/navigation";
import { applyEstadoComputado } from "@/lib/contracts/contract-query-service";
import { buildExportExcelUrl } from "@/lib/export/shared";
import { canWrite, requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";
import { getUploadHistory } from "@/lib/rent-roll/upload-history";

type ContractsPageProps = {
  searchParams: {
    seccion?: string | string[];
    cursor?: string | string[];
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
    local: { select: { id: true, codigo: true, nombre: true, glam2: true, piso: true, tipo: true } },
    locales: {
      include: {
        local: { select: { id: true, codigo: true, nombre: true, glam2: true, piso: true, tipo: true } }
      },
      orderBy: { createdAt: "asc" as const }
    },
    arrendatario: {
      select: {
        id: true, nombreComercial: true, razonSocial: true,
        rut: true, email: true, telefono: true, vigente: true
      }
    },
    tarifas: {
      orderBy: { vigenciaDesde: "desc" as const },
      take: 10,
      select: {
        tipo: true,
        valor: true,
        umbralVentasUf: true,
        pisoMinimoUf: true,
        vigenciaDesde: true,
        vigenciaHasta: true,
        esDiciembre: true,
        descuentoTipo: true,
        descuentoValor: true,
        descuentoDesde: true,
        descuentoHasta: true
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
    },
    anexos: {
      orderBy: { fecha: "desc" as const },
      select: {
        id: true,
        fecha: true,
        descripcion: true,
        camposModificados: true
      }
    }
  }
} satisfies Prisma.ContractDefaultArgs;

type ContractRow = Prisma.ContractGetPayload<typeof contractQueryArgs>;

function getAssociatedLocales(contract: ContractRow) {
  if (contract.locales.length > 0) {
    return contract.locales.map((item) => item.local);
  }
  return [contract.local];
}

export default async function ContractsPage({
  searchParams
}: ContractsPageProps): Promise<JSX.Element> {
  const session = await requireSession();
  const seccionParam = getSingleValue(searchParams.seccion);
  const cursor = getSingleValue(searchParams.cursor);
  const { selectedProjectId } = await getProjectContext();
  const canEdit = canWrite(session.user.role);

  if (!selectedProjectId) {
    redirect("/");
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
      where: {
        proyectoId: selectedProjectId,
      },
      ...contractQueryArgs,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 50,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0
    }) as Promise<ContractRow[]>

  ]);
  const contractsWithComputedState = applyEstadoComputado(contracts);
  const nextCursor = contracts.length === 50 ? contracts[contracts.length - 1]?.id : undefined;

  const uploadHistory =
    mode === "upload" ? await getUploadHistory(selectedProjectId, DataUploadType.RENT_ROLL) : [];

  const filteredExportHref = buildExportExcelUrl({
    dataset: "contratos",
    scope: "filtered",
    projectId: selectedProjectId
  });
  const allExportHref = buildExportExcelUrl({
    dataset: "contratos",
    scope: "all",
    projectId: selectedProjectId
  });

  const contractViewRows = contractsWithComputedState.map((contract) => ({
    id: contract.id,
    numeroContrato: contract.numeroContrato,
    locales: getAssociatedLocales(contract)
      .map((unit) => unit.codigo)
      .join(", "),
    arrendatario: contract.arrendatario.nombreComercial,
    arrendatarioId: contract.arrendatario.id,
    estado: contract.estado,
    fechaInicio: contract.fechaInicio.toISOString(),
    fechaTermino: contract.fechaTermino.toISOString(),
    pdfUrl: contract.pdfUrl
  }));

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
            <ContractsViewTable
              rows={contractViewRows}
            />
          </section>
        </>
      ) : mode === "cargar" ? (
        <ContractManager
          proyectoId={selectedProjectId}
          canEdit={canEdit}
          locals={units.map((unit) => ({ id: unit.id, label: unit.codigo }))}
          arrendatarios={tenants.map((tenant) => ({ id: tenant.id, label: tenant.nombreComercial }))}
          nextCursor={nextCursor}
          contracts={contractsWithComputedState.map((contract) => ({
            id: contract.id,
            numeroContrato: contract.numeroContrato,
            diasGracia: contract.diasGracia,
            estado: contract.estado,
            pdfUrl: contract.pdfUrl,
            fechaInicio: contract.fechaInicio.toISOString(),
            fechaTermino: contract.fechaTermino.toISOString(),
            fechaEntrega: contract.fechaEntrega ? contract.fechaEntrega.toISOString().slice(0, 10) : null,
            fechaApertura: contract.fechaApertura ? contract.fechaApertura.toISOString().slice(0, 10) : null,
            codigoCC: contract.codigoCC,
            notas: contract.notas,
            pctFondoPromocion: contract.pctFondoPromocion?.toString() ?? null,
            pctAdministracionGgcc: contract.pctAdministracionGgcc?.toString() ?? null,
            multiplicadorDiciembre: contract.multiplicadorDiciembre?.toString() ?? null,
            multiplicadorJunio: contract.multiplicadorJunio?.toString() ?? null,
            multiplicadorJulio: contract.multiplicadorJulio?.toString() ?? null,
            multiplicadorAgosto: contract.multiplicadorAgosto?.toString() ?? null,
            local: contract.local,
            locales: getAssociatedLocales(contract),
            arrendatario: contract.arrendatario,
            tarifas: contract.tarifas.map((tarifa) => ({
              tipo: tarifa.tipo,
              valor: tarifa.valor.toString(),
              umbralVentasUf: tarifa.umbralVentasUf?.toString() ?? null,
              pisoMinimoUf: tarifa.pisoMinimoUf?.toString() ?? null,
              vigenciaDesde: tarifa.vigenciaDesde.toISOString().slice(0, 10),
              vigenciaHasta: tarifa.vigenciaHasta ? tarifa.vigenciaHasta.toISOString().slice(0, 10) : null,
              esDiciembre: tarifa.esDiciembre,
              descuentoTipo: tarifa.descuentoTipo ?? null,
              descuentoValor: tarifa.descuentoValor?.toString() ?? null,
              descuentoDesde: tarifa.descuentoDesde ? tarifa.descuentoDesde.toISOString().slice(0, 10) : null,
              descuentoHasta: tarifa.descuentoHasta ? tarifa.descuentoHasta.toISOString().slice(0, 10) : null
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
            previewEndpoint="/api/rent-roll/upload/contracts/preview"
            applyEndpoint="/api/rent-roll/upload/contracts/apply"
            templateEndpoint="/api/rent-roll/upload/contracts/template"
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
              { key: "fechaInicio", label: "Inicio" },
              { key: "fechaTermino", label: "Termino" },
              { key: "tarifaTipo", label: "Tarifa tipo" },
              { key: "tarifaValor", label: "Tarifa valor" }
            ]}
          />
          <UploadHistory items={uploadHistory} />
        </>
      )}
    </main>
  );
}

