import { type Db, type DbOrTx, getSettings, invoices, ledgerEntries, user } from "@auction/db";
import { type LedgerEntry, draftInvoice, formatRub, monthStart } from "@auction/domain";
import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { fail, notFound } from "./errors";
import { flushUserEvents, notify } from "./notify";

const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
export const periodLabel = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

/**
 * Выставление счетов 1-го числа за прошлый месяц. Идемпотентно: счёт за период
 * у продавца уникален, записи книги привязываются к счёту.
 */
export async function issueMonthlyInvoices(db: Db, now = new Date()): Promise<number> {
  const cutoff = monthStart(now);
  const settings = await getSettings(db);
  const sellers = await db
    .selectDistinct({ sellerId: ledgerEntries.sellerId })
    .from(ledgerEntries)
    .where(and(isNull(ledgerEntries.invoiceId), lt(ledgerEntries.createdAt, cutoff)));

  let issued = 0;
  for (const { sellerId } of sellers) {
    const ids = await db.transaction(async (tx) => {
      const entries = await tx
        .select()
        .from(ledgerEntries)
        .where(and(eq(ledgerEntries.sellerId, sellerId), isNull(ledgerEntries.invoiceId)))
        .for("update");
      const draft = draftInvoice(entries as LedgerEntry[], now, settings.minInvoiceAmount);
      if (!draft) return [];
      const [inv] = await tx
        .insert(invoices)
        .values({ sellerId, periodStart: draft.periodStart, amount: draft.amount, dueAt: draft.dueAt, issuedAt: now })
        .onConflictDoNothing()
        .returning();
      if (!inv) return [];
      await tx.update(ledgerEntries).set({ invoiceId: inv.id }).where(inArray(ledgerEntries.id, draft.entryIds));
      issued++;
      return notify(tx, {
        userId: sellerId,
        type: "invoice_issued",
        title: `Выставлен счёт №${inv.id} за ${periodLabel(draft.periodStart)}`,
        body: `Сумма комиссии: ${formatRub(draft.amount)}. Оплатите до ${draft.dueAt.toLocaleDateString("ru-RU")}.`,
        link: `/cabinet/invoices`,
      });
    });
    await flushUserEvents(ids);
  }
  return issued;
}

/**
 * Просрочка: счёт не оплачен за 10 дней — продавцу блокируется выставление
 * новых лотов (активные торги доживают до конца).
 */
export async function markOverdueInvoices(db: Db, now = new Date()): Promise<number> {
  const due = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.status, "issued"), lt(invoices.dueAt, now)));
  for (const inv of due) {
    const ids = await db.transaction(async (tx) => {
      await tx.update(invoices).set({ status: "overdue" }).where(eq(invoices.id, inv.id));
      await tx.update(user).set({ listingBlocked: true }).where(eq(user.id, inv.sellerId));
      return notify(tx, {
        userId: inv.sellerId,
        type: "invoice_overdue",
        title: `Счёт №${inv.id} просрочен`,
        body: `Выставление новых лотов заблокировано до оплаты ${formatRub(inv.amount)}. Активные торги продолжаются.`,
        link: `/cabinet/invoices`,
      });
    });
    await flushUserEvents(ids);
  }
  return due.length;
}

/** Администратор отмечает оплату вручную (до подключения эквайринга). */
export async function markInvoicePaid(db: Db, invoiceId: number, adminId: string, now = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    const [inv] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).for("update");
    if (!inv) return notFound("Счёт");
    if (inv.status === "paid") fail("already_paid", "Счёт уже оплачен");
    await tx.update(invoices).set({ status: "paid", paidAt: now, markedPaidBy: adminId }).where(eq(invoices.id, inv.id));
    await refreshListingBlock(tx, inv.sellerId);
  });
}

/** Снимает блокировку выставления, если просроченных счетов не осталось. */
export async function refreshListingBlock(db: DbOrTx, sellerId: string): Promise<void> {
  const [r] = await db
    .select({ n: sql<number>`count(*)` })
    .from(invoices)
    .where(and(eq(invoices.sellerId, sellerId), eq(invoices.status, "overdue")));
  await db.update(user).set({ listingBlocked: Number(r?.n) > 0 }).where(eq(user.id, sellerId));
}

/** Баланс книги начислений, ещё не попавший в счета. */
export async function unbilledBalance(db: DbOrTx, sellerId: string): Promise<number> {
  const [r] = await db
    .select({ s: sql<string>`coalesce(sum(${ledgerEntries.amount}), 0)` })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.sellerId, sellerId), isNull(ledgerEntries.invoiceId)));
  return Number(r?.s ?? 0);
}
