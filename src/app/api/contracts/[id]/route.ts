export const dynamic = "force-dynamic";

import { Prisma, ContractDiscountType, ContractRateType } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError, handleApiError } from "@/lib/api-error";
import { applyEstadoComputado } from "@/lib/contracts/contract-query-service";
import { legacyDiscountFields } from "@/lib/contracts/rate-history";
import {
  getRequiredActiveProjectIdFromRequest,
  withCanonicalProjectId
} from "@/lib/http/request";
import {
  assertNoOverlappingContracts,
  normalizedLocalIds,
  payloadTarifas,
  persistContratoLocales,
  persistGGCC,
  persistTarifas,
  tarifaKey,
  toDate,
  toDecimal
} from "@/lib/contracts/persistence";
import { contractPayloadSchema } from "@/lib/contracts/schema";
import { invalidateMetricsCacheByProject } from "@/lib/metrics-cache";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { computeEstadoContrato, startOfDay } from "@/lib/utils";

export const runtime = "nodejs";

type ContractPayload = (typeof contractPayloadSchema)["_type"];

export async function GET(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireSession();
    const projectId = await getRequiredActiveProjectIdFromRequest(request);

    const item = await prisma.contract.findFirst({
      where: { id: context.params.id, projectId: projectId },
      include: {
        local: true,
        locales: {
          include: { local: true },
          orderBy: { createdAt: "asc" }
        },
        arrendatario: true,
        // Only active rates — superseded rows live in history and must not surface
        // to the editor (they would appear as ghost duplicates after corrections).
        tarifas: {
          where: { supersededAt: null },
          include: {
            discounts: { where: { supersededAt: null }, orderBy: { vigenciaDesde: "asc" } }
          },
          orderBy: { vigenciaDesde: "desc" }
        },
        ggcc: { where: { supersededAt: null }, orderBy: { vigenciaDesde: "desc" } },
        anexos: { orderBy: { createdAt: "desc" }, take: 5 }
      }
    });
    if (!item) {
      throw new ApiError(404, "No encontrado.");
    }
    const [computed] = applyEstadoComputado([item]);
    // Project active discounts back into the legacy 4-field shape on each tarifa,
    // strip the discounts relation so the response shape stays unchanged.
    const response = {
      ...computed,
      tarifas: computed.tarifas.map(({ discounts, ...tarifa }) => ({
        ...tarifa,
        ...legacyDiscountFields(discounts)
      }))
    };
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}

function toDateOnly(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function toDecimalString(value: Prisma.Decimal | string | null): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return new Prisma.Decimal(value).toString();
  }
  return value.toString();
}

type NormalizedTarifaInput = {
  tipo: string;
  valor: Prisma.Decimal | string;
  umbralVentasUf?: Prisma.Decimal | string | null;
  vigenciaDesde: Date | string;
  vigenciaHasta: Date | string | null;
  esDiciembre: boolean;
  // Either inline legacy fields (payload shape) or a discounts relation (DB shape).
  descuentoTipo?: string | null;
  descuentoValor?: Prisma.Decimal | string | null;
  descuentoDesde?: Date | string | null;
  descuentoHasta?: Date | string | null;
  discounts?: Array<{
    tipo: ContractDiscountType;
    valor: Prisma.Decimal;
    vigenciaDesde: Date;
    vigenciaHasta: Date | null;
  }>;
};

function tarifaDiscountFields(item: NormalizedTarifaInput): {
  descuentoTipo: string | null;
  descuentoValor: string | null;
  descuentoDesde: string | null;
  descuentoHasta: string | null;
} {
  if (item.discounts && item.discounts.length > 0) {
    const projected = legacyDiscountFields(item.discounts);
    return {
      descuentoTipo: projected.descuentoTipo,
      descuentoValor: projected.descuentoValor,
      descuentoDesde: projected.descuentoDesde,
      descuentoHasta: projected.descuentoHasta
    };
  }
  return {
    descuentoTipo: item.descuentoTipo ?? null,
    descuentoValor: toDecimalString(item.descuentoValor ?? null),
    descuentoDesde: toDateOnly(item.descuentoDesde ?? null),
    descuentoHasta: toDateOnly(item.descuentoHasta ?? null)
  };
}

