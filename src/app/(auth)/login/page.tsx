"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";

export default function LoginPage(): JSX.Element {
  return (
    <main className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-brand-700 p-12 lg:flex">
        <div className="flex items-center gap-3">
          <Image
            src="/MallSportLogo.jpg"
            alt="Mall Sport"
            width={40}
            height={40}
            className="rounded-lg ring-2 ring-white/20"
          />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Capital Advisors
            </p>
            <p className="text-sm font-bold text-white">Mall Sport</p>
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-bold leading-snug text-white">
            Control de gestion
            <br />
            de activos inmobiliarios
          </h2>
          <p className="mt-3 text-sm text-white/60">Rent roll - Contratos - KPIs financieros</p>
        </div>
        <p className="text-xs text-white/30">(c) {new Date().getFullYear()} Mall Sport AGF</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-[#f1f4f9] p-8">
        <section className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-brand-700">Iniciar sesion</h1>
          <p className="mt-2 text-sm text-slate-500">
            Accede con tu cuenta corporativa Google Workspace.
          </p>
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-700 hover:bg-brand-700 hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5c-.2 1.2-.9 2.3-1.9 3v2.5h3.1c1.8-1.6 3.1-4 3.1-7.3Z"
              />
              <path
                fill="currentColor"
                d="M12 22c2.7 0 5-0.9 6.7-2.5l-3.1-2.5c-.9.6-2.1 1-3.6 1-2.8 0-5.2-1.9-6-4.4H2.8V16C4.5 19.6 8 22 12 22Z"
              />
              <path
                fill="currentColor"
                d="M6 13.6c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V7.5H2.8C2.3 8.7 2 10 2 11.8s.3 3.1.8 4.3L6 13.6Z"
              />
              <path
                fill="currentColor"
                d="M12 5.8c1.5 0 2.8.5 3.9 1.5l2.9-2.9C17 2.8 14.7 2 12 2 8 2 4.5 4.4 2.8 8l3.2 2.5c.8-2.5 3.2-4.7 6-4.7Z"
              />
            </svg>
            Ingresar con Google Workspace
          </button>
        </section>
      </div>
    </main>
  );
}
