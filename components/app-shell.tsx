"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { KanbanBoard } from "./board/kanban-board";
import { useBoard } from "./providers/board-provider";

function BoardSkeleton() {
  return (
    <div className="h-screen animate-pulse bg-slate-100">
      <div className="h-14 border-b border-slate-200 bg-white" />
      <div className="h-14 border-b border-slate-200 bg-slate-50" />
      <div className="flex gap-3 overflow-hidden p-4">
        {Array.from({ length: 5 }).map((_, column) => (
          <div
            key={column}
            className="h-[70vh] w-[292px] shrink-0 rounded-xl bg-slate-200 p-3"
          >
            <div className="mb-5 h-4 w-40 rounded bg-slate-300" />
            {Array.from({ length: (column % 3) + 1 }).map((__, card) => (
              <div key={card} className="mb-2 h-24 rounded-xl bg-white" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AppShell() {
  const { ready, toast } = useBoard();
  if (!ready) return <BoardSkeleton />;
  return (
    <>
      <KanbanBoard />
      {toast && (
        <div
          role={toast.kind === "error" ? "alert" : "status"}
          className={`fixed bottom-5 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${toast.kind === "error" ? "bg-rose-700" : "bg-emerald-700"}`}
        >
          {toast.kind === "error" ? (
            <AlertCircle size={17} />
          ) : (
            <CheckCircle2 size={17} />
          )}
          {toast.message}
        </div>
      )}
    </>
  );
}
