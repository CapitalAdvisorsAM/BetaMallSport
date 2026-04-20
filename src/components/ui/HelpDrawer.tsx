"use client";

import { usePathname } from "next/navigation";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

export type HelpSection =
  | "dashboard"
  | "rent-roll"
  | "locales"
  | "arrendatarios"
  | "contratos"
  | "upload";

type DrawerSection = HelpSection | "proyectos";

type HelpDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  section: HelpSection;
};

type HelpConcept = {
  term: string;
  definition: string;
};

type HelpIssue = {
  question: string;
  solution: string;
};

type HelpContent = {
  title: string;
  icon: string;
  definition: string;
  steps: string[];
  keyConcepts: HelpConcept[];
  commonIssues: HelpIssue[];
  note?: string;
};

const HELP_CONTENT: Record<DrawerSection, HelpContent> = {
  dashboard: {
    title: "Dashboard Ejecutivo",
    icon: "📊",
    definition:
      "Panel ejecutivo para responder si el negocio esta sano hoy y si hay urgencias que gestionar de inmediato.",
    steps: [
      "Selecciona el proyecto en el selector superior.",
      "Lee la barra de alertas (si aparece): muestra los temas urgentes del dia.",
      "Revisa % Ocupacion y Renta en Riesgo para evaluar la salud financiera.",
      "Consulta Proximos vencimientos para priorizar la gestion de contratos.",
      "Usa Ver Rent Roll -> para ir al detalle local por local."
    ],
    keyConcepts: [
      {
        term: "GLA (m2)",
        definition: "Area arrendable efectiva del mall, excluye pasillos y areas comunes."
      },
      {
        term: "% Ocupacion",
        definition: "GLA con contrato vigente dividido por GLA total. Meta recomendada: >= 85%."
      },
      {
        term: "Renta en Riesgo",
        definition: "UF total de contratos que vencen en los proximos 90 dias."
      },
      {
        term: "UF",
        definition:
          "Unidad de Fomento, valor diario ajustado por inflacion; siempre se muestra con su fecha de referencia."
      },
      {
        term: "GGCC",
        definition:
          "Gastos comunes cobrados a arrendatarios por la administracion y operacion de areas comunes."
      },
      {
        term: "⚠️ Valor UF desactualizado",
        definition:
          "El sistema no tiene el valor UF de los ultimos 5 dias; debes actualizarlo en la seccion Datos."
      }
    ],
    commonIssues: [
      {
        question: "No veo datos",
        solution: "Selecciona un proyecto activo en el selector superior."
      },
      {
        question: "La ocupacion parece incorrecta",
        solution: "Verifica que los locales tengan contratos en estado VIGENTE en la seccion Contratos."
      },
      {
        question: "La renta en CLP no aparece",
        solution: "El valor UF no esta cargado. Ve a Datos -> Valor UF e ingresa el valor actual."
      }
    ]
  },
  "rent-roll": {
    title: "Rent Roll",
    icon: "📋",
    definition:
      "Vista operacional de lo que deberia generar cada local segun contratos vigentes, separando ocupados, en gracia y vacantes.",
    steps: [
      "Selecciona el proyecto y el periodo (mes) en los filtros superiores.",
      "Lee los KPIs del header: GLA total, % ocupacion, renta comprometida y GGCC.",
      "Revisa la tabla fila por fila: cada fila representa un local, no un contrato.",
      "Usa los filtros de estado para aislar vacantes o locales en gracia.",
      "Exporta a CSV con el boton Exportar para compartir con gerencia."
    ],
    keyConcepts: [
      {
        term: "VIGENTE",
        definition: "Contrato activo que esta generando renta."
      },
      {
        term: "EN GRACIA",
        definition: "Contrato firmado, ya iniciado, cuyo periodo de gracia aun no termina; ocupa el local pero no factura."
      },
      {
        term: "NO INICIADO",
        definition: "Contrato firmado cuya fecha de inicio es posterior a hoy; aun no entrega el local ni factura."
      },
      {
        term: "VACANTE",
        definition: "Local activo sin contrato; se muestra con fondo gris y metricas en '-'."
      },
      {
        term: "Tarifa UF/m2",
        definition: "Precio base por metro cuadrado por mes."
      },
      {
        term: "Renta Fija",
        definition: "Tarifa por GLA del local; representa el ingreso mensual contractual."
      },
      {
        term: "Dias para vencer",
        definition: "Dias restantes hasta la fecha de termino del contrato actual."
      }
    ],
    commonIssues: [
      {
        question: "Un local no aparece en la tabla",
        solution: "Verifica que el local este ACTIVO y con esGLA=true en la seccion Locales."
      },
      {
        question: "La renta fija aparece en 0 para un local VIGENTE",
        solution: "El contrato existe pero no tiene tarifa configurada. Ve a Contratos y agrega la tarifa."
      },
      {
        question: "El periodo no muestra datos",
        solution: "Solo hay datos cuando existen contratos vigentes o locales activos en ese mes."
      }
    ]
  },
  locales: {
    title: "Locales",
    icon: "🏢",
    definition:
      "Registro maestro de todos los locales fisicos del mall, base para contratos y calculo de ocupacion.",
    steps: [
      "Crea un local con codigo unico (ej: 101A), nombre y GLA en m2.",
      "Marca Aplica para GLA si el local es arrendable y cuenta para % ocupacion.",
      "Asigna el tipo de local (Tienda, Modulo, Bodega, Espacio, etc.).",
      "El local queda en estado ACTIVO y puede recibir contratos.",
      "Para darlo de baja, cambia estado a INACTIVO; no se elimina si tiene contratos."
    ],
    keyConcepts: [
      {
        term: "GLA (m2)",
        definition: "Metros cuadrados arrendables de ese local especifico."
      },
      {
        term: "Aplica para GLA",
        definition:
          "Si esta marcado, el local entra al % de ocupacion; no marcar pasillos ni salas tecnicas."
      },
      {
        term: "Tipo de local",
        definition: "Define como se agrupa el local en reportes de ocupacion por categoria."
      },
      {
        term: "Codigo de local",
        definition: "Debe ser unico dentro del proyecto y se usa en cargas masivas."
      }
    ],
    commonIssues: [
      {
        question: "No puedo eliminar un local",
        solution: "Tiene contratos asociados. Primero termina o elimina esos contratos."
      },
      {
        question: "El local no aparece en el Rent Roll",
        solution: "Verifica que este ACTIVO y con Aplica para GLA marcado."
      },
      {
        question: "Subi locales por CSV pero no aparecen",
        solution: "Ve a Carga Masiva y revisa los errores de la ultima carga."
      }
    ]
  },
  arrendatarios: {
    title: "Arrendatarios",
    icon: "👥",
    definition: "Registro de empresas o personas que tienen o han tenido contratos en el mall.",
    steps: [
      "Crea el arrendatario con RUT, razon social y nombre comercial.",
      "Ingresa el RUT sin puntos y con guion (ej: 12345678-9).",
      "Una vez creado, puede ser asignado en la seccion Contratos.",
      "Si deja de operar, cambialo a INACTIVO para bloquear nuevos contratos."
    ],
    keyConcepts: [
      {
        term: "RUT",
        definition: "Identificador unico del arrendatario dentro del proyecto; no se repite."
      },
      {
        term: "Razon Social",
        definition: "Nombre legal de la empresa."
      },
      {
        term: "Nombre Comercial",
        definition: "Nombre visible en tienda; puede ser distinto de la razon social."
      },
      {
        term: "Estado VIGENTE",
        definition: "Solo arrendatarios vigentes pueden recibir contratos nuevos."
      }
    ],
    commonIssues: [
      {
        question: "El RUT ya existe",
        solution: "El arrendatario ya esta registrado. Buscalo en la tabla y editalo si corresponde."
      },
      {
        question: "No puedo asignar el arrendatario a un contrato",
        solution: "Verifica que este en estado VIGENTE."
      },
      {
        question: "Quiero cambiar el RUT",
        solution: "El RUT es la clave unica y no es editable; crea un nuevo arrendatario."
      }
    ]
  },
  contratos: {
    title: "Contratos",
    icon: "📄",
    definition:
      "Gestion de contratos de arriendo que vinculan local y arrendatario con condiciones economicas claras.",
    steps: [
      "Crea un contrato seleccionando local y arrendatario (ambos deben existir).",
      "Define fechas de inicio y termino, mas estado inicial VIGENTE o GRACIA.",
      "Agrega al menos una tarifa fija o una renta variable (%).",
      "Opcionalmente informa el % de fondo de promocion del contrato.",
      "Opcionalmente configura GGCC con tarifa base y % de administracion.",
      "Adjunta el PDF del contrato firmado con el boton de carga."
    ],
    keyConcepts: [
      {
        term: "FIJO_UF_M2",
        definition: "Renta mensual = tarifa por GLA del local; aumenta con el metraje."
      },
      {
        term: "FIJO_UF",
        definition: "Renta mensual fija, independiente del tamano del local."
      },
      {
        term: "PORCENTAJE",
        definition: "Renta variable calculada como porcentaje de ventas brutas. Usa las fechas del contrato."
      },
      {
        term: "% Fondo Promocion",
        definition: "Porcentaje adicional asociado al contrato para el fondo de promocion."
      },
      {
        term: "Fecha de Vigencia Tarifa",
        definition: "Fecha desde la cual aplica la tarifa, util para reajustes en el tiempo."
      },
      {
        term: "GGCC Tarifa Base (UF/m2)",
        definition: "Costo base de gasto comun por metro cuadrado."
      },
      {
        term: "% Administracion GGCC",
        definition: "Recargo por gestion, tipicamente 5%."
      },
      {
        term: "GRACIA",
        definition: "Contrato firmado que aun no paga renta por periodo de instalacion o mejoras."
      },
      {
        term: "NO INICIADO",
        definition: "Contrato firmado cuya fecha de inicio es posterior a hoy; aun no ocupa el local ni factura."
      }
    ],
    commonIssues: [
      {
        question: "No puedo crear el contrato",
        solution: "Verifica que local y arrendatario existan y esten ACTIVOS/VIGENTES."
      },
      {
        question: "La renta fija en el Rent Roll aparece en 0",
        solution: "El contrato no tiene tarifa configurada. Agrega una tarifa en el formulario."
      },
      {
        question: "Hay dos tarifas para el mismo periodo",
        solution: "Solo puede existir una tarifa por tipo y periodo; edita la existente."
      }
    ]
  },
  upload: {
    title: "Carga Masiva",
    icon: "📤",
    definition:
      "Carga masiva de Locales, Arrendatarios y Contratos desde CSV o Excel para acelerar la actualizacion operativa.",
    steps: [
      "Descarga la plantilla del tipo de carga que necesitas.",
      "Completa la plantilla y guarda el archivo como .csv o .xlsx.",
      "Arrastra el archivo o seleccionalo en la zona de carga.",
      "Haz clic en Previsualizar para ver cada fila como 🟢 NUEVO, 🟡 ACTUALIZADO, ⚪ SIN CAMBIO o 🔴 ERROR.",
      "Corrige errores y previsualiza de nuevo; cuando el resultado sea aceptable, aplica la carga."
    ],
    note: "Orden recomendado de carga inicial: 1) Locales, 2) Arrendatarios, 3) Contratos.",
    keyConcepts: [
      {
        term: "🟢 NUEVO",
        definition: "Registro que no existe en el sistema y sera creado."
      },
      {
        term: "🟡 ACTUALIZADO",
        definition: "Registro existente con cambios; se actualizara."
      },
      {
        term: "⚪ SIN CAMBIO",
        definition: "Registro existente sin diferencias; no se modifica."
      },
      {
        term: "🔴 ERROR",
        definition: "Fila con datos invalidos; esa fila no se aplica."
      },
      {
        term: "Limites",
        definition: "Maximo 5 MB por archivo y hasta 2.000 filas por carga."
      },
      {
        term: "Formato de fechas",
        definition: "Se aceptan YYYY-MM-DD y DD/MM/YYYY."
      }
    ],
    commonIssues: [
      {
        question: "Error: columnas no reconocidas",
        solution: "Las columnas no coinciden con la plantilla oficial. Descargala de nuevo sin renombrar encabezados."
      },
      {
        question: "Local X no existe al cargar contratos",
        solution: "Primero sube Locales y despues Contratos, porque los contratos los referencian."
      },
      {
        question: "RUT ya existe",
        solution: "El arrendatario ya esta creado; la carga lo actualiza (🟡) y no lo duplica."
      },
      {
        question: "El archivo supera 5 MB",
        solution: "Divide el archivo en partes de maximo 2.000 filas."
      }
    ]
  },
  proyectos: {
    title: "Proyectos",
    icon: "🏢",
    definition:
      "Gestion de los malls del sistema. Cada proyecto funciona de forma independiente con sus propios datos.",
    steps: [
      "Crea un proyecto con nombre y descripcion.",
      "El proyecto queda ACTIVO y aparece en el selector de las vistas.",
      "Desde esta pantalla revisa todos los proyectos y su estado.",
      "Desactiva un proyecto para ocultarlo del selector sin perder su informacion."
    ],
    keyConcepts: [
      {
        term: "Proyecto activo",
        definition: "Aparece en el selector y sus datos entran en reportes."
      },
      {
        term: "Proyecto inactivo",
        definition: "Se oculta del selector, pero conserva su historial y registros."
      },
      {
        term: "Slug",
        definition: "Identificador URL generado automaticamente desde el nombre del proyecto."
      }
    ],
    commonIssues: [
      {
        question: "No puedo eliminar un proyecto",
        solution: "Si tiene locales o contratos asociados no se puede eliminar."
      },
      {
        question: "El proyecto no aparece en el selector",
        solution: "Verifica que su estado sea ACTIVO."
      },
      {
        question: "Quiero renombrar un proyecto",
        solution: "Edita el nombre desde el icono de edicion en la tabla de proyectos."
      }
    ]
  }
};

