import { redirect } from "next/navigation";

export default function ConfiguracionPage({
  searchParams
}: {
  searchParams: { proyecto?: string };
}): never {
  const query = searchParams.proyecto ? `?proyecto=${searchParams.proyecto}` : "";
  redirect(`/configuracion/proyecto${query}`);
}
