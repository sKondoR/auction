import { DAY_MS, type LotFormat, MAX_AUTO_RELISTS } from "./lot-format";

export interface RelistCandidate {
  format: LotFormat;
  autoRelist: boolean;
  /** Сколько раз лот уже перевыставлен автоматически. */
  autoRelistCount: number;
}

/** Автоперевыставление: только если продавец включил опцию и лимит не исчерпан. */
export function shouldAutoRelist(lot: RelistCandidate): boolean {
  return lot.autoRelist && lot.autoRelistCount < MAX_AUTO_RELISTS;
}

/** Новый срок при перевыставлении с той же длительностью. */
export function relistWindow(
  prev: { startsAt: Date; originalEndsAt: Date },
  now: Date,
): { startsAt: Date; endsAt: Date } {
  const durationDays = Math.max(1, Math.round((prev.originalEndsAt.getTime() - prev.startsAt.getTime()) / DAY_MS));
  return { startsAt: now, endsAt: new Date(now.getTime() + durationDays * DAY_MS) };
}
