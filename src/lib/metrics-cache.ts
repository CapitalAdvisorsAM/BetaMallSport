type CacheEntry<T> = {
  data: T;
  expiresAt: number;
  projectId: string;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();

export async function getOrSetMetricsCache<T>(
  key: string,
  projectId: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const cached = cacheStore.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.data as T;
  }

  const data = await loader();
  cacheStore.set(key, {
    data,
    expiresAt: now + ttlMs,
    projectId
  });
  return data;
}

export function invalidateMetricsCacheByProject(projectId: string): void {
  for (const [key, value] of cacheStore.entries()) {
    if (value.projectId === projectId) {
      cacheStore.delete(key);
    }
  }
}

export function buildMetricsCacheKey(namespace: string, parts: Array<string | undefined>): string {
  const suffix = parts.map((part) => part ?? "").join("|");
  return `${namespace}:${suffix}`;
}
