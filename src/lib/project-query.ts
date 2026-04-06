export type ProjectQueryCompatibleParams = {
  project?: string;
  proyecto?: string;
};

export function resolveProjectIdFromQuery(
  params: ProjectQueryCompatibleParams
): string | undefined {
  const canonical = params.project?.trim();
  if (canonical) {
    return canonical;
  }

  const legacy = params.proyecto?.trim();
  return legacy || undefined;
}

export function appendProjectQuery(
  params: URLSearchParams,
  projectId: string,
  options?: { includeLegacy?: boolean }
): URLSearchParams {
  const includeLegacy = options?.includeLegacy ?? true;
  params.set("project", projectId);
  if (includeLegacy) {
    params.set("proyecto", projectId);
  }
  return params;
}

export function buildProjectQueryString(
  projectId: string,
  options?: { includeLegacy?: boolean }
): string {
  const params = appendProjectQuery(new URLSearchParams(), projectId, options);
  return params.toString();
}

export function appendProjectIdQuery(
  params: URLSearchParams,
  projectId: string,
  options?: { includeLegacy?: boolean }
): URLSearchParams {
  const includeLegacy = options?.includeLegacy ?? true;
  params.set("projectId", projectId);
  if (includeLegacy) {
    params.set("proyectoId", projectId);
  }
  return params;
}

export function buildProjectIdQueryString(
  projectId: string,
  options?: { includeLegacy?: boolean }
): string {
  const params = appendProjectIdQuery(new URLSearchParams(), projectId, options);
  return params.toString();
}
