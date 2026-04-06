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
    href: "/finance",
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
    label: "ConfiguraciÃ³n",
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
    href: "/finance/dashboard",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "EE.RR",
    href: "/finance/eerr",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "AnÃ¡lisis",
    href: "/finance/analysis",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Arrendatarios",
    href: "/finance/tenants",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Cargar Datos",
    href: "/finance/upload",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Mapeos",
    href: "/finance/mappings",
    enabled: true,
    match: "startsWith"
  }
];

export const FINANCE_SUB_NAV_ITEMS: NavItem[] = FINANZAS_SUB_NAV_ITEMS;

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


