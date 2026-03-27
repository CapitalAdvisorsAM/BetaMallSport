export type NavItem = {
  label: string;
  href: string;
  enabled: boolean;
  match: "exact" | "startsWith";
};

export const TOP_NAV_ITEMS: NavItem[] = [
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
    label: "Contratos",
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
    label: "Cargas",
    href: "/rent-roll/upload",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Contratos CRUD",
    href: "/rent-roll/contratos",
    enabled: true,
    match: "startsWith"
  }
];
