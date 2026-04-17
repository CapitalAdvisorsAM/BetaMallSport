import { TableSkeleton, TitleSkeleton } from "@/components/ui/skeletons";

export default function FinanceTenantsLoading(): JSX.Element {
  return (
    <main className="space-y-6">
      <TitleSkeleton />
      <TableSkeleton rows={6} cols={5} />
    </main>
  );
}
