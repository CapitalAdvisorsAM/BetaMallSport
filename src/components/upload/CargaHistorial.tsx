import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

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

const estadoMeta: Record<string, { label: string; className: string }> = {
  OK: { label: "OK", className: "border-emerald-200 bg-emerald-100 text-emerald-800" },
  ERROR: { label: "ERROR", className: "border-rose-200 bg-rose-100 text-rose-800" },
  PROCESANDO: { label: "PROCESANDO", className: "border-blue-200 bg-blue-100 text-blue-800" },
  PENDIENTE: { label: "PENDIENTE", className: "border-amber-200 bg-amber-100 text-amber-800" }
};

function EstadoBadge({ estado }: { estado: string }): JSX.Element {
  const meta = estadoMeta[estado] ?? {
    label: estado,
    className: "border-slate-200 bg-slate-100 text-slate-700"
  };

  return (
    <Badge variant="outline" className={`rounded-md px-2 py-0.5 ${meta.className}`}>
      {meta.label}
    </Badge>
  );
}

export function CargaHistorial({ items }: CargaHistorialProps): JSX.Element {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="text-sm font-semibold text-slate-900">Ultimas 5 cargas</h4>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Aun no hay cargas registradas para este tipo.</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-md border border-slate-200">
          <Table className="min-w-full text-sm">
            <TableHeader className="bg-slate-50 text-slate-700">
              <TableRow className="hover:bg-transparent">
                <TableHead className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">Fecha</TableHead>
                <TableHead className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">Archivo</TableHead>
                <TableHead className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">Estado</TableHead>
                <TableHead className="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-700">
                  Creados
                </TableHead>
                <TableHead className="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-700">
                  Actualizados
                </TableHead>
                <TableHead className="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-700">
                  Errores
                </TableHead>
                <TableHead className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100">
              {items.map((item) => (
                <TableRow key={item.id} className="hover:bg-slate-50">
                  <TableCell className="whitespace-nowrap px-3 py-2 text-slate-600">
                    {dateFormatter.format(item.createdAt)}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate px-3 py-2 text-slate-700" title={item.archivoNombre}>
                    {item.archivoNombre}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-2">
                    <EstadoBadge estado={item.estado} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-2 text-right">
                    {item.created > 0 ? (
                      <span className="font-semibold text-emerald-700">{item.created}</span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-2 text-right">
                    {item.updated > 0 ? (
                      <span className="font-semibold text-amber-700">{item.updated}</span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-2 text-right">
                    {item.rejected > 0 ? (
                      <span className="font-semibold text-rose-700">{item.rejected}</span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-2">
                    {item.rejected > 0 ? (
                      <a
                        href={`/api/rent-roll/upload/errors?cargaId=${item.id}`}
                        className="text-xs font-medium text-brand-700 underline hover:text-brand-500"
                      >
                        Descargar errores
                      </a>
                    ) : item.estado === "PENDIENTE" ? (
                      <span className="text-xs text-amber-600">Preview sin aplicar</span>
                    ) : (
                      <span className="text-xs text-slate-400">{"\u2014"}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
