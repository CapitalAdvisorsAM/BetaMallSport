export type CalculatedLocalSize =
  | "TIENDA_MENOR"
  | "TIENDA_MEDIANA"
  | "TIENDA_MAYOR"
  | "BODEGA"
  | "MODULO"
  | "ESPACIO";

export type CommercialSizeRule = {
  key: Extract<CalculatedLocalSize, "TIENDA_MENOR" | "TIENDA_MEDIANA" | "TIENDA_MAYOR">;
  label: string;
  min: number;
  max: number | null;
};

export const DEFAULT_COMMERCIAL_SIZE_RULES: CommercialSizeRule[] = [
  { key: "TIENDA_MENOR", label: "Tienda menor", min: 0, max: 49.99 },
  { key: "TIENDA_MEDIANA", label: "Tienda mediana", min: 50, max: 119.99 },
  { key: "TIENDA_MAYOR", label: "Tienda mayor", min: 120, max: null }
];

export function parseSquareMeters(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getCalculatedLocalSize(
  tipo: string,
  glam2: string,
  rules: CommercialSizeRule[] = DEFAULT_COMMERCIAL_SIZE_RULES
): CalculatedLocalSize | null {
  if (tipo === "BODEGA" || tipo === "MODULO" || tipo === "ESPACIO") {
    return tipo;
  }

  const squareMeters = parseSquareMeters(glam2);
  if (squareMeters === null) {
    return null;
  }

  const matchingRule = rules.find(
    (rule) => squareMeters >= rule.min && (rule.max === null || squareMeters <= rule.max)
  );

  return matchingRule?.key ?? null;
}

export function formatCalculatedLocalSize(value: CalculatedLocalSize | null): string {
  switch (value) {
    case "TIENDA_MENOR":
      return "Tienda menor";
    case "TIENDA_MEDIANA":
      return "Tienda mediana";
    case "TIENDA_MAYOR":
      return "Tienda mayor";
    case "BODEGA":
      return "Bodega";
    case "MODULO":
      return "Modulo";
    case "ESPACIO":
      return "Espacio";
    default:
      return "Sin clasificar";
  }
}