function normalizedTarifas(tarifas: NormalizedTarifaInput[]): string {
  return JSON.stringify(
    tarifas
      .map((item) => ({
        key: tarifaKey(item.tipo, item.vigenciaDesde, item.umbralVentasUf),
        tipo: item.tipo,
        valor: toDecimalString(item.valor),
        vigenciaDesde: toDateOnly(item.vigenciaDesde),
        vigenciaHasta: toDateOnly(item.vigenciaHasta),
        esDiciembre: item.esDiciembre,
        ...tarifaDiscountFields(item)
      }))
      .sort((a, b) => a.key.localeCompare(b.key))
  );
}

function normalizedRentaVariable(
  rows: Array<{
    tipo: string;
    valor: Prisma.Decimal | string;
    umbralVentasUf?: Prisma.Decimal | string | null;
    vigenciaDesde: Date | string;
    vigenciaHasta: Date | string | null;
  }>
): string {
  return JSON.stringify(
    rows
      .filter((item) => item.tipo === ContractRateType.PORCENTAJE)
      .map((item) => ({
        key: `${toDateOnly(item.vigenciaDesde) ?? ""}|${toDecimalString(item.umbralVentasUf ?? null) ?? "0"}`,
        pctRentaVariable: toDecimalString(item.valor),
        umbralVentasUf: toDecimalString(item.umbralVentasUf ?? null) ?? "0",
        vigenciaDesde: toDateOnly(item.vigenciaDesde),
        vigenciaHasta: toDateOnly(item.vigenciaHasta)
      }))
      .sort((a, b) => a.key.localeCompare(b.key))
  );
}

function normalizedGgcc(
  rows: Array<{
    tarifaBaseUfM2: Prisma.Decimal | string;
    pctAdministracion: Prisma.Decimal | string;
    pctReajuste: Prisma.Decimal | string | null;
    proximoReajuste: Date | string | null;
    mesesReajuste?: number | null;
  }>
): string {
  return JSON.stringify(
    rows
      .map((item) => ({
        key: [
          toDecimalString(item.tarifaBaseUfM2) ?? "",
          toDecimalString(item.pctAdministracion) ?? "",
          toDecimalString(item.pctReajuste) ?? "",
          toDateOnly(item.proximoReajuste) ?? "",
          String("mesesReajuste" in item ? (item.mesesReajuste ?? null) : null)
        ].join("|"),
        tarifaBaseUfM2: toDecimalString(item.tarifaBaseUfM2),
        pctAdministracion: toDecimalString(item.pctAdministracion),
        pctReajuste: toDecimalString(item.pctReajuste),
        proximoReajuste: toDateOnly(item.proximoReajuste),
        mesesReajuste: "mesesReajuste" in item ? (item.mesesReajuste ?? null) : null
      }))
      .sort((a, b) => a.key.localeCompare(b.key))
  );
}

