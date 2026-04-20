import { KpiCardSkeleton, TableSkeleton, TitleSkeleton } from "@/components/ui/skeletons";

export default function FinanceLoading(): JSX.Element {
  return (
    <main className="space-y-6">
      <TitleSkeleton />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </section>

      <TableSkeleton rows={5} cols={5} />
    </main>
  );
}
