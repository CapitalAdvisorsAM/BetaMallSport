"use client";

import { EstadoContrato } from "@prisma/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { GgccListEditor, type GgccListItem } from "@/components/contracts/GgccListEditor";
import {
  createEmptyTarifaItem,
  TarifaListEditor,
  type TarifaListItem
} from "@/components/contracts/TarifaListEditor";
import { useContractApi } from "@/hooks/useContractApi";
import type { ContractFormPayload } from "@/types";

type ContractListItem = {
  id: string;
  numeroContrato: string;
  estado: EstadoContrato;
  pdfUrl: string | null;
  fechaInicio: string;
  fechaTermino: string;
  local: { id: string; codigo: string; nombre: string };
  arrendatario: { id: string; nombreComercial: string; razonSocial: string };
  tarifas: Array<{
    tipo: "FIJO_UF_M2" | "FIJO_UF" | "PORCENTAJE";
    valor: string;
    vigenciaDesde: string;
    vigenciaHasta: string | null;
    esDiciembre: boolean;
  }>;
  ggcc: Array<{
    tarifaBaseUfM2: string;
    pctAdministracion: string;
    vigenciaDesde: string;
    vigenciaHasta: string | null;
    proximoReajuste: string | null;
  }>;
};

type Option = { id: string; label: string };

type ContractManagerProps = {
  proyectoId: string;
  canEdit: boolean;
  locals: Option[];
  arrendatarios: Option[];
  contracts: ContractListItem[];
};

type ContractExtractionResponse = {
  numeroContrato: string | null;
  arrendatarioRut: string | null;
  arrendatarioNombre: string | null;
  localCodigo: string | null;
  glam2: string | null;
  fechaInicio: string | null;
  fechaTermino: string | null;
  pctRentaVariable: string | null;
  pctFondoPromocion: string | null;
  tarifas: Array<{
    tipo: "FIJO_UF_M2" | "PORCENTAJE";
    valor: string;
    vigenciaDesde: string;
    vigenciaHasta: string | null;
    esDiciembre: boolean;
  }>;
  ggcc: Array<{
    tarifaBaseUfM2: string;
    pctAdministracion: string;
    vigenciaDesde: string;
    vigenciaHasta: null;
    proximoReajuste: null;
  }>;
  arrendatarioId: string | null;
  localId: string | null;
};

type ContractDraftPayload = Omit<ContractFormPayload, "tarifas" | "ggcc"> & {
  tarifas: TarifaListItem[];
  ggcc: GgccListItem[];
};

function toDraftTarifa(item: ContractFormPayload["tarifas"][number]): TarifaListItem {
  return { ...item, _key: crypto.randomUUID() };
}

function toDraftGgcc(item: ContractFormPayload["ggcc"][number]): GgccListItem {
  return { ...item, _key: crypto.randomUUID() };
}

function toApiPayload(payload: ContractDraftPayload): ContractFormPayload {
  return {
    ...payload,
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
      vigenciaDesde: item.vigenciaDesde,
      vigenciaHasta: item.vigenciaHasta,
      proximoReajuste: item.proximoReajuste
    }))
  };
}

