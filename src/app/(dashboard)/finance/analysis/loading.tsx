import { ChartCardSkeleton, TableSkeleton, TitleSkeleton } from "@/components/ui/skeletons";

export default function AnalysisLoading(): JSX.Element {
  return (
    <main className="space-y-6">
      <TitleSkeleton />

      <div className="grid gap-4 md:grid-cols-2">
        <ChartCardSkeleton height="h-64" />
        <ChartCardSkeleton height="h-64" />
      </div>

      <TableSkeleton rows={5} cols={5} />
    </main>
  );
}
