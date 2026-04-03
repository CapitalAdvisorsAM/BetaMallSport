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
  "Para renta variable use una sola fila por contrato en la columna Renta Variable %; el sistema aplica las fechas del contrato automaticamente"
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
    key: "arrendatarioRut",
    label: "RUT Arrendatario",
    required: true,
    description: "Debe existir en el sistema. Sin puntos con guion",
    width: 20,
    headerPalette: "navy"
  },
  {
    key: "estado",
    label: "Estado",
    required: true,
    description: "VIGENTE=activo | GRACIA=sin pago aun | TERMINADO=finalizado",
    validation: {
      type: "list",
      values: ["VIGENTE", "GRACIA", "TERMINADO", "TERMINADO_ANTICIPADO"]
    },
    width: 22,
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
    description: "Para tarifa fija: FIJO_UF_M2=por m2 | FIJO_UF=monto fijo. Dejar vacio si la fila solo carga Renta Variable %",
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
    key: "rentaVariablePct",
    label: "Renta Variable %",
    required: false,
    description: "Opcional. Una sola fila por contrato. Usa automaticamente fechaInicio y fechaTermino del contrato",
    format: "number",
    width: 18,
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
    key: "ggccVigenciaDesde",
    label: "GGCC Desde",
    required: false,
    description: "YYYY-MM-DD",
    format: "date",
    width: 14,
    headerPalette: "teal"
  },
  {
    key: "ggccVigenciaHasta",
    label: "GGCC Hasta",
    required: false,
    description: "Vacio = indefinido",
    format: "date",
    width: 14,
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
          arrendatarioRut: "76543210-k",
          estado: "VIGENTE",
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
          rentaVariablePct: "",
          ggccTipo: "FIJO_UF_M2",
          ggccValor: "0.37",
          ggccVigenciaDesde: "2025-01-01",
          ggccVigenciaHasta: "",
          ggccMesesReajuste: "12",
          ggccPctReajuste: "5",
          anexoFecha: "",
          anexoDescripcion: ""
        },
        {
          localCodigo: "L-101",
          arrendatarioRut: "76543210-k",
          estado: "VIGENTE",
          fechaInicio: "2025-01-01",
          fechaTermino: "2028-12-31",
          fechaEntrega: "2024-12-15",
          fechaApertura: "2025-01-10",
          pctFondoPromocion: "2.5",
          multiplicadorDiciembre: "1.25",
          codigoCC: "CC-101",
          ggccPctAdministracion: "5",
          notas: "Renta variable sin fechas propias; usa fechas del contrato",
          tarifaTipo: "",
          tarifaValor: "",
          tarifaVigenciaDesde: "",
          tarifaVigenciaHasta: "",
          rentaVariablePct: "5.00",
          ggccTipo: "",
          ggccValor: "",
          ggccVigenciaDesde: "",
          ggccVigenciaHasta: "",
          ggccMesesReajuste: "",
          ggccPctReajuste: "",
          anexoFecha: "",
          anexoDescripcion: ""
        },
        {
          localCodigo: "BOD-01",
          arrendatarioRut: "65432109-8",
          estado: "GRACIA",
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
          rentaVariablePct: "",
          ggccTipo: "",
          ggccValor: "",
          ggccVigenciaDesde: "",
          ggccVigenciaHasta: "",
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

