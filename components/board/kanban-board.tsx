"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { LayoutDashboard } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { filterCards } from "@/lib/domain/filters";
import { moveCard } from "@/lib/domain/operations";
import { EMPTY_FILTERS, type CardFilters } from "@/lib/domain/types";
import { useBoard } from "../providers/board-provider";
import { CardDetailModal } from "../card-detail/card-detail-modal";
import { CommissionPanel } from "../commissions/commission-panel";
import { BoardSettingsPanel } from "./board-settings-panel";
import { BoardToolbar } from "./board-toolbar";
import { CardTile } from "./card-tile";
import { CreateClosingModal } from "./create-closing-modal";
import { KanbanColumn } from "./kanban-column";

export function KanbanBoard() {
  const { data, mutate } = useBoard();
  const [filters, setFilters] = useState<CardFilters>(EMPTY_FILTERS);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<
    "board" | "commissions" | "settings"
  >("board");
  const [createClosingOpen, setCreateClosingOpen] = useState(false);
  const [slaNow, setSlaNow] = useState(() => Date.now());
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const edgeScrollFrameRef = useRef<number | null>(null);
  const edgeScrollSpeedRef = useRef(0);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const lists = useMemo(
    () =>
      [...data.lists]
        .filter((list) => !list.archived)
        .sort((a, b) => a.position - b.position),
    [data.lists],
  );
  const visibleCards = useMemo(
    () => filterCards(data, filters),
    [data, filters],
  );
  const activeCard = activeCardId
    ? data.cards.find((card) => card.id === activeCardId)
    : null;
  const activeCardList = activeCard
    ? data.lists.find((list) => list.id === activeCard.listId)
    : null;

  const stopEdgeScroll = useCallback(() => {
    edgeScrollSpeedRef.current = 0;
    if (edgeScrollFrameRef.current !== null) {
      cancelAnimationFrame(edgeScrollFrameRef.current);
      edgeScrollFrameRef.current = null;
    }
  }, []);

  const startEdgeScroll = useCallback(() => {
    if (edgeScrollFrameRef.current !== null) return;

    const scrollFrame = () => {
      const board = boardScrollRef.current;
      const speed = edgeScrollSpeedRef.current;

      if (!board || speed === 0) {
        edgeScrollFrameRef.current = null;
        return;
      }

      const previousScrollLeft = board.scrollLeft;
      board.scrollLeft += speed;

      if (board.scrollLeft === previousScrollLeft) {
        edgeScrollSpeedRef.current = 0;
        edgeScrollFrameRef.current = null;
        return;
      }

      edgeScrollFrameRef.current = requestAnimationFrame(scrollFrame);
    };

    edgeScrollFrameRef.current = requestAnimationFrame(scrollFrame);
  }, []);

  const handleBoardPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "mouse") {
        stopEdgeScroll();
        return;
      }

      const board = event.currentTarget;
      if (board.scrollWidth <= board.clientWidth) {
        stopEdgeScroll();
        return;
      }

      const bounds = board.getBoundingClientRect();
      const edgeWidth = Math.min(96, bounds.width * 0.12);
      const distanceFromLeft = event.clientX - bounds.left;
      const distanceFromRight = bounds.right - event.clientX;
      let speed = 0;

      if (distanceFromLeft < edgeWidth) {
        const intensity = Math.max(0, 1 - distanceFromLeft / edgeWidth);
        speed = -(2 + Math.round(22 * intensity * intensity));
      } else if (distanceFromRight < edgeWidth) {
        const intensity = Math.max(0, 1 - distanceFromRight / edgeWidth);
        speed = 2 + Math.round(22 * intensity * intensity);
      }

      edgeScrollSpeedRef.current = speed;
      if (speed === 0) stopEdgeScroll();
      else startEdgeScroll();
    },
    [startEdgeScroll, stopEdgeScroll],
  );

  useEffect(() => stopEdgeScroll, [stopEdgeScroll]);

  useEffect(() => {
    const timer = window.setInterval(() => setSlaNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const onDragStart = (event: DragStartEvent) =>
    setActiveCardId(String(event.active.id));
  const onDragEnd = (event: DragEndEvent) => {
    setActiveCardId(null);
    if (!event.over) return;
    const cardId = String(event.active.id);
    const overId = String(event.over.id);
    const overCard = data.cards.find((card) => card.id === overId);
    const toListId = overId.startsWith("list:")
      ? overId.slice(5)
      : overCard?.listId;
    if (
      !toListId ||
      (overId === cardId &&
        data.cards.find((card) => card.id === cardId)?.listId === toListId)
    )
      return;
    void mutate(
      (current) => moveCard(current, cardId, toListId, overCard?.id),
      { success: "Card movido.", optimistic: true },
    );
  };

  return (
    <div className="app-workspace flex h-screen min-h-[620px] flex-col overflow-hidden">
      <BoardToolbar
        filters={filters}
        onFiltersChange={setFilters}
        activeView={activeView}
        onViewChange={setActiveView}
        onAddClosing={() => setCreateClosingOpen(true)}
      />
      <main className="min-h-0 flex-1">
        {activeView === "settings" ? (
          <BoardSettingsPanel />
        ) : activeView === "commissions" ? (
          <CommissionPanel />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveCardId(null)}
          >
            <div
              ref={boardScrollRef}
              className="kanban-board flex h-full gap-3 overflow-x-auto p-3 sm:p-4"
              aria-label="Quadro Kanban de fechamento de locação"
              onPointerMove={handleBoardPointerMove}
              onPointerLeave={stopEdgeScroll}
              onPointerCancel={stopEdgeScroll}
            >
              {lists.map((list) => {
                const cards = visibleCards
                  .filter((card) => card.listId === list.id)
                  .sort((a, b) => a.position - b.position);
                return (
                  <KanbanColumn
                    key={list.id}
                    list={list}
                    cards={cards}
                    data={data}
                    now={slaNow}
                    onOpenCard={setSelectedCardId}
                  />
                );
              })}
              {lists.length === 0 && (
                <div className="m-auto flex flex-col items-center text-slate-400">
                  <LayoutDashboard size={32} />
                  <p className="mt-2 text-sm">Nenhuma lista disponível.</p>
                </div>
              )}
            </div>
            <DragOverlay>
              {activeCard && activeCardList ? (
                <div className="w-[276px]">
                  <CardTile
                    card={activeCard}
                    list={activeCardList}
                    data={data}
                    now={slaNow}
                    onOpen={() => undefined}
                    overlay
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </main>
      {selectedCardId && (
        <CardDetailModal
          cardId={selectedCardId}
          onClose={() => setSelectedCardId(null)}
        />
      )}
      {createClosingOpen && (
        <CreateClosingModal
          onClose={() => setCreateClosingOpen(false)}
          onCreated={setSelectedCardId}
          onOpenSettings={() => setActiveView("settings")}
        />
      )}
    </div>
  );
}
