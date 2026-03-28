import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const periodoRegex = /^\d{4}-\d{2}$/;
const allowedWriteRoles = new Set(["ADMIN", "CONTABILIDAD"]);

function isPeriodoValido(periodo: string): boolean {
  if (!periodoRegex.test(periodo)) {
    return false;
  }
  const month = Number(periodo.slice(5, 7));
  return month >= 1 && month <= 12;
}

const ventasUpsertSchema = z.object({
  proyectoId: z.string().trim().min(1, "proyectoId es obligatorio."),
  localId: z.string().trim().min(1, "localId es obligatorio."),
  periodo: z
    .string()
    .trim()
    .regex(periodoRegex, "periodo debe tener formato YYYY-MM.")
    .refine(isPeriodoValido, "periodo invalido."),
  ventasUf: z
    .coerce
    .string()
    .trim()
    .min(1, "ventasUf es obligatorio.")
    .refine((value) => {
      try {
        // Decimal constructor throws when input is invalid.
        // eslint-disable-next-line no-new
        new Prisma.Decimal(value);
        return true;
      } catch {
        return false;
      }
    }, "ventasUf debe ser decimal valido.")
});

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();

    const { searchParams } = new URL(request.url);
    const proyectoId = searchParams.get("proyectoId");
    const periodo = searchParams.get("periodo");

    if (!proyectoId) {
      return NextResponse.json({ message: "proyectoId es obligatorio." }, { status: 400 });
    }
    if (!periodo) {
      return NextResponse.json({ message: "periodo es obligatorio." }, { status: 400 });
    }
    if (!isPeriodoValido(periodo)) {
      return NextResponse.json({ message: "periodo debe tener formato YYYY-MM." }, { status: 400 });
    }

    const ventas = await prisma.ventaLocal.findMany({
      where: {
        proyectoId,
        periodo
      },
      orderBy: [{ localId: "asc" }]
    });

    return NextResponse.json(ventas, { status: 200 });
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

    const parsed = ventasUpsertSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "Payload invalido.", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const saved = await prisma.ventaLocal.upsert({
      where: {
        localId_periodo: {
          localId: parsed.data.localId,
          periodo: parsed.data.periodo
        }
      },
      update: {
        proyectoId: parsed.data.proyectoId,
        ventasUf: new Prisma.Decimal(parsed.data.ventasUf)
      },
      create: {
        proyectoId: parsed.data.proyectoId,
        localId: parsed.data.localId,
        periodo: parsed.data.periodo,
        ventasUf: new Prisma.Decimal(parsed.data.ventasUf)
      }
    });

    return NextResponse.json(saved, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
