export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";
import { buildXlsxTemplate, type ColumnDef } from "@/lib/upload/xlsx-template";

export const runtime = "nodejs";

const instruccionesGenerales = [
  "La hoja del archivo debe llamarse 'Data Presupuesto' o 'Presupuesto Ventas'.",
  "La fecha puede venir como 'Fecha' (serial Excel o YYYY-MM-DD) o como 'Mes' (ej: 'enero') + 'Año'.",
  "Las ventas presupuestadas se agregan por 'ID CA' y mes: multiples filas se suman.",
  "'ID CA' es el identificador externo del arrendatario (ID Capital Advisors).",
  "'Valor UF' es el monto en UF presupuestado. Debe ser positivo.",
  "Se utiliza para calcular la renta variable esperada por local y periodo."
];

const columns: ColumnDef[] = [
  {
    key: "ID CA",
    label: "ID CA",
    required: true,
    description: "Identificador numerico del arrendatario (Capital Advisors). Ej: 10234.",
    format: "number",
    width: 12,
    headerPalette: "navy"
  },
  {
    key: "Tienda",
    label: "Tienda",
    required: false,
    description: "Nombre comercial del local. Usado como apoyo al mapeo.",
    width: 28
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
    key: "Valor UF",
    label: "Valor UF",
    required: true,
    description: "Venta presupuestada en UF. Positivo.",
    format: "number",
    width: 14,
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
          "ID CA": "10234",
          Tienda: "Mountain Hardwear",
          Fecha: "2026-01-01",
          Mes: "enero",
          "Año": "2026",
          "Valor UF": "3500.00"
        },
        {
          "ID CA": "10489",
          Tienda: "Cafe Urbano",
          Fecha: "2026-01-01",
          Mes: "enero",
          "Año": "2026",
          "Valor UF": "900.00"
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
