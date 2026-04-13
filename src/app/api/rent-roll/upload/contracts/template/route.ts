export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";
import { buildXlsxTemplate, type ColumnDef } from "@/lib/upload/xlsx-template";

export const runtime = "nodejs";

const instruccionesGenerales = [
  "Complete solo desde la fila 6 (las filas amarillas son de ejemplo - puede borrarlas)",
  "Las columnas con fondo dorado corresponden a condiciones comerciales: complete tarifa fija o renta variable segun corresponda",
  "No modifique los encabezados (fila 3) - el sistema los usa para identificar columnas",
  "Guarde el archivo como .xlsx o .csv antes de subir",
  "Formato de fechas aceptado: YYYY-MM-DD (recomendado) o DD/MM/YYYY",
  "Para los campos con lista desplegable, use solo los valores de la lista",
  "Si informa % Fondo Promocion, use un numero decimal simple. Ej: 2.5 = 2,5%",
  "Si informa Multiplicador Diciembre, use el factor decimal a aplicar en diciembre. Ej: 1.25",
  "Renta variable: use Renta Variable % para el porcentaje base (umbral 0 UF). Para tramos escalonados, complete RV 2 Umbral UF / RV 2 % y RV 3 Umbral UF / RV 3 %. El % del tramo alcanzado se aplica sobre TODAS las ventas",
  "Un contrato puede tener tarifa fija y renta variable al mismo tiempo: complete ambas columnas en la misma fila",
  "Para tarifa fija escalonada, complete Tarifa 2/3/4/5 en la misma fila con distintos valores y fechas. Tarifa N-1 Hasta es obligatorio cuando se informa Tarifa N"
];

