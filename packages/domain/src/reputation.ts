import { DomainError } from "./money";

export const REVIEW_RATINGS = ["positive", "neutral", "negative"] as const;
export type ReviewRating = (typeof REVIEW_RATINGS)[number];

export const REVIEW_RATING_LABELS: Record<ReviewRating, string> = {
  positive: "Положительный",
  neutral: "Нейтральный",
  negative: "Отрицательный",
};

export interface ReviewCounts {
  positive: number;
  neutral: number;
  negative: number;
}

/** Рейтинг: разница положительных и отрицательных отзывов и доля положительных. */
export function rating(c: ReviewCounts): { score: number; positivePercent: number | null; total: number } {
  const total = c.positive + c.neutral + c.negative;
  return {
    score: c.positive - c.negative,
    positivePercent: total === 0 ? null : Math.round((c.positive / total) * 100),
    total,
  };
}

export interface NewbieLimits {
  /** Лотов, на которые новичок может одновременно ставить. */
  maxConcurrentBidLots: number;
  /** Одновременно активных лотов новичка-продавца. */
  maxActiveLots: number;
}

export const DEFAULT_NEWBIE_LIMITS: NewbieLimits = { maxConcurrentBidLots: 5, maxActiveLots: 10 };
export const DEFAULT_PENALTY_BAN_THRESHOLD = 3;

export const isNewbie = (reviewsReceived: number): boolean => reviewsReceived === 0;

export function assertNewbieCanBid(p: {
  reviewsReceived: number;
  activeBidLots: number;
  alreadyBidsOnThisLot: boolean;
  limits: NewbieLimits;
}): void {
  if (!isNewbie(p.reviewsReceived) || p.alreadyBidsOnThisLot) return;
  if (p.activeBidLots >= p.limits.maxConcurrentBidLots) {
    throw new DomainError(
      "newbie_limit",
      `Пока у вас нет отзывов, можно участвовать не более чем в ${p.limits.maxConcurrentBidLots} торгах одновременно`,
    );
  }
}

export function assertNewbieCanList(p: { reviewsReceived: number; activeLots: number; limits: NewbieLimits }): void {
  if (!isNewbie(p.reviewsReceived)) return;
  if (p.activeLots >= p.limits.maxActiveLots) {
    throw new DomainError(
      "newbie_limit",
      `Пока у вас нет отзывов, можно держать не более ${p.limits.maxActiveLots} активных лотов`,
    );
  }
}

export const shouldBanForPenalties = (penaltyCount: number, threshold: number): boolean =>
  threshold > 0 && penaltyCount >= threshold;
