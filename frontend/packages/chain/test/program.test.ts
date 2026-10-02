/**
 * End-to-end on LiteSVM with real proofs: Guest Pass (real Anon Aadhaar proof + dev registrations),
 * hosting, RSVP (3 transactions), auto-pay collects, four Draw nights, a removed guest (House Fund
 * takes the seat), a default after payout (keepsafe → plus-ones → House Fund), settle up, Farewell,
 * COMPLETE notes and a Show-a-page proof. Every leaf is mirrored on the "device" tree and its root
 * checked against the program's.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Address, type KeyPairSigner, generateKeyPairSigner } from "@solana/kit";
import * as Z from "@kitty/zk";
import * as C from "../src";
import { Chain, USD, aadhaarFixture } from "./harness";
import { Guest } from "./guest";

const c = 100n * USD;
let chain: Chain;
let asha: Guest, ben: Guest, chen: Guest, dee: Guest;
let party: Address;
let partyId: bigint;
let invite: Uint8Array;
let provider: KeyPairSigner;
let voucher: KeyPairSigner;
const IDX = { asha: 0, ben: 1, chen: 2, dee: 3 };

/** Randomness whose first 8 bytes (LE u64) pick position `pos` of a pool of `len`. */
function pick(pos: number, len: number) {
  const r = new Uint8Array(64);
  new DataView(r.buffer).setBigUint64(0, BigInt(len * 1000 + pos), true);
  return r;
}

async function collect(g: Guest, idx: number) {
  const w = await g.wallet(partyId);
  return chain.send("collect", [
    await C.getCollectInstructionAsync({
      signer: chain.relay,
      party,
      vault: await C.vaultPda(party),
      memberToken: await chain.ata(w.address),
      treasury: chain.treasury,
      memberIdx: idx,
    }),
  ]);
}

async function drawNight(winnerPos: number, poolLen: number) {
  await chain.send("request_draw", [C.getRequestDrawInstruction({ party })]);
  const seed = Uint8Array.from(chain.party(party).drawSeed);
  const randomness = await chain.fulfilOrao(seed, pick(winnerPos, poolLen));
  const r = await chain.send("resolve_draw", [C.getResolveDrawInstruction({ party, randomness })]);
  const ev = r.events.find((e) => e.name === "DrawResolved");
  return ev?.name === "DrawResolved" ? ev.data : undefined;
}

async function settle(winner: Guest, host: Guest) {
  const p = chain.party(party);
  void p;
  const r = await chain.send("settle_round", [
    await C.getSettleRoundInstructionAsync({
      party,
      vault: await C.vaultPda(party),
      winnerToken: await chain.ata((await winner.wallet(partyId)).address),
      hostToken: await chain.ata((await host.wallet(partyId)).address),
    }),
  ]);
  const ev = r.events.find((e) => e.name === "RoundSettled");
  return ev?.name === "RoundSettled" ? ev.data : undefined;
}

async function markDefault(idx: number) {
  const r = await chain.send("mark_default", [await C.getMarkDefaultInstructionAsync({ party, vault: await C.vaultPda(party), memberIdx: idx })]);
  const ev = r.events.find((e) => e.name === "Defaulted");
  return ev?.name === "Defaulted" ? ev.data : undefined;
}

async function farewell(g: Guest, idx: number) {
  const r = await chain.send("farewell", [
    await C.getFarewellInstructionAsync({ party, vault: await C.vaultPda(party), memberToken: await chain.ata((await g.wallet(partyId)).address), memberIdx: idx }),
  ]);
  const ev = r.events.find((e) => e.name === "Farewell");
  if (ev?.name !== "Farewell") throw new Error("no Farewell event");
  return { paidRounds: ev.data.paidRounds, lateCount: ev.data.lateCount, payout: ev.data.payout };
}

const dueAt = (r: number) => chain.party(party).startTs + BigInt(r - 1) * chain.party(party).periodSecs;
const member = (i: number) => chain.party(party).members[i];

beforeAll(async () => {
  chain = new Chain();
  await chain.setup();
  provider = await chain.fundedSigner();
  voucher = await chain.fundedSigner();
  // House Fund cover capital.
  await chain.faucet(provider.address, 10_000n * USD);
  await chain.send("house_deposit", [
    await C.getHouseDepositInstructionAsync({ owner: provider, ownerToken: await chain.ata(provider.address), share: await C.sharePda(provider.address), amount: 5_000n * USD }),
  ]);
}, 60_000);

