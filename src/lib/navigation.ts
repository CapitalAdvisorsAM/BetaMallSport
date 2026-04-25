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
  { key: "units", label: "Locales", href: "/plan/units" },
  { key: "tenants", label: "Arrendatarios", href: "/plan/tenants" },
  { key: "contracts", label: "Contratos", href: "/plan/contracts" }
];

export const TOP_NAV_ITEMS: NavItem[] = [
  {
    label: "Expectativa",
    href: "/plan",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Realidad",
    href: "/real",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Reconciliación",
    href: "/reconciliation",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Cargar Datos",
    href: "/imports",
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
    href: "/settings",
    enabled: true,
    match: "startsWith"
  }
];

export const SETTINGS_SUB_NAV_ITEMS: NavItem[] = [
  {
    label: "Proyecto actual",
    href: "/settings/project",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Portafolio",
    href: "/settings/projects",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Mapeos",
    href: "/settings/finance-mappings",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Widgets",
    href: "/settings/dashboard",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Sistema",
    href: "/settings/system",
    enabled: true,
    match: "startsWith"
  }
];

export const PLAN_SUB_NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/plan/dashboard",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Rent Roll",
    href: "/plan/rent-roll",
    enabled: true,
    match: "exact"
  },
  {
    label: "Locales",
    href: "/plan/units",
    enabled: true,
    match: "exact"
  },
  {
    label: "Arrendatarios",
    href: "/plan/tenants",
    enabled: true,
    match: "exact"
  },
  {
    label: "Contratos",
    href: "/plan/contracts",
    enabled: true,
    match: "exact"
  },
  {
    label: "Ocupación",
    href: "/plan/occupancy",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Ventas Presupuestadas",
    href: "/plan/budgeted-sales",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Presupuesto",
    href: "/plan/budget",
    enabled: true,
    match: "startsWith"
  }
];

export const REAL_SUB_NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/real/dashboard",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "EE.RR",
    href: "/real/accounting",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "EE.FF",
    href: "/real/cash-flow-statement",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Flujo Caja",
    href: "/real/cash-flow",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Facturación SAP",
    href: "/real/billing",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Ventas Reales",
    href: "/real/sales",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "GG.CC.",
    href: "/real/common-charges",
    enabled: true,
    match: "startsWith"
  }
];

export const RECON_SUB_NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/reconciliation/dashboard",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Ppto vs Real",
    href: "/reconciliation/budget-vs-actual",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Facturación Esp. vs Emit.",
    href: "/reconciliation/billing-gap",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Ventas Ppto vs Real",
    href: "/reconciliation/sales-gap",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Cobranza",
    href: "/reconciliation/collection",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Waterfall",
    href: "/reconciliation/waterfall",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Costo Ocupación",
    href: "/reconciliation/occupancy-cost",
    enabled: true,
    match: "startsWith"
  },
  {
    label: "Análisis",
    href: "/reconciliation/analysis",
    enabled: true,
    match: "startsWith"
  }
];

