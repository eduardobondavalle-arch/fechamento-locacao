"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CheckCircle2, Clock3 } from "lucide-react";
import type { AppData, BoardList, Card } from "@/lib/domain/types";
import { CardTile } from "./card-tile";

export function KanbanColumn({
  list,
  cards,
  data,
  now,
  onOpenCard,
}: {
  list: BoardList;
  cards: Card[];
  data: AppData;
  now: number;
  onOpenCard: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `list:${list.id}` });

  return (
    <section
      aria-labelledby={`list-title-${list.id}`}
      className={`kanban-column flex max-h-full w-[292px] shrink-0 flex-col rounded-2xl border ${isOver ? "border-accent-500 ring-2 ring-accent-100" : "border-slate-200"}`}
    >
      <header className="flex items-start gap-2 px-3 py-3">
        <div className="min-w-0 flex-1">
          <h2
            id={`list-title-${list.id}`}
            className="text-[11px] font-extrabold leading-4 tracking-[.025em] text-navy-900"
          >
            {list.name}
          </h2>
          <div className="mt-1 flex flex-wrap gap-2">
            {list.slaHours && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                <Clock3 size={11} /> SLA {list.slaHours}h
              </span>
            )}
            {list.completedState && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                <CheckCircle2 size={11} /> Etapa concluída
              </span>
            )}
          </div>
        </div>
        <span
          className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 shadow-sm"
          aria-label={`${cards.length} cards`}
        >
          {cards.length}
        </span>
      </header>
      <div
        ref={setNodeRef}
        className="kanban-column-scroll min-h-20 flex-1 space-y-2 overflow-y-auto px-2 pb-2"
      >
        <SortableContext
          items={cards.map((card) => card.id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              list={list}
              data={data}
              now={now}
              onOpen={() => onOpenCard(card.id)}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div
            className={`flex min-h-20 items-center justify-center rounded-lg border border-dashed px-4 text-center text-[11px] ${isOver ? "border-accent-500 bg-accent-50 text-accent-700" : "border-slate-300 text-slate-400"}`}
          >
            {isOver ? "Solte o card aqui" : "Nenhum card nesta etapa"}
          </div>
        )}
      </div>
    </section>
  );
}
