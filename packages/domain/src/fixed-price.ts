import { DomainError, type Kopecks } from "./money";

export interface FixedLotStock {
  quantity: number;
  quantitySold: number;
}

export const remaining = (lot: FixedLotStock): number => lot.quantity - lot.quantitySold;

export function assertCanBuy(lot: FixedLotStock, qty: number): void {
  if (!Number.isInteger(qty) || qty < 1) throw new DomainError("invalid_quantity", "Некорректное количество");
  if (qty > remaining(lot)) throw new DomainError("out_of_stock", `Доступно только ${remaining(lot)} шт.`);
}

export const OFFER_STATUSES = ["pending", "accepted", "rejected", "cancelled"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

/** Предложение цены должно быть ниже цены продавца (иначе — обычная покупка). */
export function validateOffer(params: { price: Kopecks; listPrice: Kopecks; qty: number; stock: FixedLotStock }): void {
  const { price, listPrice, qty, stock } = params;
  assertCanBuy(stock, qty);
  if (!Number.isSafeInteger(price) || price < 100) throw new DomainError("invalid_offer", "Цена — от 1 ₽");
  if (price >= listPrice) {
    throw new DomainError("invalid_offer", "Предложение должно быть ниже цены продавца — или просто купите лот");
  }
}
