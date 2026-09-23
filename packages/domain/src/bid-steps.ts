import { type Kopecks, DomainError, rub } from "./money";

/** Строка сетки: при цене от `from` (включительно) шаг равен `step`. */
export interface BidStepRow {
  from: Kopecks;
  step: Kopecks;
}

export type BidStepGrid = readonly BidStepRow[];

export const DEFAULT_BID_STEPS: BidStepGrid = [
  { from: rub(0), step: rub(5) },
  { from: rub(100), step: rub(10) },
  { from: rub(1_000), step: rub(50) },
  { from: rub(5_000), step: rub(100) },
  { from: rub(20_000), step: rub(500) },
  { from: rub(100_000), step: rub(1_000) },
];

export function validateBidStepGrid(grid: BidStepGrid): void {
  if (grid.length === 0) throw new DomainError("invalid_grid", "Сетка шагов пуста");
  if (grid[0]!.from !== 0) throw new DomainError("invalid_grid", "Сетка должна начинаться с 0 ₽");
  for (let i = 0; i < grid.length; i++) {
    const row = grid[i]!;
    if (!Number.isSafeInteger(row.step) || row.step <= 0) {
      throw new DomainError("invalid_grid", "Шаг должен быть положительным");
    }
    if (i > 0 && row.from <= grid[i - 1]!.from) {
      throw new DomainError("invalid_grid", "Границы сетки должны возрастать");
    }
  }
}

/** Шаг ставки для текущей цены. */
export function bidStep(price: Kopecks, grid: BidStepGrid = DEFAULT_BID_STEPS): Kopecks {
  let step = grid[0]!.step;
  for (const row of grid) {
    if (price >= row.from) step = row.step;
    else break;
  }
  return step;
}
