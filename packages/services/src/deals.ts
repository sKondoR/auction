import { type DbOrTx, deals, ledgerEntries, lots, reviews, user } from "@auction/db";
import {
  DEAL_STATUS_LABELS,
  type DealAction,
  type DealRole,
  type ReviewRating,
  canReview,
  commissionFor,
  formatRub,
  maskContacts,
  nextDealStatus,
  shouldBanForPenalties,
} from "@auction/domain";
import { getSetting } from "@auction/db";
import { and, eq } from "drizzle-orm";
import { fail, forbidden, notFound } from "./errors";
import { getOrCreateConversation, postMessage } from "./messaging";
import { notify } from "./notify";
import { logModeration, reviewCounts } from "./users";

export type DealRow = typeof deals.$inferSelect;
export type DealSource = DealRow["source"];

/**
 * Создание сделки при продаже: сделка, начисление комиссии в книгу продавца,
 * карточка сделки в беседе и уведомления сторонам. Вызывается внутри транзакции,
 * в которой заблокирована строка лота.
 */
export async function createDeal(
  tx: DbOrTx,
  p: {
    lot: { id: number; sellerId: string; title: string };
    buyerId: string;
    unitPrice: number;
    quantity: number;
    source: DealSource;
    offerId?: number;
  },
): Promise<{ deal: DealRow; notified: string[] }> {
  const total = p.unitPrice * p.quantity;
  const conversation = await getOrCreateConversation(tx, { buyerId: p.buyerId, sellerId: p.lot.sellerId });
  const [deal] = await tx
    .insert(deals)
    .values({
      lotId: p.lot.id,
      sellerId: p.lot.sellerId,
      buyerId: p.buyerId,
      quantity: p.quantity,
      unitPrice: p.unitPrice,
      totalPrice: total,
      source: p.source,
      offerId: p.offerId ?? null,
      conversationId: conversation.id,
    })
    .returning();

  const bps = await getSetting(tx, "commissionBps");
  const commission = commissionFor(p.unitPrice, p.quantity, bps);
  if (commission > 0) {
    await tx.insert(ledgerEntries).values({
      sellerId: p.lot.sellerId,
      dealId: deal!.id,
      kind: "charge",
      amount: commission,
      description: `Комиссия ${bps / 100}% по сделке №${deal!.id} («${p.lot.title}», ${formatRub(total)})`,
    });
  }

  const qtyText = p.quantity > 1 ? ` × ${p.quantity} шт.` : "";
  await postMessage(tx, {
    conversationId: conversation.id,
    senderId: p.lot.sellerId,
    lotId: p.lot.id,
    dealId: deal!.id,
    isSystem: true,
    text: `Сделка №${deal!.id}: «${p.lot.title}»${qtyText} — ${formatRub(total)}. Договоритесь об оплате и доставке в этой беседе: 3 дня на связь, 7 дней на оплату.`,
  });

  const link = `/deals/${deal!.id}`;
  const notified = await notify(tx, [
    {
      userId: p.buyerId,
      type: "auction_won",
      title: p.source === "auction" ? `Вы выиграли торги: «${p.lot.title}»` : `Вы купили «${p.lot.title}»`,
      body: `Сумма: ${formatRub(total)}. Свяжитесь с продавцом в течение 3 дней.`,
      link,
    },
    {
      userId: p.lot.sellerId,
      type: "lot_sold",
      title: `Лот «${p.lot.title}» продан`,
      body: `Сумма: ${formatRub(total)}${qtyText}. Комиссия площадки: ${formatRub(commission)}.`,
      link,
    },
  ]);
  return { deal: deal!, notified };
}

export function dealRole(deal: DealRow, userId: string): DealRole | null {
  if (deal.sellerId === userId) return "seller";
  if (deal.buyerId === userId) return "buyer";
  return null;
}

