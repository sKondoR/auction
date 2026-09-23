import { describe, expect, it } from "vitest";
import { MIN_INVOICE_AMOUNT, commissionFor, draftInvoice, isInvoiceOverdue } from "./commission";
import { maskContacts } from "./contacts";
import { availableDealActions, nextDealStatus } from "./deal";
import { dutchPrice } from "./dutch-auction";
import { assertCanBuy, validateOffer } from "./fixed-price";
import { canEditField } from "./lot-editing";
import { DAY_MS, type LotDraft, validateLotDraft } from "./lot-format";
import { lotPhase } from "./lot-state";
import { rub } from "./money";
import { relistWindow, shouldAutoRelist } from "./relist";
import { DEFAULT_NEWBIE_LIMITS, assertNewbieCanBid, rating } from "./reputation";
import { hasPermission } from "./misc";

const draft = (over: Partial<LotDraft> = {}): LotDraft => ({
  format: "english",
  title: "Монета 1 рубль 1924",
  description: "",
  categoryId: 1,
  city: "Москва",
  deliveryMethods: ["post"],
  deliveryCost: "300 ₽",
  photoCount: 3,
  durationDays: 7,
  startPrice: rub(1),
  quantity: 1,
  blitzPrice: null,
  allowOffers: false,
  autoRelist: false,
  ...over,
});

describe("валидация лота", () => {
  it("английский аукцион: 1–21 день, от 1 ₽", () => {
    expect(() => validateLotDraft(draft())).not.toThrow();
    expect(() => validateLotDraft(draft({ durationDays: 22 }))).toThrow(/от 1 до 21/);
    expect(() => validateLotDraft(draft({ startPrice: 99 }))).toThrow(/от 1 ₽/);
    expect(() => validateLotDraft(draft({ blitzPrice: rub(1) }))).toThrow(/выше стартовой/);
  });

  it("фиксированная цена: до 60 дней, количество > 1 допустимо", () => {
    expect(() => validateLotDraft(draft({ format: "fixed", durationDays: 60, quantity: 5, allowOffers: true }))).not.toThrow();
    expect(() => validateLotDraft(draft({ format: "fixed", durationDays: 61 }))).toThrow(/до 60/);
  });

  it("голландский и живой аукционы пока недоступны", () => {
    expect(() => validateLotDraft(draft({ format: "dutch" }))).toThrow(/недоступен/);
  });

  it("город и способ доставки обязательны, фото — до 20", () => {
    expect(() => validateLotDraft(draft({ city: " " }))).toThrow(/город/);
    expect(() => validateLotDraft(draft({ deliveryMethods: [] }))).toThrow(/доставки/);
    expect(() => validateLotDraft(draft({ photoCount: 21 }))).toThrow(/20 фото/);
  });
});

describe("состояние лота вычисляется из времени", () => {
  const lot = {
    status: "active" as const,
    format: "english" as const,
    startsAt: new Date("2026-01-01T00:00:00Z"),
    endsAt: new Date("2026-01-08T00:00:00Z"),
  };
  it("открыт между началом и концом, даже если worker не финализировал", () => {
    expect(lotPhase(lot, new Date("2025-12-31T00:00:00Z"))).toBe("upcoming");
    expect(lotPhase(lot, new Date("2026-01-05T00:00:00Z"))).toBe("open");
    expect(lotPhase(lot, new Date("2026-01-08T00:00:00Z"))).toBe("ended");
    expect(lotPhase({ ...lot, status: "withdrawn" }, new Date("2026-01-05T00:00:00Z"))).toBe("ended");
  });
});

describe("редактирование после первой ставки", () => {
  it("можно только снижать блиц-цену", () => {
    expect(canEditField("description", false)).toBe(true);
    expect(canEditField("description", true)).toBe(false);
    expect(canEditField("price", true)).toBe(false);
    expect(canEditField("blitzDecrease", true)).toBe(true);
  });
});

describe("фиксированная цена", () => {
  it("нельзя купить больше остатка", () => {
    expect(() => assertCanBuy({ quantity: 3, quantitySold: 2 }, 2)).toThrow(/Доступно только 1/);
    expect(() => assertCanBuy({ quantity: 3, quantitySold: 2 }, 1)).not.toThrow();
  });
  it("предложение цены — ниже цены продавца", () => {
    const stock = { quantity: 1, quantitySold: 0 };
    expect(() => validateOffer({ price: rub(100), listPrice: rub(100), qty: 1, stock })).toThrow();
    expect(() => validateOffer({ price: rub(90), listPrice: rub(100), qty: 1, stock })).not.toThrow();
  });
});

describe("сделка", () => {
  const created = new Date("2026-01-01T00:00:00Z");
  const deal = { status: "sold" as const, createdAt: created, shippedAt: null };

  it("продавец отмечает оплату, покупатель — получение", () => {
    expect(nextDealStatus(deal, "mark_paid", "seller", created)).toBe("paid");
    expect(() => nextDealStatus(deal, "mark_paid", "buyer", created)).toThrow(/другой стороне/);
    expect(nextDealStatus({ ...deal, status: "shipped" }, "mark_received", "buyer", created)).toBe("received");
  });

  it("«Покупатель не оплатил» — только после 7 дней", () => {
    expect(availableDealActions(deal, "seller", new Date(created.getTime() + 6 * DAY_MS))).not.toContain("report_not_paid");
    expect(availableDealActions(deal, "seller", new Date(created.getTime() + 7 * DAY_MS))).toContain("report_not_paid");
  });
});

