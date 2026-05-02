export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { accountingRecordPatchSchema } from "@/lib/real/accounting-records/schema";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireWriteAccess();

    const { id } = params;
    const body = await req.json();
    const result = accountingRecordPatchSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { message: result.error.issues[0]?.message ?? "Datos inválidos." },
        { status: 400 }
      );
    }

    const existing = await prisma.accountingRecord.findFirst({ where: { id } });
    if (!existing) throw new ApiError(404, "Registro contable no encontrado.");

    const patch = result.data;

    const updated = await prisma.accountingRecord.update({
      where: { id },
      data: {
        ...(patch.valueUf !== undefined
          ? {
              valueUf: new Prisma.Decimal(patch.valueUf),
              // Only save originalValueUf on the first manual edit
              originalValueUf: existing.isManuallyEdited
                ? existing.originalValueUf
                : existing.valueUf,
            }
          : {}),
        ...(patch.group1 !== undefined ? { group1: patch.group1 } : {}),
        ...(patch.group3 !== undefined ? { group3: patch.group3 } : {}),
        ...(patch.unitId !== undefined ? { unitId: patch.unitId } : {}),
        ...(patch.tenantId !== undefined ? { tenantId: patch.tenantId } : {}),
        isManuallyEdited: true,
      },
      select: {
        id: true,
        period: true,
        externalUnit: true,
        unitId: true,
        externalTenant: true,
        tenantId: true,
        group1: true,
        group3: true,
        denomination: true,
        valueUf: true,
        scenario: true,
        isManuallyEdited: true,
        originalValueUf: true,
        unit: { select: { nombre: true } },
        tenant: { select: { nombreComercial: true } },
      },
    });

    return NextResponse.json({
      id: updated.id,
      period: updated.period.toISOString().slice(0, 7),
      externalUnit: updated.externalUnit,
      unitId: updated.unitId,
      unitNombre: updated.unit?.nombre ?? null,
      externalTenant: updated.externalTenant,
      tenantId: updated.tenantId,
      tenantNombre: updated.tenant?.nombreComercial ?? null,
      group1: updated.group1,
      group3: updated.group3,
      denomination: updated.denomination,
      valueUf: updated.valueUf.toString(),
      scenario: updated.scenario,
      isManuallyEdited: updated.isManuallyEdited,
      originalValueUf: updated.originalValueUf?.toString() ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
