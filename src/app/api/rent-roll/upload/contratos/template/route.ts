export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";
import { buildXlsxTemplate, type ColumnDef } from "@/lib/upload/xlsx-template";

export const runtime = "nodejs";

const instruccionesGenerales = [
  "Complete solo desde la fila 6 (las filas amarillas son de ejemplo - puede borrarlas)",
  "Las columnas con fondo dorado son OBLIGATORIAS",
  "No modifique los encabezados (fila 3) - el sistema los usa para identificar columnas",
  "Guarde el archivo como .xlsx o .csv antes de subir",
  "Formato de fechas aceptado: YYYY-MM-DD (recomendado) o DD/MM/YYYY",
  "Para los campos con lista desplegable, use solo los valores de la lista",
  "Para renta variable por periodos, use filas adicionales por contrato (columnas Renta Variable %)."
];

const columns: ColumnDef[] = [
  {
    key: "numeroContrato",
    label: "N Contrato",
    required: true,
    description: "Codigo unico del contrato. Ej: C-1001",
    width: 16,
    headerPalette: "navy"
  },
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
    description: "Opcional. Porcentaje aplicado al contrato. Ej: 2.5",
    format: "number",
    width: 18,
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
    description: "FIJO_UF_M2=por m2 | FIJO_UF=monto fijo | PORCENTAJE=% ventas",
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
    description: "UF/m2 si FIJO_UF_M2 | UF si FIJO_UF | % si PORCENTAJE",
    format: "number",
    width: 14,
    headerPalette: "gold"
  },
  {
    key: "tarifaVigenciaDesde",
    label: "Tarifa Desde",
    required: true,
    description: "YYYY-MM-DD",
    format: "date",
    width: 14,
    headerPalette: "gold"
  },
  {
    key: "tarifaVigenciaHasta",
    label: "Tarifa Hasta",
    required: false,
    description: "Vacio = indefinido",
    format: "date",
    width: 14,
    headerPalette: "gold"
  },
  {
    key: "rentaVariablePct",
    label: "Renta Variable %",
    required: false,
    description: "Opcional. Alternativa para cargar PORCENTAJE por vigencia",
    format: "number",
    width: 18,
    headerPalette: "gold"
  },
  {
    key: "rentaVariableVigenciaDesde",
    label: "Renta Var. Desde",
    required: false,
    description: "Obligatorio si informa Renta Variable %",
    format: "date",
    width: 18,
    headerPalette: "gold"
  },
  {
    key: "rentaVariableVigenciaHasta",
    label: "Renta Var. Hasta",
    required: false,
    description: "Vacio = indefinido",
    format: "date",
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
          numeroContrato: "C-1001",
          localCodigo: "L-101",
          arrendatarioRut: "76543210-k",
          estado: "VIGENTE",
          fechaInicio: "2025-01-01",
          fechaTermino: "2028-12-31",
          fechaEntrega: "2024-12-15",
          fechaApertura: "2025-01-10",
          pctFondoPromocion: "2.5",
          codigoCC: "CC-101",
          ggccPctAdministracion: "5",
          notas: "Contrato principal local L-101",
          tarifaTipo: "FIJO_UF_M2",
          tarifaValor: "0.45",
          tarifaVigenciaDesde: "2025-01-01",
          tarifaVigenciaHasta: "",
          rentaVariablePct: "",
          rentaVariableVigenciaDesde: "",
          rentaVariableVigenciaHasta: "",
          ggccTipo: "FIJO_UF_M2",
          ggccValor: "0.37",
          ggccVigenciaDesde: "2025-01-01",
          ggccVigenciaHasta: "",
          ggccMesesReajuste: "12",
          anexoFecha: "",
          anexoDescripcion: ""
        },
        {
          numeroContrato: "C-1001",
          localCodigo: "L-101",
          arrendatarioRut: "76543210-k",
          estado: "VIGENTE",
          fechaInicio: "2025-01-01",
          fechaTermino: "2028-12-31",
          fechaEntrega: "2024-12-15",
          fechaApertura: "2025-01-10",
          pctFondoPromocion: "2.5",
          codigoCC: "CC-101",
          ggccPctAdministracion: "5",
          notas: "Contrato principal local L-101",
          tarifaTipo: "",
          tarifaValor: "",
          tarifaVigenciaDesde: "",
          tarifaVigenciaHasta: "",
          rentaVariablePct: "5.00",
          rentaVariableVigenciaDesde: "2025-01-01",
          rentaVariableVigenciaHasta: "",
          ggccTipo: "",
          ggccValor: "",
          ggccVigenciaDesde: "",
          ggccVigenciaHasta: "",
          ggccMesesReajuste: "",
          anexoFecha: "",
          anexoDescripcion: ""
        },
        {
          numeroContrato: "C-1002",
          localCodigo: "BOD-01",
          arrendatarioRut: "65432109-8",
          estado: "GRACIA",
          fechaInicio: "2026-01-01",
          fechaTermino: "2027-12-31",
          fechaEntrega: "",
          fechaApertura: "",
          pctFondoPromocion: "",
          codigoCC: "CC-BOD-01",
          ggccPctAdministracion: "",
          notas: "Bodega con periodo de gracia inicial",
          tarifaTipo: "FIJO_UF",
          tarifaValor: "35",
          tarifaVigenciaDesde: "2026-01-01",
          tarifaVigenciaHasta: "",
          rentaVariablePct: "",
          rentaVariableVigenciaDesde: "",
          rentaVariableVigenciaHasta: "",
          ggccTipo: "",
          ggccValor: "",
          ggccVigenciaDesde: "",
          ggccVigenciaHasta: "",
          ggccMesesReajuste: "",
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

