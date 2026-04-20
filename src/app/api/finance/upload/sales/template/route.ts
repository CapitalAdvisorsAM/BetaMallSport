export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";
import { buildXlsxTemplate, type ColumnDef } from "@/lib/upload/xlsx-template";

export const runtime = "nodejs";

const instruccionesGenerales = [
  "La hoja del archivo CDG que se procesa se debe llamar 'Data Ventas'.",
  "Solo se cargan las filas con Tipo = 'Real'. El resto se ignoran.",
  "La fecha puede venir como 'Fecha' (serial Excel o YYYY-MM-DD) o como 'Mes' (ej: 'enero') + 'Año'.",
  "Las ventas se agregan por 'ID CA' y mes: si hay varias filas diarias para un mismo local y mes, se suman.",
  "'ID CA' es el identificador externo del arrendatario (ID Capital Advisors); los no mapeados se ven en Mapeos.",
  "'Valor UF' es el monto en UF. Deben ser valores positivos (ventas)."
];

const columns: ColumnDef[] = [
  {
    key: "Tipo",
    label: "Tipo",
    required: true,
    description: "Solo se procesan filas con valor 'Real'.",
    validation: { type: "list", values: ["Real", "Presupuesto"] },
    width: 14,
    headerPalette: "navy"
  },
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
    description: "Fecha de la venta. Si viene, sobrescribe Mes + Año.",
    format: "date",
    width: 14,
    headerPalette: "navy"
  },
  {
    key: "Mes",
    label: "Mes",
    required: false,
    description: "Nombre del mes en español. Ej: enero, febrero. Se usa si no hay 'Fecha'.",
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
    description: "Venta en UF del periodo. Positivo.",
    format: "number",
    width: 14,
    headerPalette: "gold"
  },
  {
    key: "Categoría (Tamaño)",
    label: "Categoria (Tamano)",
    required: false,
    description: "Tamano del local. Ej: LOCAL GRANDE, LOCAL CHICO.",
    width: 20
  }
];

export async function GET(): Promise<NextResponse> {
  try {
    await requireSession();

    const buffer = buildXlsxTemplate({
      sheetName: "Data Ventas",
      title: "Plantilla de Carga - Datos de Ventas",
      subtitle: "Mall Sport - Capital Advisors AGF",
      columns,
      exampleRows: [
        {
          Tipo: "Real",
          "ID CA": "10234",
          Tienda: "Mountain Hardwear",
          Fecha: "2026-01-31",
          Mes: "enero",
          "Año": "2026",
          "Valor UF": "3250.00",
          "Categoría (Tamaño)": "LOCAL GRANDE"
        },
        {
          Tipo: "Real",
          "ID CA": "10489",
          Tienda: "Cafe Urbano",
          Fecha: "2026-01-31",
          Mes: "enero",
          "Año": "2026",
          "Valor UF": "820.45",
          "Categoría (Tamaño)": "LOCAL CHICO"
        }
      ],
      instrucciones: instruccionesGenerales
    });

    return new NextResponse(Uint8Array.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="plantilla-datos-ventas.xlsx"'
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
