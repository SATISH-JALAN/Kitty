/**
 * LiteSVM harness for the Kitty program: a fresh chain with kUSD, the program, a House Fund and a
 * device-side mirror of the Kitty tree built from `LeafAppended` events (exactly what the app
 * does from the indexer). Proofs are real Groth16 proofs from circuits/keys.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { FailedTransactionMetadata, LiteSVM, type TransactionMetadata } from "litesvm";
import {
  type Address,
  type Instruction,
  type KeyPairSigner,
  type TransactionSigner,
  appendTransactionMessageInstructions,
  createTransactionMessage,
  generateKeyPairSigner,
  getAddressEncoder,
  getTransactionEncoder,
  lamports,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getApproveInstruction,
  getCreateAssociatedTokenIdempotentInstruction,
  getInitializeMint2Instruction,
  getMintSize,
  getMintToInstruction,
  getTransferInstruction,
  decodeToken,
} from "@solana-program/token";
import { getSetComputeUnitLimitInstruction } from "@solana-program/compute-budget";
import * as snarkjs from "snarkjs";
import * as Z from "@kitty/zk";
import * as C from "../src";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "../../../..");
const KEYS = join(ROOT, "circuits/keys");

export const USD = 1_000_000n;

export interface Sent {
  meta: TransactionMetadata;
  events: C.ProgramEvent[];
  cu: bigint;
  size: number;
}

export class Chain {
  svm: LiteSVM;
  tree!: Z.Tree;
  admin!: KeyPairSigner;
  relay!: KeyPairSigner;
  mint!: KeyPairSigner;
  treasury!: Address;
  cu: Record<string, bigint[]> = {};
  sizes: Record<string, number[]> = {};

  constructor() {
    this.svm = new LiteSVM();
    this.svm.addProgramFromFile(C.KITTY_PROGRAM_ADDRESS, join(ROOT, "contracts/build/kitty.so"));
  }

  async setup(opts: { nullifierSeed?: bigint } = {}) {
    await Z.initPoseidon();
    this.tree = new Z.Tree();
    this.warpTo(1_790_000_000n);
    this.admin = await this.fundedSigner();
    this.relay = await this.fundedSigner();
    this.mint = await generateKeyPairSigner();
    const rent = this.svm.minimumBalanceForRentExemption(BigInt(getMintSize()));
    await this.send("mint", [
      getCreateAccountInstruction({ payer: this.admin, newAccount: this.mint, lamports: lamports(rent), space: getMintSize(), programAddress: TOKEN_PROGRAM_ADDRESS }),
      getInitializeMint2Instruction({ mint: this.mint.address, decimals: 6, mintAuthority: this.admin.address }),
    ], this.admin);
    this.treasury = await this.ata(this.admin.address);
    await this.send("initialize", [
      await C.getInitializeInstructionAsync({
        admin: this.admin,
        mint: this.mint.address,
        treasury: this.treasury,
        args: {
          protocolBps: 50, coverBps: 50, lateBps: 200, maxHostBps: 200,
          minGraceSecs: 60n, collectWindowSecs: 30n, nowToleranceSecs: 120n,
          allowance: 150n * USD,
          aadhaarPubkeyHash: Z.bigToBytes32(C.AADHAAR_TEST_PUBKEY_HASH),
          nullifierSeed: opts.nullifierSeed ?? C.KITTY_NULLIFIER_SEED,
          devRegister: true, paused: false,
        },
      }),
    ], this.admin);
  }

  // ------------------------------------------------------------ accounts and money

  async fundedSigner(sol = 10n): Promise<KeyPairSigner> {
    const s = await generateKeyPairSigner();
    this.svm.airdrop(s.address, lamports(sol * 1_000_000_000n));
    return s;
  }

  /** The owner's kUSD token account (created if missing). */
  async ata(owner: Address): Promise<Address> {
    const [ata] = await findAssociatedTokenPda({ owner, mint: this.mint.address, tokenProgram: TOKEN_PROGRAM_ADDRESS });
    if (!this.svm.getAccount(ata).exists) {
      await this.send("ata", [getCreateAssociatedTokenIdempotentInstruction({ payer: this.relay, ata, owner, mint: this.mint.address })], this.relay);
    }
    return ata;
  }

  async faucet(owner: Address, amount: bigint): Promise<Address> {
    const ata = await this.ata(owner);
    await this.send("faucet", [getMintToInstruction({ mint: this.mint.address, token: ata, mintAuthority: this.admin, amount })], this.admin);
    return ata;
  }

  balance(tokenAccount: Address): bigint {
    const a = this.svm.getAccount(tokenAccount);
    if (!a.exists) return 0n;
    return decodeToken(a).data.amount;
  }

  async drain(owner: KeyPairSigner, to: Address) {
    const from = await this.ata(owner.address);
    await this.send("drain", [getTransferInstruction({ source: from, destination: to, authority: owner, amount: this.balance(from) })], this.relay, [owner]);
  }

  async approve(owner: KeyPairSigner, delegate: Address, amount: bigint) {
    const ata = await this.ata(owner.address);
    await this.send("approve", [getApproveInstruction({ source: ata, delegate, owner, amount })], this.relay, [owner]);
  }

  party(address: Address): C.Party {
    const acc = this.svm.getAccount(address);
    if (!acc.exists) throw new Error("no party");
    return C.decodeParty(acc).data;
  }
  account<T>(address: Address, decode: (a: never) => { data: T }): T {
    const acc = this.svm.getAccount(address);
    if (!acc.exists) throw new Error(`no account ${address}`);
    return decode(acc as never).data;
  }

  // ------------------------------------------------------------ clock

  now(): bigint {
    return this.svm.getClock().unixTimestamp;
  }
  warpTo(ts: bigint) {
    const c = this.svm.getClock();
    c.unixTimestamp = ts;
    c.slot = c.slot + 10n;
    this.svm.setClock(c);
    this.svm.expireBlockhash();
  }
  warp(secs: bigint) {
    this.warpTo(this.now() + secs);
  }

  // ------------------------------------------------------------ transactions

  async send(label: string, ixs: Instruction[], feePayer: TransactionSigner = this.relay, extra: TransactionSigner[] = [], cuLimit = 400_000): Promise<Sent> {
    void extra; // signers ride on the instructions' account metas
    const msg = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(feePayer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash({ blockhash: this.svm.latestBlockhash(), lastValidBlockHeight: 1_000_000n }, m),
      (m) => appendTransactionMessageInstructions([getSetComputeUnitLimitInstruction({ units: cuLimit }), ...ixs], m),
    );
    const tx = await signTransactionMessageWithSigners(msg);
    const size = getTransactionEncoder().encode(tx).length;
    const res = this.svm.sendTransaction(tx);
    this.svm.expireBlockhash();
    if (res instanceof FailedTransactionMetadata) {
      const logs = res.meta().logs();
      const err = new Error(`${label} failed: ${res.toString()}\n${logs.slice(-12).join("\n")}`) as Error & { logs: string[] };
      err.logs = logs;
      throw err;
    }
    const events = C.eventsFromLogs(res.logs());
    for (const e of events) {
      if (e.name === "LeafAppended") {
        const at = this.tree.append(Z.bytesToBig(Uint8Array.from(e.data.leaf)));
        if (BigInt(at) !== e.data.index) throw new Error("tree mirror out of order");
        if (this.tree.root() !== Z.bytesToBig(Uint8Array.from(e.data.root))) throw new Error("device tree root != program root");
      }
    }
    const cu = res.computeUnitsConsumed();
    (this.cu[label] ??= []).push(cu);
    (this.sizes[label] ??= []).push(size);
    return { meta: res, events, cu, size };
  }

  /** Expect a transaction to fail with a program error message (or any failure). */
  async fails(label: string, ixs: Instruction[], match?: RegExp, feePayer?: TransactionSigner) {
    try {
      await this.send(label, ixs, feePayer);
    } catch (e) {
      const logs = (e as { logs?: string[] }).logs ?? [];
      if (match && !match.test(logs.join("\n")) && !match.test((e as Error).message)) {
        throw new Error(`${label} failed for the wrong reason:\n${logs.slice(-8).join("\n")}`);
      }
      return;
    }
    throw new Error(`${label} should have failed`);
  }

  /** Put a fulfilled ORAO randomness account on the chain for this seed. */
  async fulfilOrao(seed: Uint8Array, randomness: Uint8Array) {
    const address = await C.oraoRandomnessPda(seed);
    const disc = createHash("sha256").update("account:RandomnessV2").digest().subarray(0, 8);
    const data = new Uint8Array(8 + 1 + 32 + 32 + 64);
    data.set(disc, 0);
    data[8] = 1;
    data.set(getAddressEncoder().encode(this.relay.address), 9);
    data.set(seed, 41);
    data.set(randomness, 73);
    this.svm.setAccount({
      address,
      data,
      executable: false,
      lamports: lamports(this.svm.minimumBalanceForRentExemption(BigInt(data.length))),
      programAddress: C.ORAO_VRF_ADDRESS,
      space: BigInt(data.length),
    });
    return address;
  }

  cuReport(): Record<string, { maxCu: number; maxBytes: number; runs: number }> {
    return Object.fromEntries(
      Object.entries(this.cu).map(([k, v]) => [k, { maxCu: Number(v.reduce((a, b) => (a > b ? a : b))), maxBytes: Math.max(...this.sizes[k]), runs: v.length }]),
    );
  }
}

// ------------------------------------------------------------ proofs

const WASM = join(KEYS, "kitty_action.wasm");
const ZKEY = join(KEYS, "kitty_action.zkey");

export async function prove(a: Z.ActionInput) {
  const input = Z.buildInput(a);
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
  return { proof: Z.proofToSolana(proof), signals: Z.actionSignals(publicSignals) };
}

export function aadhaarFixture() {
  return JSON.parse(readFileSync(join(ROOT, "circuits/test/fixtures/aadhaar_test_qr.json"), "utf8"));
}