function computeCamposModificados(
  existing: Prisma.ContractGetPayload<{
    include: {
      tarifas: { include: { discounts: true } };
      ggcc: true;
      locales: true;
    };
  }>,
  payload: ContractPayload,
  localIds: string[]
): string[] {
  const campos: string[] = [];

  const scalarChecks: Array<[field: string, before: unknown, after: unknown]> = [
    ["arrendatarioId", existing.arrendatarioId, payload.arrendatarioId],
    ["numeroContrato", existing.numeroContrato, payload.numeroContrato?.trim() || existing.numeroContrato],
    ["fechaInicio", toDateOnly(existing.fechaInicio), toDateOnly(payload.fechaInicio)],
    ["fechaTermino", toDateOnly(existing.fechaTermino), toDateOnly(payload.fechaTermino)],
    ["fechaEntrega", toDateOnly(existing.fechaEntrega), toDateOnly(payload.fechaEntrega)],
    ["fechaApertura", toDateOnly(existing.fechaApertura), toDateOnly(payload.fechaApertura)],
    [
      "pctFondoPromocion",
      toDecimalString(existing.pctFondoPromocion),
      toDecimalString(payload.pctFondoPromocion)
    ],
    [
      "pctAdministracionGgcc",
      toDecimalString(existing.pctAdministracionGgcc),
      toDecimalString(payload.pctAdministracionGgcc)
    ],
    [
      "multiplicadorDiciembre",
      toDecimalString(existing.multiplicadorDiciembre),
      toDecimalString(payload.multiplicadorDiciembre)
    ],
    [
      "multiplicadorJunio",
      toDecimalString(existing.multiplicadorJunio),
      toDecimalString(payload.multiplicadorJunio)
    ],
    [
      "multiplicadorJulio",
      toDecimalString(existing.multiplicadorJulio),
      toDecimalString(payload.multiplicadorJulio)
    ],
    [
      "multiplicadorAgosto",
      toDecimalString(existing.multiplicadorAgosto),
      toDecimalString(payload.multiplicadorAgosto)
    ],
    ["codigoCC", existing.codigoCC, payload.codigoCC],
    ["pdfUrl", existing.pdfUrl, payload.pdfUrl],
    ["notas", existing.notas, payload.notas],
    ["cuentaParaVacancia", existing.cuentaParaVacancia, payload.cuentaParaVacancia]
  ];

  for (const [field, before, after] of scalarChecks) {
    if (before !== after) {
      campos.push(field);
    }
  }

  const existingLocalIds =
    existing.locales.length > 0
      ? existing.locales.map((item) => item.localId).sort()
      : [existing.localId];
  const payloadLocalIds = [...localIds].sort();
  if (JSON.stringify(existingLocalIds) !== JSON.stringify(payloadLocalIds)) {
    campos.push("localIds");
  }

  const existingTarifasFijas = existing.tarifas.filter(
    (item) => item.tipo === ContractRateType.FIJO_UF_M2 || item.tipo === ContractRateType.FIJO_UF
  );
  const payloadTarifasFijas = payload.tarifas.filter(
    (item) => item.tipo === ContractRateType.FIJO_UF_M2 || item.tipo === ContractRateType.FIJO_UF
  );

  if (normalizedTarifas(existingTarifasFijas) !== normalizedTarifas(payloadTarifasFijas)) {
    campos.push("tarifas");
  }
  if (normalizedRentaVariable(existing.tarifas) !== normalizedRentaVariable(payloadTarifas(payload))) {
    campos.push("rentaVariable");
  }
  if (normalizedGgcc(existing.ggcc) !== normalizedGgcc(payload.ggcc)) {
    campos.push("ggcc");
  }
  if (payload.anexo) {
    campos.push("anexo");
  }

  return campos;
}

function validateContractInput(body: unknown): ContractPayload {
  const parsed = contractPayloadSchema.parse(body);
  return parsed;
}

function buildContratoPayload(
  parsed: ContractPayload,
  existingNumeroContrato: string,
  localIds: string[]
): Prisma.ContractUncheckedUpdateInput {
  return {
    localId: localIds[0],
    arrendatarioId: parsed.arrendatarioId,
    numeroContrato: parsed.numeroContrato?.trim() || existingNumeroContrato,
    fechaInicio: new Date(parsed.fechaInicio),
    fechaTermino: new Date(parsed.fechaTermino),
    fechaEntrega: toDate(parsed.fechaEntrega),
    fechaApertura: toDate(parsed.fechaApertura),
    diasGracia: parsed.diasGracia,
    cuentaParaVacancia: parsed.cuentaParaVacancia,
    estado: computeEstadoContrato(
      new Date(parsed.fechaInicio),
      new Date(parsed.fechaTermino),
      parsed.diasGracia,
      "VIGENTE",
      startOfDay(new Date())
    ),
    pctFondoPromocion: toDecimal(parsed.pctFondoPromocion),
    pctAdministracionGgcc: toDecimal(parsed.pctAdministracionGgcc),
    multiplicadorDiciembre: toDecimal(parsed.multiplicadorDiciembre),
    multiplicadorJunio: toDecimal(parsed.multiplicadorJunio),
    multiplicadorJulio: toDecimal(parsed.multiplicadorJulio),
    multiplicadorAgosto: toDecimal(parsed.multiplicadorAgosto),
    codigoCC: parsed.codigoCC,
    pdfUrl: parsed.pdfUrl,
    notas: parsed.notas
  };
}

