"use client";

import type { Dispatch, SetStateAction } from "react";
import { ContractAttachmentZone } from "@/components/contracts/ContractAttachmentZone";
import { GgccListEditor } from "@/components/contracts/GgccListEditor";
import { RentaVariableListEditor } from "@/components/contracts/RentaVariableListEditor";
import { TarifaListEditor } from "@/components/contracts/TarifaListEditor";
import { type LocalSelectionState } from "@/components/contracts/local-selection";
import type {
  ContractDraftPayload,
  ContractFormProps,
  UploadReviewExtras
} from "@/components/contracts/contract-form-types";
import { useContractFormState } from "@/components/contracts/useContractFormState";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";

export type { ContractDraftPayload, UploadReviewExtras } from "@/components/contracts/contract-form-types";
export { extractionToDraft } from "@/components/contracts/contract-form-utils";

type ContractTitleSectionProps = {
  batchMode: boolean;
  hasInitialData: boolean;
  onCancel: () => void;
};

function ContractTitleSection({ batchMode, hasInitialData, onCancel }: ContractTitleSectionProps) {
  if (batchMode) {
    return null;
  }

  return (
    <div className="flex items-center justify-between">
      <h3 className="text-base font-semibold text-slate-900">
        {hasInitialData ? "Editar contrato" : "Nuevo contrato"}
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
  );
}

type ContractReviewExtrasSectionProps = {
  uploadReviewMode: boolean;
  canEdit: boolean;
  reviewExtras: UploadReviewExtras;
  setReviewExtras: Dispatch<SetStateAction<UploadReviewExtras>>;
  hasInitialData: boolean;
  initialNumeroContrato?: string;
};

function ContractReviewExtrasSection({
  uploadReviewMode,
  canEdit,
  reviewExtras,
  setReviewExtras,
  hasInitialData,
  initialNumeroContrato
}: ContractReviewExtrasSectionProps) {
  if (uploadReviewMode) {
    return (
      <FormField label="Numero contrato" htmlFor="numero-contrato">
        <Input
          id="numero-contrato"
          value={reviewExtras.numeroContrato}
          onChange={(event) =>
            setReviewExtras((previous) => ({ ...previous, numeroContrato: event.target.value }))
          }
          disabled={!canEdit}
          className="w-full"
        />
      </FormField>
    );
  }

  if (hasInitialData) {
    return (
      <div className="text-sm">
        <span className="mb-1 block text-slate-700">Numero contrato</span>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
          {initialNumeroContrato}
        </div>
      </div>
    );
  }

  return null;
}

type ContractStatusAndLocalsSectionProps = {
  payload: ContractDraftPayload;
  setPayload: Dispatch<SetStateAction<ContractDraftPayload>>;
  canEdit: boolean;
  localSearch: string;
  setLocalSearch: (value: string) => void;
  showOnlySelectedLocals: boolean;
  setShowOnlySelectedLocals: (value: boolean) => void;
  localSelectionState: LocalSelectionState;
  hasMissingSelectedLocal: boolean;
  hasSelectedLocal: boolean;
  toggleLocal: (localId: string, selected: boolean) => void;
  removeMissingLocal: (localId: string) => void;
  clearMissingLocals: () => void;
};

function ContractStatusAndLocalsSection({
  payload,
  setPayload,
  canEdit,
  localSearch,
  setLocalSearch,
  showOnlySelectedLocals,
  setShowOnlySelectedLocals,
  localSelectionState,
  hasMissingSelectedLocal,
  hasSelectedLocal,
  toggleLocal,
  removeMissingLocal,
  clearMissingLocals
}: ContractStatusAndLocalsSectionProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-3">
        <FormField label="Dias de gracia" htmlFor="dias-gracia" helperText="Dias desde entrega del local hasta inicio del arriendo.">
          <Input
            id="dias-gracia"
            type="number"
            min={0}
            value={payload.diasGracia}
            onChange={(event) =>
              setPayload((previous) => ({
                ...previous,
                diasGracia: Math.max(0, Number(event.target.value) || 0)
              }))
            }
            disabled={!canEdit}
            className="w-full"
          />
        </FormField>
      </div>

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
            <p className="py-2 text-xs text-slate-500">No hay locales para este filtro.</p>
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
  );
}

type ContractCommercialSectionProps = {
  payload: ContractDraftPayload;
  setPayload: Dispatch<SetStateAction<ContractDraftPayload>>;
  arrendatarios: ContractFormProps["arrendatarios"];
  canEdit: boolean;
  fechasContrato?: { inicio: string; termino: string };
};

