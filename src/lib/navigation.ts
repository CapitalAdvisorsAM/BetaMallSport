export type NavItem = {
  label: string;
  href: string;
  enabled: boolean;
  match: "exact" | "startsWith";
};

export function isNavItemActive(
  pathname: string,
  href: string,
  match: "exact" | "startsWith"
): boolean {
  return match === "exact" ? pathname === href : pathname.startsWith(href);
}

export type RentRollEntity = "units" | "tenants" | "contracts";
export type RentRollMode = "ver" | "cargar" | "upload" | "config";

export const RENT_ROLL_ENTITY_ITEMS: Array<{ key: RentRollEntity; label: string; href: string }> = [
  { key: "units", label: "Locales", href: "/rent-roll/units" },
  { key: "tenants", label: "Arrendatarios", href: "/rent-roll/tenants" },
  { key: "contracts", label: "Contratos", href: "/rent-roll/contracts" }
];

export const TOP_NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    enabled: true,
    match: "exact"
  },
  {
    label: "Rent Roll",
    href: "/rent-roll",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Finanzas",
    href: "/finanzas",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Reportes",
    href: "/reportes",
    enabled: false,
    match: "startsWith"
  },
  {
    label: "Configuración",
    href: "/configuracion",
    enabled: true,
    match: "startsWith"
  }
];

export const CONFIGURACION_SUB_NAV_ITEMS: NavItem[] = [
  {
    label: "Proyecto",
    href: "/configuracion/proyecto",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Dashboard",
    href: "/configuracion/dashboard",
    enabled: true,
    match: "startsWith"
  }
];

export const FINANZAS_SUB_NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/finanzas/dashboard",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "EE.RR",
    href: "/finanzas/eerr",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Análisis",
    href: "/finanzas/analisis",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Arrendatarios",
    href: "/finanzas/arrendatarios",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Cargar Datos",
    href: "/finanzas/upload",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Mapeos",
    href: "/finanzas/mapeos",
    enabled: true,
    match: "startsWith"
  }
];

export const RENT_ROLL_SUB_NAV_ITEMS: NavItem[] = [
  {
    label: "Proyectos",
    href: "/rent-roll/projects",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Dashboard",
    href: "/rent-roll/dashboard",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Rent Roll",
    href: "/rent-roll",
    enabled: true,
    match: "exact"
  },
  {
    label: "Locales",
    href: "/rent-roll/units",
    enabled: true,
    match: "exact"
  },
  {
    label: "Arrendatarios",
    href: "/rent-roll/tenants",
    enabled: true,
    match: "exact"
  },
  {
    label: "Contratos",
    href: "/rent-roll/contracts",
    enabled: true,
    match: "exact"
  }
];
