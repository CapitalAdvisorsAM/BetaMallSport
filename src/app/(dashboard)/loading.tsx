export default function DashboardLoading(): JSX.Element {
  return (
    <main className="space-y-6">
      <section className="rounded-md bg-white p-5 shadow-sm">
        <div className="h-8 w-48 animate-pulse rounded-md bg-slate-100" />
      </section>

      <section className="rounded-md bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      </section>

      <section className="rounded-md bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      </section>

      <section className="rounded-md bg-white p-4 shadow-sm">
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      </section>
    </main>
  );
}
