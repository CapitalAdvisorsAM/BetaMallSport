"use client";

export type HelpSection =
  | "dashboard"
  | "rent-roll"
  | "locales"
  | "arrendatarios"
  | "contratos"
  | "upload";

type HelpDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  section: HelpSection;
};

type HelpContent = {
  title: string;
  description?: string;
  metrics?: string[];
  usage?: string[];
};

const HELP_CONTENT: Record<HelpSection, HelpContent> = {
  dashboard: {
    title: "Dashboard de Control de Gestión",
    description: "Muestra los KPIs globales del proyecto seleccionado.",
    metrics: [
      "Tasa de ocupación: locales con contrato VIGENTE / total locales activos.",
      "GLA arrendada: m² arrendados vs total GLA.",
      "Renta fija mensual: suma de tarifa UF/m² x GLA de contratos vigentes.",
      "GGCC estimado: tarifa base GGCC x GLA x (1 + % administración).",
      "Contratos por vencer: contratos que terminan en los próximos 30/60/90 días."
    ]
  },
  "rent-roll": {
    title: "Tabla de Rent Roll",
    description: "Lista todos los contratos del proyecto con su estado actual.",
    usage: [
      "Filtra por estado del contrato (Vigente, Gracia, Terminado).",
      "Busca por código de local, número de contrato o nombre del arrendatario.",
      "Haz clic en \"Dashboard\" en el sub-menú para ver métricas por tienda."
    ]
  },
  locales: {
    title: "Gestión de Locales",
    usage: [
      "Registra cada local del mall con su código único, GLA m², piso y tipo.",
      "Marca \"Es GLA\" solo si el local entra en el cálculo de ocupación.",
      "Los locales con contratos vigentes no se pueden eliminar."
    ]
  },
  arrendatarios: {
    title: "Gestión de Arrendatarios",
    usage: [
      "Registra empresas arrendatarias con RUT único por proyecto.",
      "Un arrendatario \"no vigente\" puede seguir teniendo contratos activos.",
      "La tabla muestra la tarifa y GGCC del contrato vigente actual."
    ]
  },
  contratos: {
    title: "Gestión de Contratos",
    usage: [
      "Asocia un local + un arrendatario con fechas de inicio y término.",
      "Agrega tarifas UF/m²/mes con sus períodos de vigencia.",
      "Agrega gastos comunes (GGCC) con tarifa base y % administración.",
      "Sube el PDF del contrato firmado desde la lista lateral."
    ]
  },
  upload: {
    title: "Carga Masiva de Rent Roll",
    usage: [
      "Sube un archivo CSV o XLSX con los contratos.",
      "Primero \"Previsualizar\" para revisar errores sin guardar datos.",
      "Descarga el detalle de errores si hay filas rechazadas.",
      "Solo después de revisar, presiona \"Aplicar\" para guardar."
    ]
  }
};

export function HelpDrawer({ isOpen, onClose, section }: HelpDrawerProps): JSX.Element {
  const content = HELP_CONTENT[section];

  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
      <button
        type="button"
        aria-label="Cerrar ayuda"
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/35 transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Ayuda"
        className={`absolute right-0 top-0 flex h-full w-80 max-w-full transform flex-col rounded-l-md bg-white shadow-2xl transition-transform duration-200 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="relative border-b border-brand-900/10 bg-brand-700 px-5 pb-4 pt-5 text-white">
          <div className="absolute inset-y-0 left-0 w-1 bg-gold-400" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel de ayuda"
            className="absolute right-3 top-3 rounded-md p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            X
          </button>
          <p className="pr-10 text-sm font-semibold">{content.title}</p>
        </header>

        <div className="flex-1 overflow-y-auto bg-white p-5 text-sm text-slate-700">
          {content.description ? <p>{content.description}</p> : null}

          {content.metrics?.length ? (
            <section className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                Métricas explicadas
              </h3>
              <ul className="mt-2 space-y-2">
                {content.metrics.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {content.usage?.length ? (
            <section className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-700">Cómo usarlo</h3>
              <ul className="mt-2 space-y-2">
                {content.usage.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
