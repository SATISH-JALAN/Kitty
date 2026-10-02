"use client";
/**
 * The member's flows (architecture 9), end to end: proofs on this device, transactions through
 * the fee relay, the Diary updated after each step.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { type Address, address, createNoopSigner, getAddressEncoder, signBytes } from "@solana/kit";
import { findAssociatedTokenPda, getApproveInstruction, getCreateAssociatedTokenIdempotentInstruction, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import * as C from "@kitty/chain";
import { type DiaryParty, inviteSecretFor, partyWallet, toBase64 } from "@kitty/diary";
import { prover, Comlink } from "@kitty/zk/client";
import { actionArtifacts, apiGet, apiSend, chainConfig } from "./api";
import { update, useDevice } from "./device";
import { syncTree, waitForLeaf } from "./tree";
import { TxError, relay, rpc } from "./tx";

const hex = (b: ArrayLike<number>) => Array.from(b as ArrayLike<number>, (x) => x.toString(16).padStart(2, "0")).join("");
/** The chain's clock (proofs are checked against it, within config.nowToleranceSecs), so a
 *  device with a wrong clock still proves. Falls back to this device's clock. */
export async function chainNow(): Promise<number> {
  const local = Math.floor(Date.now() / 1000);
  const r = await apiGet<{ unixTimestamp: number }>("/v1/clock").catch(() => null);
  return r?.unixTimestamp ?? local;
}

function ready() {
  const d = useDevice.getState();
  if (d.status !== "ready" || !d.identity || !d.s) throw new Error("Sign in first");
  return { identity: d.identity, s: d.s, diary: d.diary };
}

async function relayer() {
  const cfg = await chainConfig();
  if (!cfg.relay) throw new TxError("The fee relay is offline");
  return createNoopSigner(address(cfg.relay));
}

async function configAccount() {
  return (await C.fetchConfig(await rpc(), await C.configPda())).data;
}

export async function partyAccount(id: bigint) {
  const a = await C.partyPda(id);
  return { address: a, data: (await C.fetchParty(await rpc(), a)).data };
}

async function tokenAccount(owner: Address): Promise<Address> {
  const [ata] = await findAssociatedTokenPda({ owner, mint: address((await chainConfig()).mint), tokenProgram: TOKEN_PROGRAM_ADDRESS });
  return ata;
}

async function balance(ata: Address): Promise<bigint> {
  try {
    const { value } = await (await rpc()).getTokenAccountBalance(ata).send();
    return BigInt(value.amount);
  } catch {
    return 0n;
  }
}

/** Devnet: top up a party wallet from the shared faucet when it can't cover `need`. */
export async function ensureFunds(owner: Address, need: bigint) {
  if ((await balance(await tokenAccount(owner))) >= need) return;
  await apiSend("/v1/faucet", { wallet: owner });
  for (let i = 0; i < 20 && (await balance(await tokenAccount(owner))) < need; i++) await new Promise((r) => setTimeout(r, 1500));
}

const perNight = (chipIn: bigint, fees: { protocolBps: number; coverBps: number }) =>
  chipIn + (chipIn * BigInt(fees.protocolBps) + 5000n) / 10000n + (chipIn * BigInt(fees.coverBps) + 5000n) / 10000n;

export type StepUpdate = (i: number, status: "working" | "done" | "error", detail?: string) => void;

// ---------------------------------------------------------------- Guest Pass (flow 1)

export async function makeTestQr(): Promise<string> {
  return prover().makeTestQr();
}

export type PassStep = "keys" | "proof" | "send";
export async function register(qrData: string, onEvent: (step: PassStep, progress: number | null, detail?: string) => void) {
  const { s } = ready();
  const p = prover();
  const { note, commitment } = await p.freshNote(s);
  onEvent("keys", 0, "Checking for saved keys");
  const r = await p.proveRegistration(
    qrData,
    C.KITTY_NULLIFIER_SEED.toString(),
    commitment,
    Comlink.proxy((e: { step: "keys" | "proof"; loaded?: number; total?: number }) => {
      if (e.step === "keys" && e.total) onEvent("keys", e.loaded! / e.total, `Downloading keys · ${Math.round(e.loaded! / 1e6)} / ${Math.round(e.total / 1e6)} MB · once only`);
      if (e.step === "proof") {
        onEvent("keys", 1);
        onEvent("proof", null);
      }
    }),
  );
  onEvent("proof", 1);
  onEvent("send", null);
  const ix = await C.getRegisterInstructionAsync({
    payer: await relayer(),
    marker: await C.registrationPda(r.signals.nullifier),
    proof: r.proof,
    nullifier: r.signals.nullifier,
    timestamp: r.signals.timestamp,
    firstCommitment: hexToBytes(BigInt(commitment).toString(16).padStart(64, "0")),
  });
  const signature = await relay([ix], 400_000);
  await update((d) => ({ ...d, note, registration: { nullifier: hex(r.signals.nullifier), at: new Date().toISOString() } }));
  onEvent("send", 1);
  return { signature };
}

