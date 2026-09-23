import { type Db, type DbOrTx, bids, getSetting, getSettings, lots, offers, user } from "@auction/db";
import {
  type BidPlacement,
  type EnglishState,
  applyBid,
  assertCanBuy,
  assertNewbieCanBid,
  extendEndIfSniping,
  formatRub,
  initialEnglishState,
  isBlitzAvailable,
  isOpen,
  maskContacts,
  minNextBid,
  validateOffer,
} from "@auction/domain";
import { and, asc, count, desc, eq, isNull, ne } from "drizzle-orm";
import { createDeal } from "./deals";
import { fail, forbidden, notFound } from "./errors";
import { type LotEvent, publishLotEvent } from "./infra/redis";
import { flushUserEvents, notify } from "./notify";
import { activeBidLotCount, assertCanTrade, getUser, reviewCounts } from "./users";

export type LotRow = typeof lots.$inferSelect;

export async function lockLot(tx: DbOrTx, lotId: number): Promise<LotRow> {
  const [lot] = await tx.select().from(lots).where(eq(lots.id, lotId)).for("update");
  return lot ?? notFound("Лот");
}

export const englishState = (lot: LotRow): EnglishState => ({
  startPrice: lot.startPrice,
  currentPrice: lot.currentPrice,
  leaderId: lot.leaderId,
  leaderMax: lot.leaderMax,
});

export function lotEvent(lot: LotRow, type: LotEvent["type"]): LotEvent {
  return {
    type,
    lotId: lot.id,
    currentPrice: lot.currentPrice,
    bidCount: lot.bidCount,
    endsAt: lot.endsAt.toISOString(),
    leaderId: lot.leaderId,
    status: lot.status,
    quantitySold: lot.quantitySold,
  };
}

function assertOpen(lot: LotRow, now: Date): void {
  if (lot.status === "active" && now < lot.startsAt) fail("not_started", "Торги ещё не начались");
  if (!isOpen(lot, now)) fail("lot_closed", "Торги по лоту завершены");
}

/* ---------------- Английский аукцион ---------------- */

export interface PlaceBidResult {
  leading: boolean;
  currentPrice: number;
  minNext: number;
  endsAt: Date;
}

export async function placeBid(
  db: Db,
  p: { lotId: number; bidderId: string; amount: number; maxAmount?: number | null; now?: Date },
): Promise<PlaceBidResult> {
  const now = p.now ?? new Date();
  let notified: string[] = [];
  let lotAfter: LotRow | undefined;

  const result = await db.transaction(async (tx) => {
    const bidder = await getUser(tx, p.bidderId);
    assertCanTrade(bidder);
    const lot = await lockLot(tx, p.lotId);
    if (lot.format !== "english") fail("wrong_format", "Ставки принимаются только на аукционе");
    assertOpen(lot, now);
    if (lot.sellerId === p.bidderId) fail("own_lot", "Нельзя делать ставки на свой лот");

    const settings = await getSettings(tx);
    const [mine] = await tx
      .select({ n: count() })
      .from(bids)
      .where(and(eq(bids.lotId, lot.id), eq(bids.bidderId, p.bidderId), isNull(bids.cancelledAt)));
    const rc = await reviewCounts(tx, p.bidderId);
    assertNewbieCanBid({
      reviewsReceived: rc.positive + rc.neutral + rc.negative,
      activeBidLots: await activeBidLotCount(tx, p.bidderId),
      alreadyBidsOnThisLot: Number(mine?.n) > 0,
      limits: settings.newbieLimits,
    });

    const placement: BidPlacement = { bidderId: p.bidderId, amount: p.amount, maxAmount: p.maxAmount ?? null };
    const outcome = applyBid(englishState(lot), placement, settings.bidSteps);

    if (outcome.records.length) {
      await tx.insert(bids).values(
        outcome.records.map((r) => ({
          lotId: lot.id,
          bidderId: r.bidderId,
          amount: r.amount,
          isAuto: r.isAuto,
          maxAmount: r.isAuto ? null : Math.max(p.amount, p.maxAmount ?? p.amount),
          requestedAmount: r.isAuto ? null : p.amount,
          createdAt: now,
        })),
      );
    }
    if (!outcome.records.length) {
      // Лидер поднял максимум: сохраняем его в последней заявке (нужно для пересчёта после отмены ставок).
      const [last] = await tx
        .select({ id: bids.id })
        .from(bids)
        .where(and(eq(bids.lotId, lot.id), eq(bids.bidderId, p.bidderId), eq(bids.isAuto, false), isNull(bids.cancelledAt)))
        .orderBy(desc(bids.createdAt), desc(bids.id))
        .limit(1);
      if (last) await tx.update(bids).set({ maxAmount: outcome.state.leaderMax }).where(eq(bids.id, last.id));
    }
    const endsAt = outcome.records.length ? extendEndIfSniping(lot.endsAt, now) : lot.endsAt;
    const [updated] = await tx
      .update(lots)
      .set({
        currentPrice: outcome.state.currentPrice,
        leaderId: outcome.state.leaderId,
        leaderMax: outcome.state.leaderMax,
        bidCount: lot.bidCount + outcome.records.length,
        endsAt,
      })
      .where(eq(lots.id, lot.id))
      .returning();
    lotAfter = updated;

    if (outcome.outbidUserId && outcome.outbidUserId !== p.bidderId) {
      notified = await notify(tx, {
        userId: outcome.outbidUserId,
        type: "outbid",
        title: `Вашу ставку перебили: «${lot.title}»`,
        body: `Текущая цена — ${formatRub(outcome.state.currentPrice!)}.`,
        link: `/lots/${lot.id}`,
      });
    }
    return {
      leading: outcome.state.leaderId === p.bidderId,
      currentPrice: outcome.state.currentPrice!,
      minNext: minNextBid(outcome.state, settings.bidSteps),
      endsAt,
    };
  });

  if (lotAfter) await publishLotEvent(lotEvent(lotAfter, "bid"));
  await flushUserEvents(notified);
  return result;
}

