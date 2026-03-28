"use client";

import { EstadoContrato } from "@prisma/client";
import { useEffect, useMemo, useState } from "react";
import { GgccListEditor, type GgccListItem } from "@/components/contracts/GgccListEditor";
import {
  createEmptyTarifaItem,
  TarifaListEditor,
  type TarifaListItem
} from "@/components/contracts/TarifaListEditor";
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
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingPdfId, setUploadingPdfId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [payload, setPayload] = useState<ContractDraftPayload>(
    createEmptyPayload(proyectoId, locals[0]?.id ?? "", arrendatarios[0]?.id ?? "")
  );

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
    try {
      const isEditing = Boolean(selectedId);
      const response = await fetch(isEditing ? `/api/contracts/${selectedId}` : "/api/contracts", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toApiPayload(payload))
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "No se pudo guardar el contrato.");
      }
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
    try {
      const response = await fetch(`/api/contracts/${selectedId}`, {
        method: "DELETE"
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "No se pudo eliminar el contrato.");
      }

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
    try {
      const formData = new FormData();
      formData.set("pdf", file);

      const response = await fetch(`/api/contracts/${contractId}/pdf`, {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as { pdfUrl?: string; message?: string };
      if (!response.ok || !data.pdfUrl) {
        throw new Error(data.message ?? "No se pudo subir el PDF.");
      }

      setContractList((previous) =>
        previous.map((item) => (item.id === contractId ? { ...item, pdfUrl: data.pdfUrl ?? null } : item))
      );
      if (selectedId === contractId) {
        setPayload((previous) => ({ ...previous, pdfUrl: data.pdfUrl ?? null }));
      }
      setMessage("PDF actualizado correctamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error inesperado al subir el PDF.");
    } finally {
      setUploadingPdfId(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <aside className="rounded-xl bg-white p-4 shadow-sm">
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

      <section className="space-y-4 rounded-xl bg-white p-5 shadow-sm">
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
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
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
            <span className="mb-1 block text-slate-700">Numero contrato</span>
            <input
              value={payload.numeroContrato}
              onChange={(event) =>
                setPayload((previous) => ({ ...previous, numeroContrato: event.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-700">Estado</span>
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
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-700">Local</span>
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
            <span className="mb-1 block text-slate-700">Arrendatario</span>
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
            <span className="mb-1 block text-slate-700">Fecha inicio</span>
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
            <span className="mb-1 block text-slate-700">Fecha termino</span>
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
            <span className="mb-1 block text-slate-700">Fecha anexo</span>
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
            <span className="mb-1 block text-slate-700">Descripcion anexo</span>
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
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {selectedId ? "Actualizar contrato" : "Crear contrato"}
          </button>
          {!canEdit ? <span className="text-sm text-amber-700">Rol de solo lectura.</span> : null}
        </div>
        {message ? <p className="text-sm text-slate-700">{message}</p> : null}
      </section>
    </div>
  );
}
