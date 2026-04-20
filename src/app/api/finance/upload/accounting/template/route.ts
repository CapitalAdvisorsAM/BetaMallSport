export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";
import { buildXlsxTemplate, type ColumnDef } from "@/lib/upload/xlsx-template";

export const runtime = "nodejs";

const instruccionesGenerales = [
  "La hoja del archivo CDG que se procesa se debe llamar 'Data Contable' (o 'Maestro').",
  "Solo se cargan las filas con Ce.coste = 'Real'. El resto se ignoran.",
  "La columna 'Mes' acepta fechas (serial de Excel o YYYY-MM-DD). Se normaliza al primer dia del mes.",
  "La columna 'Local' debe tener el formato '[L<codigo>]  <NOMBRE>' (ej: '[L102]  MOUNTAIN HARDWEAR'). Solo se extrae el codigo.",
  "'GRUPO 1' y 'GRUPO 3' son obligatorios y deben coincidir con la estructura de cuentas del EERR.",
  "'Valor UF' es numerico. Costos y gastos con signo negativo, ingresos con signo positivo.",
  "Subir un periodo existente reemplaza sus registros anteriores (idempotente por periodo).",
  "Los locales nuevos se auto-mapean por codigo o similitud del nombre del arrendatario; los no identificados aparecen en 'Mapeos'."
];

const columns: ColumnDef[] = [
  {
    key: "Mes",
    label: "Mes",
    required: true,
    description: "Fecha del periodo contable. Se normaliza al primer dia del mes.",
    format: "date",
    width: 14,
    headerPalette: "navy"
  },
  {
    key: "Ce.coste",
    label: "Centro de Coste",
    required: true,
    description: "Solo se procesan filas con valor 'Real'.",
    validation: { type: "list", values: ["Real", "Presupuesto"] },
    width: 14,
    headerPalette: "navy"
  },
  {
    key: "Local",
    label: "Local",
    required: true,
    description: "Formato '[L<codigo>]  <NOMBRE>'. Ej: '[L102]  MOUNTAIN HARDWEAR'.",
    width: 32,
    headerPalette: "navy"
  },
  {
    key: "Arrendatario",
    label: "Arrendatario",
    required: false,
    description: "Nombre del arrendatario. Usado para auto-match cuando el codigo no calza.",
    width: 28
  },
  {
    key: "GRUPO 1",
    label: "Grupo 1",
    required: true,
    description: "Seccion contable del EERR. Ej: INGRESOS ARRIENDO, GASTOS MARKETING.",
    width: 32,
    headerPalette: "navy"
  },
  {
    key: "GRUPO 3",
    label: "Grupo 3",
    required: true,
    description: "Linea de detalle dentro del GRUPO 1.",
    width: 32,
    headerPalette: "navy"
  },
  {
    key: "Denominación objeto",
    label: "Denominacion objeto",
    required: false,
    description: "Texto libre. Si va vacio se usa GRUPO 3.",
    width: 28
  },
  {
    key: "Valor UF",
    label: "Valor UF",
    required: true,
    description: "Monto en UF. Gastos con signo negativo. Ingresos positivos.",
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
  },
  {
    key: "Categoría (Tipo)",
    label: "Categoria (Tipo)",
    required: false,
    description: "Tipo del local. Ej: OUTDOOR, GIMNASIO.",
    width: 20
  },
  {
    key: "Piso",
    label: "Piso",
    required: false,
    description: "Nivel del local. Ej: 1, 2, -1.",
    width: 10
  }
];

export async function GET(): Promise<NextResponse> {
  try {
    await requireSession();

    const buffer = buildXlsxTemplate({
      sheetName: "Data Contable",
      title: "Plantilla de Carga - Datos Contables",
      subtitle: "Mall Sport - Capital Advisors AGF",
      columns,
      exampleRows: [
        {
          Mes: "2026-01-01",
          "Ce.coste": "Real",
          Local: "[L102]  MOUNTAIN HARDWEAR",
          Arrendatario: "Mountain Hardwear SpA",
          "GRUPO 1": "INGRESOS ARRIENDO",
          "GRUPO 3": "Renta Minima",
          "Denominación objeto": "Renta Minima",
          "Valor UF": "1250.50",
          "Categoría (Tamaño)": "LOCAL GRANDE",
          "Categoría (Tipo)": "OUTDOOR",
          Piso: "1"
        },
        {
          Mes: "2026-01-01",
          "Ce.coste": "Real",
          Local: "[L204]  CAFE URBANO",
          Arrendatario: "Cafe Urbano Ltda",
          "GRUPO 1": "GASTOS MARKETING",
          "GRUPO 3": "FONDO DE PROMOCION",
          "Denominación objeto": "Fondo de Promocion",
          "Valor UF": "-85.20",
          "Categoría (Tamaño)": "LOCAL CHICO",
          "Categoría (Tipo)": "GASTRONOMIA",
          Piso: "2"
        }
      ],
      instrucciones: instruccionesGenerales
    });

    return new NextResponse(Uint8Array.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="plantilla-datos-contables.xlsx"'
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
