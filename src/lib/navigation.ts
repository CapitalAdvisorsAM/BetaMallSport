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

export type RentRollEntity = "locales" | "arrendatarios" | "contratos";
export type RentRollMode = "ver" | "cargar" | "upload" | "config";

export const RENT_ROLL_ENTITY_ITEMS: Array<{ key: RentRollEntity; label: string; href: string }> = [
  { key: "locales", label: "Locales", href: "/rent-roll/locales" },
  { key: "arrendatarios", label: "Arrendatarios", href: "/rent-roll/arrendatarios" },
  { key: "contratos", label: "Contratos", href: "/rent-roll/contratos" }
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
    enabled: false,
    match: "startsWith"
  },
  {
    label: "Reportes",
    href: "/reportes",
    enabled: false,
    match: "startsWith"
  }
];

export const RENT_ROLL_SUB_NAV_ITEMS: NavItem[] = [
  {
    label: "Proyectos",
    href: "/rent-roll/proyectos",
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
    href: "/rent-roll/locales",
    enabled: true,
    match: "exact"
  },
  {
    label: "Arrendatarios",
    href: "/rent-roll/arrendatarios",
    enabled: true,
    match: "exact"
  },
  {
    label: "Contratos",
    href: "/rent-roll/contratos",
    enabled: true,
    match: "exact"
  }
];
