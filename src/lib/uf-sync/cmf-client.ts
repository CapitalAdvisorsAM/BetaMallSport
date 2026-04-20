import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-error";
import { logError, logDuration, logInfo } from "@/lib/observability";

// Documentación: https://api.cmfchile.cl/documentacion/UF.html
// Endpoint: /api-sbifv3/recursos_api/uf/{YYYY}/{MM}/dias/{DD}?apikey={KEY}&formato=json
const CMF_BASE = "https://api.cmfchile.cl/api-sbifv3/recursos_api/uf";
const TIMEOUT_MS = 10_000;

// Formato de respuesta JSON de la CMF:
// { "UFs": [{ "Valor": "38.153,56", "Fecha": "2026-03-03" }] }
// El valor usa formato chileno: punto como separador de miles, coma como decimal.
type CmfResponse = {
  UFs?: Array<{ Valor: string; Fecha: string }>;
};

/**
 * Convierte formato número chileno "38.153,56" → Prisma.Decimal("38153.56")
 */
function parseCmfValor(valor: string): Prisma.Decimal {
  const normalized = valor.replace(/\./g, "").replace(",", ".");
  return new Prisma.Decimal(normalized);
}

/**
 * Obtiene el valor UF para una fecha específica desde la API oficial de CMF Chile.
 *
 * Retorna null si CMF no tiene valor publicado para esa fecha (array vacío o 404).
 * Lanza un Error en cualquier otro fallo HTTP o de red.
 *
 * Requiere la variable de entorno CMF_API_KEY.
 */
export async function fetchUfValue(
  date: Date
): Promise<{ fecha: Date; valor: Prisma.Decimal } | null> {
  const apiKey = process.env.CMF_API_KEY;
  if (!apiKey) {
    throw new ApiError(500, "CMF_API_KEY no está configurada en el servidor.");
  }

  const iso = date.toISOString().slice(0, 10); // YYYY-MM-DD
  const [year, month, day] = iso.split("-");
  const url = `${CMF_BASE}/${year}/${month}/dias/${day}?apikey=${apiKey}&formato=json`;
  const startedAt = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.status === 404) {
      logInfo("uf_not_found", { fecha: iso });
      return null;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `CMF respondió con status ${response.status} para fecha ${iso}. Body: ${body.slice(0, 200)}`
      );
    }

    const data = (await response.json()) as CmfResponse;
    const entry = data.UFs?.[0];

    if (!entry?.Valor) {
      logInfo("uf_not_found", { fecha: iso });
      return null;
    }

    const valor = parseCmfValor(entry.Valor);
    logDuration("uf_fetch", startedAt, { fecha: iso, valor: entry.Valor });

    return { fecha: new Date(iso), valor };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`CMF no respondió en ${TIMEOUT_MS}ms para fecha ${iso}.`);
    }
    logError("uf_fetch_failed", {
      fecha: iso,
      error: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
}
