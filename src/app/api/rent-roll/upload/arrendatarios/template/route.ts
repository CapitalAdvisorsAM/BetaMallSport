import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    await requireSession();

    const csvContent = [
      "rut,razonSocial,nombreComercial,vigente,email,telefono",
      "12345678-k,Razon Social Demo,Marca Demo,true,contacto@empresa.cl,+56911112222"
    ].join("\n");
    const csvWithBom = `\uFEFF${csvContent}`;

    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="plantilla-arrendatarios.csv"'
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
