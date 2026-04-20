export type UnitTypeKey =
  | "LOCAL_COMERCIAL"
  | "SIMULADOR"
  | "MODULO"
  | "ESPACIO"
  | "BODEGA"
  | "OLA"
  | "MAQUINA_EXPENDEDORA"
  | "OTRO";

type BadgeConfig = {
  label: string;
  className: string;
};

const BADGE_CONFIG: Record<UnitTypeKey, BadgeConfig> = {
  LOCAL_COMERCIAL: {
    label: "LOCAL",
    className: "border-brand-300 bg-brand-50 text-brand-700",
  },
  SIMULADOR: {
    label: "SIM",
    className: "border-secondary-300 bg-brand-50 text-secondary-700",
  },
  MODULO: {
    label: "MÓD",
    className: "border-gold-300 bg-amber-50 text-gold-500",
  },
  ESPACIO: {
    label: "ESP",
    className: "border-surface-200 bg-surface-50 text-slate-600",
  },
  BODEGA: {
    label: "BOD",
    className: "border-slate-300 bg-surface-100 text-slate-700",
  },
  OLA: {
    label: "OLA",
    className: "border-positive-600/40 bg-positive-100 text-positive-700",
  },
  MAQUINA_EXPENDEDORA: {
    label: "VEND",
    className: "border-warning-600/40 bg-warning-100 text-warning-700",
  },
  OTRO: {
    label: "OTRO",
    className: "border-surface-200 bg-white text-slate-500",
  },
};

export function unitTypeBadge(type: string): BadgeConfig {
  return BADGE_CONFIG[type as UnitTypeKey] ?? BADGE_CONFIG.OTRO;
}
