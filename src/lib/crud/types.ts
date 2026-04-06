import type { ColumnDef } from "@tanstack/react-table";

export type CrudStatus = "idle" | "loading" | "success" | "error";

export type CrudEntityConfig<TRecord, TForm> = {
  entityName: string;
  getId: (record: TRecord) => string;
  createEmptyForm: () => TForm;
};

export type CrudColumnFactory<TRecord> = {
  id: string;
  build: () => ColumnDef<TRecord, unknown>;
};

export type UseCrudResourceOptions<TRecord, TCreate, TUpdate> = {
  initialData: TRecord[];
  getId: (record: TRecord) => string;
  create: (payload: TCreate) => Promise<TRecord>;
  update: (id: string, payload: TUpdate) => Promise<TRecord>;
  remove: (id: string) => Promise<void>;
  sort?: (a: TRecord, b: TRecord) => number;
};