/** Покупка по блиц-цене. */
export async function buyBlitz(db: Db, p: { lotId: number; buyerId: string; now?: Date }): Promise<number> {
  const now = p.now ?? new Date();
  let notified: string[] = [];
  let lotAfter: LotRow | undefined;
  const dealId = await db.transaction(async (tx) => {
    const buyer = await getUser(tx, p.buyerId);
    assertCanTrade(buyer);
    const lot = await lockLot(tx, p.lotId);
    if (lot.format !== "english") fail("wrong_format", "Блиц-цена есть только у аукциона");
    assertOpen(lot, now);
    if (lot.sellerId === p.buyerId) fail("own_lot", "Нельзя купить свой лот");
    if (!isBlitzAvailable(lot.blitzPrice, lot.currentPrice)) fail("no_blitz", "Блиц-цена недоступна");
    const price = lot.blitzPrice!;

    const prevLeader = lot.leaderId;
    await tx.insert(bids).values({ lotId: lot.id, bidderId: p.buyerId, amount: price, requestedAmount: price, maxAmount: price, createdAt: now });
    const [updated] = await tx
      .update(lots)
      .set({
        status: "sold",
        currentPrice: price,
        leaderId: p.buyerId,
        leaderMax: price,
        bidCount: lot.bidCount + 1,
        quantitySold: 1,
        endsAt: now,
        finalizedAt: now,
      })
      .where(eq(lots.id, lot.id))
      .returning();
    lotAfter = updated;
    const { deal, notified: n } = await createDeal(tx, {
      lot,
      buyerId: p.buyerId,
      unitPrice: price,
      quantity: 1,
      source: "blitz",
    });
    notified = n;
    if (prevLeader && prevLeader !== p.buyerId) {
      notified.push(
        ...(await notify(tx, {
          userId: prevLeader,
          type: "outbid",
          title: `Лот «${lot.title}» выкуплен по блиц-цене`,
          link: `/lots/${lot.id}`,
        })),
      );
    }
    return deal.id;
  });
  if (lotAfter) await publishLotEvent(lotEvent(lotAfter, "ended"));
  await flushUserEvents(notified);
  return dealId;
}

/**
 * Продавец отменяет ставки участника с указанием причины: ставки помечаются
 * отменёнными, торги пересчитываются по оставшимся заявкам.
 */
