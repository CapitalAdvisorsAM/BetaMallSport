export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { budgetedSaleCellSchema } from "@/lib/finance/budgeted-sales/schema";
import {
  getRequiredActiveProjectIdFromRequest,
  withCanonicalProjectId,
} from "@/lib/http/request";
import { requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function periodStringToDate(period: string): Date {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

function dateToPeriodString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    await requireWriteAccess();
    const projectId = await getRequiredActiveProjectIdFromRequest(request);

    const parsed = budgetedSaleCellSchema.safeParse(
      withCanonicalProjectId(await request.json(), projectId),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "Payload invalido.", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { tenantId, period, salesPesos } = parsed.data;

    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, proyectoId: projectId },
      select: { id: true },
    });
    if (!tenant) {
      throw new ApiError(404, "Arrendatario no encontrado en el proyecto.");
    }

    const periodDate = periodStringToDate(period);

    if (salesPesos === null) {
      await prisma.tenantBudgetedSale.deleteMany({
        where: { tenantId, period: periodDate, projectId },
      });
      return NextResponse.json({
        tenantId,
        period,
        salesPesos: null,
      });
    }

    const value = new Prisma.Decimal(salesPesos);

    const saved = await prisma.tenantBudgetedSale.upsert({
      where: { tenantId_period: { tenantId, period: periodDate } },
      create: {
        projectId,
        tenantId,
        period: periodDate,
        salesPesos: value,
      },
      update: { salesPesos: value },
      select: { tenantId: true, period: true, salesPesos: true },
    });

    return NextResponse.json({
      tenantId: saved.tenantId,
      period: dateToPeriodString(saved.period),
      salesPesos: saved.salesPesos.toString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