function ContractCommercialSection({
  payload,
  setPayload,
  arrendatarios,
  canEdit,
  fechasContrato
}: ContractCommercialSectionProps) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-5">
        <FormField label="Arrendatario" htmlFor="arrendatario" required>
          <Select
            value={payload.arrendatarioId || undefined}
            onValueChange={(value) =>
              setPayload((previous) => ({ ...previous, arrendatarioId: value }))
            }
          >
            <SelectTrigger id="arrendatario" className="w-full">
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
        </FormField>
        <FormField label="Fecha inicio" htmlFor="fecha-inicio" required>
          <Input
            id="fecha-inicio"
            type="date"
            value={payload.fechaInicio}
            onChange={(event) =>
              setPayload((previous) => ({ ...previous, fechaInicio: event.target.value }))
            }
            className="w-full"
          />
        </FormField>
        <FormField label="Fecha termino" htmlFor="fecha-termino" required>
          <Input
            id="fecha-termino"
            type="date"
            value={payload.fechaTermino}
            onChange={(event) =>
              setPayload((previous) => ({ ...previous, fechaTermino: event.target.value }))
            }
            className="w-full"
          />
        </FormField>
        <FormField label="% Fondo promocion" htmlFor="pct-fondo-promocion" helperText="Opcional">
          <Input
            id="pct-fondo-promocion"
            inputMode="decimal"
            placeholder="Ej: 2.5"
            value={payload.pctFondoPromocion ?? ""}
            onChange={(event) =>
              setPayload((previous) => ({
                ...previous,
                pctFondoPromocion: event.target.value.trim() ? event.target.value : null
              }))
            }
            className="w-full"
          />
        </FormField>
        <FormField label="Multiplicador diciembre" htmlFor="mult-diciembre" helperText="Opcional">
          <Input
            id="mult-diciembre"
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
            className="w-full"
          />
        </FormField>
        <FormField label="Multiplicador junio" htmlFor="mult-junio" helperText="Opcional">
          <Input
            id="mult-junio"
            inputMode="decimal"
            placeholder="Ej: 1.25"
            value={payload.multiplicadorJunio ?? ""}
            onChange={(event) =>
              setPayload((previous) => ({
                ...previous,
                multiplicadorJunio: event.target.value.trim() ? event.target.value : null
              }))
            }
            disabled={!canEdit}
            className="w-full"
          />
        </FormField>
        <FormField label="Multiplicador julio" htmlFor="mult-julio" helperText="Opcional">
          <Input
            id="mult-julio"
            inputMode="decimal"
            placeholder="Ej: 1.25"
            value={payload.multiplicadorJulio ?? ""}
            onChange={(event) =>
              setPayload((previous) => ({
                ...previous,
                multiplicadorJulio: event.target.value.trim() ? event.target.value : null
              }))
            }
            disabled={!canEdit}
            className="w-full"
          />
        </FormField>
        <FormField label="Multiplicador agosto" htmlFor="mult-agosto" helperText="Opcional">
          <Input
            id="mult-agosto"
            inputMode="decimal"
            placeholder="Ej: 1.25"
            value={payload.multiplicadorAgosto ?? ""}
            onChange={(event) =>
              setPayload((previous) => ({
                ...previous,
                multiplicadorAgosto: event.target.value.trim() ? event.target.value : null
              }))
            }
            disabled={!canEdit}
            className="w-full"
          />
        </FormField>
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
        <h4 className="text-sm font-semibold text-slate-900">Costo de administracion (GGCC)</h4>
        <FormField label="% administracion" htmlFor="pct-admin-ggcc" helperText="Opcional">
          <Input
            id="pct-admin-ggcc"
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
            className="w-full"
          />
        </FormField>
      </div>

      <GgccListEditor
        ggcc={payload.ggcc}
        onChange={(updated) => setPayload((previous) => ({ ...previous, ggcc: updated }))}
        disabled={!canEdit}
      />
    </>
  );
}

type ContractAnexoSectionProps = {
  payload: ContractDraftPayload;
  setPayload: Dispatch<SetStateAction<ContractDraftPayload>>;
};

function ContractAnexoSection({ payload, setPayload }: ContractAnexoSectionProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <FormField label="Fecha anexo" htmlFor="fecha-anexo" helperText="Opcional">
        <Input
          id="fecha-anexo"
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
          className="w-full"
        />
      </FormField>
      <FormField label="Descripcion anexo" htmlFor="desc-anexo" helperText="Opcional">
        <Input
          id="desc-anexo"
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
          className="w-full"
        />
      </FormField>
    </div>
  );
}

