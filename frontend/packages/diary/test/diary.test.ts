import { describe, expect, it } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import { IDENTITY_MESSAGE, demoSignature, emptyDiary, identityFromSignature, openDiary, partyWallet, sealDiary } from "../src";

describe("identity", () => {
  const seed = new Uint8Array(32).fill(3);

  it("re-derives the same secrets from the same identity wallet (Ed25519 is deterministic)", () => {
    const a = identityFromSignature(demoSignature(seed));
    const b = identityFromSignature(demoSignature(seed));
    expect(a.backupKey).toBe(b.backupKey);
    expect(a.diaryKey).toEqual(b.diaryKey);
    expect(ed25519.verify(demoSignature(seed), IDENTITY_MESSAGE, ed25519.getPublicKey(seed))).toBe(true);
  });

  it("gives each party its own wallet", async () => {
    const id = identityFromSignature(demoSignature(seed));
    const w1 = await partyWallet(id.seed, 1n);
    const w2 = await partyWallet(id.seed, 2n);
    expect(w1.address).not.toBe(w2.address);
    expect((await partyWallet(id.seed, 1n)).address).toBe(w1.address);
  });
});

describe("Diary encryption", () => {
  it("round-trips and refuses the wrong key", () => {
    const id = identityFromSignature(demoSignature(new Uint8Array(32).fill(1)));
    const d = { ...emptyDiary(), parties: { "7": { tag: "ab", address: "x", wallet: "y" } } };
    const blob = sealDiary(d, id.diaryKey);
    expect(openDiary(blob, id.diaryKey).parties["7"].tag).toBe("ab");
    const other = identityFromSignature(demoSignature(new Uint8Array(32).fill(2)));
    expect(() => openDiary(blob, other.diaryKey)).toThrow();
  });
});