/** Действие стороны по сделке (смена статуса). */
export async function applyDealAction(
  db: DbOrTx,
  p: { dealId: number; userId: string; action: DealAction; now?: Date },
): Promise<{ notified: string[] }> {
  const now = p.now ?? new Date();
  const [deal] = await db.select().from(deals).where(eq(deals.id, p.dealId)).for("update");
  if (!deal) return notFound("Сделка");
  const role = dealRole(deal, p.userId) ?? forbidden("Вы не участник сделки");
  const to = nextDealStatus(deal, p.action, role, now);

  const patch: Partial<DealRow> = { status: to };
  if (to === "paid") patch.paidAt = now;
  if (to === "shipped") patch.shippedAt = now;
  if (to === "received") patch.receivedAt = now;
  if (to === "not_paid" || to === "not_received") patch.closedAt = now;
  await db.update(deals).set(patch).where(eq(deals.id, deal.id));

  const [lot] = await db.select({ title: lots.title }).from(lots).where(eq(lots.id, deal.lotId));
  if (deal.conversationId) {
    await postMessage(db, {
      conversationId: deal.conversationId,
      senderId: p.userId,
      dealId: deal.id,
      lotId: deal.lotId,
      isSystem: true,
      text: `Сделка №${deal.id}: статус «${DEAL_STATUS_LABELS[to]}».`,
    });
  }

  if (to === "not_paid") await handleNotPaid(db, deal, lot?.title ?? "");
  if (to === "not_received") {
    // Зеркально неоплате: отметка влияет на рейтинг продавца.
    await db
      .insert(reviews)
      .values({
        dealId: deal.id,
        authorId: null,
        targetId: deal.sellerId,
        targetRole: "seller",
        rating: "negative",
        text: `Покупатель отметил, что товар по сделке №${deal.id} не получен.`,
        isPenalty: true,
      })
      .onConflictDoNothing();
  }

  const otherId = role === "seller" ? deal.buyerId : deal.sellerId;
  const notified = await notify(db, {
    userId: otherId,
    type: "deal_status",
    title: `Сделка №${deal.id} «${lot?.title ?? ""}»: ${DEAL_STATUS_LABELS[to]}`,
    link: `/deals/${deal.id}`,
  });
  return { notified };
}

/**
 * «Покупатель не оплатил»: штрафной отзыв покупателю, сторно комиссии,
 * при накоплении штрафов — блокировка.
 */
async function handleNotPaid(db: DbOrTx, deal: DealRow, title: string): Promise<void> {
  const [charge] = await db
    .select()
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.dealId, deal.id), eq(ledgerEntries.kind, "charge")));
  if (charge) {
    await db
      .insert(ledgerEntries)
      .values({
        sellerId: deal.sellerId,
        dealId: deal.id,
        kind: "reversal",
        amount: -charge.amount,
        description: `Сторно комиссии по сделке №${deal.id}: покупатель не оплатил`,
      })
      .onConflictDoNothing();
  }
  await db
    .insert(reviews)
    .values({
      dealId: deal.id,
      authorId: null,
      targetId: deal.buyerId,
      targetRole: "buyer",
      rating: "negative",
      text: `Штрафной отзыв: покупатель не оплатил лот «${title}».`,
      isPenalty: true,
    })
    .onConflictDoNothing();

  const counts = await reviewCounts(db, deal.buyerId);
  const threshold = await getSetting(db, "penaltyBanThreshold");
  if (shouldBanForPenalties(counts.penalties, threshold)) {
    await db
      .update(user)
      .set({ banned: true, banReason: `Накоплено штрафных отзывов: ${counts.penalties}` })
      .where(eq(user.id, deal.buyerId));
    await logModeration(db, {
      userId: deal.buyerId,
      kind: "auto_ban",
      reason: `Автоматическая блокировка: ${counts.penalties} штрафных отзыва(ов)`,
    });
  }
}

export async function leaveReview(
  db: DbOrTx,
  p: { dealId: number; authorId: string; rating: ReviewRating; text: string },
): Promise<{ notified: string[] }> {
  const [deal] = await db.select().from(deals).where(eq(deals.id, p.dealId));
  if (!deal) return notFound("Сделка");
  const role = dealRole(deal, p.authorId) ?? forbidden("Вы не участник сделки");
  if (!canReview(deal.status)) fail("too_early", "Отзыв можно оставить после получения товара");
  const targetId = role === "seller" ? deal.buyerId : deal.sellerId;
  const [existing] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.dealId, deal.id), eq(reviews.targetId, targetId)));
  if (existing) fail("already_reviewed", "Отзыв по этой сделке уже оставлен");

  await db.insert(reviews).values({
    dealId: deal.id,
    authorId: p.authorId,
    targetId,
    targetRole: role === "seller" ? "buyer" : "seller",
    rating: p.rating,
    text: maskContacts(p.text.trim()).slice(0, 2000),
  });

  // Обе стороны оставили отзывы — сделка завершена.
  const both = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.dealId, deal.id));
  if (both.length >= 2 && deal.status === "received") {
    await db.update(deals).set({ status: "completed", closedAt: new Date() }).where(eq(deals.id, deal.id));
  }
  const notified = await notify(db, {
    userId: targetId,
    type: "review_received",
    title: `Новый отзыв по сделке №${deal.id}`,
    body: p.text.slice(0, 200),
    link: `/users/${targetId}#reviews`,
  });
  return { notified };
}
