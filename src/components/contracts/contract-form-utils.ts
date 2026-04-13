import { createEmptyTarifaItem, type TarifaListItem } from "@/components/contracts/TarifaListEditor";
import type { GgccListItem } from "@/components/contracts/GgccListEditor";
import type { RentaVariableListItem } from "@/components/contracts/RentaVariableListEditor";
import type { ContractDraftPayload } from "@/components/contracts/contract-form-types";
import type {
  ContractExtractionResponse,
  ContractFormPayload,
  ContractManagerListItem
} from "@/types";

export type ExtractionApiResponse = ContractExtractionResponse & { message?: string };

function toDraftTarifa(item: ContractFormPayload["tarifas"][number]): TarifaListItem {
  return { ...item, _key: crypto.randomUUID() };
}

function toDraftGgcc(item: ContractFormPayload["ggcc"][number]): GgccListItem {
  return { ...item, _key: crypto.randomUUID() };
}

function toDraftRentaVariable(
  item: ContractFormPayload["rentaVariable"][number]
): RentaVariableListItem {
  return { ...item, _key: crypto.randomUUID() };
}

function toAllRentaVariableItems(
  items: ContractFormPayload["rentaVariable"]
): RentaVariableListItem[] {
  return items.map(toDraftRentaVariable);
}

export function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === "";
}

export function toApiPayload(payload: ContractDraftPayload): ContractFormPayload {
  const localIds = Array.from(new Set(payload.localIds.filter(Boolean)));
  const localId = localIds[0] ?? payload.localId;
  const validTiers = payload.rentaVariable.filter((item) => !isBlank(item.pctRentaVariable));

  return {
    ...payload,
    localId,
    localIds,
    rentaVariable: validTiers.map((item) => ({
      pctRentaVariable: item.pctRentaVariable,
      umbralVentasUf: item.umbralVentasUf || "0",
      vigenciaDesde: payload.fechaInicio,
      vigenciaHasta: payload.fechaTermino
    })),
    tarifas: payload.tarifas.map((tarifa) => ({
      tipo: tarifa.tipo,
      valor: tarifa.valor,
      vigenciaDesde: tarifa.vigenciaDesde,
      vigenciaHasta: tarifa.vigenciaHasta,
      esDiciembre: tarifa.esDiciembre
    })),
    ggcc: payload.ggcc.map((item) => ({
      tarifaBaseUfM2: item.tarifaBaseUfM2,
      pctAdministracion: item.pctAdministracion,
      pctReajuste: item.pctReajuste,
      proximoReajuste: item.proximoReajuste,
      mesesReajuste: item.mesesReajuste
    }))
  };
}

export function createEmptyPayload(
  proyectoId: string,
  localIds: string[] = [],
  arrendatarioId = ""
): ContractDraftPayload {
  const uniqueLocalIds = Array.from(new Set(localIds.filter(Boolean)));
  return {
    proyectoId,
    localId: uniqueLocalIds[0] ?? "",
    localIds: uniqueLocalIds,
    arrendatarioId,
    fechaInicio: "",
    fechaTermino: "",
    fechaEntrega: null,
    fechaApertura: null,
    diasGracia: 0,
    rentaVariable: [],
    pctFondoPromocion: null,
    pctAdministracionGgcc: null,
    multiplicadorDiciembre: null,
    codigoCC: null,
    pdfUrl: null,
    notas: null,
    tarifas: [createEmptyTarifaItem()],
    ggcc: [],
    anexo: null
  };
}

