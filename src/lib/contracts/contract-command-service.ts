import { ApiError } from "@/lib/api-error";
import {
  assertNoOverlappingContracts,
  generateNumeroContrato,
  normalizedLocalIds,
  payloadTarifas,
  persistGGCC,
  persistTarifas,
  toDate,
  toDecimal
} from "@/lib/contracts/persistence";
import { prisma } from "@/lib/prisma";
import { computeEstadoContrato, startOfDay } from "@/lib/utils";
import type { ContractFormPayload } from "@/types";

export async function createContractCommand(input: {
  payload: ContractFormPayload;
  userId: string;
}) {
  const { payload, userId } = input;
  const localIds = normalizedLocalIds(payload);
  const numeroContrato =
    payload.numeroContrato?.trim() || (await generateNumeroContrato(prisma, payload.projectId));

  if (localIds.length === 0) {
    throw new ApiError(400, "Debes seleccionar al menos un local.");
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

  return prisma.$transaction(async (tx) => {
    await assertNoOverlappingContracts(tx, {
      projectId: payload.projectId,
      localIds,
      fechaInicio: payload.fechaInicio,
      fechaTermino: payload.fechaTermino,
      diasGracia: payload.diasGracia
    });

    const created = await tx.contract.create({
      data: {
        projectId: payload.projectId,
        localId: localIds[0],
        arrendatarioId: payload.arrendatarioId,
        numeroContrato,
        fechaInicio: new Date(payload.fechaInicio),
        fechaTermino: new Date(payload.fechaTermino),
        fechaEntrega: toDate(payload.fechaEntrega),
        fechaApertura: toDate(payload.fechaApertura),
        diasGracia: payload.diasGracia,
        cuentaParaVacancia: payload.cuentaParaVacancia,
        estado: computeEstadoContrato(
          new Date(payload.fechaInicio),
          new Date(payload.fechaTermino),
          payload.diasGracia,
          "VIGENTE",
          startOfDay(new Date())
        ),
        pctFondoPromocion: toDecimal(payload.pctFondoPromocion),
        pctAdministracionGgcc: toDecimal(payload.pctAdministracionGgcc),
        multiplicadorDiciembre: toDecimal(payload.multiplicadorDiciembre),
        multiplicadorJunio: toDecimal(payload.multiplicadorJunio),
        multiplicadorJulio: toDecimal(payload.multiplicadorJulio),
        multiplicadorAgosto: toDecimal(payload.multiplicadorAgosto),
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

    // Delegate to the shared bitemporal persisters. With no existing rows for a
    // freshly-created contract, persistTarifas degenerates to "insert all" — but
    // it correctly creates ContractRateDiscount rows from the payload's embedded
    // descuento* fields, which the previous inline createMany was silently dropping.
    await persistTarifas(tx, created.id, payloadTarifas(payload), {
      userId,
      amendmentId: null
    });
    await persistGGCC(tx, created.id, payload.ggcc, payload.fechaInicio, payload.fechaTermino, {
      userId,
      amendmentId: null
    });

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
