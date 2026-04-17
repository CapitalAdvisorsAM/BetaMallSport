import { TitleSkeleton } from "@/components/ui/skeletons";

export default function FinanceUploadLoading(): JSX.Element {
  return (
    <main className="space-y-6">
      <TitleSkeleton />
      <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="h-32 animate-pulse rounded-md bg-slate-100" />
        <div className="mt-4 h-10 w-32 animate-pulse rounded-md bg-slate-100" />
      </div>
    </main>
  );
}
