import { TitleSkeleton } from "@/components/ui/skeletons";

export default function ConfiguracionLoading(): JSX.Element {
  return (
    <main className="space-y-6">
      <TitleSkeleton />
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded-md bg-slate-100" />
          <div className="h-10 w-32 animate-pulse rounded-md bg-slate-100" />
        </div>
      </section>
    </main>
  );
}
