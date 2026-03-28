type CargaHistorialItem = {
  id: string;
  createdAt: Date;
  archivoNombre: string;
  estado: string;
  created: number;
  updated: number;
  rejected: number;
};

type CargaHistorialProps = {
  items: CargaHistorialItem[];
};

const dateFormatter = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short"
});

export function CargaHistorial({ items }: CargaHistorialProps): JSX.Element {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="text-sm font-semibold text-slate-900">Ultimas 5 cargas</h4>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">Aun no hay cargas registradas para este tipo.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-700">Fecha</th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-700">Archivo</th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-700">Estado</th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-700">Creados</th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-700">
                  Actualizados
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-700">Errores</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                    {dateFormatter.format(item.createdAt)}
                  </td>
                  <td className="max-w-[280px] truncate px-3 py-2 text-slate-700">{item.archivoNombre}</td>
                  <td className="px-3 py-2 text-slate-700">{item.estado}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">{item.created}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">{item.updated}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-rose-700">{item.rejected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
