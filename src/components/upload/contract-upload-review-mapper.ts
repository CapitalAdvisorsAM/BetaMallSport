import type { ContractManagerOption } from "@/types";
import type { ContractDraftPayload, UploadReviewExtras } from "@/components/contracts/ContractForm";
import type { PreviewRow } from "@/types/upload";

type UploadRecord = Record<string, unknown>;

export type UploadPreviewRowDraft = {
  draft: ContractDraftPayload;
  extras: UploadReviewExtras;
};

function asString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function asNullableString(value: unknown): string | null {
  const normalized = asString(value).trim();
  return normalized ? normalized : null;
}

function isMeaningful(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

function createDraftKey(): string {
  return crypto.randomUUID();
}

export function buildUploadReviewOptions(
  localCodes: string[],
  arrendatarios: ContractManagerOption[]
): {
  locals: ContractManagerOption[];
  arrendatarios: ContractManagerOption[];
} {
  return {
    locals: localCodes.map((code) => ({ id: code, label: code })),
    arrendatarios: arrendatarios.map((arrendatario) => ({
      id: arrendatario.label.trim(),
      label: arrendatario.label
    }))
  };
}

export function previewRowToUploadDraft(
  row: PreviewRow<UploadRecord>,
  proyectoId: string
): UploadPreviewRowDraft {
  const localCodigo = asString(row.data.localCodigo).trim().toUpperCase();
  const arrendatarioNombre = asString(row.data.arrendatarioNombre).trim();
  const tarifaTipo = asString(row.data.tarifaTipo).trim().toUpperCase();
  const tarifaValor = asString(row.data.tarifaValor).trim();
  const ggccPctAdministracion = asNullableString(row.data.ggccPctAdministracion);
  const ggccPctReajuste = asNullableString(row.data.ggccPctReajuste);
  const ggccMesesReajusteRaw = asNullableString(row.data.ggccMesesReajuste);
  const ggccMesesReajuste = ggccMesesReajusteRaw ? Number.parseInt(ggccMesesReajusteRaw, 10) || null : null;

  const isOnlyRentaVariable = tarifaTipo === "PORCENTAJE";
  const rentaVariablePctValue = asNullableString(row.data.rentaVariablePct);

  const TRAMO_KEYS = [
    { valor: "tarifaValor", desde: "tarifaVigenciaDesde", hasta: "tarifaVigenciaHasta" },
    { valor: "tarifa2Valor", desde: "tarifa2VigenciaDesde", hasta: "tarifa2VigenciaHasta" },
    { valor: "tarifa3Valor", desde: "tarifa3VigenciaDesde", hasta: "tarifa3VigenciaHasta" },
    { valor: "tarifa4Valor", desde: "tarifa4VigenciaDesde", hasta: "tarifa4VigenciaHasta" },
    { valor: "tarifa5Valor", desde: "tarifa5VigenciaDesde", hasta: "tarifa5VigenciaHasta" }
  ];

  const tarifas = isOnlyRentaVariable
    ? []
    : TRAMO_KEYS.filter((k) => isMeaningful(asNullableString(row.data[k.valor]))).map((k) => ({
        _key: createDraftKey(),
        tipo: (tarifaTipo || "FIJO_UF_M2") as "FIJO_UF_M2" | "FIJO_UF" | "PORCENTAJE",
        valor: asString(row.data[k.valor]).trim(),
        vigenciaDesde: asString(row.data[k.desde]).trim(),
        vigenciaHasta: asNullableString(row.data[k.hasta]),
        esDiciembre: false
      }));

  const basePct = rentaVariablePctValue ?? (isOnlyRentaVariable ? tarifaValor : null);
  const fechaInicioStr = asString(row.data.fechaInicio).trim();
  const fechaTerminoStr = asNullableString(row.data.fechaTermino);

  const rentaVariable: ContractDraftPayload["rentaVariable"] = [];
  if (basePct) {
    rentaVariable.push({ _key: createDraftKey(), pctRentaVariable: basePct, umbralVentasUf: "0", vigenciaDesde: fechaInicioStr, vigenciaHasta: fechaTerminoStr });
    const rv2Umbral = asNullableString(row.data.rentaVariable2UmbralUf);
    const rv2Pct = asNullableString(row.data.rentaVariable2Pct);
    if (rv2Umbral && rv2Pct) {
      rentaVariable.push({ _key: createDraftKey(), pctRentaVariable: rv2Pct, umbralVentasUf: rv2Umbral, vigenciaDesde: fechaInicioStr, vigenciaHasta: fechaTerminoStr });
    }
    const rv3Umbral = asNullableString(row.data.rentaVariable3UmbralUf);
    const rv3Pct = asNullableString(row.data.rentaVariable3Pct);
    if (rv3Umbral && rv3Pct) {
      rentaVariable.push({ _key: createDraftKey(), pctRentaVariable: rv3Pct, umbralVentasUf: rv3Umbral, vigenciaDesde: fechaInicioStr, vigenciaHasta: fechaTerminoStr });
    }
  }

  const hasAnyGgcc = [
    asNullableString(row.data.ggccValor),
    ggccPctAdministracion,
    ggccPctReajuste,
    ggccMesesReajusteRaw
  ].some(isMeaningful);

  const ggcc = hasAnyGgcc
    ? [
        {
          _key: createDraftKey(),
          tarifaBaseUfM2: asString(row.data.ggccValor).trim(),
          pctAdministracion: ggccPctAdministracion ?? "",
          pctReajuste: ggccPctReajuste,
          proximoReajuste: null,
          mesesReajuste: ggccMesesReajuste
        }
      ]
    : [];

  return {
    draft: {
      proyectoId,
      localId: localCodigo,
      localIds: localCodigo ? [localCodigo] : [],
      arrendatarioId: arrendatarioNombre,
      fechaInicio: asString(row.data.fechaInicio).trim(),
      fechaTermino: asString(row.data.fechaTermino).trim(),
      fechaEntrega: asNullableString(row.data.fechaEntrega),
      fechaApertura: asNullableString(row.data.fechaApertura),
      rentaVariable,
      pctFondoPromocion: asNullableString(row.data.pctFondoPromocion),
      pctAdministracionGgcc: ggccPctAdministracion,
      multiplicadorDiciembre: asNullableString(row.data.multiplicadorDiciembre),
      multiplicadorJunio: asNullableString(row.data.multiplicadorJunio),
      multiplicadorAgosto: asNullableString(row.data.multiplicadorAgosto),
      codigoCC: asNullableString(row.data.codigoCC),
      pdfUrl: null,
      diasGracia: 0,
      notas: asNullableString(row.data.notas),
      tarifas,
      ggcc,
      anexo:
        asNullableString(row.data.anexoFecha) && asNullableString(row.data.anexoDescripcion)
          ? {
              fecha: asString(row.data.anexoFecha).trim(),
              descripcion: asString(row.data.anexoDescripcion).trim()
            }
          : null
    },
    extras: {
      numeroContrato: asString(row.data.numeroContrato).trim()
    }
  };
}

export function uploadDraftToPreviewData(
  draft: ContractDraftPayload,
  extras: UploadReviewExtras
): UploadRecord {
  const localCodigo = (draft.localId ?? draft.localIds[0] ?? "").trim().toUpperCase();
  const arrendatarioNombre = (draft.arrendatarioId ?? "").trim();
  const rentaVariable = draft.rentaVariable.find((item) => isMeaningful(item.pctRentaVariable));
  const fixedTarifas = draft.tarifas.filter(
    (item) => isMeaningful(item.valor) || isMeaningful(item.vigenciaDesde) || isMeaningful(item.vigenciaHasta ?? "")
  );

  const hasMixedTarifas = Boolean(rentaVariable && fixedTarifas.length > 0);
  const isOnlyRentaVariable = Boolean(rentaVariable && fixedTarifas.length === 0);

  const tarifaTipo = isOnlyRentaVariable ? "PORCENTAJE" : (fixedTarifas[0]?.tipo ?? "FIJO_UF_M2");
  const tarifaValor = isOnlyRentaVariable ? (rentaVariable?.pctRentaVariable ?? "") : (fixedTarifas[0]?.valor ?? "");
  const tarifaVigenciaDesde = isOnlyRentaVariable ? draft.fechaInicio : (fixedTarifas[0]?.vigenciaDesde ?? "");
  const tarifaVigenciaHasta = isOnlyRentaVariable ? draft.fechaTermino : (fixedTarifas[0]?.vigenciaHasta ?? null);

  // Serialize escalonada extra tramos (indices 1-4 → tarifa2-5)
  const buildTramo = (index: number, prefix: string) => {
    const t = fixedTarifas[index];
    return {
      [`${prefix}Valor`]: t?.valor ?? null,
      [`${prefix}VigenciaDesde`]: t?.vigenciaDesde ?? null,
      [`${prefix}VigenciaHasta`]: t?.vigenciaHasta ?? null
    };
  };

  const ggcc = draft.ggcc[0];
  const ggccTipo = ggcc ? "FIJO_UF_M2" : null;
  const ggccValor = asNullableString(ggcc?.tarifaBaseUfM2 ?? null);
  const ggccPctAdministracion =
    asNullableString(ggcc?.pctAdministracion ?? null) ?? asNullableString(draft.pctAdministracionGgcc);

  return {
    numeroContrato: extras.numeroContrato.trim(),
    localCodigo,
    arrendatarioNombre,
    fechaInicio: draft.fechaInicio,
    fechaTermino: draft.fechaTermino,
    fechaEntrega: draft.fechaEntrega,
    fechaApertura: draft.fechaApertura,
    tarifaTipo,
    tarifaValor: tarifaValor.trim(),
    tarifaVigenciaDesde: tarifaVigenciaDesde.trim(),
    tarifaVigenciaHasta: asNullableString(tarifaVigenciaHasta),
    ...buildTramo(1, "tarifa2"),
    ...buildTramo(2, "tarifa3"),
    ...buildTramo(3, "tarifa4"),
    ...buildTramo(4, "tarifa5"),
    rentaVariablePct: hasMixedTarifas ? (rentaVariable?.pctRentaVariable ?? null) : null,
    rentaVariable2UmbralUf: hasMixedTarifas ? (draft.rentaVariable[1]?.umbralVentasUf ?? null) : null,
    rentaVariable2Pct: hasMixedTarifas ? (draft.rentaVariable[1]?.pctRentaVariable ?? null) : null,
    rentaVariable3UmbralUf: hasMixedTarifas ? (draft.rentaVariable[2]?.umbralVentasUf ?? null) : null,
    rentaVariable3Pct: hasMixedTarifas ? (draft.rentaVariable[2]?.pctRentaVariable ?? null) : null,
    pctFondoPromocion: draft.pctFondoPromocion,
    multiplicadorDiciembre: draft.multiplicadorDiciembre,
    multiplicadorJunio: draft.multiplicadorJunio,
    multiplicadorAgosto: draft.multiplicadorAgosto,
    codigoCC: draft.codigoCC,
    ggccPctAdministracion,
    ggccPctReajuste: asNullableString(ggcc?.pctReajuste ?? null),
    notas: draft.notas,
    ggccTipo,
    ggccValor,
    ggccMesesReajuste: ggcc?.mesesReajuste ?? null,
    anexoFecha: draft.anexo?.fecha ? draft.anexo.fecha.trim() : null,
    anexoDescripcion: draft.anexo?.descripcion ? draft.anexo.descripcion.trim() : null
  };
}