type ContractFormActionsProps = {
  hideActions: boolean;
  batchMode: boolean;
  uploadReviewMode: boolean;
  onCancel: () => void;
  cancelLabel?: string;
  saveLabel?: string;
  hasInitialData: boolean;
  canEdit: boolean;
  loading: boolean;
  hasRequiredMasters: boolean;
  hasSelectedLocal: boolean;
  onSave: () => Promise<void>;
};

function ContractFormActions({
  hideActions,
  batchMode,
  uploadReviewMode,
  onCancel,
  cancelLabel,
  saveLabel,
  hasInitialData,
  canEdit,
  loading,
  hasRequiredMasters,
  hasSelectedLocal,
  onSave
}: ContractFormActionsProps) {
  if (hideActions) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      {batchMode || uploadReviewMode ? (
        <Button type="button" variant="outline" onClick={onCancel} className="rounded-full">
          {cancelLabel ?? (uploadReviewMode ? "Cancelar" : "Omitir")}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="default"
        onClick={() => void onSave()}
        disabled={!canEdit || loading || !hasRequiredMasters || !hasSelectedLocal}
        className="rounded-full"
      >
        {saveLabel ??
          (uploadReviewMode
            ? "Guardar fila"
            : batchMode
              ? "Aprobar y crear"
              : hasInitialData
                ? "Actualizar contrato"
                : "Crear contrato")}
      </Button>
      {!canEdit ? <span className="text-sm text-amber-700">Rol de solo lectura.</span> : null}
    </div>
  );
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
  const state = useContractFormState({
    initialData,
    initialDraft,
    proyectoId,
    locals,
    arrendatarios,
    onSave,
    canEdit,
    uploadReviewMode,
    uploadReviewExtras,
    onUploadReviewExtrasChange,
    onDraftChange
  });

  const { showConfirm, confirmNavigation, cancelNavigation, proceedNavigation } =
    useUnsavedChanges({ isDirty: state.isDirty });

  const guardedCancel = () => confirmNavigation(onCancel);

  return (
    <section className="space-y-3 rounded-md bg-white p-5 shadow-sm">
      <ConfirmModal
        open={showConfirm}
        title="Cambios sin guardar"
        description="Tienes cambios sin guardar. ¿Seguro que deseas salir?"
        confirmLabel="Salir"
        onConfirm={proceedNavigation}
        onCancel={cancelNavigation}
      />

      <ContractTitleSection
        batchMode={batchMode}
        hasInitialData={Boolean(initialData)}
        onCancel={guardedCancel}
      />

      {canEdit && !batchMode && !uploadReviewMode ? (
        <ContractAttachmentZone
          onFile={(file) => void state.extractFile(file)}
          loading={state.extracting}
          disabled={!canEdit}
        />
      ) : null}

      {!state.hasRequiredMasters ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Debes crear al menos un local y un arrendatario antes de registrar contratos.
        </p>
      ) : null}

      <ContractReviewExtrasSection
        uploadReviewMode={uploadReviewMode}
        canEdit={canEdit}
        reviewExtras={state.reviewExtras}
        setReviewExtras={state.setReviewExtras}
        hasInitialData={Boolean(initialData)}
        initialNumeroContrato={initialData?.numeroContrato}
      />

      <ContractStatusAndLocalsSection
        payload={state.payload}
        setPayload={state.setPayload}
        canEdit={canEdit}
        localSearch={state.localSearch}
        setLocalSearch={state.setLocalSearch}
        showOnlySelectedLocals={state.showOnlySelectedLocals}
        setShowOnlySelectedLocals={state.setShowOnlySelectedLocals}
        localSelectionState={state.localSelectionState}
        hasMissingSelectedLocal={state.hasMissingSelectedLocal}
        hasSelectedLocal={state.hasSelectedLocal}
        toggleLocal={state.toggleLocal}
        removeMissingLocal={state.removeMissingLocal}
        clearMissingLocals={state.clearMissingLocals}
      />

      <ContractCommercialSection
        payload={state.payload}
        setPayload={state.setPayload}
        arrendatarios={arrendatarios}
        canEdit={canEdit}
        fechasContrato={state.fechasContrato}
      />

      <ContractAnexoSection payload={state.payload} setPayload={state.setPayload} />

      <ContractFormActions
        hideActions={hideActions}
        batchMode={batchMode}
        uploadReviewMode={uploadReviewMode}
        onCancel={guardedCancel}
        cancelLabel={cancelLabel}
        saveLabel={saveLabel}
        hasInitialData={Boolean(initialData)}
        canEdit={canEdit}
        loading={state.loading}
        hasRequiredMasters={state.hasRequiredMasters}
        hasSelectedLocal={state.hasSelectedLocal}
        onSave={state.saveContract}
      />
    </section>
  );
}
