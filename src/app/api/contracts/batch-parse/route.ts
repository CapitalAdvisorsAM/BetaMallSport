export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { read, utils } from "xlsx";
import { ApiError, handleApiError } from "@/lib/api-error";
import { MAX_PDF_BYTES } from "@/lib/constants";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { normalizeUploadTenantName } from "@/lib/upload/parse-contracts";
import { normalizeHeaders, parseDate } from "@/lib/upload/parse-utils";

export const runtime = "nodejs";

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
}

function nullableStr(value: unknown): string | null {
  const s = asString(value);
  return s || null;
}

type TarifaRow = {
  tipo: string;
  valor: string;
  vigenciaDesde: string;
  vigenciaHasta: string | null;
};

type GgccRow = {
  tipo: string;
  valor: string;
  pctAdministracion: string;
  pctReajuste: string | null;
  mesesReajuste: number | null;
};

type ContractGroup = {
  localCodigo: string;
  arrendatarioNombre: string;
  fechaInicio: string;
  fechaTermino: string;
  fechaEntrega: string | null;
  fechaApertura: string | null;
  pctFondoPromocion: string | null;
  multiplicadorDiciembre: string | null;
  multiplicadorJunio: string | null;
  multiplicadorJulio: string | null;
  multiplicadorAgosto: string | null;
  codigoCC: string | null;
  pctAdministracionGgcc: string | null;
  notas: string | null;
  tarifas: TarifaRow[];
  rentaVariable: Array<{ pctRentaVariable: string; umbralVentasUf: string; pisoMinimoUf: string | null }>;
  ggcc: GgccRow[];
  anexoFecha: string | null;
  anexoDescripcion: string | null;
};

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireSession();

    const formData = await request.formData();
    const file = formData.get("file");
    const proyectoId = String(formData.get("proyectoId") ?? "").trim();

    if (!proyectoId) {
      throw new ApiError(400, "proyectoId es obligatorio.");
    }
    if (!(file instanceof File)) {
      throw new ApiError(400, "Debes adjuntar un archivo.");
    }
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
      throw new ApiError(400, "Solo se aceptan archivos CSV o Excel (.xlsx/.xls).");
    }
    if (file.size > MAX_PDF_BYTES) {
      throw new ApiError(400, "El archivo supera el limite de 10MB.");
    }

    const buffer = await file.arrayBuffer();
    const wb = read(Buffer.from(buffer), { type: "buffer", raw: false, cellDates: false });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      throw new ApiError(400, "El archivo no contiene hojas.");
    }

    const rawRows = utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], {
      defval: "",
      raw: false,
      range: 2
    });
    const rows = rawRows.map(normalizeHeaders);

    const [locales, arrendatarios] = await Promise.all([
      prisma.unit.findMany({
        where: { projectId: proyectoId },
        select: { id: true, codigo: true, glam2: true }
      }),
      prisma.tenant.findMany({
        where: { projectId: proyectoId },
        select: { id: true, nombreComercial: true }
      })
    ]);

    const localMap = new Map(
      locales.map((l) => [l.codigo.toUpperCase(), { id: l.id, glam2: l.glam2.toString() }])
    );
    const arrendatarioMap = new Map<string, string[]>();
    for (const arrendatario of arrendatarios) {
      const normalizedName = normalizeUploadTenantName(arrendatario.nombreComercial);
      if (!normalizedName) {
        continue;
      }
      const existing = arrendatarioMap.get(normalizedName) ?? [];
      existing.push(arrendatario.id);
      arrendatarioMap.set(normalizedName, existing);
    }

    const contractMap = new Map<string, ContractGroup>();
    let skipped = 0;

    for (const row of rows) {
      const localCodigo = asString(row.localcodigo).toUpperCase();
      const arrendatarioNombre = asString(row.arrendatarionombre);
      const arrendatarioNombreLookup = normalizeUploadTenantName(arrendatarioNombre);
      const fechaInicio = parseDate(row.fechainicio);
      const fechaTermino = parseDate(row.fechatermino);

      if (!localCodigo || !arrendatarioNombreLookup || !fechaInicio || !fechaTermino) {
        if (localCodigo || arrendatarioNombreLookup) skipped++;
        continue;
      }

      const key = `${localCodigo}|${arrendatarioNombreLookup}|${fechaInicio}|${fechaTermino}`;

      if (!contractMap.has(key)) {
        contractMap.set(key, {
          localCodigo,
          arrendatarioNombre,
          fechaInicio,
          fechaTermino,
          fechaEntrega: parseDate(row.fechaentrega),
          fechaApertura: parseDate(row.fechaapertura),
          pctFondoPromocion: nullableStr(row.pctfondopromocion),
          multiplicadorDiciembre: nullableStr(row.multiplicadordiciembre),
          multiplicadorJunio: nullableStr(row.multiplicadorjunio),
          multiplicadorJulio: nullableStr(row.multiplicadorjulio),
          multiplicadorAgosto: nullableStr(row.multiplicadoragosto),
          codigoCC: nullableStr(row.codigocc),
          pctAdministracionGgcc: nullableStr(row.ggccpctadministracion),
          notas: nullableStr(row.notas),
          tarifas: [],
          rentaVariable: [],
          ggcc: [],
          anexoFecha: parseDate(row.anexofecha),
          anexoDescripcion: nullableStr(row.anexodescripcion)
        });
      }

      const group = contractMap.get(key)!;

      // Tarifas
      const rentaVariablePct = nullableStr(row.rentavariablepct);
      const rvPisoMin = nullableStr(row.rentavariablepisominimouf);
      const rv2Umbral = nullableStr(row.rentavariable2umbraluf);
      const rv2Pct = nullableStr(row.rentavariable2pct);
      const rv2PisoMin = nullableStr(row.rentavariable2pisominimouf);
      const rv3Umbral = nullableStr(row.rentavariable3umbraluf);
      const rv3Pct = nullableStr(row.rentavariable3pct);
      const rv3PisoMin = nullableStr(row.rentavariable3pisominimouf);
      const tarifaTipo = asString(row.tarifatipo).toUpperCase();
      const tarifaValor = asString(row.tarifavalor).replace(",", ".");
      const tarifaVigenciaDesde = parseDate(row.tarifavigenciadesde);
      const tarifaVigenciaHasta = parseDate(row.tarifavigenciahasta);

      if (rentaVariablePct) {
        if (!group.rentaVariable.some((r) => r.umbralVentasUf === "0")) {
          group.rentaVariable.push({ pctRentaVariable: rentaVariablePct, umbralVentasUf: "0", pisoMinimoUf: rvPisoMin });
        }
        if (rv2Umbral && rv2Pct && !group.rentaVariable.some((r) => r.umbralVentasUf === rv2Umbral)) {
          group.rentaVariable.push({ pctRentaVariable: rv2Pct, umbralVentasUf: rv2Umbral, pisoMinimoUf: rv2PisoMin });
        }
        if (rv3Umbral && rv3Pct && !group.rentaVariable.some((r) => r.umbralVentasUf === rv3Umbral)) {
          group.rentaVariable.push({ pctRentaVariable: rv3Pct, umbralVentasUf: rv3Umbral, pisoMinimoUf: rv3PisoMin });
        }
      } else if (tarifaTipo && tarifaValor && tarifaVigenciaDesde) {
        const tarifaKey = `${tarifaTipo}-${tarifaVigenciaDesde}`;
        if (!group.tarifas.some((t) => `${t.tipo}-${t.vigenciaDesde}` === tarifaKey)) {
          group.tarifas.push({
            tipo: tarifaTipo,
            valor: tarifaValor,
            vigenciaDesde: tarifaVigenciaDesde,
            vigenciaHasta: tarifaVigenciaHasta
          });
        }
      }

      // GGCC
      const ggccValor = nullableStr(row.ggccvalor);
      const ggccPctAdministracion = nullableStr(row.ggccpctadministracion);

      if (ggccValor && ggccPctAdministracion) {
        const alreadyExists = group.ggcc.length > 0;
        if (!alreadyExists) {
          const ggccTipo = asString(row.ggcctipo).toUpperCase() || "FIJO_UF_M2";
          const ggccMesesReajusteRaw = nullableStr(row.ggccmesesreajuste);
          const ggccMesesReajuste = ggccMesesReajusteRaw
            ? (Number.parseInt(ggccMesesReajusteRaw, 10) || null)
            : null;
          group.ggcc.push({
            tipo: ggccTipo,
            valor: ggccValor,
            pctAdministracion: ggccPctAdministracion,
            pctReajuste: nullableStr(row.ggccpctreajuste),
            mesesReajuste: ggccMesesReajuste
          });
        }
      }
    }

    const contracts = Array.from(contractMap.values()).map((group) => {
      const localData = localMap.get(group.localCodigo);
      const localId = localData?.id ?? "";
      const arrendatarioMatches =
        arrendatarioMap.get(normalizeUploadTenantName(group.arrendatarioNombre)) ?? [];
      const arrendatarioId = arrendatarioMatches.length === 1 ? arrendatarioMatches[0] : "";
      const localIds = localId ? [localId] : [];
      const glam2 = localData?.glam2 ? Number.parseFloat(localData.glam2) : null;

      const tarifas =
        group.tarifas.length > 0
          ? group.tarifas.map((t) => ({
              tipo: t.tipo as "FIJO_UF_M2" | "FIJO_UF" | "PORCENTAJE",
              valor: t.valor,
              vigenciaDesde: t.vigenciaDesde,
              vigenciaHasta: t.vigenciaHasta,
              esDiciembre: false,
              _key: crypto.randomUUID()
            }))
          : [
              {
                tipo: "FIJO_UF_M2" as const,
                valor: "",
                vigenciaDesde: group.fechaInicio,
                vigenciaHasta: null,
                esDiciembre: false,
                _key: crypto.randomUUID()
              }
            ];

      const rentaVariable = group.rentaVariable.map((rv) => ({
        pctRentaVariable: rv.pctRentaVariable,
        umbralVentasUf: rv.umbralVentasUf,
        pisoMinimoUf: rv.pisoMinimoUf,
        vigenciaDesde: group.fechaInicio,
        vigenciaHasta: group.fechaTermino,
        _key: crypto.randomUUID()
      }));

      const ggcc = group.ggcc.map((g) => {
        let tarifaBaseUfM2 = g.valor;
        if (g.tipo === "FIJO_UF" && glam2 && glam2 > 0) {
          tarifaBaseUfM2 = String(Number.parseFloat(g.valor) / glam2);
        }
        return {
          tarifaBaseUfM2,
          pctAdministracion: g.pctAdministracion,
          pctReajuste: g.pctReajuste,
          proximoReajuste: null,
          mesesReajuste: g.mesesReajuste,
          _key: crypto.randomUUID()
        };
      });

      return {
        proyectoId,
        localId,
        localIds,
        arrendatarioId,
        fechaInicio: group.fechaInicio,
        fechaTermino: group.fechaTermino,
        fechaEntrega: group.fechaEntrega,
        fechaApertura: group.fechaApertura,
        pctFondoPromocion: group.pctFondoPromocion,
        multiplicadorDiciembre: group.multiplicadorDiciembre,
        multiplicadorJunio: group.multiplicadorJunio,
        multiplicadorJulio: group.multiplicadorJulio,
        multiplicadorAgosto: group.multiplicadorAgosto,
        codigoCC: group.codigoCC,
        pctAdministracionGgcc: group.pctAdministracionGgcc,
        notas: group.notas,
        pdfUrl: null,
        tarifas,
        rentaVariable,
        ggcc,
        anexo:
          group.anexoFecha && group.anexoDescripcion
            ? { fecha: group.anexoFecha, descripcion: group.anexoDescripcion }
            : null,
        // display hints
        localCodigo: group.localCodigo,
        arrendatarioNombre: group.arrendatarioNombre
      };
    });

    return NextResponse.json({ contracts, skipped });
  } catch (error) {
    return handleApiError(error);
  }
}
