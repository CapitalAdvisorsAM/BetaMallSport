"use client";

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
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
        >
          Reintentar
        </button>
      </section>
      <p className="sr-only">{error.message}</p>
    </main>
  );
}
