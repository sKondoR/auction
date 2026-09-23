import { DAY_MS } from "./lot-format";
import { DomainError } from "./money";

/**
 * Сделка: продано → ждёт оплаты → оплачено → отправлено → получено → отзывы.
 * «not_paid» и «not_received» — отметки о неоплате и неполучении.
 */
export const DEAL_STATUSES = [
  "sold",
  "awaiting_payment",
  "paid",
  "shipped",
  "received",
  "completed",
  "not_paid",
  "not_received",
] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  sold: "Продано",
  awaiting_payment: "Ждёт оплаты",
  paid: "Оплачено",
  shipped: "Отправлено",
  received: "Получено",
  completed: "Завершена",
  not_paid: "Покупатель не оплатил",
  not_received: "Товар не получен",
};

export type DealRole = "seller" | "buyer";

export const DEAL_ACTIONS = [
  "confirm_contact", // стороны связались, продавец ждёт оплату
  "mark_paid", // продавец отмечает оплату
  "mark_shipped", // продавец отмечает отправку
  "mark_received", // покупатель отмечает получение
  "report_not_paid", // продавец: покупатель не оплатил (после 7 дней)
  "report_not_received", // покупатель: товар не получен
] as const;
export type DealAction = (typeof DEAL_ACTIONS)[number];

export const DEAL_ACTION_LABELS: Record<DealAction, string> = {
  confirm_contact: "Договорились, жду оплату",
  mark_paid: "Оплата получена",
  mark_shipped: "Отправлено",
  mark_received: "Получено",
  report_not_paid: "Покупатель не оплатил",
  report_not_received: "Товар не получен",
};

export const CONTACT_DEADLINE_DAYS = 3;
export const PAYMENT_DEADLINE_DAYS = 7;
/** Через сколько дней после отправки покупатель может отметить неполучение. */
export const NOT_RECEIVED_AFTER_DAYS = 14;

interface Transition {
  from: readonly DealStatus[];
  to: DealStatus;
  role: DealRole;
}

const TRANSITIONS: Record<DealAction, Transition> = {
  confirm_contact: { from: ["sold"], to: "awaiting_payment", role: "seller" },
  mark_paid: { from: ["sold", "awaiting_payment"], to: "paid", role: "seller" },
  mark_shipped: { from: ["paid"], to: "shipped", role: "seller" },
  mark_received: { from: ["shipped", "paid"], to: "received", role: "buyer" },
  report_not_paid: { from: ["sold", "awaiting_payment"], to: "not_paid", role: "seller" },
  report_not_received: { from: ["paid", "shipped"], to: "not_received", role: "buyer" },
};

export interface DealSnapshot {
  status: DealStatus;
  createdAt: Date;
  shippedAt: Date | null;
}

/** Доступные действия для роли в текущий момент. */
export function availableDealActions(deal: DealSnapshot, role: DealRole, now: Date): DealAction[] {
  return DEAL_ACTIONS.filter((a) => {
    try {
      nextDealStatus(deal, a, role, now);
      return true;
    } catch {
      return false;
    }
  });
}

export function nextDealStatus(deal: DealSnapshot, action: DealAction, role: DealRole, now: Date): DealStatus {
  const t = TRANSITIONS[action];
  if (t.role !== role) throw new DomainError("deal_forbidden", "Это действие доступно другой стороне сделки");
  if (!t.from.includes(deal.status)) {
    throw new DomainError("deal_invalid_transition", "Действие недоступно в текущем статусе сделки");
  }
  if (action === "report_not_paid" && now.getTime() - deal.createdAt.getTime() < PAYMENT_DEADLINE_DAYS * DAY_MS) {
    throw new DomainError("deal_too_early", `«Покупатель не оплатил» доступно через ${PAYMENT_DEADLINE_DAYS} дней после продажи`);
  }
  if (action === "report_not_received") {
    const since = deal.shippedAt ?? deal.createdAt;
    if (now.getTime() - since.getTime() < NOT_RECEIVED_AFTER_DAYS * DAY_MS) {
      throw new DomainError(
        "deal_too_early",
        `«Товар не получен» доступно через ${NOT_RECEIVED_AFTER_DAYS} дней после отправки`,
      );
    }
  }
  return t.to;
}

/** Статусы, после которых стороны могут оставить отзывы. */
export function canReview(status: DealStatus): boolean {
  return status === "received" || status === "completed" || status === "not_received" || status === "not_paid";
}

export const isDealClosed = (status: DealStatus): boolean =>
  status === "completed" || status === "not_paid" || status === "not_received";
