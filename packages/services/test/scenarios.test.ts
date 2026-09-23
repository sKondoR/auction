import { type Db, bids, deals, invoices, ledgerEntries, lots, notifications, reviews, user } from "@auction/db";
import { DAY_MS, MINUTE_MS, rub } from "@auction/domain";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  applyDealAction,
  buyBlitz,
  buyFixed,
  cancelBids,
  createLot,
  createPgLotSearch,
  deleteAccount,
  finalizeLot,
  issueMonthlyInvoices,
  type LotInput,
  makeOffer,
  markInvoicePaid,
  markOverdueInvoices,
  placeBid,
  respondOffer,
  sendUserMessage,
} from "../src";
import { getRedis } from "../src/infra/redis";
import { setupTestDb } from "./setup-db";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await setupTestDb());
});
afterAll(async () => {
  await close();
  getRedis().disconnect();
});

const baseLot = (over: Partial<LotInput> = {}): LotInput => ({
  format: "english",
  title: "Рубль 1924 года серебро",
  description: "Монета в хорошем состоянии. Пишите на ivan@mail.ru",
  categoryId: 1,
  attributes: {},
  city: "Москва",
  deliveryMethods: ["post"],
  deliveryCost: "300 ₽",
  durationDays: 7,
  startPrice: rub(100),
  quantity: 1,
  blitzPrice: null,
  allowOffers: false,
  autoRelist: false,
  photoIds: [],
  ...over,
});

const getLot = async (id: number) => (await db.select().from(lots).where(eq(lots.id, id)))[0]!;