export async function cancelBids(
  db: Db,
  p: { lotId: number; sellerId: string; bidderId: string; reason: string; now?: Date },
): Promise<void> {
  const now = p.now ?? new Date();
  const reason = p.reason.trim();
  if (reason.length < 3) fail("reason_required", "Укажите причину отмены");
  let notified: string[] = [];
  let lotAfter: LotRow | undefined;
  await db.transaction(async (tx) => {
    const lot = await lockLot(tx, p.lotId);
    if (lot.sellerId !== p.sellerId) forbidden("Отменять ставки может только продавец");
    if (lot.format !== "english") fail("wrong_format", "Не аукцион");
    assertOpen(lot, now);

    const active = await tx
      .select()
      .from(bids)
      .where(and(eq(bids.lotId, lot.id), isNull(bids.cancelledAt)))
      .orderBy(asc(bids.createdAt), asc(bids.id));
    if (!active.some((b) => b.bidderId === p.bidderId)) fail("no_bids", "У участника нет действующих ставок");

    await tx
      .update(bids)
      .set({ cancelledAt: now, cancelReason: reason })
      .where(and(eq(bids.lotId, lot.id), eq(bids.bidderId, p.bidderId), isNull(bids.cancelledAt)));
    // Остальные записи пересоздаются пересчётом.
    await tx.delete(bids).where(and(eq(bids.lotId, lot.id), isNull(bids.cancelledAt), ne(bids.bidderId, p.bidderId)));

    const settings = await getSettings(tx);
    let state = initialEnglishState(lot.startPrice);
    let total = 0;
    for (const b of active) {
      if (b.isAuto || b.bidderId === p.bidderId) continue;
      try {
        const out = applyBid(
          state,
          { bidderId: b.bidderId, amount: b.requestedAmount ?? b.amount, maxAmount: b.maxAmount },
          settings.bidSteps,
        );
        state = out.state;
        if (out.records.length) {
          await tx.insert(bids).values(
            out.records.map((r) => ({
              lotId: lot.id,
              bidderId: r.bidderId,
              amount: r.amount,
              isAuto: r.isAuto,
              maxAmount: r.isAuto ? null : b.maxAmount,
              requestedAmount: r.isAuto ? null : b.requestedAmount,
              createdAt: b.createdAt,
            })),
          );
          total += out.records.length;
        }
      } catch {
        // заявка стала некорректной после отмены — пропускаем
      }
    }
    const [updated] = await tx
      .update(lots)
      .set({ currentPrice: state.currentPrice, leaderId: state.leaderId, leaderMax: state.leaderMax, bidCount: total })
      .where(eq(lots.id, lot.id))
      .returning();
    lotAfter = updated;
    notified = await notify(tx, {
      userId: p.bidderId,
      type: "bid_cancelled",
      title: `Продавец отменил вашу ставку: «${lot.title}»`,
      body: `Причина: ${maskContacts(reason)}`,
      link: `/lots/${lot.id}`,
    });
  });
  if (lotAfter) await publishLotEvent(lotEvent(lotAfter, "updated"));
  await flushUserEvents(notified);
}

/* ---------------- Фиксированная цена ---------------- */

export async function buyFixed(db: Db, p: { lotId: number; buyerId: string; quantity: number; now?: Date }): Promise<number> {
  const now = p.now ?? new Date();
  let notified: string[] = [];
  let lotAfter: LotRow | undefined;
  const dealId = await db.transaction(async (tx) => {
    const buyer = await getUser(tx, p.buyerId);
    assertCanTrade(buyer);
    const lot = await lockLot(tx, p.lotId);
    if (lot.format !== "fixed") fail("wrong_format", "Лот продаётся не по фиксированной цене");
    assertOpen(lot, now);
    if (lot.sellerId === p.buyerId) fail("own_lot", "Нельзя купить свой лот");
    assertCanBuy(lot, p.quantity);

    const sold = lot.quantitySold + p.quantity;
    const [updated] = await tx
      .update(lots)
      .set({
        quantitySold: sold,
        ...(sold >= lot.quantity ? { status: "sold" as const, finalizedAt: now } : {}),
      })
      .where(eq(lots.id, lot.id))
      .returning();
    lotAfter = updated;
    const { deal, notified: n } = await createDeal(tx, {
      lot,
      buyerId: p.buyerId,
      unitPrice: lot.startPrice,
      quantity: p.quantity,
      source: "fixed",
    });
    notified = n;
    if (sold >= lot.quantity) {
      await tx
        .update(offers)
        .set({ status: "cancelled", respondedAt: now })
        .where(and(eq(offers.lotId, lot.id), eq(offers.status, "pending")));
    }
    return deal.id;
  });
  if (lotAfter) await publishLotEvent(lotEvent(lotAfter, lotAfter.status === "sold" ? "ended" : "updated"));
  await flushUserEvents(notified);
  return dealId;
}

