export default function RentRollLoading(): JSX.Element {
  return (
    <main className="space-y-4">
      <section className="rounded-md bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`kpi-skeleton-${index}`}
              className="h-28 rounded-md bg-slate-100 animate-pulse"
            />
          ))}
        </div>
      </section>

      <section className="rounded-md bg-white p-4 shadow-sm">
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, rowIndex) => (
            <div key={`row-skeleton-${rowIndex}`} className="grid grid-cols-10 gap-2">
              {Array.from({ length: 10 }).map((__, colIndex) => (
                <div
                  key={`cell-skeleton-${rowIndex}-${colIndex}`}
                  className="h-8 rounded-md bg-slate-100 animate-pulse"
                />
              ))}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
