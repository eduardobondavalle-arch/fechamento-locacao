"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Building2,
  CheckSquare2,
  ClockAlert,
  GripVertical,
  MessageSquare,
  Paperclip,
  UserRound,
} from "lucide-react";
import { isCardSlaOverdue } from "@/lib/domain/sla";
import type { AppData, BoardList, Card } from "@/lib/domain/types";
import { cn, formatCurrency } from "@/lib/utils";

export function CardTile({
  card,
  list,
  data,
  now,
  onOpen,
  overlay = false,
}: {
  card: Card;
  list: BoardList;
  data: AppData;
  now: number;
  onOpen: () => void;
  overlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    disabled: card.archived || overlay,
  });
  const checklistIds = data.checklists
    .filter((item) => item.cardId === card.id)
    .map((item) => item.id);
  const checklistItems = data.checklistItems.filter((item) =>
    checklistIds.includes(item.checklistId),
  );
  const completedItems = checklistItems.filter((item) => item.completed).length;
  const comments = data.comments.filter(
    (item) => item.cardId === card.id,
  ).length;
  const attachments = data.attachments.filter(
    (item) => item.cardId === card.id,
  ).length;
  const unit = data.units.find((item) => item.id === card.unitId);
  const consultant = data.consultants.find(
    (item) => item.id === card.consultantId,
  );
  const captor = data.captors.find((item) => item.id === card.captorId);
  const overdue = isCardSlaOverdue(card, list, now);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        "kanban-card group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-card transition hover:border-slate-300 hover:shadow-md",
        overdue && "border-rose-400 pt-4",
        isDragging && "opacity-30",
        overlay && "rotate-2 shadow-xl",
        card.archived && "opacity-70",
      )}
    >
      {overdue && (
        <div
          className="absolute inset-x-0 top-0 h-1.5 bg-rose-600"
          aria-label="SLA atrasado"
        />
      )}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute right-1.5 top-2 cursor-grab rounded p-1 text-slate-300 opacity-0 hover:bg-slate-100 hover:text-slate-600 focus:opacity-100 active:cursor-grabbing group-hover:opacity-100 dark:hover:bg-slate-800"
        aria-label={`Arrastar card de ${card.tenantName}`}
      >
        <GripVertical size={15} />
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
        aria-label={`Abrir card de ${card.tenantName}`}
      >
        {overdue && (
          <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-rose-700 dark:bg-rose-950 dark:text-rose-200">
            <ClockAlert size={11} /> SLA atrasado
          </span>
        )}
        <h3 className="pr-4 text-[13px] font-semibold leading-[1.35rem] text-slate-800">
          {card.tenantName}
        </h3>
        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--muted-foreground)]">
          {card.property}
        </p>
        <p className="mt-1.5 text-xs font-bold text-[var(--foreground)]">
          {card.rentValueCents > 0
            ? formatCurrency(card.rentValueCents)
            : "Aluguel não informado"}
        </p>
        <div className="mt-3 space-y-1.5 text-[10px] font-medium text-[var(--muted-foreground)]">
          <p className="flex items-center gap-1.5">
            <Building2 size={11} /> {unit?.name ?? "Unidade não encontrada"}
          </p>
          <p className="flex items-center gap-1.5">
            <UserRound size={11} /> Consultor: {consultant?.name ?? "—"}
          </p>
          <p className="flex items-center gap-1.5">
            <UserRound size={11} /> Captador: {captor?.name ?? "—"}
          </p>
        </div>
        <div className="mt-3 flex min-h-5 items-center gap-2 text-[10px] font-semibold text-slate-500">
          {checklistItems.length > 0 && (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                completedItems === checklistItems.length && "text-emerald-700",
              )}
            >
              <CheckSquare2 size={12} /> {completedItems}/
              {checklistItems.length}
            </span>
          )}
          {comments > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare size={12} /> {comments}
            </span>
          )}
          {attachments > 0 && (
            <span className="inline-flex items-center gap-1">
              <Paperclip size={12} /> {attachments}
            </span>
          )}
        </div>
      </button>
    </article>
  );
}
