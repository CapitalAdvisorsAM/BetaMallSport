import { redirect } from "next/navigation";
import { WaterfallClient } from "@/components/finance/WaterfallClient";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";

export default async function WaterfallPage(): Promise<JSX.Element> {
  await requireSession();
  const { selectedProjectId } = await getProjectContext();

  if (!selectedProjectId) {
    redirect("/");
  }

  return (
    <WaterfallClient
      selectedProjectId={selectedProjectId}
    />
  );
}
