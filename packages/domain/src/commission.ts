import { DAY_MS } from "./lot-format";
import type { Kopecks } from "./money";

/** Комиссия в базисных пунктах: 100 bps = 1%. */
export const DEFAULT_COMMISSION_BPS = 100;
/** Минимальная сумма счёта; меньшая сумма переносится на следующий месяц. */
export const MIN_INVOICE_AMOUNT: Kopecks = 100_00;
export const INVOICE_DUE_DAYS = 10;

/** Комиссия с цены сделки (цена × количество), округление до копейки. */
export function commissionFor(unitPrice: Kopecks, quantity: number, bps = DEFAULT_COMMISSION_BPS): Kopecks {
  return Math.round((unitPrice * quantity * bps) / 10_000);
}

export type LedgerKind = "charge" | "reversal";

export interface LedgerEntry {
  id: number;
  kind: LedgerKind;
  /** Положительная для начисления, отрицательная для сторно. */
  amount: Kopecks;
  createdAt: Date;
  invoiceId: number | null;
}

/** Первый день месяца (UTC+3 для РФ упрощённо не учитываем — границы в UTC). */
export function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function previousMonthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
}

export interface InvoiceDraft {
  amount: Kopecks;
  entryIds: number[];
  periodStart: Date;
  dueAt: Date;
}

/**
 * Счёт 1-го числа за прошлый месяц: суммируются все не выставленные ранее
 * записи книги начислений до начала текущего месяца (включая перенесённые
 * остатки прошлых месяцев). Если сумма меньше порога — счёт не выставляется,
 * записи переносятся.
 */
export function draftInvoice(
  entries: readonly LedgerEntry[],
  issueDate: Date,
  minAmount: Kopecks = MIN_INVOICE_AMOUNT,
): InvoiceDraft | null {
  const cutoff = monthStart(issueDate);
  const pending = entries.filter((e) => e.invoiceId === null && e.createdAt < cutoff);
  const amount = pending.reduce((sum, e) => sum + e.amount, 0);
  if (amount < minAmount) return null;
  return {
    amount,
    entryIds: pending.map((e) => e.id),
    periodStart: previousMonthStart(issueDate),
    dueAt: new Date(issueDate.getTime() + INVOICE_DUE_DAYS * DAY_MS),
  };
}

export const INVOICE_STATUSES = ["issued", "paid", "overdue", "cancelled"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  issued: "Выставлен",
  paid: "Оплачен",
  overdue: "Просрочен",
  cancelled: "Аннулирован",
};

export const isInvoiceOverdue = (inv: { status: InvoiceStatus; dueAt: Date }, now: Date): boolean =>
  (inv.status === "issued" || inv.status === "overdue") && now > inv.dueAt;