export function fromContract(
  contract: ContractManagerListItem,
  proyectoId: string
): ContractDraftPayload {
  const localIds =
    contract.locales.length > 0 ? contract.locales.map((local) => local.id) : [contract.local.id];
  return {
    proyectoId,
    localId: localIds[0] ?? contract.local.id,
    localIds,
    arrendatarioId: contract.arrendatario.id,
    fechaInicio: contract.fechaInicio.slice(0, 10),
    fechaTermino: contract.fechaTermino.slice(0, 10),
    fechaEntrega: null,
    fechaApertura: null,
    diasGracia: contract.diasGracia,
    rentaVariable: toAllRentaVariableItems(
      contract.tarifas
        .filter((tarifa) => tarifa.tipo === "PORCENTAJE")
        .map((tarifa) => ({
          pctRentaVariable: tarifa.valor,
          umbralVentasUf: tarifa.umbralVentasUf ?? "0",
          vigenciaDesde: tarifa.vigenciaDesde,
          vigenciaHasta: tarifa.vigenciaHasta
        }))
    ),
    pctFondoPromocion: contract.pctFondoPromocion,
    pctAdministracionGgcc: contract.pctAdministracionGgcc,
    multiplicadorDiciembre: contract.multiplicadorDiciembre,
    codigoCC: null,
    pdfUrl: contract.pdfUrl,
    notas: null,
    tarifas:
      contract.tarifas.filter((tarifa) => tarifa.tipo !== "PORCENTAJE").length > 0
        ? contract.tarifas.filter((tarifa) => tarifa.tipo !== "PORCENTAJE").map(toDraftTarifa)
        : [createEmptyTarifaItem()],
    ggcc: contract.ggcc.map(toDraftGgcc),
    anexo: null
  };
}

export function hasMeaningfulTarifas(tarifas: TarifaListItem[]): boolean {
  return tarifas.some(
    (item) =>
      !isBlank(item.valor) ||
      !isBlank(item.vigenciaDesde) ||
      !isBlank(item.vigenciaHasta) ||
      item.esDiciembre
  );
}

export function hasMeaningfulRentaVariable(items: RentaVariableListItem[]): boolean {
  return items.some((item) => !isBlank(item.pctRentaVariable));
}

export function hasMeaningfulGgcc(ggcc: GgccListItem[]): boolean {
  return ggcc.some(
    (item) =>
      !isBlank(item.tarifaBaseUfM2) ||
      !isBlank(item.pctReajuste) ||
      item.mesesReajuste !== null
  );
}

function toDraftTarifaFromExtraction(
  item: ContractExtractionResponse["tarifas"][number]
): TarifaListItem {
  return {
    _key: crypto.randomUUID(),
    tipo: item.tipo,
    valor: item.valor,
    vigenciaDesde: item.vigenciaDesde,
    vigenciaHasta: item.vigenciaHasta,
    esDiciembre: item.esDiciembre
  };
}

function toDraftRentaVariableFromExtraction(
  item: ContractExtractionResponse["tarifas"][number]
): RentaVariableListItem {
  return {
    _key: crypto.randomUUID(),
    pctRentaVariable: item.valor,
    umbralVentasUf: "0",
    vigenciaDesde: "",
    vigenciaHasta: null
  };
}

function toDraftGgccFromExtraction(item: ContractExtractionResponse["ggcc"][number]): GgccListItem {
  return {
    _key: crypto.randomUUID(),
    tarifaBaseUfM2: item.tarifaBaseUfM2,
    pctAdministracion: "0",
    pctReajuste: item.pctReajuste ?? null,
    proximoReajuste: item.proximoReajuste,
    mesesReajuste: null
  };
}

export async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const raw = await response.text();
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function getExtractionErrorMessage(
  response: Response,
  payload: ExtractionApiResponse | null
): string {
  if (payload?.message) {
    return payload.message;
  }
  if (response.status === 401) {
    return "Tu sesion expiro. Recarga la pagina e inicia sesion nuevamente.";
  }
  if (response.status === 403) {
    return "No tienes permisos para analizar archivos.";
  }
  if (response.status === 413) {
    return "El archivo supera el limite permitido de 10 MB.";
  }
  return "No se pudo analizar el archivo. Intenta nuevamente.";
}

export function extractionToDraft(
  data: ContractExtractionResponse,
  proyectoId: string
): ContractDraftPayload {
  const localIds = data.localId ? [data.localId] : [];
  const tarifasFijas = data.tarifas.filter((t) => t.tipo !== "PORCENTAJE");
  const rentaVariable = data.tarifas.filter((t) => t.tipo === "PORCENTAJE");
  return {
    ...createEmptyPayload(proyectoId),
    localId: localIds[0] ?? "",
    localIds,
    arrendatarioId: data.arrendatarioId ?? "",
    fechaInicio: data.fechaInicio ?? "",
    fechaTermino: data.fechaTermino ?? "",
    pctFondoPromocion: data.pctFondoPromocion ?? null,
    pctAdministracionGgcc: data.pctAdministracionGgcc ?? null,
    tarifas:
      tarifasFijas.length > 0 ? tarifasFijas.map(toDraftTarifaFromExtraction) : [createEmptyTarifaItem()],
    rentaVariable:
      rentaVariable.length > 0 ? [toDraftRentaVariableFromExtraction(rentaVariable[0])] : [],
    ggcc: data.ggcc.map(toDraftGgccFromExtraction)
  };
}

