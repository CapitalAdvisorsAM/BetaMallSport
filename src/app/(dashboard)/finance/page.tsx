import { redirect } from "next/navigation";
import { resolveProjectIdFromSearchParams } from "@/lib/project";

export default function FinancePage({
  searchParams
}: {
  searchParams: { project?: string };
}): never {
  const projectId = resolveProjectIdFromSearchParams(searchParams);
  const params = new URLSearchParams();
  if (projectId) {
    params.set("project", projectId);
  }
  const query = params.toString();
  redirect(`/finance/dashboard${query ? `?${query}` : ""}`);
}
