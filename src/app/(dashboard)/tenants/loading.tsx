import { KpiCardSkeleton, TableSkeleton, TitleSkeleton } from "@/components/ui/skeletons";

export default function Tenant360Loading(): JSX.Element {
  return (
    <main className="space-y-6">
      <TitleSkeleton />

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCardSkeleton accent="green" />
        <KpiCardSkeleton accent="yellow" />
        <KpiCardSkeleton accent="slate" />
      </div>

      <TableSkeleton rows={5} cols={4} />
    </main>
  );
}
