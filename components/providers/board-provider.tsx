"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ZodError } from "zod";
import { createInitialData } from "@/lib/domain/initial-data";
import type { AppData } from "@/lib/domain/types";
import { logError } from "@/lib/logging";
import {
  localBoardRepository,
  type BoardRepository,
} from "@/lib/persistence/local-repository";

type Toast = { id: number; kind: "success" | "error"; message: string };

type BoardContextValue = {
  data: AppData;
  ready: boolean;
  toast: Toast | null;
  mutate: (
    operation: (current: AppData) => AppData,
    options?: { success?: string; optimistic?: boolean },
  ) => Promise<boolean>;
  notify: (message: string, kind?: Toast["kind"]) => void;
};

const BoardContext = createContext<BoardContextValue | null>(null);

export function BoardProvider({
  children,
  repository = localBoardRepository,
}: {
  children: ReactNode;
  repository?: BoardRepository;
}) {
  const [data, setData] = useState<AppData>(() => createInitialData());
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const dataRef = useRef(data);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const replaceData = useCallback((next: AppData) => {
    dataRef.current = next;
    setData(next);
  }, []);

  const notify = useCallback(
    (message: string, kind: Toast["kind"] = "success") => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ id: Date.now(), kind, message });
      toastTimer.current = setTimeout(() => setToast(null), 3500);
    },
    [],
  );

  useEffect(() => {
    let active = true;
    repository
      .load()
      .then((loaded) => active && replaceData(loaded))
      .catch(
        () =>
          active &&
          notify("Não foi possível carregar os dados locais.", "error"),
      )
      .finally(() => active && setReady(true));
    return () => {
      active = false;
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [notify, replaceData, repository]);

  const mutate = useCallback(
    async (
      operation: (current: AppData) => AppData,
      options: { success?: string; optimistic?: boolean } = {},
    ) => {
      const before = dataRef.current;
      try {
        const next = operation(before);
        replaceData(next);
        await repository.save(next);
        if (options.success) notify(options.success);
        return true;
      } catch (error) {
        logError({ event: "board.mutation.failed", recoverable: true }, error);
        if (options.optimistic) replaceData(before);
        const message =
          error instanceof ZodError
            ? (error.issues[0]?.message ?? "Revise os dados informados.")
            : error instanceof Error
              ? error.message
              : "Não foi possível salvar a alteração.";
        notify(
          options.optimistic ? `Alteração desfeita: ${message}` : message,
          "error",
        );
        return false;
      }
    },
    [notify, replaceData, repository],
  );

  const value = useMemo(
    () => ({ data, ready, toast, mutate, notify }),
    [data, mutate, notify, ready, toast],
  );

  return (
    <BoardContext.Provider value={value}>{children}</BoardContext.Provider>
  );
}

export function useBoard() {
  const context = useContext(BoardContext);
  if (!context)
    throw new Error("useBoard deve ser usado dentro de BoardProvider.");
  return context;
}
