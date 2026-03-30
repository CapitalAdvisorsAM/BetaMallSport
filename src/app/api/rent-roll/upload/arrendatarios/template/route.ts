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
    key: "rut",
    label: "RUT",
    required: true,
    description: "Sin puntos, con guion. Ej: 12345678-9 o 12345678-k",
    width: 18
  },
  {
    key: "razonSocial",
    label: "Razon Social",
    required: true,
    description: "Nombre legal de la empresa (como en el SII)",
    width: 35
  },
  {
    key: "nombreComercial",
    label: "Nombre Comercial",
    required: true,
    description: "Nombre visible en tienda. Puede diferir de razon social",
    width: 28
  },
  {
    key: "vigente",
    label: "Vigente?",
    required: true,
    description: "true = activo, puede recibir contratos. false = inactivo",
    validation: {
      type: "list",
      values: ["true", "false"]
    },
    width: 14
  },
  {
    key: "email",
    label: "Email de contacto",
    required: false,
    description: "Correo del contacto comercial del arrendatario",
    width: 30
  },
  {
    key: "telefono",
    label: "Telefono",
    required: false,
    description: "Formato: +56911112222",
    width: 18
  }
];

export async function GET(): Promise<NextResponse> {
  try {
    await requireSession();

    const buffer = buildXlsxTemplate({
      sheetName: "Arrendatarios",
      title: "Plantilla de Carga - Arrendatarios",
      subtitle: "Mall Sport - Capital Advisors AGF",
      columns,
      exampleRows: [
        {
          rut: "76543210-k",
          razonSocial: "Deportes del Sur SpA",
          nombreComercial: "Columbia",
          vigente: "true",
          email: "contacto@columbia.cl",
          telefono: "+56911112222"
        },
        {
          rut: "65432109-8",
          razonSocial: "The North Face Chile Ltda",
          nombreComercial: "The North Face",
          vigente: "true",
          email: "",
          telefono: ""
        }
      ],
      instrucciones: instruccionesGenerales
    });

    return new NextResponse(Uint8Array.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="plantilla-arrendatarios.xlsx"'
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

