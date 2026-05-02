"use client";

import type {
  AccountingGroupOptions,
  AccountingRecordPatchPayload,
  AccountingRecordRow,
  AccountingRecordsResponse,
} from "@/types/accounting-records";
import { extractApiErrorMessage } from "@/lib/http/client-errors";

export type FetchRecordsParams = {
  projectId: string;
  period?: string;
  group1?: string;
  group3?: string;
  search?: string;
  onlyEdited?: boolean;
  scenario?: "REAL" | "PPTO";
  cursor?: string;
  limit?: number;
};

export function useAccountingRecordsApi() {
  async function fetchRecords(params: FetchRecordsParams): Promise<AccountingRecordsResponse> {
    const sp = new URLSearchParams({ projectId: params.projectId });
    if (params.period) sp.set("period", params.period);
    if (params.group1) sp.set("group1", params.group1);
    if (params.group3) sp.set("group3", params.group3);
    if (params.search) sp.set("search", params.search);
    if (params.onlyEdited) sp.set("onlyEdited", "true");
    if (params.scenario) sp.set("scenario", params.scenario);
    if (params.cursor) sp.set("cursor", params.cursor);
    if (params.limit) sp.set("limit", String(params.limit));

    const response = await fetch(`/api/real/accounting-records?${sp.toString()}`);
    if (!response.ok) {
      throw new Error(await extractApiErrorMessage(response, "Error al cargar los registros."));
    }
    return response.json() as Promise<AccountingRecordsResponse>;
  }

  async function patchRecord(
    id: string,
    payload: AccountingRecordPatchPayload
  ): Promise<AccountingRecordRow> {
    const response = await fetch(`/api/real/accounting-records/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(await extractApiErrorMessage(response, "Error al guardar el cambio."));
    }
    return response.json() as Promise<AccountingRecordRow>;
  }

  async function fetchGroupOptions(
    projectId: string,
    scenario: "REAL" | "PPTO" = "REAL"
  ): Promise<AccountingGroupOptions> {
    const sp = new URLSearchParams({ projectId, scenario });
    const response = await fetch(`/api/real/accounting-records/group-options?${sp.toString()}`);
    if (!response.ok) {
      throw new Error(await extractApiErrorMessage(response, "Error al cargar opciones."));
    }
    return response.json() as Promise<AccountingGroupOptions>;
  }

  async function fetchUnits(projectId: string): Promise<{ id: string; nombre: string }[]> {
    const sp = new URLSearchParams({ projectId, limit: "200" });
    const response = await fetch(`/api/units?${sp.toString()}`);
    if (!response.ok) {
      throw new Error(await extractApiErrorMessage(response, "Error al cargar locales."));
    }
    const data = (await response.json()) as {
      data?: { id: string; nombre: string }[];
      items?: { id: string; nombre: string }[];
    };
    const items = data.data ?? data.items ?? [];
    return items.map(({ id, nombre }) => ({ id, nombre }));
  }

  async function fetchTenants(projectId: string): Promise<{ id: string; nombre: string }[]> {
    const sp = new URLSearchParams({ projectId, limit: "200" });
    const response = await fetch(`/api/tenants?${sp.toString()}`);
    if (!response.ok) {
      throw new Error(await extractApiErrorMessage(response, "Error al cargar arrendatarios."));
    }
    const data = (await response.json()) as {
      data?: { id: string; nombreComercial: string }[];
      items?: { id: string; nombreComercial: string }[];
    };
    const items = data.data ?? data.items ?? [];
    return items.map(({ id, nombreComercial }) => ({ id, nombre: nombreComercial }));
  }

  return { fetchRecords, patchRecord, fetchGroupOptions, fetchUnits, fetchTenants };
}
