/** A simulated member device: secret, note, party wallets, and the proofs it builds. */
import { type Address, type KeyPairSigner, generateKeyPairSigner, getAddressEncoder } from "@solana/kit";
import * as Z from "@kitty/zk";
import * as C from "../src";
import { type Chain, prove } from "./harness";

const addrBytes = (a: Address) => new Uint8Array(getAddressEncoder().encode(a));
const rand32 = () => crypto.getRandomValues(new Uint8Array(32));

export class Guest {
  note!: Z.Note;
  wallets = new Map<bigint, KeyPairSigner>();
  constructor(readonly name: string, readonly s: bigint) {}

  static async create(name: string): Promise<Guest> {
    const g = new Guest(name, Z.bytesToBig(rand32()) % Z.FIELD);
    g.note = Z.freshNote(g.s);
    return g;
  }

  /** One wallet per party (the app derives it from s and the party id). */
  async wallet(partyId: bigint): Promise<KeyPairSigner> {
    let w = this.wallets.get(partyId);
    if (!w) {
      w = await generateKeyPairSigner();
      this.wallets.set(partyId, w);
    }
    return w;
  }
  tag(partyId: bigint) {
    return Z.tagOf(this.s, partyId);
  }

  async registerDev(chain: Chain) {
    const n = rand32();
    return chain.send("register_dev", [
      await C.getRegisterDevInstructionAsync({
        admin: chain.admin,
        marker: await C.registrationPda(n),
        devNullifier: n,
        firstCommitment: Z.bigToBytes32(Z.noteCommitment(this.note)),
      }),
    ]);
  }

  /** Receipts for every active party in the note (good standing). */
  receipts(chain: Chain): Record<number, { paidThrough: bigint; index: number }> {
    const out: Record<number, { paidThrough: bigint; index: number }> = {};
    this.note.slots.forEach((slot, k) => {
      if (slot.active !== 1n) return;
      for (let paid = slot.rounds; paid >= 1n; paid--) {
        const i = chain.tree.lastIndexOf(Z.receiptLeaf(this.tag(slot.party), slot.party, paid));
        if (i >= 0) {
          out[k] = { paidThrough: paid, index: i };
          return;
        }
      }
    });
    return out;
  }

  async joinProof(chain: Chain, partyAddr: Address) {
    const p = chain.party(partyAddr);
    const w = await this.wallet(p.id);
    const ws = Z.walletSplit(addrBytes(w.address));
    const sel = [0, 0, 0, 0];
    sel[this.note.slots.findIndex((x) => x.active === 0n)] = 1;
    const a: Z.ActionInput = {
      mode: Z.MODE.JOIN,
      note: this.note,
      newNonce: Z.nonceFor(this.s, this.note.k + 1n),
      tree: chain.tree,
      now: chain.now(),
      receipts: this.receipts(chain),
      sel,
      params: {
        party: p.id, grace: p.graceSecs, start: p.startTs, period: p.periodSecs, rounds: BigInt(p.guests),
        unlockedByTier: [p.unlockedByTier[0], p.unlockedByTier[1], p.unlockedByTier[2]],
        minTier: BigInt(p.minTier), allowance: p.allowance, wHi: ws.hi, wLo: ws.lo,
      },
    };
    return { a, w, ...(await prove(a)) };
  }

  async rsvpIx(chain: Chain, partyAddr: Address, inviteSecret: Uint8Array, proofFor?: Awaited<ReturnType<Guest["joinProof"]>>, wallet?: KeyPairSigner) {
    const p = chain.party(partyAddr);
    const jp = proofFor ?? (await this.joinProof(chain, partyAddr));
    const w = wallet ?? jp.w;
    const sig = jp.signals;
    return {
      jp,
      ixs: [
        C.inviteSignatureInstruction(inviteSecret, p.id, w.address),
        await C.getRsvpInstructionAsync({
          payer: chain.relay,
          wallet: w,
          party: partyAddr,
          nullifierMarker: await C.nullifierPda(sig.nullifier),
          walletToken: await chain.ata(w.address),
          ...{
            proof: jp.proof,
            nullifier: sig.nullifier,
            newCommitment: sig.outCommitment,
            tag: sig.outTag,
            tier: Number(sig.outClaim),
            root: sig.root,
            now: sig.now,
          },
        }),
      ],
    };
  }