afterAll(() => {
  if (chain) console.table(chain.cuReport());
});

describe("Guest Pass", () => {
  it("registers with a real Anon Aadhaar proof bound to the first note", async () => {
    const fx = aadhaarFixture();
    asha = new Guest("Asha", BigInt(fx.s));
    asha.note = Z.freshNote(asha.s);
    expect(Z.noteCommitment(asha.note).toString()).toBe(fx.firstCommitment);
    const proof = Z.proofToSolana(fx.proof);
    const sig = Z.aadhaarSignals(fx.publicSignals);
    const ix = async () =>
      C.getRegisterInstructionAsync({
        payer: chain.relay,
        marker: await C.registrationPda(sig.nullifier),
        proof,
        nullifier: sig.nullifier,
        timestamp: sig.timestamp,
        firstCommitment: Z.bigToBytes32(Z.noteCommitment(asha.note)),
      });
    const r = await chain.send("register", [await ix()]);
    expect(r.events.some((e) => e.name === "Registered")).toBe(true);
    // Sybil retry: the same Aadhaar can't get a second pass.
    await chain.fails("register again", [await ix()], /already in use/);
  });

  it("rejects a registration proof bound to a different note", async () => {
    const fx = aadhaarFixture();
    const sig = Z.aadhaarSignals(fx.publicSignals);
    const other = Z.noteCommitment(Z.freshNote(12345n));
    await chain.fails("register other note", [
      await C.getRegisterInstructionAsync({
        payer: chain.relay,
        marker: await C.registrationPda(Z.bigToBytes32(99n)),
        proof: Z.proofToSolana(fx.proof),
        nullifier: Z.bigToBytes32(99n),
        timestamp: sig.timestamp,
        firstCommitment: Z.bigToBytes32(other),
      }),
    ], /InvalidProof|does not verify/);
  });

  it("registers the other guests (devnet harness path)", async () => {
    ben = await Guest.create("Ben");
    chen = await Guest.create("Chen");
    dee = await Guest.create("Dee");
    for (const g of [ben, chen, dee]) await g.registerDev(chain);
  });
});

describe("hosting and RSVP", () => {
  it("creates a Draw party with an invite key", async () => {
    const cfg = chain.account((await C.configPda()) as Address, C.decodeConfig);
    partyId = cfg.nextPartyId;
    party = await C.partyPda(partyId);
    invite = C.newInviteSecret();
    const now = chain.now();
    const host = await asha.wallet(partyId);
    await chain.send("create_party", [
      await C.getCreatePartyInstructionAsync({
        payer: chain.relay,
        host,
        party,
        vault: await C.vaultPda(party),
        mint: chain.mint.address,
        ...{
          chipIn: c, guests: 4, periodSecs: 180n, graceSecs: 120n,
          startTs: now + 600n, formationDeadline: now + 300n,
          mode: C.ORDER.DRAW, hostFeeBps: 100, minTier: 0,
          inviteKey: C.invitePublicKey(invite),
        },
      }),
    ]);
    const p = chain.party(party);
    expect(p.guests).toBe(4);
    expect(p.unlockedByTier).toEqual(Z.unlockedByTier(c, 4n));
  });

  it("refuses an RSVP without the invite secret", async () => {
    const { ixs } = await ben.rsvpIx(chain, party, C.newInviteSecret());
    await chain.fails("rsvp bad invite", ixs, /BadInvite|invite/);
  });

  it("three guests RSVP: approve auto-pay, RSVP, first chip-in", async () => {
    for (const g of [asha, ben, chen]) {
      const r = await g.rsvp(chain, party, invite);
      expect(r.size).toBeLessThanOrEqual(1232);
    }
    const p = chain.party(party);
    expect(p.joined).toBe(3);
    expect(p.members[0].isHost).toBe(1);
    expect(p.members.slice(0, 3).every((m) => m.paidThrough === 1)).toBe(true);
  });

  it("a stolen join proof can't be used by another wallet (front-run)", async () => {
    const jp = await dee.joinProof(chain, party);
    const thief = await generateKeyPairSigner();
    await chain.faucet(thief.address, 1_000n * USD);
    await chain.approve(thief, party, 1_000n * USD);
    const { ixs } = await dee.rsvpIx(chain, party, invite, jp, thief);
    await chain.fails("rsvp front-run", ixs, /InvalidProof|does not verify/);
  });

  it("the fourth guest fills the party", async () => {
    await dee.rsvp(chain, party, invite);
    expect(chain.party(party).status).toBe(C.PARTY_STATUS.ACTIVE);
  });
});

