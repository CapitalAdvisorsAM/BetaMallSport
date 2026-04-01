"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import type { ContractManagerListItem } from "@/types";

type ContractListProps = {
  contracts: ContractManagerListItem[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
  nextCursor?: string;
  onLoadMore: () => void;
  selectedId?: string | null;
  deletingId?: string | null;
};

function toDateLabel(value: string): string {
  return value.slice(0, 10);
}

export function ContractList({
  contracts,
  onEdit,
  onDelete,
  canEdit,
  nextCursor,
  onLoadMore,
  selectedId,
  deletingId
}: ContractListProps): JSX.Element {
  const [search, setSearch] = useState("");

  const visibleContracts = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) {
      return contracts;
    }

    return contracts.filter((contract) =>
      [
        contract.numeroContrato,
        (contract.locales.length > 0 ? contract.locales : [contract.local])
          .map((local) => local.codigo)
          .join(" "),
        contract.arrendatario.nombreComercial
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [contracts, search]);

  return (
    <section className="rounded-md bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Contratos del proyecto</h3>
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
          placeholder="Buscar contrato/local"
          className="w-full md:w-64"
        />
      </div>

      <div className="mt-3 overflow-hidden rounded-md border border-slate-200">
        <Table className="min-w-full divide-y divide-slate-200 text-sm">
          <TableHeader className="bg-slate-100 text-slate-700">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-3 py-2 font-semibold text-slate-700">Contrato</TableHead>
              <TableHead className="px-3 py-2 font-semibold text-slate-700">Locales</TableHead>
              <TableHead className="px-3 py-2 font-semibold text-slate-700">Arrendatario</TableHead>
              <TableHead className="px-3 py-2 font-semibold text-slate-700">Estado</TableHead>
              <TableHead className="px-3 py-2 font-semibold text-slate-700">Inicio</TableHead>
              <TableHead className="px-3 py-2 font-semibold text-slate-700">Termino</TableHead>
              <TableHead className="px-3 py-2 font-semibold text-slate-700">PDF</TableHead>
              <TableHead className="px-3 py-2 font-semibold text-slate-700">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100">
            {visibleContracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="px-3 py-5 text-center text-slate-500">
                  No hay contratos para mostrar.
                </TableCell>
              </TableRow>
            ) : (
              visibleContracts.map((contract) => {
                const isSelected = selectedId === contract.id;
                return (
                  <TableRow key={contract.id} className={isSelected ? "bg-brand-50" : undefined}>
                    <TableCell className="px-3 py-2 font-medium text-slate-900">{contract.numeroContrato}</TableCell>
                    <TableCell className="px-3 py-2 text-slate-700">
                      {(contract.locales.length > 0 ? contract.locales : [contract.local])
                        .map((local) => local.codigo)
                        .join(", ")}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-slate-700">{contract.arrendatario.nombreComercial}</TableCell>
                    <TableCell className="px-3 py-2 text-slate-700">
                      <Badge variant="outline" className="border-brand-200 bg-brand-100 text-brand-700">
                        {contract.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-slate-700">{toDateLabel(contract.fechaInicio)}</TableCell>
                    <TableCell className="px-3 py-2 text-slate-700">{toDateLabel(contract.fechaTermino)}</TableCell>
                    <TableCell className="px-3 py-2">
                      {contract.pdfUrl ? (
                        <a
                          href={contract.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-brand-700 underline"
                        >
                          Ver PDF
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">Sin PDF</span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onEdit(contract.id)}
                          className="h-auto px-2 py-1 text-xs"
                        >
                          Editar
                        </Button>
                        {canEdit ? (
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => onDelete(contract.id)}
                            disabled={deletingId === contract.id}
                            className="h-auto px-2 py-1 text-xs"
                          >
                            {deletingId === contract.id ? "Eliminando..." : "Eliminar"}
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {nextCursor ? (
        <div className="mt-3 flex justify-end">
          <Button type="button" variant="outline" onClick={onLoadMore}>
            Cargar mas
          </Button>
        </div>
      ) : null}
    </section>
  );
}
