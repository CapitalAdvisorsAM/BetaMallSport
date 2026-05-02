/**
 * Builds the GLA category-concentration dataset used by RentRollCategoryConcentration.
 * Extracted to avoid duplication between the Rent Roll snapshot page and the Analytics
 * Dashboard page.
 */
import { mapCategoria } from "@/lib/kpi";
import type { RentRollCategoryConcentrationDatum } from "@/components/plan/RentRollCategoryConcentration";

type ContractForConcentration = {
  // Si está ausente o `true`, el contrato cuenta para la concentración de GLA
  // arrendado (alineado con la semántica de vacancia). Cuando es `false`,
  // el contrato existe pero no aporta GLA al cómputo — igual que en los
  // KPIs de ocupación / vacancia.
  cuentaParaVacancia?: boolean;
  local: { glam2: number | { toString(): string }; zona: string | null };
};

export function buildCategoryConcentration(
  contracts: ContractForConcentration[]
): RentRollCategoryConcentrationDatum[] {
  const grouped = new Map<string, { glam2: number; contratos: number }>();

  for (const contract of contracts) {
    if (contract.cuentaParaVacancia === false) {
      continue;
    }

    const glam2 = Number(contract.local.glam2);
    if (glam2 <= 0) {
      continue;
    }

    const categoria = mapCategoria(contract.local.zona) ?? "Sin categoria";
    const current = grouped.get(categoria) ?? { glam2: 0, contratos: 0 };
    current.glam2 += glam2;
    current.contratos += 1;
    grouped.set(categoria, current);
  }

  const totalGla = Array.from(grouped.values()).reduce((acc, item) => acc + item.glam2, 0);
  if (totalGla <= 0) {
    return [];
  }

  const rows = Array.from(grouped.entries())
    .map(([categoria, value]) => ({
      categoria,
      glam2: value.glam2,
      contratos: value.contratos
    }))
    .sort((a, b) => b.glam2 - a.glam2);

  let pctAcumulado = 0;
  return rows.map((row, index) => {
    const pctBase = (row.glam2 / totalGla) * 100;
    const pct =
      index === rows.length - 1
        ? Number((100 - pctAcumulado).toFixed(2))
        : Number(pctBase.toFixed(2));
    pctAcumulado += pct;
    return { ...row, pct: Math.max(0, pct) };
  });
}
