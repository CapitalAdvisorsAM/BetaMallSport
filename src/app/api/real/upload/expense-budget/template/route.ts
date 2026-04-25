export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { LINE_ORDER, SECTION_ORDER } from "@/lib/real/eerr";
import { requireSession } from "@/lib/permissions";
import { buildXlsxTemplate, type ColumnDef } from "@/lib/upload/xlsx-template";

export const runtime = "nodejs";

const instruccionesGenerales = [
  "Complete solo desde la fila 6 (las filas amarillas son ejemplos - puede borrarlas)",
  "No modifique los encabezados (fila 3) - el sistema los usa para identificar columnas",
  "Guarde el archivo como .xlsx antes de subir",
  "Formato de Periodo: YYYY-MM (ej: 2026-01). Tambien se acepta una fecha completa que se normaliza al primer dia del mes",
  "GRUPO 1 debe ser exactamente uno de los valores permitidos (ver lista mas abajo)",
  "GRUPO 3 debe pertenecer a la seccion GRUPO 1 correspondiente. Las secciones DEPRECIACION, EDI, RESULTADO NO OPERACIONAL e IMPUESTOS aceptan cualquier detalle",
  "Los valores se cargan en UF. Costos y gastos se ingresan con signo negativo (ej: -1500). Ingresos con signo positivo",
  "Subir el mismo periodo reemplaza los registros anteriores de ese mes - es idempotente",
  "",
  "Detalle de GRUPO 3 por seccion (GRUPO 1):",
  ...Object.entries(LINE_ORDER).flatMap(([seccion, lineas]) => [
    `  ${seccion}:`,
    `    ${lineas.join(" | ")}`
  ])
];

const columns: ColumnDef[] = [
  {
    key: "Periodo",
    label: "Periodo",
    required: true,
    description: "Mes del presupuesto en formato YYYY-MM. Ej: 2026-01",
    format: "date",
    width: 14,
    headerPalette: "navy"
  },
  {
    key: "GRUPO 1",
    label: "Grupo 1",
    required: true,
    description: "Seccion contable. Use exactamente uno de los valores de la lista de instrucciones",
    validation: {
      type: "list",
      values: [...SECTION_ORDER]
    },
    width: 36,
    headerPalette: "navy"
  },
  {
    key: "GRUPO 3",
    label: "Grupo 3",
    required: true,
    description: "Linea de detalle. Debe pertenecer a la seccion GRUPO 1 (ver instrucciones)",
    width: 36,
    headerPalette: "navy"
  },
  {
    key: "Valor UF",
    label: "Valor UF",
    required: true,
    description: "Monto presupuestado en UF. Gastos con signo negativo. Ej: -1500",
    format: "number",
    width: 16,
    headerPalette: "gold"
  }
];

export async function GET(): Promise<NextResponse> {
  try {
    await requireSession();

    const buffer = buildXlsxTemplate({
      sheetName: "Presupuesto",
      title: "Plantilla de Carga - Presupuesto de Gastos",
      subtitle: "Mall Sport - Capital Advisors AGF",
      columns,
      exampleRows: [
        {
          Periodo: "2026-01",
          "GRUPO 1": "GASTOS MARKETING",
          "GRUPO 3": "FONDO DE PROMOCION",
          "Valor UF": "-1500"
        },
        {
          Periodo: "2026-01",
          "GRUPO 1": "GASTOS INMOBILIARIA",
          "GRUPO 3": "Honorarios Externos",
          "Valor UF": "-750.50"
        },
        {
          Periodo: "2026-02",
          "GRUPO 1": "VACANCIA G.C. + CONTRIBUCIONES",
          "GRUPO 3": "Contribuciones",
          "Valor UF": "-1200"
        }
      ],
      instrucciones: instruccionesGenerales
    });

    return new NextResponse(Uint8Array.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="plantilla-presupuesto-gastos.xlsx"'
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