function hexToBytes(h: string): Uint8Array {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(2 * i, 2 * i + 2), 16);
  return out;
}

// ---------------------------------------------------------------- host a party (flow 2)

export interface PartyForm {
  title: string;
  word: string;
  tradition: string;
  chipIn: bigint;
  guests: number;
  periodSecs: number;
  graceSecs: number;
  startTs: number;
  formationDeadline: number;
  mode: "draw" | "seating";
  hostFeeBps: number;
}

export async function createParty(f: PartyForm): Promise<{ id: bigint; link: string; signature: string }> {
  const { identity } = ready();
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = BigInt((await chainConfig(true)).nextPartyId);
    const host = await partyWallet(identity.seed, id);
    const secret = inviteSecretFor(identity.seed, id);
    const party = await C.partyPda(id);
    try {
      const signature = await relay([
        await C.getCreatePartyInstructionAsync({
          payer: await relayer(),
          host,
          party,
          vault: await C.vaultPda(party),
          mint: address((await chainConfig()).mint),
          chipIn: f.chipIn,
          guests: f.guests,
          periodSecs: BigInt(f.periodSecs),
          graceSecs: BigInt(f.graceSecs),
          startTs: BigInt(f.startTs),
          formationDeadline: BigInt(f.formationDeadline),
          mode: f.mode === "seating" ? C.ORDER.SEATING : C.ORDER.DRAW,
          hostFeeBps: f.hostFeeBps,
          minTier: 0,
          inviteKey: C.invitePublicKey(secret),
        }),
      ]);
      // Public metadata (tradition word, title), signed by the host's party wallet.
      const enc = new TextEncoder();
      const digest = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(JSON.stringify([f.title, f.word, f.tradition])))));
      const sig = await signBytes(host.keyPair.privateKey, enc.encode(`kitty-meta:${id}:${digest}`));
      await apiSend(`/v1/parties/${id}/meta`, { title: f.title, word: f.word, tradition: f.tradition, signature: toBase64(sig) }).catch(() => undefined);
      await update((d) => ({
        ...d,
        parties: { ...d.parties, [id.toString()]: { tag: "", address: party, host: true, wallet: host.address, title: f.title } },
      }));
      return { id, link: inviteLink(id, secret), signature };
    } catch (e) {
      // Another host took this party id a moment ago: try the next one.
      if (e instanceof TxError && e.code === "AlreadyInUse") continue;
      throw e;
    }
  }
  throw new TxError("Couldn't create the party. Try again.");
}

export function inviteLink(id: bigint, secret: Uint8Array) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/invite/${id}#k=${C.encodeInviteSecret(secret)}`;
}

/** The host's invite link, re-derived from their seed. */
export function hostInviteLink(id: bigint): string | null {
  const d = useDevice.getState();
  if (!d.identity || !d.diary.parties[id.toString()]?.host) return null;
  return inviteLink(id, inviteSecretFor(d.identity.seed, id));
}

// ---------------------------------------------------------------- RSVP (flow 3)

export const RSVP_STEPS = ["Build proof", "Approve auto-pay", "RSVP", "First chip-in"] as const;

