import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    await requireSession();

    const csvContent = [
      "codigo,nombre,glam2,piso,tipo,zona,esGLA,estado",
      "L-101,Local Demo,120.5,1,LOCAL_COMERCIAL,FOOD,true,ACTIVO"
    ].join("\n");
    const csvWithBom = `\uFEFF${csvContent}`;

    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="plantilla-locales.csv"'
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