export function mergeExtractedDraft(
  current: ContractDraftPayload,
  extracted: ContractExtractionResponse
): { payload: ContractDraftPayload; completedFields: string[]; missingFields: string[] } {
  const nextPayload: ContractDraftPayload = { ...current };
  const completedFields: string[] = [];
  const missingFields: string[] = [];

  if (extracted.localId) {
    if (!nextPayload.localIds.includes(extracted.localId)) {
      completedFields.push("local");
    }
    nextPayload.localIds = Array.from(new Set([...nextPayload.localIds, extracted.localId]));
    nextPayload.localId = nextPayload.localIds[0] ?? extracted.localId;
  } else {
    missingFields.push("local");
  }

  if (extracted.arrendatarioId) {
    if (nextPayload.arrendatarioId !== extracted.arrendatarioId) {
      completedFields.push("arrendatario");
    }
    nextPayload.arrendatarioId = extracted.arrendatarioId;
  } else {
    missingFields.push("arrendatario");
  }

  if (extracted.fechaInicio && isBlank(nextPayload.fechaInicio)) {
    nextPayload.fechaInicio = extracted.fechaInicio;
    completedFields.push("fechaInicio");
  } else if (!extracted.fechaInicio) {
    missingFields.push("fechaInicio");
  }

  if (extracted.fechaTermino && isBlank(nextPayload.fechaTermino)) {
    nextPayload.fechaTermino = extracted.fechaTermino;
    completedFields.push("fechaTermino");
  } else if (!extracted.fechaTermino) {
    missingFields.push("fechaTermino");
  }

  if (extracted.pctFondoPromocion && !nextPayload.pctFondoPromocion) {
    nextPayload.pctFondoPromocion = extracted.pctFondoPromocion;
    completedFields.push("pctFondoPromocion");
  } else if (!extracted.pctFondoPromocion) {
    missingFields.push("pctFondoPromocion");
  }

  if (extracted.pctAdministracionGgcc && !nextPayload.pctAdministracionGgcc) {
    nextPayload.pctAdministracionGgcc = extracted.pctAdministracionGgcc;
    completedFields.push("pctAdministracionGgcc");
  } else if (!extracted.pctAdministracionGgcc) {
    missingFields.push("pctAdministracionGgcc");
  }

  const tarifasFijas = extracted.tarifas.filter((item) => item.tipo !== "PORCENTAJE");
  const rentaVariable = extracted.tarifas.filter((item) => item.tipo === "PORCENTAJE");

  if (tarifasFijas.length > 0 && !hasMeaningfulTarifas(nextPayload.tarifas)) {
    nextPayload.tarifas = tarifasFijas.map(toDraftTarifaFromExtraction);
    completedFields.push("tarifas");
  } else if (tarifasFijas.length === 0) {
    missingFields.push("tarifas");
  }

  if (rentaVariable.length > 0 && !hasMeaningfulRentaVariable(nextPayload.rentaVariable)) {
    nextPayload.rentaVariable = [toDraftRentaVariableFromExtraction(rentaVariable[0])];
    completedFields.push("rentaVariable");
  } else if (rentaVariable.length === 0) {
    missingFields.push("rentaVariable");
  }

  if (extracted.ggcc.length > 0 && !hasMeaningfulGgcc(nextPayload.ggcc)) {
    nextPayload.ggcc = extracted.ggcc.map(toDraftGgccFromExtraction);
    completedFields.push("ggcc");
  } else if (extracted.ggcc.length === 0) {
    missingFields.push("ggcc");
  }

  return {
    payload: nextPayload,
    completedFields,
    missingFields
  };
}
