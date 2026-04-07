import { NextResponse } from "next/server";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { updateCustomWidgetSchema } from "@/lib/dashboard/custom-widget-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireWriteAccess();

    const existing = await prisma.customWidget.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError(404, "Widget no encontrado.");

    const result = updateCustomWidgetSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json(
        { message: result.error.issues[0].message, issues: result.error.issues },
        { status: 400 }
      );
    }

    const data = result.data;
    const updated = await prisma.customWidget.update({
      where: { id: params.id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.chartType !== undefined && { chartType: data.chartType }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.position !== undefined && { position: data.position }),
        ...(data.formulaConfig !== undefined && { formulaConfig: data.formulaConfig })
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireWriteAccess();

    const existing = await prisma.customWidget.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError(404, "Widget no encontrado.");

    await prisma.customWidget.delete({ where: { id: params.id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
