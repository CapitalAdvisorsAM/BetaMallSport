"use client";

import type { ReactNode } from "react";

type EntityCrudShellProps = {
  title: string;
  canEdit: boolean;
  readOnlyMessage?: string;
  toolbar?: ReactNode;
  form?: ReactNode;
  message?: string | null;
  table: ReactNode;
};

export function EntityCrudShell({
  title,
  canEdit,
  readOnlyMessage,
  toolbar,
  form,
  message,
  table
}: EntityCrudShellProps): JSX.Element {
  return (
    <section className="space-y-4 rounded-md bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {toolbar}
      </div>

      {!canEdit && readOnlyMessage ? <p className="text-sm text-amber-700">{readOnlyMessage}</p> : null}
      {form}
      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
      {table}
    </section>
  );
}
