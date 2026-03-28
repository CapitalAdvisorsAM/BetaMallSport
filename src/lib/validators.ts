import { PERIODO_REGEX } from "./constants";

export function isPeriodoValido(periodo: string): boolean {
  return PERIODO_REGEX.test(periodo);
}