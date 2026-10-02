/** RPC access, keys, and sending transactions (shared by the API, indexer and Butler). */
import {
  type Address,
  type Instruction,
  type KeyPairSigner,
  type Rpc,
  type Signature,
  type SolanaRpcApi,
  type TransactionSigner,
  address,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createTransactionMessage,
  getBase58Decoder,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { getSetComputeUnitLimitInstruction } from "@solana-program/compute-budget";
import * as C from "@kitty/chain";
import { env } from "./env";

export const rpc: Rpc<SolanaRpcApi> = createSolanaRpc(env.RPC_URL);
export const programId = address(env.KITTY_PROGRAM_ID);

export async function signerFromEnv(json: string, name: string): Promise<KeyPairSigner | null> {
  if (!json) return null;
  try {
    return await createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(json)));
  } catch {
    throw new Error(`${name} must be a JSON array secret key`);
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wait for a signature to reach "confirmed" (or fail). */
export async function confirm(sig: Signature, timeoutMs = 60_000): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const { value } = await rpc.getSignatureStatuses([sig]).send();
    const s = value[0];
    if (s?.err) throw new Error(`transaction ${sig} failed: ${JSON.stringify(s.err, (_, v) => (typeof v === "bigint" ? v.toString() : v))}`);
    if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) return;
    await sleep(800);
  }
  throw new Error(`transaction ${sig} not confirmed in time`);
}

/** Build, sign (fee payer + any signers on the instructions), send and confirm. */
export async function sendInstructions(payer: TransactionSigner, ixs: Instruction[], cu = 300_000): Promise<Signature> {
  const { value: bh } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const msg = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(payer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(bh, m),
    (m) => appendTransactionMessageInstructions([getSetComputeUnitLimitInstruction({ units: cu }), ...ixs], m),
  );
  const tx = await signTransactionMessageWithSigners(msg);
  const sig = getSignatureFromTransaction(tx);
  await rpc.sendTransaction(getBase64EncodedWireTransaction(tx), { encoding: "base64", preflightCommitment: "confirmed" }).send();
  await confirm(sig);
  return sig;
}

/** Every Party account (one getProgramAccounts with the discriminator filter). */
export async function fetchParties(): Promise<{ address: Address; data: C.Party }[]> {
  const disc = getBase58Decoder().decode(C.PARTY_DISCRIMINATOR);
  const res = await rpc
    .getProgramAccounts(programId, {
      encoding: "base64",
      filters: [{ memcmp: { offset: 0n, bytes: disc as never, encoding: "base58" } }],
    })
    .send();
  return res.map((r) => {
    const bytes = Uint8Array.from(Buffer.from(r.account.data[0], "base64"));
    return { address: r.pubkey, data: C.getPartyDecoder().decode(bytes) };
  });
}

export async function fetchAccountData(addr: Address): Promise<Uint8Array | null> {
  const { value } = await rpc.getAccountInfo(addr, { encoding: "base64" }).send();
  return value ? Uint8Array.from(Buffer.from(value.data[0], "base64")) : null;
}

export async function fetchConfig() {
  const d = await fetchAccountData(await C.configPda());
  return d ? C.getConfigDecoder().decode(d) : null;
}
export async function fetchHouse() {
  const d = await fetchAccountData(await C.housePda());
  return d ? C.getHouseFundDecoder().decode(d) : null;
}
export async function fetchTree() {
  const d = await fetchAccountData(await C.treePda());
  return d ? C.getKittyTreeDecoder().decode(d) : null;
}
export async function tokenBalance(addr: Address): Promise<bigint> {
  try {
    const { value } = await rpc.getTokenAccountBalance(addr).send();
    return BigInt(value.amount);
  } catch {
    return 0n;
  }
}

/** A tiny TTL cache for hot chain reads. */
export function cached<T>(ms: number, fn: () => Promise<T>): () => Promise<T> {
  let at = 0;
  let value: Promise<T> | null = null;
  return () => {
    if (!value || Date.now() - at > ms) {
      at = Date.now();
      value = fn().catch((e) => {
        value = null;
        throw e;
      });
    }
    return value;
  };
}

const SYSVAR_CLOCK = address("SysvarC1ock11111111111111111111111111111111");

/** The chain's clock: the Clock sysvar's unix_timestamp, which the program checks every deadline
 *  against. The server's clock can drift from it (a lot, on a restarted local validator). */
export async function chainClock(): Promise<number> {
  const { value } = await rpc.getAccountInfo(SYSVAR_CLOCK, { encoding: "base64", commitment: "confirmed" }).send();
  if (!value) throw new Error("clock unavailable");
  return Number(Buffer.from(value.data[0], "base64").readBigInt64LE(32));
}