describe("the nights", () => {
  it("night 1: the Draw opens the gate (all Guests), Ben takes the kitty", async () => {
    chain.warpTo(dueAt(1) + 1n);
    const d = await drawNight(1, 4);
    expect(d?.winnerIdx).toBe(IDX.ben);
    expect(d?.gateRelaxed).toBe(true);
    chain.warp(31n);
    const s = await settle(ben, asha);
    // relaxed Guest: τ = 0 → whole remaining obligation locked: 3 × $100.
    expect(s?.keepsafe).toBe(300n * USD);
    expect(s?.hostFee).toBe(4n * USD);
    expect(s?.paidNow).toBe(400n * USD - 4n * USD - 300n * USD);
  });

  it("night 2: Dee's auto-pay fails; the House Fund fronts it; Asha takes the kitty", async () => {
    await chain.drain(await dee.wallet(partyId), chain.treasury);
    chain.warpTo(dueAt(2) + 1n);
    for (const [g, i] of [[asha, 0], [ben, 1], [chen, 2]] as const) await collect(g, i);
    await chain.fails("collect dee", [
      await C.getCollectInstructionAsync({ signer: chain.relay, party, vault: await C.vaultPda(party), memberToken: await chain.ata((await dee.wallet(partyId)).address), treasury: chain.treasury, memberIdx: 3 }),
    ]);
    // Ben's chip-in released a third of his keepsafe.
    expect(member(IDX.ben).keepsafe).toBe(200n * USD);
    const d = await drawNight(0, 2); // pool: Asha, Chen (Dee is in grace)
    expect(d?.winnerIdx).toBe(IDX.asha);
    chain.warp(31n);
    const s = await settle(asha, asha);
    expect(s?.houseFronted).toBe(c);
    expect(member(IDX.dee).status).toBe(C.MEMBER_STATUS.GRACE);
  });

  it("grace hours end: Dee hadn't taken the kitty, so she's removed and the House Fund takes her seat", async () => {
    await expect(markDefault(IDX.dee)).rejects.toThrow(/GraceNotOver|Grace hours/);
    chain.warpTo(dueAt(2) + 121n);
    const ev = await markDefault(IDX.dee);
    expect(ev?.removed).toBe(true);
    expect(member(IDX.dee).status).toBe(C.MEMBER_STATUS.REMOVED);
    // A release receipt keeps Dee's Diary clear.
    expect(chain.tree.lastIndexOf(Z.receiptLeaf(dee.tag(partyId), partyId, 4n))).toBeGreaterThanOrEqual(0);
  });

  it("a plus-one stakes $10 behind Chen", async () => {
    await chain.faucet(voucher.address, 50n * USD);
    await chain.send("vouch", [
      await C.getVouchInstructionAsync({
        voucher, party, vault: await C.vaultPda(party), voucherToken: await chain.ata(voucher.address),
        vouch: await C.vouchPda(party, IDX.chen, voucher.address), memberIdx: IDX.chen, amount: 10n * USD,
      }),
    ], voucher);
    expect(member(IDX.chen).vouched).toBe(10n * USD);
  });

  it("night 3: Chen takes the kitty (Guest tier, τ = 0.25, minus the plus-one)", async () => {
    chain.warpTo(dueAt(3) + 1n);
    for (const [g, i] of [[asha, 0], [ben, 1], [chen, 2]] as const) await collect(g, i);
    const d = await drawNight(0, 2); // gated pool at night 3: Chen, Dee's House seat
    expect(d?.winnerIdx).toBe(IDX.chen);
    expect(d?.gateRelaxed).toBe(false);
    chain.warp(31n);
    const s = await settle(chen, asha);
    expect(s?.keepsafe).toBe(65n * USD); // 100 − 25 − 10
    expect(s?.paidNow).toBe(400n * USD - 4n * USD - 65n * USD);
    expect(s?.houseFronted).toBe(c); // the House seat's chip-in
  });

  it("night 4: Chen misses; the House seat takes the last kitty and Dee gets her refund minus 5%", async () => {
    await chain.drain(await chen.wallet(partyId), chain.treasury);
    chain.warpTo(dueAt(4) + 1n);
    for (const [g, i] of [[asha, 0], [ben, 1]] as const) await collect(g, i);
    const d = await drawNight(0, 1);
    expect(d?.winnerIdx).toBe(IDX.dee);
    chain.warp(31n);
    const deeToken = await chain.ata((await dee.wallet(partyId)).address);
    const before = chain.balance(deeToken);
    const s = await settle(dee, asha);
    expect(s?.toHouse).toBe(true);
    expect(chain.balance(deeToken) - before).toBe(95n * USD);
    expect(chain.party(party).status).toBe(C.PARTY_STATUS.FINISHED);
  });

  it("Chen's grace ends: the waterfall covers her last chip-in (keepsafe → plus-ones → House Fund)", async () => {
    chain.warpTo(dueAt(4) + 121n);
    const ev = await markDefault(IDX.chen);
    expect(ev?.removed).toBe(false);
    expect([ev?.fromKeepsafe, ev?.fromPlusOnes, ev?.fromHouse]).toEqual([65n * USD, 10n * USD, 25n * USD]);
    expect(member(IDX.chen).debt).toBe(25n * USD);
  });

  it("a guest on hold can't even prove an RSVP to a new party", async () => {
    // Chen's note still holds party 1 with no receipt for night 4 → the circuit refuses.
    const p2 = await C.partyPda(partyId + 1n);
    void p2;
    const fake = { ...chen };
    void fake;
    const a: Z.ActionInput = {
      mode: Z.MODE.JOIN, note: chen.note, newNonce: Z.nonceFor(chen.s, chen.note.k + 1n), tree: chain.tree,
      now: dueAt(4) + 200n + 10_000n, receipts: chen.receipts(chain), sel: [0, 1, 0, 0],
      params: { party: 99n, grace: 120n, start: 0n, period: 180n, rounds: 4n, unlockedByTier: Z.unlockedByTier(c, 4n), minTier: 0n, allowance: 150n * USD, wHi: 1n, wLo: 1n },
    };
    const { prove } = await import("./harness");
    await expect(prove(a)).rejects.toThrow();
  });
});

