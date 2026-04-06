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
  unitId: z.string().trim().min(1, "unitId es obligatorio."),
  period: z
    .string()
    .trim()
    .refine(isPeriodoValido, "period debe tener formato YYYY-MM."),
  salesUf: z
    .coerce
    .string()
    .trim()
    .min(1, "salesUf es obligatorio.")
    .refine((value) => {
      try {
        // Decimal constructor throws when input is invalid.
        // eslint-disable-next-line no-new
        new Prisma.Decimal(value);
        return true;
      } catch {
        return false;
      }
    }, "salesUf debe ser decimal valido.")
});

function normalizeBody(record: Record<string, unknown>) {
  return {
    projectId:
      typeof record.projectId === "string"
        ? record.projectId
        : typeof record.proyectoId === "string"
          ? record.proyectoId
          : "",
    unitId:
      typeof record.unitId === "string"
        ? record.unitId
        : typeof record.localId === "string"
          ? record.localId
          : "",
    period:
      typeof record.period === "string"
        ? record.period
        : typeof record.periodo === "string"
          ? record.periodo
          : "",
    salesUf:
      typeof record.salesUf === "string" || typeof record.salesUf === "number"
        ? record.salesUf
        : typeof record.ventasUf === "string" || typeof record.ventasUf === "number"
          ? record.ventasUf
          : ""
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId") ?? searchParams.get("proyectoId");
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

    const sales = await prisma.unitSale.findMany({
      where: {
        projectId,
        period
      },
      orderBy: [{ unitId: "asc" }]
    });

    return NextResponse.json(
      sales.map((sale) => ({
        ...sale,
        proyectoId: sale.projectId,
        localId: sale.unitId,
        periodo: sale.period,
        ventasUf: sale.salesUf
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

    const saved = await prisma.unitSale.upsert({
      where: {
        unitId_period: {
          unitId: parsed.data.unitId,
          period: parsed.data.period
        }
      },
      update: {
        projectId: parsed.data.projectId,
        salesUf: new Prisma.Decimal(parsed.data.salesUf)
      },
      create: {
        projectId: parsed.data.projectId,
        unitId: parsed.data.unitId,
        period: parsed.data.period,
        salesUf: new Prisma.Decimal(parsed.data.salesUf)
      }
    });
    invalidateMetricsCacheByProject(parsed.data.projectId);

    return NextResponse.json(
      {
        ...saved,
        proyectoId: saved.projectId,
        localId: saved.unitId,
        periodo: saved.period,
        ventasUf: saved.salesUf
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
