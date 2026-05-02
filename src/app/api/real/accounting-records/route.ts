export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { AccountingScenario } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { parsePaginationParams } from "@/lib/pagination";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) throw new ApiError(400, "projectId es obligatorio.");

    const period = searchParams.get("period"); // "YYYY-MM"
    const group1 = searchParams.get("group1");
    const group3 = searchParams.get("group3");
    const search = searchParams.get("search")?.trim();
    const onlyEdited = searchParams.get("onlyEdited") === "true";
    const rawScenario = searchParams.get("scenario");
    const scenario =
      rawScenario === "PPTO" ? AccountingScenario.PPTO : AccountingScenario.REAL;

    const { limit, cursor } = parsePaginationParams(searchParams);

    const where = {
      projectId,
      scenario,
      ...(period ? { period: new Date(`${period}-01`) } : {}),
      ...(group1 ? { group1 } : {}),
      ...(group3 ? { group3 } : {}),
      ...(onlyEdited ? { isManuallyEdited: true } : {}),
      ...(search
        ? {
            OR: [
              { externalUnit: { contains: search, mode: "insensitive" as const } },
              { externalTenant: { contains: search, mode: "insensitive" as const } },
              { denomination: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const rows = await prisma.accountingRecord.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ period: "desc" }, { group1: "asc" }, { group3: "asc" }, { id: "asc" }],
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

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? (data[data.length - 1]?.id ?? null) : null;

    return NextResponse.json({
      data: data.map((r) => ({
        id: r.id,
        period: r.period.toISOString().slice(0, 7),
        externalUnit: r.externalUnit,
        unitId: r.unitId,
        unitNombre: r.unit?.nombre ?? null,
        externalTenant: r.externalTenant,
        tenantId: r.tenantId,
        tenantNombre: r.tenant?.nombreComercial ?? null,
        group1: r.group1,
        group3: r.group3,
        denomination: r.denomination,
        valueUf: r.valueUf.toString(),
        scenario: r.scenario,
        isManuallyEdited: r.isManuallyEdited,
        originalValueUf: r.originalValueUf?.toString() ?? null,
      })),
      nextCursor,
      hasMore,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
