export type ProjectQueryParams = {
  project?: string;
};

export function resolveProjectIdFromQuery(
  params: ProjectQueryParams
): string | undefined {
  const value = params.project?.trim();
  return value || undefined;
}

export function appendProjectQuery(
  params: URLSearchParams,
  projectId: string
): URLSearchParams {
  params.set("project", projectId);
  return params;
}

export function buildProjectQueryString(projectId: string): string {
  const params = appendProjectQuery(new URLSearchParams(), projectId);
  return params.toString();
}

export function appendProjectIdQuery(
  params: URLSearchParams,
  projectId: string
): URLSearchParams {
  params.set("projectId", projectId);
  return params;
}

export function buildProjectIdQueryString(projectId: string): string {
  const params = appendProjectIdQuery(new URLSearchParams(), projectId);
  return params.toString();
}
