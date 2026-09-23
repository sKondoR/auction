import { type Db, lots, offers } from "@auction/db";
import { DAY_MS, FIXED_EXPIRY_REMINDER_DAYS, formatRub, needsFinalization, shouldAutoRelist } from "@auction/domain";
import { and, asc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { createDeal } from "./deals";
import { publishLotEvent } from "./infra/redis";
import { relistLot } from "./lots";
import { flushUserEvents, notify } from "./notify";
import { type LotRow, lockLot, lotEvent } from "./trading";

/**
 * Финализация завершившихся по времени торгов. Идемпотентна: повторный вызов
 * для уже финализированного лота ничего не делает (ADR 0003).
 */
export async function finalizeLot(db: Db, lotId: number, now = new Date()): Promise<"sold" | "unsold" | "skipped"> {
  let notified: string[] = [];
  let lotAfter: LotRow | undefined;
  let relistedId: number | null = null;

  const outcome = await db.transaction(async (tx) => {
    const lot = await lockLot(tx, lotId);
    if (lot.finalizedAt || !needsFinalization(lot, now)) return "skipped" as const;

    await tx
      .update(offers)
      .set({ status: "cancelled", respondedAt: now })
      .where(and(eq(offers.lotId, lot.id), eq(offers.status, "pending")));

    // Английский аукцион со ставками — сделка с лидером.
    if (lot.format === "english" && lot.leaderId && lot.currentPrice !== null) {
      const [u] = await tx
        .update(lots)
        .set({ status: "sold", quantitySold: 1, finalizedAt: now })
        .where(eq(lots.id, lot.id))
        .returning();
      lotAfter = u;
      const res = await createDeal(tx, {
        lot,
        buyerId: lot.leaderId,
        unitPrice: lot.currentPrice,
        quantity: 1,
        source: "auction",
      });
      notified = res.notified;
      return "sold" as const;
    }

    // Фиксированная цена, проданная частично, считается завершённой с продажей.
    const status = lot.quantitySold > 0 ? ("sold" as const) : ("unsold" as const);
    const [u] = await tx.update(lots).set({ status, finalizedAt: now }).where(eq(lots.id, lot.id)).returning();
    lotAfter = u;

    const remaining = lot.quantity - lot.quantitySold;
    if (remaining > 0 && shouldAutoRelist(lot)) {
      relistedId = await relistLot(tx, { lotId: lot.id, sellerId: lot.sellerId, auto: true, now });
      notified = await notify(tx, {
        userId: lot.sellerId,
        type: "lot_unsold",
        title: `Лот «${lot.title}» перевыставлен автоматически`,
        body: `Перевыставление ${lot.autoRelistCount + 1} из 3.`,
        link: `/lots/${relistedId}`,
      });
    } else {
      notified = await notify(tx, {
        userId: lot.sellerId,
        type: "lot_unsold",
        title:
          lot.format === "fixed"
            ? `Срок размещения лота «${lot.title}» истёк`
            : `Торги по лоту «${lot.title}» завершились без ставок`,
        body:
          lot.quantitySold > 0
            ? `Продано ${lot.quantitySold} из ${lot.quantity}. Остаток можно перевыставить одной кнопкой.`
            : "Лот можно перевыставить одной кнопкой, в том числе в другом формате.",
        link: `/cabinet/lots?tab=unsold`,
      });
    }
    return status;
  });

  if (lotAfter) await publishLotEvent(lotEvent(lotAfter, "ended"));
  await flushUserEvents(notified);
  return outcome;
}

/** «Подметание»: финализирует все завершившиеся, но не финализированные лоты. */
export async function sweepEndedLots(db: Db, now = new Date(), limit = 200): Promise<number> {
  const due = await db
    .select({ id: lots.id })
    .from(lots)
    .where(and(inArray(lots.status, ["active", "scheduled"]), lte(lots.endsAt, now), isNull(lots.finalizedAt)))
    .orderBy(asc(lots.endsAt))
    .limit(limit);
  let n = 0;
  for (const { id } of due) {
    try {
      if ((await finalizeLot(db, id, now)) !== "skipped") n++;
    } catch (e) {
      console.error(`[finalize] lot ${id}`, e);
    }
  }
  return n;
}

/** Ближайшие окончания — для точных отложенных задач финализации. */
export async function lotsEndingBefore(db: Db, until: Date): Promise<{ id: number; endsAt: Date }[]> {
  return db
    .select({ id: lots.id, endsAt: lots.endsAt })
    .from(lots)
    .where(and(eq(lots.status, "active"), lte(lots.endsAt, until), isNull(lots.finalizedAt)));
}

/** Напоминание продавцу за 3 дня до окончания размещения по фиксированной цене. */
export async function sendExpiryReminders(db: Db, now = new Date()): Promise<number> {
  const horizon = new Date(now.getTime() + FIXED_EXPIRY_REMINDER_DAYS * DAY_MS);
  const due = await db
    .select()
    .from(lots)
    .where(
      and(
        eq(lots.status, "active"),
        eq(lots.format, "fixed"),
        isNull(lots.expiryReminderSentAt),
        lte(lots.endsAt, horizon),
        sql`${lots.endsAt} > ${now}`,
      ),
    )
    .limit(500);
  for (const lot of due) {
    const ids = await db.transaction(async (tx) => {
      await tx.update(lots).set({ expiryReminderSentAt: now }).where(eq(lots.id, lot.id));
      return notify(tx, {
        userId: lot.sellerId,
        type: "listing_expiring",
        title: `Скоро истекает размещение лота «${lot.title}»`,
        body: `Размещение закончится ${lot.endsAt.toLocaleDateString("ru-RU")}. Цена: ${formatRub(lot.startPrice)}. После окончания лот можно перевыставить.`,
        link: `/cabinet/lots?tab=expiring`,
      });
    });
    await flushUserEvents(ids);
  }
  return due.length;
}
