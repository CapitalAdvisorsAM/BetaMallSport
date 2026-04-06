import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createCustomWidgetSchema } from "@/lib/dashboard/custom-widget-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    await requireSession();

    const widgets = await prisma.customWidget.findMany({
      orderBy: { position: "asc" },
    });

    return NextResponse.json(widgets);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireWriteAccess();

    const result = createCustomWidgetSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json(
        { message: result.error.issues[0].message, issues: result.error.issues },
        { status: 400 }
      );
    }

    const widget = await prisma.customWidget.create({
      data: {
        title: result.data.title,
        chartType: result.data.chartType,
        enabled: result.data.enabled,
        position: result.data.position,
        formulaConfig: result.data.formulaConfig,
      },
    });

    return NextResponse.json(widget, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
