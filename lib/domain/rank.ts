export const RANK_STEP = 1024;

export function rankBetween(
  before?: number | null,
  after?: number | null,
): number {
  if (before == null && after == null) return RANK_STEP;
  if (before == null) return (after as number) - RANK_STEP;
  if (after == null) return before + RANK_STEP;
  return before + (after - before) / 2;
}

export function needsRankNormalization(before: number, after: number): boolean {
  return Math.abs(after - before) < 0.000001;
}

export function normalizedRanks(ids: string[]): Record<string, number> {
  return Object.fromEntries(
    ids.map((id, index) => [id, (index + 1) * RANK_STEP]),
  );
}
