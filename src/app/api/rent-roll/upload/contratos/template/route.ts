import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    await requireSession();

    const csvContent = [
      "numeroContrato,localCodigo,arrendatarioRut,estado,fechaInicio,fechaTermino,tarifaTipo,tarifaValor,tarifaVigenciaDesde,tarifaVigenciaHasta,pctRentaVariable,pctFondoPromocion,codigoCC,notas,ggccTarifaBaseUfM2,ggccPctAdministracion,ggccVigenciaDesde,ggccVigenciaHasta,anexoFecha,anexoDescripcion",
      "C-1001,L-101,12345678-k,VIGENTE,2025-01-01,2028-12-31,FIJO_UF_M2,0.45,2025-01-01,2025-12-31,5.0,1.0,CC-10,Contrato inicial,0.10,8.5,2025-01-01,2025-12-31,2025-01-15,Anexo inicial"
    ].join("\n");
    const csvWithBom = `\uFEFF${csvContent}`;

    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="plantilla-contratos.csv"'
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
