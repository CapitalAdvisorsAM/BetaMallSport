export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";
import { buildXlsxTemplate, type ColumnDef } from "@/lib/upload/xlsx-template";

export const runtime = "nodejs";

const instruccionesGenerales = [
  "La hoja del archivo CDG que se procesa se debe llamar 'Data Bco' (o cualquier hoja que contenga 'bco' o 'banco').",
  "Cada fila representa un movimiento bancario.",
  "'CC', 'Movimiento', 'banco' y 'Clasificación' son obligatorios - filas incompletas se ignoran.",
  "'Fecha contable' acepta serial de Excel o YYYY-MM-DD. El periodo (mes) se deriva automaticamente.",
  "'Abono (+)' es el monto del movimiento en CLP.",
  "'N° Operación' identifica el movimiento; usado para trazabilidad.",
  "Subir un periodo reemplaza los movimientos previos del mismo mes."
];

const columns: ColumnDef[] = [
  {
    key: "CC",
    label: "CC (Cuenta)",
    required: true,
    description: "Cuenta contable asociada al movimiento. Ej: 1-1-001.",
    width: 14,
    headerPalette: "navy"
  },
  {
    key: "Movimiento",
    label: "Movimiento",
    required: true,
    description: "Descripcion del movimiento (glosa bancaria).",
    width: 32,
    headerPalette: "navy"
  },
  {
    key: "N° Operación",
    label: "N° Operacion",
    required: false,
    description: "Numero de operacion asignado por el banco. Ej: 98231765.",
    width: 16
  },
  {
    key: "Fecha contable",
    label: "Fecha contable",
    required: true,
    description: "Fecha del movimiento. El periodo (mes) se deriva de aqui.",
    format: "date",
    width: 14,
    headerPalette: "navy"
  },
  {
    key: "Abono (+)",
    label: "Abono (CLP)",
    required: true,
    description: "Monto del movimiento en CLP. Positivo para abonos.",
    format: "number",
    width: 16,
    headerPalette: "gold"
  },
  {
    key: "RUT de origen",
    label: "RUT de origen",
    required: false,
    description: "RUT de quien origina la transferencia. Ej: 76.123.456-7.",
    width: 16
  },
  {
    key: "Nombre de origen",
    label: "Nombre de origen",
    required: false,
    description: "Nombre de la contraparte.",
    width: 28
  },
  {
    key: "Comentario transferencia",
    label: "Comentario transferencia",
    required: false,
    description: "Texto libre de la transferencia.",
    width: 32
  },
  {
    key: "banco",
    label: "Banco",
    required: true,
    description: "Banco donde se realiza el movimiento. Ej: Santander, BCI.",
    width: 16,
    headerPalette: "navy"
  },
  {
    key: "Clasificación",
    label: "Clasificacion",
    required: true,
    description: "Clasificacion del movimiento. Ej: ARRIENDO, GASTO COMUN, INGRESO EXTRAORDINARIO.",
    width: 24,
    headerPalette: "navy"
  }
];

export async function GET(): Promise<NextResponse> {
  try {
    await requireSession();

    const buffer = buildXlsxTemplate({
      sheetName: "Data Bco",
      title: "Plantilla de Carga - Movimientos Banco",
      subtitle: "Mall Sport - Capital Advisors AGF",
      columns,
      exampleRows: [
        {
          CC: "1-1-001",
          Movimiento: "TRANSFERENCIA ELECTRONICA",
          "N° Operación": "98231765",
          "Fecha contable": "2026-01-05",
          "Abono (+)": "3150000",
          "RUT de origen": "76.123.456-7",
          "Nombre de origen": "Mountain Hardwear SpA",
          "Comentario transferencia": "Arriendo enero 2026 local L102",
          banco: "Santander",
          "Clasificación": "ARRIENDO"
        },
        {
          CC: "1-1-001",
          Movimiento: "DEPOSITO",
          "N° Operación": "98231988",
          "Fecha contable": "2026-01-12",
          "Abono (+)": "820000",
          "RUT de origen": "77.456.789-1",
          "Nombre de origen": "Cafe Urbano Ltda",
          "Comentario transferencia": "GC enero 2026",
          banco: "BCI",
          "Clasificación": "GASTO COMUN"
        }
      ],
      instrucciones: instruccionesGenerales
    });

    return new NextResponse(Uint8Array.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="plantilla-movimientos-banco.xlsx"'
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
