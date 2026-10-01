/**
 * The worked example the landing page and demo use (brief Act 4, product doc 7.5):
 * N = 10, chip-in $100, host fee 1%, the Draw; on Night 4 a Regular (tier 1)
 * guest, Marigold Parrot, takes the kitty, then misses Nights 6–10.
 */
import { dollars, keepsafeAfter, perNightDue, settleUpAmount, takeTheKitty, waterfall } from "./fees";

export const EXAMPLE = {
  guests: 10,
  chipIn: dollars(100),
  hostFeeBps: 100,
  night: 4,
  tier: 1 as const,
  taker: "Marigold Parrot",
  firstMissedNight: 6,
};

export function exampleParty() {
  const e = EXAMPLE;
  const due = perNightDue(e.chipIn);
  const take = takeTheKitty({ chipIn: e.chipIn, guests: e.guests, night: e.night, tier: e.tier, hostFeeBps: e.hostFeeBps });
  // Night 5 is paid, so one release happens before the misses begin.
  const paidAfterTaking = e.firstMissedNight - e.night - 1;
  const keepsafeBeforeMiss = keepsafeAfter(take, e.chipIn, paidAfterTaking);
  const missedNights = e.guests - e.firstMissedNight + 1;
  const cover = waterfall(missedNights * e.chipIn, keepsafeBeforeMiss, 0);
  const settleUp = settleUpAmount(cover.fromHouse, missedNights, e.chipIn);
  return { ...e, due, take, keepsafeBeforeMiss, missedNights, cover, settleUp };
}
