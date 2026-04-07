export type ColumnSortState = false | "asc" | "desc";
export type AriaSortValue = "none" | "ascending" | "descending";

export function mapSortStateToAriaSort(sortState: ColumnSortState): AriaSortValue {
  if (sortState === "asc") {
    return "ascending";
  }
  if (sortState === "desc") {
    return "descending";
  }
  return "none";
}
