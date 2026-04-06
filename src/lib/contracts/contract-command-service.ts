import { Prisma, ContractRateType } from "@prisma/client";
import { ApiError } from "@/lib/api-error";
import { generateNumeroContrato, normalizedLocalIds, toDate, toDecimal } from "@/lib/contracts/persistence";
import { prisma } from "@/lib/prisma";
import type { ContractFormPayload } from "@/types";

export async function createContractCommand(input: {
  payload: ContractFormPayload;
  userId: string;
}) {
  const { payload, userId } = input;
  const localIds = normalizedLocalIds(payload);
  const numeroContrato =
    payload.numeroContrato?.trim() || (await generateNumeroContrato(prisma, payload.proyectoId));

  if (localIds.length === 0) {
    throw new ApiError(400, "Debes seleccionar al menos un local.");
  }

  const [locals, arrendatario] = await Promise.all([
    prisma.unit.findMany({
      where: { id: { in: localIds }, proyectoId: payload.proyectoId },
      select: { id: true }
    }),
    prisma.tenant.findFirst({
      where: { id: payload.arrendatarioId, proyectoId: payload.proyectoId },
      select: { id: true }
    })
  ]);
  if (locals.length !== localIds.length) {
    throw new ApiError(400, "Uno o mas locales no pertenecen al proyecto.");
  }
  if (!arrendatario) {
    throw new ApiError(400, "El arrendatario no pertenece al proyecto.");
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.contract.create({
      data: {
        proyectoId: payload.proyectoId,
        localId: localIds[0],
        arrendatarioId: payload.arrendatarioId,
        numeroContrato,
        fechaInicio: new Date(payload.fechaInicio),
        fechaTermino: new Date(payload.fechaTermino),
        fechaEntrega: toDate(payload.fechaEntrega),
        fechaApertura: toDate(payload.fechaApertura),
        diasGracia: payload.diasGracia,
        estado: payload.estado,
        pctFondoPromocion: toDecimal(payload.pctFondoPromocion),
        pctAdministracionGgcc: toDecimal(payload.pctAdministracionGgcc),
        multiplicadorDiciembre: toDecimal(payload.multiplicadorDiciembre),
        codigoCC: payload.codigoCC,
        pdfUrl: payload.pdfUrl,
        notas: payload.notas
      }
    });

    await tx.contractUnit.createMany({
      data: localIds.map((localId) => ({
        contratoId: created.id,
        localId
      })),
      skipDuplicates: true
    });

    const tarifasPayload = [
      ...payload.tarifas,
      ...payload.rentaVariable.map((item) => ({
        tipo: "PORCENTAJE" as const,
        valor: item.pctRentaVariable,
        vigenciaDesde: item.vigenciaDesde,
        vigenciaHasta: item.vigenciaHasta,
        esDiciembre: false
      }))
    ];
    const tarifasByKey = new Map<string, (typeof tarifasPayload)[number]>();
    for (const tarifa of tarifasPayload) {
      tarifasByKey.set(`${tarifa.tipo}|${tarifa.vigenciaDesde}`, tarifa);
    }

    if (tarifasByKey.size > 0) {
      await tx.contractRate.createMany({
        data: Array.from(tarifasByKey.values()).map((t) => ({
          contratoId: created.id,
          tipo: t.tipo as ContractRateType,
          valor: new Prisma.Decimal(t.valor),
          vigenciaDesde: new Date(t.vigenciaDesde),
          vigenciaHasta: toDate(t.vigenciaHasta),
          esDiciembre: t.esDiciembre
        }))
      });
    }

    if (payload.ggcc.length > 0) {
      await tx.contractCommonExpense.createMany({
        data: payload.ggcc.map((g) => ({
          contratoId: created.id,
          tarifaBaseUfM2: new Prisma.Decimal(g.tarifaBaseUfM2),
          pctAdministracion: new Prisma.Decimal(g.pctAdministracion),
          pctReajuste: toDecimal(g.pctReajuste),
          vigenciaDesde: new Date(payload.fechaInicio),
          vigenciaHasta: toDate(payload.fechaTermino),
          proximoReajuste: toDate(g.proximoReajuste),
          mesesReajuste: g.mesesReajuste ?? null
        }))
      });
    }

    if (payload.anexo) {
      await tx.contractAmendment.create({
        data: {
          contratoId: created.id,
          fecha: new Date(payload.anexo.fecha),
          descripcion: payload.anexo.descripcion,
          camposModificados: { origen: "FORM_CREATE" },
          snapshotAntes: {},
          snapshotDespues: created,
          usuarioId: userId
        }
      });
    }

    return {
      ...created,
      localIds
    };
  });
}