describe("английский аукцион", () => {
  it("автоставки, продление, финализация со сделкой и комиссией", async () => {
    const t0 = new Date();
    const lotId = await createLot(db, "seller", baseLot(), t0);
    const lot = await getLot(lotId);
    expect(lot.description).toContain("[скрыто]");

    await placeBid(db, { lotId, bidderId: "alice", amount: rub(100), maxAmount: rub(500), now: t0 });
    const r = await placeBid(db, { lotId, bidderId: "bob", amount: rub(200), now: t0 });
    expect(r.leading).toBe(false);
    expect(r.currentPrice).toBe(rub(210));

    // Боб перебивает максимум Алисы в последние 3 минуты — торги продлеваются.
    const late = new Date(lot.endsAt.getTime() - 3 * MINUTE_MS);
    const r2 = await placeBid(db, { lotId, bidderId: "bob", amount: rub(600), now: late });
    expect(r2.leading).toBe(true);
    expect(r2.currentPrice).toBe(rub(600));
    expect(r2.endsAt.getTime()).toBe(late.getTime() + 5 * MINUTE_MS);

    const outbid = await db.select().from(notifications).where(and(eq(notifications.userId, "alice"), eq(notifications.type, "outbid")));
    expect(outbid).toHaveLength(1);

    // Ставка после окончания отклоняется даже без финализации (ADR 0003).
    const after = new Date(r2.endsAt.getTime() + 1000);
    await expect(placeBid(db, { lotId, bidderId: "alice", amount: rub(1000), now: after })).rejects.toThrow(/завершены/);

    expect(await finalizeLot(db, lotId, after)).toBe("sold");
    expect(await finalizeLot(db, lotId, after)).toBe("skipped"); // идемпотентно
    const [deal] = await db.select().from(deals).where(eq(deals.lotId, lotId));
    expect(deal).toMatchObject({ buyerId: "bob", totalPrice: rub(600), source: "auction", status: "sold" });
    const ledger = await db.select().from(ledgerEntries).where(eq(ledgerEntries.dealId, deal!.id));
    expect(ledger).toEqual([expect.objectContaining({ kind: "charge", amount: rub(6) })]);
    // Продавцу уведомление ушло и в email-outbox (указан notifyEmail).
    const [sold] = await db.select().from(notifications).where(and(eq(notifications.userId, "seller"), eq(notifications.type, "lot_sold")));
    expect(sold?.wantsEmail).toBe(true);
  });

  it("нельзя ставить на свой лот и без подтверждённого телефона", async () => {
    const lotId = await createLot(db, "seller", baseLot());
    await expect(placeBid(db, { lotId, bidderId: "seller", amount: rub(100) })).rejects.toThrow(/свой лот/);
    await expect(placeBid(db, { lotId, bidderId: "unverified", amount: rub(100) })).rejects.toThrow(/телефон/);
  });

  it("отмена ставок продавцом пересчитывает торги", async () => {
    const lotId = await createLot(db, "seller", baseLot());
    await placeBid(db, { lotId, bidderId: "alice", amount: rub(100) });
    await placeBid(db, { lotId, bidderId: "bob", amount: rub(300), maxAmount: rub(1000) });
    await placeBid(db, { lotId, bidderId: "carol", amount: rub(400) });
    expect((await getLot(lotId)).leaderId).toBe("bob");

    await cancelBids(db, { lotId, sellerId: "seller", bidderId: "bob", reason: "Подозрение на накрутку" });
    const lot = await getLot(lotId);
    expect(lot.leaderId).toBe("carol");
    expect(lot.currentPrice).toBe(rub(400));
    const cancelled = await db.select().from(bids).where(and(eq(bids.lotId, lotId), eq(bids.bidderId, "bob")));
    expect(cancelled.every((b) => b.cancelledAt && b.cancelReason === "Подозрение на накрутку")).toBe(true);
  });

  it("блиц-цена завершает торги сделкой", async () => {
    const lotId = await createLot(db, "seller", baseLot({ blitzPrice: rub(5000) }));
    await placeBid(db, { lotId, bidderId: "alice", amount: rub(100) });
    const dealId = await buyBlitz(db, { lotId, buyerId: "bob" });
    const lot = await getLot(lotId);
    expect(lot.status).toBe("sold");
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(deal?.source).toBe("blitz");
    await expect(placeBid(db, { lotId, bidderId: "carol", amount: rub(6000) })).rejects.toThrow();
  });

  it("без ставок — не продан и перевыставляется автоматически", async () => {
    const t0 = new Date();
    const lotId = await createLot(db, "seller", baseLot({ autoRelist: true, durationDays: 3 }), t0);
    const end = new Date(t0.getTime() + 3 * DAY_MS + 1000);
    expect(await finalizeLot(db, lotId, end)).toBe("unsold");
    const old = await getLot(lotId);
    expect(old.relistedToId).not.toBeNull();
    const relisted = await getLot(old.relistedToId!);
    expect(relisted).toMatchObject({ itemId: old.itemId, autoRelistCount: 1, status: "active" });
  });
});

describe("фиксированная цена", () => {
  it("покупка части количества и предложение цены", async () => {
    const lotId = await createLot(db, "seller", baseLot({ format: "fixed", quantity: 3, startPrice: rub(1000), allowOffers: true }));
    await buyFixed(db, { lotId, buyerId: "alice", quantity: 2 });
    await expect(buyFixed(db, { lotId, buyerId: "bob", quantity: 2 })).rejects.toThrow(/Доступно только 1/);

    await expect(makeOffer(db, { lotId, buyerId: "bob", price: rub(1000), quantity: 1 })).rejects.toThrow(/ниже цены/);
    await makeOffer(db, { lotId, buyerId: "bob", price: rub(800), quantity: 1 });
    const [offerNotif] = await db.select().from(notifications).where(and(eq(notifications.userId, "seller"), eq(notifications.type, "offer_received")));
    expect(offerNotif).toBeDefined();
    const offerId = (await db.query.offers.findFirst({ where: (o, { eq }) => eq(o.buyerId, "bob") }))!.id;
    const dealId = await respondOffer(db, { offerId, sellerId: "seller", accept: true });
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId!));
    expect(deal).toMatchObject({ unitPrice: rub(800), source: "offer" });
    expect((await getLot(lotId)).status).toBe("sold");
  });
});

