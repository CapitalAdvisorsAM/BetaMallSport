import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api-error";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { WIDGET_IDS } from "@/lib/dashboard/widget-registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    await requireSession();

    const rows = await prisma.dashboardConfig.findMany({
      orderBy: { position: "asc" }
    });

    return NextResponse.json(rows);
  } catch (error) {
    return handleApiError(error);
  }
}

const updateItemSchema = z.object({
  widgetId: z.string().min(1),
  enabled: z.boolean(),
  position: z.number().int().min(0),
  formulaVariant: z.string().nullable(),
  parameters: z.record(z.union([z.number(), z.boolean()])).nullable()
});

const updateSchema = z.array(updateItemSchema).min(1);

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    await requireWriteAccess();

    const result = updateSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json(
        { message: result.error.issues[0].message, issues: result.error.issues },
        { status: 400 }
      );
    }

    const unknownIds = result.data.filter((item) => !(WIDGET_IDS as string[]).includes(item.widgetId));
    if (unknownIds.length > 0) {
      return NextResponse.json(
        { message: `widgetId desconocido: ${unknownIds.map((i) => i.widgetId).join(", ")}` },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      result.data.map((item) =>
        prisma.dashboardConfig.upsert({
          where: { widgetId: item.widgetId },
          create: {
            widgetId: item.widgetId,
            enabled: item.enabled,
            position: item.position,
            formulaVariant: item.formulaVariant ?? null,
            parameters: item.parameters ?? undefined
          },
          update: {
            enabled: item.enabled,
            position: item.position,
            formulaVariant: item.formulaVariant ?? null,
            parameters: item.parameters ?? undefined
          }
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
