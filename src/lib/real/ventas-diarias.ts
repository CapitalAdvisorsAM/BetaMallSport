/**
 * Aggregates daily TenantSaleDaily rows into the matrix shown by the CDG
 * Excel "Ventas Diarias" view: rows per dimension value × columns per day
 * of the month, with UF and UF/m² values.
 */

type DecimalLike = number | string | { toString(): string };

export type VentaDiariaInput = {
  date: Date;
  salesPesos: DecimalLike;
  sizeCategory: string | null;
  typeCategory: string | null;
  floor: string | null;
  glaType: string | null;
  storeName: string | null;
};

export type DimensionField = "total" | "tamano" | "tipo" | "piso";

export type GlaForDimension = {
  total: number;
  byTamano: Map<string, number>;
  byTipo: Map<string, number>;
  byPiso: Map<string, number>;
};

export type DailyDimensionRow = {
  label: string;
  values: Array<{ day: number; uf: number; ufM2: number }>;
  totalUf: number;
  totalUfM2: number;
};

export type VentasDiariasResult = {
  period: string;
  daysInMonth: number;
  total: DailyDimensionRow;
  byTamano: DailyDimensionRow[];
  byTipo: DailyDimensionRow[];
  byPiso: DailyDimensionRow[];
  byStore: DailyDimensionRow[];
};

function toNum(v: DecimalLike | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

function daysInMonth(period: string): number {
  const [y, m] = period.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

type Bucket = Map<number, number>;

function add(bucket: Bucket, day: number, uf: number): void {
  bucket.set(day, (bucket.get(day) ?? 0) + uf);
}

function rowFromBucket(label: string, bucket: Bucket, glaM2: number, days: number): DailyDimensionRow {
  const values: DailyDimensionRow["values"] = [];
  let totalUf = 0;
  for (let day = 1; day <= days; day++) {
    const uf = bucket.get(day) ?? 0;
    totalUf += uf;
    values.push({
      day,
      uf,
      ufM2: glaM2 > 0 ? uf / glaM2 : 0
    });
  }
  return {
    label,
    values,
    totalUf,
    totalUfM2: glaM2 > 0 ? totalUf / glaM2 : 0
  };
}

/**
 * Builds the daily-sales matrix for a given month.
 *
 * `ufRateByDay` maps a day-of-month → UF rate; rows whose date falls outside
 * the period are ignored. Sales in pesos are converted to UF via that day's
 * rate (or 0 when missing). UF/m² uses the appropriate GLA bucket.
 */
export function buildVentasDiarias(
  rows: VentaDiariaInput[],
  period: string,
  ufRateByDay: Map<number, number>,
  gla: GlaForDimension
): VentasDiariasResult {
  const days = daysInMonth(period);

  const total: Bucket = new Map();
  const byTamano = new Map<string, Bucket>();
  const byTipo = new Map<string, Bucket>();
  const byPiso = new Map<string, Bucket>();
  const byStore = new Map<string, Bucket>();

  for (const row of rows) {
    const ym = row.date.toISOString().slice(0, 7);
    if (ym !== period) continue;

    const day = row.date.getUTCDate();
    const ufRate = ufRateByDay.get(day) ?? 0;
    if (ufRate <= 0) continue;
    const uf = toNum(row.salesPesos) / ufRate;

    add(total, day, uf);

    const tamano = row.sizeCategory?.trim() || "Sin clasificar";
    if (!byTamano.has(tamano)) byTamano.set(tamano, new Map());
    add(byTamano.get(tamano)!, day, uf);

    const tipo = row.typeCategory?.trim() || "Sin clasificar";
    if (!byTipo.has(tipo)) byTipo.set(tipo, new Map());
    add(byTipo.get(tipo)!, day, uf);

    const piso = row.floor?.trim() || "Sin clasificar";
    if (!byPiso.has(piso)) byPiso.set(piso, new Map());
    add(byPiso.get(piso)!, day, uf);

    const store = row.storeName?.trim() || "Sin nombre";
    if (!byStore.has(store)) byStore.set(store, new Map());
    add(byStore.get(store)!, day, uf);
  }

  return {
    period,
    daysInMonth: days,
    total: rowFromBucket("Total", total, gla.total, days),
    byTamano: [...byTamano.entries()]
      .map(([k, b]) => rowFromBucket(k, b, gla.byTamano.get(k) ?? 0, days))
      .sort((a, b) => b.totalUf - a.totalUf),
    byTipo: [...byTipo.entries()]
      .map(([k, b]) => rowFromBucket(k, b, gla.byTipo.get(k) ?? 0, days))
      .sort((a, b) => b.totalUf - a.totalUf),
    byPiso: [...byPiso.entries()]
      .map(([k, b]) => rowFromBucket(k, b, gla.byPiso.get(k) ?? 0, days))
      .sort((a, b) => a.label.localeCompare(b.label)),
    byStore: [...byStore.entries()]
      .map(([k, b]) => rowFromBucket(k, b, 0, days))
      .sort((a, b) => b.totalUf - a.totalUf)
  };
}
