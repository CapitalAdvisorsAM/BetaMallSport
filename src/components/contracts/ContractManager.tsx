"use client";

import { EstadoContrato } from "@prisma/client";
import { useEffect, useMemo, useState } from "react";
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

function createEmptyPayload(proyectoId: string, localId = "", arrendatarioId = ""): ContractFormPayload {
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
    tarifas: [
      {
        tipo: "FIJO_UF_M2",
        valor: "",
        vigenciaDesde: "",
        vigenciaHasta: null,
        esDiciembre: false
      }
    ],
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
  const [contractList, setContractList] = useState<ContractListItem[]>(contracts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingPdfId, setUploadingPdfId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [payload, setPayload] = useState<ContractFormPayload>(
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
      tarifas:
        contract.tarifas.length > 0
          ? contract.tarifas
          : [{ tipo: "FIJO_UF_M2", valor: "", vigenciaDesde: "", vigenciaHasta: null, esDiciembre: false }],
      ggcc: contract.ggcc,
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
        body: JSON.stringify(payload)
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

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-slate-700">Numero contrato</span>
            <input
              value={payload.numeroContrato}
              onChange={(event) => setPayload({ ...payload, numeroContrato: event.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-700">Estado</span>
            <select
              value={payload.estado}
              onChange={(event) => setPayload({ ...payload, estado: event.target.value as EstadoContrato })}
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
              onChange={(event) => setPayload({ ...payload, localId: event.target.value })}
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
              onChange={(event) => setPayload({ ...payload, arrendatarioId: event.target.value })}
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
              onChange={(event) => setPayload({ ...payload, fechaInicio: event.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-700">Fecha termino</span>
            <input
              type="date"
              value={payload.fechaTermino}
              onChange={(event) => setPayload({ ...payload, fechaTermino: event.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">Tarifas</h4>
            <button
              type="button"
              onClick={() =>
                setPayload({
                  ...payload,
                  tarifas: [
                    ...payload.tarifas,
                    { tipo: "FIJO_UF_M2", valor: "", vigenciaDesde: "", vigenciaHasta: null, esDiciembre: false }
                  ]
                })
              }
              className="text-sm font-medium text-brand-700"
            >
              + Agregar
            </button>
          </div>
          <div className="space-y-2">
            {payload.tarifas.map((tarifa, index) => (
              <div key={`${tarifa.tipo}-${index}`} className="grid gap-2 md:grid-cols-5">
                <select
                  value={tarifa.tipo}
                  onChange={(event) => {
                    const next = [...payload.tarifas];
                    next[index] = { ...tarifa, tipo: event.target.value as ContractFormPayload["tarifas"][0]["tipo"] };
                    setPayload({ ...payload, tarifas: next });
                  }}
                  className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                >
                  <option value="FIJO_UF_M2">FIJO_UF_M2</option>
                  <option value="FIJO_UF">FIJO_UF</option>
                  <option value="PORCENTAJE">PORCENTAJE</option>
                </select>
                <input
                  placeholder="Valor"
                  value={tarifa.valor}
                  onChange={(event) => {
                    const next = [...payload.tarifas];
                    next[index] = { ...tarifa, valor: event.target.value };
                    setPayload({ ...payload, tarifas: next });
                  }}
                  className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                />
                <input
                  type="date"
                  value={tarifa.vigenciaDesde}
                  onChange={(event) => {
                    const next = [...payload.tarifas];
                    next[index] = { ...tarifa, vigenciaDesde: event.target.value };
                    setPayload({ ...payload, tarifas: next });
                  }}
                  className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                />
                <input
                  type="date"
                  value={tarifa.vigenciaHasta ?? ""}
                  onChange={(event) => {
                    const next = [...payload.tarifas];
                    next[index] = { ...tarifa, vigenciaHasta: event.target.value || null };
                    setPayload({ ...payload, tarifas: next });
                  }}
                  className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = payload.tarifas.filter((_, i) => i !== index);
                    setPayload({
                      ...payload,
                      tarifas: next.length > 0 ? next : [{ tipo: "FIJO_UF_M2", valor: "", vigenciaDesde: "", vigenciaHasta: null, esDiciembre: false }]
                    });
                  }}
                  className="rounded-md border border-rose-200 px-2 py-2 text-sm text-rose-700"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">GGCC</h4>
            <button
              type="button"
              onClick={() =>
                setPayload({
                  ...payload,
                  ggcc: [
                    ...payload.ggcc,
                    {
                      tarifaBaseUfM2: "",
                      pctAdministracion: "",
                      vigenciaDesde: "",
                      vigenciaHasta: null,
                      proximoReajuste: null
                    }
                  ]
                })
              }
              className="text-sm font-medium text-brand-700"
            >
              + Agregar
            </button>
          </div>
          <div className="space-y-2">
            {payload.ggcc.map((item, index) => (
              <div key={`ggcc-${index}`} className="grid gap-2 md:grid-cols-5">
                <input
                  placeholder="Tarifa base UF/m2"
                  value={item.tarifaBaseUfM2}
                  onChange={(event) => {
                    const next = [...payload.ggcc];
                    next[index] = { ...item, tarifaBaseUfM2: event.target.value };
                    setPayload({ ...payload, ggcc: next });
                  }}
                  className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                />
                <input
                  placeholder="% administracion"
                  value={item.pctAdministracion}
                  onChange={(event) => {
                    const next = [...payload.ggcc];
                    next[index] = { ...item, pctAdministracion: event.target.value };
                    setPayload({ ...payload, ggcc: next });
                  }}
                  className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                />
                <input
                  type="date"
                  value={item.vigenciaDesde}
                  onChange={(event) => {
                    const next = [...payload.ggcc];
                    next[index] = { ...item, vigenciaDesde: event.target.value };
                    setPayload({ ...payload, ggcc: next });
                  }}
                  className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                />
                <input
                  type="date"
                  value={item.vigenciaHasta ?? ""}
                  onChange={(event) => {
                    const next = [...payload.ggcc];
                    next[index] = { ...item, vigenciaHasta: event.target.value || null };
                    setPayload({ ...payload, ggcc: next });
                  }}
                  className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setPayload({ ...payload, ggcc: payload.ggcc.filter((_, i) => i !== index) })}
                  className="rounded-md border border-rose-200 px-2 py-2 text-sm text-rose-700"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-slate-700">Fecha anexo</span>
            <input
              type="date"
              value={payload.anexo?.fecha ?? ""}
              onChange={(event) =>
                setPayload({
                  ...payload,
                  anexo: {
                    fecha: event.target.value,
                    descripcion: payload.anexo?.descripcion ?? ""
                  }
                })
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-700">Descripcion anexo</span>
            <input
              value={payload.anexo?.descripcion ?? ""}
              onChange={(event) =>
                setPayload({
                  ...payload,
                  anexo: {
                    fecha: payload.anexo?.fecha ?? "",
                    descripcion: event.target.value
                  }
                })
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={saveContract}
            disabled={!canEdit || loading}
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
