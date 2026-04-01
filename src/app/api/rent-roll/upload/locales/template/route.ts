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
  "Para los campos con lista desplegable, use solo los valores de la lista"
];

const columns: ColumnDef[] = [
  {
    key: "codigo",
    label: "Codigo del Local",
    required: true,
    description: "Identificador unico. Ej: L-101, 101A",
    width: 18
  },
  {
    key: "nombre",
    label: "Nombre del Local",
    required: true,
    description: "Nombre descriptivo o comercial del espacio",
    width: 28
  },
  {
    key: "glam2",
    label: "GLA (m2) (opcional)",
    required: false,
    description: "Metros cuadrados arrendables. Si viene vacio se considera 0.",
    format: "number",
    width: 14
  },
  {
    key: "piso",
    label: "Piso",
    required: true,
    description: "Numero de piso donde se ubica el local. Ej: 1, 2, -1",
    width: 10
  },
  {
    key: "tipo",
    label: "Tipo de Local",
    required: true,
    description: "Categoria del espacio",
    validation: {
      type: "list",
      values: ["LOCAL_COMERCIAL", "SIMULADOR", "MODULO", "ESPACIO", "BODEGA", "OTRO"]
    },
    width: 20
  },
  {
    key: "zona",
    label: "Zona / Categoria",
    required: false,
    description: "Agrupacion comercial. Ej: Outdoor, Gastronomia, Gimnasio",
    width: 20
  },
  {
    key: "esGLA",
    label: "Aplica para GLA?",
    required: true,
    description: "true = cuenta para ocupacion. false = espacio no arrendable",
    validation: {
      type: "list",
      values: ["true", "false"]
    },
    width: 20
  },
  {
    key: "estado",
    label: "Estado",
    required: true,
    description: "ACTIVO = disponible. INACTIVO = no disponible",
    validation: {
      type: "list",
      values: ["ACTIVO", "INACTIVO"]
    },
    width: 14
  }
];

export async function GET(): Promise<NextResponse> {
  try {
    await requireSession();

    const buffer = buildXlsxTemplate({
      sheetName: "Locales",
      title: "Plantilla de Carga - Locales",
      subtitle: "Mall Sport - Capital Advisors AGF",
      columns,
      exampleRows: [
        {
          codigo: "L-101",
          nombre: "Local Deportes Outdoor",
          glam2: "120.5",
          piso: "1",
          tipo: "LOCAL_COMERCIAL",
          zona: "Outdoor",
          esGLA: "true",
          estado: "ACTIVO"
        },
        {
          codigo: "BOD-01",
          nombre: "Bodega Norte",
          glam2: "45.0",
          piso: "-1",
          tipo: "BODEGA",
          zona: "",
          esGLA: "false",
          estado: "ACTIVO"
        }
      ],
      instrucciones: instruccionesGenerales
    });

    return new NextResponse(Uint8Array.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="plantilla-locales.xlsx"'
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

