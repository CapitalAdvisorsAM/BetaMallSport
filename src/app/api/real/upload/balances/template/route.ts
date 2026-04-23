export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";
import { buildXlsxTemplate, type ColumnDef } from "@/lib/upload/xlsx-template";

export const runtime = "nodejs";

const instruccionesGenerales = [
  "La hoja del archivo CDG que se procesa se debe llamar 'Data Balances' (o cualquier hoja que contenga 'balances').",
  "En el CDG real, los datos inician en la fila 7 (las primeras 6 filas del CDG contienen cabecera y totales).",
  "Esta plantilla muestra las columnas esperadas. No es el reemplazo directo del CDG: pegar estos headers en la fila 7 de la hoja 'Data Balances'.",
  "'Codigo' y 'Nombre' identifican la cuenta contable. 'Nombre2' es un nombre alternativo.",
  "'Fecha' es el periodo del balance (serial Excel o YYYY-MM-DD). Se normaliza al primer dia del mes.",
  "'Grupo' y 'Categoría' son obligatorios para clasificar la cuenta en el estado de situacion financiera.",
  "Los montos en CLP son informativos. 'Valor UF' es el valor que se almacena y presenta en el reporte mensual.",
  "Subir un periodo reemplaza los registros previos del mismo mes."
];

const columns: ColumnDef[] = [
  {
    key: "Codigo",
    label: "Codigo",
    required: true,
    description: "Codigo de la cuenta contable. Ej: 1-1-001.",
    width: 14,
    headerPalette: "navy"
  },
  {
    key: "Nombre",
    label: "Nombre",
    required: true,
    description: "Nombre completo de la cuenta contable.",
    width: 32,
    headerPalette: "navy"
  },
  {
    key: "Nombre2",
    label: "Nombre alternativo",
    required: false,
    description: "Segundo nombre de la cuenta (opcional).",
    width: 28
  },
  {
    key: "Fecha",
    label: "Fecha",
    required: true,
    description: "Periodo del balance. Se normaliza al primer dia del mes.",
    format: "date",
    width: 14,
    headerPalette: "navy"
  },
  {
    key: "Debitos",
    label: "Debitos (CLP)",
    required: false,
    description: "Total debitos del periodo en CLP.",
    format: "number",
    width: 16
  },
  {
    key: "Creditos",
    label: "Creditos (CLP)",
    required: false,
    description: "Total creditos del periodo en CLP.",
    format: "number",
    width: 16
  },
  {
    key: "Deudor",
    label: "Saldo Deudor (CLP)",
    required: false,
    description: "Saldo deudor al cierre en CLP.",
    format: "number",
    width: 16
  },
  {
    key: "Acreedor",
    label: "Saldo Acreedor (CLP)",
    required: false,
    description: "Saldo acreedor al cierre en CLP.",
    format: "number",
    width: 16
  },
  {
    key: "Activo",
    label: "Activo (CLP)",
    required: false,
    description: "Monto activo al cierre.",
    format: "number",
    width: 14
  },
  {
    key: "Pasivo",
    label: "Pasivo (CLP)",
    required: false,
    description: "Monto pasivo al cierre.",
    format: "number",
    width: 14
  },
  {
    key: "Perdidas",
    label: "Perdidas (CLP)",
    required: false,
    description: "Monto de perdidas del periodo.",
    format: "number",
    width: 14
  },
  {
    key: "Ganancias",
    label: "Ganancias (CLP)",
    required: false,
    description: "Monto de ganancias del periodo.",
    format: "number",
    width: 14
  },
  {
    key: "Diff",
    label: "Diferencia (CLP)",
    required: false,
    description: "Diferencia de control. Normalmente cero.",
    format: "number",
    width: 14
  },
  {
    key: "Grupo",
    label: "Grupo",
    required: true,
    description: "Grupo contable (clasificacion primaria). Ej: ACTIVO CORRIENTE, PASIVO NO CORRIENTE.",
    width: 28,
    headerPalette: "navy"
  },
  {
    key: "Categoría",
    label: "Categoria",
    required: true,
    description: "Categoria de la cuenta dentro del grupo. Ej: Efectivo, Cuentas por Pagar.",
    width: 28,
    headerPalette: "navy"
  },
  {
    key: "Valor UF",
    label: "Valor UF",
    required: true,
    description: "Saldo del periodo expresado en UF (valor que se almacena).",
    format: "number",
    width: 14,
    headerPalette: "gold"
  }
];

export async function GET(): Promise<NextResponse> {
  try {
    await requireSession();

    const buffer = buildXlsxTemplate({
      sheetName: "Data Balances",
      title: "Plantilla de Carga - Balances",
      subtitle: "Mall Sport - Capital Advisors AGF",
      columns,
      exampleRows: [
        {
          Codigo: "1-1-001",
          Nombre: "Banco Santander - Cta Cte",
          Nombre2: "",
          Fecha: "2026-01-01",
          Debitos: "45000000",
          Creditos: "12000000",
          Deudor: "33000000",
          Acreedor: "0",
          Activo: "33000000",
          Pasivo: "0",
          Perdidas: "0",
          Ganancias: "0",
          Diff: "0",
          Grupo: "ACTIVO CORRIENTE",
          "Categoría": "Efectivo y Equivalentes",
          "Valor UF": "890.25"
        },
        {
          Codigo: "2-1-010",
          Nombre: "Proveedores Varios",
          Nombre2: "",
          Fecha: "2026-01-01",
          Debitos: "5000000",
          Creditos: "18000000",
          Deudor: "0",
          Acreedor: "13000000",
          Activo: "0",
          Pasivo: "13000000",
          Perdidas: "0",
          Ganancias: "0",
          Diff: "0",
          Grupo: "PASIVO CORRIENTE",
          "Categoría": "Cuentas por Pagar",
          "Valor UF": "-350.80"
        }
      ],
      instrucciones: instruccionesGenerales
    });

    return new NextResponse(Uint8Array.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="plantilla-balances.xlsx"'
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
