import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { getFinanceFrom, getFinanceProjectId, getFinanceTo } from "@/lib/finance/api-params";
import { buildEerrDetalle } from "@/lib/finance/eerr";
import { resolveMonthRange } from "@/lib/finance/period-range";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const projectId = getFinanceProjectId(searchParams);
    const group1 = searchParams.get("group1") ?? searchParams.get("grupo1");
    const group3 = searchParams.get("group3") ?? searchParams.get("grupo3");
    const from = getFinanceFrom(searchParams);
    const to = getFinanceTo(searchParams);

    if (!projectId || !group1 || !group3) {
      throw new ApiError(400, "projectId, group1 y group3 son requeridos.");
    }

    const { desdeDate, hastaDate } = resolveMonthRange(from, to);

    const records = await prisma.accountingRecord.findMany({
      where: {
        projectId,
        group1,
        group3,
        period: { gte: desdeDate, lte: hastaDate }
      },
      orderBy: { period: "asc" },
      select: {
        group1: true,
        period: true,
        valueUf: true,
        typeCategory: true,
        unitId: true,
        tenantId: true,
        unit: { select: { codigo: true, nombre: true } },
        tenant: { select: { nombreComercial: true } }
      }
    });

    const legacyRecords = records.map((record) => ({
      grupo1: record.group1,
      periodo: record.period,
      valorUf: record.valueUf,
      categoriaTipo: record.typeCategory,
      localId: record.unitId,
      arrendatarioId: record.tenantId,
      local: record.unit,
      arrendatario: record.tenant
    }));

    return NextResponse.json(buildEerrDetalle(legacyRecords));
  } catch (error) {
    return handleApiError(error);
  }
}
