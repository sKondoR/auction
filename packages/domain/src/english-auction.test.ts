import { describe, expect, it } from "vitest";
import { bidStep } from "./bid-steps";
import {
  applyBid,
  extendEndIfSniping,
  initialEnglishState,
  isBlitzAvailable,
  minNextBid,
  replayBids,
  validateBlitzChange,
} from "./english-auction";
import { DomainError, rub } from "./money";

describe("сетка шагов", () => {
  it.each([
    [rub(1), rub(5)],
    [rub(99), rub(5)],
    [rub(100), rub(10)],
    [rub(999), rub(10)],
    [rub(1_000), rub(50)],
    [rub(5_000), rub(100)],
    [rub(20_000), rub(500)],
    [rub(100_000), rub(1_000)],
    [rub(5_000_000), rub(1_000)],
  ])("цена %i → шаг %i", (price, step) => {
    expect(bidStep(price)).toBe(step);
  });
});

describe("английский аукцион", () => {
  const start = initialEnglishState(rub(100));

  it("первая ставка — не ниже стартовой цены", () => {
    expect(() => applyBid(start, { bidderId: "a", amount: rub(99) })).toThrow(DomainError);
    const r = applyBid(start, { bidderId: "a", amount: rub(100) });
    expect(r.state.currentPrice).toBe(rub(100));
    expect(r.state.leaderId).toBe("a");
    expect(minNextBid(r.state)).toBe(rub(110));
  });

  it("следующая ставка — не меньше текущей + шаг", () => {
    const s = applyBid(start, { bidderId: "a", amount: rub(100) }).state;
    expect(() => applyBid(s, { bidderId: "b", amount: rub(105) })).toThrow(/Минимальная ставка/);
    const r = applyBid(s, { bidderId: "b", amount: rub(110) });
    expect(r.state.leaderId).toBe("b");
    expect(r.outbidUserId).toBe("a");
  });

  it("автоставка лидера перебивает меньшую ставку на шаг", () => {
    const s = applyBid(start, { bidderId: "a", amount: rub(100), maxAmount: rub(500) }).state;
    const r = applyBid(s, { bidderId: "b", amount: rub(200) });
    expect(r.state.leaderId).toBe("a");
    expect(r.state.currentPrice).toBe(rub(210));
    expect(r.outbidImmediately).toBe(true);
    expect(r.outbidUserId).toBe("b");
    expect(r.records).toEqual([
      { bidderId: "b", amount: rub(200), isAuto: false, maxAmount: null },
      { bidderId: "a", amount: rub(210), isAuto: true, maxAmount: null },
    ]);
  });

  it("автоставка не превышает максимум лидера", () => {
    const s = applyBid(start, { bidderId: "a", amount: rub(100), maxAmount: rub(205) }).state;
    const r = applyBid(s, { bidderId: "b", amount: rub(200) });
    expect(r.state.currentPrice).toBe(rub(205));
    expect(r.state.leaderId).toBe("a");
  });

  it("при равных максимумах выигрывает более ранняя ставка", () => {
    const s = applyBid(start, { bidderId: "a", amount: rub(100), maxAmount: rub(300) }).state;
    const r = applyBid(s, { bidderId: "b", amount: rub(300) });
    expect(r.state.leaderId).toBe("a");
    expect(r.state.currentPrice).toBe(rub(300));
  });

  it("новая автоставка выше максимума лидера — цена = максимум лидера + шаг", () => {
    const s = applyBid(start, { bidderId: "a", amount: rub(100), maxAmount: rub(300) }).state;
    const r = applyBid(s, { bidderId: "b", amount: rub(110), maxAmount: rub(1_000) });
    expect(r.state.leaderId).toBe("b");
    expect(r.state.currentPrice).toBe(rub(310));
    expect(r.state.leaderMax).toBe(rub(1_000));
    expect(r.records[0]).toEqual({ bidderId: "a", amount: rub(300), isAuto: true, maxAmount: null });
    expect(r.outbidUserId).toBe("a");
  });

  it("лидер может поднять свой максимум без изменения цены", () => {
    const s = applyBid(start, { bidderId: "a", amount: rub(100), maxAmount: rub(300) }).state;
    const r = applyBid(s, { bidderId: "a", amount: rub(110), maxAmount: rub(800) });
    expect(r.state.currentPrice).toBe(rub(100));
    expect(r.state.leaderMax).toBe(rub(800));
    expect(r.records).toHaveLength(0);
    expect(() => applyBid(r.state, { bidderId: "a", amount: rub(110), maxAmount: rub(500) })).toThrow(DomainError);
  });

  it("пересчёт после отмены ставки продавцом", () => {
    const { state } = replayBids(rub(100), [
      { bidderId: "a", amount: rub(100) },
      { bidderId: "c", amount: rub(150), maxAmount: rub(400) },
    ]);
    // Ставки «b» были отменены — пересчитываем без них.
    expect(state.leaderId).toBe("c");
    expect(state.currentPrice).toBe(rub(150));
  });
});

describe("продление торгов", () => {
  const end = new Date("2026-01-01T12:00:00Z");

  it("ставка за 3 минуты до конца продлевает до «ставка + 5 минут»", () => {
    const bidAt = new Date("2026-01-01T11:57:00Z");
    expect(extendEndIfSniping(end, bidAt)).toEqual(new Date("2026-01-01T12:02:00Z"));
  });

  it("ставка раньше последних 5 минут не продлевает", () => {
    const bidAt = new Date("2026-01-01T11:50:00Z");
    expect(extendEndIfSniping(end, bidAt)).toEqual(end);
  });
});

describe("блиц-цена", () => {
  it("доступна, пока текущая ставка ниже неё", () => {
    expect(isBlitzAvailable(rub(1_000), null)).toBe(true);
    expect(isBlitzAvailable(rub(1_000), rub(999))).toBe(true);
    expect(isBlitzAvailable(rub(1_000), rub(1_000))).toBe(false);
    expect(isBlitzAvailable(null, null)).toBe(false);
  });

  it("после ставок — только снижение и не ниже «ставка + шаг»", () => {
    const state = { startPrice: rub(100), currentPrice: rub(500), leaderId: "a", leaderMax: rub(500) };
    expect(() => validateBlitzChange({ oldBlitz: rub(2_000), newBlitz: rub(2_500), state })).toThrow(/только снижать/);
    expect(() => validateBlitzChange({ oldBlitz: rub(2_000), newBlitz: rub(505), state })).toThrow(/не может быть ниже/);
    expect(() => validateBlitzChange({ oldBlitz: rub(2_000), newBlitz: rub(510), state })).not.toThrow();
    expect(() => validateBlitzChange({ oldBlitz: rub(2_000), newBlitz: null, state })).toThrow();
  });
});