function resolveDrawerSection(pathname: string, fallback: HelpSection): DrawerSection {
  switch (pathname) {
    case "/rent-roll/projects":
      return "proyectos";
    default:
      if (pathname.startsWith("/rent-roll/projects/")) {
        return "proyectos";
      }
      return fallback;
  }
}

export function HelpDrawer({ isOpen, onClose, section }: HelpDrawerProps): JSX.Element {
  const pathname = usePathname();
  const activeSection = resolveDrawerSection(pathname, section);
  const content = HELP_CONTENT[activeSection];

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <SheetContent side="right" className="w-80 p-0 rounded-l-md" showCloseButton={false}>
        <header className="relative border-b border-brand-900/10 bg-brand-700 px-5 pb-4 pt-5 text-white">
          <div className="absolute inset-y-0 left-0 w-1 bg-gold-400" />
          <SheetClose asChild>
            <button
              type="button"
              aria-label="Cerrar panel de ayuda"
              className="absolute right-3 top-3 rounded-md p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              X
            </button>
          </SheetClose>
          <SheetTitle className="pr-10 text-sm font-semibold text-white">{content.title}</SheetTitle>
          <SheetDescription className="sr-only">{content.definition}</SheetDescription>
        </header>

        <div className="flex-1 overflow-y-auto bg-white p-5 text-sm text-slate-700">
          <section>
            <h3 className="text-sm font-semibold text-brand-700">
              {content.icon} {content.title}
            </h3>
            <p className="mt-2 leading-relaxed">{content.definition}</p>
          </section>

          <section className="mt-5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-700">Como se usa</h4>
            <ol className="mt-2 list-decimal space-y-2 pl-5">
              {content.steps.map((item, index) => (
                <li key={`${index}-${item}`}>{item}</li>
              ))}
            </ol>
            {content.note ? <p className="mt-3 text-xs text-slate-600">{content.note}</p> : null}
          </section>

          <section className="mt-5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-700">Conceptos clave</h4>
            <ul className="mt-2 space-y-2">
              {content.keyConcepts.map((item) => (
                <li key={item.term}>
                  <span className="font-semibold">{item.term}:</span> {item.definition}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-700">
              Problemas frecuentes
            </h4>
            <ul className="mt-2 space-y-2">
              {content.commonIssues.map((item) => (
                <li key={item.question}>
                  <span className="font-semibold">&quot;{item.question}&quot;</span> {"->"} {item.solution}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