/** «Предложить свою цену». */
export async function makeOffer(
  db: Db,
  p: { lotId: number; buyerId: string; price: number; quantity: number; message?: string; now?: Date },
): Promise<void> {
  const now = p.now ?? new Date();
  let notified: string[] = [];
  await db.transaction(async (tx) => {
    const buyer = await getUser(tx, p.buyerId);
    assertCanTrade(buyer);
    const lot = await lockLot(tx, p.lotId);
    if (lot.format !== "fixed" || !lot.allowOffers) fail("offers_disabled", "Продавец не принимает предложения цены");
    assertOpen(lot, now);
    if (lot.sellerId === p.buyerId) fail("own_lot", "Это ваш лот");
    validateOffer({ price: p.price, listPrice: lot.startPrice, qty: p.quantity, stock: lot });

    // Новое предложение заменяет прежнее ожидающее.
    await tx
      .update(offers)
      .set({ status: "cancelled", respondedAt: now })
      .where(and(eq(offers.lotId, lot.id), eq(offers.buyerId, p.buyerId), eq(offers.status, "pending")));
    await tx.insert(offers).values({
      lotId: lot.id,
      buyerId: p.buyerId,
      price: p.price,
      quantity: p.quantity,
      message: p.message ? maskContacts(p.message).slice(0, 500) : null,
    });
    notified = await notify(tx, {
      userId: lot.sellerId,
      type: "offer_received",
      title: `Предложение цены по лоту «${lot.title}»`,
      body: `${buyer.name} предлагает ${formatRub(p.price)}${p.quantity > 1 ? ` × ${p.quantity} шт.` : ""}.`,
      link: `/cabinet/offers`,
    });
  });
  await flushUserEvents(notified);
}

export async function respondOffer(
  db: Db,
  p: { offerId: number; sellerId: string; accept: boolean; now?: Date },
): Promise<number | null> {
  const now = p.now ?? new Date();
  let notified: string[] = [];
  let lotAfter: LotRow | undefined;
  const dealId = await db.transaction(async (tx) => {
    const [offer] = await tx.select().from(offers).where(eq(offers.id, p.offerId)).for("update");
    if (!offer) return notFound("Предложение");
    const lot = await lockLot(tx, offer.lotId);
    if (lot.sellerId !== p.sellerId) forbidden();
    if (offer.status !== "pending") fail("offer_closed", "Предложение уже рассмотрено");

    if (!p.accept) {
      await tx.update(offers).set({ status: "rejected", respondedAt: now }).where(eq(offers.id, offer.id));
      notified = await notify(tx, {
        userId: offer.buyerId,
        type: "offer_answered",
        title: `Продавец отклонил ваше предложение по лоту «${lot.title}»`,
        link: `/lots/${lot.id}`,
      });
      return null;
    }

    assertOpen(lot, now);
    assertCanBuy(lot, offer.quantity);
    const [buyer] = await tx.select().from(user).where(eq(user.id, offer.buyerId));
    if (!buyer || buyer.deletedAt || buyer.banned) fail("buyer_unavailable", "Покупатель больше не может совершить покупку");

    const sold = lot.quantitySold + offer.quantity;
    const [updated] = await tx
      .update(lots)
      .set({ quantitySold: sold, ...(sold >= lot.quantity ? { status: "sold" as const, finalizedAt: now } : {}) })
      .where(eq(lots.id, lot.id))
      .returning();
    lotAfter = updated;
    await tx.update(offers).set({ status: "accepted", respondedAt: now }).where(eq(offers.id, offer.id));
    const { deal, notified: n } = await createDeal(tx, {
      lot,
      buyerId: offer.buyerId,
      unitPrice: offer.price,
      quantity: offer.quantity,
      source: "offer",
      offerId: offer.id,
    });
    notified = n;
    return deal.id;
  });
  if (lotAfter) await publishLotEvent(lotEvent(lotAfter, lotAfter.status === "sold" ? "ended" : "updated"));
  await flushUserEvents(notified);
  return dealId;
}

export async function bidSteps(db: DbOrTx) {
  return getSetting(db, "bidSteps");
}
