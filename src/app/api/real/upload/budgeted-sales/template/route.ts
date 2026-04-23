export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";
import { buildXlsxTemplate, type ColumnDef } from "@/lib/upload/xlsx-template";

export const runtime = "nodejs";

const instruccionesGenerales = [
  "La hoja del archivo debe llamarse 'Data Presupuesto' o 'Presupuesto Ventas'.",
  "La fecha puede venir como 'Fecha' (serial Excel o YYYY-MM-DD) o como 'Mes' (ej: 'enero') + 'Año'.",
  "Las ventas presupuestadas se agregan por 'Tienda' y mes: multiples filas se suman.",
  "'Tienda' es el nombre comercial del local y se usa para identificar al arrendatario.",
  "'Valor Pesos' es el monto en pesos (CLP) presupuestado. Debe ser positivo.",
  "Se utiliza para calcular la renta variable esperada por local y periodo."
];

const columns: ColumnDef[] = [
  {
    key: "Tienda",
    label: "Tienda",
    required: true,
    description: "Nombre comercial del local. Se usa para identificar al arrendatario.",
    width: 28,
    headerPalette: "navy"
  },
  {
    key: "Fecha",
    label: "Fecha",
    required: false,
    description: "Fecha del periodo. Si viene, sobrescribe Mes + Año.",
    format: "date",
    width: 14,
    headerPalette: "navy"
  },
  {
    key: "Mes",
    label: "Mes",
    required: false,
    description: "Nombre del mes en español. Ej: enero. Se usa si no hay 'Fecha'.",
    validation: {
      type: "list",
      values: [
        "enero",
        "febrero",
        "marzo",
        "abril",
        "mayo",
        "junio",
        "julio",
        "agosto",
        "septiembre",
        "octubre",
        "noviembre",
        "diciembre"
      ]
    },
    width: 14
  },
  {
    key: "Año",
    label: "Año",
    required: false,
    description: "Año del periodo. Ej: 2026. Se usa si no hay 'Fecha'.",
    format: "number",
    width: 10
  },
  {
    key: "Valor Pesos",
    label: "Valor Pesos",
    required: true,
    description: "Venta presupuestada en pesos (CLP). Positivo.",
    format: "number",
    width: 16,
    headerPalette: "gold"
  }
];

export async function GET(): Promise<NextResponse> {
  try {
    await requireSession();

    const buffer = buildXlsxTemplate({
      sheetName: "Data Presupuesto",
      title: "Plantilla de Carga - Ventas Presupuestadas",
      subtitle: "Mall Sport - Capital Advisors AGF",
      columns,
      exampleRows: [
        {
          Tienda: "Mountain Hardwear",
          Fecha: "2026-01-01",
          Mes: "enero",
          "Año": "2026",
          "Valor Pesos": "120000000"
        },
        {
          Tienda: "Cafe Urbano",
          Fecha: "2026-01-01",
          Mes: "enero",
          "Año": "2026",
          "Valor Pesos": "30000000"
        }
      ],
      instrucciones: instruccionesGenerales
    });

    return new NextResponse(Uint8Array.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="plantilla-ventas-presupuestadas.xlsx"'
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
