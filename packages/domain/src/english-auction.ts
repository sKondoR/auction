import { type BidStepGrid, DEFAULT_BID_STEPS, bidStep } from "./bid-steps";
import { MINUTE_MS } from "./lot-format";
import { DomainError, type Kopecks, formatRub } from "./money";

/**
 * Английский аукцион с автоставками.
 *
 * Состояние торгов — лидер, его максимум и текущая цена. Чтобы определить исход
 * новой ставки, достаточно сравнить её с максимумом лидера: максимумы остальных
 * участников уже не выше текущей цены.
 */
export interface EnglishState {
  startPrice: Kopecks;
  /** null — ставок ещё не было. */
  currentPrice: Kopecks | null;
  leaderId: string | null;
  /** Максимум лидера (автоставка); не раскрывается другим участникам. */
  leaderMax: Kopecks | null;
}

export interface BidPlacement {
  bidderId: string;
  /** Видимая ставка, которую заявил покупатель. */
  amount: Kopecks;
  /** Максимум автоставки; если не задан — равен amount. */
  maxAmount?: Kopecks | null;
}

/** Запись в историю ставок, которую нужно сохранить. */
export interface BidRecord {
  bidderId: string;
  amount: Kopecks;
  /** true — ставка сделана системой по автоставке. */
  isAuto: boolean;
  /** Максимум автоставки покупателя (для заявленных ставок). */
  maxAmount: Kopecks | null;
}

export interface BidOutcome {
  state: EnglishState;
  records: BidRecord[];
  /** Кого перебили этой ставкой (для уведомления). */
  outbidUserId: string | null;
  /** Новая ставка не стала лидирующей: её сразу перебила автоставка лидера. */
  outbidImmediately: boolean;
}

export function initialEnglishState(startPrice: Kopecks): EnglishState {
  return { startPrice, currentPrice: null, leaderId: null, leaderMax: null };
}

/** Минимальная допустимая ставка. */
export function minNextBid(state: EnglishState, grid: BidStepGrid = DEFAULT_BID_STEPS): Kopecks {
  return state.currentPrice === null ? state.startPrice : state.currentPrice + bidStep(state.currentPrice, grid);
}

export function applyBid(
  state: EnglishState,
  placement: BidPlacement,
  grid: BidStepGrid = DEFAULT_BID_STEPS,
): BidOutcome {
  const { bidderId, amount } = placement;
  const max = Math.max(amount, placement.maxAmount ?? amount);
  if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(max) || amount <= 0) {
    throw new DomainError("invalid_amount", "Некорректная сумма ставки");
  }

  // Лидер повышает свой максимум — цена не меняется.
  if (state.leaderId === bidderId) {
    if (max <= (state.leaderMax ?? 0)) {
      throw new DomainError("bid_too_low", "Вы уже лидируете; новый максимум должен быть выше прежнего");
    }
    return {
      state: { ...state, leaderMax: max },
      records: [],
      outbidUserId: null,
      outbidImmediately: false,
    };
  }

  const min = minNextBid(state, grid);
  if (amount < min) {
    throw new DomainError("bid_too_low", `Минимальная ставка — ${formatRub(min)}`);
  }

  // Первая ставка.
  if (state.leaderId === null) {
    return {
      state: { ...state, currentPrice: amount, leaderId: bidderId, leaderMax: max },
      records: [{ bidderId, amount, isAuto: false, maxAmount: max > amount ? max : null }],
      outbidUserId: null,
      outbidImmediately: false,
    };
  }

  const leaderId = state.leaderId;
  const leaderMax = state.leaderMax ?? state.currentPrice ?? 0;

  if (max > leaderMax) {
    // Новый лидер. Прежний лидер дотягивается до своего максимума.
    const price = Math.min(max, Math.max(amount, leaderMax + bidStep(leaderMax, grid)));
    const records: BidRecord[] = [];
    if (leaderMax > (state.currentPrice ?? 0)) {
      records.push({ bidderId: leaderId, amount: leaderMax, isAuto: true, maxAmount: null });
    }
    records.push({ bidderId, amount: price, isAuto: false, maxAmount: max > price ? max : null });
    return {
      state: { ...state, currentPrice: price, leaderId: bidderId, leaderMax: max },
      records,
      outbidUserId: leaderId,
      outbidImmediately: false,
    };
  }

  // Автоставка лидера перебивает новую ставку (при равенстве выигрывает более ранняя).
  const price = Math.min(leaderMax, max + bidStep(max, grid));
  return {
    state: { ...state, currentPrice: price },
    records: [
      { bidderId, amount: max, isAuto: false, maxAmount: max > amount ? max : null },
      { bidderId: leaderId, amount: price, isAuto: true, maxAmount: null },
    ],
    outbidUserId: bidderId,
    outbidImmediately: true,
  };
}