export async function rsvp(id: bigint, inviteSecret: Uint8Array, onStep: StepUpdate) {
  const { identity, s, diary } = ready();
  if (!diary.note) throw new Error("Get your Guest Pass first");
  const cfg = await configAccount();
  const fees = (await chainConfig()).fees;
  const { address: party, data: p } = await partyAccount(id);
  const wallet = await partyWallet(identity.seed, id);
  const ata = await tokenAccount(wallet.address);
  const nightly = perNight(p.chipIn, fees);

  onStep(0, "working");
  await syncTree();
  const proof = await prover().proveAction(
    {
      mode: 0,
      note: diary.note,
      now: await chainNow(),
      wallet: new Uint8Array(getAddressEncoder().encode(wallet.address)),
      params: {
        party: id.toString(), grace: p.graceSecs.toString(), start: p.startTs.toString(), period: p.periodSecs.toString(),
        rounds: String(p.guests), unlockedByTier: p.unlockedByTier.map(String), minTier: String(p.minTier), allowance: p.allowance.toString(),
      },
    },
    await actionArtifacts(),
    Comlink.proxy((e: { step: string; loaded?: number; total?: number }) => {
      if (e.step === "keys" && e.total) onStep(0, "working", `Proving keys · ${Math.round((e.loaded! / e.total) * 100)}%`);
    }),
  );
  onStep(0, "done");

  onStep(1, "working");
  await ensureFunds(wallet.address, nightly * BigInt(p.guests));
  const relayerSigner = await relayer();
  await relay([
    getCreateAssociatedTokenIdempotentInstruction({ payer: relayerSigner, ata, owner: wallet.address, mint: address((await chainConfig()).mint) }),
    getApproveInstruction({ source: ata, delegate: party, owner: wallet, amount: nightly * BigInt(p.guests - 1) }),
  ]);
  onStep(1, "done");

  onStep(2, "working");
  const sig = proof.signals;
  await relay([
    C.inviteSignatureInstruction(inviteSecret, id, wallet.address),
    await C.getRsvpInstructionAsync({
      payer: relayerSigner,
      wallet,
      party,
      nullifierMarker: await C.nullifierPda(sig.nullifier),
      walletToken: ata,
      proof: proof.proof,
      nullifier: sig.nullifier,
      newCommitment: sig.outCommitment,
      tag: sig.outTag,
      tier: Number(sig.outClaim),
      root: sig.root,
      now: sig.now,
    }),
  ], 400_000);
  const entry: DiaryParty = { ...(diary.parties[id.toString()] ?? {}), tag: hex(sig.outTag), address: party, wallet: wallet.address, joinedAt: new Date().toISOString() };
  await update((d) => ({ ...d, note: proof.nextNote, parties: { ...d.parties, [id.toString()]: entry } }));
  onStep(2, "done");

  onStep(3, "working");
  await payManual(id, cfg.treasury);
  onStep(3, "done");
}

// ---------------------------------------------------------------- chip in, settle up (flows 4, 6, 7)

export async function payManual(id: bigint, treasury?: Address) {
  const { identity } = ready();
  const { address: party } = await partyAccount(id);
  const wallet = await partyWallet(identity.seed, id);
  return relay([
    await C.getPayManualInstructionAsync({
      signer: wallet,
      party,
      vault: await C.vaultPda(party),
      memberToken: await tokenAccount(wallet.address),
      treasury: treasury ?? (await configAccount()).treasury,
    }),
  ]);
}

export async function chipIn(id: bigint) {
  const { identity } = ready();
  const { data: p } = await partyAccount(id);
  const wallet = await partyWallet(identity.seed, id);
  const fees = (await chainConfig()).fees;
  const m = p.members.slice(0, p.joined).find((x) => x.wallet === wallet.address);
  const owed = m && m.status === C.MEMBER_STATUS.GRACE ? BigInt(p.currentRound - m.paidThrough) : 1n;
  await ensureFunds(wallet.address, (perNight(p.chipIn, fees) + (p.chipIn * BigInt(fees.lateBps)) / 10000n) * owed);
  return payManual(id);
}

export async function settleUp(id: bigint) {
  const { identity } = ready();
  const { address: party, data: p } = await partyAccount(id);
  const wallet = await partyWallet(identity.seed, id);
  const m = p.members.slice(0, p.joined).find((x) => x.wallet === wallet.address);
  if (!m) throw new Error("Not your party");
  const fees = (await chainConfig()).fees;
  await ensureFunds(wallet.address, m.debt + BigInt(m.missedNights) * ((p.chipIn * BigInt(fees.lateBps) + 5000n) / 10000n));
  return relay([await C.getSettleUpInstructionAsync({ wallet, party, walletToken: await tokenAccount(wallet.address) })]);
}

// ---------------------------------------------------------------- Farewell (flow 8)

/** After the Butler's Farewell: prove COMPLETE and move the party into the note's history. */
export async function completeParty(id: bigint) {
  const { identity, diary } = ready();
  if (!diary.note) throw new Error("No note");
  const { address: party, data: p } = await partyAccount(id);
  const wallet = await partyWallet(identity.seed, id);
  const idx = p.members.slice(0, p.joined).findIndex((x) => x.wallet === wallet.address);
  const m = p.members[idx];
  if (idx < 0 || m.farewelled !== 1) throw new Error("Farewell hasn't happened yet");
  const farewell = { paidRounds: p.status === C.PARTY_STATUS.CANCELLED ? 0 : m.ownPaid, lateCount: m.lateCount };
  await syncTree();
  const proof = await prover().proveAction(
    {
      mode: 1,
      note: diary.note,
      now: await chainNow(),
      wallet: new Uint8Array(getAddressEncoder().encode(wallet.address)),
      params: { party: id.toString(), chipIn: p.chipIn.toString(), rounds: String(p.guests) },
      completion: farewell,
    },
    await actionArtifacts(),
  );
  const sig = proof.signals;
  await relay([
    await C.getUpdateNoteInstructionAsync({
      payer: await relayer(),
      wallet,
      party,
      nullifierMarker: await C.nullifierPda(sig.nullifier),
      proof: proof.proof,
      nullifier: sig.nullifier,
      newCommitment: sig.outCommitment,
      tag: sig.outTag,
      root: sig.root,
      now: sig.now,
    }),
  ], 400_000);
  await update((d) => ({
    ...d,
    note: proof.nextNote,
    parties: { ...d.parties, [id.toString()]: { ...d.parties[id.toString()], farewell, completedAt: new Date().toISOString() } },
  }));
}