export async function PUT(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const projectId = await getRequiredActiveProjectIdFromRequest(request);
    const payload = validateContractInput(withCanonicalProjectId(await request.json(), projectId));
    const contractId = context.params.id;
    const localIds = normalizedLocalIds(payload);

    if (localIds.length === 0) {
      return NextResponse.json({ message: "Debes seleccionar al menos un local." }, { status: 400 });
    }

    const existing = await prisma.contract.findFirst({
      where: { id: contractId, projectId: payload.projectId },
      include: {
        tarifas: {
          where: { supersededAt: null },
          include: {
            discounts: { where: { supersededAt: null }, orderBy: { vigenciaDesde: "asc" } }
          }
        },
        ggcc: { where: { supersededAt: null } },
        locales: true
      }
    });
    if (!existing) {
      return NextResponse.json({ message: "Contrato no encontrado." }, { status: 404 });
    }

    const [locals, arrendatario] = await Promise.all([
      prisma.unit.findMany({
        where: { id: { in: localIds }, projectId: payload.projectId },
        select: { id: true }
      }),
      prisma.tenant.findFirst({
        where: { id: payload.arrendatarioId, projectId: payload.projectId },
        select: { id: true }
      })
    ]);
    if (locals.length !== localIds.length) {
      throw new ApiError(400, "Uno o mas locales no pertenecen al proyecto.");
    }
    if (!arrendatario) {
      throw new ApiError(400, "El arrendatario no pertenece al proyecto.");
    }

    const camposModificados = computeCamposModificados(existing, payload, localIds);

    const updated = await prisma.$transaction(async (tx) => {
      await assertNoOverlappingContracts(tx, {
        projectId: payload.projectId,
        localIds,
        fechaInicio: payload.fechaInicio,
        fechaTermino: payload.fechaTermino,
        diasGracia: payload.diasGracia,
        excludeContractId: contractId
      });

      // Pre-create amendment skeleton so persistTarifas can stamp superseded rows with
      // amendmentId in the same transaction. snapshotDespues is backfilled after persists
      // (see end of this block). Option C of the supersession plan: amendment is always
      // recorded for traceability when any field changed; payload.anexo carries optional
      // human-readable metadata.
      let amendmentId: string | null = null;
      if (camposModificados.length > 0) {
        const amendment = await tx.contractAmendment.create({
          data: {
            contratoId: contractId,
            fecha: payload.anexo ? new Date(payload.anexo.fecha) : new Date(),
            descripcion: payload.anexo?.descripcion ?? "Edicion de contrato",
            camposModificados,
            snapshotAntes: existing as unknown as Prisma.InputJsonValue,
            snapshotDespues: {} as unknown as Prisma.InputJsonValue,
            usuarioId: session.user.id
          }
        });
        amendmentId = amendment.id;
      }

      await tx.contract.update({
        where: { id: contractId },
        data: buildContratoPayload(payload, existing.numeroContrato, localIds)
      });

      await persistContratoLocales(tx, contractId, localIds);
      await persistTarifas(tx, contractId, payloadTarifas(payload), {
        userId: session.user.id,
        amendmentId,
        supersedeReason: payload.anexo?.descripcion ?? null
      });
      await persistGGCC(tx, contractId, payload.ggcc, payload.fechaInicio, payload.fechaTermino, {
        userId: session.user.id,
        amendmentId,
        supersedeReason: payload.anexo?.descripcion ?? null
      });

      const snapshotDespues = await tx.contract.findUnique({
        where: { id: contractId },
        include: {
          tarifas: {
            where: { supersededAt: null },
            include: {
              discounts: { where: { supersededAt: null }, orderBy: { vigenciaDesde: "asc" } }
            }
          },
          ggcc: { where: { supersededAt: null } },
          locales: true
        }
      });
      if (!snapshotDespues) {
        throw new Error("Contrato no encontrado.");
      }

      if (amendmentId) {
        await tx.contractAmendment.update({
          where: { id: amendmentId },
          data: {
            snapshotDespues: snapshotDespues as unknown as Prisma.InputJsonValue
          }
        });
      }

      return snapshotDespues;
    });
    invalidateMetricsCacheByProject(payload.projectId);

    const [computed] = applyEstadoComputado([updated]);
    const response = {
      ...computed,
      tarifas: computed.tarifas.map(({ discounts, ...tarifa }) => ({
        ...tarifa,
        ...legacyDiscountFields(discounts)
      }))
    };
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: "Payload invalido", issues: error.issues }, { status: 400 });
    }
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireWriteAccess();
    const projectId = await getRequiredActiveProjectIdFromRequest(request);

    const deleted = await prisma.contract.deleteMany({
      where: { id: context.params.id, projectId: projectId }
    });
    if (deleted.count === 0) {
      return NextResponse.json({ message: "Contrato no encontrado." }, { status: 404 });
    }
    invalidateMetricsCacheByProject(projectId);

    return NextResponse.json({ message: "Contrato eliminado correctamente." });
  } catch (error) {
    return handleApiError(error);
  }
}
