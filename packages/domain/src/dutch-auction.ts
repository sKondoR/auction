import { DAY_MS } from "./lot-format";
import type { Kopecks } from "./money";

/**
 * Голландский аукцион (этап 2): линейное снижение от стартовой цены на
 * stepPercent стартовой цены каждые intervalDays, не ниже минимальной.
 */
export interface DutchParams {
  startPrice: Kopecks;
  minPrice: Kopecks;
  intervalDays: number;
  stepPercent: number;
  startsAt: Date;
}

export function dutchPrice(p: DutchParams, now: Date): Kopecks {
  const elapsed = Math.max(0, now.getTime() - p.startsAt.getTime());
  const steps = Math.floor(elapsed / (p.intervalDays * DAY_MS));
  const drop = Math.round((p.startPrice * p.stepPercent * steps) / 100);
  return Math.max(p.minPrice, p.startPrice - drop);
}
