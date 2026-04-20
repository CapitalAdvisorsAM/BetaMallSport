import { KpiCardSkeleton, TableSkeleton, TitleSkeleton } from "@/components/ui/skeletons";

export default function RentRollLoading(): JSX.Element {
  return (
    <main className="space-y-4">
      <TitleSkeleton />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </section>

      <TableSkeleton rows={8} cols={6} />
    </main>
  );
}
