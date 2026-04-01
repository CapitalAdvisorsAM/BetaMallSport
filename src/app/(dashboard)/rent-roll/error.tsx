"use client";

import { Button } from "@/components/ui/button";

type RentRollErrorProps = {
  error: Error;
  reset: () => void;
};

export default function RentRollError({ error, reset }: RentRollErrorProps): JSX.Element {
  return (
    <main className="space-y-4">
      <section className="rounded-md border border-rose-200 bg-rose-50 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-rose-800">
          No se pudieron cargar los datos del Rent Roll.
        </h2>
        <p className="mt-2 text-sm text-rose-700">
          Intenta nuevamente. Si el problema persiste, revisa la conexion de la base de datos.
        </p>
        <Button
          type="button"
          onClick={reset}
          variant="destructive"
          className="mt-4 rounded-full"
        >
          Reintentar
        </Button>
      </section>
      <p className="sr-only">{error.message}</p>
    </main>
  );
}
