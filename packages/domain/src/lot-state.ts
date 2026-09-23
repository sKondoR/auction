import type { LotFormat } from "./lot-format";

/**
 * Статус, сохранённый в БД. Открытость лота для ставок и покупки вычисляется из
 * времени (ADR 0003): «active» в БД может означать уже закончившиеся торги,
 * которые worker ещё не финализировал.
 */
export const LOT_STATUSES = [
  "scheduled", // ждёт начала (живой аукцион, отложенный старт)
  "active",
  "sold", // завершён с продажей (всё количество продано)
  "unsold", // завершён без продажи или истёк срок
  "withdrawn", // досрочно снят продавцом
  "removed", // снят модератором
] as const;
export type LotStatus = (typeof LOT_STATUSES)[number];

export type LotPhase = "upcoming" | "open" | "ended";

export interface LotTiming {
  status: LotStatus;
  format: LotFormat;
  startsAt: Date;
  endsAt: Date;
}

export function lotPhase(lot: LotTiming, now: Date): LotPhase {
  if (lot.status !== "active" && lot.status !== "scheduled") return "ended";
  if (now < lot.startsAt) return "upcoming";
  if (now >= lot.endsAt) return "ended";
  return "open";
}

export const isOpen = (lot: LotTiming, now: Date): boolean => lotPhase(lot, now) === "open";

/** Лот завершился по времени, но ещё не финализирован. */
export const needsFinalization = (lot: LotTiming, now: Date): boolean =>
  (lot.status === "active" || lot.status === "scheduled") && now >= lot.endsAt;

export const LOT_STATUS_LABELS: Record<LotStatus, string> = {
  scheduled: "Скоро начнётся",
  active: "Идут торги",
  sold: "Продан",
  unsold: "Не продан",
  withdrawn: "Снят продавцом",
  removed: "Снят модератором",
};
