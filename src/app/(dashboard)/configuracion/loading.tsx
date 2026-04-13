export default function ConfiguracionLoading(): JSX.Element {
  return (
    <main className="space-y-6">
      <section className="rounded-md bg-white p-5 shadow-sm">
        <div className="h-8 w-48 animate-pulse rounded-md bg-slate-100" />
      </section>

      <section className="rounded-md bg-white p-4 shadow-sm">
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded-md bg-slate-100" />
          <div className="h-10 w-32 animate-pulse rounded-md bg-slate-100" />
        </div>
      </section>
    </main>
  );
}
