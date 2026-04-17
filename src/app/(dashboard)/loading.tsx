import { KpiCardSkeleton, ChartCardSkeleton, TableSkeleton, TitleSkeleton } from "@/components/ui/skeletons";

export default function DashboardLoading(): JSX.Element {
  return (
    <main className="space-y-6">
      <TitleSkeleton />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCardSkeleton accent="green" />
        <KpiCardSkeleton accent="yellow" />
        <KpiCardSkeleton accent="red" />
        <KpiCardSkeleton accent="slate" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>

      <TableSkeleton rows={5} cols={5} />
    </main>
  );
}