const columns: ColumnDef[] = [
  {
    key: "localCodigo",
    label: "Codigo Local",
    required: true,
    description: "Debe existir en el sistema. Ej: L-101",
    width: 16,
    headerPalette: "navy"
  },
  {
    key: "arrendatarioNombre",
    label: "Nombre Arrendatario",
    required: true,
    description: "Debe coincidir con nombreComercial existente en el sistema",
    width: 24,
    headerPalette: "navy"
  },
  {
    key: "fechaInicio",
    label: "Fecha Inicio",
    required: true,
    description: "YYYY-MM-DD o DD/MM/YYYY",
    format: "date",
    width: 14,
    headerPalette: "navy"
  },
  {
    key: "fechaTermino",
    label: "Fecha Termino",
    required: true,
    description: "YYYY-MM-DD o DD/MM/YYYY",
    format: "date",
    width: 14,
    headerPalette: "navy"
  },
  {
    key: "fechaEntrega",
    label: "Fecha Entrega",
    required: false,
    description: "Opcional. YYYY-MM-DD o DD/MM/YYYY",
    format: "date",
    width: 14,
    headerPalette: "navy"
  },
  {
    key: "fechaApertura",
    label: "Fecha Apertura",
    required: false,
    description: "Opcional. YYYY-MM-DD o DD/MM/YYYY",
    format: "date",
    width: 14,
    headerPalette: "navy"
  },
  {
    key: "pctFondoPromocion",
    label: "% Fondo Promocion",
    required: false,
    description: "Opcional. Porcentaje del fondo de promocion del contrato. Ej: 2.5",
    format: "number",
    width: 18,
    headerPalette: "slate"
  },
  {
    key: "multiplicadorDiciembre",
    label: "Multiplicador Diciembre",
    required: false,
    description: "Opcional. Factor decimal para diciembre. Ej: 1.25",
    format: "number",
    width: 22,
    headerPalette: "slate"
  },
  {
    key: "codigoCC",
    label: "Codigo CC",
    required: false,
    description: "Opcional. Codigo de centro de costo asociado al contrato",
    width: 16,
    headerPalette: "slate"
  },
  {
    key: "ggccPctAdministracion",
    label: "GGCC % Administracion",
    required: false,
    description: "% adicional por gestion. Ej: 5 (para 5%)",
    format: "number",
    width: 22,
    headerPalette: "slate"
  },
  {
    key: "notas",
    label: "Notas",
    required: false,
    description: "Opcional. Observaciones internas del contrato",
    width: 28,
    headerPalette: "slate"
  },
  {
    key: "tarifaTipo",
    label: "Tipo Tarifa",
    required: true,
    description: "Para tarifa fija: FIJO_UF_M2=por m2 | FIJO_UF=monto fijo. Se puede combinar con Renta Variable % en la misma fila. Dejar vacio si la fila solo carga Renta Variable %",
    validation: {
      type: "list",
      values: ["FIJO_UF_M2", "FIJO_UF", "PORCENTAJE"]
    },
    width: 16,
    headerPalette: "gold"
  },
  {
    key: "tarifaValor",
    label: "Valor Tarifa",
    required: true,
    description: "Obligatorio junto con Tipo Tarifa cuando la fila carga tarifa fija",
    format: "number",
    width: 14,
    headerPalette: "gold"
  },
  {
    key: "tarifaVigenciaDesde",
    label: "Tarifa Desde",
    required: true,
    description: "Obligatorio para tarifa fija. En PORCENTAJE usa fechaInicio del contrato",
    format: "date",
    width: 14,
    headerPalette: "gold"
  },
  {
    key: "tarifaVigenciaHasta",
    label: "Tarifa Hasta",
    required: false,
    description: "Opcional para tarifa fija. En PORCENTAJE usa fechaTermino del contrato",
    format: "date",
    width: 14,
    headerPalette: "gold"
  },
  {
    key: "tarifa2Valor",
    label: "Tarifa 2 Valor",
    required: false,
    description: "Escalonada: valor del 2° tramo. Requiere que Tarifa Hasta (tramo 1) este informado",
    format: "number",
    width: 14,
    headerPalette: "gold"
  },
  {
    key: "tarifa2VigenciaDesde",
    label: "Tarifa 2 Desde",
    required: false,
    description: "Escalonada: fecha inicio del 2° tramo. YYYY-MM-DD",
    format: "date",
    width: 14,
    headerPalette: "gold"
  },
  {
    key: "tarifa2VigenciaHasta",
    label: "Tarifa 2 Hasta",
    required: false,
    description: "Escalonada: fecha fin del 2° tramo. Obligatorio si hay Tarifa 3",
    format: "date",
    width: 14,
    headerPalette: "gold"
  },
  {
    key: "tarifa3Valor",
    label: "Tarifa 3 Valor",
    required: false,
    description: "Escalonada: valor del 3° tramo",
    format: "number",
    width: 14,
    headerPalette: "gold"
  },
  {
    key: "tarifa3VigenciaDesde",
    label: "Tarifa 3 Desde",
    required: false,
    description: "Escalonada: fecha inicio del 3° tramo. YYYY-MM-DD",
    format: "date",
    width: 14,
    headerPalette: "gold"
  },
  {
    key: "tarifa3VigenciaHasta",
    label: "Tarifa 3 Hasta",
    required: false,
    description: "Escalonada: fecha fin del 3° tramo. Obligatorio si hay Tarifa 4",
    format: "date",
    width: 14,
    headerPalette: "gold"
  },
  {
    key: "tarifa4Valor",
    label: "Tarifa 4 Valor",
    required: false,
    description: "Escalonada: valor del 4° tramo",
    format: "number",
    width: 14,
    headerPalette: "gold"
  },
  {
    key: "tarifa4VigenciaDesde",
    label: "Tarifa 4 Desde",
    required: false,
    description: "Escalonada: fecha inicio del 4° tramo. YYYY-MM-DD",
    format: "date",
    width: 14,
    headerPalette: "gold"
  },
  {
    key: "tarifa4VigenciaHasta",
    label: "Tarifa 4 Hasta",
    required: false,
    description: "Escalonada: fecha fin del 4° tramo. Obligatorio si hay Tarifa 5",
    format: "date",
    width: 14,
    headerPalette: "gold"
  },
  {
    key: "tarifa5Valor",
    label: "Tarifa 5 Valor",
    required: false,
    description: "Escalonada: valor del 5° tramo (ultimo)",
    format: "number",
    width: 14,
    headerPalette: "gold"
  },
  {
    key: "tarifa5VigenciaDesde",
    label: "Tarifa 5 Desde",
    required: false,
    description: "Escalonada: fecha inicio del 5° tramo. YYYY-MM-DD",
    format: "date",
    width: 14,
    headerPalette: "gold"
  },
  {
    key: "tarifa5VigenciaHasta",
    label: "Tarifa 5 Hasta",
    required: false,
    description: "Escalonada: fecha fin del 5° tramo. Dejar vacio si es indefinido",
    format: "date",
    width: 14,
    headerPalette: "gold"
  },
  {
    key: "rentaVariablePct",
    label: "Renta Variable %",
    required: false,
    description: "% base (umbral 0 UF). Usa automaticamente fechaInicio y fechaTermino del contrato",
    format: "number",
    width: 18,
    headerPalette: "gold"
  },
  {
    key: "rentaVariable2UmbralUf",
    label: "RV 2 Umbral UF",
    required: false,
    description: "2° tramo: umbral de ventas en UF a partir del cual aplica RV 2 %",
    format: "number",
    width: 16,
    headerPalette: "gold"
  },
  {
    key: "rentaVariable2Pct",
    label: "RV 2 %",
    required: false,
    description: "2° tramo: porcentaje de renta variable si ventas >= RV 2 Umbral UF",
    format: "number",
    width: 12,
    headerPalette: "gold"
  },
  {
    key: "rentaVariable3UmbralUf",
    label: "RV 3 Umbral UF",
    required: false,
    description: "3° tramo: umbral de ventas en UF a partir del cual aplica RV 3 %",
    format: "number",
    width: 16,
    headerPalette: "gold"
  },
  {
    key: "rentaVariable3Pct",
    label: "RV 3 %",
    required: false,
    description: "3° tramo: porcentaje de renta variable si ventas >= RV 3 Umbral UF",
    format: "number",
    width: 12,
    headerPalette: "gold"
  },
  {
    key: "ggccTipo",
    label: "GGCC Tipo",
    required: false,
    description: "FIJO_UF_M2=por m2 | FIJO_UF=monto fijo total",
    validation: {
      type: "list",
      values: ["FIJO_UF_M2", "FIJO_UF"]
    },
    width: 16,
    headerPalette: "teal"
  },
  {
    key: "ggccValor",
    label: "GGCC Valor",
    required: false,
    description: "UF/m2 si FIJO_UF_M2 | UF total si FIJO_UF. Ej: 0.37 o 37",
    format: "number",
    width: 18,
    headerPalette: "teal"
  },
  {
    key: "ggccMesesReajuste",
    label: "GGCC Meses Reajuste",
    required: false,
    description: "Meses hasta proximo reajuste. Ej: 12",
    format: "number",
    width: 20,
    headerPalette: "teal"
  },
  {
    key: "ggccPctReajuste",
    label: "GGCC % Reajuste",
    required: false,
    description: "Obligatorio si informas GGCC Meses Reajuste. Ej: 5",
    format: "number",
    width: 18,
    headerPalette: "teal"
  },
  {
    key: "anexoFecha",
    label: "Fecha Anexo",
    required: false,
    description: "Solo si hay modificacion contractual",
    format: "date",
    width: 14,
    headerPalette: "slate"
  },
  {
    key: "anexoDescripcion",
    label: "Descripcion Anexo",
    required: false,
    description: "Descripcion de la modificacion al contrato original",
    width: 30,
    headerPalette: "slate"
  }
];

