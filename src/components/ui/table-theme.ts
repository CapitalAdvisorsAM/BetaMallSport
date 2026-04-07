export type TableDensity = "compact" | "default" | "comfortable";

type DensityThemeTokens = {
  headCell: string;
  cell: string;
  compactCell: string;
  compactHeadCell: string;
};

type TableThemeTokens = DensityThemeTokens & {
  surface: string;
  scroll: string;
  table: string;
  head: string;
  row: string;
  rowHover: string;
  rowStripedLight: string;
  rowStripedMuted: string;
};

const SHARED_THEME_TOKENS = {
  surface: "overflow-hidden rounded-md border border-slate-200 bg-white",
  scroll: "overflow-x-auto",
  table: "min-w-full text-sm",
  head: "bg-brand-700 text-white/70",
  row: "border-b border-slate-200",
  rowHover: "hover:bg-brand-50",
  rowStripedLight: "bg-white",
  rowStripedMuted: "bg-slate-50/60"
} as const;

const DENSITY_THEME_TOKENS: Record<TableDensity, DensityThemeTokens> = {
  compact: {
    headCell: "px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-white/70",
    cell: "px-3 py-2 text-slate-700",
    compactCell: "px-2.5 py-1.5 text-slate-700",
    compactHeadCell: "px-2.5 py-1.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70"
  },
  default: {
    headCell: "px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70",
    cell: "px-3 py-2.5 text-slate-700",
    compactCell: "px-2.5 py-2 text-slate-700",
    compactHeadCell: "px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-white/70"
  },
  comfortable: {
    headCell: "px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/70",
    cell: "px-4 py-3 text-slate-700",
    compactCell: "px-3 py-2 text-slate-700",
    compactHeadCell: "px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-white/70"
  }
};

const TABLE_THEMES: Record<TableDensity, TableThemeTokens> = {
  compact: { ...SHARED_THEME_TOKENS, ...DENSITY_THEME_TOKENS.compact },
  default: { ...SHARED_THEME_TOKENS, ...DENSITY_THEME_TOKENS.default },
  comfortable: { ...SHARED_THEME_TOKENS, ...DENSITY_THEME_TOKENS.comfortable }
};

export function getTableTheme(density: TableDensity = "default"): TableThemeTokens {
  return TABLE_THEMES[density];
}

// Backward compatible default export used across the current codebase.
export const tableTheme = getTableTheme("default");

export function getStripedRowClass(index: number, density: TableDensity = "default"): string {
  const theme = getTableTheme(density);
  return index % 2 === 0 ? theme.rowStripedLight : theme.rowStripedMuted;
}
