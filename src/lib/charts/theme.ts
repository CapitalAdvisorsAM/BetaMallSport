// Chart theme tokens — kept in sync with tailwind.config.ts design tokens.
// All Recharts-based charts must source colors, axis props, margins, and
// legend config from this file. No hex literals in chart components.

export const chartColors = {
  // Brand (primary)
  brandPrimary: "#164786", // brand-500
  brandDark: "#011E42", // brand-700
  brandLight: "#93C5FD", // brand-300
  brandSurface: "#DBEAFE", // brand-100 (soft fills / areas)

  // Accent
  gold: "#d4a84b", // gold-400
  goldLight: "#f0d080", // gold-300

  // Semantic
  positive: "#059669", // emerald-600
  positiveLight: "#10b981",
  negative: "#dc2626", // rose-600
  negativeLight: "#ef4444",
  warning: "#d97706", // amber-600
  warningLight: "#f59e0b",

  // Neutrals (grid / axis / labels)
  axis: "#64748b", // slate-500
  axisMuted: "#94a3b8", // slate-400
  grid: "#e2e8f0", // slate-200
  text: "#334155", // slate-700
} as const;

// Hybrid categorical palette — brand/gold first so charts with few series
// keep brand identity; remaining colors differentiate when N is high.
export const chartSeriesPalette = [
  chartColors.brandPrimary,
  chartColors.gold,
  chartColors.positive,
  chartColors.warning,
  "#7c3aed", // purple-600
  "#0891b2", // cyan-600
  "#ec4899", // pink-500
  "#84cc16", // lime-500
  "#f97316", // orange-500
  "#6366f1", // indigo-500
] as const;

export function getSeriesColor(index: number): string {
  return chartSeriesPalette[index % chartSeriesPalette.length];
}

// CartesianGrid defaults
export const chartGridProps = {
  strokeDasharray: "3 3",
  stroke: chartColors.grid,
  vertical: false,
} as const;

// Axis defaults (spread into both XAxis and YAxis)
export const chartAxisProps = {
  tick: { fontSize: 11, fill: chartColors.axis },
  tickLine: false,
  axisLine: { stroke: chartColors.grid },
} as const;

// Standard chart margins
export const chartMargins = {
  default: { top: 8, right: 20, left: 10, bottom: 5 },
  compact: { top: 4, right: 12, left: 8, bottom: 0 },
  withLegend: { top: 8, right: 20, left: 10, bottom: 24 },
} as const;

// Legend defaults
export const chartLegendProps = {
  wrapperStyle: { fontSize: 11, color: chartColors.text },
  iconType: "circle" as const,
  iconSize: 8,
} as const;

// Standard Bar radius (top corners only)
export const chartBarRadius: [number, number, number, number] = [2, 2, 0, 0];

// Standard chart heights
export const chartHeight = {
  sm: 220, // compact widgets
  md: 280, // default
  lg: 320, // detailed charts
  xl: 360, // waterfall / many-series
} as const;
