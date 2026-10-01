import { describe, expect, it } from "vitest";
import { dollars, earliestSeat, exampleParty, formatMoney, kittyLimit, perNightDue, takeTheKitty } from "./index";

const $ = dollars;

describe("worked examples (product doc 7.5)", () => {
  const base = { chipIn: $(100), guests: 10, hostFeeBps: 100 };
  it.each([
    ["tier 2 bid night, slot 1", { night: 1, tier: 2 as const, plusOnes: $(50), discountBps: 800 }, 900, 175, 735],
    ["tier 1 Draw, slot 4", { night: 4, tier: 1 as const }, 600, 300, 690],
    ["tier 0 Draw, slot 6", { night: 6, tier: 0 as const }, 400, 300, 690],
    ["all-new party, gate relaxed", { night: 1, tier: 0 as const, gateRelaxed: true, plusOnes: $(300) }, 900, 600, 390],
    ["last slot", { night: 10, tier: 0 as const }, 0, 0, 990],
  ])("%s", (_label, extra, r, l, paid) => {
    const t = takeTheKitty({ ...base, ...extra });
    expect(t.remaining).toBe($(r));
    expect(t.keepsafe).toBe($(l));
    expect(t.paidNow).toBe($(paid));
  });
});

describe("Act 4 expected values (brief 11 · Act 4)", () => {
  const x = exampleParty();
  it("matches the storyboard numbers", () => {
    expect(x.take.kitty).toBe($(1000));
    expect(x.take.remaining).toBe($(600));
    expect(x.take.keepsafe).toBe($(300));
    expect(x.take.hostFee).toBe($(10));
    expect(x.take.paidNow).toBe($(690));
    expect(x.take.releasePerChipIn).toBe($(50));
    expect(x.keepsafeBeforeMiss).toBe($(250));
    expect(x.cover).toEqual({ missed: $(500), fromKeepsafe: $(250), fromPlusOnes: 0, fromHouse: $(250) });
  });
  it("charges $101.00 a night", () => {
    const d = perNightDue($(100));
    expect(d.kittyFee).toBe($(0.5));
    expect(d.houseFee).toBe($(0.5));
    expect(formatMoney(d.total)).toBe("$101");
    expect(formatMoney(d.total, { cents: "always" })).toBe("$101.00");
  });
});

describe("seats and limits", () => {
  it("gates seats by tier for N = 10", () => {
    expect([earliestSeat(0, 10), earliestSeat(1, 10), earliestSeat(2, 10)]).toEqual([6, 4, 1]);
  });
  it("kitty limit is half of lifetime plus one chip-in", () => {
    expect(kittyLimit($(700), $(100))).toBe($(450));
  });
  it("formats money plainly", () => {
    expect(formatMoney($(1000))).toBe("$1,000");
    expect(formatMoney($(0.5))).toBe("$0.50");
    expect(formatMoney(-$(10))).toBe("−$10");
  });
});
