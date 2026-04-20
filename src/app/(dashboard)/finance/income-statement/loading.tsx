import { TableSkeleton, TitleSkeleton } from "@/components/ui/skeletons";

export default function EerrLoading(): JSX.Element {
  return (
    <main className="space-y-6">
      <TitleSkeleton />
      <TableSkeleton rows={8} cols={5} />
    </main>
  );
}