  /** Approve auto-pay, RSVP, first chip-in: the three RSVP transactions (flow 3). */
  async rsvp(chain: Chain, partyAddr: Address, inviteSecret: Uint8Array) {
    const p = chain.party(partyAddr);
    const w = await this.wallet(p.id);
    const perNight = p.chipIn + 2n * ((p.chipIn * 50n + 5000n) / 10000n);
    await chain.faucet(w.address, perNight * BigInt(p.guests) * 2n);
    await chain.approve(w, partyAddr, perNight * BigInt(p.guests - 1));
    const { jp, ixs } = await this.rsvpIx(chain, partyAddr, inviteSecret);
    const sent = await chain.send("rsvp", ixs);
    this.note = Z.nextNote(jp.a);
    await this.payManual(chain, partyAddr);
    return sent;
  }

  async payManual(chain: Chain, partyAddr: Address) {
    const p = chain.party(partyAddr);
    const w = await this.wallet(p.id);
    return chain.send("pay_manual", [
      await C.getPayManualInstructionAsync({
        signer: w,
        party: partyAddr,
        vault: await C.vaultPda(partyAddr),
        memberToken: await chain.ata(w.address),
        treasury: chain.treasury,
      }),
    ]);
  }

  /** Farewell's COMPLETE proof: move the party into the note's history. */
  async complete(chain: Chain, partyAddr: Address, farewell: { paidRounds: number; lateCount: number }) {
    const p = chain.party(partyAddr);
    const w = await this.wallet(p.id);
    const ws = Z.walletSplit(addrBytes(w.address));
    const leaf = Z.completionLeaf(this.tag(p.id), p.id, farewell.paidRounds, farewell.lateCount, p.chipIn);
    const index = chain.tree.lastIndexOf(leaf);
    if (index < 0) throw new Error("no completion leaf");
    const sel = this.note.slots.map((x) => (x.active === 1n && x.party === p.id ? 1 : 0));
    const a: Z.ActionInput = {
      mode: Z.MODE.COMPLETE,
      note: this.note,
      newNonce: Z.nonceFor(this.s, this.note.k + 1n),
      tree: chain.tree,
      now: chain.now(),
      sel,
      params: { party: p.id, chipIn: p.chipIn, rounds: BigInt(p.guests), wHi: ws.hi, wLo: ws.lo },
      completion: { paidRounds: BigInt(farewell.paidRounds), lateCount: BigInt(farewell.lateCount), index },
    };
    const { proof, signals } = await prove(a);
    const sent = await chain.send("update_note", [
      await C.getUpdateNoteInstructionAsync({
        payer: chain.relay,
        wallet: w,
        party: partyAddr,
        nullifierMarker: await C.nullifierPda(signals.nullifier),
        ...{ proof, nullifier: signals.nullifier, newCommitment: signals.outCommitment, tag: signals.outTag, root: signals.root, now: signals.now },
      }),
    ]);
    this.note = Z.nextNote(a);
    return sent;
  }

  async historyIx(chain: Chain, claim: { minCompleted: bigint; minPaid: bigint; maxLate: bigint; scope: bigint; challenge: bigint }) {
    const a: Z.ActionInput = { mode: Z.MODE.HISTORY, note: this.note, tree: chain.tree, now: chain.now(), receipts: this.receipts(chain), params: claim };
    const { proof, signals } = await prove(a);
    return C.getVerifyHistoryInstructionAsync({
      nullifierMarker: await C.nullifierPda(signals.nullifier),
      ...{
        proof, nullifier: signals.nullifier, pseudonym: signals.outTag, root: signals.root, now: signals.now,
        minCompleted: claim.minCompleted, minPaid: claim.minPaid, maxLate: claim.maxLate,
        scope: Z.bigToBytes32(claim.scope), challenge: Z.bigToBytes32(claim.challenge),
      },
    });
  }
}
