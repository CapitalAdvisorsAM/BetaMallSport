"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  alignPrimaryLocalId,
  buildLocalSelectionState,
  toggleLocalSelection,
  type LocalSelectionState
} from "@/components/contracts/local-selection";
import type { ContractDraftPayload, ContractFormProps, UploadReviewExtras } from "@/components/contracts/contract-form-types";
import {
  createEmptyPayload,
  fromContract,
  getExtractionErrorMessage,
  mergeExtractedDraft,
  readJsonResponse,
  toApiPayload,
  type ExtractionApiResponse,
  isBlank
} from "@/components/contracts/contract-form-utils";

type UseContractFormStateParams = Pick<
  ContractFormProps,
  | "initialData"
  | "initialDraft"
  | "proyectoId"
  | "locals"
  | "arrendatarios"
  | "onSave"
  | "canEdit"
  | "uploadReviewMode"
  | "uploadReviewExtras"
  | "onUploadReviewExtrasChange"
  | "onDraftChange"
>;

type LocalFields = Pick<ContractDraftPayload, "localId" | "localIds">;

function localFieldsEqual(a: LocalFields, b: LocalFields): boolean {
  if (a.localId !== b.localId) {
    return false;
  }
  if (a.localIds.length !== b.localIds.length) {
    return false;
  }
  return a.localIds.every((localId, index) => localId === b.localIds[index]);
}

export function useContractFormState({
  initialData,
  initialDraft,
  proyectoId,
  locals,
  arrendatarios,
  onSave,
  canEdit,
  uploadReviewMode = false,
  uploadReviewExtras,
  onUploadReviewExtrasChange,
  onDraftChange
}: UseContractFormStateParams) {
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

  const localSelectionState = useMemo<LocalSelectionState>(
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

  const resolveLocalFields = useCallback(
    (localIds: string[], currentLocalId: string): LocalFields => {
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
    },
    [locals]
  );

  useEffect(() => {
    if (initialData) {
      const nextPayload = fromContract(initialData, proyectoId);
      const nextLocalFields = resolveLocalFields(nextPayload.localIds, nextPayload.localId);
      setPayload((previous) => {
        const normalizedPayload = localFieldsEqual(nextLocalFields, nextPayload)
          ? nextPayload
          : { ...nextPayload, ...nextLocalFields };
        const shouldSync = previous !== normalizedPayload;
        skipDraftNotifyRef.current = shouldSync;
        return shouldSync ? normalizedPayload : previous;
      });
      return;
    }

    if (initialDraft) {
      const nextLocalFields = resolveLocalFields(initialDraft.localIds, initialDraft.localId);
      setPayload((previous) => {
        const normalizedDraft = localFieldsEqual(nextLocalFields, initialDraft)
          ? initialDraft
          : { ...initialDraft, ...nextLocalFields };
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
      const normalizedPayload = { ...nextPayload, ...nextLocalFields };
      const shouldSync = previous !== normalizedPayload;
      skipDraftNotifyRef.current = shouldSync;
      return shouldSync ? normalizedPayload : previous;
    });
  }, [
    defaultArrendatarioId,
    defaultLocalId,
    initialData,
    initialDraft,
    proyectoId,
    resolveLocalFields
  ]);

  useEffect(() => {
    if (!uploadReviewMode) {
      return;
    }
    setReviewExtras({
      numeroContrato: uploadReviewExtras?.numeroContrato ?? ""
    });
  }, [uploadReviewExtras?.numeroContrato, uploadReviewMode]);

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

  const saveContract = useCallback(async (): Promise<void> => {
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
        setPayload(
          createEmptyPayload(proyectoId, defaultLocalId ? [defaultLocalId] : [], defaultArrendatarioId)
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado al guardar.");
    } finally {
      setLoading(false);
    }
  }, [
    defaultArrendatarioId,
    defaultLocalId,
    hasMissingSelectedLocal,
    hasSelectedLocal,
    initialData,
    localSelectionState.validSelectedIds,
    onSave,
    payload,
    proyectoId,
    uploadReviewMode
  ]);

  const extractFile = useCallback(
    async (file: File): Promise<void> => {
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

        const merged = mergeExtractedDraft(payload, data);
        const nextLocalFields = resolveLocalFields(merged.payload.localIds, merged.payload.localId);
        setPayload({
          ...merged.payload,
          ...nextLocalFields
        });

        const uniqueMissing = [...new Set(merged.missingFields)];
        if (merged.completedFields.length > 0) {
          toast.success(`Archivo analizado. Campos completados: ${merged.completedFields.length}`);
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
    },
    [canEdit, extracting, payload, proyectoId, resolveLocalFields]
  );

  const toggleLocal = useCallback(
    (localId: string, selected: boolean): void => {
      setPayload((previous) => {
        const nextLocalIds = toggleLocalSelection(previous.localIds, localId, selected);
        const nextLocalFields = resolveLocalFields(nextLocalIds, selected ? localId : previous.localId);
        return {
          ...previous,
          ...nextLocalFields
        };
      });
    },
    [resolveLocalFields]
  );

  const removeMissingLocal = useCallback(
    (localId: string): void => {
      setPayload((previous) => {
        const nextLocalIds = previous.localIds.filter((item) => item !== localId);
        const nextLocalFields = resolveLocalFields(nextLocalIds, previous.localId);
        return {
          ...previous,
          ...nextLocalFields
        };
      });
    },
    [resolveLocalFields]
  );

  const clearMissingLocals = useCallback((): void => {
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
  }, [locals]);

  return {
    payload,
    setPayload,
    reviewExtras,
    setReviewExtras,
    loading,
    extracting,
    localSearch,
    setLocalSearch,
    showOnlySelectedLocals,
    setShowOnlySelectedLocals,
    localSelectionState,
    hasSelectedLocal,
    hasMissingSelectedLocal,
    hasRequiredMasters,
    fechasContrato,
    saveContract,
    extractFile,
    toggleLocal,
    removeMissingLocal,
    clearMissingLocals
  };
}
