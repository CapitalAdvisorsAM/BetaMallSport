function getFirst(searchParams: URLSearchParams, keys: string[]): string | null {
  for (const key of keys) {
    const value = searchParams.get(key)?.trim() ?? "";
    if (value.length > 0) {
      return value;
    }
  }
  return null;
}

export function getFinanceProjectId(searchParams: URLSearchParams): string | null {
  return getFirst(searchParams, ["projectId", "project"]);
}

export function getFinanceFrom(searchParams: URLSearchParams): string | null {
  return getFirst(searchParams, ["from", "desde"]);
}

export function getFinanceTo(searchParams: URLSearchParams): string | null {
  return getFirst(searchParams, ["to", "hasta"]);
}

export function getFinanceTenantId(searchParams: URLSearchParams): string | null {
  return getFirst(searchParams, ["tenantId", "arrendatarioId"]);
}

export function getFinancePeriod(searchParams: URLSearchParams): string | null {
  return getFirst(searchParams, ["period", "periodo"]);
}

export function getFinanceMode(searchParams: URLSearchParams): string | null {
  return getFirst(searchParams, ["mode", "modo"]);
}

export function getFinanceTab(searchParams: URLSearchParams): string | null {
  return getFirst(searchParams, ["tab"]);
}

export function getFormFieldValue(formData: FormData, keys: string[]): string | null {
  for (const key of keys) {
    const value = formData.get(key);
    if (typeof value === "string") {
      const normalized = value.trim();
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }
  return null;
}
