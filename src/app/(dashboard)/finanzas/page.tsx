import { redirect } from "next/navigation";

export default function FinanzasPage({
  searchParams
}: {
  searchParams: { proyecto?: string };
}): never {
  const params = searchParams.proyecto ? `?proyecto=${searchParams.proyecto}` : "";
  redirect(`/finanzas/eerr${params}`);
}
