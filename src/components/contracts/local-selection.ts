import type { ContractManagerOption } from "@/types";

export type LocalSelectionState = {
  normalizedSelectedIds: string[];
  validSelectedIds: string[];
  missingSelectedIds: string[];
  filteredLocals: ContractManagerOption[];
};

type BuildLocalSelectionStateParams = {
  locals: ContractManagerOption[];
  selectedLocalIds: string[];
  search: string;
  onlySelected: boolean;
};

export function normalizeLocalIds(localIds: string[]): string[] {
  return Array.from(
    new Set(
      localIds
        .map((localId) => localId.trim())
        .filter(Boolean)
    )
  );
}

export function toggleLocalSelection(
  currentLocalIds: string[],
  localId: string,
  selected: boolean
): string[] {
  const nextIds = new Set(normalizeLocalIds(currentLocalIds));
  if (selected) {
    nextIds.add(localId);
  } else {
    nextIds.delete(localId);
  }
  return Array.from(nextIds);
}

export function buildLocalSelectionState({
  locals,
  selectedLocalIds,
  search,
  onlySelected
}: BuildLocalSelectionStateParams): LocalSelectionState {
  const normalizedSelectedIds = normalizeLocalIds(selectedLocalIds);
  const localIds = new Set(locals.map((local) => local.id));
  const validSelectedIds = normalizedSelectedIds.filter((localId) => localIds.has(localId));
  const missingSelectedIds = normalizedSelectedIds.filter((localId) => !localIds.has(localId));
  const validSelectedSet = new Set(validSelectedIds);

  const searchQuery = search.trim().toLowerCase();
  const sourceLocals = onlySelected ? locals.filter((local) => validSelectedSet.has(local.id)) : locals;
  const filteredLocals = searchQuery
    ? sourceLocals.filter((local) => local.label.toLowerCase().includes(searchQuery))
    : sourceLocals;

  return {
    normalizedSelectedIds,
    validSelectedIds,
    missingSelectedIds,
    filteredLocals
  };
}

export function alignPrimaryLocalId(currentLocalId: string, validSelectedIds: string[]): string {
  if (validSelectedIds.length === 0) {
    return currentLocalId;
  }
  if (validSelectedIds.includes(currentLocalId)) {
    return currentLocalId;
  }
  return validSelectedIds[0] ?? "";
}
