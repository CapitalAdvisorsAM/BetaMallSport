export type FlowKind = "ingreso" | "costo";

export type Tone = "positive" | "negative" | "neutral";

export function getValueTone(_kind: FlowKind, value: number | null | undefined): Tone {
  if (value === null || value === undefined) return "neutral";
  if (value === 0) return "neutral";
  // Sign-based: positive = green, negative = red for all sections.
  // Costs are stored as negative UF values, so they correctly show red.
  // `_kind` is kept only so callers don't need to change signatures.
  return value >= 0 ? "positive" : "negative";
}

export function getVarianceTone(
  kind: FlowKind,
  variance: number | null | undefined
): Tone {
  if (variance === null || variance === undefined) return "neutral";
  if (variance === 0) return "neutral";
  const favorable = kind === "ingreso" ? variance > 0 : variance < 0;
  return favorable ? "positive" : "negative";
}

export const TONE_TEXT_CLASS: Record<Tone, string> = {
  positive: "text-positive-700",
  negative: "text-negative-700",
  neutral: "text-slate-500",
};

export const TONE_BG_CLASS: Record<Tone, string> = {
  positive: "bg-positive-50 text-positive-700",
  negative: "bg-negative-50 text-negative-700",
  neutral: "bg-surface-100 text-slate-600",
};

export function toneClass(tone: Tone): string {
  return TONE_TEXT_CLASS[tone];
}
