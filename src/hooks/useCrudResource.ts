import { useCallback, useEffect, useMemo, useState } from "react";
import type { CrudStatus, UseCrudResourceOptions } from "@/lib/crud/types";

export type CrudResourceState<TRecord> = {
  data: TRecord[];
  status: CrudStatus;
  error: string | null;
};

export function normalizeCrudError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

export function upsertCrudRecord<TRecord>(
  records: TRecord[],
  nextRecord: TRecord,
  getId: (record: TRecord) => string
): TRecord[] {
  const recordId = getId(nextRecord);
  const existingIndex = records.findIndex((item) => getId(item) === recordId);

  if (existingIndex === -1) {
    return [...records, nextRecord];
  }

  const next = [...records];
  next[existingIndex] = nextRecord;
  return next;
}

export function removeCrudRecord<TRecord>(
  records: TRecord[],
  recordId: string,
  getId: (record: TRecord) => string
): TRecord[] {
  return records.filter((item) => getId(item) !== recordId);
}

function sortCrudRecords<TRecord>(
  records: TRecord[],
  sort?: (a: TRecord, b: TRecord) => number
): TRecord[] {
  if (!sort) {
    return records;
  }
  return [...records].sort(sort);
}

export function useCrudResource<TRecord, TCreate, TUpdate>(
  options: UseCrudResourceOptions<TRecord, TCreate, TUpdate>
): {
  data: TRecord[];
  status: CrudStatus;
  error: string | null;
  isLoading: boolean;
  setData: (records: TRecord[]) => void;
  resetStatus: () => void;
  createOne: (payload: TCreate, fallbackErrorMessage: string) => Promise<TRecord | null>;
  updateOne: (
    id: string,
    payload: TUpdate,
    fallbackErrorMessage: string
  ) => Promise<TRecord | null>;
  deleteOne: (id: string, fallbackErrorMessage: string) => Promise<boolean>;
} {
  const [state, setState] = useState<CrudResourceState<TRecord>>({
    data: sortCrudRecords(options.initialData, options.sort),
    status: "idle",
    error: null
  });

  useEffect(() => {
    setState((previous) => ({
      ...previous,
      data: sortCrudRecords(options.initialData, options.sort)
    }));
  }, [options.initialData, options.sort]);

  const setData = useCallback(
    (records: TRecord[]) => {
      setState({
        data: sortCrudRecords(records, options.sort),
        status: "idle",
        error: null
      });
    },
    [options.sort]
  );

  const resetStatus = useCallback(() => {
    setState((previous) => ({
      ...previous,
      status: "idle",
      error: null
    }));
  }, []);

  const createOne = useCallback(
    async (payload: TCreate, fallbackErrorMessage: string): Promise<TRecord | null> => {
      setState((previous) => ({ ...previous, status: "loading", error: null }));
      try {
        const created = await options.create(payload);
        setState((previous) => ({
          data: sortCrudRecords(
            upsertCrudRecord(previous.data, created, options.getId),
            options.sort
          ),
          status: "success",
          error: null
        }));
        return created;
      } catch (error) {
        setState((previous) => ({
          ...previous,
          status: "error",
          error: normalizeCrudError(error, fallbackErrorMessage)
        }));
        return null;
      }
    },
    [options]
  );

  const updateOne = useCallback(
    async (id: string, payload: TUpdate, fallbackErrorMessage: string): Promise<TRecord | null> => {
      setState((previous) => ({ ...previous, status: "loading", error: null }));
      try {
        const updated = await options.update(id, payload);
        setState((previous) => ({
          data: sortCrudRecords(
            upsertCrudRecord(previous.data, updated, options.getId),
            options.sort
          ),
          status: "success",
          error: null
        }));
        return updated;
      } catch (error) {
        setState((previous) => ({
          ...previous,
          status: "error",
          error: normalizeCrudError(error, fallbackErrorMessage)
        }));
        return null;
      }
    },
    [options]
  );

  const deleteOne = useCallback(
    async (id: string, fallbackErrorMessage: string): Promise<boolean> => {
      setState((previous) => ({ ...previous, status: "loading", error: null }));
      try {
        await options.remove(id);
        setState((previous) => ({
          data: removeCrudRecord(previous.data, id, options.getId),
          status: "success",
          error: null
        }));
        return true;
      } catch (error) {
        setState((previous) => ({
          ...previous,
          status: "error",
          error: normalizeCrudError(error, fallbackErrorMessage)
        }));
        return false;
      }
    },
    [options]
  );

  return useMemo(
    () => ({
      data: state.data,
      status: state.status,
      error: state.error,
      isLoading: state.status === "loading",
      setData,
      resetStatus,
      createOne,
      updateOne,
      deleteOne
    }),
    [createOne, deleteOne, resetStatus, setData, state.data, state.error, state.status, updateOne]
  );
}
