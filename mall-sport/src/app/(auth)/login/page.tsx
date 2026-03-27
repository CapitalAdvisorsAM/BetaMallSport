"use client";

import { signIn } from "next-auth/react";

export default function LoginPage(): JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg shadow-slate-200">
        <h1 className="text-2xl font-semibold text-slate-900">Mall Sport</h1>
        <p className="mt-2 text-sm text-slate-600">
          Inicia sesion con tu cuenta corporativa para acceder al dashboard.
        </p>
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="mt-6 w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          Ingresar con Google Workspace
        </button>
      </section>
    </main>
  );
}