function createEmptyPayload(proyectoId: string, localId = "", arrendatarioId = ""): ContractDraftPayload {
  return {
    proyectoId,
    localId,
    arrendatarioId,
    numeroContrato: "",
    fechaInicio: "",
    fechaTermino: "",
    fechaEntrega: null,
    fechaApertura: null,
    estado: "VIGENTE",
    pctRentaVariable: null,
    pctFondoPromocion: null,
    codigoCC: null,
    pdfUrl: null,
    notas: null,
    tarifas: [createEmptyTarifaItem()],
    ggcc: [],
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

function hasMeaningfulGgcc(ggcc: GgccListItem[]): boolean {
  return ggcc.some(
    (item) =>
      !isBlank(item.tarifaBaseUfM2) ||
      !isBlank(item.pctAdministracion) ||
      !isBlank(item.vigenciaDesde) ||
      !isBlank(item.vigenciaHasta)
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

function toDraftGgccFromExtraction(item: ContractExtractionResponse["ggcc"][number]): GgccListItem {
  return {
    _key: crypto.randomUUID(),
    tarifaBaseUfM2: item.tarifaBaseUfM2,
    pctAdministracion: item.pctAdministracion,
    vigenciaDesde: item.vigenciaDesde,
    vigenciaHasta: item.vigenciaHasta,
    proximoReajuste: item.proximoReajuste
  };
}

export function ContractManager({
  proyectoId,
  canEdit,
  locals,
  arrendatarios,
  contracts
}: ContractManagerProps): JSX.Element {
  const hasRequiredMasters = locals.length > 0 && arrendatarios.length > 0;
  const [contractList, setContractList] = useState<ContractListItem[]>(contracts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [extractMsg, setExtractMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingPdfId, setUploadingPdfId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const extractInputRef = useRef<HTMLInputElement | null>(null);
  const [payload, setPayload] = useState<ContractDraftPayload>(
    createEmptyPayload(proyectoId, locals[0]?.id ?? "", arrendatarios[0]?.id ?? "")
  );
  const {
    saveContract: saveContractRequest,
    deleteContract: deleteContractRequest,
    uploadContractPdf: uploadContractPdfRequest
  } = useContractApi();

  useEffect(() => {
    setContractList(contracts);
  }, [contracts]);

  const visibleContracts = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) {
      return contractList;
    }
    return contractList.filter((contract) =>
      [contract.numeroContrato, contract.local.codigo, contract.arrendatario.nombreComercial]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [contractList, search]);

  const selectedContract = contractList.find((contract) => contract.id === selectedId) ?? null;

  function loadContract(contract: ContractListItem): void {
    setSelectedId(contract.id);
    setExtractMsg(null);
    setPayload({
      proyectoId,
      localId: contract.local.id,
      arrendatarioId: contract.arrendatario.id,
      numeroContrato: contract.numeroContrato,
      fechaInicio: contract.fechaInicio.slice(0, 10),
      fechaTermino: contract.fechaTermino.slice(0, 10),
      fechaEntrega: null,
      fechaApertura: null,
      estado: contract.estado,
      pctRentaVariable: null,
      pctFondoPromocion: null,
      codigoCC: null,
      pdfUrl: contract.pdfUrl,
      notas: null,
      tarifas: contract.tarifas.length > 0 ? contract.tarifas.map(toDraftTarifa) : [createEmptyTarifaItem()],
      ggcc: contract.ggcc.map(toDraftGgcc),
      anexo: null
    });
  }

  async function saveContract(): Promise<void> {
    setLoading(true);
    setMessage(null);
    setExtractMsg(null);
    try {
      const isEditing = Boolean(selectedId);
      await saveContractRequest(toApiPayload(payload), selectedId ?? undefined);
      setMessage("Contrato guardado correctamente. Recarga la pagina para ver la lista actualizada.");
      if (!isEditing) {
        setPayload(createEmptyPayload(proyectoId, locals[0]?.id ?? "", arrendatarios[0]?.id ?? ""));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error inesperado al guardar.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteContract(): Promise<void> {
    if (!selectedId || !canEdit || deleting) {
      return;
    }
    if (!window.confirm("Se eliminara el contrato seleccionado. Esta accion no se puede deshacer.")) {
      return;
    }

    setDeleting(true);
    setMessage(null);
    setExtractMsg(null);
    try {
      await deleteContractRequest(selectedId);

      setContractList((previous) => previous.filter((item) => item.id !== selectedId));
      setSelectedId(null);
      setPayload(createEmptyPayload(proyectoId, locals[0]?.id ?? "", arrendatarios[0]?.id ?? ""));
      setMessage("Contrato eliminado correctamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error inesperado al eliminar.");
    } finally {
      setDeleting(false);
    }
  }

  async function uploadContractPdf(contractId: string, file: File): Promise<void> {
    if (!canEdit) {
      return;
    }

    setUploadingPdfId(contractId);
    setMessage(null);
    setExtractMsg(null);
    try {
      const pdfUrl = await uploadContractPdfRequest(contractId, file);

      setContractList((previous) =>
        previous.map((item) => (item.id === contractId ? { ...item, pdfUrl } : item))
      );
      if (selectedId === contractId) {
        setPayload((previous) => ({ ...previous, pdfUrl }));
      }
      setMessage("PDF actualizado correctamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error inesperado al subir el PDF.");
    } finally {
      setUploadingPdfId(null);
    }
  }

  async function extractPdf(file: File): Promise<void> {
    if (!canEdit || extracting) {
      return;
    }
    if (file.type !== "application/pdf") {
      setExtractMsg("Solo se admiten archivos PDF (application/pdf).");
      return;
    }

    setExtracting(true);
    setExtractMsg(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch(`/api/contracts/extract?proyectoId=${encodeURIComponent(proyectoId)}`, {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as ContractExtractionResponse & { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "No se pudo leer el PDF.");
      }

      const currentPayload = payload;
      const nextPayload: ContractDraftPayload = {
        ...currentPayload
      };
      const completedFields: string[] = [];
      const missingFields: string[] = [];

      if (data.localId) {
        if (nextPayload.localId !== data.localId) {
          completedFields.push("local");
        }
        nextPayload.localId = data.localId;
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

      if (data.numeroContrato && isBlank(nextPayload.numeroContrato)) {
        nextPayload.numeroContrato = data.numeroContrato;
        completedFields.push("numeroContrato");
      } else if (!data.numeroContrato) {
        missingFields.push("numeroContrato");
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

      if (data.pctRentaVariable && !nextPayload.pctRentaVariable) {
        nextPayload.pctRentaVariable = data.pctRentaVariable;
        completedFields.push("pctRentaVariable");
      } else if (!data.pctRentaVariable) {
        missingFields.push("pctRentaVariable");
      }

      if (data.pctFondoPromocion && !nextPayload.pctFondoPromocion) {
        nextPayload.pctFondoPromocion = data.pctFondoPromocion;
        completedFields.push("pctFondoPromocion");
      } else if (!data.pctFondoPromocion) {
        missingFields.push("pctFondoPromocion");
      }

      if (data.tarifas.length > 0 && !hasMeaningfulTarifas(nextPayload.tarifas)) {
        nextPayload.tarifas = data.tarifas.map(toDraftTarifaFromExtraction);
        completedFields.push("tarifas");
      } else if (data.tarifas.length === 0) {
        missingFields.push("tarifas");
      }

      if (data.ggcc.length > 0 && !hasMeaningfulGgcc(nextPayload.ggcc)) {
        nextPayload.ggcc = data.ggcc.map(toDraftGgccFromExtraction);
        completedFields.push("ggcc");
      } else if (data.ggcc.length === 0) {
        missingFields.push("ggcc");
      }

      setPayload(nextPayload);

      const uniqueMissing = [...new Set(missingFields)];
      if (completedFields.length > 0) {
        const missingSuffix =
          uniqueMissing.length > 0 ? ` No extraidos: ${uniqueMissing.join(", ")}.` : "";
        setExtractMsg(`✓ ${completedFields.length} campos completados.${missingSuffix}`);
      } else if (uniqueMissing.length > 0) {
        setExtractMsg(`No se pudieron extraer: ${uniqueMissing.join(", ")}.`);
      } else {
        setExtractMsg("El PDF fue leido, pero no habia campos nuevos para completar.");
      }
    } catch (error) {
      setExtractMsg(error instanceof Error ? error.message : "Error inesperado al leer el PDF.");
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <aside className="rounded-md bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Contratos del proyecto</h3>
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
          placeholder="Buscar contrato/local"
          className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="mt-3 max-h-[540px] space-y-2 overflow-auto pr-1">
          {visibleContracts.map((contract) => (
            <div
              key={contract.id}
              className={`rounded-md border px-3 py-2 text-sm ${
                selectedId === contract.id ? "border-brand-500 bg-brand-50" : "border-slate-200"
              }`}
            >
              <button type="button" onClick={() => loadContract(contract)} className="w-full text-left">
                <p className="font-semibold text-slate-900">{contract.numeroContrato}</p>
                <p className="text-xs text-slate-600">
                  {contract.local.codigo} - {contract.arrendatario.nombreComercial}
                </p>
              </button>
              <div className="mt-2 flex items-center gap-2">
                {contract.pdfUrl ? (
                  <a
                    href={contract.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Ver PDF
                  </a>
                ) : (
                  <span className="text-xs text-slate-500">Sin PDF</span>
                )}
                {canEdit ? (
                  <label
                    className={`rounded-md border px-2 py-1 text-xs font-medium ${
                      uploadingPdfId === contract.id
                        ? "cursor-not-allowed border-slate-200 text-slate-400"
                        : "cursor-pointer border-brand-200 text-brand-700 hover:bg-brand-50"
                    }`}
                  >
                    {uploadingPdfId === contract.id ? "Subiendo..." : "Subir PDF"}
                    <input
                      type="file"
                      accept="application/pdf"
                      disabled={uploadingPdfId === contract.id}
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) {
                          return;
                        }
                        void uploadContractPdf(contract.id, file);
                      }}
                    />
                  </label>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="space-y-4 rounded-md bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            {selectedContract ? "Editar contrato" : "Nuevo contrato"}
          </h3>
          <div className="flex items-center gap-2">
            {selectedContract ? (
              <button
                type="button"
                onClick={() => void deleteContract()}
                disabled={!canEdit || deleting}
                className="rounded-md border border-rose-200 px-3 py-1.5 text-sm text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            ) : null}
            {canEdit ? (
              <>
                <button
                  type="button"
                  disabled={extracting}
                  onClick={() => extractInputRef.current?.click()}
                  className="rounded-md border border-brand-200 px-3 py-1.5 text-sm text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                >
                  {extracting ? "Leyendo..." : "\u{1F4C4} Leer PDF"}
                </button>
                <input
                  ref={extractInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) {
                      return;
                    }
                    void extractPdf(file);
                  }}
                />
              </>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                setExtractMsg(null);
                setPayload(createEmptyPayload(proyectoId, locals[0]?.id ?? "", arrendatarios[0]?.id ?? ""));
              }}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              Nuevo
            </button>
          </div>
        </div>

        {!hasRequiredMasters ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Debes crear al menos un local y un arrendatario antes de registrar contratos.
          </p>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-slate-700">
              Numero contrato <span className="text-rose-500">*</span>
            </span>
            <input
              value={payload.numeroContrato}
              onChange={(event) =>
                setPayload((previous) => ({ ...previous, numeroContrato: event.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-700">
              Clasificacion juridica <span className="text-xs text-slate-400">(opcional)</span>
            </span>
            <select
              value={payload.estado}
              onChange={(event) =>
                setPayload((previous) => ({
                  ...previous,
                  estado: event.target.value as EstadoContrato
                }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="VIGENTE">VIGENTE</option>
              <option value="GRACIA">GRACIA</option>
              <option value="TERMINADO">TERMINADO</option>
              <option value="TERMINADO_ANTICIPADO">TERMINADO_ANTICIPADO</option>
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Este estado es clasificacion del documento. El estado en Rent Roll se calcula
              automaticamente desde las fechas del contrato.
            </span>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-700">
              Local <span className="text-rose-500">*</span>
            </span>
            <select
              value={payload.localId}
              onChange={(event) =>
                setPayload((previous) => ({ ...previous, localId: event.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            >
              {locals.map((local) => (
                <option key={local.id} value={local.id}>
                  {local.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-700">
              Arrendatario <span className="text-rose-500">*</span>
            </span>
            <select
              value={payload.arrendatarioId}
              onChange={(event) =>
                setPayload((previous) => ({ ...previous, arrendatarioId: event.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            >
              {arrendatarios.map((arrendatario) => (
                <option key={arrendatario.id} value={arrendatario.id}>
                  {arrendatario.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-700">
              Fecha inicio <span className="text-rose-500">*</span>
            </span>
            <input
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
            <input
              type="date"
              value={payload.fechaTermino}
              onChange={(event) =>
                setPayload((previous) => ({ ...previous, fechaTermino: event.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <TarifaListEditor
          tarifas={payload.tarifas}
          onChange={(updated) => setPayload((previous) => ({ ...previous, tarifas: updated }))}
          disabled={!canEdit}
        />

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
            <input
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
            <input
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

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={saveContract}
            disabled={!canEdit || loading || !hasRequiredMasters}
            className="rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {selectedId ? "Actualizar contrato" : "Crear contrato"}
          </button>
          {!canEdit ? <span className="text-sm text-amber-700">Rol de solo lectura.</span> : null}
        </div>
        {message ? <p className="text-sm text-slate-700">{message}</p> : null}
        {extractMsg ? <p className="text-sm text-slate-700">{extractMsg}</p> : null}
      </section>
    </div>
  );
}
