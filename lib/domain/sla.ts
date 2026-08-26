import type { BoardList, Card } from "./types";

export function isCardSlaOverdue(
  card: Card,
  list: BoardList,
  now: number | Date = Date.now(),
): boolean {
  if (card.archived || list.completedState || !list.slaHours) return false;
  const enteredAt = new Date(card.enteredListAt).getTime();
  const currentTime = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(enteredAt)) return false;
  return currentTime - enteredAt > list.slaHours * 60 * 60 * 1000;
}
