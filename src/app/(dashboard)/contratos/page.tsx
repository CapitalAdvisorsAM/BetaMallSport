import { redirect } from "next/navigation";

type LegacyContratosPageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default function LegacyContratosPage({
  searchParams
}: LegacyContratosPageProps): never {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
      continue;
    }
    if (typeof value === "string" && value.length > 0) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  redirect(query ? `/rent-roll/contratos?${query}` : "/rent-roll/contratos");
}