// ---------------------------------------------------------------- Show a page (flow 9)

export interface Claim {
  minCompleted: number;
  minPaid: bigint;
  maxLate: number;
  scopeLabel: string;
}

export async function showPage(claim: Claim, onStep?: StepUpdate): Promise<{ id: string; url: string }> {
  const { diary } = ready();
  if (!diary.note) throw new Error("Get your Guest Pass first");
  const enc = new TextEncoder();
  // A field element from the reader's name: 31 bytes of SHA-256, so it fits under the BN254 modulus.
  const field = (s: string) => BigInt("0x" + hex(sha256(enc.encode(s))).slice(0, 62));
  const scope = field(`kitty-scope:${claim.scopeLabel.trim().toLowerCase()}`);
  const challenge = BigInt("0x" + hex(crypto.getRandomValues(new Uint8Array(31))));
  onStep?.(0, "working");
  await syncTree();
  const params = { minCompleted: String(claim.minCompleted), minPaid: claim.minPaid.toString(), maxLate: String(claim.maxLate), scope: scope.toString(), challenge: challenge.toString() };
  const proof = await prover().proveAction({ mode: 2, note: diary.note, now: await chainNow(), params }, await actionArtifacts());
  onStep?.(0, "done");
  onStep?.(1, "working");
  const { id } = await apiSend<{ id: string }>("/v1/pages", { claim: params, scopeLabel: claim.scopeLabel, proof: proof.rawProof, publicSignals: proof.publicSignals });
  await update((d) => ({ ...d, pages: [...d.pages, { id, createdAt: new Date().toISOString(), label: claim.scopeLabel }] }));
  onStep?.(1, "done");
  return { id, url: `${window.location.origin}/verify/${id}` };
}

/** Optional: check a page's HISTORY proof with the program (`verify_history`) through the relay. */
export async function verifyPageOnChain(pageId: string): Promise<string> {
  const { apiGet } = await import("./api");
  const { proofToSolana, actionSignals } = await import("@kitty/zk/solana");
  const pg = await apiGet<{ claim: Record<string, string>; proof: unknown; publicSignals: string[] }>(`/v1/pages/${pageId}`);
  const s = actionSignals(pg.publicSignals);
  const b32 = (x: string) => hexToBytes(BigInt(x).toString(16).padStart(64, "0"));
  return relay([
    await C.getVerifyHistoryInstructionAsync({
      nullifierMarker: await C.nullifierPda(s.nullifier),
      proof: proofToSolana(pg.proof as never),
      nullifier: s.nullifier,
      pseudonym: s.outTag,
      root: s.root,
      now: s.now,
      minCompleted: BigInt(pg.claim.minCompleted),
      minPaid: BigInt(pg.claim.minPaid),
      maxLate: BigInt(pg.claim.maxLate),
      scope: b32(pg.claim.scope),
      challenge: b32(pg.claim.challenge),
    }),
  ], 400_000);
}

// ---------------------------------------------------------------- plus-ones

export async function vouchFor(id: bigint, memberIdx: number, amount: bigint) {
  const { identity } = ready();
  const { address: party } = await partyAccount(id);
  const voucher = await partyWallet(identity.seed, id);
  await ensureFunds(voucher.address, amount);
  return relay([
    await C.getVouchInstructionAsync({
      voucher, party, vault: await C.vaultPda(party), voucherToken: await tokenAccount(voucher.address),
      vouch: await C.vouchPda(party, memberIdx, voucher.address), memberIdx, amount,
    }),
  ]);
}

// ---------------------------------------------------------------- faucet

export async function faucet(): Promise<string> {
  const { identity } = ready();
  // Test funds go to a wallet used only for that (party wallets top themselves up as needed).
  const w = await partyWallet(identity.seed, 0n);
  const r = await apiSend<{ signature: string }>("/v1/faucet", { wallet: w.address });
  return r.signature;
}