describe("сделка: неоплата", () => {
  it("штрафной отзыв и сторно комиссии", async () => {
    const lotId = await createLot(db, "seller", baseLot({ format: "fixed", startPrice: rub(2000), durationDays: 10 }));
    const dealId = await buyFixed(db, { lotId, buyerId: "carol", quantity: 1 });
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));

    await expect(
      db.transaction((tx) => applyDealAction(tx, { dealId, userId: "seller", action: "report_not_paid", now: new Date() })),
    ).rejects.toThrow(/через 7 дней/);
    const later = new Date(deal!.createdAt.getTime() + 8 * DAY_MS);
    await db.transaction((tx) => applyDealAction(tx, { dealId, userId: "seller", action: "report_not_paid", now: later }));

    const ledger = await db.select().from(ledgerEntries).where(eq(ledgerEntries.dealId, dealId));
    expect(ledger.reduce((s, e) => s + e.amount, 0)).toBe(0);
    const [penalty] = await db.select().from(reviews).where(and(eq(reviews.dealId, dealId), eq(reviews.targetId, "carol")));
    expect(penalty).toMatchObject({ isPenalty: true, rating: "negative" });
  });
});

describe("счета", () => {
  it("счёт 1-го числа, просрочка блокирует выставление, оплата снимает блокировку", async () => {
    // Комиссия продавца в предыдущих тестах — 84 ₽ (меньше порога); добавляем продажу на 20 000 ₽ (+200 ₽).
    const big = await createLot(db, "seller", baseLot({ format: "fixed", startPrice: rub(20_000) }));
    await buyFixed(db, { lotId: big, buyerId: "bob", quantity: 1 });
    const now = new Date();
    const firstOfNext = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 5));
    const issued = await issueMonthlyInvoices(db, firstOfNext);
    expect(issued).toBeGreaterThanOrEqual(1);
    expect(await issueMonthlyInvoices(db, firstOfNext)).toBe(0); // идемпотентно
    const [inv] = await db.select().from(invoices).where(eq(invoices.sellerId, "seller"));
    expect(inv!.amount).toBeGreaterThanOrEqual(rub(100));

    await markOverdueInvoices(db, new Date(firstOfNext.getTime() + 11 * DAY_MS));
    expect((await db.select().from(user).where(eq(user.id, "seller")))[0]!.listingBlocked).toBe(true);
    await expect(createLot(db, "seller", baseLot())).rejects.toThrow(/просроченный счёт/);

    await markInvoicePaid(db, inv!.id, "service");
    expect((await db.select().from(user).where(eq(user.id, "seller")))[0]!.listingBlocked).toBe(false);
  });
});

describe("поиск и переписка", () => {
  it("полнотекстовый поиск учитывает русскую морфологию", async () => {
    const search = createPgLotSearch(db);
    const { items } = await search.search({ q: "монеты", status: "active" });
    // В описании «Монета …» — находится по «монеты» (та же основа).
    expect(items.length).toBeGreaterThan(0);
    const { total } = await search.search({ q: "рубли" });
    expect(total).toBeGreaterThan(0);
  });

  it("контакты в сообщениях маскируются", async () => {
    const lotId = await createLot(db, "seller", baseLot());
    const conversationId = await sendUserMessage(db, {
      senderId: "alice",
      toUserId: "seller",
      lotId,
      text: "Позвоните мне +7 999 123-45-67",
    });
    const msg = await db.query.messages.findFirst({
      where: (m, { and, eq }) => and(eq(m.conversationId, conversationId), eq(m.senderId, "alice"), eq(m.isSystem, false)),
    });
    expect(msg?.text).toBe("Позвоните мне [скрыто]");
  });
});

describe("удаление аккаунта (152-ФЗ)", () => {
  it("обезличивает данные и сохраняет историю", async () => {
    await db.transaction((tx) => deleteAccount(tx, "alice"));
    const [u] = await db.select().from(user).where(eq(user.id, "alice"));
    expect(u).toMatchObject({ name: "Пользователь удалён", phoneNumber: null, notifyEmail: null });
    expect(u?.deletedAt).not.toBeNull();
    const aliceBids = await db.select().from(bids).where(eq(bids.bidderId, "alice"));
    expect(aliceBids.length).toBeGreaterThan(0);
  });
});