describe("комиссия и счета", () => {
  it("1% от цены × количество", () => {
    expect(commissionFor(rub(1_000), 1)).toBe(rub(10));
    expect(commissionFor(rub(150), 3)).toBe(450);
    expect(commissionFor(333, 1)).toBe(3);
  });

  const e = (id: number, amount: number, date: string, invoiceId: number | null = null) => ({
    id,
    kind: amount >= 0 ? ("charge" as const) : ("reversal" as const),
    amount,
    createdAt: new Date(date),
    invoiceId,
  });

  it("счёт 1-го числа за прошлый месяц с учётом сторно", () => {
    const inv = draftInvoice(
      [
        e(1, rub(80), "2026-01-10T00:00:00Z"),
        e(2, rub(50), "2026-01-20T00:00:00Z"),
        e(3, -rub(10), "2026-01-25T00:00:00Z"),
        e(4, rub(500), "2026-02-01T10:00:00Z"), // текущий месяц — не входит
        e(5, rub(70), "2025-12-10T00:00:00Z", 7), // уже в счёте
      ],
      new Date("2026-02-01T00:05:00Z"),
    );
    expect(inv?.amount).toBe(rub(120));
    expect(inv?.entryIds).toEqual([1, 2, 3]);
    expect(inv?.periodStart).toEqual(new Date("2026-01-01T00:00:00Z"));
  });

  it("сумма меньше 100 ₽ переносится", () => {
    expect(draftInvoice([e(1, rub(99), "2026-01-10T00:00:00Z")], new Date("2026-02-01T00:00:00Z"))).toBeNull();
    const inv = draftInvoice(
      [e(1, rub(99), "2026-01-10T00:00:00Z"), e(2, rub(5), "2026-02-10T00:00:00Z")],
      new Date("2026-03-01T00:00:00Z"),
    );
    expect(inv?.amount).toBe(rub(104));
    expect(MIN_INVOICE_AMOUNT).toBe(rub(100));
  });

  it("просрочка — после срока оплаты", () => {
    const dueAt = new Date("2026-02-11T00:00:00Z");
    expect(isInvoiceOverdue({ status: "issued", dueAt }, new Date("2026-02-10T00:00:00Z"))).toBe(false);
    expect(isInvoiceOverdue({ status: "issued", dueAt }, new Date("2026-02-12T00:00:00Z"))).toBe(true);
    expect(isInvoiceOverdue({ status: "paid", dueAt }, new Date("2026-02-12T00:00:00Z"))).toBe(false);
  });
});

describe("маскировка контактов", () => {
  it.each([
    "звоните +7 (999) 123-45-67",
    "пишите 89991234567",
    "почта ivan.petrov@mail.ru",
    "мой сайт https://example.com/page",
    "мой тг @ivan_coins",
    "пишите в вотсап",
    "t.me/ivancoins",
  ])("скрывает: %s", (text) => {
    expect(maskContacts(text)).toContain("[скрыто]");
  });

  it("не трогает обычный текст с числами", () => {
    const text = "Монета 1924 года, диаметр 33,5 мм, вес 20 г. Цена 1500 руб.";
    expect(maskContacts(text)).toBe(text);
  });
});

describe("репутация и лимиты", () => {
  it("рейтинг", () => {
    expect(rating({ positive: 9, neutral: 0, negative: 1 })).toEqual({ score: 8, positivePercent: 90, total: 10 });
  });
  it("новичок ограничен числом одновременных торгов", () => {
    const base = { reviewsReceived: 0, alreadyBidsOnThisLot: false, limits: DEFAULT_NEWBIE_LIMITS };
    expect(() => assertNewbieCanBid({ ...base, activeBidLots: 5 })).toThrow(/не более/);
    expect(() => assertNewbieCanBid({ ...base, activeBidLots: 5, alreadyBidsOnThisLot: true })).not.toThrow();
    expect(() => assertNewbieCanBid({ ...base, activeBidLots: 50, reviewsReceived: 1 })).not.toThrow();
  });
});

describe("перевыставление", () => {
  it("автоматически — не больше 3 раз", () => {
    expect(shouldAutoRelist({ format: "english", autoRelist: true, autoRelistCount: 2 })).toBe(true);
    expect(shouldAutoRelist({ format: "english", autoRelist: true, autoRelistCount: 3 })).toBe(false);
    expect(shouldAutoRelist({ format: "english", autoRelist: false, autoRelistCount: 0 })).toBe(false);
  });
  it("сохраняет длительность", () => {
    const now = new Date("2026-03-01T00:00:00Z");
    const w = relistWindow(
      { startsAt: new Date("2026-01-01T00:00:00Z"), originalEndsAt: new Date("2026-01-08T00:00:00Z") },
      now,
    );
    expect(w.endsAt).toEqual(new Date("2026-03-08T00:00:00Z"));
  });
});

describe("голландский аукцион (этап 2)", () => {
  it("снижается линейно от стартовой и не ниже минимальной", () => {
    const p = { startPrice: rub(1_000), minPrice: rub(700), intervalDays: 3, stepPercent: 10, startsAt: new Date(0) };
    expect(dutchPrice(p, new Date(2 * DAY_MS))).toBe(rub(1_000));
    expect(dutchPrice(p, new Date(3 * DAY_MS))).toBe(rub(900));
    expect(dutchPrice(p, new Date(6 * DAY_MS))).toBe(rub(800));
    expect(dutchPrice(p, new Date(30 * DAY_MS))).toBe(rub(700));
  });
});

describe("права ролей", () => {
  it("оценщик видит только заявки на выкуп", () => {
    expect(hasPermission("appraiser", "buyout.review")).toBe(true);
    expect(hasPermission("appraiser", "moderation.lots")).toBe(false);
    expect(hasPermission("moderator", "moderation.lots")).toBe(true);
    expect(hasPermission("moderator", "admin.settings")).toBe(false);
    expect(hasPermission("user", "moderation.lots")).toBe(false);
  });
});
