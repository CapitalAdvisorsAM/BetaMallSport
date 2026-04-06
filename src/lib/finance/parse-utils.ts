export function str(v: unknown): string {
  return String(v ?? "").trim();
}

export function num(v: unknown): number {
  const n = parseFloat(String(v ?? "0").replace(",", "."));
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