/**
 * Пересчёт торгов с нуля по заявленным ставкам в хронологическом порядке —
 * используется после отмены ставки продавцом.
 */
export function replayBids(
  startPrice: Kopecks,
  placements: readonly BidPlacement[],
  grid: BidStepGrid = DEFAULT_BID_STEPS,
): { state: EnglishState; records: BidRecord[] } {
  let state = initialEnglishState(startPrice);
  const records: BidRecord[] = [];
  for (const p of placements) {
    try {
      const outcome = applyBid(state, p, grid);
      state = outcome.state;
      records.push(...outcome.records);
    } catch (e) {
      // После отмены части ставок некоторые заявки становятся некорректными
      // (например, ниже новой минимальной) — такие пропускаем.
      if (!(e instanceof DomainError)) throw e;
    }
  }
  return { state, records };
}

/* ---------- Продление торгов ---------- */

export const EXTENSION_WINDOW_MS = 5 * MINUTE_MS;
export const EXTENSION_MS = 5 * MINUTE_MS;

/** Ставка в последние 5 минут продлевает окончание на 5 минут от момента ставки. */
export function extendEndIfSniping(endsAt: Date, bidAt: Date): Date {
  const left = endsAt.getTime() - bidAt.getTime();
  if (left <= EXTENSION_WINDOW_MS) {
    return new Date(Math.max(bidAt.getTime() + EXTENSION_MS, endsAt.getTime()));
  }
  return endsAt;
}

/* ---------- Блиц-цена ---------- */

export function isBlitzAvailable(blitzPrice: Kopecks | null, currentPrice: Kopecks | null): boolean {
  return blitzPrice !== null && (currentPrice === null || currentPrice < blitzPrice);
}

/**
 * Продавец может только снижать блиц-цену, не ниже «текущая ставка + шаг».
 * До первой ставки блиц-цену можно менять свободно (выше стартовой).
 */
export function validateBlitzChange(
  params: {
    oldBlitz: Kopecks | null;
    newBlitz: Kopecks | null;
    state: EnglishState;
  },
  grid: BidStepGrid = DEFAULT_BID_STEPS,
): void {
  const { oldBlitz, newBlitz, state } = params;
  if (state.currentPrice === null) {
    if (newBlitz !== null && newBlitz <= state.startPrice) {
      throw new DomainError("invalid_blitz", "Блиц-цена должна быть выше стартовой");
    }
    return;
  }
  if (newBlitz === null) throw new DomainError("invalid_blitz", "После первой ставки блиц-цену нельзя убрать");
  if (oldBlitz === null) throw new DomainError("invalid_blitz", "После первой ставки блиц-цену нельзя добавить");
  if (newBlitz >= oldBlitz) throw new DomainError("invalid_blitz", "Блиц-цену можно только снижать");
  const floor = minNextBid(state, grid);
  if (newBlitz < floor) {
    throw new DomainError("invalid_blitz", `Блиц-цена не может быть ниже ${formatRub(floor)} (текущая ставка + шаг)`);
  }
}
