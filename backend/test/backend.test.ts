import { describe, expect, it } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import {
  type Instruction,
  appendTransactionMessageInstructions,
  compileTransaction,
  createTransactionMessage,
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  lamports,
  partiallySignTransaction,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Blockhash,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { getApproveInstruction, getTransferInstruction } from "@solana-program/token";
import * as C from "@kitty/chain";
import { checkPolicy, decodeWire, PolicyError } from "../src/relay";
import { plan } from "../src/butler/plan";
import { openDb, schema } from "../src/db";
import { ingest } from "../src/indexer/ingest";
import { backupMessage, createApp } from "../src/api/app";

const BH = { blockhash: "11111111111111111111111111111111" as Blockhash, lastValidBlockHeight: 1n };

async function wire(feePayer: string, ixs: Instruction[]) {
  const msg = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(feePayer as never, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(BH, m),
    (m) => appendTransactionMessageInstructions(ixs, m),
  );
  return getBase64EncodedWireTransaction(compileTransaction(msg));
}

describe("relay policy (architecture 6.4)", () => {
  const ctx = async () => {
    const relay = await generateKeyPairSigner();
    const member = await generateKeyPairSigner();
    const party = await C.partyPda(1n);
    const payManual = await C.getPayManualInstructionAsync({
      signer: member, party, vault: await C.vaultPda(party), memberToken: member.address, treasury: member.address,
    });
    return { relay, member, party, payManual };
  };
  const check = async (feePayer: string, ixs: Instruction[], relay: string) => checkPolicy(decodeWire(await wire(feePayer, ixs)), relay as never);

  it("pays for a member's Kitty instruction", async () => {
    const { relay, payManual } = await ctx();
    expect(await check(relay.address, [payManual], relay.address)).toEqual(["payManual"]);
  });
  it("pays for an auto-pay approval", async () => {
    const { relay, member, party } = await ctx();
    const approve = getApproveInstruction({ source: member.address, delegate: party, owner: member, amount: 1n });
    expect(await check(relay.address, [approve], relay.address)).toEqual(["tokenApprove"]);
  });
  it("refuses when the relay isn't the fee payer", async () => {
    const { relay, member, payManual } = await ctx();
    await expect(check(member.address, [payManual], relay.address)).rejects.toThrow(PolicyError);
  });
  it("refuses SOL transfers out of the relay", async () => {
    const { relay, member } = await ctx();
    const drain = getTransferSolInstruction({ source: relay, destination: member.address, amount: lamports(1n) });
    await expect(check(relay.address, [drain], relay.address)).rejects.toThrow(/not allowed/);
  });
  it("refuses token transfers", async () => {
    const { relay, member } = await ctx();
    const t = getTransferInstruction({ source: member.address, destination: relay.address, authority: member, amount: 1n });
    await expect(check(relay.address, [t], relay.address)).rejects.toThrow(/approve/);
  });
  it("refuses admin and crank instructions", async () => {
    const { relay, member } = await ctx();
    const dev = await C.getRegisterDevInstructionAsync({ admin: member, marker: member.address, devNullifier: new Uint8Array(32), firstCommitment: new Uint8Array(32) });
    await expect(check(relay.address, [dev], relay.address)).rejects.toThrow(/registerDev/);
  });
  it("signs, but the member's own signature is still required", async () => {
    const { relay, member, payManual } = await ctx();
    const tx = decodeWire(await wire(relay.address, [payManual])).tx;
    const signed = await partiallySignTransaction([relay.keyPair], tx);
    expect(signed.signatures[member.address]).toBeNull();
  });
});
// ---------------------------------------------------------------- Butler

function member(over: Partial<C.Member> = {}): C.Member {
  return {
    keepsafe: 0n, keepsafeTotal: 0n, remaining: 0n, vouched: 0n, vouchSlashed: 0n, advance: 0n, debt: 0n, housePaid: 0n,
    graceDeadline: 0n, tag: new Uint8Array(32), wallet: "11111111111111111111111111111111" as never, tier: 0, isHost: 0, seat: 3,
    tookNight: 0, paidThrough: 1, ownPaid: 1, status: 0, lateCount: 0, missedNights: 0, gateRelaxed: 0, farewelled: 0, pad: new Uint8Array(5),
    ...over,
  } as C.Member;
}
function party(over: Partial<C.Party> = {}): C.Party {
  const members = Array.from({ length: 20 }, () => member());
  return {
    discriminator: new Uint8Array(8), id: 1n, chipIn: 100_000_000n, exposure: 0n, allowance: 0n, unlockedByTier: [0n, 0n, 0n],
    periodSecs: 180n, graceSecs: 120n, startTs: 1000n, formationDeadline: 900n, createdTs: 0n,
    hostWallet: "11111111111111111111111111111111" as never, inviteKey: "11111111111111111111111111111111" as never, vault: "11111111111111111111111111111111" as never,
    drawSeed: new Uint8Array(32), hostFeeBps: 100, guests: 4, mode: 0, minTier: 0, status: 1, currentRound: 0, joined: 4,
    drawRound: 0, drawWinner: 255, drawRelaxed: 0, bump: 0, vaultBump: 0, pad: new Uint8Array(3), members, ...over,
  } as C.Party;
}

describe("Butler schedule (architecture 7.4)", () => {
  const cfg = { collectWindowSecs: 30 };
  it("does nothing before a night is due", () => {
    expect(plan(party(), 999, cfg)).toEqual([]);
  });
  it("collects unpaid guests when night 2 is due, then draws after the window", () => {
    const p = party({ currentRound: 1 });
    expect(plan(p, 1180, cfg).map((c) => c.kind)).toEqual(["collect", "collect", "collect", "collect"]);
    expect(plan(p, 1210, cfg).map((c) => c.kind)).toContain("requestDraw");
  });
  it("resolves a requested Draw, then settles", () => {
    expect(plan(party({ drawRound: 1 }), 1010, cfg).map((c) => c.kind)).toContain("resolveDraw");
    expect(plan(party({ drawRound: 1, drawWinner: 2 }), 1031, cfg)).toContainEqual({ kind: "settle", round: 1, winner: 2 });
  });
  it("defaults a guest whose grace hours ended", () => {
    const p = party();
    p.members[1] = member({ status: 1, graceDeadline: 1100n });
    expect(plan(p, 1101, cfg)).toContainEqual({ kind: "markDefault", member: 1 });
  });
  it("cancels a party that didn't fill, and farewells everyone after the last night", () => {
    expect(plan(party({ status: 0, joined: 2 }), 901, cfg)).toEqual([{ kind: "cancel" }]);
    const done = party({ status: 2, currentRound: 4 });
    done.members[3] = member({ status: 2 });
    expect(plan(done, 5000, cfg).filter((c) => c.kind === "farewell").map((c) => ("member" in c ? c.member : -1))).toEqual([0, 1, 2]);
  });
  it("seating plan: settles with the seat-holder", () => {
    const p = party({ mode: 1 });
    p.members[2] = member({ seat: 1 });
    expect(plan(p, 1031, cfg)).toContainEqual({ kind: "settle", round: 1, winner: 2 });
  });
  it("seating plan: an unpaid seat-holder's night waits out their grace hours, then settle ends it", () => {
    const p = party({ mode: 1, currentRound: 2 });
    p.members[0] = member({ seat: 3, paidThrough: 2 }); // night 3 is due at 1360, grace until 1480
    expect(plan(p, 1400, cfg).map((c) => c.kind)).not.toContain("settle");
    expect(plan(p, 1480, cfg)).toContainEqual({ kind: "settle", round: 3, winner: 0 });
    p.members[0] = member({ seat: 3, paidThrough: 2, status: 1, graceDeadline: 1480n });
    expect(plan(p, 1481, cfg).map((c) => c.kind)).toEqual(expect.arrayContaining(["markDefault"]));
    expect(plan(p, 1481, cfg).map((c) => c.kind)).not.toContain("settle");
  });
});

// ---------------------------------------------------------------- indexer + API

describe("indexer and API", () => {
  const dbp = openDb("", { memory: true });
  const leaf = { name: "LeafAppended" as const, index: 0, data: { index: 0n, leaf: new Uint8Array(32).fill(7), kind: 1, root: new Uint8Array(32) } };

  it("ingests events idempotently", async () => {
    const db = await dbp;
    await ingest(db, { signature: "sig1", slot: 5, blockTime: 1, events: [leaf as never] });
    await ingest(db, { signature: "sig1", slot: 5, blockTime: 1, events: [leaf as never] });
    expect((await db.select().from(schema.events)).length).toBe(1);
    const rows = await db.select().from(schema.leaves);
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe("07".repeat(32));
  });

  it("stores a signed Diary backup and refuses another device's overwrite", async () => {
    const db = await dbp;
    const app = createApp({ db, relay: null, faucet: null, mint: null });
    const key = "ab".repeat(32);
    const sk = ed25519.utils.randomSecretKey();
    const pk = Buffer.from(ed25519.getPublicKey(sk)).toString("hex");
    const put = (secret: Uint8Array, pubkey: string, version: number) => {
      const ciphertext = Buffer.from(`blob-${version}`).toString("base64");
      const signature = Buffer.from(ed25519.sign(backupMessage(key, version, ciphertext), secret)).toString("base64");
      return app.request(`/v1/backup/${key}`, { method: "PUT", body: JSON.stringify({ pubkey, ciphertext, version, signature }), headers: { "content-type": "application/json" } });
    };
    expect((await put(sk, pk, 1)).status).toBe(200);
    const other = ed25519.utils.randomSecretKey();
    expect((await put(other, Buffer.from(ed25519.getPublicKey(other)).toString("hex"), 2)).status).toBe(403);
    const got = await (await app.request(`/v1/backup/${key}`)).json();
    expect(got.version).toBe(1);
  });
});
