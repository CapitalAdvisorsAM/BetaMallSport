export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { AccountingScenario } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { getFinanceFrom, getFinanceProjectId, getFinanceTo } from "@/lib/real/api-params";
import { OPERATING_COST_GROUPS } from "@/lib/real/eerr";
import { resolveMonthRange } from "@/lib/real/period-range";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { ExpenseDetailResponse, ExpenseDetailRow } from "@/types/expenses";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const projectId = getFinanceProjectId(searchParams);
    const from = getFinanceFrom(searchParams);
    const to = getFinanceTo(searchParams);
    const group1 = searchParams.get("grupo1")?.trim() || searchParams.get("group1")?.trim() || null;
    const group3 = searchParams.get("grupo3")?.trim() || searchParams.get("group3")?.trim() || null;

    if (!projectId) {
      throw new ApiError(400, "projectId es obligatorio.");
    }
    if (!group1 || !group3) {
      throw new ApiError(400, "grupo1 y grupo3 son obligatorios.");
    }
    if (!OPERATING_COST_GROUPS.has(group1)) {
      throw new ApiError(400, "grupo1 no corresponde a un gasto operativo.");
    }

    const { desdeDate, hastaDate } = resolveMonthRange(from, to);

    const records = await prisma.accountingRecord.findMany({
      where: {
        projectId,
        scenario: AccountingScenario.REAL,
        group1,
        group3,
        period: { gte: desdeDate, lte: hastaDate }
      },
      orderBy: [{ period: "desc" }, { denomination: "asc" }],
      select: {
        id: true,
        period: true,
        denomination: true,
        costCenterCode: true,
        valueUf: true,
        unit: { select: { codigo: true, nombre: true } },
        tenant: { select: { nombreComercial: true } }
      }
    });

    const rows: ExpenseDetailRow[] = records.map((record) => ({
      id: record.id,
      period: record.period.toISOString().slice(0, 10),
      denomination: record.denomination,
      costCenterCode: record.costCenterCode,
      unit: record.unit ? { code: record.unit.codigo, name: record.unit.nombre } : null,
      tenant: record.tenant ? { tradeName: record.tenant.nombreComercial } : null,
      valueUf: Number(record.valueUf)
    }));

    const total = rows.reduce((sum, row) => sum + row.valueUf, 0);

    const response: ExpenseDetailResponse = { rows, total };
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}