describe("after the party", () => {
  it("Farewell: Chen must settle up first", async () => {
    await expect(farewell(chen, IDX.chen)).rejects.toThrow(/SettleUpFirst|Settle up/);
  });

  it("settle up: $25 covered + one $2 late fee; the missing receipt is appended", async () => {
    const w = await chen.wallet(partyId);
    await chain.faucet(w.address, 27n * USD);
    const r = await chain.send("settle_up", [
      await C.getSettleUpInstructionAsync({ wallet: w, party, walletToken: await chain.ata(w.address) }),
    ]);
    const ev = r.events.find((e) => e.name === "SettledUp");
    expect(ev?.name === "SettledUp" && ev.data.amount).toBe(27n * USD);
    expect(chain.tree.lastIndexOf(Z.receiptLeaf(chen.tag(partyId), partyId, 4n))).toBeGreaterThanOrEqual(0);
  });

  it("Farewell for everyone, then each COMPLETE proof moves the party into the note", async () => {
    const results: Record<string, { paidRounds: number; lateCount: number; payout: bigint }> = {};
    for (const [g, i] of [[asha, 0], [ben, 1], [chen, 2], [dee, 3]] as const) {
      results[g.name] = await farewell(g, i);
      await g.complete(chain, party, results[g.name]);
    }
    expect(results.Asha.paidRounds).toBe(4);
    expect(results.Ben.paidRounds).toBe(4);
    expect(results.Dee.paidRounds).toBe(1);
    expect(asha.note.completed).toBe(1n);
    expect(ben.note.completed).toBe(1n);
    expect(chen.note.completed).toBe(0n); // released, not completed
    expect(dee.note.completed).toBe(0n);
    expect(asha.note.slots.every((s) => s.active === 0n)).toBe(true);
  });

  it("the plus-one's stake was used by the waterfall, so nothing comes back", async () => {
    const t = await chain.ata(voucher.address);
    const before = chain.balance(t);
    await chain.send("unvouch", [
      await C.getUnvouchInstructionAsync({ voucher, party, vault: await C.vaultPda(party), voucherToken: t, vouch: await C.vouchPda(party, IDX.chen, voucher.address) }),
    ], voucher);
    expect(chain.balance(t) - before).toBe(0n);
  });

  it("the party vault ends empty", async () => {
    expect(chain.balance(await C.vaultPda(party))).toBe(0n);
  });

  it("Show a page: Asha proves ≥1 party, ≥$400, never late; a bigger claim can't be proven", async () => {
    const claim = { minCompleted: 1n, minPaid: 400n * USD, maxLate: 0n, scope: 4242n, challenge: 777n };
    const r = await chain.send("verify_history", [await asha.historyIx(chain, claim)]);
    expect(r.events.some((e) => e.name === "HistoryVerified")).toBe(true);
    await expect(asha.historyIx(chain, { ...claim, minCompleted: 2n })).rejects.toThrow();
  });
});

