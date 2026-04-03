"use client";

import { EstadoContrato } from "@prisma/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ContractAttachmentZone } from "@/components/contracts/ContractAttachmentZone";
import { GgccListEditor, type GgccListItem } from "@/components/contracts/GgccListEditor";
import {
  RentaVariableListEditor,
  type RentaVariableListItem
} from "@/components/contracts/RentaVariableListEditor";
import {
  createEmptyTarifaItem,
  TarifaListEditor,
  type TarifaListItem
} from "@/components/contracts/TarifaListEditor";
import {
  alignPrimaryLocalId,
  buildLocalSelectionState,
  toggleLocalSelection
} from "@/components/contracts/local-selection";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import type {
  ContractExtractionResponse,
  ContractFormPayload,
  ContractManagerListItem,
  ContractManagerOption
} from "@/types";

export type ContractDraftPayload = Omit<ContractFormPayload, "tarifas" | "ggcc" | "rentaVariable"> & {
  tarifas: TarifaListItem[];
  rentaVariable: RentaVariableListItem[];
  ggcc: GgccListItem[];
};

export type UploadReviewExtras = {
  numeroContrato: string;
};

type ContractFormProps = {
  initialData?: ContractManagerListItem | null;
  initialDraft?: ContractDraftPayload;
  proyectoId: string;
  locals: ContractManagerOption[];
  arrendatarios: ContractManagerOption[];
  onSave: (payload: ContractFormPayload) => Promise<void> | void;
  onCancel: () => void;
  canEdit: boolean;
  batchMode?: boolean;
  uploadReviewMode?: boolean;
  uploadReviewExtras?: UploadReviewExtras;
  onUploadReviewExtrasChange?: (extras: UploadReviewExtras) => void;
  onDraftChange?: (draft: ContractDraftPayload) => void;
  hideActions?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
};

type ExtractionApiResponse = ContractExtractionResponse & { message?: string };

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

function toSingleRentaVariableItem(
  items: ContractFormPayload["rentaVariable"]
): RentaVariableListItem[] {
  const firstItem = items[0];
  return firstItem ? [toDraftRentaVariable(firstItem)] : [];
}