export async function GET(): Promise<NextResponse> {
  try {
    await requireSession();

    const buffer = buildXlsxTemplate({
      sheetName: "Contratos",
      title: "Plantilla de Carga - Contratos",
      subtitle: "Mall Sport - Capital Advisors AGF",
      columns,
      exampleRows: [
        {
          localCodigo: "L-101",
          arrendatarioNombre: "Tienda ACME",
          fechaInicio: "2025-01-01",
          fechaTermino: "2028-12-31",
          fechaEntrega: "2024-12-15",
          fechaApertura: "2025-01-10",
          pctFondoPromocion: "2.5",
          multiplicadorDiciembre: "1.25",
          codigoCC: "CC-101",
          ggccPctAdministracion: "5",
          notas: "Contrato principal local L-101 con fondo de promocion",
          tarifaTipo: "FIJO_UF_M2",
          tarifaValor: "0.45",
          tarifaVigenciaDesde: "2025-01-01",
          tarifaVigenciaHasta: "",
          tarifa2Valor: "",
          tarifa2VigenciaDesde: "",
          tarifa2VigenciaHasta: "",
          tarifa3Valor: "",
          tarifa3VigenciaDesde: "",
          tarifa3VigenciaHasta: "",
          tarifa4Valor: "",
          tarifa4VigenciaDesde: "",
          tarifa4VigenciaHasta: "",
          tarifa5Valor: "",
          tarifa5VigenciaDesde: "",
          tarifa5VigenciaHasta: "",
          rentaVariablePct: "",
          rentaVariable2UmbralUf: "",
          rentaVariable2Pct: "",
          rentaVariable3UmbralUf: "",
          rentaVariable3Pct: "",
          ggccTipo: "FIJO_UF_M2",
          ggccValor: "0.37",
          ggccMesesReajuste: "12",
          ggccPctReajuste: "5",
          anexoFecha: "",
          anexoDescripcion: ""
        },
        {
          localCodigo: "L-101",
          arrendatarioNombre: "Tienda ACME",
          fechaInicio: "2025-01-01",
          fechaTermino: "2028-12-31",
          fechaEntrega: "2024-12-15",
          fechaApertura: "2025-01-10",
          pctFondoPromocion: "2.5",
          multiplicadorDiciembre: "1.25",
          codigoCC: "CC-101",
          ggccPctAdministracion: "5",
          notas: "Renta variable escalonada: 5% base, 7% desde 1000 UF, 10% desde 2000 UF",
          tarifaTipo: "FIJO_UF_M2",
          tarifaValor: "0.45",
          tarifaVigenciaDesde: "2025-01-01",
          tarifaVigenciaHasta: "",
          tarifa2Valor: "",
          tarifa2VigenciaDesde: "",
          tarifa2VigenciaHasta: "",
          tarifa3Valor: "",
          tarifa3VigenciaDesde: "",
          tarifa3VigenciaHasta: "",
          tarifa4Valor: "",
          tarifa4VigenciaDesde: "",
          tarifa4VigenciaHasta: "",
          tarifa5Valor: "",
          tarifa5VigenciaDesde: "",
          tarifa5VigenciaHasta: "",
          rentaVariablePct: "5.00",
          rentaVariable2UmbralUf: "1000",
          rentaVariable2Pct: "7.00",
          rentaVariable3UmbralUf: "2000",
          rentaVariable3Pct: "10.00",
          ggccTipo: "",
          ggccValor: "",
          ggccMesesReajuste: "",
          ggccPctReajuste: "",
          anexoFecha: "",
          anexoDescripcion: ""
        },
        {
          localCodigo: "L-102",
          arrendatarioNombre: "Tienda Escalonada",
          fechaInicio: "2025-01-01",
          fechaTermino: "2027-12-31",
          fechaEntrega: "",
          fechaApertura: "",
          pctFondoPromocion: "",
          multiplicadorDiciembre: "",
          codigoCC: "CC-102",
          ggccPctAdministracion: "",
          notas: "Tarifa escalonada 3 tramos: 0.40/0.45/0.50 UF m2",
          tarifaTipo: "FIJO_UF_M2",
          tarifaValor: "0.40",
          tarifaVigenciaDesde: "2025-01-01",
          tarifaVigenciaHasta: "2025-12-31",
          tarifa2Valor: "0.45",
          tarifa2VigenciaDesde: "2026-01-01",
          tarifa2VigenciaHasta: "2026-12-31",
          tarifa3Valor: "0.50",
          tarifa3VigenciaDesde: "2027-01-01",
          tarifa3VigenciaHasta: "",
          tarifa4Valor: "",
          tarifa4VigenciaDesde: "",
          tarifa4VigenciaHasta: "",
          tarifa5Valor: "",
          tarifa5VigenciaDesde: "",
          tarifa5VigenciaHasta: "",
          rentaVariablePct: "",
          rentaVariable2UmbralUf: "",
          rentaVariable2Pct: "",
          rentaVariable3UmbralUf: "",
          rentaVariable3Pct: "",
          ggccTipo: "",
          ggccValor: "",
          ggccMesesReajuste: "",
          ggccPctReajuste: "",
          anexoFecha: "",
          anexoDescripcion: ""
        },
        {
          localCodigo: "BOD-01",
          arrendatarioNombre: "Bodega Beta",
          fechaInicio: "2026-01-01",
          fechaTermino: "2027-12-31",
          fechaEntrega: "",
          fechaApertura: "",
          pctFondoPromocion: "",
          multiplicadorDiciembre: "",
          codigoCC: "CC-BOD-01",
          ggccPctAdministracion: "",
          notas: "Bodega con periodo de gracia inicial",
          tarifaTipo: "FIJO_UF",
          tarifaValor: "35",
          tarifaVigenciaDesde: "2026-01-01",
          tarifaVigenciaHasta: "",
          tarifa2Valor: "",
          tarifa2VigenciaDesde: "",
          tarifa2VigenciaHasta: "",
          tarifa3Valor: "",
          tarifa3VigenciaDesde: "",
          tarifa3VigenciaHasta: "",
          tarifa4Valor: "",
          tarifa4VigenciaDesde: "",
          tarifa4VigenciaHasta: "",
          tarifa5Valor: "",
          tarifa5VigenciaDesde: "",
          tarifa5VigenciaHasta: "",
          rentaVariablePct: "",
          rentaVariable2UmbralUf: "",
          rentaVariable2Pct: "",
          rentaVariable3UmbralUf: "",
          rentaVariable3Pct: "",
          ggccTipo: "",
          ggccValor: "",
          ggccMesesReajuste: "",
          ggccPctReajuste: "",
          anexoFecha: "",
          anexoDescripcion: ""
        }
      ],
      instrucciones: instruccionesGenerales
    });

    return new NextResponse(Uint8Array.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="plantilla-contratos.xlsx"'
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

