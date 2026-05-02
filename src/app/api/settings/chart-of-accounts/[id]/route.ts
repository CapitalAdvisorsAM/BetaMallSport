import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireWriteAccess } from "@/lib/permissions";
import { chartOfAccountUpdateSchema } from "@/lib/settings/chart-of-accounts/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireWriteAccess();

    const result = chartOfAccountUpdateSchema.safeParse(await req.json());
    if (!result.success) {
      throw new ApiError(400, result.error.issues[0]?.message ?? "Datos invalidos.");
    }

    const existing = await prisma.chartOfAccount.findUnique({ where: { id: params.id } });
    if (!existing) {
      throw new ApiError(404, "Cuenta no encontrada.");
    }

    const updated = await prisma.chartOfAccount.update({
      where: { id: params.id },
      data: {
        ...(result.data.type !== undefined ? { type: result.data.type } : {}),
        ...(result.data.alias !== undefined ? { alias: result.data.alias } : {}),
        ...(result.data.displayOrder !== undefined ? { displayOrder: result.data.displayOrder } : {}),
        ...(result.data.notes !== undefined ? { notes: result.data.notes } : {})
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
