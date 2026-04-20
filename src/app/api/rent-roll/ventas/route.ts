export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError } from "@/lib/api-error";
import { invalidateMetricsCacheByProject } from "@/lib/metrics-cache";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isPeriodoValido } from "@/lib/validators";

const allowedWriteRoles = new Set(["ADMIN", "CONTABILIDAD"]);

const salesUpsertSchema = z.object({
  projectId: z.string().trim().min(1, "projectId es obligatorio."),
  tenantId: z.string().trim().min(1, "tenantId es obligatorio."),
  period: z
    .string()
    .trim()
    .refine(isPeriodoValido, "period debe tener formato YYYY-MM."),
  salesPesos: z
    .coerce
    .string()
    .trim()
    .min(1, "salesPesos es obligatorio.")
    .refine((value) => {
      try {
        // eslint-disable-next-line no-new
        new Prisma.Decimal(value);
        return true;
      } catch {
        return false;
      }
    }, "salesPesos debe ser decimal valido.")
});

function normalizeBody(record: Record<string, unknown>) {
  return {
    projectId:
      typeof record.projectId === "string"
        ? record.projectId
        : typeof record.proyectoId === "string"
          ? record.proyectoId
          : "",
    tenantId:
      typeof record.tenantId === "string"
        ? record.tenantId
        : typeof record.arrendatarioId === "string"
          ? record.arrendatarioId
          : "",
    period:
      typeof record.period === "string"
        ? record.period
        : typeof record.periodo === "string"
          ? record.periodo
          : "",
    salesPesos:
      typeof record.salesPesos === "string" || typeof record.salesPesos === "number"
        ? record.salesPesos
        : typeof record.ventasPesos === "string" || typeof record.ventasPesos === "number"
          ? record.ventasPesos
          : ""
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const period = searchParams.get("period") ?? searchParams.get("periodo");

    if (!projectId) {
      return NextResponse.json({ message: "projectId es obligatorio." }, { status: 400 });
    }
    if (!period) {
      return NextResponse.json({ message: "period es obligatorio." }, { status: 400 });
    }
    if (!isPeriodoValido(period)) {
      return NextResponse.json({ message: "period debe tener formato YYYY-MM." }, { status: 400 });
    }

    const sales = await prisma.tenantSale.findMany({
      where: {
        projectId,
        period: new Date(`${period}-01`)
      },
      orderBy: [{ tenantId: "asc" }]
    });

    return NextResponse.json(
      sales.map((sale) => ({
        ...sale,
        period: sale.period.toISOString().slice(0, 7),
        proyectoId: sale.projectId,
        tenantId: sale.tenantId,
        periodo: sale.period.toISOString().slice(0, 7),
        ventasPesos: sale.salesPesos
      })),
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    if (!allowedWriteRoles.has(session.user.role)) {
      throw new ApiError(403, "No autorizado para registrar ventas.");
    }

    const raw = (await request.json()) as Record<string, unknown>;
    const parsed = salesUpsertSchema.safeParse(normalizeBody(raw));
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "Payload invalido.", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const periodDate = new Date(`${parsed.data.period}-01`);

    const saved = await prisma.tenantSale.upsert({
      where: {
        tenantId_period: {
          tenantId: parsed.data.tenantId,
          period: periodDate
        }
      },
      update: {
        projectId: parsed.data.projectId,
        salesPesos: new Prisma.Decimal(parsed.data.salesPesos)
      },
      create: {
        projectId: parsed.data.projectId,
        tenantId: parsed.data.tenantId,
        period: periodDate,
        salesPesos: new Prisma.Decimal(parsed.data.salesPesos)
      }
    });
    invalidateMetricsCacheByProject(parsed.data.projectId);

    return NextResponse.json(
      {
        ...saved,
        period: saved.period.toISOString().slice(0, 7),
        proyectoId: saved.projectId,
        tenantId: saved.tenantId,
        periodo: saved.period.toISOString().slice(0, 7),
        ventasPesos: saved.salesPesos
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
