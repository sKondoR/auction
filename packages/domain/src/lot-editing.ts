import { DomainError } from "./money";

/** Изменяемые части лота. */
export type LotEditableField =
  | "title"
  | "description"
  | "category"
  | "photos"
  | "delivery"
  | "city"
  | "price"
  | "duration"
  | "quantity"
  | "blitzDecrease"
  | "blitzOther";

/**
 * До первой ставки лот редактируется свободно (кроме формата — для смены формата
 * лот перевыставляется). После первой ставки описание можно только дополнять,
 * цену и срок менять нельзя, кроме снижения блиц-цены.
 */
export function canEditField(field: LotEditableField, hasBids: boolean): boolean {
  if (!hasBids) return true;
  return field === "blitzDecrease" || field === "photos" || field === "delivery";
}

export function assertCanEdit(field: LotEditableField, hasBids: boolean): void {
  if (!canEditField(field, hasBids)) {
    throw new DomainError(
      "lot_locked",
      "После первой ставки это поле менять нельзя; описание можно только дополнить",
    );
  }
}