describe("Seating plan: tonight's guest can't pay", () => {
  // Four Guests (tier 0: earliest seat is 3). Joining order Asha (host), Eve, Ben, Dee gives
  // Asha night 3, Eve night 4, then Ben night 1 and Dee night 2.
  let eve: Guest;
  it("seats the party", async () => {
    eve = await Guest.create("Eve");
    await eve.registerDev(chain);
    const cfg = chain.account((await C.configPda()) as Address, C.decodeConfig);
    partyId = cfg.nextPartyId;
    party = await C.partyPda(partyId);
    invite = C.newInviteSecret();
    const now = chain.now();
    await chain.send("create_party", [
      await C.getCreatePartyInstructionAsync({
        payer: chain.relay,
        host: await asha.wallet(partyId),
        party,
        vault: await C.vaultPda(party),
        mint: chain.mint.address,
        ...{
          chipIn: c, guests: 4, periodSecs: 180n, graceSecs: 120n,
          startTs: now + 600n, formationDeadline: now + 300n,
          mode: C.ORDER.SEATING, hostFeeBps: 100, minTier: 0,
          inviteKey: C.invitePublicKey(invite),
        },
      }),
    ]);
    for (const g of [asha, eve, ben, dee]) await g.rsvp(chain, party, invite);
    expect(chain.party(party).status).toBe(C.PARTY_STATUS.ACTIVE);
    expect([0, 1, 2, 3].map((i) => member(i).seat)).toEqual([3, 4, 1, 2]);
  });

  it("nights 1 and 2 go to Ben and Dee", async () => {
    chain.warpTo(dueAt(1) + 31n);
    expect((await settle(ben, asha))?.winnerIdx).toBe(2);
    chain.warpTo(dueAt(2) + 1n);
    for (const [g, i] of [[asha, 0], [eve, 1], [ben, 2], [dee, 3]] as const) await collect(g, i);
    chain.warp(31n);
    expect((await settle(dee, asha))?.winnerIdx).toBe(3);
  });

  it("night 3: Asha can't pay, so her night waits out her grace hours, then the House Fund takes it", async () => {
    await chain.drain(await asha.wallet(partyId), chain.treasury);
    chain.warpTo(dueAt(3) + 1n);
    for (const [g, i] of [[eve, 1], [ben, 2], [dee, 3]] as const) await collect(g, i);
    await expect(collect(asha, 0)).rejects.toThrow();
    chain.warp(31n);
    // Within her grace hours she can still pay, so the night waits for her.
    await expect(settle(asha, asha)).rejects.toThrow(/WinnerInGrace|grace hours/);
    chain.warpTo(dueAt(3) + 120n);
    // Grace over: this settle only ends her grace (no payout)…
    expect(await settle(asha, asha)).toBeUndefined();
    expect(member(0).status).toBe(C.MEMBER_STATUS.GRACE);
    chain.warp(1n);
    // …so she's removed, and the House Fund takes her seat; she gets back what she paid in minus 5%.
    expect((await markDefault(0))?.removed).toBe(true);
    const s = await settle(asha, asha);
    expect(s?.winnerIdx).toBe(0);
    expect(chain.party(party).currentRound).toBe(3);
    expect(chain.balance(await chain.ata((await asha.wallet(partyId)).address))).toBe(190n * USD + s!.hostFee);
  });

  it("night 4: Eve takes the last kitty and the party finishes", async () => {
    chain.warpTo(dueAt(4) + 1n);
    for (const [g, i] of [[eve, 1], [ben, 2], [dee, 3]] as const) await collect(g, i);
    chain.warp(31n);
    expect((await settle(eve, asha))?.winnerIdx).toBe(1);
    expect(chain.party(party).status).toBe(C.PARTY_STATUS.FINISHED);
  });
});
