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
    key: "ggccTarifaBaseUfM2",
    label: "GGCC Tarifa Base (UF/m2)",
    required: false,
    description: "Costo gasto comun por m2. Ej: 0.37",
    format: "number",
    width: 24,
    headerPalette: "teal"
  },
  {
    key: "ggccPctAdministracion",
    label: "GGCC % Administracion",
    required: false,
    description: "% adicional por gestion. Ej: 5 (para 5%)",
    format: "number",
    width: 22,
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
          tarifaTipo: "FIJO_UF_M2",
          tarifaValor: "0.45",
          tarifaVigenciaDesde: "2025-01-01",
          tarifaVigenciaHasta: "",
          rentaVariablePct: "",
          rentaVariableVigenciaDesde: "",
          rentaVariableVigenciaHasta: "",
          ggccTarifaBaseUfM2: "0.37",
          ggccPctAdministracion: "5",
          ggccVigenciaDesde: "2025-01-01",
          ggccVigenciaHasta: "",
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
          tarifaTipo: "",
          tarifaValor: "",
          tarifaVigenciaDesde: "",
          tarifaVigenciaHasta: "",
          rentaVariablePct: "5.00",
          rentaVariableVigenciaDesde: "2025-01-01",
          rentaVariableVigenciaHasta: "",
          ggccTarifaBaseUfM2: "",
          ggccPctAdministracion: "",
          ggccVigenciaDesde: "",
          ggccVigenciaHasta: "",
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
          tarifaTipo: "FIJO_UF",
          tarifaValor: "35",
          tarifaVigenciaDesde: "2026-01-01",
          tarifaVigenciaHasta: "",
          rentaVariablePct: "",
          rentaVariableVigenciaDesde: "",
          rentaVariableVigenciaHasta: "",
          ggccTarifaBaseUfM2: "",
          ggccPctAdministracion: "",
          ggccVigenciaDesde: "",
          ggccVigenciaHasta: "",
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

