export default function DashboardPage(): JSX.Element {
  return (
    <main className="grid gap-4 md:grid-cols-2">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Rent Roll</h2>
        <p className="mt-2 text-sm text-slate-600">
          Revisa contratos vigentes y carga archivos CSV/XLSX con preview y aplicacion por lote.
        </p>
      </section>
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Contratos</h2>
        <p className="mt-2 text-sm text-slate-600">
          Crea y actualiza contratos con tarifas, GGCC y anexos desde una sola vista operativa.
        </p>
      </section>
    </main>
  );
}