function toApiPayload(payload: ContractDraftPayload): ContractFormPayload {
  const localIds = Array.from(new Set(payload.localIds.filter(Boolean)));
  const localId = localIds[0] ?? payload.localId;
  const rentaVariableItem = payload.rentaVariable.find(
    (item) => !isBlank(item.pctRentaVariable)
  );

  return {
    ...payload,
    localId,
    localIds,
    rentaVariable: rentaVariableItem
      ? [
          {
            pctRentaVariable: rentaVariableItem.pctRentaVariable,
            vigenciaDesde: payload.fechaInicio,
            vigenciaHasta: payload.fechaTermino
          }
        ]
      : [],
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

function createEmptyPayload(
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
    estado: "VIGENTE",
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

function fromContract(contract: ContractManagerListItem, proyectoId: string): ContractDraftPayload {
  const localIds = contract.locales.length > 0 ? contract.locales.map((local) => local.id) : [contract.local.id];
  return {
    proyectoId,
    localId: localIds[0] ?? contract.local.id,
    localIds,
    arrendatarioId: contract.arrendatario.id,
    fechaInicio: contract.fechaInicio.slice(0, 10),
    fechaTermino: contract.fechaTermino.slice(0, 10),
    fechaEntrega: null,
    fechaApertura: null,
    estado: contract.estado,
    rentaVariable: toSingleRentaVariableItem(
      contract.tarifas
        .filter((tarifa) => tarifa.tipo === "PORCENTAJE")
        .map((tarifa) => ({
          pctRentaVariable: tarifa.valor,
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

function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === "";
}

function hasMeaningfulTarifas(tarifas: TarifaListItem[]): boolean {
  return tarifas.some(
    (item) =>
      !isBlank(item.valor) ||
      !isBlank(item.vigenciaDesde) ||
      !isBlank(item.vigenciaHasta) ||
      item.esDiciembre
  );
}

function hasMeaningfulRentaVariable(items: RentaVariableListItem[]): boolean {
  return items.some((item) => !isBlank(item.pctRentaVariable));
}

function hasMeaningfulGgcc(ggcc: GgccListItem[]): boolean {
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

async function readJsonResponse<T>(response: Response): Promise<T | null> {
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

function getExtractionErrorMessage(response: Response, payload: ExtractionApiResponse | null): string {
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

export function ContractForm({
  initialData,
  initialDraft,
  proyectoId,
  locals,
  arrendatarios,
  onSave,
  onCancel,
  canEdit,
  batchMode = false,
  uploadReviewMode = false,
  uploadReviewExtras,
  onUploadReviewExtrasChange,
  onDraftChange,
  hideActions = false,
  saveLabel,
  cancelLabel
}: ContractFormProps): JSX.Element {
  const defaultLocalId = "";
  const defaultArrendatarioId = arrendatarios[0]?.id ?? "";
  const hasRequiredMasters = locals.length > 0 && arrendatarios.length > 0;
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [reviewExtras, setReviewExtras] = useState<UploadReviewExtras>({
    numeroContrato: uploadReviewExtras?.numeroContrato ?? ""
  });
  const [payload, setPayload] = useState<ContractDraftPayload>(
    createEmptyPayload(proyectoId, defaultLocalId ? [defaultLocalId] : [], defaultArrendatarioId)
  );
  const [localSearch, setLocalSearch] = useState("");
  const [showOnlySelectedLocals, setShowOnlySelectedLocals] = useState(false);
  const skipDraftNotifyRef = useRef(false);
  const localSelectionState = useMemo(
    () =>
      buildLocalSelectionState({
        locals,
        selectedLocalIds: payload.localIds,
        search: localSearch,
        onlySelected: showOnlySelectedLocals
      }),
    [localSearch, locals, payload.localIds, showOnlySelectedLocals]
  );
  const hasSelectedLocal = localSelectionState.validSelectedIds.length > 0;
  const hasMissingSelectedLocal = localSelectionState.missingSelectedIds.length > 0;
  const fechasContrato =
    payload.fechaInicio && payload.fechaTermino
      ? { inicio: payload.fechaInicio, termino: payload.fechaTermino }
      : undefined;

  function resolveLocalFields(localIds: string[], currentLocalId: string): Pick<ContractDraftPayload, "localId" | "localIds"> {
    const nextSelection = buildLocalSelectionState({
      locals,
      selectedLocalIds: localIds,
      search: "",
      onlySelected: false
    });
    return {
      localIds: nextSelection.normalizedSelectedIds,
      localId: alignPrimaryLocalId(currentLocalId, nextSelection.validSelectedIds)
    };
  }

  useEffect(() => {
    if (initialData) {
      const nextPayload = fromContract(initialData, proyectoId);
      const nextLocalFields = resolveLocalFields(nextPayload.localIds, nextPayload.localId);
      setPayload((previous) => {
        const normalizedPayload =
          nextLocalFields.localId === nextPayload.localId &&
          nextLocalFields.localIds.length === nextPayload.localIds.length &&
          nextLocalFields.localIds.every((localId, index) => localId === nextPayload.localIds[index])
            ? nextPayload
            : {
                ...nextPayload,
                ...nextLocalFields
              };
        const shouldSync = previous !== normalizedPayload;
        skipDraftNotifyRef.current = shouldSync;
        return shouldSync ? normalizedPayload : previous;
      });
      return;
    }
    if (initialDraft) {
      const nextLocalFields = resolveLocalFields(initialDraft.localIds, initialDraft.localId);
      setPayload((previous) => {
        const normalizedDraft =
          nextLocalFields.localId === initialDraft.localId &&
          nextLocalFields.localIds.length === initialDraft.localIds.length &&
          nextLocalFields.localIds.every((localId, index) => localId === initialDraft.localIds[index])
            ? initialDraft
            : {
                ...initialDraft,
                ...nextLocalFields
              };
        const shouldSync = previous !== normalizedDraft;
        skipDraftNotifyRef.current = shouldSync;
        return shouldSync ? normalizedDraft : previous;
      });
      return;
    }
    const nextPayload = createEmptyPayload(
      proyectoId,
      defaultLocalId ? [defaultLocalId] : [],
      defaultArrendatarioId
    );
    const nextLocalFields = resolveLocalFields(nextPayload.localIds, nextPayload.localId);
    setPayload((previous) => {
      const normalizedPayload = {
        ...nextPayload,
        ...nextLocalFields
      };
      const shouldSync = previous !== normalizedPayload;
      skipDraftNotifyRef.current = shouldSync;
      return shouldSync ? normalizedPayload : previous;
    });
  }, [defaultArrendatarioId, defaultLocalId, initialData, initialDraft, proyectoId, locals]);

  useEffect(() => {
    if (!uploadReviewMode) {
      return;
    }
    setReviewExtras({
      numeroContrato: uploadReviewExtras?.numeroContrato ?? ""
    });
  }, [
    uploadReviewMode,
    uploadReviewExtras?.numeroContrato
  ]);

  useEffect(() => {
    if (!onDraftChange) {
      return;
    }
    if (skipDraftNotifyRef.current) {
      skipDraftNotifyRef.current = false;
      return;
    }
    onDraftChange(payload);
  }, [onDraftChange, payload]);

  useEffect(() => {
    if (!uploadReviewMode || !onUploadReviewExtrasChange) {
      return;
    }
    onUploadReviewExtrasChange(reviewExtras);
  }, [onUploadReviewExtrasChange, reviewExtras, uploadReviewMode]);

  async function saveContract(): Promise<void> {
    if (!hasSelectedLocal) {
      toast.error(
        hasMissingSelectedLocal
          ? "Los locales seleccionados no existen. Elimina los no encontrados y selecciona al menos un local valido."
          : "Debes seleccionar al menos un local."
      );
      return;
    }

    const hasMissingPctReajuste = payload.ggcc.some(
      (item) => item.mesesReajuste !== null && isBlank(item.pctReajuste)
    );
    if (hasMissingPctReajuste) {
      toast.error("Debes informar el % de reajuste para cada GGCC con reajuste activo.");
      return;
    }

    setLoading(true);

    try {
      await onSave(
        toApiPayload({
          ...payload,
          localId: alignPrimaryLocalId(payload.localId, localSelectionState.validSelectedIds),
          localIds: localSelectionState.validSelectedIds
        })
      );
      if (!initialData && !uploadReviewMode) {
        setPayload(createEmptyPayload(proyectoId, defaultLocalId ? [defaultLocalId] : [], defaultArrendatarioId));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado al guardar.");
    } finally {
      setLoading(false);
    }
  }

  async function extractFile(file: File): Promise<void> {
    if (!canEdit || extracting) {
      return;
    }

    setExtracting(true);

    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch(`/api/contracts/extract?proyectoId=${encodeURIComponent(proyectoId)}`, {
        method: "POST",
        body: formData
      });
      const data = await readJsonResponse<ExtractionApiResponse>(response);
      if (!response.ok) {
        throw new Error(getExtractionErrorMessage(response, data));
      }
      if (!data) {
        throw new Error("Respuesta invalida del servidor al analizar el archivo.");
      }

      const nextPayload: ContractDraftPayload = {
        ...payload
      };
      const completedFields: string[] = [];
      const missingFields: string[] = [];

      if (data.localId) {
        if (!nextPayload.localIds.includes(data.localId)) {
          completedFields.push("local");
        }
        nextPayload.localIds = Array.from(new Set([...nextPayload.localIds, data.localId]));
        nextPayload.localId = nextPayload.localIds[0] ?? data.localId;
      } else {
        missingFields.push("local");
      }

      if (data.arrendatarioId) {
        if (nextPayload.arrendatarioId !== data.arrendatarioId) {
          completedFields.push("arrendatario");
        }
        nextPayload.arrendatarioId = data.arrendatarioId;
      } else {
        missingFields.push("arrendatario");
      }

      if (data.fechaInicio && isBlank(nextPayload.fechaInicio)) {
        nextPayload.fechaInicio = data.fechaInicio;
        completedFields.push("fechaInicio");
      } else if (!data.fechaInicio) {
        missingFields.push("fechaInicio");
      }

      if (data.fechaTermino && isBlank(nextPayload.fechaTermino)) {
        nextPayload.fechaTermino = data.fechaTermino;
        completedFields.push("fechaTermino");
      } else if (!data.fechaTermino) {
        missingFields.push("fechaTermino");
      }

      if (data.pctFondoPromocion && !nextPayload.pctFondoPromocion) {
        nextPayload.pctFondoPromocion = data.pctFondoPromocion;
        completedFields.push("pctFondoPromocion");
      } else if (!data.pctFondoPromocion) {
        missingFields.push("pctFondoPromocion");
      }

      if (data.pctAdministracionGgcc && !nextPayload.pctAdministracionGgcc) {
        nextPayload.pctAdministracionGgcc = data.pctAdministracionGgcc;
        completedFields.push("pctAdministracionGgcc");
      } else if (!data.pctAdministracionGgcc) {
        missingFields.push("pctAdministracionGgcc");
      }

      const tarifasFijas = data.tarifas.filter((item) => item.tipo !== "PORCENTAJE");
      const rentaVariable = data.tarifas.filter((item) => item.tipo === "PORCENTAJE");

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

      if (data.ggcc.length > 0 && !hasMeaningfulGgcc(nextPayload.ggcc)) {
        nextPayload.ggcc = data.ggcc.map(toDraftGgccFromExtraction);
        completedFields.push("ggcc");
      } else if (data.ggcc.length === 0) {
        missingFields.push("ggcc");
      }

      const nextLocalFields = resolveLocalFields(nextPayload.localIds, nextPayload.localId);
      setPayload({
        ...nextPayload,
        ...nextLocalFields
      });

      const uniqueMissing = [...new Set(missingFields)];
      if (completedFields.length > 0) {
        toast.success(`Archivo analizado. Campos completados: ${completedFields.length}`);
        if (uniqueMissing.length > 0) {
          toast.warning(`No extraidos: ${uniqueMissing.join(", ")}.`);
        }
      } else if (uniqueMissing.length > 0) {
        toast.error(`No se pudieron extraer: ${uniqueMissing.join(", ")}.`);
      } else {
        toast.warning("Archivo analizado, pero no habia campos nuevos para completar.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado al analizar el archivo.");
    } finally {
      setExtracting(false);
    }
  }

  function toggleLocal(localId: string, selected: boolean): void {
    setPayload((previous) => {
      const nextLocalIds = toggleLocalSelection(previous.localIds, localId, selected);
      const nextLocalFields = resolveLocalFields(
        nextLocalIds,
        selected ? localId : previous.localId
      );
      return {
        ...previous,
        ...nextLocalFields
      };
    });
  }

  function removeMissingLocal(localId: string): void {
    setPayload((previous) => {
      const nextLocalIds = previous.localIds.filter((item) => item !== localId);
      const nextLocalFields = resolveLocalFields(nextLocalIds, previous.localId);
      return {
        ...previous,
        ...nextLocalFields
      };
    });
  }

  function clearMissingLocals(): void {
    setPayload((previous) => {
      const nextSelection = buildLocalSelectionState({
        locals,
        selectedLocalIds: previous.localIds,
        search: "",
        onlySelected: false
      });
      return {
        ...previous,
        localIds: nextSelection.validSelectedIds,
        localId: alignPrimaryLocalId(previous.localId, nextSelection.validSelectedIds)
      };
    });
  }

  return (
    <section className="space-y-3 rounded-md bg-white p-5 shadow-sm">
      {!batchMode ? (
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            {initialData ? "Editar contrato" : "Nuevo contrato"}
          </h3>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="h-auto px-3 py-1.5 text-sm"
          >
            Nuevo
          </Button>
        </div>
      ) : null}

      {canEdit && !batchMode && !uploadReviewMode ? (
        <ContractAttachmentZone
          onFile={(file) => void extractFile(file)}
          loading={extracting}
          disabled={!canEdit}
        />
      ) : null}

      {!hasRequiredMasters ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Debes crear al menos un local y un arrendatario antes de registrar contratos.
        </p>
      ) : null}

      {/* Row 1: Numero contrato / extras (upload review) */}
      {uploadReviewMode ? (
        <label className="text-sm">
          <span className="mb-1 block text-slate-700">Numero contrato</span>
          <Input
            value={reviewExtras.numeroContrato}
            onChange={(event) =>
              setReviewExtras((previous) => ({ ...previous, numeroContrato: event.target.value }))
            }
            disabled={!canEdit}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
      ) : initialData ? (
        <div className="text-sm">
          <span className="mb-1 block text-slate-700">Numero contrato</span>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
            {initialData.numeroContrato}
          </div>
        </div>
      ) : null}

      {/* Row 2: Clasificacion juridica | Locales asociados */}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-slate-700">
            Clasificacion juridica <span className="text-xs text-slate-400">(opcional)</span>
          </span>
          <Select
            value={payload.estado}
            onValueChange={(value) =>
              setPayload((previous) => ({
                ...previous,
                estado: value as EstadoContrato
              }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="VIGENTE">VIGENTE</SelectItem>
              <SelectItem value="GRACIA">GRACIA</SelectItem>
              <SelectItem value="TERMINADO">TERMINADO</SelectItem>
              <SelectItem value="TERMINADO_ANTICIPADO">TERMINADO_ANTICIPADO</SelectItem>
            </SelectContent>
          </Select>
          <span className="mt-1 block text-xs text-slate-500">
            Este estado es clasificacion del documento. El estado en Rent Roll se calcula
            automaticamente desde las fechas del contrato.
          </span>
        </label>
        <div className="text-sm">
          <span className="mb-1 block text-slate-700">
            Locales asociados <span className="text-rose-500">*</span>
          </span>
          {hasMissingSelectedLocal ? (
            <div className="mb-2 space-y-2 rounded-md border border-rose-200 bg-rose-50 p-2">
              <p className="text-xs text-rose-700">
                Hay locales seleccionados que no existen en este proyecto.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {localSelectionState.missingSelectedIds.map((localId) => (
                  <span
                    key={localId}
                    className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-white px-2 py-0.5 text-xs text-rose-700"
                  >
                    {localId}
                    {canEdit ? (
                      <button
                        type="button"
                        className="font-semibold text-rose-700 hover:text-rose-900"
                        onClick={() => removeMissingLocal(localId)}
                        aria-label={`Quitar local no encontrado ${localId}`}
                      >
                        x
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
              {canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearMissingLocals}
                  className="h-auto px-2 py-1 text-xs text-rose-700 hover:bg-rose-100 hover:text-rose-800"
                >
                  Limpiar no encontrados
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="mb-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
            <Input
              value={localSearch}
              onChange={(event) => setLocalSearch(event.target.value)}
              placeholder="Buscar local por codigo o nombre"
              className="h-9"
            />
            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
              <Checkbox
                checked={showOnlySelectedLocals}
                onCheckedChange={(value) => setShowOnlySelectedLocals(value === true)}
              />
              <span>Mostrar solo seleccionados</span>
            </label>
          </div>

          <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-slate-300 p-2">
            {localSelectionState.filteredLocals.length === 0 ? (
              <p className="py-2 text-xs text-slate-500">
                No hay locales para este filtro.
              </p>
            ) : (
              localSelectionState.filteredLocals.map((local) => (
                <label key={local.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <Checkbox
                    disabled={!canEdit}
                    checked={localSelectionState.validSelectedIds.includes(local.id)}
                    onCheckedChange={(value) => toggleLocal(local.id, value === true)}
                  />
                  <span>{local.label}</span>
                </label>
              ))
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Seleccionados validos: {localSelectionState.validSelectedIds.length}
            {hasMissingSelectedLocal
              ? ` | No encontrados: ${localSelectionState.missingSelectedIds.length}`
              : ""}
          </p>
          {!hasSelectedLocal && hasMissingSelectedLocal ? (
            <p className="mt-1 text-xs text-rose-700">
              Debes dejar al menos un local valido seleccionado para guardar.
            </p>
          ) : null}
        </div>
      </div>

      {/* Row 3: Arrendatario | Fecha inicio | Fecha termino | condiciones comerciales */}
      <div className="grid gap-3 md:grid-cols-5">
        <label className="text-sm">
          <span className="mb-1 block text-slate-700">
            Arrendatario <span className="text-rose-500">*</span>
          </span>
          <Select
            value={payload.arrendatarioId || undefined}
            onValueChange={(value) =>
              setPayload((previous) => ({ ...previous, arrendatarioId: value }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona un arrendatario" />
            </SelectTrigger>
            <SelectContent>
              {arrendatarios.map((arrendatario) => (
                <SelectItem key={arrendatario.id} value={arrendatario.id}>
                  {arrendatario.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-700">
            Fecha inicio <span className="text-rose-500">*</span>
          </span>
          <Input
            type="date"
            value={payload.fechaInicio}
            onChange={(event) =>
              setPayload((previous) => ({ ...previous, fechaInicio: event.target.value }))
            }
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-700">
            Fecha termino <span className="text-rose-500">*</span>
          </span>
          <Input
            type="date"
            value={payload.fechaTermino}
            onChange={(event) =>
              setPayload((previous) => ({ ...previous, fechaTermino: event.target.value }))
            }
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-700">
            % Fondo promocion <span className="text-xs text-slate-400">(opcional)</span>
          </span>
          <Input
            inputMode="decimal"
            placeholder="Ej: 2.5"
            value={payload.pctFondoPromocion ?? ""}
            onChange={(event) =>
              setPayload((previous) => ({
                ...previous,
                pctFondoPromocion: event.target.value.trim() ? event.target.value : null
              }))
            }
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-700">
            Multiplicador diciembre <span className="text-xs text-slate-400">(opcional)</span>
          </span>
          <Input
            inputMode="decimal"
            placeholder="Ej: 1.25"
            value={payload.multiplicadorDiciembre ?? ""}
            onChange={(event) =>
              setPayload((previous) => ({
                ...previous,
                multiplicadorDiciembre: event.target.value.trim() ? event.target.value : null
              }))
            }
            disabled={!canEdit}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      <TarifaListEditor
        tarifas={payload.tarifas}
        fechasContrato={fechasContrato}
        onChange={(updated) => setPayload((previous) => ({ ...previous, tarifas: updated }))}
        disabled={!canEdit}
      />

      <RentaVariableListEditor
        items={payload.rentaVariable}
        onChange={(updated) => setPayload((previous) => ({ ...previous, rentaVariable: updated }))}
        disabled={!canEdit}
      />

      <div className="space-y-1 rounded-lg border border-slate-200 p-3">
        <h4 className="text-sm font-semibold text-slate-900">Costo de administración (GGCC)</h4>
        <label className="text-sm">
          <span className="mb-1 block text-slate-700">
            % administración <span className="text-xs text-slate-400">(opcional)</span>
          </span>
          <Input
            inputMode="decimal"
            placeholder="Ej: 5"
            value={payload.pctAdministracionGgcc ?? ""}
            onChange={(event) =>
              setPayload((previous) => ({
                ...previous,
                pctAdministracionGgcc: event.target.value.trim() ? event.target.value : null
              }))
            }
            disabled={!canEdit}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      <GgccListEditor
        ggcc={payload.ggcc}
        onChange={(updated) => setPayload((previous) => ({ ...previous, ggcc: updated }))}
        disabled={!canEdit}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-slate-700">
            Fecha anexo <span className="text-xs text-slate-400">(opcional)</span>
          </span>
          <Input
            type="date"
            value={payload.anexo?.fecha ?? ""}
            onChange={(event) =>
              setPayload((previous) => ({
                ...previous,
                anexo: {
                  fecha: event.target.value,
                  descripcion: previous.anexo?.descripcion ?? ""
                }
              }))
            }
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-700">
            Descripcion anexo <span className="text-xs text-slate-400">(opcional)</span>
          </span>
          <Input
            value={payload.anexo?.descripcion ?? ""}
            onChange={(event) =>
              setPayload((previous) => ({
                ...previous,
                anexo: {
                  fecha: previous.anexo?.fecha ?? "",
                  descripcion: event.target.value
                }
              }))
            }
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      {!hideActions ? (
        <div className="flex items-center gap-3">
          {batchMode || uploadReviewMode ? (
            <Button type="button" variant="outline" onClick={onCancel} className="rounded-full">
              {cancelLabel ?? (uploadReviewMode ? "Cancelar" : "Omitir")}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="default"
            onClick={() => void saveContract()}
            disabled={!canEdit || loading || !hasRequiredMasters || !hasSelectedLocal}
            className="rounded-full"
          >
            {saveLabel ??
              (uploadReviewMode
                ? "Guardar fila"
                : batchMode
                  ? "Aprobar y crear"
                  : initialData
                    ? "Actualizar contrato"
                    : "Crear contrato")}
          </Button>
          {!canEdit ? <span className="text-sm text-amber-700">Rol de solo lectura.</span> : null}
        </div>
      ) : null}
    </section>
  );
}
