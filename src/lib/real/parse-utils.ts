export function str(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeNumericString(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "-" || trimmed === "–" || trimmed === "—") {
    return "0";
  }

  const negative = trimmed.startsWith("(") && trimmed.endsWith(")");
  let normalized = negative ? trimmed.slice(1, -1) : trimmed;
  normalized = normalized.replace(/\s+/g, "");

  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(normalized)) {
    normalized = normalized.replace(/,/g, "");
  } else if (/^-?\d+,\d+$/.test(normalized)) {
    normalized = normalized.replace(",", ".");
  } else if (normalized.includes(",") && !normalized.includes(".")) {
    normalized = normalized.replace(/,/g, "");
  }

  return negative ? `-${normalized}` : normalized;
}

export function num(v: unknown): number {
  if (typeof v === "number") {
    return Number.isFinite(v) ? v : 0;
  }

  const n = parseFloat(normalizeNumericString(String(v ?? "0")));
  return isNaN(n) ? 0 : n;
}

/** Calcula similaridad Jaccard sobre bigramas */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const A = a.toUpperCase();
  const B = b.toUpperCase();
  if (A === B) return 1;
  if (A.length < 2 || B.length < 2) return 0;
  const bg = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const ba = bg(A);
  const bb = bg(B);
  let inter = 0;
  for (const x of ba) if (bb.has(x)) inter++;
  return (2 * inter) / (ba.size + bb.size);
}
